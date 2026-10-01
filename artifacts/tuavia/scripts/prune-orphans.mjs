/**
 * Lista os componentes nunca importados e os remove.
 *
 *   node scripts/prune-orphans.mjs            # só lista
 *   node scripts/prune-orphans.mjs --apply    # remove com git rm
 *
 * Usa `git rm` para que a remoção seja recuperável, e roda o gate de imports
 * depois para confirmar que nada dependia deles.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const APPLY = process.argv.includes('--apply');
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

const orphans = [];
for (const { file, text } of entries) {
  if (!file.startsWith('components/')) continue;
  const base = path.basename(file).replace(/\.tsx?$/, '');
  if (base === 'index') continue;

  const isImported = entries.some((other) => {
    if (other.file === file) return false;
    // 1. import estático ou `import()` com o caminho literal
    if (
      new RegExp(`from [^;]*${escapeRe(base)}\\b`).test(other.text) ||
      new RegExp(`import\\(\\s*['\"][^'\"]*${escapeRe(base)}['\"]`).test(other.text)
    ) {
      return true;
    }
    // 2. import dinâmico por variável: `const p = './BlockEditor'; import(p)`.
    //    O padrão existe no projeto e, sem esta cláusula, o detector marca o
    //    módulo como órfão — aconteceu com o BlockEditor.
    return new RegExp(`['\"][^'\"]*${escapeRe(base)}['\"]`).test(other.text);
  });

  if (!isImported) {
    orphans.push({ file, lines: text.split('\n').length });
  }
}

const totalLines = orphans.reduce((sum, item) => sum + item.lines, 0);
console.log(`${orphans.length} componente(s) orfao(s), ${totalLines} linha(s)\n`);
for (const item of orphans) console.log(`  ${String(item.lines).padStart(5)}  ${item.file}`);

/**
 * Arquivos mantidos apesar de não serem importados.
 *
 * `BlockEditor` é a versão com arrastar-e-soltar, melhor que o
 * `SimpleBlockEditor` inline que o `ArticleForm` usa hoje — trocar é decisão de
 * produto, não de limpeza. `AdSenseBanner` não é órfão por acidente: a conta
 * AdSense está configurada e o banner simplesmente nunca foi montado.
 */
const HOLD = new Set([
  'components/admin/BlockEditor.tsx',
  'components/admin/BlockEditorWrapper.tsx',
  'components/ui/AdSenseBanner.tsx',
]);

const toRemove = orphans.filter((item) => !HOLD.has(item.file));
if (HOLD.size > 0) {
  const kept = orphans.length - toRemove.length;
  console.log(`\nMantidos por decisão (${kept}): ${[...HOLD].join(', ')}\n`);
}

if (!APPLY) {
  console.log('\nRode com --apply para remover.');
  process.exit(0);
}

for (const item of toRemove) {
  try {
    execFileSync('git', ['rm', '-q', item.file], { stdio: 'ignore' });
  } catch (error) {
    console.error(`  falhou ao remover ${item.file}: ${error.message}`);
  }
}
console.log(`\n${toRemove.length} arquivo(s) removido(s). Rode o gate de imports para confirmar.`);
