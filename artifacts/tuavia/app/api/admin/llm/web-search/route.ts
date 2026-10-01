import { NextRequest, NextResponse } from 'next/server';
import { WebSearchTool } from '@/lib/ai/tools/webSearch';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Validação de autenticação administrativa server-side ANTES de qualquer processamento de payload
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        success: false,
        error: 'Sessão administrativa não autorizada ou expirada.',
        errorCode: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { query, type, limit } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'O parâmetro query é obrigatório.', errorCode: 'MISSING_QUERY' },
        { status: 400 }
      );
    }

    const response = await WebSearchTool.search({
      query: query.trim(),
      locale: 'pt-BR',
      country: 'BR',
      type: type || 'search',
      limit: typeof limit === 'number' ? limit : 8,
    });

    // O spread vinha DEPOIS de `success: true`, e `WebSearchResponse` também tem
    // `success`: o objeto literal sobrescrevia o `true` com o `false` do
    // provedor. Se a busca falhasse, a rota respondia 200 com sucesso.
    return NextResponse.json({
      ...response,
      success: response?.success !== false,
    });
  } catch (error: any) {
    console.error('[API /api/admin/llm/web-search] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao executar pesquisa Web' },
      { status: 500 }
    );
  }
}
