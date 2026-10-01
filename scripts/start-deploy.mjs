#!/usr/bin/env node
/**
 * scripts/start-deploy.mjs
 *
 * Ponto de entrada de produção na raiz do repositório.
 *
 * A hospedagem executa `npm start` com a raiz do repositório como diretório de
 * trabalho, mas o app — e o supervisor que sobe servidor e worker de IA — ficam
 * em `artifacts/tuavia`. Rodar o supervisor daqui funciona porque ele resolve
 * os caminhos a partir de `__dirname`, mas delegar com o `cwd` correto remove
 * a dependência disso e mantém o comportamento idêntico ao rodar de dentro da
 * pasta do app.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT_DIR, 'artifacts', 'tuavia');
const SUPERVISOR = path.join(APP_DIR, 'scripts', 'start-hostinger.mjs');

if (!existsSync(SUPERVISOR)) {
  console.error(`[start-deploy] Supervisor não encontrado em ${SUPERVISOR}.`);
  console.error('[start-deploy] Rode o build antes de iniciar: `npm run build`.');
  process.exit(1);
}

const child = spawn(process.execPath, ['scripts/start-hostinger.mjs'], {
  cwd: APP_DIR,
  stdio: 'inherit',
  env: process.env,
});

// Encaminha o encerramento para o supervisor, para o PM2 não precisar matar
// a árvore de processos a cada restart.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
