#!/usr/bin/env node
/**
 * scripts/prune-duplicate-blueprint.mjs
 *
 * Remove da rota de ingestão a segunda definição das 10 seções canônicas.
 *
 * A rota importava `STANDARD_SPEC_BLUEPRINT` de `lib/specAllocations.ts` e,
 * logo abaixo, declarava um segundo blueprint local com os mesmos 10 blocos,
 * expressos em `aliasRegex` em vez de `synonyms`. Com ele vinham
 * `isValidSpecValue` e `normalizeEBikeSpecSections` — um SEGUNDO alocador, com
 * a mesma função do `allocateAndNormalizeSpecSections`.
 *
 * É a duplicação original: dois lugares dizendo o que são as seções
 * canônicas, em formatos diferentes, produzindo alocações diferentes para o
 * mesmo documento. Os três ficaram órfãos quando a cascata saiu, porque só a
 * cascata os chamava.
 *
 * Os limites vêm do AST do TypeScript, não de contagem de chaves: a anotação
 * de tipo `{ ... }[]` do blueprint e os `any[]` dos parâmetros faziam a
 * contagem manual cortar no lugar errado.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FILE = path.join(process.cwd(), 'app', 'api', 'admin', 'llm', 'ingest', 'route.ts');
const TARGETS = ['STANDARD_SPEC_BLUEPRINT', 'isValidSpecValue', 'normalizeEBikeSpecSections'];

const source = fs.readFileSync(FILE, 'utf-8');
const ts = require('typescript');

const parsed = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

if (!TARGETS.some((name) => source.includes(name))) {
  console.log('[prune-duplicate-blueprint] Já aplicado.');
  process.exit(0);
}

/** Coleta os intervalos de linha das declarações a remover. */
const ranges = [];

function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && TARGETS.includes(node.name.text)) {
    ranges.push({ name: node.name.text, start: node.getStart(), end: node.getEnd() });
  }
  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && TARGETS.includes(declaration.name.text)) {
        ranges.push({ name: declaration.name.text, start: node.getStart(), end: node.getEnd() });
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(parsed);

const found = new Set(ranges.map((range) => range.name));
const missing = TARGETS.filter((name) => !found.has(name));
if (missing.length > 0) {
  console.error(`[prune-duplicate-blueprint] Não encontrei: ${missing.join(', ')}`);
  process.exit(1);
}

// Recorta por índice de caractere, do fim para o início, para não invalidar
// os deslocamentos de quem ainda não foi removido.
let content = source;
for (const range of ranges.sort((a, b) => b.start - a.start)) {
  let start = range.start;
  let end = range.end;

  // Leva junto o comentário de bloco imediatamente acima e a linha em branco
  // seguinte, para não deixar resíduo.
  const before = content.slice(0, start);
  const commentStart = before.lastIndexOf('/**');
  if (commentStart !== -1 && before.slice(commentStart, start).trim() === '' && !before.slice(0, commentStart).trimEnd().endsWith('*/')) {
    start = commentStart;
  }
  while (content[start - 1] === '\n') start -= 1;
  while (content[end] === '\n' || content[end] === ' ') end += 1;

  content = content.slice(0, start) + content.slice(end);
}

/* ── validação ── */

const check = ts.createSourceFile('route.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const diagnostics = check.parseDiagnostics ?? [];
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics.slice(0, 5)) {
    const { line } = check.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`[prune-duplicate-blueprint] ABORTADO linha ${line + 1}: ${diagnostic.messageText}`);
  }
  process.exit(1);
}

for (const name of TARGETS) {
  if (content.includes(name)) {
    console.error(`[prune-duplicate-blueprint] ABORTADO: ${name} sobreviveu.`);
    process.exit(1);
  }
}

// `cleanSpecValue` e `allocateFromTaggedSpecs` continuam importados; se o uso
// sobrou sem import, o build quebraria.
if (/\bcleanSpecValue\(/.test(content) && !content.includes('cleanSpecValue,')) {
  console.error('[prune-duplicate-blueprint] ABORTADO: cleanSpecValue usada sem import.');
  process.exit(1);
}

fs.writeFileSync(FILE, content);
console.log(
  `[prune-duplicate-blueprint] ${ranges.map((r) => r.name).join(', ')} removidos. ` +
    `Rota: ${source.split('\n').length} -> ${content.split('\n').length} linhas.`
);
