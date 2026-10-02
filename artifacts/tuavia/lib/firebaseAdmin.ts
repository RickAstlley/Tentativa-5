import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import type { Storage } from 'firebase-admin/storage';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

import appletConfigJson from '../firebase-applet-config.json';

const appletConfig: Record<string, any> = appletConfigJson || {};

let adminAppInstance: App | null = null;
let adminDbInstance: Firestore | null = null;
let adminAuthInstance: Auth | null = null;
let adminStorageInstance: Storage | null = null;

export function getRawServiceAccountEnv(): string | undefined {
  ensureServerEnvLoaded();
  const sa =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_ADMIN_CREDENTIALS ||
    process.env.FIREBASE_CREDENTIALS ||
    process.env.GOOGLE_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    return cleanEnvValue(sa);
  }

  // Se não estiver em variável de ambiente, verifica arquivos no disco automaticamente
  try {
    const diskCandidates = [
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'data/serviceAccountKey.json'),
      path.resolve(process.cwd(), 'firebase-service-account.json'),
      path.resolve(process.cwd(), '..', 'serviceAccountKey.json'),
      path.resolve(process.cwd(), '.next/standalone/serviceAccountKey.json'),
      path.resolve(process.cwd(), '.next/standalone/data/serviceAccountKey.json'),
    ];
    for (const candidate of diskCandidates) {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8').trim();
        if (content.startsWith('{') && content.includes('"private_key"')) {
          return content;
        }
      }
    }
  } catch (_) {
    // ignorar erros de fs
  }

  // Fallback embutido diretamente na configuração empacotada do projeto
  if (appletConfig.serviceAccount && appletConfig.serviceAccount.private_key) {
    return JSON.stringify(appletConfig.serviceAccount);
  }

  return undefined;
}

export function getFirebaseProjectIdEnv(): string {
  ensureServerEnvLoaded();
  const pid = cleanEnvValue(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCP_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    ''
  );
  if (!pid || pid.includes('placeholder')) {
    if (appletConfig.projectId) {
      return appletConfig.projectId;
    }
    const rawSA = getRawServiceAccountEnv();
    const parsedSA = parseServiceAccount(rawSA);
    if (parsedSA?.project_id) {
      return parsedSA.project_id;
    }
    return 'tuavia-cf9ba';
  }
  return pid;
}

export function isRealFirebaseConfigured(): boolean {
  ensureServerEnvLoaded();
  const pid = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '');
  const apiKey = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '');
  const rawSA = getRawServiceAccountEnv();
  const parsedSA = parseServiceAccount(rawSA);

  const hasRealPid = Boolean(pid && !pid.includes('placeholder') && pid !== 'gen-lang-client-0046421177');
  const hasRealKey = Boolean(apiKey && !apiKey.includes('placeholder') && !apiKey.includes('PlaceholderKey'));
  const hasRealSA = Boolean(parsedSA && (parsedSA.private_key || parsedSA.project_id));

  return hasRealSA || (hasRealPid && hasRealKey);
}

export function parseServiceAccount(rawInput?: string): Record<string, any> | null {
  const inputToUse = rawInput || getRawServiceAccountEnv();
  if (!inputToUse || typeof inputToUse !== 'string') {
    if (appletConfig.serviceAccount && appletConfig.serviceAccount.private_key) {
      return appletConfig.serviceAccount;
    }
    return null;
  }

  let cleaned = inputToUse.trim();
  if (!cleaned) {
    if (appletConfig.serviceAccount && appletConfig.serviceAccount.private_key) {
      return appletConfig.serviceAccount;
    }
    return null;
  }

  // 1. Se for caminho para arquivo (.json ou arquivo existente no disco), lê o conteúdo
  if (!cleaned.startsWith('{')) {
    try {
      const searchPaths = [
        cleaned,
        path.resolve(process.cwd(), cleaned),
        path.resolve(process.cwd(), '.next/standalone', cleaned),
        path.resolve(process.cwd(), '..', cleaned),
      ];
      for (const sp of searchPaths) {
        if (fs.existsSync(sp) && fs.statSync(sp).isFile()) {
          const content = fs.readFileSync(sp, 'utf-8').trim();
          if (content.startsWith('{')) {
            cleaned = content;
            break;
          }
        }
      }
    } catch {
      // continua para os outros métodos
    }
  }

  // 2. Remove prefixos comuns de cópia/cola de .env ou scripts
  cleaned = cleaned
    .replace(/^(export\s+)?FIREBASE_ADMIN_SERVICE_ACCOUNT\s*=\s*/i, '')
    .replace(/^json\s*:\s*/i, '')
    .replace(/^service_account\s*:\s*/i, '')
    .trim();

  // 3. Se estiver envolvido em aspas externas (ex: "'{...}'" ou '"{...}"'), remove as aspas
  if (
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('"') && cleaned.endsWith('"'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // 4. Suporte a Base64 caso o usuário tenha codificado para evitar quebras de linha
  if (!cleaned.startsWith('{') && /^[A-Za-z0-9+/=]+$/.test(cleaned.replace(/\s+/g, ''))) {
    try {
      const decoded = Buffer.from(cleaned, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{') && decoded.endsWith('}')) {
        cleaned = decoded;
      }
    } catch (_) {
      // continua para os outros métodos
    }
  }

  // 5. Isola apenas o bloco JSON se houver texto extra antes de '{' ou depois de '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Sanitiza quebras de linha literais dentro de valores em aspas (ex: chave privada com quebras reais)
  cleaned = sanitizeJsonWithLiteralLinebreaks(cleaned);

  // 6. Tenta fazer parse do JSON
  let parsed: any = null;
  try {
    parsed = JSON.parse(cleaned);
    // Se o resultado do parse ainda for uma string (JSON duplamente escapado), faz parse novamente
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
  } catch (err: any) {
    // Tenta tratar barras invertidas de newlines na private_key caso o parse falhe
    try {
      const unescaped = cleaned.replace(/\\r/g, '').replace(/\\n/g, '\n');
      parsed = JSON.parse(unescaped);
    } catch (_) {
      try {
        const fixedEscapes = cleaned.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
        parsed = JSON.parse(fixedEscapes);
      } catch (err2: any) {
        if (appletConfig.serviceAccount && appletConfig.serviceAccount.private_key) {
          return appletConfig.serviceAccount;
        }
        console.warn('⚠️ Falha ao analisar JSON da credencial Service Account do Firebase:', err2?.message || err2);
        return null;
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    if (appletConfig.serviceAccount && appletConfig.serviceAccount.private_key) {
      return appletConfig.serviceAccount;
    }
    return null;
  }

  // 7. Normaliza a private_key para conter quebras de linha reais
  if (parsed.private_key && typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

export function sanitizeJsonWithLiteralLinebreaks(str: string): string {
  let insideString = false;
  let escape = false;
  let result = '';
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !escape) {
      insideString = !insideString;
      result += char;
    } else if (char === '\\' && insideString) {
      escape = !escape;
      result += char;
    } else if ((char === '\n' || char === '\r') && insideString) {
      result += '\\n';
    } else {
      escape = false;
      result += char;
    }
  }
  return result;
}

export function getAdminApp(): App | null {
  if (adminAppInstance) return adminAppInstance;

  try {
    if (getApps().length > 0) {
      adminAppInstance = getApp();
      return adminAppInstance;
    }

    const projectId = getFirebaseProjectIdEnv();
    const storageBucket =
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      (projectId ? `${projectId}.appspot.com` : undefined);

    const rawServiceAccount = getRawServiceAccountEnv();

    if (rawServiceAccount) {
      try {
        const serviceAccount = parseServiceAccount(rawServiceAccount);
        if (serviceAccount && (serviceAccount.private_key || serviceAccount.project_id)) {
          const effectiveProjectId = serviceAccount.project_id || projectId;
          adminAppInstance = initializeApp({
            ...(serviceAccount.private_key && serviceAccount.client_email
              ? { credential: cert(serviceAccount) }
              : {}),
            projectId: effectiveProjectId,
            storageBucket,
          });
          return adminAppInstance;
        }
      } catch (err: any) {
        console.warn('⚠️ Erro ao inicializar Firebase com Service Account:', err?.message || err);
      }
    }

    if (appletConfig.serviceAccount?.private_key && appletConfig.serviceAccount?.client_email) {
      try {
        const sa = appletConfig.serviceAccount;
        adminAppInstance = initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || projectId,
          storageBucket,
        });
        return adminAppInstance;
      } catch (err: any) {
        console.warn('⚠️ Erro ao inicializar Firebase com appletConfig.serviceAccount:', err?.message || err);
      }
    }

    if (projectId) {
      try {
        adminAppInstance = initializeApp({ projectId, storageBucket });
        return adminAppInstance;
      } catch (err: any) {
        console.warn('Não foi possível inicializar Firebase Admin App via Project ID:', err?.message || err);
      }
    }
  } catch (err: any) {
    console.warn('Não foi possível inicializar Firebase Admin App:', err?.message || err);
  }

  return null;
}

export function getFirebaseDatabaseIdEnv(): string {
  const envDbId = cleanEnvValue(process.env.FIREBASE_DATABASE_ID || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID);
  if (envDbId && !envDbId.includes('placeholder') && envDbId.trim() !== '' && envDbId !== '(default)') {
    return envDbId.trim();
  }
  if (appletConfig.firestoreDatabaseId) {
    return appletConfig.firestoreDatabaseId;
  }
  return '(default)';
}

let lastFirestoreErrorTime = 0;

export function isFirestoreDatabaseAvailable(): boolean {
  return Date.now() - lastFirestoreErrorTime > 30000;
}

export function markFirestoreUnavailable(): void {
  lastFirestoreErrorTime = Date.now();
  console.info('[Firebase Admin] Falha na requisição ao Cloud Firestore. Próximas tentativas usarão fallback se necessário.');
}

export function getAdminDb(): Firestore | null {
  if (adminDbInstance) return adminDbInstance;
  const app = getAdminApp();
  if (!app) return null;

  try {
    const databaseId = getFirebaseDatabaseIdEnv();
    adminDbInstance = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);
    try {
      adminDbInstance.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings já configuradas
    }
    return adminDbInstance;
  } catch (err) {
    console.warn('Não foi possível inicializar Firestore Admin:', err);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  if (adminAuthInstance) return adminAuthInstance;
  const app = getAdminApp();
  if (!app) return null;

  try {
    adminAuthInstance = getAuth(app);
    return adminAuthInstance;
  } catch (err) {
    console.warn('Não foi possível inicializar Auth Admin:', err);
    return null;
  }
}

export function getAdminStorage(): Storage | null {
  if (adminStorageInstance) return adminStorageInstance;
  const app = getAdminApp();
  if (!app) return null;

  try {
    adminStorageInstance = getStorage(app);
    return adminStorageInstance;
  } catch (err) {
    console.warn('Não foi possível inicializar Storage Admin:', err);
    return null;
  }
}

// Backward compatibility proxies that fail gracefully
export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    const db = getAdminDb();
    if (!db) {
      if (prop === 'batch') {
        return () => ({
          set: () => {},
          update: () => {},
          delete: () => {},
          commit: async () => {},
        });
      }
      if (prop === 'collection') {
        return () => ({
          get: async () => ({ empty: true, forEach: () => {} }),
          doc: () => ({
            get: async () => ({ exists: false, data: () => null }),
            set: async () => {},
            update: async () => {},
            delete: async () => {},
          }),
        });
      }
      return () => {};
    }
    const val = (db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(db);
    }
    return val;
  },
});

export async function withAdminTimeout<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  ms: number = 800,
  fallback: T
): Promise<T> {
  let actualPromise: Promise<T>;
  try {
    actualPromise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  } catch (err: any) {
    if (err && (err.code === 5 || String(err).includes('5 NOT_FOUND') || String(err).includes('does not exist'))) {
      markFirestoreUnavailable();
    }
    return fallback;
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });

  const wrappedPromise = actualPromise
    .then((res) => {
      if (timer) clearTimeout(timer);
      return res;
    })
    .catch((err: any) => {
      if (timer) clearTimeout(timer);
      if (err && (err.code === 5 || String(err).includes('5 NOT_FOUND') || String(err).includes('does not exist'))) {
        markFirestoreUnavailable();
      }
      return fallback;
    });

  return Promise.race([wrappedPromise, timeoutPromise]);
}

/**
 * Ensures the Firestore rules admin config document exists.
 * Called during login to sync ADMIN_EMAILS env var with the document
 * that Firestore security rules reference in isAdmin().
 */
export async function ensureAdminAccessConfig(): Promise<void> {
  const db = getAdminDb();
  if (!db) return;

  const adminEmailsRaw = cleanEnvValue(process.env.ADMIN_EMAILS || '');
  const emails = adminEmailsRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.warn('[firebaseAdmin] ADMIN_EMAILS not set; skipping admin config sync.');
    return;
  }

  try {
    const ref = db.collection('config').doc('adminAccess');
    await ref.set({ adminEmails: emails }, { merge: true });
  } catch (err: any) {
    console.warn('[firebaseAdmin] Failed to sync admin access config:', err?.message);
  }
}
