import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { getQueueStats } from '@/lib/ai/jobStore';
import { NvidiaProvider } from '@/lib/ai/providers/nvidia';
import { ALL_NVIDIA_MODEL_IDS, describeCatalog } from '@/lib/ai/nvidiaModelCatalog';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  ensureServerEnvLoaded();
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const apiKeys = NvidiaProvider.getApiKeys();
  const primaryNvidiaKey = apiKeys[0] || cleanEnvValue(process.env.NVIDIA_API_KEY);
  const nvidiaBaseUrl = NvidiaProvider.getBaseUrl();
  const isLocalNIM = nvidiaBaseUrl.includes('localhost') || nvidiaBaseUrl.includes('0.0.0.0') || nvidiaBaseUrl.includes('127.0.0.1');
  const workerSecret = cleanEnvValue(process.env.LLM_WORKER_SECRET);
  const baseUrl = cleanEnvValue(
    process.env.LLM_EXECUTOR_BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  );

  const nvidiaKeyConfigured = apiKeys.length > 0 || !!primaryNvidiaKey.trim() || isLocalNIM;
  const workerSecretConfigured = !!workerSecret.trim();
  const baseUrlConfigured = !!baseUrl.trim();

  let nvidiaStatus = 'not_configured';
  const modelStatus: Record<string, { operational: boolean; latencyMs?: number; error?: string }> = {};

  if (nvidiaKeyConfigured) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const startTime = Date.now();
      const res = await fetch(`${nvidiaBaseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${primaryNvidiaKey.trim() || 'local-nim-key'}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (res.status === 200) {
        nvidiaStatus = 'ok';
      } else if (res.status === 401 || res.status === 403) {
        nvidiaStatus = 'unauthorized';
      } else if (res.status === 429) {
        nvidiaStatus = 'rate_limited';
      } else {
        nvidiaStatus = `upstream_error_${res.status}`;
      }

      modelStatus['_catalog_endpoint'] = {
        operational: res.status === 200,
        latencyMs: latency,
        error: res.status === 200 ? undefined : `Status HTTP ${res.status}`,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        nvidiaStatus = 'timeout';
        modelStatus['_catalog_endpoint'] = { operational: false, error: 'Timeout de conexão (6s)' };
      } else {
        nvidiaStatus = 'unavailable';
        modelStatus['_catalog_endpoint'] = { operational: false, error: err.message };
      }
    }
  }

  // Catálogo real de `lib/ai/nvidiaModelCatalog.ts`. A lista antiga declarava 7
  // IDs à mão, dois deles fora do catálogo (`deepseek-ai/deepseek-v4.1-flash` e
  // `nvidia/nemotron-3-super-120b-a12b`), que nunca seriam o que roda.
  const officialModels = ALL_NVIDIA_MODEL_IDS as string[];

  for (const m of officialModels) {
    modelStatus[m] = {
      operational: nvidiaStatus === 'ok' || isLocalNIM,
      error: nvidiaStatus !== 'ok' && !isLocalNIM ? `NVIDIA status: ${nvidiaStatus}` : undefined,
    };
  }

  const queueStats = getQueueStats();
  const workerLoopEnabled = process.env.LLM_WORKER_LOOP_ENABLED !== 'false';
  const workerIntervalMs = parseInt(process.env.LLM_WORKER_INTERVAL_MS || '10000', 10) || 10000;
  const queueStatus = queueStats.status;
  const workerSecretStatus = workerSecretConfigured ? 'WORKER_SECRET_OK' : 'WORKER_SECRET_MISSING';
  const executorUrlStatus = baseUrlConfigured ? 'EXECUTOR_OK' : 'EXECUTOR_URL_MISSING';

  return NextResponse.json({
    success: true,
    queue: {
      configured: queueStats.configured,
      fileExists: queueStats.fileExists,
      fileWritable: queueStats.fileWritable,
      queued: queueStats.queued,
      running: queueStats.running,
      failedRetryable: queueStats.failedRetryable,
      total: queueStats.total,
      status: queueStatus,
      errorCode: queueStats.errorCode,
    },
    worker: {
      enabled: workerLoopEnabled,
      mode: 'continuous-supervisor',
      intervalMs: workerIntervalMs,
      secretConfigured: workerSecretConfigured,
      status: workerSecretStatus,
    },
    executor: {
      baseUrlConfigured,
      mode: 'continuous-supervisor',
      status: executorUrlStatus,
    },
    diagnostics: {
      queueStatus,
      workerSecretStatus,
      executorUrlStatus,
      isLocalNIM,
      nvidiaBaseUrl,
      /** Catálogo ativo, uma linha por modelo. Qualquer ID que apareça aqui e não
       *  esteja na lista é sinal de que o código e o catálogo divergiram. */
      catalog: describeCatalog(),
    },
    providers: {
      nvidiaConfigured: nvidiaKeyConfigured,
      nvidiaBaseUrl,
      isLocalNIM,
      nvidiaConnectivity: nvidiaStatus,
    },
    models: modelStatus,
    nvidiaKeyConfigured,
    workerSecretConfigured,
    textProvider: 'nvidia_only',
    visionProvider: 'nvidia_multimodal_vision',
    executorMode: 'continuous-supervisor',
    baseUrlConfigured,
    nvidiaConnectivity: nvidiaStatus,
  });
}
