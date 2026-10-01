import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { getAutoCycleStatus, executeScheduledCycle } from '@/lib/orchestration/autoCycleScheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const status = getAutoCycleStatus();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao obter status do orquestrador' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, forceAll, skipRadar } = body;

    if (action === 'run_cycle') {
      const status = getAutoCycleStatus();
      if (status.isProcessing) {
        return NextResponse.json(
          {
            success: false,
            error: 'O orquestrador já está executando uma etapa no momento. Aguarde o término.',
            status,
          },
          { status: 409 }
        );
      }

      // Dispara em background
      executeScheduledCycle({ forceAll: forceAll ?? true, forceGlobal: !skipRadar, forceAiRadar: !skipRadar }).catch((err) =>
        console.warn('[Orchestrator Manual Trigger Error]', err)
      );

      return NextResponse.json({
        success: true,
        message: 'Ciclo serial (Home -> Radar) iniciado com sucesso em segundo plano.',
        status: getAutoCycleStatus(),
      });
    }

    return NextResponse.json({ success: false, error: 'Ação desconhecida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao executar comando no orquestrador' },
      { status: 500 }
    );
  }
}
