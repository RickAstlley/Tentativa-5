#!/usr/bin/env node

/**
 * TuaVia — Script de Execução e Processamento de Jobs de IA em Background
 * 
 * Uso:
 *   node scripts/process-llm-jobs.mjs
 * 
 * Pode ser executado em ciclo único (CLI/Cron) ou importado pelo loop contínuo (process-llm-jobs-loop.mjs).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Carrega e sanitiza variáveis de ambiente (.env, .env.production, hPanel)
import './env-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export function getLocalJobsFilePath() {
  const envPath = process.env.LLM_JOBS_FILE;
  if (envPath && envPath.trim()) {
    const trimmed = envPath.trim().replace(/^["']|["']$/g, '');
    return path.resolve(trimmed);
  }
  
  // Se estiver em standalone, busca o diretório persistente pai
  const parentOfStandalone = path.resolve(rootDir, '..', '..');
  if (fs.existsSync(parentOfStandalone) && fs.existsSync(path.resolve(parentOfStandalone, 'package.json'))) {
    return path.resolve(parentOfStandalone, 'data', 'llm_jobs.json');
  }

  return path.resolve(process.cwd(), 'data', 'llm_jobs.json');
}

const STALE_JOB_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos sem atualização = lease expirado

/**
 * Executa um ciclo de verificação e processamento de jobs na fila.
 * @param {Object} options
 * @param {number} [options.maxJobsPerCycle]
 * @param {boolean} [options.isLoop]
 * @returns {Promise<{ successCount: number, failureCount: number, queuedCount: number, totalFound: number }>}
 */
export async function runWorkerCycle(options = {}) {
  const LOCAL_JOBS_FILE = getLocalJobsFilePath();

  // Validação de segurança: Segredo exclusivo do worker
  const workerSecret = (process.env.LLM_WORKER_SECRET || '').trim();

  if (!workerSecret) {
    const err = new Error('ERRO DE CONFIGURAÇÃO: LLM_WORKER_SECRET não está configurado.');
    err.code = 'CONFIG_MISSING_WORKER_SECRET';
    throw err;
  }

  // Validação e normalização da URL do executor
  const rawBaseUrl = (
    process.env.LLM_EXECUTOR_BASE_URL ||
    process.env.APP_URL ||
    ''
  ).trim();

  let baseUrl = rawBaseUrl.replace(/\/$/, '');

  if (!baseUrl) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('ERRO DE CONFIGURAÇÃO: defina LLM_EXECUTOR_BASE_URL ou APP_URL no ambiente.');
      err.code = 'CONFIG_MISSING_BASE_URL';
      throw err;
    }
    const port = process.env.PORT || 3000;
    baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`).trim().replace(/\/$/, '');
  }

  // Validação de leitura e escrita do diretório da fila
  try {
    const dir = path.dirname(LOCAL_JOBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(dir, fs.constants.W_OK | fs.constants.R_OK);
  } catch (accessErr) {
    const err = new Error(`ERRO DE CONFIGURAÇÃO: fila LLM não pode ser lida ou gravada: ${accessErr.message}`);
    err.code = 'CONFIG_QUEUE_UNWRITABLE';
    throw err;
  }

  if (!fs.existsSync(LOCAL_JOBS_FILE)) {
    try {
      fs.writeFileSync(LOCAL_JOBS_FILE, '[]', 'utf-8');
    } catch (createErr) {
      const err = new Error(`ERRO DE CONFIGURAÇÃO: falha ao inicializar llm_jobs.json: ${createErr.message}`);
      err.code = 'CONFIG_QUEUE_INIT_FAILED';
      throw err;
    }
  }

  let jobs = [];
  try {
    const raw = fs.readFileSync(LOCAL_JOBS_FILE, 'utf-8');
    jobs = JSON.parse(raw);
  } catch (err) {
    const readErr = new Error(`Erro ao ler jobs locais: ${err.message}`);
    readErr.code = 'QUEUE_READ_ERROR';
    throw readErr;
  }

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { successCount: 0, failureCount: 0, queuedCount: 0, totalFound: 0 };
  }

  const now = Date.now();
  let modified = false;

  // 1. Recupera jobs travados em 'running' após expiração do lease
  jobs.forEach((job) => {
    if (job.status === 'running') {
      const updatedAtTime = new Date(job.updatedAt || job.createdAt).getTime();
      const isExpired = job.lockedUntil
        ? new Date(job.lockedUntil).getTime() < now
        : now - updatedAtTime > STALE_JOB_THRESHOLD_MS;

      if (isExpired) {
        if ((job.attempts || 1) >= (job.maxAttempts || 3)) {
          console.warn(`⚠️ Job ${job.id} excedeu tentativas e expirou lease. Marcando como falha.`);
          job.status = 'failed';
          job.stage = 'Marcado como falha após timeout e expiração de tentativas.';
          job.error = 'Execução interrompida por timeout de lease.';
          job.errorCode = 'LEASE_TIMEOUT';
        } else {
          console.warn(`⚠️ Job ${job.id} estava travado em 'running'. Reenfileirando...`);
          job.status = 'queued';
          job.stage = 'Reenfileirado após expiração de lease de execução.';
        }
        job.lockedBy = undefined;
        job.lockedUntil = undefined;
        job.updatedAt = new Date().toISOString();
        modified = true;
      }
    }
  });

  if (modified) {
    try {
      const tmpFile = `${LOCAL_JOBS_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(jobs, null, 2), 'utf-8');
      fs.renameSync(tmpFile, LOCAL_JOBS_FILE);
    } catch (err) {
      console.error('Erro ao atualizar jobs stale:', err.message);
    }
  }

  const queuedJobs = jobs.filter((j) => {
    if (j.status === 'queued') return true;
    if (j.status === 'failed' && j.retryable) {
      if (!j.nextAttemptAt) return true;
      return new Date(j.nextAttemptAt).getTime() <= now;
    }
    return false;
  });

  if (queuedJobs.length === 0) {
    return { successCount: 0, failureCount: 0, queuedCount: 0, totalFound: 0 };
  }

  const maxLimit = options.maxJobsPerCycle || parseInt(process.env.LLM_WORKER_MAX_JOBS_PER_CYCLE || '5', 10) || 1;
  const jobsToProcess = queuedJobs.slice(0, maxLimit);

  let failureCount = 0;
  let successCount = 0;

  for (const job of jobsToProcess) {
    console.log(`🚀 [Worker] Executando Job: ${job.id} (${job.type}) via ${baseUrl}...`);

    const controller = new AbortController();
    // Timeout de 120 segundos por job para evitar travamento infinito
    // 45s: acima disso o job volta para a fila em vez de travar o worker.
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-worker-secret': workerSecret,
      };

      let executeUrl = `${baseUrl}/api/admin/llm/jobs/${job.id}/execute`;
      let res;
      try {
        res = await fetch(executeUrl, {
          method: 'POST',
          headers,
          signal: controller.signal,
        });
      } catch (primaryFetchErr) {
        const localPort = process.env.PORT || '3000';
        const fallbackUrl = `http://127.0.0.1:${localPort}/api/admin/llm/jobs/${job.id}/execute`;
        if (executeUrl !== fallbackUrl) {
          console.warn(`⚠️ [Worker] Chamada para ${baseUrl} falhou (${primaryFetchErr.message}). Tentando fallback local interno: ${fallbackUrl}`);
          res = await fetch(fallbackUrl, {
            method: 'POST',
            headers,
            signal: controller.signal,
          });
        } else {
          throw primaryFetchErr;
        }
      }

      clearTimeout(timeoutId);

      let responseData = {};
      let rawText = '';
      try {
        rawText = await res.text();
        responseData = JSON.parse(rawText);
      } catch {
        responseData = {};
      }

      if (res.status === 401) {
        console.error(`❌ [Worker] Erro de autenticação (HTTP 401) ao executar Job ${job.id}. Verifique LLM_WORKER_SECRET.`);
        failureCount++;
      } else if (res.status === 404) {
        console.warn(`⚠️ [Worker] Job ${job.id} não encontrado no servidor (HTTP 404).`);
        failureCount++;
      } else if (res.status === 409) {
        const currentJobStatus = responseData.job?.status;
        if (currentJobStatus === 'completed') {
          console.log(`ℹ️ [Worker] Job ${job.id} já foi concluído anteriormente (Idempotente).`);
          successCount++;
        } else if (currentJobStatus === 'running') {
          console.log(`ℹ️ [Worker] Job ${job.id} já está em execução em outro processo.`);
        } else {
          console.warn(`⚠️ [Worker] Conflito 409 para Job ${job.id} com status: ${currentJobStatus || 'desconhecido'}.`);
          failureCount++;
        }
      } else if (res.ok) {
        const jobStatus = responseData.job?.status;
        const jobErrorCode = responseData.job?.errorCode || responseData.errorCode;
        const isCompleted = responseData.success === true && (jobStatus === 'completed' || !jobStatus);

        if (isCompleted) {
          console.log(`✅ [Worker] Job ${job.id} processado com sucesso. Status final: completed`);
          successCount++;
        } else if (jobStatus === 'running') {
          console.log(`⏳ [Worker] Job ${job.id} em processamento...`);
        } else {
          // Status 'failed' ou success: false (ex: API_KEY_MISSING, UPSTREAM_TIMEOUT, etc.)
          console.warn(
            `⚠️ [Worker] Job ${job.id} finalizado com falha (status: ${jobStatus || 'failed'}, errorCode: ${jobErrorCode || 'JOB_FAILED'}). ${responseData.job?.error || responseData.error || ''}`
          );
          failureCount++;
        }
      } else {
        console.warn(`⚠️ [Worker] Falha HTTP ${res.status} ao executar Job ${job.id}: ${rawText.slice(0, 120)}`);
        failureCount++;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error(`❌ [Worker] Timeout (120s) excedido ao executar o job ${job.id}.`);
      } else {
        console.error(`❌ [Worker] Erro ao comunicar com endpoint de execução do job ${job.id}:`, err.message);
      }
      failureCount++;
    }
  }

  return {
    successCount,
    failureCount,
    queuedCount: queuedJobs.length - jobsToProcess.length,
    totalFound: queuedJobs.length,
  };
}

async function main() {
  console.log('🤖 [TuaVia LLM Worker] Verificando fila de jobs persistente (Ciclo Único)...');
  const LOCAL_JOBS_FILE = getLocalJobsFilePath();
  console.log(`Fila: ${LOCAL_JOBS_FILE}`);

  try {
    const stats = await runWorkerCycle({ maxJobsPerCycle: 5 });

    if (stats.totalFound === 0) {
      console.log('✅ Nenhum job aguardando execução na fila.');
      process.exit(0);
    }

    console.log(
      `🏁 Processamento finalizado. (${stats.successCount} processados/idempotentes, ${stats.failureCount} falhas, ${stats.queuedCount} restantes)`
    );

    if (stats.failureCount > 0 && stats.successCount === 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// Executa se chamado diretamente via CLI
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

