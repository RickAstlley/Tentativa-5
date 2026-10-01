import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { createJob, listJobs, triggerJobExecution, executeJobDirectly, LLMJobType } from '@/lib/ai/jobStore';
import { checkRateLimit, sanitizeLLMPrompt, sanitizeInputString, getClientIp } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos de limite de execução para LLMs

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado. Autenticação de administrador necessária.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // Rate limit para requisições ao LLM (máx 30 por minuto por admin/IP)
  const clientIp = getClientIp(req);
  const adminIdentifier = auth.email || clientIp;
  const rateResult = checkRateLimit(`llm_${adminIdentifier}`, { windowMs: 60000, maxRequests: 30 });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Limite de requisições de IA atingido temporariamente. Aguarde um instante antes de iniciar outra tarefa.', errorCode: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { type, input, sync } = body;

    const allowedTypes = [
      'image_research',
      'image_search_validate',
      'content_generation',
      'ranking_generation',
      'ebike_autofill',
      'ebike_section_autofill',
      'ebike_ingest_step',
      'ebike_seo',
      'ebike_price_chart',
      'ebike_manual_search',
      'article_autofill',
      'article_seo',
      'radar_scan',
      'ai_radar_scan'
    ];
    if (!type || !allowedTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de Job inválido ou ausente.', errorCode: 'INVALID_JOB_TYPE' },
        { status: 400 }
      );
    }

    // Sanitização defensiva e margens de input para proteção contra Prompt Injection e buffers gigantescos
    const cleanInput: Record<string, any> = { ...(input || {}) };
    if (typeof cleanInput.query === 'string') {
      cleanInput.query = sanitizeLLMPrompt(cleanInput.query, 1000);
    }
    if (typeof cleanInput.prompt === 'string') {
      cleanInput.prompt = sanitizeLLMPrompt(cleanInput.prompt, 15000);
    }
    if (typeof cleanInput.task === 'string') {
      cleanInput.task = sanitizeInputString(cleanInput.task, 100);
    }
    if (typeof cleanInput.title === 'string') {
      cleanInput.title = sanitizeInputString(cleanInput.title, 150);
    }
    if (typeof cleanInput.marca === 'string') {
      cleanInput.marca = sanitizeInputString(cleanInput.marca, 80);
    }
    if (typeof cleanInput.modelo === 'string') {
      cleanInput.modelo = sanitizeInputString(cleanInput.modelo, 80);
    }

    if (sync === true) {
      // Execução síncrona direta (Fallback de emergência)
      const directResult = await executeJobDirectly(type as LLMJobType, cleanInput, auth.email);
      return NextResponse.json(
        {
          success: true,
          status: 'completed',
          result: directResult,
          completedAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const job = await createJob(type as LLMJobType, cleanInput, auth.email);

    // Dispara execução assíncrona em background (inline para chat/conteúdo)
    triggerJobExecution(job.id, { jobType: type as string });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        createdAt: job.createdAt,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[API /api/admin/llm/jobs POST] Erro ao criar/persistir Job:', err?.errorCode || err?.message);

    let sanitizedError = 'Falha ao registrar a tarefa de IA no servidor.';
    let errorCode = err?.errorCode || 'JOB_CREATION_FAILED';

    if (errorCode === 'CONFIG_QUEUE_UNWRITABLE') {
      sanitizedError = 'A fila persistente não está gravável no servidor. Verifique LLM_JOBS_FILE e as permissões da pasta na Hostinger.';
    } else if (errorCode === 'CONFIG_QUEUE_PATH_MISSING') {
      sanitizedError = 'A fila persistente não está configurada no servidor.';
    } else if (errorCode === 'JOB_PERSISTENCE_FAILED') {
      sanitizedError = 'Não foi possível gravar a tarefa no disco do servidor.';
    }

    return NextResponse.json(
      {
        success: false,
        errorCode,
        error: sanitizedError,
      },
      { status: errorCode === 'CONFIG_QUEUE_UNWRITABLE' || errorCode === 'CONFIG_QUEUE_PATH_MISSING' ? 503 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const jobs = await listJobs(20);
    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (err: any) {
    console.error('[API /api/admin/llm/jobs GET] Erro:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Falha ao listar Jobs.', errorCode: 'JOB_LIST_FAILED' },
      { status: 500 }
    );
  }
}
