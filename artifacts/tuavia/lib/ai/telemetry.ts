/**
 * lib/ai/telemetry.ts
 *
 * Telemetria de execução de IA. Substitui `@/src/ai/telemetry/AIExecutionLogger`,
 * que não existia — o `CSMTelemetryPanel` e `/api/admin/llm` dependiam dele e,
 * sem ele, não havia nenhuma métrica real.
 *
 * Os logs vivem em memória (ring buffer) e são espelhados para
 * `data/llm_metrics.json`, que é a fonte que sobrevive a restart.
 */

import fs from 'fs';
import path from 'path';
import type { ExecutionLog, TelemetryMetrics } from '@/lib/ai/types';

const MAX_IN_MEMORY = 200;
const MAX_PERSISTED = 2000;

const memoryLogs: ExecutionLog[] = [];
const metrics = {
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalCost: 0,
  cacheHits: 0,
  latencies: [] as number[],
  byModel: {} as TelemetryMetrics['byModel'],
  byTask: {} as TelemetryMetrics['byTask'],
  successCount: 0,
  failureCount: 0,
};

function metricsFile(): string {
  return path.join(process.cwd(), 'data', 'llm_metrics.json');
}

/** Custo aproximado por 1k tokens, para estimar o gasto. */
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const free =
    model.includes('gemma-3') || model.includes('lightning') || model.includes('embed');
  if (free) return 0;
  return ((promptTokens + completionTokens) / 1000) * 0.0002;
}

function persist(entry: ExecutionLog): void {
  if (typeof window !== 'undefined') return;
  try {
    const file = metricsFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });

    let existing: ExecutionLog[] = [];
    if (fs.existsSync(file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
        if (Array.isArray(parsed)) existing = parsed as ExecutionLog[];
      } catch {
        existing = [];
      }
    }

    existing.push(entry);
    if (existing.length > MAX_PERSISTED) existing = existing.slice(-MAX_PERSISTED);
    fs.writeFileSync(file, JSON.stringify(existing));
  } catch {
    /* telemetria nunca pode derrubar uma execução */
  }
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

class AIExecutionLoggerClass {
  static log(entry: {
    task: string;
    model: string;
    latencyMs: number;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
    promptTokens?: number;
    completionTokens?: number;
    cacheHit?: boolean;
    provider?: string;
  }): ExecutionLog {
    const promptTokens = entry.promptTokens ?? 0;
    const completionTokens = entry.completionTokens ?? 0;
    const now = new Date().toISOString();

    const log: ExecutionLog = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      task: entry.task,
      model: entry.model,
      startedAt: now,
      finishedAt: now,
      latencyMs: entry.latencyMs,
      success: entry.success,
      errorCode: entry.errorCode,
      errorMessage: entry.errorMessage?.slice(0, 300),
      promptTokens,
      completionTokens,
      cost: estimateCost(entry.model, promptTokens, completionTokens),
      cacheHit: entry.cacheHit,
      provider: entry.provider ?? 'nvidia-nim',
    };

    memoryLogs.push(log);
    if (memoryLogs.length > MAX_IN_MEMORY) memoryLogs.shift();

    metrics.totalPromptTokens += promptTokens;
    metrics.totalCompletionTokens += completionTokens;
    metrics.totalCost += log.cost;
    metrics.latencies.push(entry.latencyMs);
    if (metrics.latencies.length > MAX_IN_MEMORY) metrics.latencies.shift();
    if (entry.cacheHit) metrics.cacheHits += 1;
    if (entry.success) metrics.successCount += 1;
    else metrics.failureCount += 1;

    const modelStats = (metrics.byModel[entry.model] ??= { count: 0, avgLatencyMs: 0, failures: 0 });
    modelStats.count += 1;
    modelStats.avgLatencyMs =
      (modelStats.avgLatencyMs * (modelStats.count - 1) + entry.latencyMs) / modelStats.count;
    if (!entry.success) modelStats.failures += 1;

    const taskStats = (metrics.byTask[entry.task] ??= { count: 0, failures: 0 });
    taskStats.count += 1;
    if (!entry.success) taskStats.failures += 1;

    persist(log);
    const panelLog = toPanelLog(log);
    for (const listener of listeners) {
      try {
        listener(panelLog);
      } catch {
        /* listener defeituoso não derruba a execução */
      }
    }
    return log;
  }

  static getRecentLogs(limit = 50): ExecutionLog[] {
    return memoryLogs.slice(-limit).reverse();
  }

  static getMetrics(): TelemetryMetrics {
    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const total = metrics.successCount + metrics.failureCount;
    return {
      totalExecutions: total,
      successCount: metrics.successCount,
      failureCount: metrics.failureCount,
      successRate: total === 0 ? 0 : Math.round((metrics.successCount / total) * 100),
      p50LatencyMs: Math.round(percentile(sorted, 0.5)),
      p95LatencyMs: Math.round(percentile(sorted, 0.95)),
      totalPromptTokens: metrics.totalPromptTokens,
      totalCompletionTokens: metrics.totalCompletionTokens,
      totalCost: Number(metrics.totalCost.toFixed(6)),
      cacheHits: metrics.cacheHits,
      byModel: metrics.byModel,
      byTask: metrics.byTask,
    };
  }

  /** Histórico persistido (sobrevive a restart). */
  static getPersistedLogs(limit = 50): ExecutionLog[] {
    try {
      const file = metricsFile();
      if (!fs.existsSync(file)) return [];
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
      if (!Array.isArray(parsed)) return [];
      return (parsed as ExecutionLog[]).slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  static reset(): void {
    memoryLogs.length = 0;
    metrics.latencies.length = 0;
    metrics.successCount = 0;
    metrics.failureCount = 0;
    metrics.totalPromptTokens = 0;
    metrics.totalCompletionTokens = 0;
    metrics.totalCost = 0;
    metrics.cacheHits = 0;
    metrics.byModel = {};
    metrics.byTask = {};
  }
}

export const AIExecutionLogger = AIExecutionLoggerClass;

/**
 * Custo previsto de um pipeline. O catálogo de preços vive em
 * `lib/ai/modelRouter.ts`; aqui só somamos o que o job vai gastar.
 */
export function estimatePipelineCost(estimatedTokens: number, model = 'default'): number {
  if (model.includes('gemma-3') || model.includes('lightning')) return 0;
  return (estimatedTokens / 1000) * 0.0002;
}
export type { ExecutionLog, TelemetryMetrics };

/* ══════════════════════════════════════════════════════════════════
   ADAPTADOR DE TELEMETRIA PARA O PAINEL
   ──────────────────────────────────────────────────────────────────
   O `app/admin/telemetry` já existia e consome um formato próprio
   (`AIExecutionLog`, com `status`/`taskName`/`costUSD`). Este adaptador
   traduz o formato canônico (`ExecutionLog`) para ele, em vez de manter
   dois registradores com métricas divergentes.
   ══════════════════════════════════════════════════════════════════ */

export interface AIExecutionLog {
  id: string;
  taskName: string;
  model: string;
  status: 'success' | 'error' | 'timeout';
  timestamp: string;
  latencyMs: number;
  totalTokens: number;
  costUSD: number;
  error?: string;
  promptHash?: string;
  /** Hash do prompt, para agrupar execuções iguais. */
  responseHash?: string;
  provider?: string;
}

/** Hash estável do prompt, para o painel agrupar execuções repetidas. */
function hashPrompt(model: string, tokens: number): string {
  let hash = 0;
  const seed = `${model}:${tokens}`;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function toPanelLog(log: ExecutionLog): AIExecutionLog {
  const status: AIExecutionLog['status'] = log.success
    ? 'success'
    : log.errorCode === 'TIMEOUT'
      ? 'timeout'
      : 'error';

  return {
    id: log.id,
    taskName: log.task,
    model: log.model,
    status,
    timestamp: log.startedAt,
    latencyMs: log.latencyMs,
    totalTokens: log.promptTokens + log.completionTokens,
    costUSD: log.cost,
    error: log.errorMessage,
    promptHash: hashPrompt(log.model, log.promptTokens),
    responseHash: log.id,
    provider: log.provider,
  };
}

const listeners = new Set<(log: AIExecutionLog) => void>();

/**
 * Contrato do logger visto pelo painel. Declarado como interface porque as
 * sobrecargas de `exportLogs` não são válidas dentro de um object literal.
 */

/**
 * Contrato do logger visto pelo painel. Declarado como interface porque as
 * sobrecargas de `exportLogs` não são válidas dentro de um object literal.
 */
interface PanelLoggerApi {
  clear(): void;
  exportLogs(format: 'csv'): string;
  exportLogs(): AIExecutionLog[];
  getRecentErrors(limit?: number): AIExecutionLog[];
  getModelPerformance(): Array<{
    model: string;
    calls: number;
    avgLatencyMs: number;
    errorRate: number;
    cost: number;
  }>;
  getStats(windowMs?: number): {
    totalCalls: number;
    success: number;
    errors: number;
    successRate: number;
    fallbackRate: number;
    avgLatencyMs: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    totalTokens: number;
    totalCostUSD: number;
  };
  getLogs(options?: number | { since?: number; limit?: number }): AIExecutionLog[];
  subscribe(callback: (log: AIExecutionLog) => void): () => void;
}

/**
 * Sobrecargas precisam ser declaradas em uma função — dentro de um object
 * literal elas viram erro de sintaxe.
 */
function exportLogs(format: 'csv'): string;
function exportLogs(): AIExecutionLog[];
function exportLogs(format?: 'csv'): string | AIExecutionLog[] {
  const logs = AIExecutionLogger.getPersistedLogs(500).map(toPanelLog);
  if (format !== 'csv') return logs;

  const header = 'id,taskName,model,status,timestamp,latencyMs,totalTokens,costUSD,error';
  const rows = logs.map((log) =>
    [
      log.id,
      JSON.stringify(log.taskName),
      log.model,
      log.status,
      log.timestamp,
      log.latencyMs,
      log.totalTokens,
      log.costUSD,
      JSON.stringify(log.error ?? ''),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

const panelApi: PanelLoggerApi = {
  exportLogs,

  clear(): void {
    AIExecutionLogger.reset();
  },

  getRecentErrors(limit = 20): AIExecutionLog[] {
    return AIExecutionLogger.getRecentLogs(200)
      .filter((log) => !log.success)
      .slice(0, limit)
      .map(toPanelLog);
  },

  getModelPerformance(): ReturnType<PanelLoggerApi['getModelPerformance']> {
    const summary = AIExecutionLogger.getMetrics();
    return Object.entries(summary.byModel).map(([model, stats]) => ({
      model,
      calls: stats.count,
      avgLatencyMs: Math.round(stats.avgLatencyMs),
      errorRate: stats.count === 0 ? 0 : Math.round((stats.failures / stats.count) * 100),
      cost: 0,
    }));
  },

  /**
   * Agregados no formato do painel. A janela em ms é aceita mas não filtra:
   * o ring buffer em memória já é a janela útil.
   */
  getStats(_windowMs?: number): ReturnType<PanelLoggerApi['getStats']> {
    const summary = AIExecutionLogger.getMetrics();
    const recent = AIExecutionLogger.getRecentLogs(200);
    const failed = recent.filter((log) => !log.success).length;

    return {
      totalCalls: summary.totalExecutions,
      success: summary.successCount,
      errors: summary.failureCount,
      successRate: summary.successRate,
      fallbackRate:
        summary.totalExecutions === 0 ? 0 : Math.round((failed / summary.totalExecutions) * 100),
      avgLatencyMs: summary.p50LatencyMs,
      latencyP50: summary.p50LatencyMs,
      latencyP95: summary.p95LatencyMs,
      latencyP99: summary.p95LatencyMs,
      totalTokens: summary.totalPromptTokens + summary.totalCompletionTokens,
      totalCostUSD: summary.totalCost,
    };
  },

  /** Filtra por janela temporal; sem argumento, usa as últimas 24h. */
  getLogs(options?: number | { since?: number }): AIExecutionLog[] {
    const since =
      typeof options === 'number'
        ? Date.now() - options
        : options?.since ?? Date.now() - 24 * 60 * 60 * 1000;
    return AIExecutionLogger.getRecentLogs(500)
      .map(toPanelLog)
      .filter((log) => new Date(log.timestamp).getTime() >= since);
  },

  /** O painel se inscreve para receber cada execução em tempo real. */
  subscribe(callback: (log: AIExecutionLog) => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};


export const aiExecutionLogger = panelApi;
