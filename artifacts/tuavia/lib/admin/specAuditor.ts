import { EBikeSpecItem, EBikeSpecSection, SpecConfidence, SpecStatus } from '@/types/ebike';

/**
 * lib/admin/specAuditor.ts
 *
 * Auditoria determinística das especificações técnicas de uma ficha de e-bike.
 *
 * Veio de `lib/ai/deterministicAuditor.ts`, removido junto com o subsistema de
 * LLM. O corpo é o mesmo, sem uma linha alterada: o módulo nunca chamou modelo
 * nenhum, só aplicava regras sobre valores e fontes. A mudança é o caminho e
 * este cabeçalho.
 *
 * Regras:
 * 1. Confiança ALTA ou MEDIA exige fonte externa verificável.
 * 2. Rótulos genéricos ("manual do fabricante", "catálogo oficial"...) são higienizados.
 * 3. Placeholders ("pendente", "a definir", "n/a"...) viram 'Não informado pelo
 *    fabricante', com confiança NAO_CONFIRMADA e status NAO_INFORMADO.
 * 4. Fontes autoreferenciais (tuavia.com.br) e marcadores sintéticos
 *    ("[resultado 1]") são descartados.
 * 5. Produz score de integridade de 0 a 100 e o breakdown por confiança.
 *
 * A invariante da regra 1 é a que importa: sem ela toda ficha extraída de um
 * PDF real auditava com score 0, porque o alocador escreve rótulos genéricos
 * de fonte e o auditor — com razão — não conta rótulo genérico como fonte.
 */

const GENERIC_SOURCE_LABELS: readonly string[] = [
  'catálogo oficial',
  'manual do fabricante',
  'especificação comercial',
  'ficha técnica oficial',
  'ficha técnica',
  'especificação padrão',
  'dados de teste do fabricante',
  'catálogo de peças',
  'catálogo de componentes',
  'manual do usuário',
  'manual do sistema elétrico',
  'manual do carregador',
  'ficha técnica comercial',
  'ficha técnica do quadro',
  'catálogo / teste',
  'especificação oficial',
  'resolução contran 996/2023',
  'manual oficial',
  'catálogo do fabricante',
  'especificação de mercado',
  'manual / catálogo oficial',
  'dados do fabricante',
  'especificação geral',
  'site oficial',
  'dados comerciais',
  'legislação nacional',
  'auditoria tuavia',
];

const UNCONFIRMED_PATTERNS = [
  /^não\s*informad[oa]/i,
  /^nao\s*informad[oa]/i,
  /^não\s*especificad[oa]/i,
  /^nao\s*especificad[oa]/i,
  /^não\s*confirmad[oa]/i,
  /^nao\s*confirmad[oa]/i,
  /^não\s*declarad[oa]/i,
  /^nao\s*declarad[oa]/i,
  /^não\s*homologad[oa]/i,
  /^nao\s*homologad[oa]/i,
  /^não\s*aferid[oa]/i,
  /^nao\s*aferid[oa]/i,
  /^pendente/i,
  /^sem\s*confirma[cç][aã]o/i,
  /^a\s*definir/i,
  /^n\/?a$/i,
  /^não\s*consta/i,
  /^nao\s*consta/i,
  /^desconhecido/i,
  /^indispon[ií]vel/i,
  /^em\s*apura[cç][aã]o/i,
  /^\?+$/,
  /^-+$/,
];

export interface EBikeAuditCorrection {
  campo: string;
  de: string;
  para: string;
  motivo: string;
}

export interface EBikeAuditSummary {
  totalSpecs: number;
  confirmedCount: number;
  calculatedCount: number;
  commercialCount: number;
  unconfirmedCount: number;
  suspectCount: number;
  genericSourcesCleaned: number;
  confidenceDowngraded: number;
  integrityScore: number; // 0 a 100
  verificationBreakdown: {
    alta: number;
    media: number;
    baixa: number;
    nao_confirmada: number;
  };
  corrections: EBikeAuditCorrection[];
}

/**
 * Verifica se um valor é considerado 'não informado' ou marcador placeholder.
 */
export function isUnconfirmedValue(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  return UNCONFIRMED_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Verifica se uma fonte é puramente genérica (sem domínio ou URL real).
 */
function isGenericSource(source?: string | null): boolean {
  if (!source) return true;
  const s = String(source).trim().toLowerCase();
  if (!s) return true;
  return GENERIC_SOURCE_LABELS.some((label) => s === label || s.includes(label));
}

/**
 * Remove anotações artificiais como [resultado 1] ou domínios autoreferenciais
 */
function cleanSourceString(source?: string | null): string {
  if (!source) return '';
  let cleaned = String(source)
    .replace(/\[resultado\s*\d+\]/gi, '')
    .replace(/\[busca\s*\d+\]/gi, '')
    .trim();

  // Exclui fontes que apontem para o próprio site TuaVia
  if (/tuavia\.com\.br/i.test(cleaned)) {
    return '';
  }

  return cleaned;
}

/**
 * Audita individualmente um item de especificação técnica.
 */
function auditSpecItem(
  item: EBikeSpecItem,
  fallbackDomain?: string
): { item: EBikeSpecItem; changed: boolean; reason?: string } {
  if (!item || typeof item !== 'object') {
    return {
      item: {
        label: 'Item Desconhecido',
        value: 'Não informado pelo fabricante',
        confidence: 'NAO_CONFIRMADA',
        status: 'NAO_INFORMADO',
        source: '',
      },
      changed: true,
      reason: 'Item nulo ou inválido',
    };
  }

  const rawVal = (item.value || '').trim();
  let source = cleanSourceString(item.source);
  let confidence: SpecConfidence = item.confidence || 'NAO_CONFIRMADA';
  let status: SpecStatus = item.status || 'CONFIRMADO';
  let changed = false;
  let reason = '';

  // 1. Caso o valor seja vazio ou explicitamente não informado
  if (isUnconfirmedValue(rawVal)) {
    const isAlreadyFormatted = rawVal === 'Não informado pelo fabricante';
    const isAlreadyUnconfirmed = confidence === 'NAO_CONFIRMADA';
    // Só considera como alteração relevante para log se o valor anterior continha texto ou confiança alta
    if (!isAlreadyFormatted || !isAlreadyUnconfirmed || source !== '') {
      // Se era apenas uma formatação interna sem dados reais (ex: string vazia ou default), não marca como mudança barulhenta
      if (rawVal !== '' && !isAlreadyFormatted && confidence !== 'NAO_CONFIRMADA') {
        changed = true;
        reason = 'Valor não informado: redefinido para NAO_CONFIRMADA/NAO_INFORMADO';
      }
    }
    return {
      item: {
        ...item,
        value: 'Não informado pelo fabricante',
        confidence: 'NAO_CONFIRMADA',
        status: 'NAO_INFORMADO',
        source: '',
      },
      changed,
      reason: changed ? reason : undefined,
    };
  }

  // 2. Tratamento de fontes genéricas
  if (isGenericSource(source)) {
    if (fallbackDomain && !/tuavia\.com\.br/i.test(fallbackDomain)) {
      source = fallbackDomain;
      changed = true;
      reason = `Fonte genérica substituída pelo domínio oficial: ${fallbackDomain}`;
    } else {
      source = '';
      changed = true;
      reason = 'Fonte genérica removida por falta de domínio verificável';
    }
  } else if (!source && fallbackDomain && !/tuavia\.com\.br/i.test(fallbackDomain)) {
    source = fallbackDomain;
    changed = true;
    reason = `Domínio padrão atribuído: ${fallbackDomain}`;
  }

  // 3. INVARIANTE RIGOROSO: Confiança ALTA ou MEDIA exige fonte real externa
  if ((confidence === 'ALTA' || confidence === 'MEDIA') && !source) {
    confidence = 'NAO_CONFIRMADA';
    status = status === 'CONFIRMADO' ? 'NAO_CONFIRMADO' : status;
    changed = true;
    reason = 'Confiança rebaixada para NAO_CONFIRMADA por ausência de fonte externa verificável';
  }

  return {
    item: {
      ...item,
      value: rawVal,
      source,
      confidence,
      status,
    },
    changed,
    reason: changed ? reason : undefined,
  };
}

/**
 * Sanitiza uma lista de itens de especificação garantindo a conformidade determinística.
 */
function sanitizeSpecItems(items: EBikeSpecItem[], fallbackDomain?: string): EBikeSpecItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => auditSpecItem(it, fallbackDomain).item);
}

/**
 * Audita uma seção completa de especificações e atualiza o auditReport da seção.
 */
function auditSpecSection(section: EBikeSpecSection, fallbackDomain?: string): EBikeSpecSection {
  if (!section || !Array.isArray(section.items)) {
    return {
      title: section?.title || 'Seção',
      items: [],
      auditReport: {
        confirmados: 0,
        calculados: 0,
        comerciais: 0,
        conflitantes: 0,
        naoInformados: 0,
        suspeitos: 0,
        corrigidos: [],
      },
    };
  }

  const auditedItems: EBikeSpecItem[] = [];
  const corrigidos: { campo: string; de: string; para: string; motivo?: string }[] = [];

  let confirmados = 0;
  let calculados = 0;
  let comerciais = 0;
  let conflitantes = 0;
  let naoInformados = 0;
  let suspeitos = 0;

  for (const it of section.items) {
    const { item: audited, changed, reason } = auditSpecItem(it, fallbackDomain);
    auditedItems.push(audited);

    if (changed && (it.value !== audited.value || it.confidence !== audited.confidence)) {
      corrigidos.push({
        campo: it.label || 'Campo',
        de: `${it.value || 'Vazio'} (${it.confidence || 'sem nível'})`,
        para: `${audited.value} (${audited.confidence})`,
        motivo: reason,
      });
    }

    if (audited.status === 'CONFIRMADO') confirmados++;
    else if (audited.status === 'CALCULADO') calculados++;
    else if (audited.status === 'FONTE_COMERCIAL') comerciais++;
    else if (audited.status === 'CONFLITANTE') conflitantes++;
    else if (audited.status === 'SUSPEITO') suspeitos++;
    else naoInformados++;
  }

  return {
    ...section,
    items: auditedItems,
    auditReport: {
      confirmados,
      calculados,
      comerciais,
      conflitantes,
      naoInformados,
      suspeitos,
      corrigidos,
    },
  };
}

/**
 * Executa a auditoria determinística completa em todas as seções de uma E-Bike.
 * Retorna as seções auditadas e um sumário global com o índice de integridade técnica (0-100).
 */
export function auditEBikeSpecs(
  specSections: EBikeSpecSection[],
  fallbackDomain?: string
): {
  specSections: EBikeSpecSection[];
  auditSummary: EBikeAuditSummary;
} {
  const safeSections = Array.isArray(specSections) ? specSections : [];
  const auditedSections: EBikeSpecSection[] = [];
  const allCorrections: EBikeAuditCorrection[] = [];

  let totalSpecs = 0;
  let confirmedCount = 0;
  let calculatedCount = 0;
  let commercialCount = 0;
  let unconfirmedCount = 0;
  let suspectCount = 0;
  let genericSourcesCleaned = 0;
  let confidenceDowngraded = 0;

  const verificationBreakdown = {
    alta: 0,
    media: 0,
    baixa: 0,
    nao_confirmada: 0,
  };

  for (const sec of safeSections) {
    const auditedSec = auditSpecSection(sec, fallbackDomain);
    auditedSections.push(auditedSec);

    for (let i = 0; i < sec.items.length; i++) {
      const orig = sec.items[i];
      const aud = auditedSec.items[i];
      totalSpecs++;

      if (aud.confidence === 'ALTA') verificationBreakdown.alta++;
      else if (aud.confidence === 'MEDIA') verificationBreakdown.media++;
      else if (aud.confidence === 'BAIXA') verificationBreakdown.baixa++;
      else verificationBreakdown.nao_confirmada++;

      if (aud.status === 'CONFIRMADO') confirmedCount++;
      else if (aud.status === 'CALCULADO') calculatedCount++;
      else if (aud.status === 'FONTE_COMERCIAL') commercialCount++;
      else if (aud.status === 'SUSPEITO') suspectCount++;
      else unconfirmedCount++;

      // Rastreia correções
      if (orig) {
        if (isGenericSource(orig.source) && !isGenericSource(aud.source)) {
          genericSourcesCleaned++;
        }
        if ((orig.confidence === 'ALTA' || orig.confidence === 'MEDIA') && aud.confidence === 'NAO_CONFIRMADA') {
          confidenceDowngraded++;
        }
        if (orig.value !== aud.value || orig.confidence !== aud.confidence || orig.source !== aud.source) {
          allCorrections.push({
            campo: `${sec.title} > ${orig.label || 'Campo'}`,
            de: `${orig.value || ''} [${orig.confidence || 'SEM_CONF'}] (Fonte: ${orig.source || 'nenhuma'})`,
            para: `${aud.value} [${aud.confidence}] (Fonte: ${aud.source || 'nenhuma'})`,
            motivo: 'Auditoria determinística estrita',
          });
        }
      }
    }
  }

  // Cálculo de pontuação de integridade (0 a 100)
  // Baseado na densidade de dados confirmados/calculados vs não informados e penalidades por fontes genéricas
  let integrityScore = 0;
  if (totalSpecs > 0) {
    const validWeight = confirmedCount * 1.0 + calculatedCount * 0.8 + commercialCount * 0.6;
    const baseRatio = validWeight / totalSpecs;
    integrityScore = Math.min(100, Math.max(0, Math.round(baseRatio * 100)));
  }

  return {
    specSections: auditedSections,
    auditSummary: {
      totalSpecs,
      confirmedCount,
      calculatedCount,
      commercialCount,
      unconfirmedCount,
      suspectCount,
      genericSourcesCleaned,
      confidenceDowngraded,
      integrityScore,
      verificationBreakdown,
      corrections: allCorrections,
    },
  };
}
