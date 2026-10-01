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
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Texto não fornecido' },
        { status: 400 }
      );
    }

    const truncatedText = text.slice(0, 8000);

    // Esta rota chamava `/chat/completions` pedindo ao modelo que "inventasse" um
    // vetor de 768 floats, e na falha devolvia
    // `sin(i*0.1) * cos(len*0.01)` — um vetor sintético que não representa nada
    // do texto. Busca por similaridade sobre ele devolve sempre o mesmo
    // resultado, então a base de conhecimento parecia funcionar sem funcionar.
    //
    // Embedding é endpoint próprio no NIM: `ProviderHub.embed` faz o POST real em
    // `/embeddings`. Se ele falhar, o erro precisa aparecer.
    const embedding = await ProviderHub.embed(truncatedText);

    return NextResponse.json({
      success: true,
      embedding,
      dimensions: embedding.length,
      modelUsed: ProviderHub.getEmbedModel(),
      tokens: 0,
    });
  } catch (error: any) {
    console.error('[API embeddings] Erro:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao gerar embedding' },
      { status: 500 }
    );
  }
}