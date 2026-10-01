import React from 'react';
import CatalogGrid from '@/components/catalog/CatalogGrid';
import Footer from '@/components/Footer';
import { getPublishedBikesServer } from '@/lib/ebikes.server';
import { getPublishedArticlesServer } from '@/lib/articles.server';
import { getPublishedRankingsServer } from '@/lib/rankings.server';
import { getCuratedHomeArticles } from '@/lib/articles';
import { EBikeGrouped } from '@/types/ebike';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';

import { headers } from 'next/headers';

// ISR ou Renderização inteligente por User-Agent
export const dynamic = 'auto';

// Curadoria determinística local (sem dependência de IA/Armazenamento em disco)
function generateDeterministicCuration(bikes: EBikeGrouped[], articles: Article[]) {
  const safeBikes = [...bikes];
  const safeArticles = [...articles].filter((a) => !a.hideFromFeed);

  // 1. OPORTUNIDADES COM DIFERENÇA DE PREÇO AUDITADA
  const bikesWithDiff = safeBikes
    .filter((b) => (b.maiorPreco || 0) > (b.menorPreco || 0))
    .map((b) => ({
      ...b,
      economia: (b.maiorPreco || 0) - (b.menorPreco || 0),
      discountPct: Math.round((((b.maiorPreco || 0) - (b.menorPreco || 0)) / (b.maiorPreco || 1)) * 100),
    }))
    .sort((a, b) => b.economia - a.economia);

  const usedSlugs = new Set<string>();
  const pickDistinctBike = (candidates: EBikeGrouped[], fallbackList: EBikeGrouped[]): EBikeGrouped => {
    const found = candidates.find((b) => b && b.slug && !usedSlugs.has(b.slug));
    if (found) { usedSlugs.add(found.slug); return found; }
    const fallbackFound = fallbackList.find((b) => b && b.slug && !usedSlugs.has(b.slug));
    if (fallbackFound) { usedSlugs.add(fallbackFound.slug); return fallbackFound; }
    const anyAvailable = candidates[0] || fallbackList[0] || { slug: '', modelo: 'E-Bike em Destaque', marca: 'TuaVia', menorPreco: 0, maiorPreco: 0, autonomiaKm: 0, potenciaW: 0, pesoKg: 0 };
    if (anyAvailable.slug) usedSlugs.add(anyAvailable.slug);
    return anyAvailable;
  };

  const bestDiffBike = pickDistinctBike(bikesWithDiff, safeBikes);
  const secondDiffBike = pickDistinctBike(bikesWithDiff, safeBikes);
  const smartValueCandidates = [...safeBikes].sort((a, b) => (a.menorPreco || 0) - (b.menorPreco || 0));
  const thirdDiffBike = pickDistinctBike(smartValueCandidates, safeBikes);
  const rangeCandidates = [...safeBikes].filter((b) => (b.autonomiaKm || 0) > 0).sort((a, b) => (b.autonomiaKm || 0) - (a.autonomiaKm || 0));
  const topRangeBike = pickDistinctBike(rangeCandidates, safeBikes);

  const { sortedArticles } = getCuratedHomeArticles(safeArticles);
  const weekArticle = sortedArticles[0] || null;
  const monthArticle = sortedArticles[1] || sortedArticles[0] || null;

  // Pódios por categoria
  const podiumCusto = [...safeBikes].sort((a, b) => a.menorPreco - b.menorPreco).slice(0, 3).map((b) => b.slug);
  const podiumSubidas = [...safeBikes].filter((b) => Boolean(b.usoPrincipal === 'Trilha/MTB' || (typeof b.potenciaW === 'number' && b.potenciaW >= 350))).sort((a, b) => (b.potenciaW || 0) - (a.potenciaW || 0)).slice(0, 3).map((b) => b.slug);
  const podiumDobraveis = [...safeBikes].filter((b) => Boolean(b.usoPrincipal === 'Dobrável' || b.modelo.toLowerCase().includes('dobr') || (typeof b.pesoKg === 'number' && b.pesoKg <= 23))).sort((a, b) => (a.pesoKg || 99) - (b.pesoKg || 99)).slice(0, 3).map((b) => b.slug);
  const podiumUrbanas = [...safeBikes].filter((b) => b.usoPrincipal === 'Urbana').sort((a, b) => (b.autonomiaKm || 0) - (a.autonomiaKm || 0)).slice(0, 3).map((b) => b.slug);

  // Duelos curados
  const getMatchupKey = (slugA: string, slugB: string) => [slugA, slugB].sort().join(':::');
  const seenMatchups = new Set<string>();
  const seenBikes = new Set<string>();
  const duels: Array<{ id: string; tag: string; bikeASlug: string; bikeBSlug: string; destaque: string }> = [];
  const findPair = (filterA?: ((b: EBikeGrouped) => boolean) | null, filterB?: ((b: EBikeGrouped) => boolean) | null): [EBikeGrouped, EBikeGrouped] | null => {
    const poolA = filterA ? safeBikes.filter(filterA) : safeBikes;
    const unusedA = poolA.filter((b) => !seenBikes.has(b.slug));
    const candidatesA = unusedA.length > 0 ? unusedA : poolA;
    for (const candA of candidatesA) {
      const poolB = filterB ? safeBikes.filter(filterB) : safeBikes;
      const candidatesB = poolB.filter((b) => b.slug !== candA.slug).sort((a, b) => (seenBikes.has(a.slug) ? 1 : 0) - (seenBikes.has(b.slug) ? 1 : 0));
      for (const candB of candidatesB) {
        const key = getMatchupKey(candA.slug, candB.slug);
        if (!seenMatchups.has(key)) { seenMatchups.add(key); seenBikes.add(candA.slug); seenBikes.add(candB.slug); return [candA, candB]; }
      }
    }
    return null;
  };
  const pair1 = findPair((b) => (b.menorPreco || 0) <= 3200, (b) => (b.menorPreco || 0) <= 3500) || findPair();
  if (pair1) duels.push({ id: 'duel-1', tag: 'Duelo Urbano Entrada', bikeASlug: pair1[0].slug, bikeBSlug: pair1[1].slug, destaque: 'Autonomia vs Preço' });
  const pair2 = findPair((b) => Boolean(b.usoPrincipal?.toLowerCase().includes('dobr') || b.modelo.toLowerCase().includes('pliage') || (typeof b.pesoKg === 'number' && b.pesoKg > 0 && b.pesoKg <= 22)), null) || findPair();
  if (pair2) duels.push({ id: 'duel-2', tag: 'Confronto Dobráveis & Compactas', bikeASlug: pair2[0].slug, bikeBSlug: pair2[1].slug, destaque: 'Portabilidade Metrô' });
  const pair3 = findPair((b) => (b.potenciaW || 0) >= 350, null) || findPair();
  if (pair3) { const potA = pair3[0].potenciaW || 350; const potB = pair3[1].potenciaW || 350; duels.push({ id: 'duel-3', tag: 'Duelo de Potência', bikeASlug: pair3[0].slug, bikeBSlug: pair3[1].slug, destaque: potA !== potB ? `${potA}W vs ${potB}W Ladeiras` : 'Potência vs Autonomia' }); }

  const catalogPrioritySlugs = [bestDiffBike.slug, secondDiffBike.slug, thirdDiffBike.slug, topRangeBike.slug, ...safeBikes.map((b) => b.slug)].filter((val, idx, self) => self.indexOf(val) === idx);

  return {
    bikes: {
      dealOfWeek: { slug: bestDiffBike.slug, modelo: bestDiffBike.modelo, marca: bestDiffBike.marca, menorPreco: bestDiffBike.menorPreco || 0, maiorPreco: bestDiffBike.maiorPreco || bestDiffBike.menorPreco || 0, economiaBrl: Math.max((bestDiffBike.maiorPreco || 0) - (bestDiffBike.menorPreco || 0), 0), discountPct: Math.round((((bestDiffBike.maiorPreco || 0) - (bestDiffBike.menorPreco || 0)) / (bestDiffBike.maiorPreco || 1)) * 100) || 15, badge: 'MAIOR DESCONTO DA SEMANA', headline: 'Oportunidade auditada com maior redução de preço nas lojas parceiras', aiVerdict: `Melhor cotação atual identificada. O modelo ${bestDiffBike.modelo} destaca-se pela robustez mecânica e motor de assistência eficiente.`, autonomiaKm: bestDiffBike.autonomiaKm, potenciaW: bestDiffBike.potenciaW, pesoKg: bestDiffBike.pesoKg, imagemUrl: bestDiffBike.imagemUrl },
      dealOfMonth: { slug: secondDiffBike.slug, modelo: secondDiffBike.modelo, marca: secondDiffBike.marca, menorPreco: secondDiffBike.menorPreco || 0, maiorPreco: secondDiffBike.maiorPreco || secondDiffBike.menorPreco || 0, economiaBrl: Math.max((secondDiffBike.maiorPreco || 0) - (secondDiffBike.menorPreco || 0), 0), discountPct: Math.round((((secondDiffBike.maiorPreco || 0) - (secondDiffBike.menorPreco || 0)) / (secondDiffBike.maiorPreco || 1)) * 100) || 12, badge: 'OFERTA DO MÊS', headline: 'Melhor relação custo-benefício sustentada ao longo do mês', aiVerdict: 'Consistência de preço excelente. Recomendação de investimento inteligente.', autonomiaKm: secondDiffBike.autonomiaKm, potenciaW: secondDiffBike.potenciaW, pesoKg: secondDiffBike.pesoKg, imagemUrl: secondDiffBike.imagemUrl },
      bestValuePick: { slug: thirdDiffBike.slug, modelo: thirdDiffBike.modelo, marca: thirdDiffBike.marca, menorPreco: thirdDiffBike.menorPreco || 0, maiorPreco: thirdDiffBike.maiorPreco || thirdDiffBike.menorPreco || 0, economiaBrl: Math.max((thirdDiffBike.maiorPreco || 0) - (thirdDiffBike.menorPreco || 0), 0), discountPct: Math.round((((thirdDiffBike.maiorPreco || 0) - (thirdDiffBike.menorPreco || 0)) / (thirdDiffBike.maiorPreco || 1)) * 100) || 10, badge: 'ESCOLHA INTELIGENTE', headline: 'Equilíbrio auditado entre autonomia, peso e rede de assistência', aiVerdict: 'Excelente nota de ergonomia urbana e facilidade de reposição de peças no Brasil.', autonomiaKm: thirdDiffBike.autonomiaKm, potenciaW: thirdDiffBike.potenciaW, pesoKg: thirdDiffBike.pesoKg, imagemUrl: thirdDiffBike.imagemUrl },
      topUrbanRange: { slug: topRangeBike.slug, modelo: topRangeBike.modelo, marca: topRangeBike.marca, menorPreco: topRangeBike.menorPreco || 0, maiorPreco: topRangeBike.maiorPreco || topRangeBike.menorPreco || 0, economiaBrl: Math.max((topRangeBike.maiorPreco || 0) - (topRangeBike.menorPreco || 0), 0), discountPct: 0, badge: 'RECORDE DE AUTONOMIA', headline: `Autonomia de até ${topRangeBike.autonomiaKm || 60} km com uma única carga`, aiVerdict: 'Ideal para percursos longos e entregas diárias sem necessidade de recargas intermediárias.', autonomiaKm: topRangeBike.autonomiaKm, potenciaW: topRangeBike.potenciaW, pesoKg: topRangeBike.pesoKg, imagemUrl: topRangeBike.imagemUrl },
      hotPriceDrops: bikesWithDiff.slice(0, 4).map((b) => ({ slug: b.slug, modelo: b.modelo, marca: b.marca, menorPreco: b.menorPreco || 0, maiorPreco: b.maiorPreco || 0, economiaBrl: b.economia, discountPct: b.discountPct, badge: `-${b.discountPct}% OFF`, headline: 'Queda de preço detectada nas lojas parceiras', aiVerdict: 'Preço em trajetória descendente auditado.', autonomiaKm: b.autonomiaKm, potenciaW: b.potenciaW, pesoKg: b.pesoKg, imagemUrl: b.imagemUrl })),
      weeklyDuel: { bike1Slug: bestDiffBike.slug, bike2Slug: secondDiffBike.slug, title: `${bestDiffBike.modelo} vs ${secondDiffBike.modelo}`, category: 'Urbano / Deslocamento Diário', aiVerdictPreview: `Duelo equilibrado: ${bestDiffBike.modelo} leva vantagem em preço promocional, enquanto ${secondDiffBike.modelo} entrega refinamento ergonômico superior.` },
      podiums: { custoBeneficioSlugs: podiumCusto, subidasSlugs: podiumSubidas, dobraveisSlugs: podiumDobraveis, urbanasSlugs: podiumUrbanas },
      duels,
      catalogPrioritySlugs,
    },
    articles: {
      highRelevanceWeek: weekArticle ? { slug: weekArticle.slug, title: weekArticle.title, summary: weekArticle.excerpt, category: weekArticle.category || 'Legislação', badge: '📌 ALTA RELEVÂNCIA DA SEMANA', editorialHook: 'Leitura indispensável para quem pretende pedalar sem riscos legais e com máxima segurança urbana.', readTimeMinutes: weekArticle.readingTimeMinutes || 5, imageUrl: weekArticle.coverImage, publishedAt: weekArticle.publishedAt } : { slug: '', title: '', summary: '', category: '', badge: '', editorialHook: '', readTimeMinutes: 0, publishedAt: '' },
      highRelevanceMonth: monthArticle ? { slug: monthArticle.slug, title: monthArticle.title, summary: monthArticle.excerpt, category: monthArticle.category || 'Guia de Compra', badge: '🌟 DOSSIÊ EM DESTAQUE DO MÊS', editorialHook: 'Análise técnica aprofundada com os critérios decisivos de compra e comparativo de autonomia.', readTimeMinutes: monthArticle.readingTimeMinutes || 7, imageUrl: monthArticle.coverImage, publishedAt: monthArticle.publishedAt } : { slug: '', title: '', summary: '', category: '', badge: '', editorialHook: '', readTimeMinutes: 0, publishedAt: '' },
      topics: [
        { id: 'topic_contran_legal', title: 'Legislação & Regras CONTRAN', icon: '📜', description: 'Regulamentação 996/2023, velocidade máxima em ciclovias e regras de CNH no Brasil.', badge: 'DESTAQUE SEMANAL', articleSlugs: sortedArticles.filter((a) => a.category === 'Legislação').map((a) => a.slug), relevance: 'semana' },
        { id: 'topic_smart_buying', title: 'Guias de Compra & Escolha Certa', icon: '🎯', description: 'Como escolher potência de motor, capacidade de bateria e ergonomia para seu peso e trajeto.', badge: 'DOSSIÊ DO MÊS', articleSlugs: sortedArticles.filter((a) => a.category === 'Guia de Compra' || a.category === 'Comparativo').map((a) => a.slug), relevance: 'mes' },
        { id: 'topic_economy_mobility', title: 'Economia & Mobilidade Urbana', icon: '💵', description: 'Calculadoras de payback, economia real por km contra carro/ônibus e utilidade familiar.', badge: 'ALTO IMPACTO', articleSlugs: sortedArticles.filter((a) => a.category === 'Economia & Mobilidade').map((a) => a.slug), relevance: 'semana' },
        { id: 'topic_tech_battery', title: 'Tecnologia, Baterias & Rastreamento', icon: '⚡', description: 'Química LFP vs NMC, motores de 750W e GPS anti-furto conectado ao celular.', badge: 'INOVAÇÃO', articleSlugs: sortedArticles.filter((a) => a.category === 'Tecnologia & Baterias').map((a) => a.slug), relevance: 'essencial' },
      ],
      radarTrendSummary: 'O mercado brasileiro de e-bikes em 2026 registra aceleração nos modelos urbanos de 350W com bateria removível e foco total em conformidade com as regras do CONTRAN.',
    },
  };
}

export default async function Home() {
  const headerList = await headers();
  const ua = headerList.get('user-agent') || '';
  const isMobileInitial = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua);
  const [initialBikes, initialArticles, initialRankings] = await Promise.all([
    getPublishedBikesServer(),
    getPublishedArticlesServer(),
    getPublishedRankingsServer(),
  ]);

  const finalBikes = Array.isArray(initialBikes) ? initialBikes : [];
  const finalArticles = Array.isArray(initialArticles) ? initialArticles : [];
  const finalRankings = Array.isArray(initialRankings) ? initialRankings : [];

  // Curadoria determinística local (zero latência, sem dependência de disco/IA)
  const initialCuration = generateDeterministicCuration(finalBikes, finalArticles);

  return (
    <div className="min-h-screen flex flex-col text-ink relative" id="app-root-container">
      {/* Conteúdo Principal com separação total Mobile e Desktop */}
      <main className="flex-grow relative z-10 w-full">
        <CatalogGrid 
          initialBikes={finalBikes} 
          initialArticles={finalArticles} 
          initialRankings={finalRankings}
          initialCuration={initialCuration}
        />
      </main>

      {/* Rodapé Padrão TuaVia com Alinhamento Perfeito */}
      <Footer />
    </div>
  );
}