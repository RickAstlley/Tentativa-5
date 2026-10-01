import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { CortexHub, CortexAuditTrail, ToolRegistry } from '@/lib/ai/cortex';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const logs = CortexAuditTrail.getLogs(50);
  const tools = ToolRegistry.listTools();

  return NextResponse.json({
    success: true,
    cortex: {
      model: 'moonshotai/kimi-k3',
      architecture: 'Cortex Central (Planner + Tool Router + Multi-Specialist + Auditor)',
      hierarchy: ['Segurança', 'Regras do sistema', 'Integridade dos dados', 'Objetivo da tarefa', 'Qualidade', 'Custo', 'Velocidade'],
      activeTools: tools,
    },
    auditTrail: logs,
  });
}

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { objective, userPrompt, contextData, task, hasHumanApproval } = body;

    if (!objective && !userPrompt) {
      return NextResponse.json(
        { success: false, error: 'Objetivo ou prompt é obrigatório para o Cortex.' },
        { status: 400 }
      );
    }

    /**
     * `CortexHub.process` recebe `{ task: string; context: string }`.
     *
     * A rota passava `task` como objeto e nenhum `context`, então o `task`
     * chegava como `"[object Object]"` ao planner. O contexto (objetivo,
     * dados e aprovação humana) é montado em texto, que é o que o Cortex
     * consume.
     */
    const cortexResponse = await CortexHub.process({
      task: task || objective || userPrompt,
      context: [
        `Objetivo: ${objective || userPrompt}`,
        userPrompt && userPrompt !== objective ? `Prompt: ${userPrompt}` : '',
        contextData ? `Dados de contexto: ${JSON.stringify(contextData)}` : '',
        `Aprovação humana: ${hasHumanApproval ? 'sim' : 'não'}`,
        `Ator: admin (taskId api_cortex_${Date.now()})`,
      ]
        .filter(Boolean)
        .join('\n'),
      depth: body.depth,
    });

    return NextResponse.json({
      success: true,
      data: cortexResponse,
    });
  } catch (err: any) {
    console.error('[API Cortex] Erro ao executar processamento:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Falha no processamento do Cortex' },
      { status: 500 }
    );
  }
}
