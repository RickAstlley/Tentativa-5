import { EBikeReview, RealRangeCommunityStats } from '@/types/ebike';

/**
 * Calcula estatísticas consolidadas de autonomia real vs anunciada
 */
export function calculateRealRangeStats(
  reviews: EBikeReview[],
  advertisedKm: number = 40
): RealRangeCommunityStats {
  const safeAdvertised = Math.max(advertisedKm || 40, 15);
  const validRealRanges = reviews
    .map((r) => Number(r.realRangeKm))
    .filter((k) => !isNaN(k) && k > 5 && k < 300);

  if (validRealRanges.length === 0) {
    // Estimativa teórica baseada em 76% da autonomia anunciada em condições reais brasileiras
    const defaultAvg = Math.round(safeAdvertised * 0.76);
    return {
      advertisedKm: safeAdvertised,
      averageRealKm: defaultAvg,
      minReportedKm: Math.round(safeAdvertised * 0.62),
      maxReportedKm: Math.round(safeAdvertised * 0.90),
      accuracyPercent: 76,
      sampleCount: 0,
      terrainBreakdown: {
        plano: Math.round(safeAdvertised * 0.88),
        misto: Math.round(safeAdvertised * 0.74),
        íngreme: Math.round(safeAdvertised * 0.60),
      },
    };
  }

  const sum = validRealRanges.reduce((acc, v) => acc + v, 0);
  const averageRealKm = Math.round(sum / validRealRanges.length);
  const minReportedKm = Math.min(...validRealRanges);
  const maxReportedKm = Math.max(...validRealRanges);
  const accuracyPercent = Math.min(100, Math.round((averageRealKm / safeAdvertised) * 100));

  // Estimativas por relevo
  const planoReviews = reviews.filter((r) => r.terrain === 'plano' && r.realRangeKm);
  const mistoReviews = reviews.filter((r) => r.terrain === 'misto' && r.realRangeKm);
  const ingremeReviews = reviews.filter((r) => r.terrain === 'íngreme' && r.realRangeKm);

  const avgPlano = planoReviews.length > 0
    ? Math.round(planoReviews.reduce((acc, r) => acc + (r.realRangeKm || 0), 0) / planoReviews.length)
    : Math.round(averageRealKm * 1.15);

  const avgMisto = mistoReviews.length > 0
    ? Math.round(mistoReviews.reduce((acc, r) => acc + (r.realRangeKm || 0), 0) / mistoReviews.length)
    : averageRealKm;

  const avgIngreme = ingremeReviews.length > 0
    ? Math.round(ingremeReviews.reduce((acc, r) => acc + (r.realRangeKm || 0), 0) / ingremeReviews.length)
    : Math.round(averageRealKm * 0.82);

  return {
    advertisedKm: safeAdvertised,
    averageRealKm,
    minReportedKm,
    maxReportedKm,
    accuracyPercent,
    sampleCount: validRealRanges.length,
    terrainBreakdown: {
      plano: avgPlano,
      misto: avgMisto,
      íngreme: avgIngreme,
    },
  };
}

/**
 * Retorna relatos da comunidade (apenas relatos reais submetidos por usuários).
 * Não gera nenhum comentário sintético ou por LLM.
 */
export function generateRealisticCommunityReviews(bike: {
  slug: string;
  modelo: string;
  marca: string;
  autonomiaKm?: number;
  potenciaW?: number;
  usoPrincipal?: string;
}): EBikeReview[] {
  return [];
}
