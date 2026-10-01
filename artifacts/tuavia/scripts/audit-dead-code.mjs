/**
 * Auditoria de código morto.
 *
 * Lista componentes nunca importados e exports sem nenhuma referência fora do
 * próprio arquivo. Separa os achados reais dos falsos positivos do Next
 * (generateStaticParams, metadata, handlers de rota).
 *
 *   node scripts/audit-dead-code.mjs
 */

import fs from 'fs';
import path from 'path';

const SKIP = new Set(['node_modules', '.next', '.git', 'data', 'public', 'assets']);
const SCAN = ['app', 'components', 'lib', 'hooks', 'context', 'types'];

const entries = [];

function walk(dir) {
  let listing;
  try {
    listing = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const item of listing) {
    if (item.name.startsWith('.') || SKIP.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(item.name)) {
      entries.push({ file: full, text: fs.readFileSync(full, 'utf-8') });
    }
  }
}
for (const dir of SCAN) walk(dir);

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─────────────────── componentes nunca importados ─────────────────── */

const orphans = [];
for (const { file, text } of entries) {
  if (!file.startsWith('components/')) continue;
  const base = path.basename(file).replace(/\.tsx?$/, '');
  if (base === 'index') continue;

  const isImported = entries.some((other) => {
    if (other.file === file) return false;
    if (
      new RegExp(`from [^;]*${escapeRe(base)}\\b`).test(other.text) ||
      new RegExp(`import\\(\\s*['\"][^'\"]*${escapeRe(base)}['\"]`).test(other.text)
    ) {
      return true;
    }
    // import dinâmico por variável: `const p = './X'; import(p)`.
    return new RegExp(`['\"][^'\"]*${escapeRe(base)}['\"]`).test(other.text);
  });

  if (!isImported) orphans.push({ file, lines: text.split('\n').length });
}

const byDir = new Map();
for (const orphan of orphans) {
  const dir = path.dirname(orphan.file);
  const current = byDir.get(dir) || { count: 0, lines: 0 };
  byDir.set(dir, {
    count: current.count + 1,
    lines: current.lines + orphan.lines,
  });
}

console.log('=== COMPONENTES NUNCA IMPORTADOS ===');
console.log(`${orphans.length} arquivo(s), ${orphans.reduce((sum, o) => sum + o.lines, 0)} linha(s)\n`);
for (const [dir, stats] of [...byDir.entries()].sort((a, b) => b[1].lines - a[1].lines)) {
  console.log(`  ${dir.padEnd(38)} ${String(stats.count).padStart(3)} arquivo(s)  ${stats.lines} linha(s)`);
}

/* ───────────────────── exports sem referência ───────────────────── */

// Nomes que o Next consome por convenção, não por import.
const FRAMEWORK_NAMES = new Set([
  'generateStaticParams',
  'dynamicParams',
  'metadata',
  'generateMetadata',
  'revalidate',
  'dynamic',
  'runtime',
  'preferredRegion',
  'maxDuration',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'default',
]);

const deadExports = [];
for (const { file, text } of entries) {
  const names = new Set();

  for (const match of text.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/gm
  )) {
    names.add(match[1]);
  }
  for (const match of text.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }

  for (const name of names) {
    if (FRAMEWORK_NAMES.has(name)) continue;

    const pattern = new RegExp(`\\b${escapeRe(name)}\\b`, 'g');
    let uses = 0;
    for (const other of entries) {
      if (other.file === file) continue;
      uses += (other.text.match(pattern) || []).length;
    }
    if (uses === 0) deadExports.push({ file, name });
  }
}

console.log(`\n=== EXPORTS SEM REFERENCIA FORA DO PROPRIO ARQUIVO ===`);
console.log(`${deadExports.length} export(s)\n`);
const byFile = new Map();
for (const item of deadExports) {
  const list = byFile.get(item.file) || [];
  list.push(item.name);
  byFile.set(item.file, list);
}
for (const [file, list] of byFile) {
  console.log(`  ${file}\n      ${list.join(', ')}`);
}

// Por padrão o script apenas relata. Com --fail, vira porta de qualidade.
//
// O `--fail` olha SÓ para componentes órfãos. Export sem referência externa é
// um sinal fraco: um símbolo exportado e usado dentro do próprio arquivo é
// perfeitamente legítimo (SIMPLE_SHORTCUTS, por exemplo), e fechar o build por
// causa disso tornaria o gate que a equipe aprende a ignorar. Componente
// ninguém importa é sinal forte — é o que estamos procurando.
if (process.argv.includes('--fail')) {
  if (orphans.length > 0) {
    console.error(
      `\n[audit-dead-code] ${orphans.length} componente(s) orfao(s), ` +
        `${orphans.reduce((sum, item) => sum + item.lines, 0)} linha(s). Remova ou integre.`
    );
    process.exit(1);
  }
}
