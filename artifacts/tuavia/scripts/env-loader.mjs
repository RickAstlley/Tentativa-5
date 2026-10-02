/**
 * TuaVia — Loader e Sanitizador Universal de Variáveis de Ambiente para Hostinger & Node.js
 * 
 * Suporta:
 * 1. Arquivos .env, .env.production, .env.local em qualquer nível (raiz, standalone, pai).
 * 2. Variáveis injetadas diretamente pelo painel Hostinger (hPanel / CloudLinux / Phusion Passenger).
 * 3. Remoção automática de aspas acidentais (' ou "), espaços e quebras de linha Windows (\r).
 * 4. Normalização de URLs (remoção de barras finais) e credenciais JSON do Firebase.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Remove aspas externas, espaços e caracteres de retorno de carro (\r).
 */
export function cleanValue(val) {
  if (typeof val !== 'string') return val;
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
 * Faz o parse seguro de uma linha ou conteúdo de arquivo .env
 */
export function parseEnvContent(content) {
  const result = {};
  if (!content || typeof content !== 'string') return result;

  const lines = content.split('\n');
  let currentKey = null;
  let currentValue = '';
  let inMultiLine = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, '').trim();

    // Se estiver em bloco multilinha (ex: JSON ou chave RSA)
    if (inMultiLine) {
      currentValue += '\n' + rawLine.replace(/\r/g, '');
      if (
        (currentValue.trim().startsWith('{') && currentValue.trim().endsWith('}')) ||
        (currentValue.trim().startsWith('"') && currentValue.trim().endsWith('"') && currentValue.trim().length > 1) ||
        (currentValue.trim().startsWith("'") && currentValue.trim().endsWith("'") && currentValue.trim().length > 1) ||
        currentValue.includes('-----END ')
      ) {
        result[currentKey] = cleanValue(currentValue);
        currentKey = null;
        currentValue = '';
        inMultiLine = false;
      }
      continue;
    }

    // Linha vazia ou comentário
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim().replace(/^(export\s+)/, '');
    let val = line.slice(equalIndex + 1).trim();

    // Início de bloco multilinha (JSON ou chave RSA ou aspa não fechada)
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

    result[key] = cleanValue(val);
  }

  return result;
}

/**
 * Carrega arquivos .env encontrados na árvore de diretórios sem sobrescrever variáveis já definidas no sistema,
 * a menos que estejam vazias.
 */
export function initEnv() {
  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '.next/standalone'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
  ];

  const envFileNames = ['.env.production', '.env.local', '.env'];
  const loadedFiles = [];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of envFileNames) {
      const filePath = path.join(dir, fileName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = parseEnvContent(content);
          for (const [key, val] of Object.entries(parsed)) {
            if (!process.env[key] || process.env[key].trim() === '') {
              process.env[key] = val;
            }
          }
          if (!loadedFiles.includes(filePath)) {
            loadedFiles.push(filePath);
          }
        } catch (err) {
          console.warn(`[EnvLoader] Aviso ao ler ${filePath}: ${err.message}`);
        }
      }
    }
  }

  // Sanitiza variáveis conhecidas que já estavam em process.env (ex: injetadas pelo hPanel com aspas)
  const keysToClean = [
    'APP_URL',
    'NEXT_PUBLIC_APP_URL',
    'ADMIN_PASSCODE',
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

  for (const key of keysToClean) {
    if (process.env[key]) {
      process.env[key] = cleanValue(process.env[key]);
    }
  }

  // Sincronização bidirecional de chaves com e sem prefixo NEXT_PUBLIC_
  const syncPairs = [
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
      process.env[k2] = v1;
    } else if (v2 && (!v1 || v1.trim() === '')) {
      process.env[k1] = v2;
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
              process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT = fileContent.trim();
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

  /**
   * SOMENTE valores públicos e de operação. Nenhuma credencial entra aqui.
   *
   * Este mapa já continha a senha do painel, os segredos de sessão e do
   * worker, chaves da NVIDIA, do Gemini, do Serper e a chave privada completa
   * da service account do Firebase — tudo commitado no repositório. Secrets
   * pertencem ao ambiente de execução; o código deve falhar na ausência deles,
   * nunca inventar um valor.
   */
  const DEFAULT_ENV_MAP = {
    APP_URL: 'https://tuavia.com.br',
    NEXT_PUBLIC_APP_URL: 'https://tuavia.com.br',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'tuavia-cf9ba',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'tuavia-cf9ba.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'tuavia-cf9ba.firebasestorage.app',
    NEXT_PUBLIC_FIREBASE_DATABASE_ID: '(default)',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '994446221503',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:994446221503:web:41239ea88ef21951b6660a',
  };

  /**
   * Segredos obrigatórios. Sem eles o painel não autentica e o worker de IA não
   * roda — melhor do que subir com uma credencial padrão conhecida.
   */
  const REQUIRED_SECRETS = [
    'ADMIN_PASSCODE',
    'ADMIN_SESSION_SECRET',
  ];

  if (!process.env.SKIP_SECRET_CHECK) {
    const missing = REQUIRED_SECRETS.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      console.error(
        `[env-loader] Segredos ausentes no ambiente: ${missing.join(', ')}.\n` +
          'Defina-os no painel da hospedagem. O painel administrativo e o ' +
          'worker de IA não funcionam sem eles.'
      );
    }
  }

  for (const [k, defaultVal] of Object.entries(DEFAULT_ENV_MAP)) {
    if (!process.env[k] || process.env[k].trim() === '') {
      process.env[k] = defaultVal;
    }
  }

  // Gera o arquivo .env automaticamente no disco se não existir
  const targetEnvFile = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(targetEnvFile)) {
    try {
      const lines = Object.entries(DEFAULT_ENV_MAP).map(([k, v]) => `${k}=${v}`);
      fs.writeFileSync(targetEnvFile, lines.join('\n') + '\n', 'utf-8');
      console.log(`[EnvLoader] ⚡ Arquivo .env gerado automaticamente em: ${targetEnvFile}`);
    } catch (e) {
      console.warn(`[EnvLoader] Não foi possível salvar .env automaticamente: ${e.message}`);
    }
  }

  // Gera o arquivo serviceAccountKey.json automaticamente no disco se não existir
  const saKeyFile = path.resolve(process.cwd(), 'serviceAccountKey.json');
  const saDataKeyFile = path.resolve(process.cwd(), 'data', 'serviceAccountKey.json');
  if (!fs.existsSync(saKeyFile) || !fs.existsSync(saDataKeyFile)) {
    try {
      const saRaw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT || DEFAULT_ENV_MAP.FIREBASE_ADMIN_SERVICE_ACCOUNT;
      let jsonContent = saRaw.trim();
      if (!jsonContent.startsWith('{')) {
        try {
          jsonContent = Buffer.from(jsonContent, 'base64').toString('utf-8');
        } catch (e) {
          // keep as is
        }
      }
      if (jsonContent.includes('"service_account"')) {
        if (!fs.existsSync(saKeyFile)) {
          fs.writeFileSync(saKeyFile, jsonContent, 'utf-8');
          console.log(`[EnvLoader] ⚡ Arquivo serviceAccountKey.json gerado em: ${saKeyFile}`);
        }
        const dataDir = path.dirname(saDataKeyFile);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(saDataKeyFile)) {
          fs.writeFileSync(saDataKeyFile, jsonContent, 'utf-8');
          console.log(`[EnvLoader] ⚡ Arquivo serviceAccountKey.json gerado em: ${saDataKeyFile}`);
        }
      }
    } catch (e) {
      console.warn(`[EnvLoader] Não foi possível salvar serviceAccountKey.json automaticamente: ${e.message}`);
    }
  }

  return {
    loadedFiles,
    hasAdminPasscode: Boolean(process.env.ADMIN_PASSCODE),
    hasAppUrl: Boolean(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL),
  };
}

// Auto-inicializa ao importar
initEnv();
