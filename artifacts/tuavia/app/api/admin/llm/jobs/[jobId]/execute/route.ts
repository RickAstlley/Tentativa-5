import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkerSecret } from '@/lib/serverAdminAuth';
import { getJob, executeJob } from '@/lib/ai/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const isAuthorized = verifyWorkerSecret(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado ao executor de jobs.', errorCode: 'UNAUTHORIZED' },
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
    const existing = await getJob(jobId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Job ${jobId} não encontrado.`, errorCode: 'JOB_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Se já estiver concluído, retorna o resultado
    if (existing.status === 'completed') {
      return NextResponse.json({
        success: true,
        job: existing,
        alreadyCompleted: true,
      });
    }

    // Executa o pipeline do Job
    console.log(`[JobExecutor API] Executando job ${jobId} (${existing.type})...`);
    await executeJob(jobId);

    const updatedJob = await getJob(jobId);

    return NextResponse.json({
      success: updatedJob?.status === 'completed',
      job: updatedJob,
    });
  } catch (err: any) {
    console.error(`[API /api/admin/llm/jobs/${jobId}/execute] Erro:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Falha ao executar job de IA.',
        errorCode: 'JOB_EXECUTION_FAILED',
      },
      { status: 500 }
    );
  }
}
