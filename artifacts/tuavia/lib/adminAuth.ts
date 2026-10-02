import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import { safeJsonStringify } from '@/lib/utils';
import { cleanEnvValue } from '@/lib/envShared';

function getAdminEmails(): string[] {
  if (typeof window === 'undefined') {
    return cleanEnvValue(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // Client-side: cannot read server env, return empty — server validates.
  return [];
}

/**
 * E-mail único e exclusivo autorizado para administração do TuaVia.
 * Lido exclusivamente da variável de ambiente ADMIN_EMAILS (server-side).
 */
export const AUTHORIZED_ADMIN_EMAIL = cleanEnvValue(process.env.ADMIN_EMAILS || '')
  .split(',')[0]
  ? cleanEnvValue(process.env.ADMIN_EMAILS || '')
      .split(',')[0]
      .trim()
      .toLowerCase()
  : '';

export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = getAdminEmails();

const ADMIN_SESSION_KEY = 'tuavia_admin_session_auth_v1';

export interface AdminSessionData {
  email: string;
  displayName?: string;
  photoURL?: string;
  authMethod: 'google' | 'passcode' | 'quick' | 'auto';
  authenticatedAt: number;
  token: string;
}

/**
 * Valida se um e-mail pertence à lista autorizada de administradores.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  if (normalized === AUTHORIZED_ADMIN_EMAIL.toLowerCase().trim()) return true;
  return AUTHORIZED_ADMIN_EMAILS.some(
    (admin) => admin.toLowerCase().trim() === normalized
  );
}


/**
 * Obtém os dados completos do administrador atualmente autenticado via sessão local.
 * Retorna null se nenhuma sessão válida existir (sem criação automática).
 */
export function getStoredAdminSession(): AdminSessionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as AdminSessionData;
    if (data && data.email && isAuthorizedAdminEmail(data.email) && data.token) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtém apenas o e-mail do administrador atualmente autenticado na sessão.
 */
export function getStoredAdminEmail(): string | null {
  return getStoredAdminSession()?.email || null;
}

/**
 * Salva a sessão do administrador localmente garantindo token válido emitido pelo servidor ou Firebase.
 */
export function setAdminSession(
  email: string,
  extra?: { displayName?: string; photoURL?: string; authMethod?: 'google' | 'passcode' | 'quick' | 'auto'; token?: string }
): boolean {
  if (typeof window === 'undefined') return false;

  const normalizedEmail = (email || AUTHORIZED_ADMIN_EMAIL).toLowerCase().trim();

  // Sem token emitido pelo servidor, não há sessão. Antes, este código fabricava
  // um token `tva_` sem assinatura: o painel abria, toda chamada de API
  // respondia 401, e o sintoma parecia "login entrou mas nada funciona".
  // Pior, o token tinha cara de sessão válida e enganava qualquer inspeção
  // casual do localStorage.
  const validToken = extra?.token?.trim();
  if (!validToken) {
    console.warn('[adminAuth] Sessão recusada: o servidor não emitiu token de sessão.');
    return false;
  }

  try {
    const sessionData: AdminSessionData = {
      email: normalizedEmail,
       displayName: extra?.displayName || `Administrador (${normalizedEmail.split('@')[0]})`,
      photoURL: extra?.photoURL || undefined,
      authMethod: extra?.authMethod || 'quick',
      authenticatedAt: Date.now(),
      token: validToken,
    };
    const json = safeJsonStringify(sessionData);
    sessionStorage.setItem(ADMIN_SESSION_KEY, json);
    localStorage.setItem(ADMIN_SESSION_KEY, json);
    return true;
  } catch (err) {
    console.error('Erro ao salvar sessão de administrador:', err);
    return false;
  }
}

/**
 * Limpa a sessão do administrador e faz logout.
 */
export async function clearAdminSession(): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
  try {
    await signOut(auth);
  } catch {
    // Falha silenciosa se o Firebase não estiver inicializado
  }
}

/**
 * Autentica com e-mail autorizado e chave de acesso no servidor e cliente.
 */
export async function authenticateWithPasscodeAsync(
  email: string,
  passcode: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const cleanPasscode = (passcode || '').trim();

  if (!normalizedEmail) {
    return { success: false, error: 'Informe o e-mail administrativo.' };
  }

  if (!cleanPasscode) {
    return { success: false, error: 'Informe a chave de acesso (ADMIN_PASSCODE).' };
  }

  try {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, passcode: cleanPasscode }),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        success: false,
        error: 'Erro na resposta do servidor de autenticação.',
      };
    }

    if (res.ok && data.success) {
      setAdminSession(normalizedEmail, {
        displayName: data.displayName || 'Administrador',
        authMethod: 'passcode',
        token: data.token,
      });
      return { success: true };
    }

    return {
      success: false,
      error: data.error || 'Credenciais inválidas ou variáveis de ambiente incorretas.',
    };
  } catch (err: any) {
    console.error('Erro na chamada de login:', err);
    return {
      success: false,
      error: err?.message || 'Falha de conexão com o servidor ao autenticar.',
    };
  }
}

/**
 * Autenticação via Chave de Acesso (Passcode Mestre).
 */
export async function authenticateWithPasscode(
  email: string,
  passcode: string
): Promise<{ success: boolean; error?: string }> {
  return authenticateWithPasscodeAsync(email, passcode);
}

/**
 * Login com seleção de conta Google (in-app ou verificado).
 */
export function authenticateWithGoogleAccount(
  email: string,
  displayName?: string,
  photoURL?: string,
  idToken?: string
): boolean {
  const targetEmail = (email || '').toLowerCase().trim();
  if (!targetEmail || !isAuthorizedAdminEmail(targetEmail)) {
    return false;
  }
  return setAdminSession(targetEmail, {
    displayName: displayName || 'Administrador',
    photoURL: photoURL || undefined,
    authMethod: 'google',
    token: idToken,
  });
}

/**
 * Valida o usuário atualmente logado no Firebase Auth ou na sessão local.
 */
export async function validateAdminUser(user?: User | null): Promise<boolean> {
  // 1. Checa Firebase Auth
  if (user && user.email) {
    if (isAuthorizedAdminEmail(user.email)) {
      let idToken: string | undefined;
      try {
        idToken = await user.getIdToken();
      } catch {
        // Fallback silencioso
      }
      setAdminSession(user.email, {
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
        authMethod: 'google',
        token: idToken,
      });
      return true;
    }
    return false;
  }

  // 2. Checa sessão ativa em armazenamento local
  const session = getStoredAdminSession();
  if (session && session.email && isAuthorizedAdminEmail(session.email) && session.token) {
    return true;
  }

  return false;
}


