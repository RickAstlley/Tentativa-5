import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  isAuthorizedAdminEmail,
} from '@/lib/adminAuth';
import { createAdminSessionToken } from '@/lib/serverAdminAuth';
import { getAdminAuth, ensureAdminAccessConfig } from '@/lib/firebaseAdmin';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import { checkRateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Endpoint server-side de autenticação para o painel administrativo do TuaVia.
 * 
 * Valida credenciais (passcode mestre privado ou Firebase ID Token) e emite
 * uma sessão segura assinada com HMAC.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting por IP ou identificador de sessão
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : (req.headers.get('x-real-ip') || 'unknown');
    const rateCheck = checkRateLimit(`login:${ip}`, { windowMs: 60_000, maxRequests: 10 });

    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: 'Muitas tentativas de login. Tente novamente em alguns minutos.',
          errorCode: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      );
    }

    const body = await req.json();
    const { email, passcode, idToken } = body;

    // Sync admin config doc so Firestore rules know which emails are admins
    await ensureAdminAccessConfig();

    // ─────────────────────────────────────────────────────────────
    // FLUXO 1: Autenticação via Firebase ID Token (Login Google)
    // ─────────────────────────────────────────────────────────────
    if (idToken && typeof idToken === 'string') {
      let verifiedEmail = (email || '').toLowerCase().trim();

      const adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(idToken);
          if (decoded.email) {
            verifiedEmail = decoded.email.toLowerCase().trim();
          }
        } catch (err: any) {
          console.warn('[AdminAuth API] Falha ao verificar ID Token no Firebase Admin:', err?.message);
          return NextResponse.json(
            { success: false, error: 'Token do Firebase inválido ou expirado.', errorCode: 'INVALID_ID_TOKEN' },
            { status: 401 }
          );
        }
      }

      if (!isAuthorizedAdminEmail(verifiedEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Acesso negado. Esta conta Google não possui privilégios de administrador.',
            errorCode: 'FORBIDDEN_EMAIL',
          },
          { status: 403 }
        );
      }

      try {
        const sessionToken = createAdminSessionToken(verifiedEmail);
        return NextResponse.json({
          success: true,
          email: verifiedEmail,
          token: sessionToken,
          authMethod: 'google',
        });
      } catch (tokenErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: 'A autenticação administrativa não está configurada no servidor.',
            errorCode: 'ADMIN_AUTH_NOT_CONFIGURED',
          },
          { status: 503 }
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // FLUXO 2: Autenticação via Chave de Acesso (Passcode Mestre Privado)
    // ─────────────────────────────────────────────────────────────
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail || !isAuthorizedAdminEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'E-mail não autorizado para acesso administrativo.',
          errorCode: 'UNAUTHORIZED_EMAIL',
        },
        { status: 403 }
      );
    }

    ensureServerEnvLoaded();
    const cleanPasscode = cleanEnvValue(passcode || '');

    // Senha obtida EXCLUSIVAMENTE do ambiente do servidor. `ADMIN_TOKEN` e o
    // alias legado e so e aceito se `ADMIN_PASSCODE` nao existir, para nao
    // manter duas credenciais valendo ao mesmo tempo.
    const primarySecret = cleanEnvValue(process.env.ADMIN_PASSCODE || '');
    const legacySecret = process.env.ADMIN_TOKEN
      ? cleanEnvValue(process.env.ADMIN_TOKEN)
      : '';
    const validSecrets = [primarySecret, legacySecret].filter(Boolean);

    if (validSecrets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'A variável ADMIN_PASSCODE não está configurada no ambiente do servidor/Hostinger.',
          errorCode: 'PASSCODE_NOT_CONFIGURED',
        },
        { status: 500 }
      );
    }

    if (!cleanPasscode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Informe a chave de acesso administrativa.',
          errorCode: 'MISSING_PASSCODE',
        },
        { status: 400 }
      );
    }

    const isMatch = validSecrets.some(
      (s) => safeCompare(s, cleanPasscode) || safeCompare(s, (passcode || '').trim())
    );

    if (!isMatch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chave de acesso incorreta. A chave informada não confere com ADMIN_PASSCODE.',
          errorCode: 'INVALID_PASSCODE',
        },
        { status: 401 }
      );
    }

    // Gera token de sessão assinado com HMAC
    try {
      const sessionToken = createAdminSessionToken(normalizedEmail);

      return NextResponse.json({
        success: true,
        email: normalizedEmail,
           displayName: `Administrador (${normalizedEmail.split('@')[0]})`,
        token: sessionToken,
        authMethod: 'passcode',
      });
    } catch (tokenErr) {
      // A senha confere, mas não há segredo de sessão no ambiente: sem ele não
      // existe token válido, e o painel abriria para depois falhar em toda
      // chamada de API. Erro explícito é melhor que sucesso ilusório.
      console.error('[AdminAuth API] Senha validada sem conseguir assinar a sessão:', tokenErr);
      return NextResponse.json(
        {
          success: false,
          error:
            'ADMIN_SESSION_SECRET não está configurado no servidor. Defina a variável para emitir sessões.',
          errorCode: 'SESSION_SECRET_NOT_CONFIGURED',
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('[AdminAuth API /api/admin/auth/login] Erro:', err);
    return NextResponse.json(
      { success: false, error: 'Ocorreu um erro interno ao validar o acesso administrativo.', errorCode: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
