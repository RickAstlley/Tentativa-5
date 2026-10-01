import { NextRequest, NextResponse } from 'next/server';
import { aiExecutionLogger, type AIExecutionLog } from '@/lib/ai/telemetry';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);

  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado aos logs e métricas.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // Retorna os logs recentes e as métricas agregadas de telemetria e observabilidade (CSM)
  const logs = aiExecutionLogger.getLogs(50);
  const metrics = aiExecutionLogger.getStats();
  // O painel de telemetria consome nomes diferentes dos do formato interno.
  // Derivar os dois no mesmo lugar evita que a tela e a API fiquem fora de
  // sincronia quando um campo novo aparecer.
  const today = logs.filter(
    (log: AIExecutionLog) => new Date(log.timestamp).toDateString() === new Date().toDateString()
  );
  
  return NextResponse.json({
    logs,
    metrics,
    panelMetrics: {
      totalCalls: metrics.totalCalls,
      totalCallsToday: today.length,
      totalTokens: metrics.totalTokens,
      avgTokensPerExecution:
        metrics.totalCalls === 0 ? 0 : Math.round(metrics.totalTokens / metrics.totalCalls),
      averageLatencyMs: metrics.avgLatencyMs,
      avgLatencyMs: metrics.avgLatencyMs,
      imageLlmCountTotal: 0,
      imageLlmCountToday: today.filter((log: AIExecutionLog) => log.taskName === 'image_search').length,
      tokenStats: { prompt: 0, completion: 0, total: metrics.totalTokens },
      cacheHitRate: 0,
    },
  });
}
