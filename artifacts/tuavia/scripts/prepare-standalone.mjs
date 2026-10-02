#!/usr/bin/env node
/**
 * scripts/prepare-standalone.mjs
 * 
 * Script determinístico para montagem do pacote standalone de produção (Hostinger/Node.js).
 * Garante a cópia obrigatória de:
 * 1. .next/static -> .next/standalone/.next/static (CSS, chunks JS, fontes, imagens otimizadas)
 * 2. public/ -> .next/standalone/public (quando existir)
 * 3. data/ -> .next/standalone/data (dados validados de e-bikes e persistência)
 * 
 * Executa checagem de integridade final antes de liberar o artefato.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const NEXT_DIR = path.resolve(ROOT_DIR, '.next');
const STATIC_SRC = path.resolve(NEXT_DIR, 'static');
const PUBLIC_SRC = path.resolve(ROOT_DIR, 'public');
const DATA_SRC = path.resolve(ROOT_DIR, 'data');

/**
 * Localiza a raiz real do pacote standalone.
 *
 * Em monorepo, o Next.js replica dentro de `.next/standalone/` o caminho do app
 * relativo à raiz do workspace. Aqui o app vive em `artifacts/tuavia`, então o
 * pacote sai em `.next/standalone/artifacts/tuavia/` e não em
 * `.next/standalone/`. O script inteiro — e o PM2, e o `start` do package.json —
 * esperavam `server.js` na raiz, e a preparação abortava com
 * "server.js ausente" mesmo com o build inteiro.
 *
 * Em vez de reescrever os caminhos a jusante, resolve-se a raiz uma vez: se
 * `server.js` estiver num subdiretório, esse subdiretório vira a raiz.
 */
function resolveStandaloneRoot(standaloneDir) {
  if (fs.existsSync(path.resolve(standaloneDir, 'server.js'))) return standaloneDir;

  // Busca rasa: o app fica em no máximo alguns níveis abaixo da raiz.
  const candidates = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const next = path.resolve(dir, entry.name);
      if (fs.existsSync(path.resolve(next, 'server.js'))) {
        candidates.push(next);
      }
      walk(next, depth + 1);
    }
  };
  walk(standaloneDir, 1);

  return candidates[0] ?? standaloneDir;
}

/**
 * Achata o pacote quando o Next.js o emitiu aninhado.
 *
 * Todo o resto da cadeia — o `start` do package.json, o PM2, o one-liner da
 * Hostinger — sobe `server.js` a partir da raiz do pacote. Sem o achatamento,
 * subir o servidor exige apontar o PM2 para dentro de `artifacts/tuavia/`. Com
 * ele, o layout publicado continua sendo exatamente o esperado.
 */
function flattenStandalonePackage(standaloneDir, appDir) {
  if (path.resolve(appDir) === path.resolve(standaloneDir)) return standaloneDir;

  console.log(
    `[prepare-standalone] 📦 Achatando pacote aninhado: ${path.relative(standaloneDir, appDir) || '.'} → raiz`
  );

  for (const entry of fs.readdirSync(appDir)) {
    const source = path.resolve(appDir, entry);
    const target = path.resolve(standaloneDir, entry);

    if (fs.existsSync(target)) {
      // Já existe na raiz (ex.: `typescript` remanescente): preserva a raiz.
      continue;
    }
    fs.renameSync(source, target);
  }

  // Remove a árvore de diretórios agora vazia (`artifacts/tuavia/...`).
  const pruneEmpty = (dir) => {
    if (!fs.existsSync(dir) || path.resolve(dir) === path.resolve(standaloneDir)) return;
    if (fs.readdirSync(dir).length > 0) return;
    fs.rmdirSync(dir);
    pruneEmpty(path.dirname(dir));
  };
  pruneEmpty(appDir);

  return standaloneDir;
}

const RAW_STANDALONE_DIR = path.resolve(ROOT_DIR, '.next/standalone');
const STANDALONE_DIR = flattenStandalonePackage(
  RAW_STANDALONE_DIR,
  resolveStandaloneRoot(RAW_STANDALONE_DIR)
);
const STATIC_DEST = path.resolve(STANDALONE_DIR, '.next/static');
const PUBLIC_DEST = path.resolve(STANDALONE_DIR, 'public');
const DATA_DEST = path.resolve(STANDALONE_DIR, 'data');

console.log('[prepare-standalone] 🚀 Preparando pacote de distribuição standalone para produção...');
console.log(`[prepare-standalone] 📁 Raiz do pacote standalone: ${STANDALONE_DIR}`);

// 1. Executar validação rigorosa dos dados de produção
try {
  console.log('[prepare-standalone] 🔍 Validando integridade dos dados locais...');
  execSync('node scripts/validate-production-data.mjs', { stdio: 'inherit', cwd: ROOT_DIR });
} catch {
  console.error('[prepare-standalone] ❌ Falha na validação dos dados de produção. Abortando preparação.');
  process.exit(1);
}

// 2. Verificar se o build gerou o diretório standalone
if (!fs.existsSync(STANDALONE_DIR)) {
  console.error(
    `[prepare-standalone] ❌ Diretório standalone ausente: ${STANDALONE_DIR}. Certifique-se de que 'output: standalone' está configurado em next.config.ts e 'next build' foi executado com sucesso.`
  );
  process.exit(1);
}

// 3. Garantir subdiretório .next no standalone
const standaloneNextDir = path.resolve(STANDALONE_DIR, '.next');
if (!fs.existsSync(standaloneNextDir)) {
  fs.mkdirSync(standaloneNextDir, { recursive: true });
}

// 4. Copiar .next/static -> .next/standalone/.next/static
if (!fs.existsSync(STATIC_SRC)) {
  console.error(
    `[prepare-standalone] ❌ Diretório estático compilado (.next/static) não foi encontrado em: ${STATIC_SRC}`
  );
  process.exit(1);
}

try {
  console.log('[prepare-standalone] 📦 Copiando assets estáticos (.next/static -> .next/standalone/.next/static)...');
  if (fs.existsSync(STATIC_DEST)) {
    fs.rmSync(STATIC_DEST, { recursive: true, force: true });
  }
  fs.cpSync(STATIC_SRC, STATIC_DEST, { recursive: true });
  console.log('[prepare-standalone] ✅ Assets estáticos copiados com sucesso.');
} catch (err) {
  console.error(`[prepare-standalone] ❌ Erro ao copiar .next/static: ${err.message}`);
  process.exit(1);
}

// 5. Otimizar assets e imagens para entrega estática de alto desempenho
try {
  console.log('[prepare-standalone] 🖼️ Extraindo imagens base64 para assets estáticos em public/images/...');
  execSync('node scripts/extract-base64-images.mjs', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (err) {
  console.warn('[prepare-standalone] ⚠️ Falha ao extrair imagens base64:', err.message);
}

// 6. Copiar public/ -> .next/standalone/public (se existir)
try {
  console.log('[prepare-standalone] 🗺️ Gerando sitemap.xml físico em public/...');
  execSync('node scripts/generate-sitemap.mjs', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (err) {
  console.warn('[prepare-standalone] ⚠️ Falha ao gerar sitemap físico:', err.message);
}

if (fs.existsSync(PUBLIC_SRC)) {
  try {
    console.log('[prepare-standalone] 📂 Copiando pasta public/ -> .next/standalone/public...');
    if (fs.existsSync(PUBLIC_DEST)) {
      fs.rmSync(PUBLIC_DEST, { recursive: true, force: true });
    }
    fs.cpSync(PUBLIC_SRC, PUBLIC_DEST, { recursive: true });
    console.log('[prepare-standalone] ✅ Pasta public/ copiada com sucesso.');
  } catch (err) {
    console.error(`[prepare-standalone] ❌ Erro ao copiar public/: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log('[prepare-standalone] ℹ️ Pasta public/ não existe na raiz (OK).');
}

// 6. Copiar data/ -> .next/standalone/data
if (!fs.existsSync(DATA_SRC)) {
  console.error(`[prepare-standalone] ❌ Diretório data/ não encontrado na raiz: ${DATA_SRC}`);
  process.exit(1);
}

try {
  console.log('[prepare-standalone] 🗄️ Copiando dados locais (data/ -> .next/standalone/data)...');
  if (fs.existsSync(DATA_DEST)) {
    fs.rmSync(DATA_DEST, { recursive: true, force: true });
  }
  fs.cpSync(DATA_SRC, DATA_DEST, { recursive: true });

  // Nunca empacotar credenciais de servidor. Em produção, a Service Account deve
  // ser fornecida exclusivamente pelo ambiente da Hostinger ou por arquivo externo.
  const credentialFileNames = new Set([
    'serviceAccountKey.json',
    'firebase-service-account.json',
    'firebase-admin.json',
    'firebase-key.json',
    'service-account.json',
    'google-credentials.json',
    'serviceAccount.json',
  ]);
  for (const fileName of credentialFileNames) {
    const copiedCredential = path.resolve(DATA_DEST, fileName);
    if (fs.existsSync(copiedCredential)) {
      fs.rmSync(copiedCredential, { force: true });
      console.log(`[prepare-standalone] 🔒 Credencial excluída do pacote: data/${fileName}`);
    }
  }

  console.log('[prepare-standalone] ✅ Dados locais copiados para o standalone sem credenciais.');
} catch (err) {
  console.error(`[prepare-standalone] ❌ Erro ao copiar data/: ${err.message}`);
  process.exit(1);
}

// 6.5. Copiar scripts de background worker e supervisor para o standalone
const SCRIPTS_DEST_DIR = path.resolve(STANDALONE_DIR, 'scripts');

const scriptsToCopy = [
  'env-loader.mjs',
  'start-hostinger.mjs',
];

try {
  console.log('[prepare-standalone] 📜 Copiando variáveis e supervisor para o standalone...');
  if (!fs.existsSync(SCRIPTS_DEST_DIR)) {
    fs.mkdirSync(SCRIPTS_DEST_DIR, { recursive: true });
  }

  for (const scriptName of scriptsToCopy) {
    const srcFile = path.resolve(ROOT_DIR, 'scripts', scriptName);
    const destFile = path.resolve(SCRIPTS_DEST_DIR, scriptName);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
      console.log(`[prepare-standalone] ✅ Script ${scriptName} copiado com sucesso.`);
    } else {
      console.warn(`[prepare-standalone] ⚠️ Script de origem não encontrado: ${srcFile}`);
    }
  }
} catch (err) {
  console.error(`[prepare-standalone] ❌ Erro ao copiar scripts: ${err.message}`);
  process.exit(1);
}

// 6.6. Copiar arquivos de ambiente (.env*) e configurações do Firebase para o standalone
const envFilesToCopy = ['.env.production', '.env.local', '.env', '.env.example', 'firebase-applet-config.json'];
for (const envFile of envFilesToCopy) {
  const envSrc = path.resolve(ROOT_DIR, envFile);
  const envDest = path.resolve(STANDALONE_DIR, envFile);
  if (fs.existsSync(envSrc)) {
    try {
      fs.copyFileSync(envSrc, envDest);
      console.log(`[prepare-standalone] 🔐 Arquivo de ambiente ${envFile} replicado no pacote standalone.`);
    } catch (err) {
      console.warn(`[prepare-standalone] ⚠️ Aviso ao copiar ${envFile}: ${err.message}`);
    }
  }
}

// 6.7. Garantir que o serviceAccountKey.json e credenciais estejam empacotadas no standalone para Hostinger
const credentialBasenames = [
  'serviceAccountKey.json',
  'firebase-service-account.json',
  'firebase-admin.json',
  'firebase-key.json',
  'service-account.json',
  'google-credentials.json',
  'serviceAccount.json',
];
for (const baseName of credentialBasenames) {
  const rootCredPath = path.resolve(ROOT_DIR, baseName);
  if (fs.existsSync(rootCredPath)) {
    for (const relativePath of [baseName, path.join('data', baseName)]) {
      const destPath = path.resolve(STANDALONE_DIR, relativePath);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(rootCredPath, destPath);
      console.log(`[prepare-standalone] 🔐 Credencial copiada para o standalone: ${relativePath}`);
    }
  }
}

// 7. Auditoria e Validação Final do Pacote Standalone
console.log('[prepare-standalone] 🔬 Executando auditoria final do pacote gerado...');

const serverJsPath = path.resolve(STANDALONE_DIR, 'server.js');
if (!fs.existsSync(serverJsPath)) {
  console.error(`[prepare-standalone] ❌ server.js ausente no pacote standalone: ${serverJsPath}`);
  process.exit(1);
}

if (!fs.existsSync(STATIC_DEST)) {
  console.error(`[prepare-standalone] ❌ .next/static ausente no pacote standalone: ${STATIC_DEST}`);
  process.exit(1);
}

const standaloneEbikesPath = path.resolve(DATA_DEST, 'ebikes.json');
if (!fs.existsSync(standaloneEbikesPath)) {
  console.error(`[prepare-standalone] ❌ ebikes.json ausente em .next/standalone/data!`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(standaloneEbikesPath, 'utf-8');
  const ebikes = JSON.parse(content);
  if (!Array.isArray(ebikes)) {
    console.error(`[prepare-standalone] ❌ ebikes.json no standalone deve ser um array!`);
    process.exit(1);
  }
  console.log(`[prepare-standalone] ✅ Catálogo estático validado no standalone (${ebikes.length} ofertas disponíveis).`);
} catch (err) {
  console.error(`[prepare-standalone] ❌ Erro ao validar ebikes.json no standalone: ${err.message}`);
  process.exit(1);
}

const standaloneBikesPath = path.resolve(DATA_DEST, 'published_bikes.json');
if (!fs.existsSync(standaloneBikesPath)) {
  console.error(`[prepare-standalone] ❌ published_bikes.json ausente em .next/standalone/data!`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(standaloneBikesPath, 'utf-8');
  const bikes = JSON.parse(content);
  if (!Array.isArray(bikes)) {
    console.error(`[prepare-standalone] ❌ published_bikes.json no standalone deve ser um array!`);
    process.exit(1);
  }
  console.log(`[prepare-standalone] ✅ Overrides dinâmicos do admin validados (${bikes.length} itens).`);
} catch (err) {
  console.error(`[prepare-standalone] ❌ Erro ao validar published_bikes.json no standalone: ${err.message}`);
  process.exit(1);
}


// 6.8. Garantir package.json com scripts de inicialização no standalone
const standalonePkgPath = path.resolve(STANDALONE_DIR, 'package.json');
try {
  let pkgContent = {};
  if (fs.existsSync(standalonePkgPath)) {
    pkgContent = JSON.parse(fs.readFileSync(standalonePkgPath, 'utf-8'));
  }
  pkgContent.scripts = {
    ...pkgContent.scripts,
    start: 'node scripts/start-hostinger.mjs',
  };
  fs.writeFileSync(standalonePkgPath, JSON.stringify(pkgContent, null, 2), 'utf-8');
  console.log('[prepare-standalone] 📦 package.json no standalone configurado com "start": "node scripts/start-hostinger.mjs".');
} catch (err) {
  console.warn(`[prepare-standalone] ⚠️ Aviso ao atualizar package.json no standalone: ${err.message}`);
}

console.log('===============================================================');
console.log('🎉 Pacote standalone preparado com SUCESSO para produção!');
console.log('👉 Para iniciar o servidor:');
console.log('   npm start');
console.log('   (ou node scripts/start-hostinger.mjs)');
console.log('===============================================================');
process.exit(0);
