import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { EBikeGrouped } from '@/types/ebike';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';

// Tipo local para curadoria da Home (substitui o que vinha de homeCurationService)
interface CuratedBikeDeal {
  slug: string;
  modelo: string;
  marca: string;
  menorPreco: number;
  maiorPreco: number;
  economiaBrl: number;
  discountPct: number;
  badge: string;
  headline: string;
  aiVerdict: string;
  autonomiaKm?: number;
  potenciaW?: number;
  pesoKg?: number;
  imagemUrl?: string;
}

interface CuratedArticleHighlight {
  slug: string;
  title: string;
  summary: string;
  category: string;
  badge: string;
  editorialHook: string;
  readTimeMinutes: number;
  imageUrl?: string;
  publishedAt: string;
}

interface HomeCurationData {
  bikes: {
    dealOfWeek: CuratedBikeDeal;
    dealOfMonth: CuratedBikeDeal;
    bestValuePick: CuratedBikeDeal;
    topUrbanRange: CuratedBikeDeal;
    hotPriceDrops: CuratedBikeDeal[];
    weeklyDuel: {
      bike1Slug: string;
      bike2Slug: string;
      title: string;
      category: string;
      aiVerdictPreview: string;
    };
    podiums?: {
      custoBeneficioSlugs: string[];
      subidasSlugs: string[];
      dobraveisSlugs: string[];
      urbanasSlugs: string[];
    };
    duels?: Array<{
      id: string;
      tag: string;
      bikeASlug: string;
      bikeBSlug: string;
      destaque: string;
    }>;
    catalogPrioritySlugs?: string[];
  };
  articles: {
    highRelevanceWeek: CuratedArticleHighlight;
    highRelevanceMonth: CuratedArticleHighlight;
    topics: Array<{
      id: string;
      title: string;
      icon: string;
      description: string;
      badge: string;
      articleSlugs: string[];
      relevance: 'semana' | 'mes' | 'essencial';
    }>;
    radarTrendSummary: string;
  };
}

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'images', 'uploads');
const BIKES_DIR = path.join(process.cwd(), 'public', 'images', 'bikes');
const ARTICLES_DIR = path.join(process.cwd(), 'public', 'images', 'articles');
const CACHE_DIR = path.join(process.cwd(), 'data', 'media_cache');

let directoriesInitialized = false;

export async function ensureMediaDirectories(): Promise<void> {
  if (directoriesInitialized) return;
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(BIKES_DIR, { recursive: true });
    await fs.mkdir(ARTICLES_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    directoriesInitialized = true;
  } catch (err) {
    console.warn('[imageOptimization] Aviso ao criar diretórios de mídia:', err);
  }
}

/**
 * Converte qualquer Data URL base64 em um arquivo estático otimizado no disco,
 * retornando um caminho relativo leve (/images/uploads/... ou /images/bikes/...).
 * Se o arquivo estático correspondente já existir, utiliza-o imediatamente sem re-processar.
 */
export async function offloadBase64ToImageFile(
  dataUrl: string | undefined | null,
  hint?: { type?: 'bike' | 'article' | 'ranking' | 'misc'; slug?: string }
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  await ensureMediaDirectories();

  // 1. Verifica se já existe arquivo estático nativo para a bike ou artigo
  if (hint?.slug) {
    const slugClean = hint.slug.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (hint.type === 'bike') {
      const candidates = [
        `${slugClean}.webp`,
        `${slugClean}.png`,
        `${slugClean}.jpg`,
        `${slugClean}.jpeg`,
      ];
      for (const cand of candidates) {
        try {
          await fs.access(path.join(BIKES_DIR, cand));
          return `/images/bikes/${cand}`;
        } catch {
          // não existe, continua
        }
      }
    } else if (hint.type === 'article') {
      const candidates = [
        `${slugClean}.webp`,
        `${slugClean}.png`,
        `${slugClean}.jpg`,
        `${slugClean}.jpeg`,
      ];
      for (const cand of candidates) {
        try {
          await fs.access(path.join(ARTICLES_DIR, cand));
          return `/images/articles/${cand}`;
        } catch {
          // não existe, continua
        }
      }
    }
  }

  // 2. Extrai cabeçalho e bytes base64
  try {
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return trimmed;

    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext.includes('+') || ext.includes('.')) ext = 'webp';

    const base64Data = match[2];
    // Hash determinístico curto dos dados da imagem
    const hash = crypto.createHash('md5').update(base64Data).digest('hex').slice(0, 16);
    const prefix = hint?.type ? `${hint.type}_` : 'img_';
    const slugPart = hint?.slug ? `${hint.slug.slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '-')}_` : '';
    const filename = `${prefix}${slugPart}${hash}.${ext}`;

    const publicFilePath = path.join(UPLOADS_DIR, filename);
    const cacheFilePath = path.join(CACHE_DIR, filename);

    // Se já foi gerado e salvo, retorna imediatamente
    try {
      await fs.access(publicFilePath);
      return `/images/uploads/${filename}`;
    } catch {
      // Arquivo ainda não gravado
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const { uploadImageMedia } = await import('@/lib/firebaseStorage');
    const result = await uploadImageMedia(buffer, filename, mime);

    return result.mediaUrl || result.url;
  } catch (err) {
    console.warn('[imageOptimization] Erro ao descarregar base64 para arquivo:', err);
    return trimmed;
  }
}

/**
 * Higieniza todas as imagens de um objeto EBikeGrouped, garantindo que
 * nenhum payload base64 chegue ao HTML inicial ou ao RSC payload do cliente.
 */
export async function sanitizeBikeImagesServer(bike: EBikeGrouped): Promise<EBikeGrouped> {
  if (!bike) return bike;
  const clone = { ...bike };

  if (clone.imagemUrl && clone.imagemUrl.startsWith('data:image/')) {
    clone.imagemUrl = await offloadBase64ToImageFile(clone.imagemUrl, {
      type: 'bike',
      slug: clone.slug,
    });
  }

  if (Array.isArray(clone.galleryImages) && clone.galleryImages.length > 0) {
    clone.galleryImages = await Promise.all(
      clone.galleryImages.map((img: string, idx: number) =>
        typeof img === 'string' && img.startsWith('data:image/')
          ? offloadBase64ToImageFile(img, { type: 'bike', slug: `${clone.slug}_g_${idx}` })
          : Promise.resolve(img)
      )
    );
  }

  return clone;
}

/**
 * Higieniza todas as imagens de um objeto Article.
 */
export async function sanitizeArticleImagesServer(art: Article): Promise<Article> {
  if (!art) return art;
  const clone = { ...art };

  if (clone.coverImage && clone.coverImage.startsWith('data:image/')) {
    clone.coverImage = await offloadBase64ToImageFile(clone.coverImage, {
      type: 'article',
      slug: clone.slug,
    });
  }

  return clone;
}

/**
 * Higieniza todas as imagens de um objeto TopRanking.
 */
export async function sanitizeRankingImagesServer(ranking: TopRanking): Promise<TopRanking> {
  if (!ranking) return ranking;
  const clone = { ...ranking };

  if (Array.isArray(clone.itens) && clone.itens.length > 0) {
    clone.itens = await Promise.all(
      clone.itens.map(async (item) => {
        const itemClone = { ...item };
        if (itemClone.imagemUrl && itemClone.imagemUrl.startsWith('data:image/')) {
          itemClone.imagemUrl = await offloadBase64ToImageFile(itemClone.imagemUrl, {
            type: 'ranking',
            slug: `${clone.slug}_item_${itemClone.bikeSlug || itemClone.posicao}`,
          });
        }
        return itemClone;
      })
    );
  }

  return clone;
}

/**
 * Higieniza a curadoria de home.
 */
export async function sanitizeHomeCurationServer(curation: HomeCurationData): Promise<HomeCurationData> {
  if (!curation) return curation;
  const clone = { ...curation };

  if (clone.bikes?.dealOfWeek?.imagemUrl && clone.bikes.dealOfWeek.imagemUrl.startsWith('data:image/')) {
    clone.bikes.dealOfWeek.imagemUrl = await offloadBase64ToImageFile(clone.bikes.dealOfWeek.imagemUrl, {
      type: 'bike',
      slug: clone.bikes.dealOfWeek.slug,
    });
  }

  if (clone.articles?.highRelevanceWeek?.imageUrl && clone.articles.highRelevanceWeek.imageUrl.startsWith('data:image/')) {
    clone.articles.highRelevanceWeek.imageUrl = await offloadBase64ToImageFile(clone.articles.highRelevanceWeek.imageUrl, {
      type: 'article',
      slug: clone.articles.highRelevanceWeek.slug,
    });
  }

  if (clone.articles?.highRelevanceMonth?.imageUrl && clone.articles.highRelevanceMonth.imageUrl.startsWith('data:image/')) {
    clone.articles.highRelevanceMonth.imageUrl = await offloadBase64ToImageFile(clone.articles.highRelevanceMonth.imageUrl, {
      type: 'article',
      slug: clone.articles.highRelevanceMonth.slug,
    });
  }

  return clone;
}
