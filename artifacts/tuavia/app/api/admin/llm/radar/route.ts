import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import {
  readRadarData,
  executeRadarScan,
  clearNonStarredPautas,
  toggleStarPauta,
  deletePauta,
  RADAR_INTERVAL_MS,
} from '@/lib/aiRadarService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const data = await readRadarData();
    const now = new Date();
    let nextScanInMinutes = 0;

    if (data.lastScanAt) {
      const elapsed = now.getTime() - new Date(data.lastScanAt).getTime();
      if (elapsed < RADAR_INTERVAL_MS) {
        nextScanInMinutes = Math.round((RADAR_INTERVAL_MS - elapsed) / (60 * 1000));
      }
    }

    return NextResponse.json({
      success: true,
      pautas: data.pautas || [],
      lastScanAt: data.lastScanAt,
      lastCleanupAt: data.lastCleanupAt,
      statusMessage: data.statusMessage,
      nextScanInMinutes,
      stats: {
        total: data.pautas.length,
        starredCount: data.pautas.filter((p) => p.starred).length,
        unstarredCount: data.pautas.filter((p) => !p.starred).length,
      },
    });
  } catch (error: any) {
    console.error('Erro na API /api/admin/llm/radar GET:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, pautaId } = body;

    if (action === 'scan') {
      if (body.direct === true) {
        const result = await executeRadarScan(true);
        return NextResponse.json({
          success: true,
          message: 'Varredura executada com sucesso!',
          data: result,
        });
      }

      // Executa de forma idêntica ao Radar Global: background job com polling e etapas em tempo real
      const { createJob, triggerJobExecution } = await import('@/lib/ai/jobStore');
      const job = await createJob(
        'ai_radar_scan',
        {
          force: true,
        },
        auth.email
      );

      triggerJobExecution(job.id);

      return NextResponse.json({
        success: true,
        queued: true,
        jobId: job.id,
        message: 'Varredura do Radar IA iniciada com sucesso em segundo plano!',
      });
    }

    if (action === 'clear_unstarred' || action === 'clean_expired') {
      const result = await clearNonStarredPautas();
      return NextResponse.json({
        success: true,
        message: `Retenção aplicada com sucesso: ${result.removedCount} pautas expiradas removidas. ${result.keptCount} ativas no site (48h impacto / 24h normal / ⭐ permanentes).`,
        removedCount: result.removedCount,
        keptCount: result.keptCount,
      });
    }

    if (action === 'toggle_star') {
      if (!pautaId) {
        return NextResponse.json({ success: false, error: 'pautaId é obrigatório' }, { status: 400 });
      }
      const updated = await toggleStarPauta(pautaId);
      return NextResponse.json({
        success: true,
        pauta: updated,
      });
    }

    if (action === 'delete') {
      if (!pautaId) {
        return NextResponse.json({ success: false, error: 'pautaId é obrigatório' }, { status: 400 });
      }
      const deleted = await deletePauta(pautaId);
      return NextResponse.json({
        success: true,
        deleted,
      });
    }

    return NextResponse.json({ success: false, error: 'Ação não reconhecida' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro na API /api/admin/llm/radar POST:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
