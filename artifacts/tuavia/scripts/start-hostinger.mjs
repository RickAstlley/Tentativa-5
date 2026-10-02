#!/usr/bin/env node

/**
 * Supervisor de produção do TuaVia (Hostinger)
 *
 * Sobe o servidor Next.js em modo standalone e o mantém no ar, encaminhando
 * SIGINT/SIGTERM para o processo filho.
 *
 * Antes isto também subia o worker loop da fila de jobs de LLM, com lógica de
 * backoff, teto de reinícios e resolução do LLM_JOBS_FILE. O subsistema de IA
 * foi removido do projeto, então não há mais nada para o worker consumir: ele
 * saiu daqui junto, e com ele a complexidade de supervisionar dois processos.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Localização do bundle standalone ────────────────────────────────────────
let standaloneDir = null;
let serverJsPath = null;

const possibleStandalone = path.resolve(__dirname, '..');
const possibleRootStandalone = path.resolve(process.cwd(), '.next/standalone');

if (fs.existsSync(path.join(possibleStandalone, 'server.js'))) {
  standaloneDir = possibleStandalone;
  serverJsPath = path.join(possibleStandalone, 'server.js');
} else if (fs.existsSync(path.join(possibleRootStandalone, 'server.js'))) {
  standaloneDir = possibleRootStandalone;
  serverJsPath = path.join(possibleRootStandalone, 'server.js');
}

if (!serverJsPath) {
  console.error('❌ [Supervisor Hostinger] Não foi possível localizar server.js do Next.js standalone.');
  console.error('   Rode `npm run build` antes de iniciar o supervisor.');
  process.exit(1);
}

console.log('🚀 [Supervisor TuaVia Hostinger] Iniciando ambiente de produção...');
console.log(`[Supervisor] Diretório do Standalone: ${standaloneDir}`);
console.log(`[Supervisor] Entrypoint do Servidor: ${serverJsPath}`);

const env = {
  ...process.env,
  PORT: process.env.PORT || '3000',
  HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'production',
};

let isTerminating = false;

// ── Inicia o servidor ───────────────────────────────────────────────────────
const serverProcess = spawn(process.execPath, [serverJsPath], {
  cwd: standaloneDir,
  env,
  stdio: 'inherit',
});

function shutdown(signal) {
  if (isTerminating) return;
  isTerminating = true;
  console.log(`\n🛑 [Supervisor] Recebido sinal ${signal}. Encerrando processos filhos...`);

  if (serverProcess) {
    try {
      serverProcess.kill(signal);
    } catch (_) {}
  }

  // Força saída se o processo não terminar em 5 segundos
  setTimeout(() => {
    console.warn('⚠️ [Supervisor] Forçando encerramento.');
    process.exit(1);
  }, 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

serverProcess.on('exit', (code, signal) => {
  console.log(`[Supervisor] Servidor Next.js encerrou (code: ${code}, signal: ${signal}).`);
  shutdown(signal || 'SIGTERM');
  process.exit(code ?? (signal ? 1 : 0));
});

serverProcess.on('error', (err) => {
  console.error('❌ [Supervisor] Erro fatal no Servidor Next.js:', err.message);
  shutdown('SIGTERM');
  process.exit(1);
});
