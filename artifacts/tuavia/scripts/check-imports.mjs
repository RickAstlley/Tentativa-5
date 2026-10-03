#!/usr/bin/env node
/**
 * Gate de resolução de módulos.
 *
 * `next build` roda com `typescript.ignoreBuildErrors` e `eslint.ignoreDuringBuilds`,
 * então import quebrado passa silenciosamente e só explode em runtime. Este script
 * resolve TODOS os specifiers relativos e de alias (`@/`) do projeto e falha se
 * algum não existir no disco.
 *
 * Não é um type-checker: é a verificação mínima que pega a classe de erro que
 * realmente quebrou este repositório (35 módulos ausentes).
 *
 *   node scripts/check-imports.mjs            # verifica
 *   node scripts/check-imports.mjs --verbose  # lista todos os specifiers
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const ALIAS = '@/';
const SCAN_DIRS = ['app', 'components', 'lib', 'context', 'hooks', 'scripts', 'types'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'data', 'public', 'assets']);
const SKIP_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

/** Builtins do Node: resolvidos pelo runtime, nunca por node_modules. */
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
  'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

const verbose = process.argv.includes('--verbose');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_FILE_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function collectFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) files.push(...walk(path.join(ROOT, dir)));
  return files;
}

/**
 * Só casa instruções de import reais, ancoradas no início da linha:
 *   import x from 'y'   |   import 'y'   |   export * from 'y'   |   import('y')
 *
 * A âncora importa: sem ela, uma string contendo "from '@/x'" dentro de um
 * script de geração de código seria reportada como import não resolvido.
 */
const IMPORT_RE =
  /^(?:\s*)(?:import\b[\s\S]{0,400}?\bfrom\s*|import\s*\(\s*|import\s+|export\s+(?:\*|\{)[^;]*?\}\s*from\s*|export\s+\*\s+as\s+\w+\s+from\s*)['"]([^'"\n]+)['"]/gm;

function extractSpecifiers(source) {
  const found = new Set();
  let match;
  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(source)) !== null) {
    const spec = match[1];
    if (!spec) continue;
    if (spec.startsWith('.')) found.add({ spec, kind: 'relative' });
    else if (spec.startsWith(ALIAS)) found.add({ spec, kind: 'alias' });
  }
  return found;
}

function resolveBase(base) {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return true;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const index of INDEX_FILES) {
      if (fs.existsSync(path.join(base, index))) return true;
    }
  }
  return false;
}

/**
 * Pacotes npm instalados. Um import de pacote ausente não é pego pela
 * verificação de caminho (que só resolve `@/` e relativos) e só explode em
 * runtime — foi assim que `@supabase/supabase-js` entrou sem existir.
 */
function collectBareSpecifiers() {
  const found = new Map();
  for (const file of collectFiles()) {
    const source = fs.readFileSync(file, 'utf-8');
    IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_RE.exec(source)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      // ignora builtin do Node, relativos, alias e subpath de framework
      if (spec.startsWith('.') || spec.startsWith(ALIAS) || spec.startsWith('node:')) continue;
      if (spec.startsWith('next/') || spec.startsWith('server-only') || spec.startsWith('client-only')) continue;
      // Builtins e seus subpaths (`fs/promises`, `path/posix`, ...).
      const rootSpecifier = spec.startsWith('node:') ? spec.slice(5).split('/')[0] : spec.split('/')[0];
      if (NODE_BUILTINS.has(rootSpecifier)) continue;
      const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!found.has(pkgName)) found.set(pkgName, path.relative(ROOT, file));
    }
  }
  return found;
}

/**
 * Procura um pacote instalado usando o mesmo algoritmo do Node: a partir de
 * `startDir`, subindo um nível a cada vez até encontrar `node_modules/<pacote>`.
 *
 * Antes, isto era um `existsSync(path.join(ROOT, 'node_modules', pkg))` fixo, o
 * que só funciona com pnpm — que dá a cada pacote o seu próprio `node_modules`
 * com symlinks. Na hospedagem a instalação é feita com npm, que **hoista** as
 * dependências para o `node_modules` da raiz do monorepo. Com o teste fixo, 18
 * pacotes (`react`, `next`, `zod`, `js-yaml`…) eram reportados como ausentes e
 * o build parava, mesmo com todos instalados e corretos.
 */
function isPackageInstalled(pkg, startDir = ROOT) {
  let dir = path.resolve(startDir);
  // Para no sistema de arquivos, para não varrer "/" e "/" inteiro sem necessidade.
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', pkg))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

const missingPackages = [];
for (const [pkg, file] of collectBareSpecifiers()) {
  if (!isPackageInstalled(pkg)) {
    missingPackages.push({ pkg, file });
  }
}

const files = collectFiles();
const failures = [];
let checked = 0;

for (const file of files) {
  const source = fs.readFileSync(file, 'utf-8');
  for (const { spec, kind } of extractSpecifiers(source)) {
    const base =
      kind === 'alias'
        ? path.join(ROOT, spec.slice(ALIAS.length))
        : path.resolve(path.dirname(file), spec);
    checked += 1;
    if (resolveBase(base)) {
      if (verbose) console.log(`  ok   ${path.relative(ROOT, file)} -> ${spec}`);
      continue;
    }
    failures.push({
      file: path.relative(ROOT, file),
      line: source.slice(0, source.indexOf(spec)).split('\n').length,
      spec,
    });
  }
}

if (missingPackages.length > 0) {
  console.error('\n[check-imports] pacote(s) npm ausente(s) nos node_modules alcançáveis a partir da raiz:\n');
  for (const { pkg, file } of missingPackages) console.error(`  ${pkg}  <- ${file}`);
  console.error('\nRode `npm install` ou remova o import.\n');
}

if (failures.length === 0 && missingPackages.length === 0) {
  console.log(`[check-imports] OK — ${checked} specifiers resolvidos em ${files.length} arquivos.`);
  process.exit(0);
}

const bySpecifier = new Map();
for (const failure of failures) {
  const list = bySpecifier.get(failure.spec) || [];
  list.push(failure);
  bySpecifier.set(failure.spec, list);
}

console.error(`\n[check-imports] ${failures.length} import(s) não resolvido(s) em ${bySpecifier.size} módulo(s) ausente(s):\n`);
for (const [spec, sites] of [...bySpecifier.entries()].sort()) {
  console.error(`  ${spec}`);
  for (const site of sites.slice(0, 4)) console.error(`      ${site.file}:${site.line}`);
  if (sites.length > 4) console.error(`      … +${sites.length - 4} ocorrência(s)`);
}
console.error('');
process.exit(1);
