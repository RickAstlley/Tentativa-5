import { fetchAdminJson } from './clientResponse';

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

import type { LLMJob, LLMJobStatus } from '@/lib/ai/jobStore';

/**
 * `LLMJob` é definido UMA vez, em `lib/ai/jobStore.ts` (que é quem cria e
 * executa os jobs). Este arquivo só fala com a fila; redeclarar o tipo aqui
 * criava uma segunda forma do mesmo job — sem `usage`, com `attempts`
 * opcional — e quem importasse um ou outro enxergava coisas diferentes.
 */
export type { LLMJob, LLMJobStatus } from '@/lib/ai/jobStore';

export interface PollOptions {
  type: LLMJobType;
  input: any;
  onProgress?: (job: LLMJob) => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  allowSyncFallback?: boolean;
}

export interface ExistingPollOptions {
  jobId: string;
  type?: LLMJobType;
  input?: any;
  onProgress?: (job: LLMJob) => void;
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

function getInitialStageForType(type: LLMJobType): string {
  switch (type) {
    case 'content_generation':
      return 'Agente Redator: Estruturando pauta e conteúdo editorial...';
    case 'ranking_generation':
      return 'Agente de Curadoria: Classificando produtos e critérios...';
    case 'ebike_autofill':
    case 'ebike_section_autofill':
      return 'Agente Técnico: Analisando ficha técnica e especificações...';
    case 'ebike_seo':
    case 'article_seo':
      return 'Agente SEO: Otimizando metadados, GEO e Rich Snippets...';
    case 'image_research':
    case 'image_search_validate':
      return 'Agente Visual: Pesquisando e validando fotografias oficiais...';
    case 'radar_scan':
    case 'ai_radar_scan':
      return 'Agente Radar: Monitorando fontes do setor em tempo real...';
    default:
      return 'Agente Especialista: Processando solicitação...';
  }
}

function getIntermediateStageForType(type: LLMJobType, progress: number): string {
  if (progress <= 35) {
    return 'Consultando base de conhecimento e diretrizes TuaVia...';
  }
  if (progress <= 70) {
    return 'Gerando e formatando resposta estruturada com IA...';
  }
  return 'Validando conformidade técnica e integridade dos dados...';
}

/**
 * Executa a tarefa de IA diretamente via Agente Especialista síncrono.
 * Proporciona resposta rápida em 2 a 6 segundos sem filas ou deadlocks de polling.
 */
export async function createAndPollLLMJob(options: PollOptions): Promise<LLMJob> {
  const { type, input, onProgress, signal } = options;
  const directId = `agent_${type}_${Date.now()}`;
  const startTime = new Date().toISOString();

  let currentProgress = 15;
  const initialStage = getInitialStageForType(type);

  if (onProgress) {
    onProgress({
      id: directId,
      type,
      status: 'running',
      progress: currentProgress,
      stage: initialStage,
      input,
      attempts: 1,
      maxAttempts: 1,
      createdAt: startTime,
      updatedAt: startTime,
    });
  }

  try {
    // Enfileira e devolve imediatamente. O caminho sincrono (`sync: true`)
    // segurava a requisicao por ate 5 minutos, e o "progresso" era animacao
    // local, nao o estado real do job.
    const queued = await fetchAdminJson<{ jobId?: string; job?: { id?: string } }>(
      '/api/admin/llm/jobs',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, input }),
        signal,
      }
    );

    if (!queued.ok) {
      const err: any = new Error(queued.error || 'Nao foi possivel enfileirar o job.');
      if (queued.errorCode) err.errorCode = queued.errorCode;
      throw err;
    }

    const jobId = queued.data?.jobId || queued.data?.job?.id;
    if (!jobId) throw new Error('O endpoint de jobs nao devolveu jobId.');

    return await waitForJob({
      jobId,
      type,
      input,
      onProgress,
      signal,
      pollIntervalMs: options.pollIntervalMs ?? 1500,
      maxPollAttempts: options.maxPollAttempts ?? 80,
      startTime,
    });
  } catch (err: any) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('cancelada')) {
      const abortErr: any = new Error('Operação cancelada pelo usuário.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  }
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'partial']);

/**
 * Aguarda o job chegar a um estado terminal, repassando o progresso real da
 * fila para a UI.
 */
async function waitForJob(options: {
  jobId: string;
  type: LLMJobType;
  input: unknown;
  onProgress?: (job: LLMJob) => void;
  signal?: AbortSignal;
  pollIntervalMs: number;
  maxPollAttempts: number;
  startTime: string;
}): Promise<LLMJob> {
  const { jobId, type, input, onProgress, signal, pollIntervalMs, maxPollAttempts, startTime } =
    options;

  let lastStage = '';

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    if (signal?.aborted) throw new Error('Operação cancelada.');

    const response = await fetchAdminJson<{ job?: LLMJob } & Partial<LLMJob>>(
      `/api/admin/llm/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', signal }
    );

    if (response.ok) {
      const job = (response.data?.job ?? response.data) as LLMJob | undefined;

      if (job) {
        // Só repassa quando a etapa muda, para não inundar a UI a cada 1,5s.
        if (onProgress && (job.stage !== lastStage || job.status === 'completed')) {
          lastStage = job.stage;
          onProgress(job);
        }

        if (job.status && TERMINAL_STATUSES.has(job.status)) {
          if (job.status === 'failed') {
            const error: any = new Error(job.error || 'O job falhou na fila.');
            if (job.errorCode) error.errorCode = job.errorCode;
            throw error;
          }
          return job;
        }
      }
    } else if (response.status === 404) {
      throw new Error(`Job ${jobId} não encontrado na fila.`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const error: any = new Error(
    `O job ${jobId} não concluiu em ${Math.round((maxPollAttempts * pollIntervalMs) / 1000)}s. ` +
      'Ele continua na fila e pode ser acompanhado em /admin/ia.'
  );
  error.errorCode = 'POLL_TIMEOUT';
  throw error;
}

/**
 * Recupera um job já enfileirado.
 *
 * A versão anterior devolvia um job `completed` sem consultar a fila: o painel
 * mostrava sucesso antes de o trabalho existir, e um job que falhava aparecia
 * como concluído.
 */
export async function pollExistingLLMJob(options: ExistingPollOptions): Promise<LLMJob> {
  const { jobId, type = 'content_generation', input = {}, onProgress, signal } = options;
  return waitForJob({
    jobId,
    type,
    input,
    onProgress,
    signal,
    pollIntervalMs: options.pollIntervalMs ?? 1500,
    maxPollAttempts: options.maxPollAttempts ?? 80,
    startTime: new Date().toISOString(),
  });
}
