import { slugify as generateArticleSlug } from '@/lib/slug';
import { Article, ArticleCategory } from '@/types/article';
import { collection, getDocs, doc, getDoc, query, limit as fsLimit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
// `collectionsFor` era usada nos dois fallbacks de Firestore sem estar
// importada: bastava o cliente cair no caminho cliente-side para estourar
// `ReferenceError: collectionsFor is not defined`.
import { collectionsFor } from '@/lib/firestoreCollections';

export const PUBLISHED_ARTICLES_STORAGE_KEY = 'tuavia_published_articles_v1';

/**
 * Normaliza um título para COMPARAR com um slug armazenado.
 *
 * Não é a mesma coisa que `slugify` de `lib/slug.ts`: aqui a pontuação é
 * removida em vez de virar hífen ("Lei 996/2023" -> "lei-9962023"). A diferença
 * é deliberada — esta função só casa título publicado com slug pedido, e o
 * conteúdo já gravado em disco depende desse comportamento. Usar o gerador
 * aqui quebraria a busca dos artigos existentes.
 */
export function normalizeSlugForMatch(text: string): string {
  if (!text) return `artigo-${Date.now()}`;
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Normaliza qualquer documento vindo do Firestore (ou JSON) para a interface Article
 * Suporta chaves em português, inglês, timestamps do Firestore e formatos legados.
 */
export function normalizeArticle(raw: any, fallbackSlug?: string): Article {
  if (!raw || typeof raw !== 'object') {
    return {
      slug: fallbackSlug || `artigo-${Date.now()}`,
      title: 'Artigo sem título',
      excerpt: '',
      coverImage: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80',
      galleryImages: [],
      category: 'Guia de Compra',
      publishedAt: new Date().toISOString(),
      readingTimeMinutes: 5,
      body: '',
      relatedBikeCategories: ['Urbana'],
    };
  }

  // Título
  const title = String(raw.title || raw.titulo || raw.nome || raw.name || 'Artigo sem título').trim();

  // Slug
  let slug = raw.slug || fallbackSlug;
  if (!slug || String(slug).trim().length === 0) {
    slug = generateArticleSlug(title);
  }
  slug = String(slug).trim();

  // Resumo / Excerpt
  const excerpt = String(
    raw.excerpt || raw.resumo || raw.descricao || raw.description || raw.subtitulo || raw.subtitle || ''
  ).trim();

  // Imagem de Capa
  let rawCover = String(
    raw.coverImage || raw.capa || raw.cover || raw.imagem || raw.imagemUrl || raw.image || raw.banner || ''
  ).trim();
  
  // Sanitiza aspas e valores inválidos
  if (rawCover === 'undefined' || rawCover === 'null' || rawCover === '[]' || rawCover === '{}') {
    rawCover = '';
  }
  if ((rawCover.startsWith('"') && rawCover.endsWith('"')) || (rawCover.startsWith("'") && rawCover.endsWith("'"))) {
    rawCover = rawCover.slice(1, -1).trim();
  }
  if (rawCover.startsWith('//')) {
    rawCover = `https:${rawCover}`;
  }

  // Redireciona paths locais de uploads para a rota de mídia centralizada (/api/media/)
  // permitindo que o servidor da Hostinger resolva arquivos sincronizados via Firestore
  if (rawCover.startsWith('/images/uploads/')) {
    rawCover = rawCover.replace('/images/uploads/', '/api/media/');
  }

  const coverImage = rawCover || 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80';

  // Galeria de Fotos
  const rawGallery = raw.galleryImages || raw.galeria || raw.fotos || raw.images || [];
  const galleryImages = Array.isArray(rawGallery)
    ? rawGallery
        .filter((img: any) => typeof img === 'string' && img.trim().length > 0 && img !== 'undefined' && img !== 'null')
        .map((img: string) => {
          let s = img.trim();
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
          if (s.startsWith('//')) s = `https:${s}`;
          return s;
        })
    : [];

  // Categoria
  const rawCat = String(raw.category || raw.categoria || 'Guia de Compra').trim();
  let category: ArticleCategory = 'Guia de Compra';
  if (['Guia de Compra', 'Manutenção', 'Legislação', 'Notícias', 'Comparativo', 'Economia & Mobilidade', 'Tecnologia & Baterias'].includes(rawCat)) {
    category = rawCat as ArticleCategory;
  } else if (rawCat.toLowerCase().includes('legis') || rawCat.toLowerCase().includes('contran')) {
    category = 'Legislação';
  } else if (rawCat.toLowerCase().includes('manut')) {
    category = 'Manutenção';
  } else if (rawCat.toLowerCase().includes('comp') || rawCat.toLowerCase().includes('teste')) {
    category = 'Comparativo';
  } else if (rawCat.toLowerCase().includes('not') || rawCat.toLowerCase().includes('news')) {
    category = 'Notícias';
  } else if (rawCat.toLowerCase().includes('econo') || rawCat.toLowerCase().includes('custo') || rawCat.toLowerCase().includes('mobi')) {
    category = 'Economia & Mobilidade';
  } else if (rawCat.toLowerCase().includes('tecnol') || rawCat.toLowerCase().includes('bateri') || rawCat.toLowerCase().includes('gps')) {
    category = 'Tecnologia & Baterias';
  }

  // Data e Horário de Publicação (com precisão total para saber a última publicação gerada)
  let publishedAt = new Date().toISOString();
  const dateCandidate = raw.publishedAt || raw.dataPublicacao || raw.data || raw.createdAt || raw.data_criacao || raw.timestamp || raw.updatedAt;
  if (dateCandidate) {
    if (typeof dateCandidate === 'string' && dateCandidate.trim().length > 0) {
      const trimmed = dateCandidate.trim();
      if (trimmed.includes('T')) {
        publishedAt = trimmed;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        publishedAt = `${trimmed}T00:00:00.000Z`;
      } else {
        const parsed = new Date(trimmed);
        publishedAt = !isNaN(parsed.getTime()) ? parsed.toISOString() : trimmed;
      }
    } else if (dateCandidate instanceof Date) {
      publishedAt = dateCandidate.toISOString();
    } else if (typeof dateCandidate.toDate === 'function') {
      try {
        publishedAt = dateCandidate.toDate().toISOString();
      } catch {
        publishedAt = new Date().toISOString();
      }
    } else if (typeof dateCandidate.seconds === 'number') {
      publishedAt = new Date(dateCandidate.seconds * 1000).toISOString();
    }
  }

  // Tempo de Leitura
  const readingTimeMinutes = Math.max(1, Number(raw.readingTimeMinutes || raw.tempoLeitura || raw.readTime || raw.tempo_leitura) || 5);

  // Conteúdo Markdown
  const body = String(raw.body || raw.conteudo || raw.texto || raw.content || raw.markdown || '').trim();

  // Categorias de Bike Relacionadas
  const rawRel = raw.relatedBikeCategories || raw.categoriasRelacionadas || raw.categorias_relacionadas || [];
  const relatedBikeCategories = Array.isArray(rawRel) && rawRel.length > 0
    ? rawRel.map(String)
    : ['Urbana'];

  // Tags / Etiquetas Temáticas (Extração e Derivação Inteligente)
  const rawTags = raw.tags || raw.etiquetas || raw.palavrasChave || raw.keywords || raw.seo?.suggestedTags || [];
  let tags: string[] = [];
  if (Array.isArray(rawTags) && rawTags.length > 0) {
    tags = rawTags.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0);
  }

  // Fallback e enriquecimento semântico de tags se estiver vazio
  if (tags.length === 0) {
    const combinedText = `${title} ${excerpt} ${category} ${body}`.toLowerCase();
    const tagSet = new Set<string>();

    if (category === 'Legislação' || combinedText.includes('contran') || combinedText.includes('resolu') || combinedText.includes('lei') || combinedText.includes('norma') || combinedText.includes('cnh') || combinedText.includes('emplac')) {
      tagSet.add('Legislação');
      tagSet.add('CONTRAN 996');
      tagSet.add('Regras de Trânsito');
      tagSet.add('Ciclovia');
    }
    if (combinedText.includes('bateria') || combinedText.includes('lítio') || combinedText.includes('recarga') || combinedText.includes('autonomia')) {
      tagSet.add('Bateria de Lítio');
      tagSet.add('Autonomia');
      tagSet.add('Manutenção');
    }
    if (combinedText.includes('motor central') || combinedText.includes('motor de cubo') || combinedText.includes('torque') || combinedText.includes('potência')) {
      tagSet.add('Motor & Potência');
      tagSet.add('Engenharia');
    }
    if (combinedText.includes('guia') || combinedText.includes('escolher') || combinedText.includes('comprar') || combinedText.includes('preço') || combinedText.includes('economia')) {
      tagSet.add('Guia de Compra');
      tagSet.add('Custo-Benefício');
    }
    if (category === 'Comparativo' || combinedText.includes('vs') || combinedText.includes('compar')) {
      tagSet.add('Comparativo');
    }

    if (tagSet.size === 0) {
      tagSet.add(category);
      tagSet.add('E-Bikes Brasil');
    }
    tags = Array.from(tagSet);
  }

  // Ancoragem em Destaque para Zona 04 (Legislação)
  const isLegislationFeatured = Boolean(
    raw.isLegislationFeatured ||
    category === 'Legislação' ||
    tags.some((t) => ['Legislação', 'CONTRAN 996', 'Regras de Trânsito', 'Normas'].includes(t)) ||
    title.toLowerCase().includes('contran') ||
    title.toLowerCase().includes('legisla')
  );

  // Ocultar de feeds públicos gerais
  const hideFromFeed = Boolean(raw.hideFromFeed || raw.esconderDoFeed || raw.hideFromFeeds);

  // Data e Horário de Atualização
  let updatedAt: string | undefined = undefined;
  if (raw.updatedAt || raw.dataAtualizacao || raw.updated_at) {
    const uCandidate = raw.updatedAt || raw.dataAtualizacao || raw.updated_at;
    if (typeof uCandidate === 'string') updatedAt = uCandidate;
    else if (uCandidate instanceof Date) updatedAt = uCandidate.toISOString();
    else if (typeof uCandidate?.toDate === 'function') {
      try { updatedAt = uCandidate.toDate().toISOString(); } catch { /* ignore */ }
    }
  }

  const result: Article = {
    slug,
    title,
    excerpt,
    coverImage,
    galleryImages,
    category,
    publishedAt,
    readingTimeMinutes,
    body,
    relatedBikeCategories,
    tags,
    isLegislationFeatured,
    hideFromFeed,
  };

  if (updatedAt) {
    result.updatedAt = updatedAt;
  }

  return result;
}

export function getLocalPublishedArticles(): Article[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PUBLISHED_ARTICLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    let deletedSlugs = new Set<string>(['legislacao-bicicletas-eletricas-contran']);
    try {
      const delRaw = localStorage.getItem('tuavia_deleted_slugs_v1');
      if (delRaw) {
        const parsedDel = JSON.parse(delRaw);
        if (Array.isArray(parsedDel.articles)) {
          parsedDel.articles.forEach((s: string) => deletedSlugs.add(s));
        }
      }
    } catch (_) {}

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => normalizeArticle(item))
        .filter((a) => a && a.slug && !deletedSlugs.has(a.slug));
    }
    return [];
  } catch (err) {
    console.error('[articles] Erro ao ler artigos publicados do localStorage:', err);
    return [];
  }
}

export function getStaticArticles(): Article[] {
  return [];
}

export function getStaticLatestArticles(limit: number = 3): Article[] {
  return getStaticArticles().slice(0, limit);
}

export function getAllArticles(): Article[] {
  const staticArticles = getStaticArticles();
  const localArticles = getLocalPublishedArticles();

  const combinedMap = new Map<string, Article>();
  
  // Adiciona estáticos primeiro
  staticArticles.forEach((art) => combinedMap.set(art.slug, art));
  // Sobrescreve/adiciona os locais publicados
  localArticles.forEach((art) => combinedMap.set(art.slug, art));

  return Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

// Coleções potenciais no Firestore para varredura multi-idioma e multi-convenção

export async function fetchArticlesFromFirestore(): Promise<Article[]> {
  const combinedMap = new Map<string, Article>();

  // 1. Tenta prioritariamente endpoint oficial /api/articles (com timeout de 3s)
  let apiSuccess = false;
  let deletedSlugsSet = new Set<string>();

  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/articles', { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.articles)) {
          deletedSlugsSet = new Set(Array.isArray(json.deletedSlugs) ? json.deletedSlugs : []);
          
          json.articles.forEach((rawArt: any) => {
            const art = normalizeArticle(rawArt);
            if (art && art.slug && !deletedSlugsSet.has(art.slug)) {
              combinedMap.set(art.slug, art);
            }
          });

          apiSuccess = true;
        }
      }
    } catch {
      // Fallback silencioso
    }
  }

  // 2. Apenas se a API falhou (offline), mescla com os dados locais do cache (localStorage) e estáticos
  if (!apiSuccess) {
    // 2.1 Adiciona os artigos estáticos que não foram deletados
    getStaticArticles().forEach((a) => {
      if (!deletedSlugsSet.has(a.slug)) {
        const existing = combinedMap.get(a.slug);
        if (!existing) {
          combinedMap.set(a.slug, a);
        }
      }
    });

    // 2.2 Adiciona os artigos do localStorage do navegador
    getLocalPublishedArticles().forEach((a) => {
      if (!deletedSlugsSet.has(a.slug)) {
        const existing = combinedMap.get(a.slug);
        if (!existing) {
          combinedMap.set(a.slug, a);
        }
      }
    });

    // 2.3 Se a API falhou, tenta também Firestore cliente direto
    if (isFirebaseConfigured && db) {
      for (const colName of collectionsFor('articles')) {
        try {
          const firestorePromise = getDocs(collection(db, colName));
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 600)
          );
          const snap = await Promise.race([firestorePromise, timeoutPromise]);
          if (snap && !snap.empty) {
            snap.forEach((d) => {
              const raw = d.data();
              const art = normalizeArticle(raw, d.id);
              if (art && art.slug && !deletedSlugsSet.has(art.slug)) {
                const existing = combinedMap.get(art.slug);
                if (!existing) {
                  combinedMap.set(art.slug, art);
                }
              }
            });
            break;
          }
        } catch {
          // Fallback para próxima coleção
        }
      }
    }
  }

  // 3. Atualiza o cache local (localStorage) no navegador para refletir com precisão os artigos do banco de dados
  if (typeof window !== 'undefined') {
    try {
      const cleanList = Array.from(combinedMap.values());
      localStorage.setItem(PUBLISHED_ARTICLES_STORAGE_KEY, JSON.stringify(cleanList));
    } catch {}
  }

  // 4. Garante que nenhum item deletado permaneça no resultado
  if (deletedSlugsSet.size > 0) {
    deletedSlugsSet.forEach((delSlug) => combinedMap.delete(delSlug));
  }

  return Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export async function fetchArticleBySlugFromFirestore(slug: string): Promise<Article | undefined> {
  if (!slug) return undefined;

  // 1. Tenta buscar da API com timeout
  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/articles?slug=${encodeURIComponent(slug)}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.article) {
          return normalizeArticle(json.article, slug);
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Tenta no Firestore Cliente se configurado
  if (isFirebaseConfigured && db) {
    for (const colName of collectionsFor('articles')) {
      try {
        const docRef = doc(db, colName, slug);
        const firestorePromise = getDoc(docRef);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 2500)
        );
        const snap = await Promise.race([firestorePromise, timeoutPromise]);
        if (snap && snap.exists()) {
          return normalizeArticle(snap.data(), snap.id);
        }
      } catch {
        // Fallback
      }
    }
  }

  // 3. Fallback no catálogo local
  return getArticleBySlug(slug);
}

/**
 * Retorna apenas os artigos destinados aos feeds/catálogos públicos (oculta artigos com hideFromFeed: true)
 */
export function getFeedArticles(articles?: Article[]): Article[] {
  const list = articles && articles.length > 0 ? articles : getAllArticles();
  return list.filter((a) => !a.hideFromFeed);
}

export function getArticlesByCategory(category: ArticleCategory | 'Todos'): Article[] {
  const articles = getFeedArticles();
  if (category === 'Todos') return articles;
  return articles.filter((a) => a.category === category);
}

export function getArticleBySlug(slug: string, customList?: Article[]): Article | undefined {
  if (!slug) return undefined;
  const all = customList && customList.length > 0 ? customList : getAllArticles();
  
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Busca direta por slug exato (case-insensitive)
  const directMatch = all.find((a) => a.slug?.toLowerCase().trim() === cleanSlug);
  if (directMatch) return directMatch;

  // 2. Mapeamento estrito de aliases legados exclusivos do Guia CONTRAN 996 oficial
  const CONTRAN_OFFICIAL_ALIASES: Record<string, string> = {
    'legislacao-ebikes-contran-996': 'legislacao-bicicletas-eletricas-contran',
    'resolucao-contran-996-2023': 'legislacao-bicicletas-eletricas-contran',
    'guia-contran-996': 'legislacao-bicicletas-eletricas-contran',
  };

  const targetSlug = CONTRAN_OFFICIAL_ALIASES[cleanSlug];
  if (targetSlug) {
    const aliasArt = all.find((a) => a.slug?.toLowerCase().trim() === targetSlug);
    if (aliasArt) return aliasArt;
  }

  // 3. Busca por slug gerado a partir do título
  return all.find((a) => normalizeSlugForMatch(a.title) === cleanSlug);
}

/**
 * Retorna todos os artigos classificados como Legislação e Normas
 */
export function getLegislationArticles(articles?: Article[]): Article[] {
  const list = (articles && articles.length > 0 ? articles : getAllArticles()).filter((a) => !a.hideFromFeed);
  return list.filter((a) => a.category === 'Legislação' || a.isLegislationFeatured);
}

/**
 * Extrai todas as tags únicas dos artigos com suas respectivas contagens (filtrando artigos ocultados de feeds)
 */
export function getAllArticleTags(articles?: Article[]): { tag: string; count: number }[] {
  const list = (articles && articles.length > 0 ? articles : getAllArticles()).filter((a) => !a.hideFromFeed);
  const map = new Map<string, number>();

  list.forEach((art) => {
    if (Array.isArray(art.tags)) {
      art.tags.forEach((tag) => {
        const clean = tag.trim();
        if (clean.length > 0) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    }
  });

  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Filtra artigos por uma tag específica (omitindo artigos ocultados de feeds)
 */
export function getArticlesByTag(tag: string, articles?: Article[]): Article[] {
  const list = (articles && articles.length > 0 ? articles : getAllArticles()).filter((a) => !a.hideFromFeed);
  if (!tag || tag === 'Todos') {
    return list;
  }
  const targetTag = tag.toLowerCase().trim();

  return list.filter((art) => {
    if (art.category.toLowerCase() === targetTag) return true;
    if (Array.isArray(art.tags)) {
      return art.tags.some((t) => t.toLowerCase() === targetTag || t.toLowerCase().includes(targetTag));
    }
    return false;
  });
}

export function sortArticlesByLatest(articles: Article[]): Article[] {
  if (!Array.isArray(articles)) return [];
  return [...articles].sort((a, b) => {
    const timeA = new Date(a.publishedAt || '2020-01-01T00:00:00.000Z').getTime();
    const timeB = new Date(b.publishedAt || '2020-01-01T00:00:00.000Z').getTime();
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });
}

export function getMostRecentArticle(articles?: Article[]): Article | null {
  const list = (articles && articles.length > 0 ? articles : getAllArticles()).filter((a) => !a.hideFromFeed);
  const sorted = sortArticlesByLatest(list);
  return sorted[0] || null;
}

export function getLatestArticles(limit: number = 3): Article[] {
  return sortArticlesByLatest(getFeedArticles()).slice(0, limit);
}

export function formatArticleDate(publishedAt: string, format: 'short' | 'long' = 'short'): string {
  if (!publishedAt) return '';
  const raw = publishedAt.trim();
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const monthIndex = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const monthNamesShort = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    const monthNamesLong = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthName = format === 'long' ? monthNamesLong[monthIndex] || '' : monthNamesShort[monthIndex] || '';
    return `${day} de ${monthName} de ${year}`;
  }
  const date = new Date(raw);
  if (isNaN(date.getTime())) return publishedAt;
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

/**
 * Calcula o Score de Impacto de Mercado (0-100) para um artigo,
 * priorizando os temas com maior demanda de busca e interesse comercial no Brasil.
 */
export function calculateMarketImpactScore(art: Article): number {
  if (!art) return 0;
  let score = 50;

  const text = `${art.title} ${art.excerpt} ${art.tags?.join(' ') || ''} ${art.category}`.toLowerCase();

  if (text.includes('contran') || text.includes('legislação') || text.includes('996')) score += 25;
  if (text.includes('bateria') || text.includes('lítio') || text.includes('autonomia')) score += 20;
  if (text.includes('economia') || text.includes('custo') || text.includes('combustível') || text.includes('payback')) score += 18;
  if (text.includes('750w') || text.includes('motor central') || text.includes('gps') || text.includes('rastreamento')) score += 15;
  if (text.includes('guia') || text.includes('primeira') || text.includes('como escolher')) score += 12;

  if (art.readingTimeMinutes && art.readingTimeMinutes >= 5) score += 5;
  if (art.galleryImages && art.galleryImages.length > 0) score += 5;

  return Math.min(100, score);
}

/**
 * Verifica se um artigo foi publicado há menos de 6 horas.
 * Artigos publicados há menos de 6h são exibidos exclusivamente em "Últimas Publicações".
 * Somente após passar 6 horas da publicação ele será liberado para aparecer em outros tópicos temáticos.
 */
export function isArticleFreshUnder6Hours(publishedAt?: string): boolean {
  if (!publishedAt) return false;
  const pubTime = new Date(publishedAt).getTime();
  if (isNaN(pubTime)) return false;
  const now = Date.now();
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const elapsed = now - pubTime;
  return elapsed >= 0 && elapsed < SIX_HOURS_MS;
}

/**
 * Organiza os artigos exibidos na Home respeitando a Regra de Janela de 24 Horas:
 * 1. Com publicação inédita (< 24h): O artigo recém-publicado ganha posição de destaque principal.
 * 2. Sem publicação inédita (> 24h): A ordem é re-ranqueada pelo algoritmo de Alto Impacto do Mercado.
 */
export function getCuratedHomeArticles(articles?: Article[]): {
  sortedArticles: Article[];
  hasFreshPublication24h: boolean;
  freshArticle: Article | null;
  curationBadge: string;
} {
  const list = (articles && articles.length > 0 ? articles : getAllArticles()).filter((a) => !a.hideFromFeed);
  if (list.length === 0) {
    return {
      sortedArticles: [],
      hasFreshPublication24h: false,
      freshArticle: null,
      curationBadge: 'Curadoria Inteligente',
    };
  }

  const sortedByTime = sortArticlesByLatest(list);
  const freshest = sortedByTime[0];
  const freshestTime = new Date(freshest.publishedAt).getTime();
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const hoursElapsed = (now - freshestTime) / (1000 * 60 * 60);

  const hasFreshPublication24h = !isNaN(freshestTime) && (now - freshestTime) < TWENTY_FOUR_HOURS_MS && hoursElapsed >= 0;

  if (hasFreshPublication24h) {
    const remaining = sortedByTime.filter((a) => a.slug !== freshest.slug);
    return {
      sortedArticles: [freshest, ...remaining],
      hasFreshPublication24h: true,
      freshArticle: freshest,
      curationBadge: '⚡ NOVIDADE DAS ÚLTIMAS 24H',
    };
  }

  const rankedByImpact = [...list].sort((a, b) => {
    const scoreA = calculateMarketImpactScore(a);
    const scoreB = calculateMarketImpactScore(b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return {
    sortedArticles: rankedByImpact,
    hasFreshPublication24h: false,
    freshArticle: null,
    curationBadge: '🔥 ALTO IMPACTO DO MOMENTO (CURADORIA INTELIGENTE)',
  };
}


/**
 * Primeira imagem de um markdown, usada como capa quando o autor não define
 * uma explicitamente.
 *
 * O `ArticleForm` importava esta função, que não existia: a importação
 * resolvia para `undefined` e a chamada derrubava o formulário ao publicar.
 *
 * Ignora imagens de tracking (pixel de 1x1) e devolve string vazia quando não
 * há nenhuma imagem utilizável.
 */
export function extractFirstImageUrlFromMarkdown(markdown: string | null | undefined): string {
  if (typeof markdown !== 'string' || !markdown.trim()) return '';

  const matches = markdown.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g);
  for (const match of matches) {
    const url = (match[1] || '').trim();
    if (!url) continue;
    // Pixel de rastreamento: não serve como capa.
    if (/(?:^|\/)(?:pixel|beacon|track|analytics|1x1|spacer)[.\-_]/i.test(url)) continue;
    return url;
  }
  return '';
}
