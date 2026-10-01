import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { getJob, triggerJobExecution } from '@/lib/ai/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'ID do Job não informado.', errorCode: 'MISSING_JOB_ID' },
      { status: 400 }
    );
  }

  try {
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job ${jobId} não encontrado.`, errorCode: 'JOB_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Self-Healing Trigger: Se o job estiver 'queued' ou se o lease de execução tiver expirado,
    // re-engaja o trigger em segundo plano com segurança (sem interromper execuções ativas com lease válido)
    const now = Date.now();
    if (job.status === 'queued') {
      triggerJobExecution(jobId);
    } else if (job.status === 'running') {
      const leaseExpired = !job.lockedUntil || new Date(job.lockedUntil).getTime() <= now;
      if (leaseExpired) {
        triggerJobExecution(jobId);
      }
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (err: any) {
    console.error(`[API /api/admin/llm/jobs/${jobId}] Erro:`, err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Falha ao buscar status do Job.', errorCode: 'JOB_FETCH_FAILED' },
      { status: 500 }
    );
  }
}
