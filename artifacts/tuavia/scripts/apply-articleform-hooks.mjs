#!/usr/bin/env node
/**
 * scripts/apply-articleform-hooks.mjs
 *
 * Move o `useEffect` dos listeners de resize para fora do callback da prop `a`
 * do renderizador markdown.
 *
 * Ali dentro, `a: ({ href, children }) => { ... }` é uma função comum, não um
 * componente: o hook era chamado a cada render, os listeners de `mousemove`/
 * `touchmove` nunca ficavam registrados e o split view não redimensionava.
 *
 * O arquivo tem JSX aninhado e ~1700 linhas, então o patch é feito por
 * âncoras estruturais e validado com o parser do TypeScript antes de
 * escrever. Rodar duas vezes não muda nada.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FILE = path.join(process.cwd(), 'components', 'admin', 'ArticleForm.tsx');
const MARKER = 'Global resize handlers for split view';

if (!fs.readFileSync(FILE, 'utf-8').includes(MARKER)) {
  console.log('[apply-articleform-hooks] Já aplicado.');
  process.exit(0);
}

const lines = fs.readFileSync(FILE, 'utf-8').split('\n');

/* ── 1. localizar o efeito dentro do callback `a:` ── */

// O efeito original é precedido por um comentário `//`, não por um docblock.
const commentLine = lines.findIndex((line) => line.includes(MARKER));
if (commentLine === -1) throw new Error('comentário do efeito não encontrado');

let from = commentLine;
if (lines[from].trim().startsWith('//')) from -= 1; // remove o comentário junto

let to = from;
while (to < lines.length && !/\}, \[[^\]]*\]\);\s*$/.test(lines[to])) to += 1;
if (to >= lines.length) throw new Error('fechamento do useEffect não encontrado');

// Içamos com um docblock explicando o motivo da mudança.
const block = [
  '  /**',
  '   * Handlers globais do split view.',
  '   *',
  '   * Este efeito vivia dentro do callback da prop `a` do renderizador markdown.',
  '   * Ali é uma função comum, não um componente React: o hook era chamado a cada',
  '   * render e os listeners nunca ficavam registrados. Precisa ficar no corpo',
  '   * do componente.',
  '   */',
  ...lines.slice(from, to + 1),
];

/* ── 2. remover o efeito de dentro do callback ── */

let removeTo = to;
if (removeTo + 1 < lines.length && lines[removeTo + 1].trim() === '') removeTo += 1;
lines.splice(from, removeTo - from + 1);

/* ── 3. reinserir no topo do componente, após handleResizeEnd ── */

const stateLine = lines.findIndex((line) => line.includes('const [isResizing, setIsResizing]'));
if (stateLine === -1) throw new Error('estado isResizing não encontrado');

// `const handleResizeEnd = ...` é uma arrow de uma linha; inserimos logo depois.
const endLine = lines.findIndex(
  (line, i) => i > stateLine && line.includes('const handleResizeEnd')
);
if (endLine === -1) throw new Error('handleResizeEnd não encontrado');

lines.splice(endLine + 1, 0, '', ...block);

const content = lines.join('\n');

/* ── 4. validar antes de escrever ── */

const ts = require('typescript');
const parsed = ts.createSourceFile(
  'ArticleForm.tsx',
  content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);
const diagnostics = parsed.parseDiagnostics ?? [];
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics.slice(0, 5)) {
    const { line } = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`[apply-articleform-hooks] ABORTADO linha ${line + 1}: ${diagnostic.messageText}`);
  }
  console.error('[apply-articleform-hooks] Nada foi escrito.');
  process.exit(1);
}

// O efeito precisa ter saído do callback: `a: ({ href, children }) => {` deve
// terminar em `return (` sem nenhum hook no meio.
const anchor = content.indexOf('a: ({ href, children }) => {');
const afterAnchor = content.slice(anchor, anchor + 1200);
if (afterAnchor.includes('useEffect(')) {
  console.error('[apply-articleform-hooks] ABORTADO: o efeito continua dentro do callback `a:`.');
  process.exit(1);
}

fs.writeFileSync(FILE, content);
console.log('[apply-articleform-hooks] ArticleForm.tsx atualizado.');
