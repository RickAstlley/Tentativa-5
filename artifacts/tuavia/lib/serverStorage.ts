import fs from 'fs/promises';
import path from 'path';
import { Article } from '@/types/article';
import { EBikeGrouped } from '@/types/ebike';
import { TopRanking } from '@/types/ranking';
import { getGroupedEBikes } from '@/lib/ebikes';

const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLISHED_ARTICLES_FILE = path.join(DATA_DIR, 'published_articles.json');
const ARTICLES_STATIC_FILE = path.join(DATA_DIR, 'articles.json');
const PUBLISHED_BIKES_FILE = path.join(DATA_DIR, 'published_bikes.json');
const PUBLISHED_RANKINGS_FILE = path.join(DATA_DIR, 'published_rankings.json');
const DELETED_SLUGS_FILE = path.join(DATA_DIR, 'deleted_slugs.json');

export interface DeletedSlugsRecord {
  bikes: string[];
  articles: string[];
  rankings: string[];
}

let cachedDeletedSlugs: { data: DeletedSlugsRecord; expiresAt: number } | null = null;

export async function getDeletedSlugsServer(): Promise<DeletedSlugsRecord> {
  const now = Date.now();
  if (cachedDeletedSlugs && cachedDeletedSlugs.expiresAt > now) {
    return cachedDeletedSlugs.data;
  }
  try {
    await ensureFileExists(DELETED_SLUGS_FILE, JSON.stringify({ bikes: [], articles: [], rankings: [] }));
    const content = await fs.readFile(DELETED_SLUGS_FILE, 'utf-8');
    if (!content.trim()) {
      const empty: DeletedSlugsRecord = { bikes: [], articles: [], rankings: [] };
      await safeWriteFile(DELETED_SLUGS_FILE, JSON.stringify(empty, null, 2));
      return empty;
    }
    const parsed = JSON.parse(content);
    const valid: DeletedSlugsRecord = {
      bikes: Array.isArray(parsed.bikes) ? parsed.bikes : [],
      articles: Array.isArray(parsed.articles) ? parsed.articles : [],
      rankings: Array.isArray(parsed.rankings) ? parsed.rankings : [],
    };
    cachedDeletedSlugs = { data: valid, expiresAt: now + CACHE_TTL_MS };
    return valid;
  } catch (err) {
    console.warn('[serverStorage] Erro ao ler deleted_slugs.json:', err);
    return { bikes: [], articles: [], rankings: [] };
  }
}

export async function markSlugDeletedServer(type: 'bikes' | 'articles' | 'rankings', slug: string): Promise<void> {
  if (!slug) return;
  const current = await getDeletedSlugsServer();
  const set = new Set(current[type] || []);
  set.add(slug);
  current[type] = Array.from(set);
  await safeWriteFile(DELETED_SLUGS_FILE, JSON.stringify(current, null, 2));
  cachedDeletedSlugs = null;
  invalidateServerStorageCache();
}

export async function unmarkSlugDeletedServer(type: 'bikes' | 'articles' | 'rankings', slug: string): Promise<void> {
  if (!slug) return;
  const current = await getDeletedSlugsServer();
  current[type] = (current[type] || []).filter((s) => s !== slug);
  await safeWriteFile(DELETED_SLUGS_FILE, JSON.stringify(current, null, 2));
  cachedDeletedSlugs = null;
  invalidateServerStorageCache();
}

async function ensureFileExists(filePath: string, defaultContent: string = '[]'): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await safeWriteFile(filePath, defaultContent);
    } catch (err) {
      console.warn(`[serverStorage] Erro ao criar arquivo ${filePath}:`, err);
    }
  }
}

async function safeWriteFile(filePath: string, data: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fs.writeFile(tmpPath, data, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch {
    // Se rename falhar devido a restrições do sistema de arquivos ou lock de container, escreve diretamente
    await fs.writeFile(filePath, data, 'utf-8');
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignora erro de limpeza do arquivo temporário
    }
  }
}

// ==========================================
// ARTIGOS - PERSISTÊNCIA NO SERVIDOR
// ==========================================

// Cache em memória para desempenho ultra-rápido no servidor
let cachedArticles: { data: Article[]; expiresAt: number } | null = null;
let cachedBikes: { data: EBikeGrouped[]; expiresAt: number } | null = null;
let cachedRankings: { data: TopRanking[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60000; // 60 segundos

export function invalidateServerStorageCache(): void {
  cachedArticles = null;
  cachedBikes = null;
  cachedRankings = null;
}

export async function getPublishedArticlesFromServerFile(): Promise<Article[]> {
  const articles: Article[] = [];
  try {
    await ensureFileExists(PUBLISHED_ARTICLES_FILE, '[]');
    const content = await fs.readFile(PUBLISHED_ARTICLES_FILE, 'utf-8');
    if (content.trim()) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        articles.push(...parsed);
      }
    }
  } catch (err) {
    console.warn('[serverStorage] Erro ao ler published_articles.json:', err);
  }

  // Escaneia subpasta data/articles se existir para carregar arquivos json individuais
  try {
    const articlesDir = path.join(DATA_DIR, 'articles');
    const files = await fs.readdir(articlesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const fileContent = await fs.readFile(path.join(articlesDir, file), 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed)) {
            articles.push(...parsed);
          } else if (parsed && typeof parsed === 'object') {
            articles.push(parsed);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Escaneia subpasta data/published_articles se existir
  try {
    const pubArticlesDir = path.join(DATA_DIR, 'published_articles');
    const files = await fs.readdir(pubArticlesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const fileContent = await fs.readFile(path.join(pubArticlesDir, file), 'utf-8');
          const parsed = JSON.parse(fileContent);
          if (Array.isArray(parsed)) {
            articles.push(...parsed);
          } else if (parsed && typeof parsed === 'object') {
            articles.push(parsed);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return articles;
}

export async function getAllArticlesServer(): Promise<Article[]> {
  const now = Date.now();
  if (cachedArticles && cachedArticles.expiresAt > now) {
    return cachedArticles.data;
  }

  const deleted = await getDeletedSlugsServer();
  const deletedSet = new Set(deleted.articles || []);

  const dynamicArticles = await getPublishedArticlesFromServerFile();

  const map = new Map<string, Article>();
  dynamicArticles.forEach((art) => {
    if (art && art.slug && !deletedSet.has(art.slug)) {
      map.set(art.slug, art);
    }
  });

  const result = Array.from(map.values()).sort(
    (a, b) => (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) || a.slug.localeCompare(b.slug)
  );

  cachedArticles = { data: result, expiresAt: now + CACHE_TTL_MS };
  return result;
}

export async function getArticleBySlugServer(slug: string): Promise<Article | null> {
  if (!slug) return null;
  const deleted = await getDeletedSlugsServer();
  if ((deleted.articles || []).includes(slug)) return null;

  const all = await getAllArticlesServer();
  const cleanSlug = slug.toLowerCase().trim();
  const found = all.find((a) => a.slug.toLowerCase().trim() === cleanSlug);
  if (found) return found;

  const CONTRAN_OFFICIAL_ALIASES: Record<string, string> = {
    'legislacao-ebikes-contran-996': 'legislacao-bicicletas-eletricas-contran',
    'resolucao-contran-996-2023': 'legislacao-bicicletas-eletricas-contran',
    'guia-contran-996': 'legislacao-bicicletas-eletricas-contran',
  };
  const targetSlug = CONTRAN_OFFICIAL_ALIASES[cleanSlug];
  if (targetSlug) {
    const aliasArt = all.find((a) => a.slug.toLowerCase().trim() === targetSlug);
    if (aliasArt) return aliasArt;
  }

  return null;
}

export async function saveArticleToServerFile(article: Article): Promise<Article> {
  if (!article || !article.slug) {
    throw new Error('Artigo inválido para gravação no servidor.');
  }

  // Remove da lista de deletados caso tenha sido deletado anteriormente
  await unmarkSlugDeletedServer('articles', article.slug);

  await ensureFileExists(PUBLISHED_ARTICLES_FILE, '[]');
  const currentList = await getPublishedArticlesFromServerFile();
  const filtered = currentList.filter((a) => a.slug !== article.slug);
  const updatedList = [article, ...filtered];

  await safeWriteFile(PUBLISHED_ARTICLES_FILE, JSON.stringify(updatedList, null, 2));
  await safeWriteFile(ARTICLES_STATIC_FILE, JSON.stringify(updatedList, null, 2)).catch(() => {});
  invalidateServerStorageCache();
  return article;
}

export async function deleteArticleFromServerFile(slug: string): Promise<boolean> {
  if (!slug) return false;
  await markSlugDeletedServer('articles', slug);
  await ensureFileExists(PUBLISHED_ARTICLES_FILE, '[]');
  const currentList = await getPublishedArticlesFromServerFile();
  const updatedList = currentList.filter((a) => a.slug !== slug);
  await safeWriteFile(PUBLISHED_ARTICLES_FILE, JSON.stringify(updatedList, null, 2));
  await safeWriteFile(ARTICLES_STATIC_FILE, JSON.stringify(updatedList, null, 2)).catch(() => {});
  invalidateServerStorageCache();
  return true;
}

// ==========================================
// E-BIKES / PRODUTOS - PERSISTÊNCIA NO SERVIDOR
// ==========================================

export async function getPublishedBikesFromServerFile(): Promise<EBikeGrouped[]> {
  try {
    await ensureFileExists(PUBLISHED_BIKES_FILE, '[]');
    const content = await fs.readFile(PUBLISHED_BIKES_FILE, 'utf-8');
    if (!content.trim()) {
      await safeWriteFile(PUBLISHED_BIKES_FILE, '[]');
      return [];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[serverStorage] Erro ao ler published_bikes.json (redefinindo para []):', err);
    try {
      await safeWriteFile(PUBLISHED_BIKES_FILE, '[]');
    } catch {
      // ignora erro de recuperação
    }
    return [];
  }
}

export async function getAllBikesServer(): Promise<EBikeGrouped[]> {
  const now = Date.now();
  if (cachedBikes && cachedBikes.expiresAt > now) {
    return cachedBikes.data;
  }

  const deleted = await getDeletedSlugsServer();
  const deletedSet = new Set(deleted.bikes || []);

  const dynamicBikes = await getPublishedBikesFromServerFile();

  const map = new Map<string, EBikeGrouped>();
  dynamicBikes.forEach((b) => {
    if (b && b.slug && !deletedSet.has(b.slug)) {
      map.set(b.slug, b);
    }
  });

  const result = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
    const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
    return (timeB - timeA) || a.slug.localeCompare(b.slug);
  });

  cachedBikes = { data: result, expiresAt: now + CACHE_TTL_MS };
  return result;
}

export async function getBikeBySlugServer(slug: string): Promise<EBikeGrouped | null> {
  if (!slug) return null;
  const deleted = await getDeletedSlugsServer();
  if ((deleted.bikes || []).includes(slug)) return null;

  const all = await getAllBikesServer();
  const found = all.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
  return found || null;
}

export async function saveBikeToServerFile(bike: EBikeGrouped): Promise<EBikeGrouped> {
  if (!bike || !bike.slug) {
    throw new Error('E-bike inválida para gravação no servidor.');
  }

  // Remove da lista de deletados caso tenha sido deletado anteriormente
  await unmarkSlugDeletedServer('bikes', bike.slug);

  await ensureFileExists(PUBLISHED_BIKES_FILE, '[]');
  const currentList = await getPublishedBikesFromServerFile();
  const filtered = currentList.filter((b) => b.slug !== bike.slug);
  const updatedList = [bike, ...filtered];

  await safeWriteFile(PUBLISHED_BIKES_FILE, JSON.stringify(updatedList, null, 2));
  invalidateServerStorageCache();
  return bike;
}

export async function deleteBikeFromServerFile(slug: string): Promise<boolean> {
  if (!slug) return false;
  await markSlugDeletedServer('bikes', slug);
  await ensureFileExists(PUBLISHED_BIKES_FILE, '[]');
  const currentList = await getPublishedBikesFromServerFile();
  const updatedList = currentList.filter((b) => b.slug !== slug);
  await safeWriteFile(PUBLISHED_BIKES_FILE, JSON.stringify(updatedList, null, 2));
  invalidateServerStorageCache();
  return true;
}

// ==========================================
// RANKINGS - PERSISTÊNCIA NO SERVIDOR
// ==========================================

export async function getPublishedRankingsFromServerFile(): Promise<TopRanking[]> {
  try {
    await ensureFileExists(PUBLISHED_RANKINGS_FILE, '[]');
    const content = await fs.readFile(PUBLISHED_RANKINGS_FILE, 'utf-8');
    if (!content.trim()) {
      await safeWriteFile(PUBLISHED_RANKINGS_FILE, '[]');
      return [];
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[serverStorage] Erro ao ler published_rankings.json (redefinindo para []):', err);
    try {
      await safeWriteFile(PUBLISHED_RANKINGS_FILE, '[]');
    } catch {
      // ignora erro de recuperação
    }
    return [];
  }
}

export async function getAllRankingsServer(): Promise<TopRanking[]> {
  const now = Date.now();
  if (cachedRankings && cachedRankings.expiresAt > now) {
    return cachedRankings.data;
  }

  const deleted = await getDeletedSlugsServer();
  const deletedSet = new Set(deleted.rankings || []);

  const result = await getPublishedRankingsFromServerFile();
  const filtered = result.filter((r) => r && r.slug && !deletedSet.has(r.slug));
  cachedRankings = { data: filtered, expiresAt: now + CACHE_TTL_MS };
  return filtered;
}

export async function getRankingBySlugServer(slug: string): Promise<TopRanking | null> {
  if (!slug) return null;
  const deleted = await getDeletedSlugsServer();
  if ((deleted.rankings || []).includes(slug)) return null;

  const all = await getAllRankingsServer();
  const found = all.find((r) => r.slug.toLowerCase() === slug.toLowerCase());
  return found || null;
}

export async function saveRankingToServerFile(ranking: TopRanking): Promise<TopRanking> {
  if (!ranking || !ranking.slug) {
    throw new Error('Ranking inválido para gravação no servidor.');
  }

  await unmarkSlugDeletedServer('rankings', ranking.slug);

  await ensureFileExists(PUBLISHED_RANKINGS_FILE, '[]');
  const currentList = await getPublishedRankingsFromServerFile();
  const filtered = currentList.filter((r) => r.slug !== ranking.slug);
  const updatedList = [ranking, ...filtered];

  await safeWriteFile(PUBLISHED_RANKINGS_FILE, JSON.stringify(updatedList, null, 2));
  invalidateServerStorageCache();
  return ranking;
}

export async function deleteRankingFromServerFile(slug: string): Promise<boolean> {
  if (!slug) return false;
  await markSlugDeletedServer('rankings', slug);
  await ensureFileExists(PUBLISHED_RANKINGS_FILE, '[]');
  const currentList = await getPublishedRankingsFromServerFile();
  const updatedList = currentList.filter((r) => r.slug !== slug);
  await safeWriteFile(PUBLISHED_RANKINGS_FILE, JSON.stringify(updatedList, null, 2));
  invalidateServerStorageCache();
  return true;
}

// Bulk save helpers for Firestore-to-disk local cache rehydration
export async function saveArticlesToServerFileBulk(articles: Article[]): Promise<void> {
  if (!articles || articles.length === 0) return;
  await ensureFileExists(PUBLISHED_ARTICLES_FILE, '[]');
  const currentList = await getPublishedArticlesFromServerFile();
  const map = new Map<string, Article>();
  currentList.forEach((a) => {
    if (a && a.slug) map.set(a.slug, a);
  });
  articles.forEach((a) => {
    if (a && a.slug) map.set(a.slug, a);
  });
  await safeWriteFile(PUBLISHED_ARTICLES_FILE, JSON.stringify(Array.from(map.values()), null, 2));
  await safeWriteFile(ARTICLES_STATIC_FILE, JSON.stringify(Array.from(map.values()), null, 2)).catch(() => {});
  invalidateServerStorageCache();
}

export async function saveBikesToServerFileBulk(bikes: EBikeGrouped[]): Promise<void> {
  if (!bikes || bikes.length === 0) return;
  await ensureFileExists(PUBLISHED_BIKES_FILE, '[]');
  const currentList = await getPublishedBikesFromServerFile();
  const map = new Map<string, EBikeGrouped>();
  currentList.forEach((b) => {
    if (b && b.slug) map.set(b.slug, b);
  });
  bikes.forEach((b) => {
    if (b && b.slug) map.set(b.slug, b);
  });
  await safeWriteFile(PUBLISHED_BIKES_FILE, JSON.stringify(Array.from(map.values()), null, 2));
  invalidateServerStorageCache();
}

export async function saveRankingsToServerFileBulk(rankings: TopRanking[]): Promise<void> {
  if (!rankings || rankings.length === 0) return;
  await ensureFileExists(PUBLISHED_RANKINGS_FILE, '[]');
  const currentList = await getPublishedRankingsFromServerFile();
  const map = new Map<string, TopRanking>();
  currentList.forEach((r) => {
    if (r && r.slug) map.set(r.slug, r);
  });
  rankings.forEach((r) => {
    if (r && r.slug) map.set(r.slug, r);
  });
  await safeWriteFile(PUBLISHED_RANKINGS_FILE, JSON.stringify(Array.from(map.values()), null, 2));
  invalidateServerStorageCache();
}


