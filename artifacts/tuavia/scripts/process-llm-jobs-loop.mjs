#!/usr/bin/env node

/**
 * TuaVia — Loop Contínuo do Worker de IA em Background
 * 
 * Permite execução autônoma dentro do processo Node da Hostinger sem necessidade de Cron externo.
 * 
 * Uso direto:
 *   node scripts/process-llm-jobs-loop.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runWorkerCycle, getLocalJobsFilePath } from './process-llm-jobs.mjs';

const __filename = fileURLToPath(import.meta.url);

let isShuttingDown = false;
let currentSleepTimeout = null;

function sleep(ms) {
  return new Promise((resolve) => {
    currentSleepTimeout = setTimeout(() => {
      currentSleepTimeout = null;
      resolve();
    }, ms);
  });
}

/**
 * Dispara o ciclo de curadoria pelo endpoint de cron do próprio app.
 * Falha aqui nunca interrompe o worker da fila de jobs.
 */
async function triggerOrchestratorCycle() {
  const baseUrl = (process.env.APP_URL || 'http://127.0.0.1:' + (process.env.PORT || 3000)).replace(/\/+$/, '');
  const workerSecret = process.env.LLM_WORKER_SECRET || '';

  if (!workerSecret) {
    console.warn('[Orchestrator] LLM_WORKER_SECRET ausente: ciclo automatico desativado.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}/api/admin/llm/orchestrator/cron`, {
      method: 'GET',
      headers: { 'x-worker-secret': workerSecret },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[Orchestrator] Cron respondeu ${response.status}; ciclo nao disparado.`);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.warn('[Orchestrator] Falha ao contatar o cron (nao bloqueia a fila):', err?.message);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function startWorkerLoop() {
  let queuePath = '';
  try {
    queuePath = getLocalJobsFilePath();
  } catch (pathErr) {
    console.error(`❌ [LLM Worker Loop] ERRO FATAL DE CONFIGURAÇÃO: ${pathErr.message}`);
    process.exit(1);
  }

  const intervalMs = Math.max(1000, parseInt(process.env.LLM_WORKER_INTERVAL_MS || '10000', 10) || 10000);
  const maxJobsPerCycle = Math.max(1, parseInt(process.env.LLM_WORKER_MAX_JOBS_PER_CYCLE || '1', 10) || 1);

  console.log('🤖 [LLM Worker Loop] Iniciado');
  console.log(`[LLM Worker Loop] Fila: ${queuePath}`);
  console.log(`[LLM Worker Loop] Intervalo: ${intervalMs}ms | Limite por ciclo: ${maxJobsPerCycle}`);

  const handleShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [LLM Worker Loop] Sinal ${signal} recebido. Finalizando ciclo com segurança...`);
    if (currentSleepTimeout) {
      clearTimeout(currentSleepTimeout);
      currentSleepTimeout = null;
    }
  };

  process.once('SIGINT', () => handleShutdown('SIGINT'));
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));

  let consecutiveErrors = 0;

  while (!isShuttingDown) {
    try {
      const stats = await runWorkerCycle({ maxJobsPerCycle, isLoop: true });
      consecutiveErrors = 0;

      if (stats.totalFound > 0) {
        console.log(
          `[LLM Worker Loop] Ciclo concluído: encontrados=${stats.totalFound} processados=${stats.successCount} falhas=${stats.failureCount} restantes=${stats.queuedCount}`
        );
      }
    } catch (err) {
      consecutiveErrors++;

      // Erros fatais de configuração devem abortar o loop para alertar a infraestrutura
      if (
        err.code === 'CONFIG_MISSING_WORKER_SECRET' ||
        err.code === 'CONFIG_MISSING_BASE_URL' ||
        err.code === 'CONFIG_QUEUE_UNWRITABLE' ||
        err.code === 'CONFIG_QUEUE_PATH_MISSING'
      ) {
        console.error(`❌ [LLM Worker Loop] ERRO FATAL DE CONFIGURAÇÃO: ${err.message}`);
        process.exit(1);
      }

      console.warn(`⚠️ [LLM Worker Loop] Erro transitório no ciclo (#${consecutiveErrors}): ${err.message}`);
      
      // Se houver muitos erros consecutivos, adiciona um backoff leve
      if (consecutiveErrors >= 5) {
        console.warn('⚠️ [LLM Worker Loop] Múltiplos erros consecutivos no worker. Aplicando backoff de 5s adicionais.');
        if (!isShuttingDown) await sleep(5000);
      }
    }

    // Ciclo de curadoria (Home -> Radar Global -> AI Radar).
    // Sem isto o radar nunca roda sozinho: dependia de alguém clicar no admin.
    // Chamado por HTTP porque este worker e JS puro e nao pode importar o
    // scheduler, que e TypeScript.
    if (process.env.LLM_ORCHESTRATOR_ENABLED !== 'false') {
      await triggerOrchestratorCycle();
    }

    if (!isShuttingDown) {
      await sleep(intervalMs);
    }
  }

  console.log('✅ [LLM Worker Loop] Encerrado com sucesso.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startWorkerLoop().catch((err) => {
    console.error('Fatal loop error:', err);
    process.exit(1);
  });
}
