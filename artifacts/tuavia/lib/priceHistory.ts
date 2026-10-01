import { EBikePriceHistoryPoint } from '@/types/ebike';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Retorna os nomes abreviados dos últimos N meses com base na data atual
 * Exemplo: ['Out/25', 'Nov/25', 'Dez/25', 'Jan/26', 'Fev/26', 'Mar/26']
 */
export function getLastNMonths(count: number = 6): string[] {
  const result: string[] = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = MONTH_NAMES[d.getMonth()];
    const yearShort = String(d.getFullYear()).slice(-2);
    result.push(`${monthName}/${yearShort}`);
  }

  return result;
}

/**
 * Converte um texto de mês/ano (ex: "Out/25", "Janeiro/2026", "2025-10") em timestamp numérico para ordenação cronológica
 */
export function parseMonthToOrderKey(monthStr?: string): number {
  if (!monthStr || typeof monthStr !== 'string') return 0;
  const clean = monthStr.trim().toLowerCase();

  // Caso ISO YYYY-MM ou YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    return year * 100 + month;
  }

  // Caso "Mês/YY" ou "Mês/YYYY"
  const parts = clean.split(/[-/.\s]+/);
  if (parts.length >= 2) {
    const monthPart = parts[0];
    const yearPart = parts[1];
    
    let monthIdx = MONTH_NAMES.findIndex(m => monthPart.startsWith(m.toLowerCase()));
    if (monthIdx === -1) {
      const fullMonths = ['janeiro', 'fevereiro', 'marco', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      monthIdx = fullMonths.findIndex(m => monthPart.startsWith(m.slice(0, 3)));
    }
    if (monthIdx === -1) monthIdx = 0;

    let yearNum = parseInt(yearPart, 10);
    if (yearNum < 100) yearNum += 2000;
    if (isNaN(yearNum)) yearNum = 2026;

    return yearNum * 100 + (monthIdx + 1);
  }

  return 0;
}

/**
 * Ordena os pontos de histórico de preços em ordem cronológica (do mais antigo para o mais recente)
 */
export function sortPriceHistoryChronologically(points: EBikePriceHistoryPoint[]): EBikePriceHistoryPoint[] {
  if (!Array.isArray(points) || points.length <= 1) return points || [];
  return [...points].sort((a, b) => {
    const keyA = parseMonthToOrderKey(a.month || a.date);
    const keyB = parseMonthToOrderKey(b.month || b.date);
    return keyA - keyB;
  });
}

/**
 * Verifica se a lista de histórico possui registros suficientes e verificados.
 * Padrão TuaVia: Pelo menos 3 pontos reais com fonte/cotação comprovada para determinar tendência ampla.
 */
export function hasEnoughVerifiedHistory(
  points?: EBikePriceHistoryPoint[] | null,
  minCount: number = 3
): boolean {
  if (!points || !Array.isArray(points) || points.length < minCount) {
    return false;
  }

  const verifiedPoints = points.filter((p) => {
    const validPrice = typeof p.price === 'number' && !isNaN(p.price) && p.price > 0;
    const isExplicitlyVerified = p.verified === true;
    const hasTrustedSource = Boolean(p.source) && p.source !== 'simulado' && p.source !== 'estimado';
    return validPrice && (isExplicitlyVerified || hasTrustedSource);
  });

  return verifiedPoints.length >= minCount;
}

/**
 * Retorna o número de pontos devidamente auditados/verificados em um histórico.
 */
export function getVerifiedPriceCount(points?: EBikePriceHistoryPoint[] | null): number {
  if (!points || !Array.isArray(points)) return 0;
  return points.filter((p) => {
    const validPrice = typeof p.price === 'number' && !isNaN(p.price) && p.price > 0;
    return validPrice && (p.verified === true || (Boolean(p.source) && p.source !== 'simulado'));
  }).length;
}

/**
 * Gera um rascunho de simulação de preços EXCLUSIVAMENTE para testes internos do admin.
 * Todos os pontos gerados são marcados explicitamente com verified: false e source: 'simulado'
 * para impedir publicação como histórico real comprovado.
 */
export function generateRealisticPriceHistory(currentPrice: number): EBikePriceHistoryPoint[] {
  const safePrice = Math.max(Number(currentPrice) || 3500, 100);
  const normalizedPrice = Math.round(safePrice * 100) / 100;
  const months = getLastNMonths(6);

  const fluctuationMultipliers = [1.09, 1.07, 1.05, 1.03, 1.01, 1.0];

  return months.map((month, idx) => {
    const multiplier = fluctuationMultipliers[idx] ?? 1.0;
    const rawPrice = Math.round(normalizedPrice * multiplier * 100) / 100;
    return {
      month,
      price: idx === months.length - 1 ? normalizedPrice : rawPrice,
      lowestPrice: normalizedPrice,
      verified: false,
      source: 'simulado',
      condition: 'Rascunho de simulação interna',
    };
  });
}

/**
 * Sanitiza e valida o histórico retornado por uma LLM ou banco de dados.
 * Diretriz TuaVia: Preserva APENAS registros que contenham preços válidos e fontes verificadas.
 * Aceita qualquer quantidade de meses reais encontrados (1, 2, 3, 4, 5, 6 ou mais)
 * e organiza cronologicamente do mês mais antigo até o mês atual.
 */
export function sanitizePriceHistory(
  rawPoints: any[],
  basePrice?: number
): EBikePriceHistoryPoint[] {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    return [];
  }

  const sanitized: EBikePriceHistoryPoint[] = [];
  const seenMonths = new Set<string>();

  for (const candidate of rawPoints) {
    if (!candidate || typeof candidate !== 'object') continue;

    const monthStr = (candidate.month || candidate.mes || candidate.date || '').trim();
    const rawVal = candidate.price ?? candidate.preco ?? candidate.valor;
    let priceNum = 0;

    if (typeof rawVal === 'number') {
      priceNum = rawVal;
    } else if (typeof rawVal === 'string') {
      priceNum = parseFloat(rawVal.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    }

    if (priceNum > 0 && !isNaN(priceNum)) {
      const sourceStr = String(candidate.source || candidate.fonte || candidate.store || candidate.loja || '').trim();
      const isSimulated = sourceStr.toLowerCase().includes('simula') || candidate.verified === false;
      const normalizedMonth = monthStr || 'Atual';

      // Evita duplicatas do mesmo mês se vier repetido
      if (!seenMonths.has(normalizedMonth.toLowerCase())) {
        seenMonths.add(normalizedMonth.toLowerCase());
        sanitized.push({
          month: normalizedMonth,
          price: Math.round(priceNum * 100) / 100,
          store: candidate.store || candidate.loja || undefined,
          lowestPrice: candidate.lowestPrice ? Math.round(Number(candidate.lowestPrice) * 100) / 100 : undefined,
          source: sourceStr || undefined,
          url: candidate.url || candidate.link || undefined,
          date: candidate.date || candidate.data_coleta || candidate.data || undefined,
          verified: !isSimulated && Boolean(sourceStr || candidate.verified === true),
          condition: candidate.condition || candidate.condicao || undefined,
        });
      }
    }
  }

  return sortPriceHistoryChronologically(sanitized);
}
