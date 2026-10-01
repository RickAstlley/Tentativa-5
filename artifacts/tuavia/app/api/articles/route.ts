import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, withAdminTimeout, markFirestoreUnavailable, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { collectionsFor } from '@/lib/firestoreCollections';
import { Article } from '@/types/article';
import { normalizeArticle } from '@/lib/articles';
import {
  getAllArticlesServer,
  getArticleBySlugServer,
  saveArticleToServerFile,
  deleteArticleFromServerFile,
  getDeletedSlugsServer,
} from '@/lib/serverStorage';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { invalidateArticlesServerCache } from '@/lib/articles.server';

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
    const deletedSet = new Set(deleted.articles || []);

    if (slug) {
      if (deletedSet.has(slug)) {
        return NextResponse.json({ success: false, error: 'Article was deleted', deleted: true }, { status: 404 });
      }

      // 1. Tenta no Firestore Admin se disponível com timeout rápido e paralelo
      if (adminDb && isFirestoreDatabaseAvailable()) {
        const fetchPromises = collectionsFor('articles').map((colName) =>
          withAdminTimeout(adminDb.collection(colName).doc(slug).get(), 800, null)
        );
        const results = await Promise.allSettled(fetchPromises);
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value && res.value.exists) {
            const art = normalizeArticle(res.value.data(), res.value.id);
            return NextResponse.json({ success: true, article: art, source: 'firestore_admin' });
          }
        }
      }

      // 2. Fallback resiliente no armazenamento em arquivo do servidor
      const serverArticle = await getArticleBySlugServer(slug);
      if (serverArticle) {
        return NextResponse.json({ success: true, article: normalizeArticle(serverArticle, slug), source: 'server_storage' });
      }

      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 });
    }

    // Busca todos os artigos excluindo os deletados
    const map = new Map<string, Article>();
    const serverArticles = await getAllArticlesServer();
    serverArticles.forEach((art) => {
      if (art && art.slug && !deletedSet.has(art.slug)) {
        const norm = normalizeArticle(art);
        map.set(norm.slug, norm);
      }
    });

    if (adminDb && isFirestoreDatabaseAvailable()) {
      const fetchPromises = collectionsFor('articles').map((colName) =>
        withAdminTimeout(() => adminDb.collection(colName).get(), 800, null)
      );

      const results = await Promise.allSettled(fetchPromises);
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value && !res.value.empty) {
          res.value.forEach((doc) => {
            const art = normalizeArticle(doc.data(), doc.id);
            if (art && art.slug && !deletedSet.has(art.slug)) {
              const existing = map.get(art.slug);
              if (!existing) {
                map.set(art.slug, art);
              } else {
                const existingTime = new Date(existing.updatedAt || existing.publishedAt || 0).getTime();
                const newTime = new Date(art.updatedAt || art.publishedAt || 0).getTime();
                if (newTime >= existingTime) {
                  map.set(art.slug, art);
                }
              }
            }
          });
        }
      });
    }

    // Ordenar por data de publicação decrescente
    const articlesList = Array.from(map.values()).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Resposta otimizada para contagem
    if (countOnly) {
      return NextResponse.json(
        { success: true, count: articlesList.length },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        articles: articlesList,
        deletedSlugs: deleted.articles,
        total: articlesList.length,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching articles from API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // A checagem de admin é o gate da escrita, não apenas do tombstone.
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const rawArticle = body.article || body;

    if (!rawArticle || (!rawArticle.slug && !rawArticle.title && !rawArticle.titulo)) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios ausentes (slug ou title/titulo).' },
        { status: 400 }
      );
    }

    const cleanArticle = normalizeArticle(rawArticle);
    const cleanSlug = cleanArticle.slug;

    const deleted = await getDeletedSlugsServer();
    const isDeleted = (deleted.articles || []).includes(cleanSlug);

    // Item removido por administrador não volta por auto-sync do cliente.
    if (isDeleted && !auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Item foi removido por administrador.', deleted: true },
        { status: 410 }
      );
    }

    // Salva no storage de arquivos do servidor para persistência permanente local
    try {
      await saveArticleToServerFile(cleanArticle);
    } catch (saveErr) {
      console.warn('Falha ao salvar artigo no storage local do servidor:', saveErr);
    }

    const adminDb = getAdminDb();

    if (adminDb) {
      try {
        // Grava na coleção primária 'artigos'
        const firestoreData = JSON.parse(JSON.stringify(cleanArticle));
        await adminDb.collection('artigos').doc(cleanArticle.slug).set(firestoreData, { merge: true });
        return NextResponse.json({
          success: true,
          storage: 'firestore_admin_and_server',
          article: cleanArticle,
        });
      } catch (adminErr: any) {
        if (adminErr?.code === 5 || String(adminErr).includes('5 NOT_FOUND') || String(adminErr).includes('does not exist')) {
          markFirestoreUnavailable();
          console.info('[articles] Banco Firestore (default) indisponível. Artigo salvo com sucesso no storage do servidor.');
        } else {
          console.warn('Falha no Firestore Admin ao salvar artigo, retornando payload seguro:', adminErr?.message || adminErr);
        }
      }
    }

    invalidateArticlesServerCache();

    return NextResponse.json({
      success: true,
      storage: 'server_file_storage',
      article: cleanArticle,
    });
  } catch (error: any) {
    console.error('Erro na API de salvar artigo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  // Exclusão não passa por tombstone: apaga do disco e do Firestore. Sem
  // credencial, qualquer cliente HTTP apagava conteúdo publicado.
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
      return NextResponse.json({ success: false, error: 'Slug obrigatório.' }, { status: 400 });
    }

    // 1. Remover do armazenamento local do servidor e marcar como deletado
    try {
      await deleteArticleFromServerFile(slug);
    } catch (err) {
      console.warn('Erro ao deletar artigo do arquivo do servidor:', err);
    }

    // 2. Remover do Firestore Admin em todas as coleções se disponível
    const adminDb = getAdminDb();
    if (adminDb) {
      for (const colName of collectionsFor('articles')) {
        try {
          await adminDb.collection(colName).doc(slug).delete();
        } catch (err) {
          console.warn(`Erro ao deletar artigo em ${colName}:`, err);
        }
      }
    }

    invalidateArticlesServerCache();

    return NextResponse.json({ success: true, deletedSlug: slug });
  } catch (error: any) {
    console.error('Erro ao deletar artigo:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

