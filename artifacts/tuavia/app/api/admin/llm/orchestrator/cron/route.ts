import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkerSecret } from '@/lib/serverAdminAuth';
import { getAutoCycleStatus, triggerDueCycle } from '@/lib/orchestration/autoCycleScheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gatilho de cron para o ciclo de curadoria.
 *
 * O worker de IA (`scripts/process-llm-jobs-loop.mjs`) é JavaScript puro de
 * propósito: roda com `node`, sem etapa de transpilação, porque é o processo
 * que sobe junto com o app na hospedagem compartilhada. Por isso ele não pode
 * importar `lib/orchestration/autoCycleScheduler.ts` diretamente.
 *
 * A saída é esta rota: o worker chama por HTTP no próprio host, e o código
 * TypeScript roda no runtime do Next, onde já tem todas as dependências.
 *
 * A autenticação é pelo segredo do worker (`x-worker-secret`), com falha
 * fechada quando `LLM_WORKER_SECRET` não está definido.
 */
export async function GET(req: NextRequest) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const before = getAutoCycleStatus();
    const wasDue = !before.lastRunAt || new Date(before.nextRunAt ?? 0).getTime() <= Date.now();

    // Só dispara se estiver vencido; caso contrário, devolve o estado atual.
    triggerDueCycle();

    return NextResponse.json({
      success: true,
      triggered: wasDue,
      status: getAutoCycleStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Falha no ciclo.' },
      { status: 500 }
    );
  }
}
