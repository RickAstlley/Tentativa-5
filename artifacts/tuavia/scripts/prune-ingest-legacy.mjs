#!/usr/bin/env node
/**
 * scripts/prune-ingest-legacy.mjs
 *
 * Remove da rota de ingestão a cascata de 5 etapas (`runEBikeStep0..4`,
 * `runEBikeAllocateTaggedSpecs`, `processEBikeIngestion`) e os engines do POST
 * que ainda a chamavam.
 *
 * Só roda depois que o job `ebike_ingest_step` passou a usar
 * `lib/ingestion/pipeline.ts` (ver `apply-ingest-job-consolidation.mjs`).
 * As funções de artigo e ranking são preservadas: elas ainda são o caminho
 * vivo de enriquecimento.
 *
 * Idempotente, com validação de sintaxe antes de escrever.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FILE = path.join(process.cwd(), 'app', 'api', 'admin', 'llm', 'ingest', 'route.ts');

/** Funções cujas declarações somem. */
const DEAD_FUNCTIONS = [
  'runEBikeLLMExtractWithTags',
  'runEBikeAllocateTaggedSpecs',
  'runEBikeStep1_YAML_And_Identity',
  'runEBikeSingleBlockOrEditorial',
  'runEBikeStep2_Specs_And_Editorial',
  'runEBikeStep3_PriceHistory_Conditional',
  'runEBikeStep4_SEO',
  'processEBikeIngestion',
  'runEBikeStep0_RawExtraction',
  'runEBikeStep1_Identity',
  'runEBikeStep2_Specs',
  'runEBikeStep3_Editorial',
];

/** Engines do POST que só existiam para a cascata. */
const DEAD_ENGINES = [
  'semantic_pipeline',
  'llm_extract_tags',
  'allocate_tagged_specs',
  'deterministic',
  'extract_single_block',
];

/** Blocos dentro do POST que continuam vivos. */
const KEPT_ENGINES = ['parse_files', 'unified_pipeline', 'llm'];

let source = fs.readFileSync(FILE, 'utf-8');
if (!DEAD_FUNCTIONS.some((name) => source.includes(`function ${name}(`))) {
  console.log('[prune-ingest-legacy] Já aplicado.');
  process.exit(0);
}

let lines = source.split('\n');

/** Remove uma declaração e seu corpo, por balanceamento de chaves. */
function removeFunction(lines, name) {
  const start = lines.findIndex((line) =>
    new RegExp(`^(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`).test(line)
  );
  if (start === -1) return { lines, removed: 0 };

  // Consome a assinatura multi-linha até o `{` que abre o corpo.
  let cursor = start;
  while (cursor < lines.length && !lines[cursor].includes('{')) cursor += 1;

  let depth = 0;
  let end = cursor;
  for (let i = cursor; i < lines.length; i += 1) {
    for (const char of lines[i]) {
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
    if (depth === 0 && i > cursor) {
      end = i;
      break;
    }
  }

  const removed = end - start + 1;
  // Consome uma linha em branco seguinte, para não deixar buraco duplo.
  let to = end + 1;
  if (to < lines.length && lines[to].trim() === '') to += 1;
  return { lines: [...lines.slice(0, start), ...lines.slice(to)], removed };
}

/** Remove um `if (engine === 'X') { ... }` do corpo do POST. */
function removeEngine(lines, engine) {
  const start = lines.findIndex((line) => line.includes(`engine === '${engine}'`));
  if (start === -1) return { lines, removed: 0 };

  // Sobe até a linha do `if`.
  let header = start;
  while (header > 0 && !lines[header].trimStart().startsWith('if (')) header -= 1;

  let cursor = header;
  while (cursor < lines.length && !lines[cursor].includes('{')) cursor += 1;

  let depth = 0;
  let end = cursor;
  for (let i = cursor; i < lines.length; i += 1) {
    for (const char of lines[i]) {
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
    if (depth === 0 && i > cursor) {
      end = i;
      break;
    }
  }

  let to = end + 1;
  if (to < lines.length && lines[to].trim() === '') to += 1;
  return { lines: [...lines.slice(0, header), ...lines.slice(to)], removed: to - header };
}

let totalRemoved = 0;
for (const name of DEAD_FUNCTIONS) {
  const result = removeFunction(lines, name);
  lines = result.lines;
  totalRemoved += result.removed;
}
for (const engine of DEAD_ENGINES) {
  const result = removeEngine(lines, engine);
  lines = result.lines;
  totalRemoved += result.removed;
}

const content = lines.join('\n');

/* ── validação ── */

const ts = require('typescript');
const parsed = ts.createSourceFile(
  'route.ts',
  content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const diagnostics = parsed.parseDiagnostics ?? [];
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics.slice(0, 5)) {
    const { line } = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`[prune-ingest-legacy] ABORTADO linha ${line + 1}: ${diagnostic.messageText}`);
  }
  process.exit(1);
}

for (const name of DEAD_FUNCTIONS) {
  if (content.includes(`function ${name}(`)) {
    console.error(`[prune-ingest-legacy] ABORTADO: ${name} sobreviveu.`);
    process.exit(1);
  }
}
for (const name of KEPT_ENGINES.filter((engine) => engine !== 'llm')) {
  if (!content.includes(`engine === '${name}'`)) {
    console.error(`[prune-ingest-legacy] ABORTADO: engine vivo "${name}" foi removido.`);
    process.exit(1);
  }
}
for (const fn of ['processArticleIngestion', 'processRankingIngestion']) {
  if (!content.includes(`function ${fn}(`)) {
    console.error(`[prune-ingest-legacy] ABORTADO: ${fn} (caminho vivo) foi removido.`);
    process.exit(1);
  }
}

fs.writeFileSync(FILE, content);
console.log(
  `[prune-ingest-legacy] ${totalRemoved} linha(s) removidas. ` +
    `Rota ficou com ${content.split('\n').length} linhas.`
);
