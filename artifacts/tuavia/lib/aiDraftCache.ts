import { db } from '@/lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { parseJsonOrYamlClient } from '@/lib/utils/browserParser';
import { AITask } from '@/lib/ai/types';
import { slugify } from '@/lib/slug';
import { PUBLISHED_ARTICLES_STORAGE_KEY, extractFirstImageUrlFromMarkdown } from '@/lib/articles';
import { PUBLISHED_BIKES_STORAGE_KEY, generateSlug as generateBikeSlug } from '@/lib/ebikes';
import { RANKING_STORAGE_KEY, TopRanking } from '@/types/ranking';
import { Article, ArticleCategory } from '@/types/article';
import { safeJsonStringify } from '@/lib/utils';
import { fetchAdminJson } from '@/lib/ai/clientResponse';


export interface AIDraftItem {
  id: string;
  taskType: AITask;
  title: string;
  summary: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft_cached' | 'audited' | 'published';
  rawContent: string;
  parsedData?: Record<string, any>;
  firebaseRefId?: string;
  metadata?: {
    category?: string;
    brand?: string;
    score?: number;
    issuesCount?: number;
    auditStatus?: string;
    slug?: string;
    excerpt?: string;
    coverImage?: string;
  };
}

const STORAGE_KEY = 'tuavia_ai_drafts_v1';
const PUBLISHED_KEY = 'tuavia_published_items_v1';

/**
 * Retorna todos os rascunhos salvos no cache de curto prazo do navegador (localStorage)
 */
export function getAIDrafts(): AIDraftItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[aiDraftCache] Erro ao carregar rascunhos do cache local:', err);
    return [];
  }
}

/**
 * Salva ou atualiza um rascunho no cache de curto prazo do navegador
 */
export function saveAIDraft(
  draft: Omit<AIDraftItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    id?: string;
    status?: 'draft_cached' | 'audited' | 'published';
  }
): AIDraftItem {
  const existingDrafts = getAIDrafts();
  const now = new Date().toISOString();
  const id = draft.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Tentar parsear o conteúdo se não vier parsedData prévio
  let parsedData = draft.parsedData;
  if (!parsedData && draft.rawContent) {
    try {
      parsedData = parseJsonOrYamlClient(draft.rawContent) || undefined;
    } catch {
      // Manter como está
    }
  }

  const newDraft: AIDraftItem = {
    id,
    taskType: draft.taskType,
    title: draft.title || 'Rascunho IA Sem Título',
    summary: draft.summary || draft.rawContent.slice(0, 160).replace(/[*_#]/g, '').trim(),
    model: draft.model || 'AI Router',
    createdAt: draft.id ? (existingDrafts.find((d) => d.id === draft.id)?.createdAt || now) : now,
    updatedAt: now,
    status: draft.status || 'draft_cached',
    rawContent: draft.rawContent,
    parsedData: parsedData || {},
    firebaseRefId: draft.firebaseRefId,
    metadata: draft.metadata,
  };

  const filtered = existingDrafts.filter((d) => d.id !== id);
  const updatedList = [newDraft, ...filtered];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, safeJsonStringify(updatedList));
    } catch (err) {
      console.error('[aiDraftCache] Erro ao salvar rascunho no localStorage:', err);
    }
  }

  return newDraft;
}

/**
 * Remove um rascunho específico do cache local
 */
export function deleteAIDraft(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = getAIDrafts();
  const updated = existing.filter((d) => d.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, safeJsonStringify(updated));
  } catch (err) {
    console.error('[aiDraftCache] Erro ao excluir rascunho:', err);
  }
}

/**
 * Limpa todo o cache local de rascunhos da IA
 */
export function clearAllAIDrafts(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[aiDraftCache] Erro ao limpar rascunhos:', err);
  }
}

export interface PublishArticleOverrides {
  title?: string;
  slug?: string;
  excerpt?: string;
  category?: string;
  coverImage?: string;
  body?: string;
  readingTimeMinutes?: number;
}

/**
 * Confirma e envia o rascunho em cache para a coleção apropriada no Firebase (Firestore)
 * Se o Firebase Firestore estiver offline ou com credenciais de build, salva no catálogo local publicado.
 */
export async function publishAIDraftToFirebase(
  draftId: string,
  overrides?: PublishArticleOverrides
): Promise<{
  success: boolean;
  docId: string;
  collectionName: string;
  message: string;
  slug: string;
}> {
  const drafts = getAIDrafts();
  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) {
    throw new Error('Rascunho não encontrado no cache do navegador.');
  }

  // Determinar o tipo de entidade real do rascunho (Artigo, E-Bike ou Ranking)
  //
  // Só contam os `AITask` que existem. Havia literais legados
  // ('bicycle_analysis', 'top_ranking', 'recommendation') comparados contra a
  // união `AITask`: comparações que nunca eram verdade, então a detecção
  // dependia só do formato de `parsedData`.
  const isEbike =
    draft.taskType === 'ebike_autofill' ||
    draft.taskType === 'ebike_ingest_step' ||
    Boolean(draft.parsedData?.marca && draft.parsedData?.modelo);
  const isRanking =
    draft.taskType === 'ranking_generation' ||
    Boolean(
      draft.parsedData?.criterioAvaliacao ||
        (Array.isArray(draft.parsedData?.itens) &&
          draft.parsedData.itens.length > 0 &&
          (draft.parsedData.itens[0]?.tituloItem || draft.parsedData.itens[0]?.posicao || draft.parsedData.itens[0]?.nome))
    );
  const isArticle = !isEbike && !isRanking;

  const collectionName = isEbike ? 'bikes' : isRanking ? 'rankings' : 'artigos';

  const rawTitle = overrides?.title || draft.parsedData?.title || draft.parsedData?.titulo || draft.title || 'Item sem Título';
  const targetSlug = overrides?.slug || draft.parsedData?.slug || draft.metadata?.slug || slugify(rawTitle);
  const targetExcerpt =
    overrides?.excerpt ||
    draft.parsedData?.excerpt ||
    draft.parsedData?.subtitulo ||
    draft.parsedData?.resumoExecutivo ||
    draft.summary ||
    'Análise e guia completo sobre e-bikes e mobilidade urbana.';
  const targetCategory = (overrides?.category || draft.parsedData?.category || draft.parsedData?.categoria || draft.metadata?.category || 'Guia de Compra');
  const targetBody =
    overrides?.body ||
    draft.parsedData?.artigo_completo_markdown ||
    draft.parsedData?.markdownContent ||
    draft.rawContent ||
    '';
  const extractedCoverFromMarkdown = extractFirstImageUrlFromMarkdown(targetBody);
  const rawCoverCandidate =
    overrides?.coverImage ||
    draft.parsedData?.coverImage ||
    draft.parsedData?.imagemUrl ||
    draft.metadata?.coverImage ||
    '';
  const defaultPlaceholder = 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&q=80';
  const targetCover =
    (rawCoverCandidate && rawCoverCandidate !== defaultPlaceholder ? rawCoverCandidate : null) ||
    extractedCoverFromMarkdown ||
    rawCoverCandidate ||
    defaultPlaceholder;

  const todayStr = new Date().toISOString().split('T')[0];
  const docId = targetSlug;
  const now = new Date().toISOString();

  let entityPayload: any = null;
  let endpoint = '/api/articles';
  let bodyPayload: any = {};

  if (isEbike) {
    endpoint = '/api/bikes';
    entityPayload = {
      slug: targetSlug,
      modelo: draft.parsedData?.modelo || rawTitle,
      marca: draft.parsedData?.marca || 'TuaVia Selected',
      usoPrincipal: draft.parsedData?.usoPrincipal || 'Urbana',
      autonomiaKm: Number(draft.parsedData?.autonomiaKm) || 40,
      potenciaW: Number(draft.parsedData?.potenciaW) || 350,
      pesoKg: Number(draft.parsedData?.pesoKg) || 22,
      tempoCargaHoras: Number(draft.parsedData?.tempoCargaHoras) || 5,
      imagemUrl: targetCover,
      galleryImages: draft.parsedData?.galleryImages || [],
      menorPreco: Number(draft.parsedData?.menorPreco) || 0,
      maiorPreco: Number(draft.parsedData?.maiorPreco) || 0,
      ofertas: draft.parsedData?.ofertas || [],
      specSections: draft.parsedData?.specSections || [],
      pros: draft.parsedData?.pros || [],
      cons: draft.parsedData?.cons || [],
      idealFor: draft.parsedData?.idealFor || '',
      resumoExecutivo: targetExcerpt,
      verdict: draft.parsedData?.verdict || '',
      badge: draft.parsedData?.badge || '',
      updatedAt: now,
    };
    bodyPayload = { bike: entityPayload };
  } else if (isRanking) {
    endpoint = '/api/rankings';
    const rawItens = Array.isArray(draft.parsedData?.itens) ? draft.parsedData.itens : [];
    const normalizedItens = rawItens.map((it: any, idx: number) => ({
      posicao: Number(it.posicao) || idx + 1,
      marca: it.marca || '',
      tituloItem: it.tituloItem || it.titulo || it.nome || `Opção #${idx + 1}`,
      categoriaItem: it.categoriaItem || it.categoria || '',
      seloDestaque: it.seloDestaque || (idx === 0 ? 'Melhor Escolha Geral' : idx === 1 ? 'Melhor Custo-Benefício' : 'Destaque Técnico'),
      resumoAvaliacao: it.resumoAvaliacao || it.descricao || it.avaliacao || '',
      faixaPrecoEstimado: it.faixaPrecoEstimado || it.preco || '',
      imagemUrl: it.imagemUrl || it.foto || '',
      pontosPositivos: Array.isArray(it.pontosPositivos) ? it.pontosPositivos : [],
      pontosNegativos: Array.isArray(it.pontosNegativos) ? it.pontosNegativos : [],
      especificacoesChave: Array.isArray(it.especificacoesChave)
        ? it.especificacoesChave
        : typeof it.especificacoesChave === 'object' && it.especificacoesChave
        ? Object.entries(it.especificacoesChave).map(([label, value]) => ({ label, value: String(value) }))
        : [],
      lojasOndeEncontrar: Array.isArray(it.lojasOndeEncontrar)
        ? it.lojasOndeEncontrar
        : Array.isArray(it.lojas)
        ? it.lojas
        : [],
    }));

    entityPayload = {
      id: docId,
      slug: targetSlug,
      titulo: rawTitle,
      subtitulo: draft.parsedData?.subtitulo || targetExcerpt,
      tipoRanking: normalizedItens.length <= 3 ? 'top3' : normalizedItens.length <= 5 ? 'top5' : 'top10',
      categoria: draft.parsedData?.categoria || 'ebikes',
      quantidadeItens: normalizedItens.length || 5,
      criterioAvaliacao: draft.parsedData?.criterioAvaliacao || 'Custo-benefício, autonomia real, qualidade dos componentes e assistência técnica.',
      conclusaoGeral: draft.parsedData?.conclusaoGeral || '',
      itens: normalizedItens,
      dataAtualizacao: todayStr,
      autor: draft.parsedData?.autor || 'Equipe TuaVia',
      publicado: true,
      atualizadoEm: now,
    };
    bodyPayload = { ranking: entityPayload };
  } else {
    endpoint = '/api/articles';
    entityPayload = {
      slug: targetSlug,
      title: rawTitle,
      excerpt: targetExcerpt,
      coverImage: targetCover,
      category: targetCategory as ArticleCategory,
      publishedAt: now,
      readingTimeMinutes: overrides?.readingTimeMinutes || draft.parsedData?.readingTimeMinutes || 5,
      body: targetBody,
      relatedBikeCategories: ['Urbana', 'Trilha/MTB'],
    };
    bodyPayload = { article: entityPayload };
  }

  const payloadToPublish = {
    id: docId,
    originalDraftId: draft.id,
    taskType: draft.taskType,
    title: rawTitle,
    slug: targetSlug,
    rawContent: targetBody,
    data: entityPayload,
    model: draft.model,
    publishedAt: now,
    status: 'published',
  };

  let firebaseSuccess = false;

  // 1. Tentar gravar na API local do servidor com autorização de administrador
  try {
    if (typeof window !== 'undefined') {
      await fetchAdminJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeJsonStringify(bodyPayload),
      });
    }
  } catch (apiErr) {
    console.warn('[aiDraftCache] Falha ao enviar para API do servidor:', apiErr);
  }

  // 2. Tentar gravar no Firebase Firestore
  try {
    if (db && db.app?.options?.projectId && !db.app.options.projectId.includes('placeholder')) {
      const docRef = doc(collection(db, collectionName), docId);
      await setDoc(docRef, entityPayload);
      firebaseSuccess = true;
    }
  } catch (err) {
    console.warn('[aiDraftCache] Falha no Firestore (salvando no catálogo local do site):', err);
  }

  // 3. Gravar no catálogo local correspondente (localStorage) para exibição imediata
  if (typeof window !== 'undefined') {
    try {
      if (isArticle) {
        const existingRaw = localStorage.getItem(PUBLISHED_ARTICLES_STORAGE_KEY);
        const existing: Article[] = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = existing.filter((a) => a.slug !== targetSlug);
        localStorage.setItem(PUBLISHED_ARTICLES_STORAGE_KEY, safeJsonStringify([entityPayload, ...filtered]));
      } else if (isEbike) {
        const existingRaw = localStorage.getItem(PUBLISHED_BIKES_STORAGE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = existing.filter((b: any) => b.slug !== targetSlug);
        localStorage.setItem(PUBLISHED_BIKES_STORAGE_KEY, safeJsonStringify([entityPayload, ...filtered]));
      } else if (isRanking) {
        const existingRaw = localStorage.getItem(RANKING_STORAGE_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        const filtered = existing.filter((r: any) => r.slug !== targetSlug);
        localStorage.setItem(RANKING_STORAGE_KEY, safeJsonStringify([entityPayload, ...filtered]));
      }
    } catch (e) {
      console.warn('[aiDraftCache] Erro ao salvar item publicado no localStorage:', e);
    }
  }

  // 4. Gravar no catálogo genérico de publicados local
  try {
    if (typeof window !== 'undefined') {
      const existingPublishedRaw = localStorage.getItem(PUBLISHED_KEY);
      const existingPublished = existingPublishedRaw ? JSON.parse(existingPublishedRaw) : [];
      const filteredGen = existingPublished.filter((item: any) => item.id !== docId);
      localStorage.setItem(PUBLISHED_KEY, safeJsonStringify([payloadToPublish, ...filteredGen]));
    }
  } catch (e) {
    console.warn('[aiDraftCache] Erro ao salvar histórico genérico:', e);
  }

  // 5. Atualizar o rascunho no cache local com status 'published'
  saveAIDraft({
    ...draft,
    title: rawTitle,
    status: 'published',
    firebaseRefId: docId,
    metadata: {
      ...draft.metadata,
      slug: targetSlug,
      category: targetCategory,
      excerpt: targetExcerpt,
      coverImage: targetCover,
    },
  });

  const pathType = isEbike ? `/bikes/${targetSlug}` : isRanking ? `/rankings/${targetSlug}` : `/artigos/${targetSlug}`;

  return {
    success: true,
    docId,
    collectionName,
    slug: targetSlug,
    message: firebaseSuccess
      ? `"${rawTitle}" publicado com sucesso no Firebase e no site (${pathType}).`
      : `"${rawTitle}" publicado com sucesso no site (${pathType}).`,
  };
}

