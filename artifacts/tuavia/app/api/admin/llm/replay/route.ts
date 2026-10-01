import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { ProviderHub } from '@/lib/ai/providers/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado' },
      { status: 401 }
    );
  }

  try {
    const { messages, model, temperature, maxTokens } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mensagens são obrigatórias' },
        { status: 400 }
      );
    }

    const res = await ProviderHub.executeWithFallback({
      taskName: 'replay_debug',
      primaryModel: model || 'nvidia/nemotron-3-ultra-550b-a55b',
      fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
      tertiaryModel: 'z-ai/glm-5.3',
      messages,
      temperature: temperature ?? 0.0,
      maxTokens: maxTokens ?? 8000,
      timeoutMs: 90000,
    });

    return NextResponse.json({
      success: true,
      text: res.text,
      modelUsed: res.model,
      latencyMs: res.latencyMs,
      totalTokens: res.usage?.totalTokens || 0,
      promptTokens: res.usage?.promptTokens || 0,
      completionTokens: res.usage?.completionTokens || 0,
    });
  } catch (error: any) {
    console.error('[API replay] Erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro na re-execução' },
      { status: 500 }
    );
  }
}