import crypto from 'crypto';
import { getAuthorizedAdminEmail, isAuthorizedAdminEmail } from '@/lib/adminAuth';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

/**
 * Compara duas strings em tempo constante usando SHA-256 para normalizar o tamanho.
 * Evita vazamento de informações via timing attack.
 */
function safeStringCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Segredo de assinatura das sessões administrativas.
 *
 * Usa SOMENTE `ADMIN_SESSION_SECRET`. Antes esta função caía em
 * `ADMIN_PASSCODE`, depois em `GEMINI_API_KEY`, e por fim num literal fixo
 * no código. As três rotas eram vulneráveis: a senha do painel virava chave de
 * assinatura, um vazamento de qualquer chave de IA abria o painel, e sem
 * nenhuma delas o repositório inteiro carregava uma chave conhecida — o que
 * permitia forjar um token `tva_` sem saber nada do servidor.
 *
 * Sem a variável, o sistema falha fechado: nenhuma sessão é emitida ou aceita.
 */
function getSessionSecret(): string {
  ensureServerEnvLoaded();
  return cleanEnvValue(process.env.ADMIN_SESSION_SECRET || '');
}

/** `true` quando existe segredo utilizável. Sem isso, nenhuma sessão funciona. */
export function isSessionSecretConfigured(): boolean {
  return getSessionSecret().length >= 16;
}

/**
 * Cria um token de sessão administrativo assinado com HMAC-SHA256 e expiração (7 dias).
 */
export function createAdminSessionToken(email: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error(
      'ADMIN_SESSION_SECRET não configurado. Defina a variável no ambiente do servidor antes de emitir sessões.'
    );
  }
  const normalizedEmail = email.toLowerCase().trim();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 dias
  const payload = `${normalizedEmail}|${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}|${signature}`).toString('base64url');
  return `tva_${token}`;
}

/**
 * Valida a integridade, assinatura HMAC e expiração de um token de sessão de admin.
 */
export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string } {
  if (!token || typeof token !== 'string') return { valid: false };

  // Sem segredo configurado, nenhuma assinatura é aceitável — inclusive uma
  // feita com chave vazia.
  const secret = getSessionSecret();
  if (!secret) return { valid: false };

  try {
    let cleanToken = token.trim();
    if (cleanToken.startsWith('Bearer ')) {
      cleanToken = cleanToken.substring(7).trim();
    }

    if (!cleanToken.startsWith('tva_')) {
      return { valid: false };
    }

    const rawBase64 = cleanToken.substring(4);
    const decoded = Buffer.from(rawBase64, 'base64url').toString('utf-8');
    const parts = decoded.split('|');

    if (parts.length !== 3) {
      return { valid: false };
    }

    const [email, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false }; // Token expirado
    }

    if (!isAuthorizedAdminEmail(email)) {
      return { valid: false };
    }

    const payload = `${email}|${expiresAtStr}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Comparação de tempo constante para prevenir timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false };
    }

    return { valid: true, email };
  } catch {
    return { valid: false };
  }
}

/**
 * Validação segura de requisições em rotas de API server-side.
 */
export function verifyServerAdmin(
  req: { headers: { get(name: string): string | null }; url?: string }
): { authorized: boolean; email?: string } {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const adminPasscode = req.headers.get('x-admin-passcode') || req.headers.get('x-admin-token') || '';
    const adminEmail = (req.headers.get('x-admin-email') || req.headers.get('x-admin-user') || '').toLowerCase().trim();

    let bearerToken = '';
    if (authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const tokenToCheck = (bearerToken || adminPasscode).trim();
    if (!tokenToCheck && !adminEmail) {
      return { authorized: false };
    }

    // 1. Validação de token de sessão assinado com HMAC (tva_...)
    if (tokenToCheck.startsWith('tva_')) {
      const sessionResult = verifyAdminSessionToken(tokenToCheck);
      if (sessionResult.valid && sessionResult.email) {
        return { authorized: true, email: sessionResult.email };
      }
    }

    // 2. Senha do painel.
    //
    // Só `ADMIN_PASSCODE` é lida. Antes esta rota aceitava também `ADMIN_TOKEN`,
    // o que criava duas variáveis para a mesma coisa: bastava alguém configurar
    // a segunda, sem documentar, para o painel abrir com uma credencial que
    // ninguém conhecia. O alias legado continua aceito na leitura, com aviso,
    // para não derrubar quem ainda usa o nome antigo.
    const configuredSecret = cleanEnvValue(process.env.ADMIN_PASSCODE || '');
    const legacySecret = process.env.ADMIN_TOKEN
      ? cleanEnvValue(process.env.ADMIN_TOKEN)
      : '';

    if (legacySecret && legacySecret !== configuredSecret) {
      console.warn(
        '[ServerAdminAuth] ADMIN_TOKEN está definido e difere de ADMIN_PASSCODE. ' +
          'Use apenas ADMIN_PASSCODE; ADMIN_TOKEN será removido.'
      );
    }

    for (const secret of [configuredSecret, legacySecret]) {
      if (!secret) continue;
      if (
        safeStringCompare(tokenToCheck, secret) ||
        safeStringCompare(cleanEnvValue(tokenToCheck), secret)
      ) {
        const email = adminEmail && isAuthorizedAdminEmail(adminEmail) ? adminEmail : getAuthorizedAdminEmail();
        return { authorized: true, email };
      }
    }
  } catch (err) {
    console.error('[ServerAdminAuth] Erro ao validar requisição:', err);
  }

  return { authorized: false };
}

