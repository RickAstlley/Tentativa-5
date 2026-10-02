import fs from 'fs';
import path from 'path';

/**
 * TuaVia — Gerenciador e Sanitizador Universal de Variáveis de Ambiente
 * Seguro para uso tanto no servidor Node.js quanto em componentes empacotados.
 */

/**
 * Remove aspas externas, espaços e quebras de linha Windows (\r).
 */
export function cleanEnvValue(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim().replace(/[\r\n\t]/g, '').replace(/\u00A0/g, ' ');
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('`') && cleaned.endsWith('`'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.endsWith(';')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  return cleaned;
}

/**
 * Faz o parse seguro do conteúdo de um arquivo .env
 */
export function parseEnvFileContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content || typeof content !== 'string') return result;

  const lines = content.split('\n');
  let currentKey: string | null = null;
  let currentValue = '';
  let inMultiLine = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, '').trim();

    if (inMultiLine) {
      currentValue += '\n' + rawLine.replace(/\r/g, '');
      if (
        (currentValue.trim().startsWith('{') && currentValue.trim().endsWith('}')) ||
        (currentValue.trim().startsWith('"') && currentValue.trim().endsWith('"') && currentValue.trim().length > 1) ||
        (currentValue.trim().startsWith("'") && currentValue.trim().endsWith("'") && currentValue.trim().length > 1) ||
        currentValue.includes('-----END ')
      ) {
        if (currentKey) {
          result[currentKey] = cleanEnvValue(currentValue);
        }
        currentKey = null;
        currentValue = '';
        inMultiLine = false;
      }
      continue;
    }

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim().replace(/^(export\s+)/, '');
    const val = line.slice(equalIndex + 1).trim();

    if (
      (val.startsWith('{') && !val.endsWith('}')) ||
      (val.startsWith('-----BEGIN') && !val.includes('-----END')) ||
      (val.startsWith('"') && (!val.endsWith('"') || val.length === 1)) ||
      (val.startsWith("'") && (!val.endsWith("'") || val.length === 1))
    ) {
      currentKey = key;
      currentValue = val;
      inMultiLine = true;
      continue;
    }

    result[key] = cleanEnvValue(val);
  }

  return result;
}

function setProcessEnvKey(key: string, value: string): void {
  if (typeof process !== 'undefined' && process.env) {
    (process.env as Record<string, string | undefined>)[key] = value;
  }
}

let hasInitialized = false;
let loadedEnvFiles: string[] = [];

/**
 * Inicializa e sincroniza variáveis de ambiente do Hostinger / Node.js
 */
export function ensureServerEnvLoaded(forceReload = false): { loadedFiles: string[] } {
  if (hasInitialized && !forceReload) {
    return { loadedFiles: loadedEnvFiles };
  }
  if (forceReload) {
    loadedEnvFiles = [];
  }

  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.cwd) {
    return { loadedFiles: [] };
  }

  try {
    const searchDirs = [
      process.cwd(),
      path.resolve(process.cwd(), '.next/standalone'),
      path.resolve(process.cwd(), '..'),
      path.resolve(process.cwd(), '../..'),
    ];

    const envFiles = ['.env.production', '.env.local', '.env'];

    for (const dir of searchDirs) {
      try {
        if (!fs.existsSync(dir)) continue;

        for (const envName of envFiles) {
          const filePath = path.join(dir, envName);
          if (fs.existsSync(filePath)) {
            try {
              const stat = fs.statSync(filePath);
              if (stat.isFile()) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const parsed = parseEnvFileContent(content);
                for (const [k, v] of Object.entries(parsed)) {
                  if (forceReload || !process.env[k] || process.env[k]?.trim() === '') {
                    setProcessEnvKey(k, v);
                  }
                }
                if (!loadedEnvFiles.includes(filePath)) {
                  loadedEnvFiles.push(filePath);
                }
              }
            } catch {
              // ignora leitura de arquivo com permissão restrita
            }
          }
        }

        // Auto-carrega dados do firebase-applet-config.json como fallback nativo
        const configPath = path.join(dir, 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          try {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (cfg.projectId) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_PROJECT_ID', cfg.projectId);
              setProcessEnvKey('FIREBASE_PROJECT_ID', cfg.projectId);
            }
            if (cfg.apiKey) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_API_KEY', cfg.apiKey);
              setProcessEnvKey('FIREBASE_API_KEY', cfg.apiKey);
            }
            if (cfg.authDomain) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', cfg.authDomain);
            }
            if (cfg.storageBucket) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', cfg.storageBucket);
            }
            if (cfg.firestoreDatabaseId) {
              setProcessEnvKey('FIREBASE_DATABASE_ID', cfg.firestoreDatabaseId);
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_DATABASE_ID', cfg.firestoreDatabaseId);
            }
            if (cfg.messagingSenderId) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', cfg.messagingSenderId);
            }
            if (cfg.appId) {
              setProcessEnvKey('NEXT_PUBLIC_FIREBASE_APP_ID', cfg.appId);
            }
            if (cfg.serviceAccount && cfg.serviceAccount.private_key) {
              if (forceReload || !process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT.trim() === '') {
                setProcessEnvKey('FIREBASE_ADMIN_SERVICE_ACCOUNT', JSON.stringify(cfg.serviceAccount));
              }
            }
            if (!loadedEnvFiles.includes(configPath)) {
              loadedEnvFiles.push(configPath);
            }
          } catch {
            // ignora
          }
        }

        // Auto-carrega serviceAccountKey.json se presente no disco
        const saPath = path.join(dir, 'serviceAccountKey.json');
        if (fs.existsSync(saPath)) {
          try {
            const saContent = fs.readFileSync(saPath, 'utf-8').trim();
            if (saContent.startsWith('{') && saContent.includes('"private_key"')) {
              if (forceReload || !process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT.trim() === '') {
                setProcessEnvKey('FIREBASE_ADMIN_SERVICE_ACCOUNT', saContent);
              }
              if (!loadedEnvFiles.includes(saPath)) {
                loadedEnvFiles.push(saPath);
              }
            }
          } catch {
            // ignora
          }
        }
      } catch {
        // ignora erro de diretório inacessível
      }
    }

    // Sanitiza e descompacta aspas de variáveis críticas
    const criticalKeys = [
      'APP_URL',
      'NEXT_PUBLIC_APP_URL',
      'ADMIN_PASSCODE',
      // Legado: aceito como alias de ADMIN_PASSCODE. Remover em definitivo.
      'ADMIN_TOKEN',
      'ADMIN_SESSION_SECRET',
      'FIREBASE_ADMIN_SERVICE_ACCOUNT',
      'FIREBASE_SERVICE_ACCOUNT',
      'FIREBASE_ADMIN_CREDENTIALS',
      'FIREBASE_CREDENTIALS',
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      'GOOGLE_CREDENTIALS',
      'FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'ADMIN_EMAILS',
      'NEXT_PUBLIC_ADMIN_EMAILS',
    ];

    for (const k of criticalKeys) {
      if (process.env[k]) {
        setProcessEnvKey(k, cleanEnvValue(process.env[k]));
      }
    }

    // Sincronização bidirecional de chaves com e sem prefixo NEXT_PUBLIC_
    const syncPairs: Array<[string, string]> = [
      ['FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'],
      ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
      ['FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
      ['FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
      ['FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
      ['FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'],
      ['ADMIN_EMAILS', 'NEXT_PUBLIC_ADMIN_EMAILS'],
      ['APP_URL', 'NEXT_PUBLIC_APP_URL'],
    ];

    for (const [k1, k2] of syncPairs) {
      const v1 = process.env[k1];
      const v2 = process.env[k2];
      if (v1 && (!v2 || v2.trim() === '')) {
        setProcessEnvKey(k2, v1);
      } else if (v2 && (!v1 || v1.trim() === '')) {
        setProcessEnvKey(k1, v2);
      }
    }

    // Auto-busca por arquivo de Service Account do Firebase no disco se não houver variável explícita
    if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
      const candidateFilenames = [
        'serviceAccountKey.json',
        'firebase-service-account.json',
        'firebase-admin.json',
        'firebase-key.json',
        'service-account.json',
        'google-credentials.json',
        'serviceAccount.json',
        'config/serviceAccountKey.json',
        'data/serviceAccountKey.json',
      ];
      for (const dir of searchDirs) {
        try {
          for (const fname of candidateFilenames) {
            const fp = path.join(dir, fname);
            if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
              const fileContent = fs.readFileSync(fp, 'utf-8');
              if (fileContent.includes('"type"') && fileContent.includes('service_account')) {
                setProcessEnvKey('FIREBASE_ADMIN_SERVICE_ACCOUNT', fileContent.trim());
                break;
              }
            }
          }
          if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) break;
        } catch {
          // ignora erro de leitura
        }
      }
    }

    hasInitialized = true;
  } catch (err) {
    // Silencioso em ambiente não-Node
  }

  return { loadedFiles: loadedEnvFiles };
}

/**
 * Obtém o valor limpo e sanitizado de uma variável de ambiente.
 */
export function getCleanEnv(key: string, fallback = ''): string {
  if (typeof window === 'undefined') {
    ensureServerEnvLoaded();
  }
  const raw = typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  if (!raw) return fallback;
  const cleaned = cleanEnvValue(raw);
  return cleaned || fallback;
}

// Auto-executa no backend
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  ensureServerEnvLoaded();
}
