#!/usr/bin/env node

/**
 * TuaVia — Supervisor de Inicialização da Produção (Hostinger Standalone)
 * 
 * Inicia o servidor Next.js standalone e o loop contínuo de background worker (sem necessidade de Cron externo).
 * 
 * Uso:
 *   node scripts/start-hostinger.mjs
 *   ou
 *   node .next/standalone/scripts/start-hostinger.mjs
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Carrega e sanitiza variáveis de ambiente do Hostinger (.env, .env.production, hPanel)
import './env-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Identifica se estamos rodando de dentro de .next/standalone ou da raiz
let standaloneDir;
let serverJsPath;
let loopScriptPath;

const possibleStandalone = path.resolve(__dirname, '..');
const possibleRootStandalone = path.resolve(process.cwd(), '.next/standalone');

if (fs.existsSync(path.resolve(possibleStandalone, 'server.js'))) {
  // Executado a partir de .next/standalone/scripts/start-hostinger.mjs
  standaloneDir = possibleStandalone;
  serverJsPath = path.resolve(standaloneDir, 'server.js');
  loopScriptPath = path.resolve(standaloneDir, 'scripts/process-llm-jobs-loop.mjs');
} else if (fs.existsSync(path.resolve(possibleRootStandalone, 'server.js'))) {
  // Executado a partir da raiz do projeto: node scripts/start-hostinger.mjs
  standaloneDir = possibleRootStandalone;
  serverJsPath = path.resolve(standaloneDir, 'server.js');
  loopScriptPath = path.resolve(standaloneDir, 'scripts/process-llm-jobs-loop.mjs');
  if (!fs.existsSync(loopScriptPath)) {
    loopScriptPath = path.resolve(process.cwd(), 'scripts/process-llm-jobs-loop.mjs');
  }
} else if (fs.existsSync(path.resolve(process.cwd(), 'server.js'))) {
  // Executado diretamente dentro de .next/standalone
  standaloneDir = process.cwd();
  serverJsPath = path.resolve(standaloneDir, 'server.js');
  loopScriptPath = path.resolve(standaloneDir, 'scripts/process-llm-jobs-loop.mjs');
} else {
  console.error('❌ [Supervisor Hostinger] Não foi possível localizar server.js do Next.js standalone.');
  console.error('   Certifique-se de executar "npm run build" antes de iniciar em produção.');
  process.exit(1);
}

console.log('🚀 [Supervisor TuaVia Hostinger] Iniciando ambiente de produção...');
console.log(`[Supervisor] Diretório do Standalone: ${standaloneDir}`);
console.log(`[Supervisor] Entrypoint do Servidor: ${serverJsPath}`);

// Resolução e validação compartilhada da variável LLM_JOBS_FILE
let resolvedJobsFile = '';
const rawJobsFile = process.env.LLM_JOBS_FILE?.trim();
const isProduction = process.env.NODE_ENV === 'production';

if (rawJobsFile) {
  let cleaned = rawJobsFile.replace(/^["']|["']$/g, '').trim();
  if (path.isAbsolute(cleaned)) {
    resolvedJobsFile = path.resolve(cleaned);
  } else {
    // Se for caminho relativo fornecido pelo usuário, resolve a partir da raiz
    resolvedJobsFile = path.resolve(process.cwd(), cleaned);
  }
} else {
  // Resolução inteligente: cria pasta data/ persistente fora de .next/standalone
  const parentOfStandalone = path.resolve(standaloneDir, '..', '..');
  if (fs.existsSync(parentOfStandalone) && fs.existsSync(path.resolve(parentOfStandalone, 'package.json'))) {
    resolvedJobsFile = path.resolve(parentOfStandalone, 'data', 'llm_jobs.json');
  } else {
    resolvedJobsFile = path.resolve(process.cwd(), 'data', 'llm_jobs.json');
  }
  console.info(`[Supervisor] ℹ️ LLM_JOBS_FILE não definido no hPanel. Usando caminho persistente padrão: ${resolvedJobsFile}`);
}

// Validação real de escrita e existência do armazenamento antes de subir os processos
try {
  const queueDir = path.dirname(resolvedJobsFile);
  if (!fs.existsSync(queueDir)) {
    fs.mkdirSync(queueDir, { recursive: true });
  }

  // Teste de escrita real com arquivo temporário
  const testFile = path.join(queueDir, `.supervisor_write_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`);
  fs.writeFileSync(testFile, 'test', 'utf-8');
  fs.unlinkSync(testFile);

  // Inicializa o arquivo de jobs com array vazio se não existir
  if (!fs.existsSync(resolvedJobsFile)) {
    fs.writeFileSync(resolvedJobsFile, '[]\n', 'utf-8');
  }

  console.log('[Supervisor] Fila persistente externa configurada: sim');
  console.log('[Supervisor] Worker e servidor usarão a mesma fila persistente');
} catch (err) {
  console.error('❌ [Supervisor Hostinger] CONFIG_QUEUE_UNWRITABLE');
  console.error('   A fila persistente não está gravável no caminho configurado. Verifique LLM_JOBS_FILE e as permissões da pasta na Hostinger.');
  console.error(`   Detalhes: ${err.message}`);
  process.exit(1);
}

const env = {
  ...process.env,
  PORT: process.env.PORT || '3000',
  HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'production',
  LLM_JOBS_FILE: resolvedJobsFile,
};

// 1. Inicia o Servidor Next.js Standalone
console.log(`[Supervisor] Iniciando servidor Next.js na porta ${env.PORT}...`);
const serverProcess = spawn(process.execPath, [serverJsPath], {
  cwd: standaloneDir,
  env,
  stdio: 'inherit',
});

let workerProcess = null;
let isTerminating = false;
let workerRestartAttempts = 0;
let workerRestartTimeout = null;

// 2. Inicia o Worker Loop em Background se habilitado
const workerLoopEnabled = process.env.LLM_WORKER_LOOP_ENABLED !== 'false';

function launchWorker() {
  if (isTerminating || !workerLoopEnabled) return;

  const workerEnv = {
    ...env,
    ...(resolvedJobsFile ? { LLM_JOBS_FILE: resolvedJobsFile } : {}),
    LLM_EXECUTOR_BASE_URL: (
      process.env.LLM_EXECUTOR_BASE_URL ||
      process.env.APP_URL ||
      `http://127.0.0.1:${env.PORT}`
    ).replace(/\/$/, ''),
  };

  console.log(`[Supervisor] Iniciando Worker Loop em background (${loopScriptPath})...`);

  workerProcess = spawn(process.execPath, [loopScriptPath], {
    cwd: standaloneDir,
    env: workerEnv,
    stdio: 'inherit',
  });

  workerProcess.on('exit', (code, signal) => {
    workerProcess = null;
    if (isTerminating) return;

    // Se o código for 1 com falha fatal de configuração, encerra o supervisor
    if (code === 1 && workerRestartAttempts === 0) {
      console.warn(`⚠️ [Supervisor] Worker Loop encerrou com erro (code: ${code}).`);
    }

    workerRestartAttempts++;
    if (workerRestartAttempts > 10) {
      console.error('❌ [Supervisor] Worker Loop falhou 10 vezes consecutivas. Encerrando supervisor para reiniciar o container.');
      shutdown('SIGTERM');
      process.exit(1);
      return;
    }

    const backoffMs = Math.min(30000, 2000 * Math.pow(1.5, workerRestartAttempts));
    console.warn(`⚠️ [Supervisor] Worker Loop reiniciará em ${(backoffMs / 1000).toFixed(1)}s (tentativa #${workerRestartAttempts})...`);
    workerRestartTimeout = setTimeout(() => {
      launchWorker();
    }, backoffMs);
  });

  workerProcess.on('error', (err) => {
    console.error('❌ [Supervisor] Erro no processo do Worker Loop:', err.message);
  });
}

if (workerLoopEnabled && fs.existsSync(loopScriptPath)) {
  // Aguarda 2 segundos para o servidor Next.js começar a escutar requisições antes do primeiro ciclo
  setTimeout(() => {
    launchWorker();
  }, 2000);
} else if (!workerLoopEnabled) {
  console.log('[Supervisor] LLM_WORKER_LOOP_ENABLED=false. Worker Loop automático desativado.');
} else {
  console.warn(`⚠️ [Supervisor] Script do Worker Loop não encontrado em: ${loopScriptPath}`);
}

// 3. Tratamento de Sinais de Finalização
function shutdown(signal) {
  if (isTerminating) return;
  isTerminating = true;
  console.log(`\n🛑 [Supervisor] Recebido sinal ${signal}. Encerrando processos filhos...`);

  if (workerProcess) {
    try {
      workerProcess.kill(signal);
    } catch (_) {}
  }

  if (serverProcess) {
    try {
      serverProcess.kill(signal);
    } catch (_) {}
  }

  // Força saída se os processos não terminarem em 5 segundos
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
