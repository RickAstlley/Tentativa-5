import { getAdminDb, withAdminTimeout, markFirestoreUnavailable, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { collectionsFor } from '@/lib/firestoreCollections';
import { getAllArticles, getArticleBySlug, normalizeArticle } from '@/lib/articles';
import { Article } from '@/types/article';
import {
  getAllArticlesServer,
  getArticleBySlugServer,
  getDeletedSlugsServer,
  saveArticlesToServerFileBulk,
} from '@/lib/serverStorage';
import { sanitizeArticleImagesServer } from '@/lib/imageOptimization.server';


// Cache em memória do servidor com TTL para carregamento instantâneo (<5ms)
let cachedServerArticles: Article[] | null = null;
let cachedServerArticlesTimestamp = 0;
const SERVER_ARTICLES_CACHE_TTL_MS = 60 * 1000; // 60 segundos de retenção em memória

export function invalidateArticlesServerCache(): void {
  cachedServerArticles = null;
  cachedServerArticlesTimestamp = 0;
}

export async function getPublishedArticlesServer(): Promise<Article[]> {
  const now = Date.now();
  if (cachedServerArticles && (now - cachedServerArticlesTimestamp < SERVER_ARTICLES_CACHE_TTL_MS)) {
    return cachedServerArticles;
  }

  try {
    const articles = await getAllArticlesFromFirestore();
    if (Array.isArray(articles) && articles.length > 0) {
      cachedServerArticles = articles;
      cachedServerArticlesTimestamp = now;
      return articles;
    }
    const local = getAllArticles();
    if (Array.isArray(local) && local.length > 0) {
      cachedServerArticles = local;
      cachedServerArticlesTimestamp = now;
    }
    return local;
  } catch (err) {
    console.warn('[articles.server] Erro ao carregar artigos no servidor:', err);
    return getAllArticles();
  }
}

export async function getAllArticlesFromFirestore(): Promise<Article[]> {
  const deleted = await getDeletedSlugsServer();
  const deletedSet = new Set(deleted.articles || []);
  const map = new Map<string, Article>();
  const localSlugs = new Set<string>();

  // 1. Arquivos locais do servidor (instantâneo)
  try {
    const serverArticles = await getAllArticlesServer();
    serverArticles.forEach((art) => {
      if (art && art.slug && !deletedSet.has(art.slug)) {
        map.set(art.slug, normalizeArticle(art));
        localSlugs.add(art.slug);
      }
    });
  } catch (err) {
    console.warn('[articles.server] Erro ao ler storage local:', err);
  }

  const missingArticlesToRehydrate: Article[] = [];

  // 2. Firestore Admin SDK em paralelo (com timeout seguro de 3500ms)
  const adminDb = getAdminDb();
  if (adminDb && isFirestoreDatabaseAvailable()) {
    const fetchPromises = collectionsFor('articles').map((colName) =>
      withAdminTimeout(() => adminDb.collection(colName).get(), 3500, null)
    );

    const results = await Promise.allSettled(fetchPromises);
    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value && !res.value.empty) {
        res.value.forEach((doc) => {
          const raw = doc.data();
          const art = normalizeArticle(raw, doc.id);
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

            // Se o artigo está no Firestore, mas não no disco local, agendamos sua reidratação
            if (!localSlugs.has(art.slug)) {
              missingArticlesToRehydrate.push(art);
            }
          }
        });
      }
    });
  }

  // Higieniza todos os artigos para garantir ausência de base64 no HTML/RSC
  const sanitizedArticles = await Promise.all(
    Array.from(map.values()).map((a) => sanitizeArticleImagesServer(a))
  );

  // Agenda reidratação no disco local de forma assíncrona (não bloqueante)
  if (missingArticlesToRehydrate.length > 0) {
    const sanitizedRehydrate = await Promise.all(
      missingArticlesToRehydrate.map((a) => sanitizeArticleImagesServer(a))
    );
    saveArticlesToServerFileBulk(sanitizedRehydrate).catch((err) =>
      console.warn('[articles.server] Erro ao reidratar cache local:', err)
    );
  }

  // Se não houver artigos no Firestore ou arquivo publicado, retorna lista vazia
  if (sanitizedArticles.length === 0) {
    return [];
  }

  return sanitizedArticles.sort(
    (a, b) => (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) || a.slug.localeCompare(b.slug)
  );
}

export async function getArticleBySlugFromFirestore(slug: string): Promise<Article | undefined> {
  if (!slug) return undefined;

  // 1. Tenta no storage de arquivos do servidor (estático + admin publicado) primeiro para performance máxima
  try {
    const serverArticle = await getArticleBySlugServer(slug);
    if (serverArticle) return await sanitizeArticleImagesServer(normalizeArticle(serverArticle, slug));
  } catch {
    // Fallback silencioso
  }

  // 2. Tenta no Firestore se não achou no local
  const adminDb = getAdminDb();
  if (adminDb && isFirestoreDatabaseAvailable()) {
    const fetchPromises = collectionsFor('articles').map((colName) =>
      withAdminTimeout(adminDb.collection(colName).doc(slug).get(), 800, null)
    );

    const results = await Promise.allSettled(fetchPromises);
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && res.value.exists) {
        const art = normalizeArticle(res.value.data(), res.value.id);
        if (art) {
          const sanitized = await sanitizeArticleImagesServer(art);
          // Reidrata este artigo individual de forma assíncrona no disco
          saveArticlesToServerFileBulk([sanitized]).catch((err) =>
            console.warn('[articles.server] Erro ao reidratar artigo individual:', err)
          );
          return sanitized;
        }
      }
    }
  }

  const staticArt = getArticleBySlug(slug);
  return staticArt ? await sanitizeArticleImagesServer(staticArt) : undefined;
}

export async function getLatestArticlesFromFirestore(limit: number = 3): Promise<Article[]> {
  const articles = await getAllArticlesFromFirestore();
  return articles.slice(0, limit);
}
