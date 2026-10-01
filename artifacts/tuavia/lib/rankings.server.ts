import { TopRanking, RankingCategory, RankingItem } from '@/types/ranking';
import {
  getAllRankingsServer,
  getRankingBySlugServer,
  getDeletedSlugsServer,
  getAllBikesServer,
  saveBikeToServerFile,
} from '@/lib/serverStorage';
import { getAdminDb, withAdminTimeout, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { EBikeGrouped, EBikeStoreOffer } from '@/types/ebike';
import { generateRealisticPriceHistory, sanitizePriceHistory } from '@/lib/priceHistory';
import { invalidateBikesServerCache } from '@/lib/ebikes.server';
import { sanitizeRankingImagesServer } from '@/lib/imageOptimization.server';

// Cache em memória do servidor com TTL para velocidade instantânea (<2ms)
let cachedServerRankings: TopRanking[] | null = null;
let cachedServerRankingsTimestamp = 0;
const SERVER_RANKINGS_CACHE_TTL_MS = 60 * 1000;

export function invalidateRankingsServerCache(): void {
  cachedServerRankings = null;
  cachedServerRankingsTimestamp = 0;
}


export async function getPublishedRankingsServer(): Promise<TopRanking[]> {
  const now = Date.now();
  if (cachedServerRankings && now - cachedServerRankingsTimestamp < SERVER_RANKINGS_CACHE_TTL_MS) {
    return cachedServerRankings;
  }

  const deleted = await getDeletedSlugsServer();
  const deletedSet = new Set(deleted.rankings || []);
  const map = new Map<string, TopRanking>();

  // 1. Arquivo local do servidor (instantâneo)
  try {
    const serverList = await getAllRankingsServer();
    if (Array.isArray(serverList)) {
      serverList.forEach((r) => {
        if (r && r.slug && !deletedSet.has(r.slug) && r.publicado !== false) {
          map.set(r.slug, r);
        }
      });
    }
  } catch (err) {
    console.warn('[rankings.server] Erro ao carregar arquivo local de rankings:', err);
  }

  // 2. Firestore Cloud DB (se configurado e disponível)
  if (isFirestoreDatabaseAvailable()) {
    try {
      const adminDb = getAdminDb();
      if (adminDb) {
        const snap = await withAdminTimeout(
          adminDb.collection('rankings').limit(20).get(),
          3500,
          null
        );
        if (snap && !snap.empty) {
          snap.docs.forEach((docSnap) => {
            const data = docSnap.data() as TopRanking;
            if (data && data.slug && !deletedSet.has(data.slug) && data.publicado !== false) {
              map.set(data.slug, data);
            }
          });
        }
      }
    } catch (dbErr) {
      console.warn('[rankings.server] Firestore indisponível para rankings:', dbErr);
    }
  }

  let rawRankings = Array.from(map.values());

  // Ordena por data de atualização (mais recente primeiro)
  rawRankings.sort((a, b) => {
    const dateA = new Date(a.dataAtualizacao || '2025-01-01').getTime();
    const dateB = new Date(b.dataAtualizacao || '2025-01-01').getTime();
    return dateB - dateA;
  });

  const finalRankings = await Promise.all(
    rawRankings.map((r) => sanitizeRankingImagesServer(r))
  );

  cachedServerRankings = finalRankings;
  cachedServerRankingsTimestamp = now;

  return finalRankings;
}

export async function getRankingBySlugServerCached(slug: string): Promise<TopRanking | null> {
  if (!slug) return null;
  const all = await getPublishedRankingsServer();
  return all.find((r) => r.slug.toLowerCase() === slug.toLowerCase()) || null;
}

/**
 * Sincroniza e-bikes presentes no Top Ranking diretamente com o catálogo global de E-Bikes (/ebike)
 * e o comparador de modelos (/comparar).
 * 
 * REGRA ESTRITA:
 * As e-bikes só são enviadas para o catálogo quando o ranking for PUBLICADO (publicado === true).
 * Se o ranking estiver em rascunho ou não publicado, nenhuma e-bike é injetada no catálogo.
 */
export async function syncRankingBikesToCatalog(ranking: TopRanking): Promise<TopRanking> {
  if (!ranking || !ranking.publicado || !Array.isArray(ranking.itens)) {
    return ranking;
  }

  const isEbikeCategory = ranking.categoria === 'ebikes' || ranking.categoria === 'custo-beneficio';
  const existingBikes = await getAllBikesServer();
  const existingBikesMap = new Map<string, EBikeGrouped>();

  existingBikes.forEach((b) => {
    if (b && b.slug) {
      existingBikesMap.set(b.slug.toLowerCase(), b);
      const cleanName = `${b.marca || ''} ${b.modelo || ''}`.trim().toLowerCase();
      if (cleanName) existingBikesMap.set(cleanName, b);
      if (b.modelo) existingBikesMap.set(b.modelo.trim().toLowerCase(), b);
    }
  });

  const updatedItens: RankingItem[] = [];
  let hasChangesToCatalog = false;

  const parseNumber = (val: any, fallback: number): number => {
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
    const match = String(val || '').match(/(\d+([\.,]\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  for (const item of ranking.itens) {
    const updatedItem: RankingItem = { ...item };
    const itemTitle = (item.tituloItem || '').trim();
    const itemBrand = (item.marca || '').trim();
    
    // Identifica se o item é uma e-bike (pela categoria ou presença de motor/bateria/potência)
    const isBikeItem = isEbikeCategory ||
      (item.categoriaItem || '').toLowerCase().includes('bike') ||
      (item.categoriaItem || '').toLowerCase().includes('elétrica') ||
      Boolean(item.especificacoes?.['Motor'] || item.especificacoes?.['Potência'] || item.potenciaW);

    if (isBikeItem && itemTitle) {
      const directSlugCandidate = (item.bikeSlug || `${itemBrand}-${itemTitle}`)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const normalizedFullName = `${itemBrand} ${itemTitle}`.trim().toLowerCase();
      const existing = existingBikesMap.get(directSlugCandidate) ||
        existingBikesMap.get(normalizedFullName) ||
        existingBikesMap.get(itemTitle.toLowerCase()) ||
        existingBikes.find((b) => {
          const bFull = `${b.marca} ${b.modelo}`.toLowerCase();
          return b.slug === directSlugCandidate ||
            bFull === normalizedFullName ||
            b.modelo.toLowerCase() === itemTitle.toLowerCase() ||
            (b.marca.toLowerCase() === itemBrand.toLowerCase() && itemTitle.toLowerCase().includes(b.modelo.toLowerCase()));
        });

      const potencia = item.potenciaW || parseNumber(item.especificacoes?.['Motor'] || item.especificacoes?.['Potência'], 350);
      const autonomia = item.autonomiaKm || parseNumber(item.especificacoes?.['Autonomia'], 45);
      const peso = item.pesoKg || parseNumber(item.especificacoes?.['Peso'], 24);
      const tempoCarga = item.tempoCargaHoras || parseNumber(item.especificacoes?.['Recarga'] || item.especificacoes?.['Tempo de Carga'], 5);

      // Preços calculados a partir das ofertas ou da faixa estimada
      let menorPreco = item.menorPreco || 0;
      let maiorPreco = item.maiorPreco || 0;

      if (Array.isArray(item.lojas) && item.lojas.length > 0) {
        const validPrices = item.lojas.map((l) => Number(l.preco)).filter((p) => p > 0);
        if (validPrices.length > 0) {
          menorPreco = Math.min(...validPrices);
          maiorPreco = Math.max(...validPrices);
        }
      }

      if (!menorPreco || menorPreco <= 0) {
        menorPreco = parseNumber(item.faixaPrecoEstimado, 4500);
        maiorPreco = Math.round(menorPreco * 1.15);
      }

      // Histórico de preços para o gráfico
      const priceHistory = item.priceHistory && item.priceHistory.length > 0
        ? sanitizePriceHistory(item.priceHistory, menorPreco)
        : generateRealisticPriceHistory(menorPreco);

      updatedItem.priceHistory = priceHistory;
      updatedItem.menorPreco = menorPreco;
      updatedItem.maiorPreco = maiorPreco;
      updatedItem.potenciaW = potencia;
      updatedItem.autonomiaKm = autonomia;
      updatedItem.pesoKg = peso;
      updatedItem.tempoCargaHoras = tempoCarga;

      if (existing) {
        // A e-bike já existe no catálogo: vincula o slug exato para permitir comparação e visualização
        updatedItem.bikeSlug = existing.slug;
        if (!updatedItem.imagemUrl && existing.imagemUrl) {
          updatedItem.imagemUrl = existing.imagemUrl;
        }

        // Se a e-bike existente não tiver ofertas ou se o ranking trouxer ofertas atualizadas, preserva ou enriquece
        if (Array.isArray(item.lojas) && item.lojas.length > 0 && (!existing.ofertas || existing.ofertas.length === 0)) {
          existing.ofertas = item.lojas.map((l, idx) => ({
            id: Number(idx + 1),
            loja: l.nomeLoja || 'Loja Verificada',
            preco: l.preco || menorPreco,
            linkProduto: l.url || '#',
            cupomDesconto: l.cupom,
            destaqueOferta: l.destaque ? 'Melhor Preço' : undefined,
            disponibilidade: 'Disponível',
            dataAtualizacao: new Date().toISOString(),
            observacoes: 'Oferta vinculada via ranking comparativo',
          }));
          try {
            await saveBikeToServerFile(existing);
            hasChangesToCatalog = true;
          } catch (err) {
            console.warn('[rankings.server] Erro ao enriquecer ofertas da ebike existente:', err);
          }
        }
      } else {
        // A e-bike AINDA NÃO EXISTE: cadastra individualmente no catálogo TuaVia!
        const newSlug = directSlugCandidate || `ebike-${Date.now()}`;
        const cleanModelo = itemTitle.toLowerCase().startsWith(itemBrand.toLowerCase())
          ? itemTitle.slice(itemBrand.length).trim()
          : itemTitle;

        const bikeOffers: EBikeStoreOffer[] = (item.lojas || []).map((l, idx) => ({
          id: Number(idx + 1),
          loja: l.nomeLoja || 'Loja Online',
          preco: l.preco || menorPreco,
          linkProduto: l.url || '#',
          cupomDesconto: l.cupom,
          destaqueOferta: l.destaque ? 'Melhor Preço' : undefined,
          disponibilidade: 'Disponível',
          dataAtualizacao: new Date().toISOString(),
          observacoes: 'Oferta vinculada via ranking comparativo',
        }));

        const newBike: EBikeGrouped = {
          slug: newSlug,
          marca: itemBrand || 'E-Bike',
          modelo: cleanModelo || itemTitle,
          usoPrincipal: ((item.categoriaItem as any) || 'Urbana'),
          potenciaW: potencia,
          autonomiaKm: autonomia,
          pesoKg: peso,
          tempoCargaHoras: tempoCarga,
          imagemUrl: item.imagemUrl || 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&auto=format&fit=crop&q=80',
          galleryImages: item.imagemUrl ? [item.imagemUrl] : [],
          menorPreco: menorPreco,
          maiorPreco: maiorPreco,
          ofertas: bikeOffers,
          priceHistory: priceHistory,
          pros: item.pontosPositivos || [],
          cons: item.pontosNegativos || [],
          resumoExecutivo: item.observacoes || `${item.marca} ${cleanModelo}: selecionada na posição ${item.posicao} do ranking "${ranking.titulo}" com destaque em ${item.notaDestaque}.`,
          verdict: item.notaDestaque || 'Destaque no Top Ranking TuaVia',
          badge: item.notaDestaque || undefined,
          specSections: [
            {
              title: 'Especificações Técnicas',
              items: Object.entries(item.especificacoes || {}).map(([label, value]) => ({ label, value: String(value) })),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        };

        try {
          await saveBikeToServerFile(newBike);
          const adminDb = getAdminDb();
          if (adminDb && isFirestoreDatabaseAvailable()) {
            await withAdminTimeout(
              adminDb.collection('bikes').doc(newBike.slug).set(newBike, { merge: true }),
              2500,
              null
            );
          }
          hasChangesToCatalog = true;
          existingBikesMap.set(newBike.slug, newBike);
        } catch (bikeErr) {
          console.error('[rankings.server] Erro ao cadastrar ebike individual do ranking:', bikeErr);
        }

        updatedItem.bikeSlug = newSlug;
      }
    }

    updatedItens.push(updatedItem);
  }

  if (hasChangesToCatalog) {
    invalidateBikesServerCache();
  }

  return {
    ...ranking,
    itens: updatedItens,
  };
}

