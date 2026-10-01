import { NextRequest, NextResponse } from 'next/server';
import { ImageResearchAgent } from '@/lib/ai/agents/imageResearch';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado. Autenticação de administrador necessária.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { articleTopic, articleContext, articleCategory, bikeModel, desiredCount } = body;

    if (!articleTopic || typeof articleTopic !== 'string' || !articleTopic.trim()) {
      return NextResponse.json(
        { success: false, error: 'O tema do artigo (articleTopic) é obrigatório.' },
        { status: 400 }
      );
    }

    const result = await ImageResearchAgent.executePipeline({
      articleTopic: articleTopic.trim(),
      articleContext: typeof articleContext === 'string' ? articleContext.trim() : undefined,
      articleCategory: typeof articleCategory === 'string' ? articleCategory.trim() : undefined,
      bikeModel: typeof bikeModel === 'string' ? bikeModel.trim() : undefined,
      desiredCount: typeof desiredCount === 'number' ? desiredCount : 4,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/admin/llm/image-research] Erro no pipeline de imagens:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Falha ao executar pipeline de pesquisa de imagens.',
      },
      { status: 500 }
    );
  }
}
