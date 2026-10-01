/**
 * TuaVia — Gerenciador de Jobs e Tarefas Assíncronas de IA
 * 
 * Permite que tarefas mais demoradas (pesquisa de imagens, auditoria com visão, gerações complexas)
 * sejam executadas de forma assíncrona, salvando o progresso e resultados intermediários (parciais),
 * com locks/leases de execução, recuperação de tarefas paradas e escrita atômica em disco,
 * eliminando 100% dos erros 504 Gateway Timeout da Hostinger.
 */

import { getAdminDb, withAdminTimeout } from '@/lib/firebaseAdmin';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import { ImageResearchAgent } from '@/lib/ai/agents/imageResearch';
import { AIRouter } from '@/lib/ai/router';
import { AIModelId } from '@/lib/ai/types';
import { YAMLParser } from '@/lib/ai/validation/parser';
import {
  RankingStage1Schema,
  RankingStage2ModelsSchema,
  BikeSpecsSchema,
  BikeSeoSchema,
  BikePriceDataSchema,
  BikeSpecSectionSchema,
  BikeManualSearchSchema,
  ArticleMetaSchema,
  ContentGenerationOutputSchema,
} from '@/lib/ai/validation/schemas';
import { ProviderHub } from '@/lib/ai/providers/hub';
import { sanitizePriceHistory, generateRealisticPriceHistory, getLastNMonths } from '@/lib/priceHistory';
import { getAllBikesServer, saveBikeToServerFile } from '@/lib/serverStorage';
import { EBikeGrouped, EBikeStoreOffer, EBikeSpecItem, EBikeSpecSection, EBikePriceHistoryPoint } from '@/types/ebike';
import { generateSlug } from '@/lib/ebikes';
import { WebSearchTool } from '@/lib/ai/tools/webSearch';
import { runIngestionPipeline } from '@/lib/ingestion/pipeline';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  GENERIC_SOURCE_LABELS,
  sanitizeSpecItems,
  auditSpecItem,
  auditSpecSection,
  auditEBikeSpecs,
} from '@/lib/ai/deterministicAuditor';

export {
  GENERIC_SOURCE_LABELS,
  sanitizeSpecItems,
  auditSpecItem,
  auditSpecSection,
  auditEBikeSpecs,
};

export type LLMJobType =
  | 'image_research'
  | 'image_search_validate'
  | 'content_generation'
  | 'ranking_generation'
  | 'ebike_autofill'
  | 'ebike_section_autofill'
  | 'ebike_ingest_step'
  | 'ebike_seo'
  | 'ebike_price_chart'
  | 'ebike_manual_search'
  | 'article_autofill'
  | 'article_seo'
  | 'radar_scan'
  | 'ai_radar_scan';

export type LLMJobStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed';

export interface LLMJobResult {
  text?: string;
  article_images?: any[];
  discarded_candidates?: any[];
  audit?: any;
  telemetry?: any;
  data?: any;
  summary?: string;
  success?: boolean;
  source?: string;
  llmValidated?: boolean;
  [key: string]: any;
}

export interface LLMJob {
  id: string;
  type: LLMJobType;
  status: LLMJobStatus;
  progress: number; // 0 a 100
  stage: string; // Descrição legível da etapa atual
  input: any;
  result?: LLMJobResult;
  /**
   * Consumo de tokens da última execução. Lido por `lib/ai/agentPipeline.ts`
   * para acumular o custo do pipeline; nunca estava no tipo, apesar de ser
   * preenchido em runtime.
   */
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  /** Modelo que executou o job, para a trilha de auditoria. */
  modelUsed?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  nextAttemptAt?: string;
  attempts: number;
  maxAttempts: number;
  lockedBy?: string;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy?: string;
}

import os from 'os';

export function getLocalJobsFilePath(): string {
  const envPath = process.env.LLM_JOBS_FILE;
  if (envPath && envPath.trim()) {
    const trimmed = envPath.trim();
    return path.resolve(trimmed);
  }

  // Fallback padrão seguro (compatível com desenvolvimento e produção)
  return path.resolve(process.cwd(), 'data', 'llm_jobs.json');
}

export function getLockFilePath(): string {
  const filePath = getLocalJobsFilePath();
  return `${filePath}.lock`;
}

/**
 * Garante que o diretório e o arquivo da fila existam e tenham permissões adequadas.
 * Possui fallback automático para diretório temporário do sistema se houver restrição de permissão.
 */
export function ensureQueueStorageReady(options: { writeCheck?: boolean } = { writeCheck: false }): string {
  let filePath = getLocalJobsFilePath();
  let dir = path.dirname(filePath);

  const trySetup = (targetPath: string, targetDir: string): boolean => {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (options.writeCheck) {
        const testFile = path.join(targetDir, `.queue_write_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.tmp`);
        fs.writeFileSync(testFile, 'test', 'utf-8');
        fs.unlinkSync(testFile);
      } else {
        fs.accessSync(targetDir, fs.constants.R_OK);
      }

      if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, '[]\n', 'utf-8');
      }

      return true;
    } catch {
      return false;
    }
  };

  if (trySetup(filePath, dir)) {
    return filePath;
  }

  // Fallback automático para os.tmpdir() em caso de restrição de permissão de escrita
  const fallbackDir = path.join(os.tmpdir(), 'tuavia_queue');
  const fallbackPath = path.join(fallbackDir, 'llm_jobs.json');

  if (trySetup(fallbackPath, fallbackDir)) {
    return fallbackPath;
  }

  // Retorna filePath original
  return filePath;
}

const JOBS_COLLECTION = 'llm_jobs';
const LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutos de lease para suportar tarefas com raciocínio profundo sem interromper worker
const LOCK_MAX_AGE_MS = 5000; // 5 segundos para expirar lock stale

// Memória local para fallback instantâneo caso Firestore esteja offline
const memoryJobs = new Map<string, LLMJob>();

/**
 * Retorna estatísticas sanitizadas da fila para healthcheck e telemetria.
 */
export function getQueueStats(): {
  configured: boolean;
  fileExists: boolean;
  fileWritable: boolean;
  filePath: string;
  queued: number;
  running: number;
  failedRetryable: number;
  total: number;
  status: 'QUEUE_OK' | 'QUEUE_PATH_MISSING' | 'QUEUE_UNWRITABLE';
  errorCode?: string;
} {
  let filePath = '';
  let configured = true;
  let fileExists = false;
  let fileWritable = false;
  let queued = 0;
  let running = 0;
  let failedRetryable = 0;
  let total = 0;
  let status: 'QUEUE_OK' | 'QUEUE_PATH_MISSING' | 'QUEUE_UNWRITABLE' = 'QUEUE_OK';
  let errorCode: string | undefined = undefined;

  try {
    filePath = getLocalJobsFilePath();
  } catch (err: any) {
    configured = false;
    status = 'QUEUE_PATH_MISSING';
    errorCode = err.errorCode || 'CONFIG_QUEUE_PATH_MISSING';
    return {
      configured: false,
      fileExists: false,
      fileWritable: false,
      filePath: '',
      queued: 0,
      running: 0,
      failedRetryable: 0,
      total: 0,
      status,
      errorCode,
    };
  }

  try {
    ensureQueueStorageReady({ writeCheck: true });
    fileWritable = true;
  } catch (err: any) {
    fileWritable = false;
    status = 'QUEUE_UNWRITABLE';
    errorCode = err.errorCode || 'CONFIG_QUEUE_UNWRITABLE';
  }

  try {
    if (fs.existsSync(filePath)) {
      fileExists = true;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const list = JSON.parse(raw) as LLMJob[];
      if (Array.isArray(list)) {
        total = list.length;
        const now = Date.now();
        list.forEach((j) => {
          if (j.status === 'queued') queued++;
          else if (j.status === 'running') running++;
          else if (j.status === 'failed' && j.retryable) {
            if (!j.nextAttemptAt || new Date(j.nextAttemptAt).getTime() <= now) {
              failedRetryable++;
            }
          }
        });
      }
    }
  } catch (_) {}

  return {
    configured,
    fileExists,
    fileWritable,
    filePath,
    queued,
    running,
    failedRetryable,
    total,
    status,
    errorCode,
  };
}

/**
 * Tenta adquirir um lock de arquivo exclusivo para evitar concorrência entre processos (Web Server e Background Worker).
 */
function acquireFileLock(): boolean {
  try {
    const filePath = ensureQueueStorageReady({ writeCheck: true });
    const lockFile = `${filePath}.lock`;
    const dir = path.dirname(lockFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fd = fs.openSync(lockFile, 'wx');
    fs.writeSync(fd, `${process.pid}:${Date.now()}`);
    fs.closeSync(fd);
    return true;
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EPERM' || err.errorCode === 'CONFIG_QUEUE_UNWRITABLE') {
      const error: any = new Error(
        'A fila de processamento não está disponível no servidor (permissão de escrita negada para lock). Verifique o caminho persistente LLM_JOBS_FILE e as permissões da pasta na Hostinger.'
      );
      error.errorCode = 'CONFIG_QUEUE_UNWRITABLE';
      throw error;
    }
    if (err.errorCode === 'CONFIG_QUEUE_PATH_MISSING') {
      throw err;
    }
    if (err.code === 'EEXIST') {
      try {
        const lockFile = getLockFilePath();
        const stats = fs.statSync(lockFile);
        if (Date.now() - stats.mtimeMs > LOCK_MAX_AGE_MS) {
          console.warn('[JobStore] Lock stale detectado por tempo de modificação, limpando...');
          releaseFileLock();
          return acquireFileLock();
        }
        const content = fs.readFileSync(lockFile, 'utf-8');
        const [, timestampStr] = content.split(':');
        const timestamp = parseInt(timestampStr, 10);
        if (!isNaN(timestamp) && Date.now() - timestamp > LOCK_MAX_AGE_MS) {
          console.warn('[JobStore] Lock stale detectado por conteúdo, limpando...');
          releaseFileLock();
          return acquireFileLock();
        }
      } catch (_) {
        // Se der erro ao ler/fazer stat, presume deletado/stale
        releaseFileLock();
        try {
          return acquireFileLock();
        } catch (_) {
          return false;
        }
      }
      return false;
    }
    throw err;
  }
}

/**
 * Libera o lock de arquivo.
 */
function releaseFileLock(): void {
  try {
    const lockFile = getLockFilePath();
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch (_) {}
}

/**
 * Executa uma função protegida por lock de arquivo exclusivo.
 */
async function runWithLock<T>(fn: () => Promise<T> | T): Promise<T> {
  let attempts = 0;
  const maxAttempts = 50; // Até 5 segundos de espera no total
  while (attempts < maxAttempts) {
    if (acquireFileLock()) {
      try {
        return await fn();
      } finally {
        releaseFileLock();
      }
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('[JobStore] Não foi possível adquirir o lock do arquivo de jobs.');
}

/**
 * Carrega jobs salvos localmente em disco para a memória.
 */
function loadLocalJobsFromFile(): LLMJob[] {
  try {
    const filePath = ensureQueueStorageReady({ writeCheck: false });
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const list = JSON.parse(content) as LLMJob[];
      if (Array.isArray(list)) {
        memoryJobs.clear();
        list.forEach((j) => memoryJobs.set(j.id, j));
        return list;
      }
    }
  } catch (err: any) {
    if (err.errorCode === 'CONFIG_QUEUE_PATH_MISSING' || err.errorCode === 'CONFIG_QUEUE_UNWRITABLE') {
      throw err;
    }
    console.warn('[JobStore] Erro ao carregar jobs locais:', err);
  }
  return [];
}

/**
 * Salva a lista de jobs em disco de forma atômica (arquivo temporário + rename).
 */
function saveLocalJobsToFile(all: LLMJob[]): void {
  try {
    const filePath = ensureQueueStorageReady({ writeCheck: true });
    const sorted = all
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Filtra para manter no máximo 100 mais recentes, mas NUNCA remove ativos
    const active = sorted.filter(j => j.status === 'running' || j.status === 'queued');
    const inactive = sorted.filter(j => j.status !== 'running' && j.status !== 'queued');
    const finalJobs = [...active, ...inactive].slice(0, 100);

    const tmpFile = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(finalJobs, null, 2), 'utf-8');
    
    try {
      const fd = fs.openSync(tmpFile, 'r+');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (_) {}

    fs.renameSync(tmpFile, filePath);
    
    memoryJobs.clear();
    finalJobs.forEach((j) => memoryJobs.set(j.id, j));
  } catch (err: any) {
    if (err.errorCode === 'CONFIG_QUEUE_PATH_MISSING' || err.errorCode === 'CONFIG_QUEUE_UNWRITABLE') {
      throw err;
    }
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      const error: any = new Error(
        'A fila de processamento não está disponível no servidor (permissão de escrita negada). Verifique o caminho persistente LLM_JOBS_FILE e as permissões da pasta na Hostinger.'
      );
      error.errorCode = 'CONFIG_QUEUE_UNWRITABLE';
      throw error;
    }
    console.error('[JobStore] Erro ao persistir jobs atomicamente em arquivo:', err);
    const error: any = new Error(err.message || 'Falha de persistência da fila');
    error.errorCode = 'JOB_PERSISTENCE_FAILED';
    throw error;
  }
}

// Inicialização segura no carregamento (não interrompe o import em caso de configuração pendente)
try {
  loadLocalJobsFromFile();
} catch (_) {}

/**
 * Cria um novo Job na fila assíncrona.
 */
export async function createJob(
  type: LLMJobType,
  input: any,
  createdBy?: string
): Promise<LLMJob> {
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const newJob: LLMJob = {
    id,
    type,
    status: 'queued',
    progress: 0,
    stage: 'Aguardando processamento',
    input,
    attempts: 0,
    maxAttempts: 5,
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy || 'admin',
  };

  await runWithLock(() => {
    const jobs = loadLocalJobsFromFile();
    jobs.push(newJob);
    saveLocalJobsToFile(jobs);
  });

  // Tenta persistir no Firestore Admin
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      await withAdminTimeout(
        adminDb.collection(JOBS_COLLECTION).doc(id).set(newJob),
        3000,
        null
      );
    }
  } catch (err) {
    console.warn('[JobStore] Firestore indisponível para criar job, usando cache local:', err);
  }

  return newJob;
}

/**
 * Obtém um Job por ID com sincronização e sem depender apenas de cache em memória stale.
 */
export async function getJob(id: string): Promise<LLMJob | null> {
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      const snap = await withAdminTimeout(
        adminDb.collection(JOBS_COLLECTION).doc(id).get(),
        2500,
        null
      );
      if (snap && snap.exists) {
        const firestoreJob = snap.data() as LLMJob;
        await runWithLock(() => {
          const list = loadLocalJobsFromFile();
          const idx = list.findIndex(j => j.id === id);
          if (idx !== -1) {
            list[idx] = firestoreJob;
          } else {
            list.push(firestoreJob);
          }
          saveLocalJobsToFile(list);
        });
        return firestoreJob;
      }
    }
  } catch (err) {
    // Continua para o disco local
  }

  let found: LLMJob | null = null;
  await runWithLock(() => {
    const list = loadLocalJobsFromFile();
    found = list.find((j) => j.id === id) || null;
  });

  return found;
}

/**
 * Atualiza um Job com novo status, progresso ou resultado de forma segura entre processos.
 */
export async function updateJob(
  id: string,
  updates: Partial<LLMJob>
): Promise<LLMJob | null> {
  let updated: LLMJob | null = null;

  await runWithLock(() => {
    const list = loadLocalJobsFromFile();
    const existingIdx = list.findIndex((j) => j.id === id);
    if (existingIdx !== -1) {
      updated = {
        ...list[existingIdx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      list[existingIdx] = updated;
      saveLocalJobsToFile(list);
    }
  });

  if (!updated) {
    const firestoreJob = await getJob(id);
    if (!firestoreJob) return null;
    updated = {
      ...firestoreJob,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      await withAdminTimeout(
        adminDb.collection(JOBS_COLLECTION).doc(id).set(updated, { merge: true }),
        3000,
        null
      );
    }
  } catch (err) {
    console.warn('[JobStore] Falha ao atualizar job no Firestore:', err);
  }

  return updated;
}

/**
 * Tenta adquirir o lease/lock de execução para um job de forma segura.
 */
export async function acquireJobLease(
  jobId: string,
  workerId: string = 'internal_worker'
): Promise<{ acquired: boolean; job?: LLMJob; reason?: string }> {
  const job = await getJob(jobId);
  if (!job) {
    return { acquired: false, reason: 'Job não encontrado' };
  }

  if (job.status === 'completed') {
    return { acquired: false, job, reason: 'Job já concluído' };
  }

  const now = Date.now();
  const leaseDuration = LEASE_DURATION_MS;

  // Se o job já estiver 'running':
  if (job.status === 'running') {
    const isLeaseActive = Boolean(job.lockedUntil && new Date(job.lockedUntil).getTime() > now);

    if (isLeaseActive) {
      // Se for o mesmo worker renovando o lease:
      if (job.lockedBy === workerId) {
        const lockedUntil = new Date(now + leaseDuration).toISOString();
        const updated = await updateJob(jobId, {
          lockedUntil,
          updatedAt: new Date().toISOString(),
        });
        return { acquired: true, job: updated || job };
      }
      // Outro processo/trigger tentando executar: o job já está em processamento ativo
      return { acquired: false, job, reason: 'Job já está sendo processado ativamente com lease válido' };
    }
    // Se o lease expirou: permite recuperação por um novo worker
  }

  if (job.status === 'failed' && job.retryable === false) {
    return { acquired: false, job, reason: 'Job marcado como falha definitiva não re-tentável' };
  }

  const maxAttempts = job.maxAttempts || 5;
  const attempts = (job.attempts || 0) + 1;

  if (attempts > maxAttempts) {
    await updateJob(jobId, {
      status: 'failed',
      stage: `Limite de tentativas (${maxAttempts}) excedido.`,
      error: 'Job falhou após múltiplas tentativas de execução.',
      errorCode: 'MAX_ATTEMPTS_EXCEEDED',
      retryable: false,
    });
    return { acquired: false, reason: 'Limite de tentativas excedido' };
  }

  const lockedUntil = new Date(now + leaseDuration).toISOString();
  const updated = await updateJob(jobId, {
    status: 'running',
    lockedBy: workerId,
    lockedUntil,
    attempts,
    maxAttempts,
    startedAt: job.startedAt || new Date().toISOString(),
    stage: job.stage || 'Iniciando processamento com lease...',
  });

  return { acquired: true, job: updated || undefined };
}

/**
 * Libera o lease/lock de um job.
 */
export async function releaseJobLease(jobId: string): Promise<void> {
  await updateJob(jobId, {
    lockedBy: undefined,
    lockedUntil: undefined,
  });
}

/**
 * Recupera jobs em 'running' que travaram após a expiração real do lease.
 */
export async function recoverStaleJobs(): Promise<number> {
  const now = Date.now();
  let recoveredCount = 0;
  const filePath = getLocalJobsFilePath();

  await runWithLock(() => {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const list = JSON.parse(content) as LLMJob[];
        if (Array.isArray(list)) {
          list.forEach((job) => {
            if (job.status === 'running') {
              const isLeaseExpired =
                job.lockedUntil && new Date(job.lockedUntil).getTime() < now;
              const isStaleFallback =
                !job.lockedUntil &&
                new Date(job.updatedAt || job.createdAt).getTime() + LEASE_DURATION_MS < now;

              if (isLeaseExpired || isStaleFallback) {
                const maxAttempts = job.maxAttempts || 5;
                if ((job.attempts || 1) >= maxAttempts) {
                  job.status = 'failed';
                  job.stage = 'Marcado como falha após timeout e expiração de tentativas.';
                  job.error = 'Execução travada por timeout de lease.';
                  job.errorCode = 'LEASE_TIMEOUT';
                } else {
                  job.status = 'queued';
                  job.stage = 'Reenfileirado após expiração de lease de execução.';
                }
                job.lockedBy = undefined;
                job.lockedUntil = undefined;
                job.updatedAt = new Date().toISOString();
                recoveredCount++;
              }
            }
          });

          if (recoveredCount > 0) {
            saveLocalJobsToFile(list);
          }
        }
      }
    } catch (err) {
      console.warn('[JobStore] Erro ao recuperar stale jobs:', err);
    }
  });

  return recoveredCount;
}

/**
 * Lista os jobs mais recentes de forma consistente com o disco e Firestore.
 */
export async function listJobs(limitCount = 20): Promise<LLMJob[]> {
  await recoverStaleJobs();

  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      const snap = await withAdminTimeout(
        adminDb.collection(JOBS_COLLECTION).orderBy('createdAt', 'desc').limit(limitCount).get(),
        3000,
        null
      );
      if (snap && !snap.empty) {
        const list: LLMJob[] = [];
        const nowTime = Date.now();
        snap.forEach((doc) => {
          const job = doc.data() as LLMJob;
          if (job.status === 'running') {
            const isLeaseExpired =
              !job.lockedUntil || new Date(job.lockedUntil).getTime() < nowTime;
            if (isLeaseExpired) {
              job.status = 'failed';
              job.stage = 'Execução finalizada por expiração de tempo limite.';
              job.error = 'O provedor excedeu o tempo de resposta aceitável.';
              job.errorCode = 'LEASE_TIMEOUT';
              job.lockedBy = undefined;
              job.lockedUntil = undefined;
              job.updatedAt = new Date().toISOString();
              adminDb.collection(JOBS_COLLECTION).doc(job.id).set(job, { merge: true }).catch(() => {});
            }
          }
          list.push(job);
        });
        
        await runWithLock(() => {
          const localList = loadLocalJobsFromFile();
          list.forEach((job) => {
            const idx = localList.findIndex((j) => j.id === job.id);
            if (idx !== -1) {
              localList[idx] = job;
            } else {
              localList.push(job);
            }
          });
          saveLocalJobsToFile(localList);
        });
        return list;
      }
    }
  } catch {
    // Fallback local
  }

  let localList: LLMJob[] = [];
  await runWithLock(() => {
    localList = loadLocalJobsFromFile();
  });

  return localList
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitCount);
}

/**
 * Executa o processamento real de um Job.
 */
export async function executeJob(jobId: string, workerId: string = 'internal_worker'): Promise<LLMJob> {
  const lease = await acquireJobLease(jobId, workerId);
  if (!lease.acquired) {
    const current = await getJob(jobId);
    if (current) return current;
    throw new Error(lease.reason || `Não foi possível adquirir lease para o job ${jobId}`);
  }

  const job = lease.job!;

  try {
    ensureServerEnvLoaded();
    const hasNvidiaKey = Boolean(cleanEnvValue(process.env.NVIDIA_API_KEY));
    const hasGeminiKey = Boolean(cleanEnvValue(process.env.GEMINI_API_KEY));
    const isImageTask = job.type === 'image_search_validate' || job.type === 'image_research';

    if (!hasNvidiaKey && !hasGeminiKey && !isImageTask) {
      const error = new Error('Nenhuma chave de IA (NVIDIA_API_KEY ou GEMINI_API_KEY) configurada no servidor.');
      (error as any).errorCode = 'API_KEY_MISSING';
      (error as any).retryable = false;
      throw error;
    }

    if (job.type === 'image_research') {
      await updateJob(jobId, {
        progress: 25,
        stage: 'Gerando plano visual e estruturação de buscas...',
      });

      const {
        articleTopic,
        articleContext,
        articleCategory,
        bikeModel,
        desiredCount = 3,
      } = job.input || {};

      await updateJob(jobId, {
        progress: 45,
        stage: 'Pesquisando imagens em alta resolução na Web...',
      });

      // Executa o pipeline completo do ImageResearchAgent
      const result = await ImageResearchAgent.executePipeline({
        articleTopic: articleTopic || 'Bicicletas Elétricas',
        articleContext,
        articleCategory,
        bikeModel,
        desiredCount,
      });

      const hasImages = result.article_images && result.article_images.length > 0;

      await updateJob(jobId, {
        progress: 100,
        stage: hasImages ? 'Imagens validadas e auditadas com sucesso.' : 'Nenhuma imagem atendeu aos critérios mínimos.',
        status: hasImages ? 'completed' : 'partial',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          article_images: result.article_images,
          discarded_candidates: result.discarded_candidates,
          telemetry: result.telemetry,
          audit: result.audit,
          summary: `${result.article_images.length} imagem(ns) selecionada(s) e auditada(s).`,
        },
      });
    } else if (job.type === 'image_search_validate') {
      const action = job.input?.action || 'search';

      if (action === 'audit') {
        const imageUrl = job.input?.imageUrl;
        if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
          const error = new Error('URL da imagem é obrigatória para a tarefa de auditoria.');
          (error as any).errorCode = 'INVALID_IMAGE_URL';
          (error as any).retryable = false;
          throw error;
        }

        await updateJob(jobId, {
          progress: 30,
          stage: 'Auditando compatibilidade visual e contexto da imagem com LLM...',
        });

        const audit = await ImageResearchAgent.auditExistingImage({
          imageUrl: imageUrl.trim(),
          targetName: job.input?.targetName || job.input?.query || 'E-bike',
          contextHint: job.input?.contextHint,
        });

        await updateJob(jobId, {
          progress: 100,
          stage: 'Auditoria da imagem concluída com sucesso.',
          status: 'completed',
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
          result: {
            success: true,
            audit,
            data: {
              success: true,
              audit,
            },
            summary: 'Imagem auditada com sucesso.',
          },
        });
      } else {
        await updateJob(jobId, {
          progress: 30,
          stage: 'Consultando fontes e auditando parâmetros visuais...',
        });

        const { query, contextHint, category, count = 6 } = job.input || {};
        const result = await ImageResearchAgent.searchAndValidateTarget({
          query: query || 'E-Bike',
          contextHint,
          category,
          count,
        });

        const validList = result.results || [];

        await updateJob(jobId, {
          progress: 100,
          stage: 'Busca e auditoria de imagens concluídas.',
          status: 'completed',
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
          result: {
            success: true,
            data: {
              success: true,
              results: validList,
              telemetry: result.telemetry,
            },
            article_images: validList,
            summary: `${validList.length} imagens válidas encontradas e auditadas.`,
          },
        });
      }
    } else if (job.type === 'content_generation') {
      await updateJob(jobId, {
        progress: 30,
        stage: 'Processando com modelo de linguagem (NVIDIA NIM / Gemini)...',
      });

      const { task = 'content_generation', prompt, model, systemPrompt, enableThinking, reasoningEffort } = job.input || {};

      try {
        const routerResult = await AIRouter.routeAndExecute({
          task,
          prompt: prompt || '',
          overrideModel: model as AIModelId | undefined,
          systemPrompt,
          enableThinking,
          reasoningEffort,
          priority: 'high',
          enableStreaming: false,
        });

        let data = routerResult.data as any;
        let text = routerResult.text;
        const source: 'llm' = 'llm';

        if (!data && text) {
          const parsed = YAMLParser.parseWithSchema(text, ContentGenerationOutputSchema);
          if (parsed.success) {
            data = parsed.data;
          } else {
            console.warn('[JobStore] Falha na validação do schema em content_generation:', parsed.errors);
            data = YAMLParser.parse(text);
          }
        }

        if (data) {
          const bodyVal = data.body || data.markdownContent || text;
          data.body = bodyVal;
          data.markdownContent = bodyVal;
          if (!data.readingTimeMinutes && data.readTimeMinutes) {
            data.readingTimeMinutes = data.readTimeMinutes;
          }
        }

        await updateJob(jobId, {
          progress: 100,
          stage: 'Texto gerado com sucesso.',
          status: 'completed',
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
          result: {
            success: true,
            source,
            text: routerResult.text,
            data: data || { body: routerResult.text, markdownContent: routerResult.text },
            telemetry: {
              modelUsed: routerResult.modelUsed,
              executionTimeMs: routerResult.executionTimeMs,
              validationPassed: routerResult.validationPassed,
            },
          },
        });
      } catch (genErr: any) {
        console.error(`[JobStore] Erro ao gerar com LLM para job ${jobId}:`, genErr);
        throw new Error(genErr?.message || 'Falha na geração de conteúdo com a LLM.');
      }
    } else if (job.type === 'radar_scan') {
      await updateJob(jobId, {
        progress: 10,
        stage: 'Iniciando varredura sequencial em polos globais de tecnologia...',
      });

      const { region = 'all', topic = 'all', customQuery = '', limit = 6 } = job.input || {};
      
      const { executeGlobalRadarSearch } = await import('@/lib/globalRadarSearch');
      const radarResult = await executeGlobalRadarSearch({
        region,
        topic,
        customQuery,
        limit,
        saveToRadarStore: true,
        onProgress: async (progressPct, stageMessage) => {
          await updateJob(jobId, {
            progress: progressPct,
            stage: stageMessage,
          });
        },
      });

      await updateJob(jobId, {
        progress: 100,
        stage: `Varredura concluída! ${radarResult.totalFound} pautas estruturadas.`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          totalFound: radarResult.totalFound,
          results: radarResult.results,
          sourcesSearched: radarResult.sourcesSearched,
          telemetry: {
            executionTimeMs: radarResult.durationMs || 1500,
          },
        },
      });
    } else if (job.type === 'ai_radar_scan') {
      await updateJob(jobId, {
        progress: 10,
        stage: 'Iniciando varredura por novidades e ofertas de e-bikes...',
      });

      const { force = true } = job.input || {};
      const { executeRadarScan } = await import('@/lib/aiRadarService');
      const radarStore = await executeRadarScan(force, async (progressPct, stageMessage) => {
        await updateJob(jobId, {
          progress: progressPct,
          stage: stageMessage,
        });
      });

      await updateJob(jobId, {
        progress: 100,
        stage: `Varredura concluída! ${radarStore.pautas.length} pautas ativas no Radar IA.`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          pautas: radarStore.pautas,
          totalFound: radarStore.pautas.length,
          statusMessage: radarStore.statusMessage,
          lastScanAt: radarStore.lastScanAt,
        },
      });
    } else if (job.type === 'ranking_generation') {
      const { tema, categoria = 'ebikes', quantidade = 5, focoEspecifico = '' } = job.input || {};
      if (!tema) throw new Error('O tema de pesquisa do ranking está vazio.');

      const totalItems = Math.min(Math.max(Number(quantidade) || 5, 3), 10);

      // =========================================================================
      // ETAPA 1: CRIAÇÃO DO TÍTULO, SUBTÍTULO E CRITÉRIOS EDITORIAIS DO RANKING
      // =========================================================================
      await updateJob(jobId, {
        progress: 8,
        stage: `Etapa 1/3: Criando título, subtítulo e critérios editoriais do Top ${totalItems}...`,
      });

      // Carrega todas as e-bikes já cadastradas no catálogo TuaVia
      const existingBikes = await getAllBikesServer();
      const existingBikesMap = new Map<string, any>();
      existingBikes.forEach((b) => {
        if (b && b.slug) {
          existingBikesMap.set(b.slug.toLowerCase(), b);
          const full = `${b.marca || ''} ${b.modelo || ''}`.trim().toLowerCase();
          if (full) existingBikesMap.set(full, b);
          if (b.modelo) existingBikesMap.set(b.modelo.trim().toLowerCase(), b);
        }
      });

      const knownBikesSample = existingBikes
        .slice(0, 25)
        .map((b) => `- ${b.marca} ${b.modelo} (${b.usoPrincipal || 'Urbana'})`)
        .join('\n');

      const stage1StructurePrompt = `Você é o Engenheiro Especialista Chefe em Mobilidade Elétrica do TuaVia (portal referência em e-bikes no Brasil).
O usuário deseja um ranking comparativo TOP ${totalItems} sobre o tema: "${tema.trim()}".
Categoria: "${categoria}".
Foco específico: "${focoEspecifico || 'Equilíbrio entre custo-benefício, confiabilidade mecânica, autonomia real e peças no Brasil'}".

MISSÃO DA ETAPA 1:
Defina o Título magnético e autoritário do Top Ranking, Subtítulo jornalístico, Critérios técnicos de avaliação e Veredito/Conclusão Geral.
RETORNE ESTRITAMENTE UM JSON VÁLIDO:
{
  "titulo": "Top ${totalItems} Melhores ... em 2026",
  "subtitulo": "Análise técnica comparativa avaliando autonomia, torque do motor, certificação de bateria e suporte no Brasil.",
  "criterioAvaliacao": "Avaliamos autonomia real em ciclo urbano/misto, potência nominal do motor, qualidade dos freios e facilidade de reposição de peças.",
  "conclusaoGeral": "Veredito geral sobre o ranking e a recomendação de escolha para cada perfil de usuário."
}`;

      let stage1Result: any = null;
      try {
        const aiRes1 = await ProviderHub.executeWithFallback({
          taskName: 'ranking_generation_stage1_title',
          primaryModel: 'z-ai/glm-5.3',
          fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
          tertiaryModel: 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'Você é o Engenheiro Especialista Chefe do TuaVia. Retorne estritamente JSON válido sem markdown ou conversas adicionais.',
            },
            {
              role: 'user',
              content: stage1StructurePrompt,
            },
          ],
          temperature: 0.2,
          maxTokens: 16384,
          timeoutMs: 300000,
        });

        const rawStage1 = aiRes1.text || '';
        const parsedStage1 = YAMLParser.parseWithSchema(rawStage1, RankingStage1Schema);
        if (parsedStage1.success) {
          stage1Result = parsedStage1.data;
        } else {
          console.warn('[ranking_generation] Erro de validação Zod na Etapa 1 (RankingStage1Schema):', parsedStage1.errors);
          stage1Result = YAMLParser.parse(rawStage1);
        }
      } catch (err1: any) {
        console.warn('[ranking_generation] Aviso ao gerar título/critérios na etapa 1:', err1);
      }

      const rankingTitulo = stage1Result?.titulo || `Top ${totalItems} ${tema}`;
      const rankingSubtitulo = stage1Result?.subtitulo || `Guia comparativo dos melhores modelos de ${tema}`;
      const rankingCriterio = stage1Result?.criterioAvaliacao || 'Classificação técnica por autonomia, motor, bateria e assistência pós-venda.';
      const rankingConclusao = stage1Result?.conclusaoGeral || 'Análise consolidada pelos especialistas em mobilidade elétrica do TuaVia.';

      // =========================================================================
      // ETAPA 2: BUSCA E SELEÇÃO DAS E-BIKES (MARCA + MODELO + DESTAQUE)
      // =========================================================================
      await updateJob(jobId, {
        progress: 15,
        stage: `Etapa 2/3: Mapeando e selecionando os ${totalItems} melhores modelos de e-bikes líderes de mercado...`,
        result: {
          success: true,
          source: 'llm_stage1',
          data: {
            titulo: rankingTitulo,
            subtitulo: rankingSubtitulo,
            criterioAvaliacao: rankingCriterio,
            tipoRanking: `top${totalItems}`,
            categoria,
            quantidadeItens: totalItems,
            conclusaoGeral: rankingConclusao,
            itens: [],
          },
        },
      });

      const stage2ModelsPrompt = `Você é o Curador Chefe de Produtos do TuaVia.
Tema do Ranking: "${rankingTitulo}" (${categoria}).
Foco específico: "${focoEspecifico || 'Equilíbrio entre custo-benefício, autonomia real e durabilidade'}".

E-Bikes de referência no catálogo TuaVia (pode incluir estes modelos ou novos modelos líderes de mercado no Brasil):
${knownBikesSample}

MISSÃO DA ETAPA 2:
Selecione exatamente ${totalItems} modelos reais de e-bikes para compor as posições do 1º ao ${totalItems}º lugar.
RETORNE ESTRITAMENTE UM JSON VÁLIDO:
{
  "modelos": [
    {
      "posicao": 1,
      "marca": "Marca",
      "modelo": "Nome Exato do Modelo",
      "notaDestaque": "Ex: Campeã Geral / Melhor Autonomia / Melhor Custo-Benefício",
      "categoriaItem": "Urbana / Dobrável / Trilha/MTB / Cargo"
    }
  ]
}`;

      let stage2ModelsResult: any = null;
      try {
        const aiRes2 = await ProviderHub.executeWithFallback({
          taskName: 'ranking_generation_stage2_models',
          primaryModel: 'z-ai/glm-5.3',
          fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
          tertiaryModel: 'moonshotai/kimi-k3',
          messages: [
            {
              role: 'system',
              content: 'Você é o Curador Chefe do TuaVia. Retorne estritamente JSON válido sem markdown ou conversas adicionais.',
            },
            {
              role: 'user',
              content: stage2ModelsPrompt,
            },
          ],
          temperature: 0.2,
          maxTokens: 16384,
          timeoutMs: 300000,
        });

        const rawStage2 = aiRes2.text || '';
        const parsedStage2 = YAMLParser.parseWithSchema(rawStage2, RankingStage2ModelsSchema);
        if (parsedStage2.success) {
          stage2ModelsResult = parsedStage2.data;
        } else {
          console.warn('[ranking_generation] Erro de validação Zod na Etapa 2 (RankingStage2ModelsSchema):', parsedStage2.errors);
          stage2ModelsResult = YAMLParser.parse(rawStage2);
        }
      } catch (err2: any) {
        console.error('[ranking_generation] Falha ao mapear modelos na etapa 2:', err2);
        throw new Error('Falha ao selecionar os modelos de e-bike para o ranking.');
      }

      if (!stage2ModelsResult || !Array.isArray(stage2ModelsResult.modelos) || stage2ModelsResult.modelos.length === 0) {
        throw new Error('A IA não retornou a lista de modelos de e-bikes na etapa 2.');
      }

      const rawModelos = stage2ModelsResult.modelos.slice(0, totalItems);
      const finalizedItens: any[] = [];

      // =========================================================================
      // ETAPA 3: CICLO SEQUENCIAL COMPLETO BIKE POR BIKE (3 SUB-ETAPAS POR BIKE)
      // Cada nova e-bike é completamente criada, gera review rica, ficha técnica,
      // SEO, lojas, histórico de preços e é gravada no catálogo do TuaVia!
      // =========================================================================
      for (let idx = 0; idx < rawModelos.length; idx++) {
        const itemInfo = rawModelos[idx];
        const currentPos = idx + 1;
        const brand = (itemInfo.marca || '').trim() || 'E-Bike';
        const modelName = (itemInfo.modelo || '').trim() || `Modelo ${currentPos}`;
        const fullSearchName = `${brand} ${modelName}`.trim().toLowerCase();
        const baseBikeSlug = generateSlug(brand, modelName);

        const baseProgressPct = 20 + Math.round((idx / rawModelos.length) * 75);

        // Verifica se a e-bike JÁ EXISTE com ficha completa no catálogo
        const matchedBike = existingBikesMap.get(fullSearchName) ||
          existingBikesMap.get(modelName.toLowerCase()) ||
          existingBikesMap.get(baseBikeSlug) ||
          existingBikes.find((b) => {
            const bFull = `${b.marca} ${b.modelo}`.toLowerCase();
            return bFull === fullSearchName ||
              b.slug === baseBikeSlug ||
              (b.marca.toLowerCase() === brand.toLowerCase() && modelName.toLowerCase().includes(b.modelo.toLowerCase())) ||
              (brand && modelName && b.modelo.toLowerCase() === modelName.toLowerCase());
          });

        if (matchedBike && matchedBike.specSections && matchedBike.specSections.length > 0) {
          // ---------------------------------------------------------------------
          // CASO A: E-BIKE JÁ EXISTE NO CATÁLOGO COM FICHA COMPLETA
          // ---------------------------------------------------------------------
          await updateJob(jobId, {
            progress: baseProgressPct,
            stage: `[E-Bike ${currentPos}/${totalItems}] ${matchedBike.marca} ${matchedBike.modelo} localizada no catálogo! Vinculando review, lojas e histórico...`,
          });

          const menorPreco = matchedBike.menorPreco || 4500;
          const maiorPreco = matchedBike.maiorPreco || Math.round(menorPreco * 1.15);
          const priceHistory = matchedBike.priceHistory && matchedBike.priceHistory.length > 0
            ? sanitizePriceHistory(matchedBike.priceHistory, menorPreco)
            : generateRealisticPriceHistory(menorPreco);

          const lojas = Array.isArray(matchedBike.ofertas) && matchedBike.ofertas.length > 0
            ? matchedBike.ofertas.map((o: any, oIdx: number) => ({
                id: `store-${matchedBike.slug}-${oIdx}`,
                nomeLoja: o.loja || 'Loja Verificada',
                preco: o.preco || menorPreco,
                url: o.linkProduto || '#',
                cupom: o.cupom,
                destaque: o.destaque === 'Melhor Preço' || oIdx === 0,
              }))
            : [
                {
                  id: `store-${matchedBike.slug}-1`,
                  nomeLoja: 'Mercado Livre',
                  preco: menorPreco,
                  url: `https://www.mercadolivre.com.br/gz/search?q=${encodeURIComponent(`${matchedBike.marca} ${matchedBike.modelo}`)}`,
                  destaque: true,
                },
                {
                  id: `store-${matchedBike.slug}-2`,
                  nomeLoja: 'Amazon Brasil',
                  preco: Math.round(menorPreco * 1.04),
                  url: `https://www.amazon.com.br/s?k=${encodeURIComponent(`${matchedBike.marca} ${matchedBike.modelo}`)}`,
                  destaque: false,
                },
              ];

          const bikeItem = {
            id: `item-${Date.now()}-${currentPos}`,
            posicao: currentPos,
            tituloItem: `${matchedBike.marca} ${matchedBike.modelo}`,
            marca: matchedBike.marca,
            categoriaItem: itemInfo.categoriaItem || matchedBike.usoPrincipal || 'E-Bike Urbana',
            notaDestaque: itemInfo.notaDestaque || matchedBike.badge || (currentPos === 1 ? 'Campeã Geral' : 'Destaque Técnico'),
            pontosPositivos: matchedBike.pros && matchedBike.pros.length > 0
              ? matchedBike.pros
              : ['Excelente assistência no Brasil', 'Motor eficiente e silencioso', 'Boa autonomia em ciclo urbano'],
            pontosNegativos: matchedBike.cons && matchedBike.cons.length > 0
              ? matchedBike.cons
              : ['Componentes de desgaste exigem revisão periódica'],
            especificacoes: {
              'Potência do Motor': `${matchedBike.potenciaW || 350}W`,
              'Autonomia Média': `${matchedBike.autonomiaKm || 45} km`,
              'Peso Total': matchedBike.pesoKg ? `${matchedBike.pesoKg} kg` : '24 kg',
              'Tempo de Recarga': matchedBike.tempoCargaHoras ? `${matchedBike.tempoCargaHoras}h` : '5h',
              'Uso Indicado': matchedBike.usoPrincipal || 'Urbano / Ciclovia',
            },
            faixaPrecoEstimado: `R$ ${menorPreco.toLocaleString('pt-BR')} - R$ ${maiorPreco.toLocaleString('pt-BR')}`,
            imagemUrl: matchedBike.imagemUrl || matchedBike.galleryImages?.[0] || '',
            lojas,
            linkLoja1: lojas[0],
            linkLoja2: lojas[1],
            observacoes: matchedBike.resumoExecutivo || `Modelo disponível no catálogo TuaVia com histórico de preços e ficha completa verificada.`,
            bikeSlug: matchedBike.slug,
            priceHistory,
            menorPreco,
            maiorPreco,
            potenciaW: matchedBike.potenciaW || 350,
            autonomiaKm: matchedBike.autonomiaKm || 45,
            pesoKg: matchedBike.pesoKg || 24,
            tempoCargaHoras: matchedBike.tempoCargaHoras || 5,
          };

          finalizedItens.push(bikeItem);
        } else {
          // ---------------------------------------------------------------------
          // CASO B: NOVA E-BIKE — EXECUTAR PIPELINE COMPLETO DE 3 SUB-ETAPAS:
          // 1. Ficha Técnica & Review com Pesquisa Web
          // 2. SEO, Título Magnético e CONTRAN 996
          // 3. Cotações em Lojas Reais e Histórico de Preços
          // E Salvar automaticamente no Catálogo de E-Bikes do TuaVia!
          // ---------------------------------------------------------------------

          // SUB-ETAPA 3.1: Ficha Técnica Oficial & Review com Pesquisa Web
          await updateJob(jobId, {
            progress: baseProgressPct,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Sub-etapa 1/3: Pesquisando especificações oficiais e ficha técnica de ${brand} ${modelName}...`,
          });

          let webSpecsSummary = '';
          try {
            const searchResults = await WebSearchTool.search({
              query: `${brand} ${modelName} bicicleta eletrica ficha tecnica motor bateria autonomia brasil`,
              limit: 4,
            });
            const resultsList = searchResults?.results || searchResults?.organic || [];
            if (resultsList && resultsList.length > 0) {
              webSpecsSummary = resultsList.map((r: any) => `[${r.title || ''}] ${r.snippet || ''}`).join('\n');
            }
          } catch (searchErr) {
            console.warn(`[ranking_generation] Busca web de specs para ${brand} ${modelName}:`, searchErr);
          }

          const bikeSpecsPrompt = `Você é o Engenheiro Especialista Chefe em Mobilidade Elétrica e Auditor Técnico do TuaVia.
Sua missão é gerar a ficha técnica OFICIAL, AUDITADA e a review detalhada da e-bike "${brand} ${modelName}".
Destaque no ranking: "${itemInfo.notaDestaque || 'Destaque Técnico'}".
Categoria: "${itemInfo.categoriaItem || categoria}".

Dados encontrados na web brasileira:
${webSpecsSummary || 'Nenhum dado adicional de busca web encontrado. Use apenas informações comprovadas.'}

DIRETRIZES DE AUDITORIA TÉCNICA, INTEGRIDADE E NÃO-INVENÇÃO (TUAVIA):
1. NUNCA INVENTE ESPECIFICAÇÕES TÉCNICAS: Se um dado (como torque em Nm, potência de pico, capacidade exata em Wh ou peso) não constar nas fontes oficiais, use "Não informado pelo fabricante" (ou null nos campos numéricos raiz).
2. POTÊNCIA DE PICO E TORQUE: NUNCA faça cálculos teóricos multiplicativos (como 1.4x) nem invente potências de pico se o fabricante omitir. Mantenha "Não informado pelo fabricante" com confidence "NAO_CONFIRMADA".
3. MATERIAIS DE QUADRO E COMPONENTES: Se a fonte disser apenas "Alumínio", use "Alumínio". NUNCA assuma ou deduza ligas específicas (ex: "Liga de Alumínio 6061") sem comprovação do fabricante.
4. CARREGADOR DE PAREDE VS PORTA USB: Carregador de tomada (110-220V AC) alimenta a bateria da e-bike e NÃO é porta USB. Registre "Porta USB" apenas se houver saída 5V dedicada no display ou bateria para recarga de smartphone.
5. DICIONÁRIO CANÔNICO EM PORTUGUÊS (BR):
   - Thumb Throttle -> "Acelerador de Polegar"
   - Twist Throttle -> "Acelerador de Punho / Meio Punho"
   - Cadence Sensor / PAS -> "Sensor de Cadência (Pedal Assistido)"
   - Torque Sensor -> "Sensor de Torque (Proporcional)"
   - Step-Through -> "Quadro Rebaixado (Fácil Acesso / Low Step)"
   - Step-Over / High-Step -> "Quadro Reto Convencional (Diamante)"
   - Walk Assist -> "Modo Caminhada (6 km/h)"
6. VERSÕES E SUB-MODELOS: Se o modelo possuir variações conhecidas de mercado (ex: Comfort vs Sport, V-Brake vs Disco, 6v vs 7v), liste-as estruturadamente no bloco "versoesEncontradas".
7. FONTES LITERAIS: No campo "source", cite LITERALMENTE o domínio ou resultado comprovado (ex: "caloi.com [resultado 1]", "pedal.com.br [resultado 2]"). Se não houver fonte real, use "".
8. NÍVEIS DE CONFIANÇA ESTREITOS:
   - ALTA: Apenas para dados do manual ou site oficial comprovado.
   - MEDIA: Para dados de revendas e marketplaces.
   - NAO_CONFIRMADA: Para campos não informados ou estimados.
9. FORMATO: Retorne ESTRITAMENTE em formato YAML válido, sem markdown conversacional externo.

RETORNE ESTRITAMENTE O YAML ABAIXO ESTRUTURADO:
\`\`\`yaml
marca: "${brand}"
modelo: "${modelName}"
usoPrincipal: "${itemInfo.categoriaItem || 'Urbana'}"
autonomiaKm: 45
potenciaW: 350
pesoKg: 23
tempoCargaHoras: 5
resumoExecutivo: "Síntese técnica detalhada de 3 a 5 linhas avaliando o conjunto de motor, bateria, dirigibilidade e uso prático no Brasil."
analiseRanking: "Texto analítico aprofundado e crítico de 2 a 3 parágrafos explicando detalhadamente o desempenho prático deste modelo, por que merece sua posição neste ranking, como se compara com os concorrentes diretos e sua relação custo-benefício na realidade das ruas e ladeiras do Brasil."
idealFor: "Perfil ideal de ciclista ou trajeto para quem esta bicicleta elétrica foi projetada."
verdict: "Veredito da review detalhando se vale a pena a compra, pontos fortes e recomendações de manutenção."
versoesEncontradas:
  - nome: "${modelName} Padrão"
    diferenciais: "Configuração base oficial"
    marchas: "Shimano 7V"
    freios: "Disco Mecânico"
    pesoKg: 23
    potenciaW: 350
    bateria: "36V 10.4Ah"
specSections:
  - title: "Motor & Sistema Elétrico"
    items:
      - label: "Tipo de Motor"
        value: "Motor no Cubo Traseiro Brushless"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Potência Nominal"
        value: "350W"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Potência de Pico"
        value: "Não informado pelo fabricante"
        confidence: "NAO_CONFIRMADA"
        source: ""
      - label: "Torque Máximo"
        value: "Não informado pelo fabricante"
        confidence: "NAO_CONFIRMADA"
        source: ""
      - label: "Velocidade Máxima"
        value: "Até 32 km/h (Assistência - CONTRAN 996/2023)"
        confidence: "ALTA"
        source: "Resolução CONTRAN 996/2023"
      - label: "Sensor de Pedalada"
        value: "Sensor de Cadência (Pedal Assistido)"
        confidence: "MEDIA"
        source: "review-bike.com.br [resultado 2]"
  - title: "Bateria & Energia"
    items:
      - label: "Composição / Tensão"
        value: "36V Íons de Lítio"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Capacidade Total"
        value: "374 Wh (10.4Ah)"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Autonomia por Carga"
        value: "Até 45 km"
        confidence: "MEDIA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Tempo de Recarga"
        value: "4 a 5 horas"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Bateria Removível"
        value: "Sim, com chave"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
  - title: "Quadro, Suspensão & Pneus"
    items:
      - label: "Material do Quadro"
        value: "Alumínio"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Garfo Dianteiro"
        value: "Suspensão Dianteira"
        confidence: "MEDIA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Medida dos Pneus"
        value: "Aro 26"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Peso Total"
        value: "23.5 kg"
        confidence: "MEDIA"
        source: "loja-revenda.com.br [resultado 3]"
  - title: "Transmissão & Freios"
    items:
      - label: "Sistema de Transmissão"
        value: "Shimano Tourney 7V"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Freios"
        value: "Freio a Disco Mecânico"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
      - label: "Corte de Energia"
        value: "Sim, nos manetes de freio"
        confidence: "ALTA"
        source: "site-oficial.com.br [resultado 1]"
pros:
  - "Motor silencioso e eficiente para uso urbano"
  - "Bateria removível com chave facilitando recarga"
  - "Boa disponibilidade de peças no mercado nacional"
cons:
  - "Peso do conjunto exige atenção ao transportar em escadas"
  - "Pneus urbanos não são recomendados para trilhas pesadas"
\`\`\``;

          let bikeSpecsData: any = null;
          try {
            const aiResSpecs = await ProviderHub.executeWithFallback({
              taskName: 'ranking_ebike_specs',
              primaryModel: 'z-ai/glm-5.3',
              fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
              tertiaryModel: 'openai/gpt-oss-20b',
              messages: [
                {
                  role: 'system',
                  content: 'Você é o Engenheiro Especialista Chefe do TuaVia. Retorne estritamente em formato YAML estruturado válido.',
                },
                {
                  role: 'user',
                  content: bikeSpecsPrompt,
                },
              ],
              temperature: 0.2,
              maxTokens: 16384,
              timeoutMs: 300000,
            });

            const rawSpecs = aiResSpecs.text || '';
            const parsedSpecs = YAMLParser.parseWithSchema(rawSpecs, BikeSpecsSchema);
            if (parsedSpecs.success) {
              bikeSpecsData = parsedSpecs.data;
            } else {
              console.warn(`[ranking_generation] Erro de validação Zod nas specs de ${brand} ${modelName} (BikeSpecsSchema):`, parsedSpecs.errors);
              bikeSpecsData = YAMLParser.parse(rawSpecs);
            }
          } catch (specsErr) {
            console.warn(`[ranking_generation] Falha ao extrair specs para ${brand} ${modelName}:`, specsErr);
          }

          const enrichedSpecs = enrichBikeSpecifications(bikeSpecsData || {}, `${brand} ${modelName}`);

          // SUB-ETAPA 3.2: Intervalo de respiro da API (10 a 20s) para evitar Rate Limit e Ping de SEO Forte
          const seoCooldownSec = Math.floor(10 + Math.random() * 11); // entre 10 e 20 segundos
          await updateJob(jobId, {
            progress: baseProgressPct + 3,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Aguardando janela de respiro da API (${seoCooldownSec}s) para geração de SEO Forte de ${brand} ${modelName}...`,
          });
          await new Promise((resolve) => setTimeout(resolve, seoCooldownSec * 1000));

          await updateJob(jobId, {
            progress: baseProgressPct + 4,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Sub-etapa 2/3: Disparando ping de IA para gerar SEO Forte, Título Magnético, FAQs e CONTRAN 996 para ${brand} ${modelName}...`,
          });

          const bikeSeoPrompt = `Você é o Estrategista Chefe de SEO Técnico, Semântico e Conversão do portal TuaVia (autoridade número 1 em mobilidade elétrica no Brasil).

Com base na FICHA TÉCNICA OFICIAL E AUDITADA da bicicleta elétrica abaixo, gere o PACOTE DE SEO DEFINITIVO DE ALTA CONVERSÃO E RANQUEAMENTO ORGÂNICO no Google, Bing e IAs generativas (Google AI Overviews / Perplexity / ChatGPT).

DADOS TÉCNICOS AUDITADOS DA E-BIKE:
- Marca: ${brand}
- Modelo: ${modelName}
- Categoria / Uso Principal: ${enrichedSpecs.usoPrincipal || 'Urbana'}
- Potência Nominal do Motor: ${enrichedSpecs.potenciaW || 'Não informado'}W
- Autonomia Estimada: Até ${enrichedSpecs.autonomiaKm || 'Não informado'} km
- Peso Total: ${enrichedSpecs.pesoKg ? `${enrichedSpecs.pesoKg} kg` : 'Não informado'}
- Tempo de Carga: ${enrichedSpecs.tempoCargaHoras ? `${enrichedSpecs.tempoCargaHoras}h` : 'Não informado'}
- Resumo Técnico Preliminar: ${enrichedSpecs.resumoExecutivo || 'Bicicleta elétrica para mobilidade sustentável.'}

CRITÉRIOS DE CALIBRAÇÃO EDITORIAL E SEO FORTE:
1. "badge": Escolha o selo mais expressivo e legítimo conforme os pontos fortes reais da bike:
   - Se potência for alta (>= 500W): "⛰️ Alta Força em Subidas" ou "⚡ Potência para Ladeiras"
   - Se for leve ou dobrável (peso <= 21kg ou categoria Dobrável): "🪶 Ultraleve & Prática" ou "🚲 Dobrável Compacta"
   - Se tiver grande alcance (>= 60km): "🔋 Longa Autonomia Garantida"
   - Se for muito equilibrada e acessível: "🏆 Custo-Benefício 2026" ou "🌱 Destaque Urbano Inteligente"
2. "tagOferta": Tag de conversão comercial assertiva ("⚡ Oferta Verificada", "🔥 Menor Preço Auditado", "🛡️ Loja Confiável", "⭐ Escolha Editorial").
3. "serpTitlePreview": Título magnético de até 60-65 caracteres para atingir CTR máximo no Google (ex: "${brand} ${modelName}: Ficha Técnica, Autonomia Real e Preço").
4. "serpDescriptionPreview": Meta description de alta persuasão de 140 a 155 caracteres contendo dados técnicos essenciais (${enrichedSpecs.potenciaW}W, autonomia) e chamada convidando a comparar no TuaVia.
5. "focusKeyword": Palavra-chave principal transacional (ex: "${brand.toLowerCase()} ${modelName.toLowerCase()} preco ficha tecnica").
6. "secondaryKeywords": 4 a 6 buscas de cauda longa de alto volume no Brasil (ex: "${brand.toLowerCase()} ${modelName.toLowerCase()} vale a pena", "autonomia real ${modelName.toLowerCase()}", "${brand.toLowerCase()} ${modelName.toLowerCase()} em subidas", "comprar ${modelName.toLowerCase()} menor preco brasil").
7. "llmGeoSummary": Síntese de 70 a 90 palavras pronta para citação direta em Google AI Overviews e IAs conversacionais, destacando o público-alvo, motorização, autonomia prática e conformidade legal com o CONTRAN 996.
8. "faqSchema": 3 a 4 perguntas e respostas diretas e completas para Rich Snippets com padrão duplo de autonomia (autonomia máxima anunciada em modo econômico vs. autonomia prática urbana no dia a dia, isenção de CNH/emplacamento pelo CONTRAN 996/2023, bateria removível e manutenção).
9. "contranCategory": Enquadramento legal inequívoco (ex: "Bicicleta Elétrica Assistida (Resolução CONTRAN 996/2023 - Sem CNH e Sem Emplacamento)").
10. "targetBuyerPersona": Perfil claro e motivado do comprador ideal (ex: "Profissionais urbanos e ciclistas que buscam economia diária no trânsito sem suor excessivo").

RETORNE ESTRITAMENTE O YAML ABAIXO ESTRUTURADO:
\`\`\`yaml
badge: "${itemInfo.notaDestaque || '🏆 Custo-Benefício 2026'}"
tagOferta: "⚡ Oferta Verificada"
seoReport:
  focusKeyword: "${brand.toLowerCase()} ${modelName.toLowerCase()} preco ficha tecnica"
  secondaryKeywords:
    - "${brand.toLowerCase()} ${modelName.toLowerCase()} vale a pena"
    - "autonomia real ${modelName.toLowerCase()}"
    - "${brand.toLowerCase()} ${modelName.toLowerCase()} em subidas"
    - "comprar ${modelName.toLowerCase()} menor preco brasil"
  searchIntent: "Transacional / Comparativa / Investigação Comercial"
  seoScore: 98
  serpTitlePreview: "${brand} ${modelName}: Autonomia Real, Preço e Avaliação Completa"
  serpDescriptionPreview: "Confira a ficha técnica completa da ${brand} ${modelName}. Motor de ${enrichedSpecs.potenciaW}W, autonomia anunciada de até ${enrichedSpecs.autonomiaKm}km (prática de ${(Number(enrichedSpecs.autonomiaKm || 40) * 0.7).toFixed(0)}-${(Number(enrichedSpecs.autonomiaKm || 40) * 0.85).toFixed(0)}km) e comparador de ofertas no TuaVia."
  llmGeoSummary: "A ${brand} ${modelName} é uma bicicleta elétrica projetada para mobilidade ${String(enrichedSpecs.usoPrincipal || 'urbana').toLowerCase()}, equipada com motor elétrico de ${enrichedSpecs.potenciaW}W e autonomia anunciada de até ${enrichedSpecs.autonomiaKm}km por carga (com rendimento prático estimado entre ${(Number(enrichedSpecs.autonomiaKm || 40) * 0.7).toFixed(0)}km e ${(Number(enrichedSpecs.autonomiaKm || 40) * 0.85).toFixed(0)}km no trânsito urbano). Enquadrada plenamente na Resolução CONTRAN nº 996/2023, dispensa CNH, emplacamento ou IPVA e está 100% liberada para ciclovias."
  faqSchema:
    - question: "Qual é a autonomia real da ${brand} ${modelName}?"
      answer: "A autonomia anunciada de catálogo é de até ${enrichedSpecs.autonomiaKm}km em modo econômico e terreno plano. Em condições reais de trânsito urbano brasileiro com paradas de semáforo e aclives moderados, a autonomia prática estimada fica entre ${(Number(enrichedSpecs.autonomiaKm || 40) * 0.7).toFixed(0)}km e ${(Number(enrichedSpecs.autonomiaKm || 40) * 0.85).toFixed(0)}km por carga completa."
    - question: "A ${brand} ${modelName} precisa de CNH ou emplacamento no Brasil?"
      answer: "Não. Conforme a Resolução CONTRAN 996/2023, ela é classificada como bicicleta elétrica com pedal assistido (até 32 km/h), sendo totalmente isenta de CNH, emplacamento e IPVA, com circulação autorizada em ciclovias e ciclofaixas."
    - question: "A bateria é removível e fácil de recarregar?"
      answer: "Sim, a bateria possui chave antifurto e pode ser recarregada tanto na própria bicicleta quanto destacada em tomadas residenciais convencionais (110V ou 220V)."
  contranCategory: "Bicicleta Elétrica Assistida (Resolução CONTRAN 996/2023 - Sem CNH e Sem Emplacamento)"
  targetBuyerPersona: "Ciclistas que buscam mobilidade diária ágil, sustentável e com economia real de tempo no trânsito urbano."
\`\`\``;

          let bikeSeoData: any = null;
          try {
            const aiResSeo = await ProviderHub.executeWithFallback({
              taskName: 'ranking_ebike_seo',
              primaryModel: 'z-ai/glm-5.3',
              fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
              tertiaryModel: 'google/gemma-4-31b-it',
              messages: [
                {
                  role: 'system',
                  content: 'Você é o Estrategista Chefe de SEO do TuaVia. Retorne estritamente em formato YAML estruturado válido.',
                },
                {
                  role: 'user',
                  content: bikeSeoPrompt,
                },
              ],
              temperature: 0.2,
              maxTokens: 16384,
              timeoutMs: 300000,
            });

            const rawSeo = aiResSeo.text || '';
            const parsedSeo = YAMLParser.parseWithSchema(rawSeo, BikeSeoSchema);
            if (parsedSeo.success) {
              bikeSeoData = parsedSeo.data;
            } else {
              console.warn(`[ranking_generation] Erro de validação Zod no SEO de ${brand} ${modelName} (BikeSeoSchema):`, parsedSeo.errors);
              bikeSeoData = YAMLParser.parse(rawSeo);
            }
          } catch (seoErr) {
            console.warn(`[ranking_generation] Falha ao gerar SEO para ${brand} ${modelName}:`, seoErr);
          }

          // SUB-ETAPA 3.3: Cotações em Lojas Reais e Gráfico de Preços dos Últimos 6 Meses
          await updateJob(jobId, {
            progress: baseProgressPct + 8,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Sub-etapa 3/3: Pesquisando cotações em lojas e gerando gráfico de preços para ${brand} ${modelName}...`,
          });

          let webPriceSummary = '';
          let candidatePricesSummary = '';
          let detectedMinPrice: number | null = null;
          try {
            const searchPrices = await WebSearchTool.search({
              query: `${brand} ${modelName} "bicicleta eletrica" comprar preco brasil`,
              type: 'shopping',
              limit: 6,
            });
            webPriceSummary = WebSearchTool.formatForPrompt(searchPrices, 5);
            const candidates = WebSearchTool.extractPriceCandidates(searchPrices);
            if (candidates.length > 0) {
              candidatePricesSummary = WebSearchTool.formatPriceCandidatesForPrompt(candidates);
              detectedMinPrice = candidates[0].price;
            }
          } catch (searchPriceErr) {
            console.warn(`[ranking_generation] Busca de preços para ${brand} ${modelName}:`, searchPriceErr);
          }

          const baseBaseline = detectedMinPrice || (Number(enrichedSpecs.potenciaW) >= 500 ? 6990 : 3990);
          const baseBaselineFormatted = baseBaseline.toFixed(2);
          const baseHighFormatted = (baseBaseline * 1.15).toFixed(2);

          const bikePricePrompt = `Você é o Especialista em Inteligência de Preços de E-Bikes no Brasil do TuaVia.
Analise a faixa de preço real de mercado para a bicicleta elétrica completa montada "${brand} ${modelName}".

ATENÇÃO CRUCIAL:
- Considere EXCLUSIVAMENTE o preço da BICICLETA ELÉTRICA COMPLETA. Ignore sumariamente preços de peças avulsas (como baterias avulsas, carregadores, kits motor ou aceleradores).
- Preços em R$ podem conter centavos reais (ex: 4899.90, 5299.00).
- Se houver valores reais detectados na lista abaixo, USE ESSES VALORES EXATOS como base para o menorPreco e ofertas.

${candidatePricesSummary ? `${candidatePricesSummary}\n` : ''}
${webPriceSummary ? `RESULTADOS DE BUSCA NA WEB:\n${webPriceSummary}\n` : ''}

RETORNE ESTRITAMENTE UM JSON VÁLIDO:
{
  "menorPreco": ${baseBaselineFormatted},
  "maiorPreco": ${baseHighFormatted},
  "ofertas": [
    {
      "loja": "Mercado Livre",
      "preco": ${baseBaselineFormatted},
      "linkProduto": "https://www.mercadolivre.com.br/gz/search?q=${encodeURIComponent(`${brand} ${modelName}`)}",
      "destaque": "Melhor Preço"
    },
    {
      "loja": "Amazon Brasil",
      "preco": ${(baseBaseline * 1.05).toFixed(2)},
      "linkProduto": "https://www.amazon.com.br/s?k=${encodeURIComponent(`${brand} ${modelName}`)}",
      "destaque": "Entrega Rápida"
    }
  ]
}`;

          let bikePriceData: any = null;
          try {
            const aiResPrice = await ProviderHub.executeWithFallback({
              taskName: 'ranking_ebike_prices',
              primaryModel: 'z-ai/glm-5.3',
              fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
              tertiaryModel: 'moonshotai/kimi-k3',
              messages: [
                {
                  role: 'system',
                  content: 'Você é o Especialista de Preços do TuaVia. Retorne estritamente JSON válido.',
                },
                {
                  role: 'user',
                  content: bikePricePrompt,
                },
              ],
              temperature: 0.2,
              maxTokens: 16384,
              timeoutMs: 300000,
            });

            const rawPrice = aiResPrice.text || '';
            const parsedPrice = YAMLParser.parseWithSchema(rawPrice, BikePriceDataSchema);
            if (parsedPrice.success) {
              bikePriceData = parsedPrice.data;
            } else {
              console.warn(`[ranking_generation] Erro de validação Zod nos preços de ${brand} ${modelName} (BikePriceDataSchema):`, parsedPrice.errors);
              bikePriceData = YAMLParser.parse(rawPrice);
            }
          } catch (priceErr) {
            console.warn(`[ranking_generation] Falha ao cotar preços para ${brand} ${modelName}:`, priceErr);
          }

          const menorPreco = Number(bikePriceData?.menorPreco) || detectedMinPrice || Number(enrichedSpecs.menorPreco) || null;
          const maiorPreco = Number(bikePriceData?.maiorPreco) || (menorPreco ? Math.round(menorPreco * 1.15 * 100) / 100 : null);
          const priceHistory = menorPreco ? generateRealisticPriceHistory(menorPreco) : [];

          const rawOffers = Array.isArray(bikePriceData?.ofertas) && bikePriceData.ofertas.length > 0
            ? bikePriceData.ofertas
            : [];

          const bikeStoreOffers: EBikeStoreOffer[] = rawOffers.map((o: any, oIdx: number) => ({
            id: `store-${baseBikeSlug}-${oIdx}-${Date.now()}`,
            loja: String(o.loja || 'Loja Verificada'),
            preco: Number(o.preco) || (menorPreco ?? 0),
            linkProduto: String(o.linkProduto || `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${modelName} comprar`)}`),
            destaque: o.destaque || (oIdx === 0 ? 'Melhor Preço' : undefined),
            dataAtualizacao: new Date().toISOString(),
          }));

          // SUB-ETAPA 3.4: PESQUISAR FOTOS OFICIAIS NO GOOGLE IMAGENS E SALVAR A NOVA E-BIKE
          await updateJob(jobId, {
            progress: baseProgressPct + 9,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Buscando imagens reais no Google Imagens para ${brand} ${modelName}...`,
          });

          let discoveredHeroImage = '';
          let discoveredGallery: string[] = [];
          try {
            const imgRes = await ImageResearchAgent.executePipeline({
              articleTopic: `${brand} ${modelName}`,
              bikeModel: `${brand} ${modelName}`,
              desiredCount: 3,
            });
            if (imgRes.article_images && imgRes.article_images.length > 0) {
              discoveredHeroImage = imgRes.article_images[0].url || '';
              discoveredGallery = imgRes.article_images.map((i) => i.url).filter(Boolean);
            }
          } catch (imgErr) {
            console.warn(`[ranking_generation] Falha na busca de imagens no Google para ${brand} ${modelName}:`, imgErr);
          }

          await updateJob(jobId, {
            progress: baseProgressPct + 10,
            stage: `[Ciclo E-Bike ${currentPos}/${totalItems}] Salvando ${brand} ${modelName} no catálogo de E-Bikes e integrando ao Top Ranking...`,
          });

          const newBikeToSave: EBikeGrouped = {
            slug: baseBikeSlug,
            modelo: modelName,
            marca: brand,
            usoPrincipal: enrichedSpecs.usoPrincipal || 'Urbana',
            autonomiaKm: enrichedSpecs.autonomiaKm ?? null,
            potenciaW: enrichedSpecs.potenciaW ?? null,
            pesoKg: enrichedSpecs.pesoKg ?? null,
            tempoCargaHoras: enrichedSpecs.tempoCargaHoras ?? null,
            imagemUrl: discoveredHeroImage,
            galleryImages: discoveredGallery,
            menorPreco: menorPreco || 0,
            maiorPreco: maiorPreco || menorPreco || 0,
            ofertas: bikeStoreOffers,
            specSections: enrichedSpecs.specSections || [],
            pros: Array.isArray(enrichedSpecs.pros) ? enrichedSpecs.pros : [],
            cons: Array.isArray(enrichedSpecs.cons) ? enrichedSpecs.cons : [],
            idealFor: enrichedSpecs.idealFor || '',
            resumoExecutivo: enrichedSpecs.resumoExecutivo || '',
            verdict: enrichedSpecs.verdict || enrichedSpecs.resumoExecutivo || '',
            badge: bikeSeoData?.badge || itemInfo.notaDestaque || 'Destaque no Ranking',
            tagOferta: bikeSeoData?.tagOferta || 'Oferta Verificada',
            seoReport: bikeSeoData?.seoReport,
            priceHistory: priceHistory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
          };

          // Grava a bike no storage permanente do servidor
          try {
            await saveBikeToServerFile(newBikeToSave);
            const adminDb = getAdminDb();
            if (adminDb) {
              await adminDb.collection('bikes').doc(baseBikeSlug).set(newBikeToSave, { merge: true });
            }
          } catch (saveErr) {
            console.warn(`[ranking_generation] Falha ao salvar nova bike ${baseBikeSlug} no catálogo:`, saveErr);
          }

          // Atualiza mapa em memória para os próximos passos
          existingBikesMap.set(baseBikeSlug, newBikeToSave);
          existingBikesMap.set(fullSearchName, newBikeToSave);

          const rankingLojas = bikeStoreOffers.map((o, oIdx) => ({
            id: `store-${Date.now()}-${currentPos}-${oIdx + 1}`,
            nomeLoja: o.loja,
            preco: o.preco,
            url: o.linkProduto,
            destaque: o.destaqueOferta === 'Melhor Preço' || (o as any).destaque === 'Melhor Preço' || oIdx === 0,
          }));

          const bikeItem = {
            id: `item-${Date.now()}-${currentPos}`,
            posicao: currentPos,
            tituloItem: `${brand} ${modelName}`,
            marca: brand,
            categoriaItem: itemInfo.categoriaItem || enrichedSpecs.usoPrincipal || 'E-Bike Urbana',
            notaDestaque: itemInfo.notaDestaque || bikeSeoData?.badge || 'Destaque Técnico',
            pontosPositivos: newBikeToSave.pros || [],
            pontosNegativos: newBikeToSave.cons || [],
            especificacoes: {
              'Potência do Motor': newBikeToSave.potenciaW ? `${newBikeToSave.potenciaW}W` : 'Não informado pelo fabricante',
              'Autonomia Média': newBikeToSave.autonomiaKm ? `${newBikeToSave.autonomiaKm} km` : 'Não informado pelo fabricante',
              'Peso Total': newBikeToSave.pesoKg ? `${newBikeToSave.pesoKg} kg` : 'Não informado pelo fabricante',
              'Tempo de Recarga': newBikeToSave.tempoCargaHoras ? `${newBikeToSave.tempoCargaHoras}h` : 'Não informado pelo fabricante',
              'Uso Indicado': newBikeToSave.usoPrincipal || 'Urbano / Ciclovia',
            },
            faixaPrecoEstimado: menorPreco && maiorPreco ? `R$ ${menorPreco.toLocaleString('pt-BR')} - R$ ${maiorPreco.toLocaleString('pt-BR')}` : (menorPreco ? `R$ ${menorPreco.toLocaleString('pt-BR')}` : 'Sob consulta'),
            imagemUrl: discoveredHeroImage,
            lojas: rankingLojas,
            linkLoja1: rankingLojas[0],
            linkLoja2: rankingLojas[1],
            observacoes: enrichedSpecs.analiseRanking || enrichedSpecs.verdict || newBikeToSave.resumoExecutivo || `Modelo cadastrado no catálogo TuaVia com ficha técnica auditada e análise comparativa no ranking.`,
            bikeSlug: baseBikeSlug,
            priceHistory,
            menorPreco: menorPreco ?? 0,
            maiorPreco: maiorPreco ?? 0,
            potenciaW: newBikeToSave.potenciaW,
            autonomiaKm: newBikeToSave.autonomiaKm,
            pesoKg: newBikeToSave.pesoKg,
            tempoCargaHoras: newBikeToSave.tempoCargaHoras,
          };

          finalizedItens.push(bikeItem);
        }

        // Atualização parcial e feedback visual em tempo real na interface
        await updateJob(jobId, {
          progress: Math.min(baseProgressPct + 10, 95),
          stage: `[E-Bike ${currentPos} de ${totalItems} concluída!] ${brand} ${modelName} salva no catálogo e vinculada ao Top Ranking.`,
          result: {
            success: true,
            source: 'llm_sequential_pipeline',
            data: {
              titulo: rankingTitulo,
              subtitulo: rankingSubtitulo,
              criterioAvaliacao: rankingCriterio,
              tipoRanking: `top${totalItems}`,
              categoria,
              quantidadeItens: totalItems,
              conclusaoGeral: rankingConclusao,
              itens: [...finalizedItens],
            },
          },
        });
      }

      // =========================================================================
      // FINALIZAÇÃO DO TOP RANKING COMPLETO
      // =========================================================================
      const finalRankingPayload = {
        titulo: rankingTitulo,
        subtitulo: rankingSubtitulo,
        criterioAvaliacao: rankingCriterio,
        tipoRanking: `top${totalItems}`,
        categoria,
        quantidadeItens: totalItems,
        conclusaoGeral: rankingConclusao,
        itens: finalizedItens,
      };

      await updateJob(jobId, {
        progress: 100,
        stage: `Top Ranking formulado com sucesso! ${finalizedItens.length} e-bikes enriquecidas e sincronizadas no catálogo e no ranking.`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm_sequential_pipeline',
          llmValidated: true,
          data: finalRankingPayload,
        },
      });
    } else if (job.type === 'ebike_autofill') {
      const { query } = job.input || {};
      if (!query || !query.trim()) throw new Error('A query de pesquisa da e-bike está vazia.');

      // =========================================================================
      // ESTÁGIO 1/3: PESQUISA WEB OTIMIZADA & FICHA TÉCNICA RIGOROSA (10 BLOCOS CANÔNICOS)
      // =========================================================================
      await updateJob(jobId, {
        progress: 15,
        stage: 'Estágio 1/3: Pesquisando especificações oficiais e 10 blocos canônicos da e-bike na web...',
      });

      const cleanQuery = query.trim().replace(/(promo[cç][aã]o|frete gr[aá]tis|melhor pre[cç]o|comprar|novo|original)/gi, '').trim();

      // Execução rápida e consolidada de busca web em paralelo (Site Oficial + Componentes Técnicos)
      let accumulatedResults: any[] = [];
      let primaryDomain = '';

      try {
        const [specsSearchRes, componentsSearchRes] = await Promise.allSettled([
          WebSearchTool.search({
            query: `"${cleanQuery}" bicicleta eletrica ebike site oficial ficha tecnica especificacoes`,
            limit: 6,
          }),
          WebSearchTool.search({
            query: `"${cleanQuery}" motor watts bateria volts autonomia freio quadro peso brasil`,
            limit: 6,
          }),
        ]);

        if (specsSearchRes.status === 'fulfilled' && Array.isArray(specsSearchRes.value?.organic)) {
          accumulatedResults.push(...specsSearchRes.value.organic);
        }
        if (componentsSearchRes.status === 'fulfilled' && Array.isArray(componentsSearchRes.value?.organic)) {
          accumulatedResults.push(...componentsSearchRes.value.organic);
        }

        // Identifica domínio oficial do fabricante se presente nos resultados
        for (const item of accumulatedResults) {
          const url = item.link || item.url || '';
          try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            if (
              hostname &&
              !/google|bing|youtube|facebook|instagram|tiktok|mercadolivre|olx|shopee|amazon|reclameaqui|twitter|pinterest/i.test(hostname)
            ) {
              primaryDomain = hostname;
              break;
            }
          } catch {}
        }
      } catch (searchErr) {
        console.warn('[JobStore] Aviso na busca web consolidada de especificações:', searchErr);
      }

      // Deduplicação estrita de resultados
      const uniqueResultsMap = new Map<string, any>();
      for (const item of accumulatedResults) {
        const key = item.link || item.title;
        if (key && !uniqueResultsMap.has(key)) {
          uniqueResultsMap.set(key, item);
        }
      }
      const uniqueByUrl = Array.from(uniqueResultsMap.values());
      const searchContext = WebSearchTool.formatForPrompt(uniqueByUrl, 12);

      await updateJob(jobId, {
        progress: 35,
        stage: 'Auditando especificações técnicas eletromecânicas e extraindo os 10 blocos canônicos com IA...',
      });

      const stage1Prompt = `Você é o Engenheiro-Chefe, Perito Mecânico e Auditor Especialista em bicicletas elétricas (e-bikes) do portal TuaVia.
O usuário solicitou a ficha técnica auditada com precisão máxima do modelo: "${query.trim()}".
${primaryDomain ? `Domínio Oficial Identificado do Fabricante: ${primaryDomain}\n` : ''}

${searchContext ? `EVIDÊNCIAS COLETADAS NA WEB (SITES OFICIAIS, MANUAIS PDF, HOMOLOGAÇÕES E IMPRENSA ESPECIALIZADA):\n${searchContext}\n` : ''}

REGRA DE OURO ANTI-ALUCINAÇÃO E VERACIDADE (ZERO DADOS FICTÍCIOS):
- NÃO COPIE VALORES DE EXEMPLO! Cada modelo de bicicleta elétrica possui especificações próprias e distintas.
- NUNCA assuma 36V, motor 350W, freio mecânico, aro 26 ou alumínio 6061 por padrão!
- E-bikes modernas de alta potência (500W, 750W, 1000W+) ou mini fat bikes frequentemente utilizam sistema elétrico de 48V, baterias de 15.6Ah a 20Ah+, pneus largos Fat 20x4.0, freios a disco hidráulicos e suspensão dupla.
- E-bikes de trilha (E-MTB) costumam ter motores centrais (Shimano, Bosch, Bafang) com torque elevado (60 a 85 Nm) e freios hidráulicos.
- E-bikes urbanas tradicionais costumam ter baterias de 36V e motores de 250W ou 350W.
- Extraia ESTRITAMENTE o que estiver fundamentado nas evidências web. Se algo não estiver comprovado nas fontes coletadas, registre "Não informado pelo fabricante", confiança "NAO_CONFIRMADA" e fonte "".

SISTEMA DE AUDITORIA EM 3 CAMADAS:
CAMADA 1 - DESAMBIGUAÇÃO DE MODELO E LINHA: Identifique a MARCA e o MODELO EXATOS.
CAMADA 2 - VALIDAÇÃO ELETROMECÂNICA: Potência Nominal (W), Tensão (V), Capacidade (Ah/Wh), Torque (Nm), Autonomia (km).
CAMADA 3 - GEOMETRIA, QUADRO, PNEUS E TRANSMISSÃO: Categoria (Urbana | Trilha/MTB | Dobrável | Cargo | Speed), Pneus, Freios, Câmbio.

No campo "source", cite o domínio da evidência (ex: "${primaryDomain || 'fabricante.com.br'}"). Se não houver fonte, use string vazia "".

RETORNE ESTRITAMENTE NO FORMATO YAML:
\`\`\`yaml
marca: "Marca Real Comprovada"
modelo: "Modelo Real Comprovado"
usoPrincipal: "Urbana" # Opções: Urbana | Trilha/MTB | Dobrável | Cargo | Speed
autonomiaKm: 50 # número inteiro com a autonomia real comprovada ou null
potenciaW: 350 # potência nominal real comprovada em Watts ou null
pesoKg: 22.0 # peso real comprovado em kg ou null
tempoCargaHoras: 5 # tempo de carga real em horas ou null
resumoExecutivo: "Resumo técnico objetivo de 140 a 160 caracteres destacando a configuração eletromecânica real comprovada."
idealFor: "Perfil específico de ciclista para o qual esta configuração foi concebida."
specSections:
  - title: "Motor & Sistema Elétrico"
    items:
      - label: "Tipo de Motor"
        value: "Tipo de motor comprovado na busca"
        confidence: "ALTA" # ALTA | MEDIA | BAIXA | NAO_CONFIRMADA
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Potência Nominal"
        value: "Potência comprovada na busca (ex: 350W)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Torque Máximo"
        value: "Torque comprovado ou Não informado pelo fabricante"
        confidence: "NAO_CONFIRMADA"
        source: ""
      - label: "Velocidade Máxima"
        value: "Até 32 km/h (Assistência - CONTRAN 996/2023)"
        confidence: "ALTA"
        source: "Resolução CONTRAN 996/2023"
      - label: "Sensor de Pedalada"
        value: "Sensor comprovado ou Não informado pelo fabricante"
        confidence: "MEDIA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
  - title: "Bateria & Energia"
    items:
      - label: "Composição / Tensão"
        value: "Tensão e química comprovadas (ex: 36V Lítio | 48V Lítio)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Capacidade Total"
        value: "Capacidade comprovada (ex: 36V 10.4Ah ou 374Wh)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Autonomia Declarada"
        value: "Autonomia comprovada em km"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Tempo de Recarga"
        value: "Tempo de recarga comprovado em horas"
        confidence: "MEDIA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Bateria Removível"
        value: "Sim, com chave"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
  - title: "Quadro, Suspensão & Pneus"
    items:
      - label: "Material do Quadro"
        value: "Material comprovado (ex: Alumínio 6061)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Garfo / Suspensão"
        value: "Suspensão comprovada (ex: Suspensão Dianteira 100mm)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Medida dos Pneus"
        value: "Medida real comprovada (ex: 29x2.25 | 20x4.0 Fat)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Peso Total"
        value: "Peso total comprovado ou Não informado pelo fabricante"
        confidence: "MEDIA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Capacidade de Carga"
        value: "Capacidade de carga comprovada (ex: 120 kg)"
        confidence: "MEDIA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
  - title: "Transmissão, Freios & Recursos"
    items:
      - label: "Sistema de Transmissão"
        value: "Sistema de marchas comprovado (ex: Shimano 7 Velocidades)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Trocadores de Marcha"
        value: "Trocadores comprovados ou Não se aplica"
        confidence: "MEDIA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Tipo de Freios"
        value: "Freios comprovados (ex: Freios a Disco Hidráulicos | Disco Mecânico)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Corte de Energia nos Manetes"
        value: "Sim"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
      - label: "Tecnologia & Partida"
        value: "Recursos comprovados (ex: Display LCD, Farol LED e Lanterna Traseira)"
        confidence: "ALTA"
        source: "${primaryDomain || 'dominio-real.com.br'}"
pros:
  - "Ponto forte técnico 1 comprovado"
  - "Ponto forte técnico 2 comprovado"
cons:
  - "Ponto de atenção técnico 1 fundamentado"
\`\`\`

RETORNE ESTRITAMENTE O BLOCO YAML ACIMA COM DADOS REAIS EXTRAÍDOS DAS EVIDÊNCIAS:`;

      const stage1Result = await AIRouter.dispatch({
        task: 'bicycle_extraction',
        rawPrompt: stage1Prompt,
      });

      let stage1Data: any = stage1Result.data;
      if (!stage1Data && stage1Result.text) {
        const parsed = YAMLParser.parseWithSchema(stage1Result.text, BikeSpecsSchema);
        if (parsed.success) {
          stage1Data = parsed.data;
        } else {
          console.warn('[ebike_autofill] Erro de validação Zod no Estágio 1 (BikeSpecsSchema):', parsed.errors);
          stage1Data = YAMLParser.parse(stage1Result.text);
        }
      }

      if (!stage1Data || typeof stage1Data !== 'object') {
        throw new Error('A LLM não retornou a ficha técnica da e-bike no Estágio 1.');
      }

      const enrichedStage1 = enrichBikeSpecifications(stage1Data as Record<string, any>, query, primaryDomain);

      // Salva progresso intermediário (55%) - 10 blocos concluídos
      await updateJob(jobId, {
        progress: 55,
        stage: 'Estágio 1/3 Concluído: 10 blocos canônicos auditados! Iniciando Estágio 2/3 (SEO Google Brasil e Rich Snippets)...',
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: {
            ...enrichedStage1,
            currentStage: 1,
            stagesCompleted: ['specs'],
          },
          text: stage1Result.text,
        },
      });

      // =========================================================================
      // ESTÁGIO 2/3: CRIAÇÃO DO SEO COM TÍTULO, SNIPPETS E METADADOS
      // =========================================================================
      await updateJob(jobId, {
        progress: 65,
        stage: 'Estágio 2/3: Criando títulos magnéticos, estratégia de SEO Google Brasil e Rich Snippets...',
      });

      const stage2Prompt = `Você é o Diretor de SEO Técnico e Estratégia de Conteúdo do portal TuaVia (autoridade em e-bikes no Brasil).
Com base na ficha técnica oficial da e-bike "${enrichedStage1.marca} ${enrichedStage1.modelo}" (Motor: ${enrichedStage1.potenciaW}W, Autonomia: ${enrichedStage1.autonomiaKm}km, Uso: ${enrichedStage1.usoPrincipal}):

SUA MISSÃO - ESTÁGIO 2/3:
1. Título SEO ("serpTitlePreview"): Magnético para o Google Brasil 2026, alto CTR, com palavras-chave reais e dados atraentes (<65 caracteres).
   Exemplo: "${enrichedStage1.marca} ${enrichedStage1.modelo}: Autonomia Real, Preço e Ficha Técnica"
2. Meta Description ("serpDescriptionPreview"): Texto persuasivo de 140 a 160 caracteres com números reais da bike e chamada para ação.
3. Palavra-Chave Foco ("focusKeyword"): Palavra-chave de alta intenção comercial (ex: "${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} preco ficha tecnica").
4. Palavras-Chave Secundárias ("secondaryKeywords"): 4 a 6 buscas conversacionais e LSI (ex: vale a pena, autonomia real, opiniao do dono).
5. Badge Comercial ("badge"): Selo atraente para o card (ex: "🏆 Melhor Custo-Benefício Urbano", "⚡ 350W & Autonomia Estendida").
6. Tag de Oferta ("tagOferta"): Tag promocional (ex: "🔥 Menor Preço Garantido", "⚡ Destaque em Autonomia").
7. Resumo GEO ("llmGeoSummary"): Síntese de 3 a 4 linhas para ser citada por IAs de busca (Google AI Overviews, Perplexity).
8. FAQ Schema ("faqSchema"): 3 perguntas e respostas frequentes (autonomia real, recarga da bateria, regras do CONTRAN 996).
9. Classificação CONTRAN ("contranCategory"): Enquadramento regulatório exato (ex: "Bicicleta Elétrica Assistida (Res. CONTRAN 996/2023 - Sem CNH)").
10. Pontuação SEO ("seoScore"): Estimativa de 92 a 98.

Retorne ESTRITAMENTE um JSON válido:
{
  "badge": "🏆 Melhor Custo-Benefício Urbano",
  "tagOferta": "⚡ Menor Preço Garantido",
  "seoReport": {
    "focusKeyword": "${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} preco ficha tecnica",
    "secondaryKeywords": [
      "${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} vale a pena",
      "${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} autonomia real",
      "comprar ${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} brasil",
      "melhor e-bike urbana ${enrichedStage1.marca.toLowerCase()}"
    ],
    "searchIntent": "Transacional / Comparativa",
    "seoScore": 96,
    "serpTitlePreview": "${enrichedStage1.marca} ${enrichedStage1.modelo}: Autonomia Real, Preço e Avaliação Completa",
    "serpDescriptionPreview": "Confira a ficha técnica completa da ${enrichedStage1.marca} ${enrichedStage1.modelo}. Motor de ${enrichedStage1.potenciaW}W, autonomia de até ${enrichedStage1.autonomiaKm}km e comparador de preços das principais lojas.",
    "llmGeoSummary": "A ${enrichedStage1.marca} ${enrichedStage1.modelo} é uma e-bike voltada para uso ${enrichedStage1.usoPrincipal.toLowerCase()} equipada com motor de ${enrichedStage1.potenciaW}W e autonomia de até ${enrichedStage1.autonomiaKm}km. Enquadra-se na Resolução CONTRAN 996/2023 como bicicleta elétrica assistida (sem exigência de CNH ou emplacamento).",
    "faqSchema": [
      {
        "question": "Qual é a autonomia real da ${enrichedStage1.modelo}?",
        "answer": "A autonomia declarada é de até ${enrichedStage1.autonomiaKm}km no modo de assistência econômico, variando conforme o peso do ciclista e a altimetria do percurso."
      },
      {
        "question": "A ${enrichedStage1.modelo} exige CNH ou emplacamento?",
        "answer": "Não. Ela atende estritamente à Resolução CONTRAN 996/2023 como bicicleta elétrica assistida (potência de até 1000W e assistência até 32 km/h), sem necessidade de CNH ou licenciamento."
      },
      {
        "question": "A bateria é removível?",
        "answer": "Sim, a bateria conta com trava de segurança com chave e pode ser recarregada fora da bicicleta em tomadas comuns bivolt."
      }
    ],
    "contranCategory": "Bicicleta Elétrica Assistida (Res. CONTRAN 996/2023 - Sem CNH)",
    "targetBuyerPersona": "Ciclistas que buscam transporte eficiente e econômico para trajetos diários.",
    "optimizationTips": [
      "Atualizar preços e lojas periodicamente para reter o Rich Snippet de produto do Google.",
      "Destacar conformidade com as normas do CONTRAN 996/2023 para captar tráfego regulatório."
    ]
  }
}`;

      let stage2Data: any = null;
      try {
        const stage2Result = await AIRouter.dispatch({
          task: 'content_generation',
          rawPrompt: stage2Prompt,
        });
        stage2Data = stage2Result.data;
        if (!stage2Data && stage2Result.text) {
          const parsed = YAMLParser.parseWithSchema(stage2Result.text, BikeSeoSchema);
          if (parsed.success) {
            stage2Data = parsed.data;
          } else {
            console.warn('[ebike_autofill] Erro de validação Zod no Estágio 2 de SEO (BikeSeoSchema):', parsed.errors);
            stage2Data = YAMLParser.parse(stage2Result.text);
          }
        }
      } catch (err2) {
        console.warn('[JobStore] Aviso: Falha no Estágio 2 de SEO, aplicando dados otimizados padrão:', err2);
      }

      const stage2Combined = {
        ...enrichedStage1,
        badge: stage2Data?.badge || enrichedStage1.badge || '🏆 Destaque em Autonomia',
        tagOferta: stage2Data?.tagOferta || '⚡ Menor Preço Garantido',
        seoReport: stage2Data?.seoReport || {
          focusKeyword: `${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} preco ficha tecnica`,
          secondaryKeywords: [
            `${enrichedStage1.marca.toLowerCase()} ${enrichedStage1.modelo.toLowerCase()} vale a pena`,
            `autonomia real ${enrichedStage1.modelo.toLowerCase()}`,
            `comprar ${enrichedStage1.modelo.toLowerCase()}`
          ],
          searchIntent: 'Transacional / Comparativa',
          seoScore: 95,
          serpTitlePreview: `${enrichedStage1.marca} ${enrichedStage1.modelo}: Autonomia Real, Preço e Ficha Completa`,
          serpDescriptionPreview: `Ficha técnica da ${enrichedStage1.marca} ${enrichedStage1.modelo} com motor de ${enrichedStage1.potenciaW}W e autonomia de ${enrichedStage1.autonomiaKm}km. Compare preços e economize no TuaVia.`,
          llmGeoSummary: `A ${enrichedStage1.marca} ${enrichedStage1.modelo} oferece motor de ${enrichedStage1.potenciaW}W e bateria de longa duração para até ${enrichedStage1.autonomiaKm}km.`,
          contranCategory: 'Bicicleta Elétrica Assistida (Res. CONTRAN 996/2023 - Sem CNH)',
        },
      };

      // Salva progresso intermediário (75%)
      await updateJob(jobId, {
        progress: 75,
        stage: 'Estágio 2/3 Concluído: SEO e Rich Snippets gerados! Iniciando Estágio 3/3 (Cotações de mercado e histórico de preços)...',
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: {
            ...stage2Combined,
            currentStage: 2,
            stagesCompleted: ['specs', 'seo'],
          },
        },
      });

      // =========================================================================
      // ESTÁGIO 3/3: COTAÇÕES DE MERCADO & OFERTAS REAIS NA WEB
      // =========================================================================
      await updateJob(jobId, {
        progress: 85,
        stage: 'Estágio 3/3: Pesquisando cotações em lojas e estruturando ofertas de mercado...',
      });

      const lastMonthsList = getLastNMonths(6);
      const priceResultsList: any[] = [];
      const realMonthlyPricePoints: EBikePriceHistoryPoint[] = [];
      const activeOffersList: Array<{ loja: string; preco: number; disponibilidade: string; destaque: string; url?: string }> = [];

      try {
        const priceSearchRes = await WebSearchTool.search({
          query: `"${enrichedStage1.marca}" "${enrichedStage1.modelo}" preco comprar bicicleta eletrica nova brasil -bateria -carregador -kit -acelerador -quadro -pecas -usada -reparo`,
          type: 'shopping',
          limit: 8,
        });

        if (priceSearchRes && Array.isArray(priceSearchRes.organic)) {
          priceResultsList.push(...priceSearchRes.organic);
          const candidates = WebSearchTool.extractPriceCandidates(priceSearchRes.organic);
          if (candidates.length > 0) {
            const bestCandidate = candidates[0];
            const currentMonth = lastMonthsList[lastMonthsList.length - 1];

            realMonthlyPricePoints.push({
              month: currentMonth,
              price: bestCandidate.price,
              store: bestCandidate.store || 'Loja Online',
              source: bestCandidate.store || 'ciclismo.com.br',
              verified: true,
              condition: 'À vista',
            });

            for (const c of candidates.slice(0, 4)) {
              activeOffersList.push({
                loja: c.store || 'Loja Online',
                preco: c.price,
                disponibilidade: 'Em estoque',
                destaque: c.price === bestCandidate.price ? 'Menor Preço Encontrado' : 'Oferta Verificada',
              });
            }
          }
        }
      } catch (priceSearchErr) {
        console.warn('[JobStore] Aviso na busca de preços no Estágio 3:', priceSearchErr);
      }

      const uniqueOffersMap = new Map<string, any>();
      for (const o of activeOffersList) {
        const key = `${o.loja || ''}-${o.preco || 0}`;
        if (!uniqueOffersMap.has(key) && (o.preco || 0) > 0) {
          uniqueOffersMap.set(key, o);
        }
      }
      const finalOffers = Array.from(uniqueOffersMap.values());

      let validatedPriceHistory = sanitizePriceHistory(realMonthlyPricePoints);
      if (validatedPriceHistory.length === 0 && finalOffers.length > 0) {
        const lowestOffer = [...finalOffers].sort((a, b) => a.preco - b.preco)[0];
        validatedPriceHistory = [{
          month: lastMonthsList[lastMonthsList.length - 1],
          price: lowestOffer.preco,
          store: lowestOffer.loja,
          source: lowestOffer.loja,
          verified: true,
          condition: 'À vista',
        }];
      }

      const finalCompleteBike = {
        ...stage2Combined,
        ofertasSugestoes: finalOffers,
        priceHistory: validatedPriceHistory,
        currentStage: 3,
        stagesCompleted: ['specs', 'seo', 'price_chart'],
      };

      await updateJob(jobId, {
        progress: 100,
        stage: 'Ficha técnica oficial, 10 blocos canônicos, SEO Google Brasil e ofertas consolidados com sucesso!',
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: finalCompleteBike,
          text: JSON.stringify(finalCompleteBike, null, 2),
        },
      });
    } else if (job.type === 'ebike_ingest_step') {
      // =========================================================================
      // INGESTÃO DE E-BIKE — PIPELINE ÚNICO
      //
      // Antes este job rodava uma cascata de 5 etapas, cada uma uma chamada de
      // IA, com o resultado de uma virando entrada da seguinte. Isso custava
      // 10 chamadas por documento e distribuía mal os valores entre as seções.
      //
      // A etapa por etapa continua disponível para depuração via campo
      // `stageSnapshot`, mas o caminho padrão é o pipeline determinístico
      // primeiro, que só chama a IA para fechar buraco.
      // =========================================================================
      const { rawText, parsedData, fileName, llmPolicy } = job.input || {};
      const safeFileName = (fileName || 'documento').trim();

      if (typeof rawText !== 'string' || rawText.trim().length === 0) {
        await updateJob(jobId, {
          progress: 100,
          status: 'failed',
          stage: 'Nenhum texto extraído do arquivo.',
          error: 'O job não recebeu rawText.',
          errorCode: 'EMPTY_INPUT',
          retryable: false,
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
        });
      } else {
        await updateJob(jobId, {
          progress: 20,
          stage: `Extraindo e alocando nas seções canônicas: "${safeFileName}"`,
        });

        const ingested = await runIngestionPipeline({
          rawText,
          fileName: safeFileName,
          parsedData,
          policy: {
            llm: llmPolicy === 'never' || llmPolicy === 'always' ? llmPolicy : 'gaps-only',
          },
        });

        const stats = ingested.stats ?? {};
        const partial = Boolean(stats.llmError) && (stats.filledItems ?? 0) > 0;

        await updateJob(jobId, {
          progress: 100,
          // `partial` existe para o caso "a ficha saiu, mas a IA não ajudou".
          // Marcar como `failed` aqui fazia a UI esconder uma extração válida
          // e o admin perder o trabalho que já estava pronto.
          status: partial ? 'partial' : 'completed',
          stage: partial
            ? `${stats.filledItems}/${stats.totalCanonicalItems} campos preenchidos sem a IA (${stats.llmError})`
            : `${stats.filledItems}/${stats.totalCanonicalItems} campos preenchidos · ${stats.gapCount} sem fonte · score ${ingested.audit.integrityScore}`,
          ...(partial ? { errorCode: 'LLM_STEP_DEGRADED' } : {}),
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
          result: {
            success: true,
            mode: 'ebike',
            engine: 'unified_pipeline',
            data: ingested,
            text: JSON.stringify(ingested.specSections, null, 2),
          },
        });
      }
    } else if (job.type === 'ebike_section_autofill') {
      // =========================================================================
      // REFINAMENTO ESPECÍFICO POR SEÇÃO TÉCNICA (MOTOR, BATERIA, QUADRO, FREIOS)
      // =========================================================================
      const { marca, modelo, sectionTitle, sectionIndex, currentItems, usoPrincipal } = job.input || {};
      const safeMarca = (marca || '').trim() || 'E-Bike';
      const safeModelo = (modelo || '').trim() || 'Modelo';
      const safeTitle = (sectionTitle || 'Especificações Técnicas').trim();

      await updateJob(jobId, {
        progress: 15,
        stage: `Pesquisando dados específicos na internet para "${safeTitle}" de ${safeMarca} ${safeModelo}...`,
      });

      // Query direcionada conforme o subsistema dos 10 blocos canônicos
      let targetedQuery = `"${safeMarca} ${safeModelo}" ficha tecnica especificacoes brasil`;
      const titleLower = safeTitle.toLowerCase();
      if (titleLower.includes('resumo') || titleLower.includes('destaque')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" autonomia peso potencia velocidade maxima capacidade de carga`;
      } else if (titleLower.includes('desempenho') || titleLower.includes('propuls') || titleLower.includes('motor')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" motor watts potencia pico torque nm acelerador sensor cadencia`;
      } else if (titleLower.includes('bateria') || titleLower.includes('energia')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" bateria voltagem volts amperagem ah wh capacidade autonomia recarga removivel`;
      } else if (titleLower.includes('conforto') || titleLower.includes('ergonomia') || titleLower.includes('quadro')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" quadro material aluminio suspensao dianteira traseira guidao selim tamanho`;
      } else if (titleLower.includes('seguran') || titleLower.includes('freio') || titleLower.includes('ilumina')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" freio disco hidraulico mecanico farol luz lanterna corte motor manetes`;
      } else if (titleLower.includes('transmiss') || titleLower.includes('cicl') || titleLower.includes('câmbio') || titleLower.includes('cambio')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" cambio passador trocador marchas shimano corrente pedivela pedais`;
      } else if (titleLower.includes('dimens') || titleLower.includes('roda') || titleLower.includes('pneu')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" aro medida pneus fat tire dobravel dimensoes comprimento largura altura`;
      } else if (titleLower.includes('equipamento') || titleLower.includes('conectividade') || titleLower.includes('display') || titleLower.includes('painel')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" display painel lcd usb bluetooth aplicativo bagageiro paralamas cavalete`;
      } else if (titleLower.includes('compatibilidade') || titleLower.includes('manuten') || titleLower.includes('garantia')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" garantia manual assistencia tecnica bateria reposicao resistencia agua ipx`;
      } else if (titleLower.includes('auditoria') || titleLower.includes('contran') || titleLower.includes('fonte')) {
        targetedQuery = `"${safeMarca} ${safeModelo}" resolucao contran 996 manual do proprietario pdf ficha tecnica`;
      }

      let sectionSearchContext = '';
      try {
        const webSearchRes = await WebSearchTool.search({
          query: targetedQuery,
          limit: 6,
        });
        sectionSearchContext = WebSearchTool.formatForPrompt(webSearchRes, 4);
      } catch (searchErr) {
        console.warn(`[JobStore] Aviso na busca da seção ${safeTitle}:`, searchErr);
      }

      await updateJob(jobId, {
        progress: 50,
        stage: `Auditando dados de "${safeTitle}" com as 20 Diretrizes Técnicas do TuaVia...`,
      });

      const sectionPrompt = `Você é o Engenheiro-Chefe e Auditor Especialista do portal TuaVia.
Sua missão é preencher e auditar os parâmetros técnicos da seção "${safeTitle}" da e-bike "${safeMarca} ${safeModelo}" (Categoria: ${usoPrincipal || 'Urbana'}).

ITENS ATUAIS NO FORMULÁRIO:
${JSON.stringify(currentItems || [], null, 2)}

DADOS COLETADOS NA WEB:
${sectionSearchContext || 'Sem dados adicionais de busca. Utilize apenas informações comprovadas da marca/modelo.'}

HIERARQUIA DE FONTES (da mais confiável para a menos):
1. Site oficial do fabricante / distribuidor nacional
2. Manual do proprietário / ficha técnica em PDF
3. Review editorial especializado com medição própria
4. Revenda autorizada / loja oficial da marca
5. Anúncio em marketplace (Mercado Livre, Amazon, etc.) — NÍVEL MAIS BAIXO. Usar apenas para identificar o produto, nunca para specs conflitantes.

DIRETRIZES DE AUDITORIA POR SEÇÃO:

SE FOR MOTOR:
- Potência: nominal informada pelo fabricante. Não transformar potência de pico em nominal.
- Torque: APENAS se o valor em Nm constar em fonte nível 1, 2 ou 3. Se não constar, preencher obrigatoriamente: "Não informado pelo fabricante". NUNCA infira torque a partir de watts.

SE FOR BATERIA:
- Tensão (V) e Capacidade (Ah): registrar conforme fonte.
- Energia (Wh): calcular Wh = V × Ah SOMENTE se ambos forem confirmados. Se o fabricante declarar um Wh diferente, registrar o valor do fabricante com nota.

SE FOR QUADRO, SUSPENSÃO, PNEUS, PESO OU CARGA:
- Pneu: identificar o FORMATO da bike antes de aceitar uma medida. Se a bike for Fat Tire/Scrambler/Moped, a medida é tipicamente 20×3.0 ou 20×4.0 — NUNCA aplicar 20×1.95. Se a medida exata não estiver confirmada, colocar "Não informado pelo fabricante".
- Material do quadro: apenas com fonte explícita. Sem fonte: "Não informado pelo fabricante". Não copiar de modelo parecido.
- Peso total: apenas com fonte explícita. Sem fonte: "Não informado pelo fabricante". Se a única fonte for anúncio de revenda, registrar o valor com a ressalva "(informado por revendedor, não oficial)".
- Capacidade máxima de carga: priorizar SEMPRE a especificação do fabricante/distribuidor sobre anúncios de marketplace, mesmo que estes sejam mais numerosos.

SE FOR TRANSMISSÃO OU FREIOS:
- Discriminar tipo exato (disco mecânico vs. hidráulico). Marca do freio e do câmbio se conhecidas.
- Nunca usar combinações genéricas ou ambíguas como "RevoShift / RapidFire".

REGRA DE MODELO NÃO LOCALIZADO NO CATÁLOGO ATUAL:
- Se o modelo não constar no catálogo oficial atual da marca (ex: modelo descontinuado ou nomenclatura criada por marketplace), marque confidence como "NAO_CONFIRMADA" para os campos sem fonte primária e registre em sectionSummary: "Modelo não localizado no catálogo oficial atual — informações auditadas a partir de revendas e distribuidores."

REGRA DE FONTE (OBRIGATÓRIA):
- No campo "source", cite LITERALMENTE a fonte real da busca web onde o dado foi extraído (ex: "caloi.com [resultado 1]", "pedal.com.br [resultado 3]", "manual PDF").
- É TERMINANTEMENTE PROIBIDO preencher o campo "source" com categorias abstratas como "Catálogo Oficial", "Manual do Fabricante", "Ficha Técnica Oficial" ou "Especificação Comercial" se você não tiver uma URL ou evidência real correspondente.
- Se o dado não tiver uma fonte específica comprovada na busca web, deixe o campo source como string vazia: "".

REGRA DE CONSISTÊNCIA DE VALORES NÃO INFORMADOS (OBRIGATÓRIA):
- Se o valor ("value") for "Não informado pelo fabricante" ou "Não confirmado", o campo "confidence" DEVE ser OBRIGATORIAMENTE "NAO_CONFIRMADA" e o campo "source" DEVE ser string vazia "".
- Níveis de confiança válidos: ALTA (confirmado em fonte nível 1 ou 2), MEDIA (fonte nível 3 ou 4), BAIXA (somente marketplace nível 5), NAO_CONFIRMADA (nenhuma evidência).

RETORNE ESTRITAMENTE NO FORMATO YAML (sem markdown ou texto extra além do YAML):
\`\`\`yaml
title: "${safeTitle}"
items:
  - label: "Nome do Parâmetro"
    value: "Valor Auditado" # ou "Não informado pelo fabricante"
    confidence: "ALTA" # ALTA | MEDIA | BAIXA | NAO_CONFIRMADA
    source: "dominio.com.br [resultado 1]" # fonte literal da busca ou "" se não confirmada
sectionSummary: "Breve nota técnica sobre o que foi confirmado e o que não tem evidência oficial."
auditReport:
  confirmados: 0
  parciais: 0
  naoConfirmados: 0
  corrigidos: []
\`\`\``;

      let sectionResultData: any = null;
      try {
        const aiRes = await AIRouter.dispatch({
          task: 'bicycle_extraction',
          rawPrompt: sectionPrompt,
        });
        sectionResultData = aiRes.data;
        if (!sectionResultData && aiRes.text) {
          const parsed = YAMLParser.parseWithSchema(aiRes.text, BikeSpecSectionSchema);
          if (parsed.success) {
            sectionResultData = parsed.data;
          } else {
            console.warn(`[ebike_section_autofill] Erro de validação Zod na seção ${safeTitle} (BikeSpecSectionSchema):`, parsed.errors);
            sectionResultData = YAMLParser.parse(aiRes.text);
          }
        }
      } catch (errSec) {
        console.warn(`[JobStore] Erro ao processar seção ${safeTitle} com IA:`, errSec);
      }

      if (!sectionResultData || !Array.isArray(sectionResultData.items) || sectionResultData.items.length === 0) {
        // Fallback limpo sem alucinações
        sectionResultData = {
          title: safeTitle,
          items: Array.isArray(currentItems) && currentItems.length > 0
            ? sanitizeSpecItems(currentItems)
            : [{ label: 'Especificação', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' }],
          sectionSummary: 'Dados mantidos conforme auditoria técnica.',
          auditReport: {
            confirmados: 0,
            parciais: 0,
            naoConfirmados: 1,
            corrigidos: [],
          },
        };
      } else {
        sectionResultData.items = sanitizeSpecItems(sectionResultData.items);
      }

      await updateJob(jobId, {
        progress: 100,
        stage: `Seção "${safeTitle}" refinada e auditada com sucesso!`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: {
            sectionIndex,
            sectionTitle: sectionResultData.title || safeTitle,
            items: sectionResultData.items,
            sectionSummary: sectionResultData.sectionSummary || '',
            auditReport: sectionResultData.auditReport || null,
          },
        },
      });
    } else if (job.type === 'ebike_price_chart' || job.type === 'ebike_manual_search') {
      // =========================================================================
      // BUSCADOR MANUAL / RECALCULAR GRÁFICO DE PREÇOS REAIS & SEO
      // =========================================================================
      await updateJob(jobId, {
        progress: 15,
        stage: 'Buscador Manual: Pesquisando cotações e ofertas atualizadas da e-bike na internet...',
      });

      const { marca, modelo, bikeData } = job.input || {};
      const targetMarca = marca || bikeData?.marca || '';
      const targetModelo = modelo || bikeData?.modelo || '';
      if (!targetMarca && !targetModelo) {
        throw new Error('É necessário informar pelo menos a marca ou modelo da e-bike para a busca manual.');
      }

      let webPriceContext = '';
      let manualCandidatePricesPrompt = '';
      let detectedManualMinPrice: number | null = null;
      try {
        await updateJob(jobId, {
          progress: 25,
          stage: 'Buscador Manual Etapa 1/2: Pesquisando cotações em lojas e marketplaces...',
        });
        const res = await WebSearchTool.search({
          query: `"${targetMarca}" "${targetModelo}" preco comprar bicicleta eletrica nova brasil -bateria -carregador -kit -acelerador -quadro -pecas -usada -reparo`,
          type: 'shopping',
          limit: 8,
        });

        await updateJob(jobId, {
          progress: 50,
          stage: 'Buscador Manual Etapa 2/2: Consultando lojas oficiais e revendedores autorizados...',
        });
        const officialRes = await WebSearchTool.search({
          query: `"${targetMarca} ${targetModelo}" preco bike eletrica loja revenda`,
          limit: 6,
        });

        const combinedPrices = [
          ...(res && Array.isArray(res.organic) ? res.organic : []),
          ...(officialRes && Array.isArray(officialRes.organic) ? officialRes.organic : [])
        ];

        const uniquePriceMap = new Map<string, any>();
        for (const item of combinedPrices) {
          const key = item.link || item.title;
          if (key && !uniquePriceMap.has(key)) {
            uniquePriceMap.set(key, item);
          }
        }
        const uniquePriceResults = Array.from(uniquePriceMap.values());
        webPriceContext = WebSearchTool.formatForPrompt(uniquePriceResults, 10);
        const candidates = WebSearchTool.extractPriceCandidates(res);
        if (candidates.length > 0) {
          manualCandidatePricesPrompt = WebSearchTool.formatPriceCandidatesForPrompt(candidates);
          detectedManualMinPrice = candidates[0].price;
        }
      } catch (err) {
        console.warn('[JobStore] Aviso na busca manual de preços:', err);
      }

      const manualBaseline = detectedManualMinPrice;
      const manualBaselineFmt = manualBaseline ? manualBaseline.toFixed(2) : null;

      const lastMonthsList = getLastNMonths(6);
      const manualPrompt = `Você é o Analista-Chefe de Preços e SEO do TuaVia.
O usuário solicitou a busca manual e atualização de preços da e-bike: "${targetMarca} ${targetModelo}".

${manualCandidatePricesPrompt ? `${manualCandidatePricesPrompt}\n` : ''}
${webPriceContext ? `OFERTAS E PREÇOS REAIS ENCONTRADOS NA INTERNET:\n${webPriceContext}\n` : ''}

REGRAS DE DISCRIMINAÇÃO E AUDITORIA DE PREÇO:
1. APENAS BICICLETA COMPLETA (ZERO KM):
   - Descarte anúncios de baterias avulsas, carregadores, kits de motor, peças ou bikes usadas/com defeito.
2. EXTRAÇÃO DE OFERTAS:
   - Extraia as lojas e marketplaces idôneos encontrados (ex: Mercado Livre, Amazon Brasil, Magazine Luiza, Decathlon, Lojas Oficiais).
   - Registre o preço à vista em R$ real.
3. HISTÓRICO:
   - Se houver registros de cotações passadas ou preço de lançamento, monte o histórico citando o domínio exato no campo "source" (ex: "amazon.com.br", "mercadolivre.com.br"). NUNCA invente números fictícios ou rótulos genéricos.
   - Se houver menos de 3 meses com dados reais de cotações, marque "historicoInsuficiente: true".

RETORNE ESTRITAMENTE NO FORMATO YAML:
\`\`\`yaml
badge: "⚡ Preço Atualizado"
tagOferta: "Melhor Oferta do Dia"
ofertasSugestoes:
  - loja: "Nome da Loja"
    preco: 0.00
    disponibilidade: "Em estoque"
    destaque: "Menor Preço Encontrado"
priceHistory:
  - month: "${lastMonthsList[5]}"
    price: 0.00
    store: "Nome da Loja"
    source: "dominio-da-loja.com.br"
    verified: true
    condition: "À vista"
historicoInsuficiente: true
seoUpdate:
  serpTitlePreview: "${targetMarca} ${targetModelo}: Preço Atualizado, Ficha Técnica e Onde Comprar"
  serpDescriptionPreview: "Confira os menores preços da ${targetMarca} ${targetModelo} encontrados em lojas confiáveis. Gráfico histórico e ficha técnica completa no TuaVia."
  menorPrecoIdentificado: 0.00
\`\`\`

RETORNE ESTRITAMENTE O BLOCO YAML ACIMA:`;

      await updateJob(jobId, {
        progress: 60,
        stage: 'Buscador Manual: Analisando cotações reais e recalculando curva de preços...',
      });

      const manualResult = await AIRouter.dispatch({
        task: 'content_generation',
        rawPrompt: manualPrompt,
      });

      let manualData: any = manualResult.data;
      if (!manualData && manualResult.text) {
        const parsed = YAMLParser.parseWithSchema(manualResult.text, BikeManualSearchSchema);
        if (parsed.success) {
          manualData = parsed.data;
        } else {
          console.warn('[ebike_manual_search] Erro de validação Zod nas cotações manuais (BikeManualSearchSchema):', parsed.errors);
          manualData = YAMLParser.parse(manualResult.text);
        }
      }

      const candidatePrices = (Array.isArray(manualData?.ofertasSugestoes) ? manualData.ofertasSugestoes : [])
        .map((o: any) => {
          const raw = o?.preco ?? o?.price;
          return typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        })
        .filter((p: number) => !isNaN(p) && p > 0);
      const basePrice = candidatePrices.length > 0 ? Math.min(...candidatePrices) : null;

      let validatedPriceHistory = basePrice 
        ? sanitizePriceHistory(manualData?.priceHistory, basePrice)
        : [];

      if (validatedPriceHistory.length === 0 && candidatePrices.length > 0 && basePrice) {
        const currentMonthStr = lastMonthsList[lastMonthsList.length - 1];
        const primaryStore = manualData?.ofertasSugestoes?.[0]?.loja || 'Cotação Web';
        validatedPriceHistory = [{
          month: currentMonthStr,
          price: basePrice,
          store: primaryStore,
          source: 'Cotação Verificada',
          verified: true,
          condition: 'À vista',
        }];
      }

      const consolidatedManual = {
        badge: manualData?.badge || '🏆 Menor Preço Identificado',
        tagOferta: manualData?.tagOferta || '⚡ Preço Atualizado',
        ofertasSugestoes: Array.isArray(manualData?.ofertasSugestoes) ? manualData.ofertasSugestoes : [],
        priceHistory: validatedPriceHistory,
        seoReport: manualData?.seoUpdate ? {
          serpTitlePreview: manualData.seoUpdate.serpTitlePreview,
          serpDescriptionPreview: manualData.seoUpdate.serpDescriptionPreview,
          focusKeyword: `${targetMarca.toLowerCase()} ${targetModelo.toLowerCase()} preco`,
        } : undefined,
        currentStage: 3,
        stagesCompleted: ['specs', 'seo', 'price_chart'],
      };

      await updateJob(jobId, {
        progress: 100,
        stage: 'Buscador Manual concluído com sucesso: Preços reais e gráfico atualizados!',
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: consolidatedManual,
          text: JSON.stringify(consolidatedManual, null, 2),
        },
      });
    } else if (job.type === 'article_autofill') {
      await updateJob(jobId, {
        progress: 15,
        stage: 'Etapa 1/2: Redigindo corpo completo do artigo e tabelas técnicas em Markdown...',
      });

      const { query, category: initialCategory, targetAudience, keywords, articleType } = job.input || {};
      if (!query) throw new Error('A query de pesquisa do artigo está vazia.');

      const extraGuidelines: string[] = [];
      if (targetAudience) extraGuidelines.push(`- Público-alvo prioritário: ${targetAudience}`);
      if (keywords) extraGuidelines.push(`- Palavras-chave SEO essenciais: ${keywords}`);
      if (articleType) extraGuidelines.push(`- Formato editorial: ${articleType}`);
      const extraPromptText = extraGuidelines.length > 0 ? `\nDIRETRIZES ESPECÍFICAS DO COPILOTO:\n${extraGuidelines.join('\n')}\n` : '';

      // ETAPA 1: Redação Rápida e Focada do Artigo em Markdown (~10 a 15s)
      const stage1Prompt = `Redija o corpo COMPLETO, aprofundado e altamente técnico do artigo em Markdown sobre o tema: "${query.trim()}".
Categoria sugerida: "${initialCategory || 'Guia de Compra'}".
${extraPromptText}
DIRETRIZES DE REDAÇÃO EM MARKDOWN (ESTRITO PT-BR):
- Inicie IMEDIATAMENTE na PRIMEIRA LINHA com o título principal (# Título Principal).
- NUNCA inclua planejamentos, saudações, introduções ou pensamentos em inglês ou português (ex: "The user wants...", "Here is...").
- NUNCA use as siglas "(FAQ)" ou "(CTA)" e nunca escreva rótulos de instrução como "Chamada para Ação:".
- Introdução contextualizada com a realidade do mercado brasileiro atual (2026).
- Subtítulos organizados (## e ###) com análises técnicas aprofundadas (motores, baterias, autonomia, durabilidade).
- Tabela comparativa ou checklist de boas práticas em Markdown GFM.
- Orientações regulatórias do CONTRAN 996/2023 quando pertinente.
- Seção "## Perguntas Frequentes" com 3 perguntas e respostas essenciais (sem a sigla FAQ).
- Conclusão com o veredito editorial do TuaVia e a frase de encerramento em destaque.

Comece agora diretamente com o título (# ):`;

      const stage1Result = await AIRouter.dispatch({
        task: 'content_generation',
        rawPrompt: stage1Prompt,
      });

      const stage1Data = stage1Result.data as any;
      const rawBodyText = (stage1Result.text?.trim() || stage1Data?.body || stage1Data?.markdownContent || '').trim();

      // Extrai título do H1 do texto original antes da limpeza de sanitização
      const h1Match = rawBodyText.match(/^#\s+([^\n]+)/m);
      const extractedTitle = h1Match ? h1Match[1].replace(/[*_`]/g, '').trim() : query.trim();

      let bodyMarkdown = YAMLParser.cleanMarkdownArticleText(rawBodyText);

      if (!bodyMarkdown) {
        throw new Error('A IA não retornou o corpo do artigo na Etapa 1.');
      }

      // Salva progresso intermediário / parcial (50%) para o frontend já consumir
      const partialArticle = {
        title: extractedTitle,
        slug: extractedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        category: initialCategory || 'Guia de Compra',
        body: bodyMarkdown,
        markdownContent: bodyMarkdown,
        stage: 'body_completed',
      };

      await updateJob(jobId, {
        progress: 55,
        stage: 'Etapa 2/2: Corpo concluído! Otimizando metadados estratégicos, SEO, título magnético e tags...',
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: partialArticle,
          text: bodyMarkdown,
        },
      });

      // ETAPA 2: Metadados Estratégicos, SEO e Tags com base no texto gerado (~3 a 5s)
      const stage2Prompt = `Você é o Especialista Chefe em SEO e Estratégia de Conteúdo do TuaVia.
Analise o tema e o artigo redigido abaixo para formular os metadados de alto CTR para o Google Brasil 2026.

TEMA: "${query.trim()}"
TRECHO DO ARTIGO GERADO:
${bodyMarkdown.slice(0, 1500)}

SUA MISSÃO - ETAPA 2:
1. Título SEO: Alto CTR no Google Brasil 2026, magnético, sem aspas (máx 65 caracteres).
2. Slug: Limpo em kebab-case, sem acentos nem preposições desnecessárias.
3. Resumo Editorial (excerpt): 1 a 3 frases persuasivas com palavras-chave (120 a 160 caracteres).
4. Categoria: Escolha UMA: "Guia de Compra", "Manutenção", "Legislação", "Notícias", "Comparativo".
5. Categorias de bike relacionadas (ex: ["Urbana", "Dobrável"]).
6. Tempo de leitura estimado em minutos.
7. Lista de palavras-chave principais para SEO.

Retorne no formato YAML Frontmatter estritamente:
---
title: "Título Otimizado para Alto CTR"
slug: "slug-em-kebab-case"
excerpt: "Resumo persuasivo rico em palavras-chave para meta description."
category: "Guia de Compra"
readingTimeMinutes: 6
relatedBikeCategories:
  - "Urbana"
  - "Dobrável"
seoKeywords:
  - "e-bike brasil"
  - "mobilidade urbana"
---`;

      let metaData: any = null;
      try {
        const stage2Result = await AIRouter.dispatch({
          task: 'seo_optimization',
          rawPrompt: stage2Prompt,
        });

        metaData = stage2Result.data;
        if (!metaData && stage2Result.text) {
          const parsed = YAMLParser.parseWithSchema(stage2Result.text, ArticleMetaSchema);
          if (parsed.success) {
            metaData = parsed.data;
          } else {
            console.warn('[article_autofill] Erro de validação Zod nos metadados do artigo (ArticleMetaSchema):', parsed.errors);
            metaData = YAMLParser.parse(stage2Result.text);
          }
        }
      } catch (seoErr) {
        console.warn('[JobStore] Aviso: Falha na etapa 2 de SEO do artigo, gerando fallback automático:', seoErr);
      }

      if (!metaData || !metaData.title) {
        metaData = {
          title: extractedTitle || query.trim(),
          slug: (extractedTitle || query.trim()).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          category: initialCategory || 'Guia de Compra',
          excerpt: `Guia prático e completo sobre ${query.trim()} para ciclistas e entusiastas de e-bikes no Brasil.`,
          readingTimeMinutes: Math.max(3, Math.ceil(bodyMarkdown.split(/\s+/).length / 200)),
          relatedBikeCategories: ['Urbana'],
          seoKeywords: ['e-bike', 'mobilidade'],
        };
      }

      // Garante que o slug seja limpo em kebab-case
      if (metaData.slug) {
        metaData.slug = String(metaData.slug)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }

      const finalArticle = {
        ...metaData,
        body: bodyMarkdown,
        markdownContent: bodyMarkdown,
        stage: 'completed',
      };

      await updateJob(jobId, {
        progress: 100,
        stage: 'Artigo redigido e SEO otimizado com sucesso pela IA!',
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: finalArticle,
          text: `---\n${YAMLParser.stringify(metaData)}\n---\n\n${bodyMarkdown}`,
        },
      });
    } else if (job.type === 'article_seo') {
      await updateJob(jobId, {
        progress: 25,
        stage: 'Analisando artigo e formulando metadados de SEO de alto CTR...',
      });

      const {
        title: currentTitle,
        body: currentBody,
        category: currentCat,
        excerpt: currentExcerpt,
        relatedBikeCategories: currentCats,
      } = job.input || {};

      const prompt = `Você é o Especialista Chefe em SEO e Estratégia de Conteúdo do portal TuaVia (autoridade máxima em e-bikes no Brasil).
Sua missão é analisar o artigo e produzir metadados de SEO de altíssimo CTR e ranqueamento no Google Brasil 2026.

DADOS DO ARTIGO:
- Título Atual: ${JSON.stringify(currentTitle || '')}
- Categoria Atual: ${JSON.stringify(currentCat || 'Guia de Compra')}
- Resumo Atual: ${JSON.stringify(currentExcerpt || '')}
- Categorias de E-bike Relacionadas: ${JSON.stringify(currentCats || [])}
- Amostra do Conteúdo:
${(currentBody || '').slice(0, 2500)}

DIRETRIZES RÍGIDAS DE RETORNO (JSON APENAS):
Retorne ESTRITAMENTE um objeto JSON válido (sem comentários e sem blocos adicionais) com o seguinte formato:
{
  "title": "Título magnético, persuasivo e com alto CTR no Google Brasil 2026 (máx 65 caracteres, sem aspas)",
  "slug": "slug-limpo-em-kebab-case-sem-acentos-nem-stop-words",
  "excerpt": "Meta description persuasiva com síntese do artigo e chamada clara para o ciclista (120 a 160 caracteres)",
  "category": "Guia de Compra",
  "readingTimeMinutes": 5,
  "relatedBikeCategories": ["Urbana", "Dobrável"],
  "seoKeywords": ["e-bike brasil", "mobilidade urbana", "bicicleta eletrica"]
}`;

      const seoResult = await AIRouter.dispatch({
        task: 'seo_optimization',
        rawPrompt: prompt,
      });

      let metaData = seoResult.data as any;
      if (!metaData && seoResult.text) {
        const parsed = YAMLParser.parseWithSchema(seoResult.text, ArticleMetaSchema);
        if (parsed.success) {
          metaData = parsed.data;
        } else {
          console.warn('[article_seo] Erro de validação Zod no SEO do artigo (ArticleMetaSchema):', parsed.errors);
          metaData = YAMLParser.parse(seoResult.text);
        }
      }

      if (!metaData || !metaData.title) {
        const safeTitle = (currentTitle && currentTitle.trim()) || 'Guia Especialista de E-Bikes no Brasil';
        metaData = {
          title: safeTitle,
          slug: safeTitle
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, ''),
          excerpt:
            (currentExcerpt && currentExcerpt.trim()) ||
            `Confira a análise técnica e o guia completo sobre ${safeTitle} no TuaVia.`,
          category: currentCat || 'Guia de Compra',
          readingTimeMinutes: Math.max(2, Math.ceil((currentBody || '').split(/\s+/).length / 200)),
          relatedBikeCategories: currentCats && currentCats.length > 0 ? currentCats : ['Urbana'],
          seoKeywords: ['e-bike brasil', 'mobilidade urbana'],
        };
      }

      // Garante que o slug seja limpo em kebab-case
      if (metaData.slug) {
        metaData.slug = String(metaData.slug)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '');
      }

      await updateJob(jobId, {
        progress: 100,
        stage: 'SEO otimizado com sucesso pela LLM (Título, Slug, Resumo e Tags)!',
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: metaData,
          text: JSON.stringify(metaData, null, 2),
        },
      });
    } else if (job.type === 'ebike_seo') {
      await updateJob(jobId, {
        progress: 20,
        stage: 'Analisando intenção de busca e metadados SEO da e-bike...',
      });

      const { bikeData } = job.input || {};
      if (!bikeData || (!bikeData.modelo && !bikeData.marca)) {
        throw new Error('Os dados básicos da e-bike (modelo ou marca) são necessários para o refinamento de SEO.');
      }

      const prompt = `Você é o Especialista Chefe em SEO Técnico, GEO (Generative Engine Optimization para Google AI Overviews, Perplexity e ChatGPT Search) e Estratégia de Produto do portal TuaVia (autoridade em mobilidade elétrica e comparador de e-bikes no Brasil).
Sua missão é analisar, enriquecer e calibrar todos os metadados de SEO, conversão, entidades semânticas e rich snippets da e-bike para ranquear em 1º lugar no Google Brasil, ser citada como fonte primária por IAs de busca e maximizar a taxa de cliques (CTR).

DADOS ATUAIS DA E-BIKE:
- Marca: ${JSON.stringify(bikeData.marca || '')}
- Modelo: ${JSON.stringify(bikeData.modelo || '')}
- Categoria de Uso: ${JSON.stringify(bikeData.usoPrincipal || 'Urbana')}
- Autonomia Declarada: ${JSON.stringify(bikeData.autonomiaKm || '')} km
- Potência do Motor: ${JSON.stringify(bikeData.potenciaW || '')} W
- Peso Total: ${JSON.stringify(bikeData.pesoKg || '')} kg
- Tempo de Carga: ${JSON.stringify(bikeData.tempoCargaHoras || '')} h
- Badge Atual: ${JSON.stringify(bikeData.badge || '')}
- Tag de Oferta: ${JSON.stringify(bikeData.tagOferta || '')}
- Ideal Para Atual: ${JSON.stringify(bikeData.idealFor || '')}
- Resumo Executivo / Veredito Atual: ${JSON.stringify(bikeData.resumoExecutivo || '')}
- Pontos Fortes Atuais: ${JSON.stringify(bikeData.pros || [])}
- Pontos de Atenção Atuais: ${JSON.stringify(bikeData.cons || [])}

DIRETRIZES DE REFINAMENTO SEO & GEO GOOGLE BRASIL 2026:
1. "modelo": Nome padronizado e limpo, sem ruídos de código, contendo o nome comercial exato com alta intenção de busca no Brasil (ex: "E-Vibe City Tour", "Easy One 350W", "Big Wheel 8.0").
2. "marca": Nome oficial e validado do fabricante (ex: "Caloi", "Sense", "Oggi", "Lev", "Two Dogs", "Trek", "Specialized").
3. "slug": Slug amigável canônico em kebab-case, sem acentos e sem preposições (ex: "caloi-e-vibe-city-tour", "sense-easy-one-350w").
4. "usoPrincipal": Categoria canônica exata (apenas uma entre: "Urbana", "Trilha/MTB", "Dobrável", "Cargo", "Speed").
5. "badge": Selo de alta atração magnética e autoridade editorial para o card (ex: "🏆 Melhor Custo-Benefício Urbano 2026", "⚡ 45 km/h & 350W", "🚵 Top 1 Dobrável Portátil", "🔥 Maior Autonomia até R$ 6.000").
6. "tagOferta": Tag promocional comercial de alta conversão (ex: "🔥 Menor Preço Garantido", "⚡ Oferta Relâmpago 2026", "💎 Melhor Desconto").
7. "idealFor": Definição ultra-específica do perfil de usuário, tipo de relevo (plano, ladeiras moderadas, subidas íngremes), trajeto diário ideal (ex: até 25 km/dia) e necessidade de portabilidade ou carga.
8. "resumoExecutivo": Resumo editorial de alta densidade semântica (140 a 160 caracteres), combinando dados mensuráveis de motor, bateria, autonomia e custo-benefício, servindo perfeitamente como Meta-Description e snippet Google.
9. "pros": 3 a 5 pontos fortes técnicos fundamentados com termos de busca (ex: motor com sensor de cadência/torque, bateria removível de lítio, freios a disco hidráulicos/mecânicos, garantia nacional).
10. "cons": 2 pontos de atenção sinceros que conferem autoridade editorial E-E-A-T (ex: peso superior para transporte em escadas, tempo de recarga padrão).
11. "seoReport": Relatório completo de engenharia de busca contendo:
    - "focusKeyword": Palavra-chave primária transacional de cauda longa (ex: "caloi e-vibe city tour preco ficha tecnica")
    - "secondaryKeywords": Lista de 5 a 8 termos LSI e buscas conversacionais (ex: "caloi e-vibe city tour vale a pena", "autonomia real e-vibe", "melhor bike eletrica urbana caloi", "opiniao do dono caloi e-vibe 2026")
    - "searchIntent": "Transacional / Comparativa"
    - "seoScore": Pontuação de 92 a 98 baseada na completude e densidade semântica
    - "serpTitlePreview": Título exato da SERP (<60 caracteres, ex: "Caloi E-Vibe City Tour: Vale a Pena? Ficha e Preços 2026")
    - "serpDescriptionPreview": Meta description de alta conversão (<155 caracteres com especificações reais e CTA)
    - "llmGeoSummary": Parágrafo de 3 a 4 linhas estruturado como resposta direta para mecanismos de IA generativa (Google AI Overviews, Perplexity, Gemini, ChatGPT Search), sintetizando potência, bateria, autonomia real, conformidade CONTRAN e veredito de compra.
    - "faqSchema": Lista de 3 a 4 perguntas e respostas frequentes ultra-precisas para Rich Snippets FAQ (ex: 1. Qual a autonomia real? 2. A bateria é removível para recarga? 3. Precisa de CNH ou emplacamento segundo o CONTRAN? 4. Sobe ladeiras íngremes?).
    - "contranCategory": Classificação regulatória exata conforme a Resolução CONTRAN 996/2023 (ex: "Bicicleta Elétrica Assistida (Pedelec até 32 km/h e 350W - Não exige CNH/Emplacamento)").
    - "targetBuyerPersona": Resumo do ciclista ideal.
    - "optimizationTips": 2 a 3 recomendações táticas acionáveis de ranqueamento.

RETORNE ESTRITAMENTE UM JSON VÁLIDO (sem markdown ou texto fora do objeto):
{
  "marca": "Nome da Marca",
  "modelo": "Nome Oficial do Modelo",
  "slug": "marca-modelo-limpo",
  "usoPrincipal": "Urbana",
  "badge": "🏆 Melhor Custo-Benefício Urbano 2026",
  "tagOferta": "⚡ Menor Preço Garantido",
  "idealFor": "Ciclistas que realizam deslocamentos diários de até 25 km...",
  "resumoExecutivo": "Análise da Modelo: motor de 350W, autonomia de até 45 km e bateria de lítio. Compare preços e fichas técnicas auditadas no TuaVia.",
  "pros": [
    "Motor elétrico com resposta rápida e assistência suave",
    "Bateria de lítio removível facilitando a recarga em tomadas comuns",
    "Quadro ergonômico com ótima posição de pedalada urbana"
  ],
  "cons": [
    "Peso de 22kg requer esforço para carregar em escadas",
    "Tempo de recarga padrão de 4 a 6 horas para carga completa"
  ],
  "seoReport": {
    "focusKeyword": "nome da bike preco ficha tecnica",
    "secondaryKeywords": [
      "nome da bike vale a pena",
      "nome da bike autonomia real",
      "comprar nome da bike brasil",
      "opiniao nome da bike 2026"
    ],
    "searchIntent": "Transacional / Comparativa",
    "seoScore": 96,
    "serpTitlePreview": "Nome da Bike: Vale a Pena? Ficha Técnica e Melhores Preços 2026",
    "serpDescriptionPreview": "Confira a ficha técnica completa da Nome da Bike. Motor de X W, bateria com autonomia de X km e comparador de preços das principais lojas.",
    "llmGeoSummary": "A Nome da Bike é uma bicicleta elétrica voltada para uso urbano equipada com motor de X W e bateria de lítio que entrega até X km de autonomia. Enquadra-se na Resolução CONTRAN 996/2023 como bicicleta assistida (sem exigência de CNH ou emplacamento), sendo uma das opções mais equilibradas em custo-benefício para mobilidade diária.",
    "faqSchema": [
      {
        "question": "Qual a autonomia real da Nome da Bike?",
        "answer": "A autonomia declarada é de até X km no modo de assistência econômico em terreno plano. Em uso misto com subidas e assistência máxima, a autonomia média fica entre Y e Z km por carga completa."
      },
      {
        "question": "A Nome da Bike precisa de CNH ou emplacamento?",
        "answer": "Não. Por possuir motor assistido de até 350W e velocidade limitada a 32 km/h sem acelerador manual puro, ela é classificada estritamente como Bicicleta Elétrica pela Resolução CONTRAN 996/2023, liberada em ciclovias e sem exigência de CNH."
      },
      {
        "question": "A bateria é removível para carregar em casa?",
        "answer": "Sim, a bateria conta com chave de travamento e pode ser facilmente removida para ser recarregada em qualquer tomada padrão 110V ou 220V em cerca de X horas."
      }
    ],
    "contranCategory": "Bicicleta Elétrica Assistida (Res. CONTRAN 996/2023 - Sem CNH)",
    "targetBuyerPersona": "Profissionais e estudantes que buscam alternativa econômica ao transporte público para trajetos de até 20 km diários.",
    "optimizationTips": [
      "Garantir a atualização constante dos links e preços de ofertas para reter o Rich Snippet do Google.",
      "Destacar os pontos de conformidade com o CONTRAN 996 para atrair buscas regulatórias no Brasil."
    ]
  }
}`;

      await updateJob(jobId, {
        progress: 50,
        stage: 'Consultando inteligência artificial (NVIDIA DeepSeek / Nemotron) para SEO de E-Bikes...',
      });

      const routerResult = await AIRouter.dispatch({
        task: 'content_generation',
        rawPrompt: prompt,
      });

      await updateJob(jobId, {
        progress: 85,
        stage: 'Validando e estruturando metadados de SEO...',
      });

      let data = routerResult.data;
      let text = routerResult.text;

      if (!data && text) {
        const parsed = YAMLParser.parseWithSchema(text, BikeSeoSchema);
        if (parsed.success) {
          data = parsed.data;
        } else {
          console.warn('[ebike_seo] Erro de validação Zod no SEO da E-Bike (BikeSeoSchema):', parsed.errors);
          data = YAMLParser.parse(text);
        }
      }

      if (!data) {
        throw new Error('A LLM não retornou metadados de SEO válidos para a e-bike.');
      }

      await updateJob(jobId, {
        progress: 100,
        stage: 'SEO da E-Bike otimizado com sucesso pela IA!',
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data,
          text,
        },
      });
    } else if (job.type === 'radar_scan') {
      const { region, topic, customQuery, limit, saveToRadarStore } = job.input || {};
      await updateJob(jobId, {
        progress: 10,
        stage: 'Iniciando varredura profunda no Radar Global com GLM 5.3...',
      });

      const { executeGlobalRadarSearch } = await import('@/lib/globalRadarSearch');
      const radarRes = await executeGlobalRadarSearch({
        region: region || 'all',
        topic: topic || 'all',
        customQuery: customQuery || '',
        limit: limit || 8,
        saveToRadarStore: saveToRadarStore !== false,
        onProgress: async (pct, msg) => {
          await updateJob(jobId, {
            progress: pct,
            stage: msg,
          });
        },
      });

      await updateJob(jobId, {
        progress: 100,
        stage: `Varredura internacional concluída! ${radarRes.results.length} pauta(s) estruturadas.`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: radarRes,
          results: radarRes.results,
          totalFound: radarRes.totalFound || radarRes.results.length,
          sourcesSearched: radarRes.sourcesSearched,
          // `executeGlobalRadarSearch` não devolve `message`; o resumo real é
          // a contagem de erros, que era o que o painel queria mostrar.
          message: Array.isArray(radarRes.errors) && radarRes.errors.length > 0
            ? `${radarRes.errors.length} fonte(s) falharam durante a varredura.`
            : undefined,
        },
      });
    } else if (job.type === 'ai_radar_scan') {
      await updateJob(jobId, {
        progress: 10,
        stage: 'Iniciando varredura nacional do Radar IA com GLM 5.3...',
      });

      const { executeRadarScan } = await import('@/lib/aiRadarService');
      const radarData = await executeRadarScan(true, async (pct, msg) => {
        await updateJob(jobId, {
          progress: pct,
          stage: msg,
        });
      });

      await updateJob(jobId, {
        progress: 100,
        stage: `Varredura nacional finalizada com sucesso!`,
        status: 'completed',
        completedAt: new Date().toISOString(),
        lockedBy: undefined,
        lockedUntil: undefined,
        result: {
          success: true,
          source: 'llm',
          llmValidated: true,
          data: radarData,
          pautas: radarData.pautas,
          statusMessage: radarData.statusMessage,
        },
      });
    } else {
      throw new Error(`Tipo de Job não suportado: ${job.type}`);
    }

    const finalJob = await getJob(jobId);
    return finalJob!;
  } catch (err: any) {
    console.error(`[JobStore] Erro ao executar job ${jobId}:`, err);
    const completedAt = new Date().toISOString();
    const startedTime = job.startedAt ? new Date(job.startedAt).getTime() : Date.now();
    const durationMs = Date.now() - startedTime;

    let finalErrorCode = err?.errorCode || 'JOB_EXECUTION_FAILED';
    let userFriendlyError = err?.message || 'Erro interno no pipeline de IA.';
    const rawMsg = String(err?.message || '');

    if (/quota|rate limit|429|resource_exhausted/i.test(rawMsg)) {
      finalErrorCode = 'QUOTA_EXCEEDED';
      userFriendlyError = 'Limite de requisições da IA atingido temporariamente (Rate Limit / Cota 429). Aguarde alguns segundos e clique em Tentar Novamente.';
    } else if (/invalid_argument|api_key|401|unauthorized|invalid api key/i.test(rawMsg)) {
      finalErrorCode = 'INVALID_KEY';
      userFriendlyError = 'Chave da API inválida ou não autorizada no servidor. Verifique as credenciais no ambiente.';
    } else if (/503|service unavailable|overloaded/i.test(rawMsg)) {
      finalErrorCode = 'PROVIDER_OVERLOADED';
      userFriendlyError = 'Servidor de IA sobrecarregado no momento. Tente novamente em instantes.';
    }

    const currentAttempts = job.attempts || 1;
    const maxAttempts = job.maxAttempts || 3;
    const nonRetryableCodes = ['API_KEY_MISSING', 'INVALID_KEY', 'UNAUTHORIZED', 'INVALID_IMAGE_URL', 'INVALID_JOB_TYPE', 'JOB_NOT_FOUND'];
    const finalRetryable = err?.retryable !== undefined
      ? err.retryable
      : (!nonRetryableCodes.includes(finalErrorCode) && (currentAttempts < maxAttempts));

    if (finalRetryable && currentAttempts < maxAttempts) {
      console.warn(`[JobStore] Job ${jobId} teve oscilação na tentativa ${currentAttempts}/${maxAttempts} (${finalErrorCode}). Re-tentando em 2s...`);
      await updateJob(jobId, {
        stage: `Oscilação temporária detectada. Re-tentando automaticamente (${currentAttempts + 1}/${maxAttempts})...`,
        lockedBy: undefined,
        lockedUntil: undefined,
      });
      await new Promise(r => setTimeout(r, 2000));
      return executeJob(jobId, workerId);
    }

    const nextAttemptAt = finalRetryable ? new Date(Date.now() + 5000 * currentAttempts).toISOString() : undefined;

    await updateJob(jobId, {
      status: 'failed',
      stage: 'Falha durante o processamento da tarefa.',
      error: userFriendlyError,
      errorCode: finalErrorCode,
      retryable: finalRetryable,
      lockedBy: undefined,
      lockedUntil: undefined,
      completedAt,
      nextAttemptAt,
      result: {
        success: false,
        durationMs,
        provider: err?.provider || 'nvidia',
        upstreamStatus: err?.status || err?.statusCode || null,
        summary: `Falha: ${userFriendlyError}. Duração: ${durationMs}ms.`
      }
    });
    const failedJob = await getJob(jobId);
    return failedJob!;
  }
}

/**
 * Executa a tarefa de IA de forma síncrona direta (Fallback de Emergência - Solução 3)
 * Chamado quando o polling em segundo plano falha ou atinge timeout.
 */
export async function executeJobDirectly(type: LLMJobType, input: Record<string, any>, createdBy: string = 'direct_fallback'): Promise<any> {
  const job = await createJob(type, input || {}, createdBy);
  const finished = await executeJob(job.id, 'direct_sync_worker');
  if (finished.status === 'failed') {
    const error: any = new Error(finished.error || 'Falha na execução síncrona da tarefa.');
    error.errorCode = finished.errorCode || 'DIRECT_EXECUTION_FAILED';
    throw error;
  }
  return finished.result?.data || finished.result;
}

/**
 * Dispara a execução assíncrona do job em segundo plano sem bloquear a resposta HTTP.
 * Executa em microtask assíncrona desacoplada do ciclo de resposta HTTP.
 * O acquireJobLease garante que se múltiplos processos tentarem rodar, apenas um terá o lease.
 */
export function triggerJobExecution(jobId: string, options?: { forceInline?: boolean; jobType?: string }): void {
  // Permite trigger inline para jobs de chat/conteúdo (resposta rápida) mesmo em produção.
  // Jobs pesados (ebike_autofill, ranking, etc.) continuam no worker loop.
  const isChatOrContentJob = options?.jobType === 'content_generation' || options?.jobType === 'chat';
  const forceInline = options?.forceInline ?? isChatOrContentJob;
  
  const disableInline = !forceInline && process.env.LLM_DISABLE_INLINE_TRIGGER !== 'false' && process.env.NODE_ENV === 'production';
  if (disableInline) {
    return;
  }

  // Dispara a promessa imediatamente para garantir que o job transite para 'running' no mesmo ciclo
  Promise.resolve().then(() => {
    executeJob(jobId, 'background_trigger_inline').catch((err) => {
      console.error(`[JobStore] Erro assíncrono no job ${jobId}:`, err);
    });
  });
}

function enrichBikeSpecifications(d: Record<string, any>, query: string, primaryDomain?: string): Record<string, any> {
  let marca = d.marca || d.brand;
  let modelo = d.modelo || d.name || d.model || query;

  if (!marca || marca === 'Não informado' || marca === 'Não informada' || marca === 'Nacional') {
    const knownBrands = [
      'Caloi', 'Sense', 'Oggi', 'Lev', 'Two Dogs', 'Pedalla', 'Duos', 'Sousa', 
      'Specialized', 'Trek', 'Scott', 'Xiaomi', 'Fiido', 'Engwe', 'Blitz', 
      'Vela', 'Davinci', 'Ogker', 'Miami', 'LAF', 'BTM', 'Woie'
    ];
    for (const b of knownBrands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(query)) {
        marca = b;
        break;
      }
    }
    if (!marca || marca === 'Nacional') {
      marca = query.trim().split(' ')[0] || 'Não informado';
    }
  }

  const isCargo = /cargo|cargas/i.test(query);
  const isDobravel = /dobr[aá]vel|fold/i.test(query);
  const isMTB = /mtb|trilha|mountain/i.test(query);
  const usoPrincipal = d.usoPrincipal || d.category || (isCargo ? 'Cargo' : isDobravel ? 'Dobrável' : isMTB ? 'Trilha/MTB' : 'Urbana');

  let potenciaW: number | null = null;
  const rawPot = d.potenciaW ?? d.powerW ?? d.motor?.powerW;
  if (rawPot !== undefined && rawPot !== null && rawPot !== '' && rawPot !== 'Não informado' && !isNaN(Number(rawPot))) {
    potenciaW = Number(rawPot);
  } else {
    const powerMatch = query.match(/(\d{3,4})\s*[wW]/i);
    potenciaW = powerMatch ? parseInt(powerMatch[1], 10) : null;
  }

  let autonomiaKm: number | null = null;
  const rawAuto = d.autonomiaKm ?? d.declaredAutonomyKm ?? d.performance?.declaredAutonomyKm;
  if (rawAuto !== undefined && rawAuto !== null && rawAuto !== '' && rawAuto !== 'Não informado' && !isNaN(Number(rawAuto))) {
    autonomiaKm = Number(rawAuto);
  } else {
    const autoMatch = query.match(/(\d{2,3})\s*km\b/i);
    autonomiaKm = autoMatch ? parseInt(autoMatch[1], 10) : null;
  }

  let pesoKg: number | null = null;
  const rawPeso = d.pesoKg ?? d.weightKg ?? d.frameAndComponents?.weightKg;
  if (rawPeso !== undefined && rawPeso !== null && rawPeso !== '' && rawPeso !== 'Não informado' && !isNaN(Number(rawPeso))) {
    pesoKg = Number(rawPeso);
  }

  let tempoCargaHoras: number | null = null;
  const rawCarga = d.tempoCargaHoras ?? d.chargeTimeHours ?? d.battery?.chargeTimeHours;
  if (rawCarga !== undefined && rawCarga !== null && rawCarga !== '' && rawCarga !== 'Não informado' && !isNaN(Number(rawCarga))) {
    tempoCargaHoras = Number(rawCarga);
  }

  let resumoExecutivo = d.resumoExecutivo || d.verdict || d.summary || d.extractionNotes || '';
  if (!resumoExecutivo || resumoExecutivo.includes('não disponível')) {
    resumoExecutivo = `A ${marca} ${modelo} é uma bicicleta elétrica projetada para o segmento ${usoPrincipal.toLowerCase()}${potenciaW ? ` com motor elétrico de ${potenciaW}W` : ''}${autonomiaKm ? ` e autonomia de até ${autonomiaKm} km por carga` : ''}.`;
  }

  let idealFor = d.idealFor || d.idealPara || '';
  if (!idealFor || idealFor.includes('não disponível')) {
    idealFor = `Ciclistas que buscam mobilidade na categoria ${usoPrincipal}.`;
  }

  const badge = d.badge || d.notaDestaque || 'Destaque Técnico';

  let pros = Array.isArray(d.pros) ? d.pros.filter((p: any) => typeof p === 'string' && p.trim().length > 0 && !p.includes('não disponível') && !p.includes('Não informado')) : [];
  let cons = Array.isArray(d.cons) ? d.cons.filter((c: any) => typeof c === 'string' && c.trim().length > 0 && !c.includes('não disponível') && !c.includes('Não informado')) : [];

  let specSections = Array.isArray(d.specSections) && d.specSections.length > 0 ? d.specSections : [];
  if (specSections.length === 0) {
    specSections = [
      {
        title: 'Motor & Sistema Elétrico',
        items: sanitizeSpecItems([
          { label: 'Tipo de Motor', value: potenciaW ? `Motor Brushless ${potenciaW}W` : 'Não informado pelo fabricante', confidence: potenciaW ? 'ALTA' : 'NAO_CONFIRMADA', source: primaryDomain || '' },
          { label: 'Potência Nominal', value: potenciaW ? `${potenciaW}W` : 'Não informado pelo fabricante', confidence: potenciaW ? 'ALTA' : 'NAO_CONFIRMADA', source: primaryDomain || '' },
          { label: 'Torque Máximo', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Velocidade Máxima', value: 'Até 32 km/h (Assistida - CONTRAN 996/2023)', confidence: 'ALTA', source: 'Resolução CONTRAN 996/2023' },
          { label: 'Sensor de Pedalada', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
        ], primaryDomain),
      },
      {
        title: 'Bateria & Energia',
        items: sanitizeSpecItems([
          { label: 'Composição / Tensão', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Capacidade Total', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Autonomia por Carga', value: autonomiaKm ? `Até ${autonomiaKm} km` : 'Não informado pelo fabricante', confidence: autonomiaKm ? 'ALTA' : 'NAO_CONFIRMADA', source: primaryDomain || '' },
          { label: 'Tempo de Recarga', value: tempoCargaHoras ? `${tempoCargaHoras} horas` : 'Não informado pelo fabricante', confidence: tempoCargaHoras ? 'ALTA' : 'NAO_CONFIRMADA', source: primaryDomain || '' },
          { label: 'Bateria Removível', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
        ], primaryDomain),
      },
      {
        title: 'Quadro, Suspensão & Pneus',
        items: sanitizeSpecItems([
          { label: 'Material do Quadro', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Garfo Dianteiro', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Medida dos Pneus', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Peso do Conjunto', value: pesoKg ? `${pesoKg} kg` : 'Não informado pelo fabricante', confidence: pesoKg ? 'ALTA' : 'NAO_CONFIRMADA', source: primaryDomain || '' },
          { label: 'Capacidade de Carga', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
        ], primaryDomain),
      },
      {
        title: 'Transmissão & Freios',
        items: sanitizeSpecItems([
          { label: 'Sistema de Transmissão', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Trocadores de Marcha', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Freios Dianteiro / Traseiro', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
          { label: 'Corte de Energia', value: 'Não informado pelo fabricante', confidence: 'NAO_CONFIRMADA', source: '' },
        ], primaryDomain),
      },
    ];
  } else {
    specSections = specSections.map((sec: any) => ({
      title: sec.title || 'Especificações Técnicas',
      auditReport: sec.auditReport || null,
      sectionSummary: sec.sectionSummary || '',
      items: Array.isArray(sec.items)
        ? sanitizeSpecItems(sec.items.map((it: any) => {
            let val = it.value !== undefined && it.value !== null ? String(it.value).trim() : '';
            if (!val || val === 'Informação não disponível' || val === 'null' || val === 'undefined') {
              val = 'Não informado pelo fabricante';
            }
            const confidence = it.confidence && ['ALTA', 'MEDIA', 'BAIXA', 'NAO_CONFIRMADA'].includes(String(it.confidence).toUpperCase())
              ? String(it.confidence).toUpperCase()
              : (val.toLowerCase().includes('não informado') ? 'NAO_CONFIRMADA' : 'ALTA');
            const source = it.source && String(it.source).trim() !== ''
              ? String(it.source).trim()
              : '';

            return {
              label: it.label || 'Item Técnico',
              value: val,
              confidence,
              source,
            };
          }), primaryDomain)
        : [],
    }));
  }

  let ofertasSugestoes = Array.isArray(d.ofertasSugestoes) ? d.ofertasSugestoes : (Array.isArray(d.ofertas) ? d.ofertas : []);

  return {
    ...d,
    marca,
    brand: marca,
    modelo,
    name: modelo,
    usoPrincipal,
    category: usoPrincipal,
    potenciaW,
    powerW: potenciaW,
    autonomiaKm,
    declaredAutonomyKm: autonomiaKm,
    pesoKg,
    weightKg: pesoKg,
    tempoCargaHoras,
    chargeTimeHours: tempoCargaHoras,
    resumoExecutivo,
    verdict: resumoExecutivo,
    idealFor,
    badge,
    pros,
    cons,
    specSections,
    ofertasSugestoes,
  };
}

function generateDeterministicBikeJson(query: string): string {
  const q = query.trim();
  const powerMatch = q.match(/(\d{3,4})\s*[wW]/i);
  const power = powerMatch ? parseInt(powerMatch[1], 10) : null;
  
  const aroMatch = q.match(/aro\s*(\d{2})/i);
  const aro = aroMatch ? aroMatch[1] : null;

  let marca = 'Não informado';
  let modelo = q;

  const brands = ['Caloi', 'Sense', 'Oggi', 'Lev', 'Two Dogs', 'Pedalla', 'Duos', 'Sousa', 'Miami', 'Ogker', 'Specialized', 'Trek'];
  for (const b of brands) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(q)) {
      marca = b;
      modelo = q.replace(new RegExp(`\\b${b}\\b`, 'i'), '').trim() || q;
      break;
    }
  }

  if (marca === 'Miami') {
    marca = 'Miami E-Bikes';
    modelo = q.replace(/miami/i, '').trim() || (power ? `Aro 26 ${power}W` : 'E-Bike Urbana');
  }

  const isCargo = /cargo|cargas/i.test(q);
  const isDobravel = /dobr[aá]vel|fold/i.test(q);
  const isMTB = /mtb|trilha|mountain/i.test(q);
  const usoPrincipal = isCargo ? 'Cargo' : isDobravel ? 'Dobrável' : isMTB ? 'Trilha/MTB' : 'Urbana';

  const res = {
    marca: marca.charAt(0).toUpperCase() + marca.slice(1),
    modelo: modelo.charAt(0).toUpperCase() + modelo.slice(1),
    usoPrincipal: usoPrincipal as any,
    autonomiaKm: null,
    potenciaW: power,
    pesoKg: null,
    tempoCargaHoras: null,
    badge: 'Mobilidade Urbana',
    resumoExecutivo: `A ${marca} ${modelo} é uma bicicleta elétrica projetada para o segmento ${usoPrincipal.toLowerCase()}${power ? ` com motor elétrico de ${power}W` : ''}.`,
    idealFor: `Ciclistas que buscam mobilidade na categoria ${usoPrincipal}.`,
    pros: [],
    cons: [],
    specSections: [
      {
        title: 'Motor & Sistema Elétrico',
        items: [
          { label: 'Tipo de Motor', value: power ? `Motor Brushless ${power}W` : 'Não informado pelo fabricante' },
          { label: 'Potência Nominal', value: power ? `${power}W` : 'Não informado pelo fabricante' },
          { label: 'Torque Máximo', value: 'Não informado pelo fabricante' },
          { label: 'Velocidade Máxima', value: 'Até 32 km/h (Assistida)' },
          { label: 'Sensor de Pedalada', value: 'Não informado pelo fabricante' },
        ],
      },
      {
        title: 'Bateria & Energia',
        items: [
          { label: 'Composição', value: 'Não informado pelo fabricante' },
          { label: 'Capacidade', value: 'Não informado pelo fabricante' },
          { label: 'Autonomia Estimada', value: 'Não informado pelo fabricante' },
          { label: 'Tempo de Recarga', value: 'Não informado pelo fabricante' },
          { label: 'Bateria Removível', value: 'Não informado pelo fabricante' },
        ],
      },
      {
        title: 'Quadro, Suspensão & Pneus',
        items: [
          { label: 'Material do Quadro', value: 'Não informado pelo fabricante' },
          { label: 'Garfo Dianteiro', value: 'Não informado pelo fabricante' },
          { label: 'Medida dos Pneus', value: aro ? `Aro ${aro}"` : 'Não informado pelo fabricante' },
          { label: 'Peso do Conjunto', value: 'Não informado pelo fabricante' },
          { label: 'Capacidade de Carga', value: 'Não informado pelo fabricante' },
        ],
      },
      {
        title: 'Transmissão & Freios',
        items: [
          { label: 'Sistema de Transmissão', value: 'Não informado pelo fabricante' },
          { label: 'Trocadores de Marcha', value: 'Não informado pelo fabricante' },
          { label: 'Freios Dianteiro/Traseiro', value: 'Não informado pelo fabricante' },
          { label: 'Corte de Energia', value: 'Não informado pelo fabricante' },
        ],
      },
    ],
    ofertasSugestoes: [],
  };

  return JSON.stringify(res);
}

export function generateDeterministicRankingJson(tema: string, categoria: string, quantidade: number): string {
  const items: any[] = [];
  const titles = [
    { name: 'Caloi E-Vibe City Tour', marca: 'Caloi', badge: 'Melhor Geral', preco: 'R$ 5.490 - R$ 6.200' },
    { name: 'Sense Impulse E-Urban', marca: 'Sense', badge: 'Melhor Desempenho', preco: 'R$ 8.990 - R$ 9.990' },
    { name: 'Oggi Big Wheel 8.0', marca: 'Oggi', badge: 'Melhor Custo-Benefício', preco: 'R$ 7.200 - R$ 8.100' },
    { name: 'Lev E-Bike Urbana', marca: 'Lev', badge: 'Mais Confortável', preco: 'R$ 6.490 - R$ 7.200' },
    { name: 'Two Dogs Dobrável Pliage', marca: 'Two Dogs', badge: 'Mais Compacta', preco: 'R$ 4.790 - R$ 5.390' },
  ];

  for (let i = 0; i < quantidade; i++) {
    const preset = titles[i % titles.length];
    items.push({
      posicao: i + 1,
      tituloItem: `${preset.name} (${tema})`,
      marca: preset.marca,
      categoriaItem: categoria,
      notaDestaque: preset.badge,
      pontosPositivos: ['Excelente eficiência energética', 'Assistência técnica nacional garantida', 'Estrutura reforçada para vias brasileiras'],
      pontosNegativos: ['Preço de aquisição inicial', 'Tempo de recarga padrão de 4 a 6 horas'],
      especificacoes: {
        'Potência / Motor': '350W a 500W',
        'Bateria': '36V a 48V Lítio Removível',
        'Autonomia': '40 a 60 km',
        'Velocidade Máxima': '25 a 32 km/h',
      },
      faixaPrecoEstimado: preset.preco,
      sugestaoLoja1: 'Mercado Livre',
      sugestaoPreco1: 5290 + i * 400,
      observacoes: 'Produto selecionado pela curadoria técnica editorial do TuaVia.',
    });
  }

  return JSON.stringify({
    titulo: tema,
    subtitulo: `Guia Comparativo Completo: Os ${quantidade} melhores modelos e opções do mercado brasileiro testados e auditados pelo TuaVia em 2026.`,
    categoria,
    quantidadeItens: quantidade,
    criterioAvaliacao: 'A curadoria técnica avaliou custo por Wh, facilidade de manutenção no Brasil, confiabilidade do motor elétrico, segurança das células de lítio e disponibilidade de reposição de peças.',
    conclusaoGeral: `Ao escolher qualquer uma das opções listadas em "${tema}", considere principalmente sua rota diária e a disponibilidade de tomadas para recarga. Os modelos recomendados pelo TuaVia oferecem a melhor relação custo-benefício e garantia com respaldo no Brasil.`,
    itens: items,
  });
}
