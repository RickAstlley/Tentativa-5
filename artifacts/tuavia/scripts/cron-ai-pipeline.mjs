#!/usr/bin/env node

/**
 * TuaVia — Entrada única de cron para o pipeline de IA
 *
 * Pensado para ser chamado por um cron do sistema operacional:
 *
 *   [minuto] [hora] [dia] [mes] [dia-da-semana] cd /caminho/tuavia \
 *     && node scripts/cron-ai-pipeline.mjs >> data/cron.log 2>&1
 *
 * Por que existe se já existe o supervisor contínuo (`process-llm-jobs-loop.mjs`):
 *
 *  - O supervisor só existe se `start-hostinger.mjs` subir com sucesso. Se ele
 *    morre (OOM, deploy, queda do PM2), a fila fica parada e nada no admin
 *    indicava isso. Este script é a rede de segurança que roda mesmo sem o
 *    processo contínuo.
 *  - Ele também dá ao agendamento um ponto único e auditável, em vez do ciclo
 *    de curadoria depender de um `setTimeout` dentro de um laço.
 *
 * É seguro rodar junto do supervisor:
 *
 *  - A drenagem de jobs chama `POST /api/admin/llm/jobs/:id/execute`, que exige
 *    o lease por job (`acquireJobLease`). Dois dispatchers concorrentes não
 *    executam o mesmo job ao mesmo tempo.
 *  - O ciclo de curadoria passa por `/api/admin/llm/orchestrator/cron`, que tem
 *    guarda `isProcessing`, lock de arquivo e checagem `isDue()` (2h). Uma
 *    chamada fora de hora devolve "ainda não é hora" e não faz nada.
 *  - Este processo ainda toma um lock próprio, para duas chamadas de cron
 *    sobrepostas não gastarem duas vezes o mesmo ciclo de drenagem.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega e sanitiza variáveis de ambiente (.env, .env.production, hPanel)
import './env-loader.mjs';
import { runWorkerCycle, getLocalJobsFilePath } from './process-llm-jobs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/** Cron nunca deve passar de um ciclo: o timeout do cron é quem manda. */
const CYCLE_TIMEOUT_MS = Math.max(
  30_000,
  parseInt(process.env.LLM_CRON_CYCLE_TIMEOUT_MS || '240000', 10) || 240_000
);

/** Jobs por passagem. O servidor continua serializando em 1 (GLOBAL_MAX_CONCURRENT). */
const MAX_JOBS_PER_RUN = Math.max(1, parseInt(process.env.LLM_CRON_MAX_JOBS || '3', 10) || 3);

/** Lock de passagem: evita duas invocações de cron sobrepostas. */
const LOCK_TTL_MS = Math.max(60_000, CYCLE_TIMEOUT_MS + 30_000);
const lockFile = path.join(rootDir, 'data', 'cron-ai-pipeline.lock');

function log(message) {
  console.log(`[cron-ai-pipeline] ${message}`);
}

function acquireLock() {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });

  const now = Date.now();

  // Lock de um disparo anterior que morreu junto com o processo.
  if (fs.existsSync(lockFile)) {
    const age = now - fs.statSync(lockFile).mtimeMs;
    if (age < LOCK_TTL_MS) {
      return false;
    }
    log(`Lock anterior com ${Math.round(age / 1000)}s sem dono; removendo.`);
    try {
      fs.unlinkSync(lockFile);
    } catch {
      return false;
    }
  }

  try {
    // 'wx' falha se o arquivo já existir: é a criação exclusiva do próprio
    // sistema de arquivos, sem janela de corrida.
    fs.writeFileSync(
      lockFile,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      { flag: 'wx' }
    );
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(lockFile);
  } catch {
    /* já removido por outra passagem */
  }
}

/**
 * Dispara o ciclo de curadoria pelo endpoint do próprio app.
 *
 * O endpoint decide sozinho se já é hora (cadência de 2h em
 * `lib/orchestration/autoCycleScheduler.ts`), então chamar todo o dia é seguro.
 */
async function triggerOrchestratorCycle() {
  if (process.env.LLM_ORCHESTRATOR_ENABLED === 'false') {
    log('Curadoria desligada por LLM_ORCHESTRATOR_ENABLED=false.');
    return;
  }

  const baseUrl = (process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(
    /\/+$/,
    ''
  );
  const workerSecret = process.env.LLM_WORKER_SECRET || '';

  if (!workerSecret) {
    log('LLM_WORKER_SECRET ausente: ciclo de curadoria não disparado.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${baseUrl}/api/admin/llm/orchestrator/cron`, {
      method: 'GET',
      headers: { 'x-worker-secret': workerSecret },
      signal: controller.signal,
    });
    log(`Curadoria: HTTP ${response.status}.`);
  } catch (err) {
    if (err?.name === 'AbortError') {
      log('Curadoria: timeout de 20s aguardando resposta.');
    } else {
      log(`Curadoria: falha de conexão (${err?.message}). Não bloqueia a fila.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function drainQueue() {
  try {
    log(`Fila: ${getLocalJobsFilePath()}`);
    const stats = await runWorkerCycle({ maxJobsPerCycle: MAX_JOBS_PER_RUN });
    log(
      `Fila: encontrados=${stats.totalFound} processados=${stats.successCount} ` +
        `falhas=${stats.failureCount} restantes=${stats.queuedCount}`
    );
    return stats;
  } catch (err) {
    // Erro fatal de configuração precisa aparecer no log do cron: é o sinal de
    // que o pipeline está quebrado e o supervisor não vai curar sozinho.
    const fatalCodes = [
      'CONFIG_MISSING_WORKER_SECRET',
      'CONFIG_MISSING_BASE_URL',
      'CONFIG_QUEUE_UNWRITABLE',
      'CONFIG_QUEUE_PATH_MISSING',
    ];
    if (fatalCodes.includes(err?.code)) {
      log(`ERRO FATAL DE CONFIGURAÇÃO [${err.code}]: ${err.message}`);
    } else {
      log(`Erro transitório na fila: ${err?.message}`);
    }
    return null;
  }
}

export async function runCronPipeline() {
  if (!acquireLock()) {
    log('Outro disparo de cron ainda em andamento. Encerrando sem duplicar trabalho.');
    return { skipped: true };
  }

  const hardTimeout = setTimeout(() => {
    log('Tempo máximo de ciclo excedido. Encerrando para não segurar o próximo disparo.');
    releaseLock();
    process.exit(0);
  }, CYCLE_TIMEOUT_MS);

  try {
    log('Início do ciclo.');
    await triggerOrchestratorCycle();
    const stats = await drainQueue();
    log('Fim do ciclo.');
    return { skipped: false, stats };
  } finally {
    clearTimeout(hardTimeout);
    releaseLock();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCronPipeline()
    .then((result) => {
      // Sai com código 0 mesmo em erro transitório: um cron que sai diferente de
      // zero costuma disparar alerta por falha que se resolve no disparo
      // seguinte. Erro fatal de configuração é registrado no log de qualquer forma.
      if (!result.skipped && !result.stats) {
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      log(`Falha inesperada: ${err?.message}`);
      releaseLock();
      process.exitCode = 1;
    });
}
