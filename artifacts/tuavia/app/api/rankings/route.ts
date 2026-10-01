import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, withAdminTimeout, markFirestoreUnavailable, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { TopRanking } from '@/types/ranking';
import { getAllRankingsServer, getRankingBySlugServer, saveRankingToServerFile, deleteRankingFromServerFile, getDeletedSlugsServer } from '@/lib/serverStorage';
import { syncRankingBikesToCatalog, invalidateRankingsServerCache } from '@/lib/rankings.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    
    // Suporte para contagem rápida (?count=1) - usado pelo NavigationRail
    const countOnly = searchParams.get('count') === '1';

    const adminDb = getAdminDb();

    const deleted = await getDeletedSlugsServer();
    const deletedSet = new Set(deleted.rankings || []);

    if (slug) {
      if (deletedSet.has(slug)) {
        return NextResponse.json({ success: false, error: 'Ranking excluído', deleted: true }, { status: 404 });
      }

      // 1. Tenta no Firestore Admin se disponível com timeout
      if (adminDb && isFirestoreDatabaseAvailable()) {
        try {
          const docSnap = await withAdminTimeout(adminDb.collection('rankings').doc(slug).get(), 1500, null);
          if (docSnap && docSnap.exists) {
            return NextResponse.json(
              {
                success: true,
                ranking: { id: docSnap.id, ...docSnap.data() },
              },
              {
                headers: {
                  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                },
              }
            );
          }
        } catch (dbErr) {
          console.warn('Erro ao consultar Firestore para ranking:', dbErr);
        }
      }

      // 2. Fallback resiliente no armazenamento em arquivo do servidor
      const serverRanking = await getRankingBySlugServer(slug);
      if (serverRanking) {
        return NextResponse.json(
          { success: true, ranking: serverRanking },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            },
          }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Ranking não encontrado' },
        { status: 404 }
      );
    }

    // Busca todos os rankings excluindo os deletados
    const map = new Map<string, TopRanking>();
    const serverRankings = await getAllRankingsServer();
    serverRankings.forEach((r) => {
      if (r && r.slug && !deletedSet.has(r.slug)) {
        map.set(r.slug, r);
      }
    });

    if (adminDb && isFirestoreDatabaseAvailable()) {
      try {
        const snapshot = await withAdminTimeout(adminDb.collection('rankings').get(), 1000, null);
        if (snapshot && !snapshot.empty) {
          snapshot.forEach((doc) => {
            const r = doc.data() as TopRanking;
            if (r && r.slug && !deletedSet.has(r.slug)) {
              map.set(r.slug, r);
            }
          });
        }
      } catch (dbErr) {
        console.warn('Erro ao consultar coleção rankings no Firestore:', dbErr);
      }
    }

    const rankingsList = Array.from(map.values());

    // Resposta otimizada para contagem
    if (countOnly) {
      return NextResponse.json(
        { success: true, count: rankingsList.length },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        rankings: rankingsList,
        deletedSlugs: deleted.rankings,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/rankings] Erro ao buscar rankings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao buscar rankings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Publicar um ranking dispara syncRankingBikesToCatalog, que injeta e-bikes
  // no catálogo global. Sem esta checagem, qualquer cliente HTTP publica.
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const ranking = (body?.ranking || body) as TopRanking;

    if (!ranking || !ranking.slug || !ranking.titulo) {
      return NextResponse.json(
        { success: false, error: 'Slug e Título são obrigatórios' },
        { status: 400 }
      );
    }

    // Sanitizar payload removendo chaves com valor undefined
    let cleanPayload: TopRanking = JSON.parse(
      JSON.stringify({
        ...ranking,
        atualizadoEm: new Date().toISOString(),
      })
    );

    // REGRA DE OURO: As e-bikes do top ranking só são cadastradas no catálogo global e comparador
    // após a confirmação de publicação (publicado === true)
    if (cleanPayload.publicado === true) {
      try {
        cleanPayload = await syncRankingBikesToCatalog(cleanPayload);
      } catch (syncErr) {
        console.error('[API /api/rankings] Falha ao sincronizar e-bikes com o catálogo geral:', syncErr);
      }
    }

    // Salva no storage de arquivos do servidor para persistência permanente local
    try {
      await saveRankingToServerFile(cleanPayload);
    } catch (saveErr) {
      console.warn('Falha ao salvar ranking no storage local do servidor:', saveErr);
    }

    invalidateRankingsServerCache();

    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb
          .collection('rankings')
          .doc(ranking.slug)
          .set(cleanPayload, { merge: true });

        return NextResponse.json({
          success: true,
          storage: 'firestore_admin_and_server',
          message: cleanPayload.publicado
            ? 'Ranking publicado e e-bikes sincronizadas no catálogo com sucesso!'
            : 'Rascunho de ranking salvo com sucesso!',
          ranking: cleanPayload,
        });
      } catch (adminErr: any) {
        if (adminErr?.code === 5 || String(adminErr).includes('5 NOT_FOUND') || String(adminErr).includes('does not exist')) {
          markFirestoreUnavailable();
          console.info('[rankings] Banco Firestore (default) indisponível. Ranking salvo com sucesso no storage do servidor.');
        } else {
          console.warn('Falha no Firestore Admin ao salvar ranking, retornando payload seguro:', adminErr?.message || adminErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      storage: 'server_file_storage',
      message: cleanPayload.publicado
        ? 'Ranking publicado e e-bikes sincronizadas localmente com sucesso!'
        : 'Rascunho de ranking salvo localmente com sucesso!',
      ranking: cleanPayload,
    });
  } catch (error: any) {
    console.error('[API /api/rankings] Erro ao salvar ranking:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao salvar ranking' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Slug é obrigatório para exclusão' },
        { status: 400 }
      );
    }

    // 1. Remover do armazenamento local do servidor
    try {
      await deleteRankingFromServerFile(slug);
    } catch (err) {
      console.warn('Erro ao deletar ranking do arquivo do servidor:', err);
    }

    // 2. Remover do Firestore Admin se disponível
    const adminDb = getAdminDb();
    if (adminDb) {
      try {
        await adminDb.collection('rankings').doc(slug).delete();
      } catch (err) {
        console.warn('Erro ao deletar ranking no Firestore Admin:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ranking ${slug} excluído com sucesso!`,
    });
  } catch (error: any) {
    console.error('[API /api/rankings] Erro ao deletar ranking:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Falha ao deletar ranking' },
      { status: 500 }
    );
  }
}
