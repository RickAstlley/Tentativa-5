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
    const { query, candidates } = await req.json();
    
    if (!query || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query e candidatos são obrigatórios' },
        { status: 400 }
      );
    }

    const candidateTexts = candidates.map((c, i) => `${i + 1}. ${c.text}\nEvidência: ${c.evidence || 'N/A'}`).join('\n\n');

    const res = await ProviderHub.executeWithFallback({
      taskName: 'rerank',
      // O tier rápido (Nemotron Super) dá conta e é o mais barato do conjunto.
      // O GLM cobre quando o candidato é ambíguo, e o Ultra fecha a cadeia por
      // ser o raciocínio mais forte do catálogo.
      primaryModel: 'nvidia/nemotron-3-super-120b-a12b',
      fallbackModel: 'z-ai/glm-5.3',
      tertiaryModel: 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [
        {
          role: 'system',
          content: `Você é um reranker semântico especializado em fichas técnicas de e-bikes.
Dada uma query do usuário e uma lista de candidatos (cada um com ID, texto e evidência), atribua um score de relevância de 0.0 a 1.0 para cada candidato.

Retorne APENAS JSON válido no formato:
{
  "results": [
    { "id": "candidate_id", "score": 0.95 },
    { "id": "candidate_id", "score": 0.82 }
  ]
}`,
        },
        {
          role: 'user',
          content: `Query: "${query}"

Candidatos:
${candidateTexts}

Retorne scores de relevância (0.0 a 1.0).`,
        },
      ],
      temperature: 0.0,
      maxTokens: 1000,
      timeoutMs: 20000,
    });

    let results: Array<{ id: string; score: number }> = [];
    let parseFailed = false;
    try {
      const parsed = JSON.parse(res.text || '{}');
      if (parsed.results && Array.isArray(parsed.results)) {
        results = parsed.results;
      } else {
        parseFailed = true;
      }
    } catch {
      parseFailed = true;
    }

    // Antes, uma falha de parse era coberta com `0.5 - i * 0.05`: scores
    // inventados que a UI apresentava como se tivessem vindo do modelo. Agora
    // devolve erro, com a resposta bruta para diagnóstico.
    if (parseFailed) {
      console.error('[Rerank] Resposta do modelo não pôde ser interpretada:', res.text?.slice(0, 300));
      return NextResponse.json(
        {
          success: false,
          error: 'O modelo não retornou um JSON de scores válido.',
          errorCode: 'RERANK_PARSE_FAILED',
          raw: res.text?.slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      results,
      modelUsed: res.model,
    });
  } catch (error: any) {
    console.error('[API rerank] Erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro no rerank' },
      { status: 500 }
    );
  }
}