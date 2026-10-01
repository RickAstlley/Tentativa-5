import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import {
  executeGlobalRadarSearch,
  getOrTriggerHourlyGlobalRadar,
  toggleStarGlobalRadarItem,
  deleteGlobalRadarItem,
  TechRegionKey,
  TechTopicKey,
} from '@/lib/globalRadarSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';
    const data = await getOrTriggerHourlyGlobalRadar({ force });
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error('Erro no GET /api/admin/llm/radar/global-search:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Falha ao obter feed do radar global' },
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
    const { action, pautaId, region, topic, customQuery, limit, saveToRadarStore } = body as {
      action?: 'toggle_star' | 'delete' | 'search';
      pautaId?: string;
      region?: TechRegionKey;
      topic?: TechTopicKey;
      customQuery?: string;
      limit?: number;
      saveToRadarStore?: boolean;
    };

    if (action === 'toggle_star' && pautaId) {
      const updated = await toggleStarGlobalRadarItem(pautaId);
      return NextResponse.json({ success: true, pauta: updated });
    }

    if (action === 'delete' && pautaId) {
      const deleted = await deleteGlobalRadarItem(pautaId);
      return NextResponse.json({ success: true, deleted });
    }

    const { createJob, triggerJobExecution } = await import('@/lib/ai/jobStore');
    const job = await createJob(
      'radar_scan',
      {
        region: region || 'all',
        topic: topic || 'all',
        customQuery: customQuery || '',
        limit: limit || 8,
        saveToRadarStore: true,
      },
      auth.email
    );

    triggerJobExecution(job.id);

    return NextResponse.json({
      success: true,
      queued: true,
      jobId: job.id,
      message: 'Varredura internacional iniciada em segundo plano! Acompanhando resultados...',
    });
  } catch (error: any) {
    console.error('Erro na API /api/admin/llm/radar/global-search:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Falha ao executar busca global de tecnologia',
      },
      { status: 500 }
    );
  }
}
