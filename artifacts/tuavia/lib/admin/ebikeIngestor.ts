import {
  parseEBikeDeterministic,
  extractMarkdownTablesAndSpecs,
  decomposeBrandAndModel,
  type IngestedFilePayload,
} from '@/lib/admin/fileIngestion';
import { allocateAndNormalizeSpecSections, STANDARD_SPEC_BLUEPRINT } from '@/lib/specAllocations';
import { auditEBikeSpecs, type EBikeAuditSummary } from '@/lib/admin/specAuditor';
import type { EBikeSpecSection } from '@/types/ebike';

/**
 * lib/admin/ebikeIngestor.ts
 *
 * Ingestor determinístico de ficha de e-bike.
 *
 * Roda inteiro no navegador: lê o texto de um PDF/DOCX/XLSX/CSV/JSON/ZIP, joga
 * na alocação das 10 seções canônicas, audita o resultado e devolve a lista do
 * que o fabricante não informou. Sem `await`, sem rede, sem modelo.
 *
 * Veio de `lib/ingestion/pipeline.ts`, removido junto com o subsistema de LLM.
 * Deste arquivo saíram as etapas 1 a 5 do pipeline antigo; as etapas 6 e 7
 * (`fillGapsWithLlm`, `runIngestionPipeline`, `attachHints`, `mergeSections`) eram
 * a chamada de modelo e foram descartadas.
 *
 * A regra é uma só:
 *
 *     DETERMINÍSTICO OU DÁ PARA SABER O QUE FALTOU.
 *
 * Nada é inventado e nada é adivinhado. Campo que o documento não traz volta
 * como 'Não informado pelo fabricante', com status NAO_INFORMADO e confiança
 * NAO_CONFIRMADA, e aparece na lista de buracos para o editor preencher à mão.
 */

/** Rótulo único de campo sem dado verificável. */
export const UNCONFIRMED_LABEL = 'Não informado pelo fabricante';

const EMPTY_AUDIT_SUMMARY: EBikeAuditSummary = {
  totalSpecs: 0,
  confirmedCount: 0,
  calculatedCount: 0,
  commercialCount: 0,
  unconfirmedCount: 0,
  suspectCount: 0,
  genericSourcesCleaned: 0,
  confidenceDowngraded: 0,
  integrityScore: 0,
  verificationBreakdown: { alta: 0, media: 0, baixa: 0, nao_confirmada: 0 },
  corrections: [],
};

/**
 * Campo do template que ficou sem valor verificável.
 *
 * É a saída que o editor consome para saber o que preencher à mão.
 */
export interface SpecGap {
  /** Índice da seção canônica, 0 a 9. */
  sectionIndex: number;
  sectionTitle: string;
  label: string;
  /** Rótulos alternativos do mesmo campo, para deixar claro o que se procura. */
  synonyms: string[];
  /**
   * O que a ausência significa.
   *
   * `naoDeclarado`: o fabricante não diz isso.
   * `naoLido`:       o documento não foi lido inteiro, então não sabemos.
   */
  reason?: string;
  truncated?: boolean;
}

export interface IngestionResult {
  /** Marca, modelo, potência, autonomia, peso e tempo de carga. */
  identity: Record<string, unknown>;
  /** As 10 seções canônicas, sempre as 10, sempre na ordem oficial. */
  specSections: EBikeSpecSection[];
  audit: EBikeAuditSummary;
  /** Campos que o fabricante não informou. */
  gaps: SpecGap[];
  /** Texto bruto preservado, para o editor conferir de onde veio cada valor. */
  rawText: string;
  structuredYaml: string;
  /** Veredito, prós e contras — só se a ficha sustentar. */
  editorial: Record<string, unknown>;
  /** Ofertas e série de preços, quando o documento trouxer histórico. */
  priceHistoryData: {
    hasPriceHistory: boolean;
    historicoPrecos: any[];
    ofertas: any[];
  };
  /** Objeto único já mesclado, para quem não quiser montar o formulário à mão. */
  consolidated: Record<string, unknown>;
  stats: {
    /** Seções com ao menos um valor. */
    deterministicSections: number;
    deterministicItems: number;
    totalCanonicalItems: number;
    filledItems: number;
    gapCount: number;
    /** Score 0-100 do auditor. */
    integrityScore: number;
    /** O documento não foi lido inteiro: gaps não provam ausência. */
    truncated: boolean;
    durationMs: number;
  };
}

export interface IngestOptions {
  payload?: IngestedFilePayload;
  rawText?: string;
  fileName?: string;
  parsedData?: unknown;
  /**
   * O documento foi lido só em parte?
   *
   * Quando true, o ingestor NÃO pode afirmar 'Não informado pelo fabricante':
   * ele não leu o documento inteiro, então ausência ali é ausência da
   * leitura, não do fabricante. Os gaps saem com o motivo `naoLido` e a tela
   * mostra isso, em vez de apresentar um campo vazio como se fosse dado
   * confirmado por ausência.
   */
  truncated?: boolean;
}

/* ──────────────────────────── identidade ──────────────────────────── */

function buildIdentity(
  payload: IngestedFilePayload | undefined,
  rawText: string,
  fileName: string
): Record<string, unknown> {
  const deterministic = parseEBikeDeterministic(rawText, payload?.parsedYamlOrJson, fileName);
  const fromFile = decomposeBrandAndModel(fileName);

  return {
    marca: deterministic.identity?.marca || fromFile.marca || '',
    modelo: deterministic.identity?.modelo || fromFile.modelo || '',
    categoria: deterministic.identity?.categoria || '',
    potenciaW: deterministic.identity?.potenciaW,
    autonomiaKm: deterministic.identity?.autonomiaKm,
    pesoKg: deterministic.identity?.pesoKg,
    tempoCargaHoras: deterministic.identity?.tempoCargaHoras,
  };
}

/** Os escalares que o alocador sincroniza de volta para os campos da ficha. */
function scalarsFrom(identity: Record<string, unknown>) {
  return {
    potenciaW: identity.potenciaW as number | undefined,
    autonomiaKm: identity.autonomiaKm as number | undefined,
    pesoKg: identity.pesoKg as number | undefined,
    tempoCargaHoras: identity.tempoCargaHoras as number | undefined,
    usoPrincipal: identity.categoria as string | undefined,
    marca: identity.marca as string | undefined,
    modelo: identity.modelo as string | undefined,
  };
}

/* ──────────────────────────── fontes e veredito ──────────────────────────── */

/**
 * Atribui a referência do documento aos campos que têm valor.
 *
 * O alocador escreve rótulos genéricos de fonte ("Ficha Técnica Oficial"), e o
 * auditor — com razão — descarta a confiança de quem não tem fonte verificável.
 * Sem esta etapa, toda ficha extraída de um PDF real auditava com score 0.
 *
 * A referência é o nome do arquivo ingerido, rastreável no cache de extração.
 * Nada inventado: é o documento de onde o texto saiu.
 */
function stampDocumentSource(
  specSections: EBikeSpecSection[],
  documentRef: string
): EBikeSpecSection[] {
  if (!documentRef) return specSections;

  return specSections.map((section) => ({
    ...section,
    items: (section.items ?? []).map((item) => {
      const filled = item.value && item.value !== UNCONFIRMED_LABEL;
      if (!filled) return item;
      return {
        ...item,
        source: documentRef,
        sourceUrl: item.sourceUrl || documentRef,
      };
    }),
  }));
}

/**
 * Repassa para o veredito apenas o que a ficha realmente comprova.
 *
 * O scanner gera o texto do veredito a partir de valores que podem ter caído
 * para "não informado" na alocação. Um veredito que afirma "autonomia de 80 km"
 * quando a ficha está sem esse campo é pior do que nenhum veredito. Se nenhum
 * campo de identidade sobreviveu, o veredito sai vazio em vez de afirmar o que
 * não foi confirmado.
 */
function stampEditorialSources(
  editorial: Record<string, unknown>,
  specSections: EBikeSpecSection[],
  fileName: string
): Record<string, unknown> {
  if (!editorial || Object.keys(editorial).length === 0) return {};

  /**
   * Compara rótulo ignorando acento e a unidade entre parênteses.
   *
   * A busca anterior usava os literais 'Potência Nominal (W)' e 'Autonomia (km)',
   * que não são rótulos do template: na seção 1 eles são 'Potência Nominal' e
   * 'Autonomia Estimada'. Nenhum item casava, `identityConfirmed` ficava
   * sempre falso e o veredito editorial era apagado em toda ficha — inclusive
   * nas bem preenchidas.
   */
  const normalizeLabel = (label: string): string =>
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z]/g, '');

  const hasValue = (aliases: string[]): boolean => {
    const wanted = aliases.map(normalizeLabel);
    return specSections.some((section) =>
      (section.items ?? []).some((item) => {
        const value = (item.value ?? '').trim();
        return wanted.includes(normalizeLabel(item.label ?? '')) && value && value !== UNCONFIRMED_LABEL;
      })
    );
  };

  const identityConfirmed =
    hasValue(['Potência Nominal', 'Potencia Nominal']) ||
    hasValue(['Autonomia Estimada', 'Autonomia', 'Alcance']);

  if (!identityConfirmed) {
    // Prós e contras entram na limpeza pelo mesmo motivo do resumo: são frases
    // montadas a partir dos valores extraídos, então carregam a mesma
    // asserção. Deixá-los passava um "Peso total de 225kg exige maior
    // esforço" num documento em que a identidade nem foi confirmada — e o
    // número errado vinha justamente do parser, não do documento.
    return {
      ...editorial,
      resumoExecutivo: '',
      verdict: '',
      idealFor: '',
      pros: [],
      cons: [],
      badge: '',
      tagOferta: '',
    };
  }

  return { ...editorial, fonteDocumento: fileName };
}

/* ──────────────────────────── buracos ──────────────────────────── */

/** Mesmo teste do auditor, aplicado aqui para listar o que falta. */
function isPlaceholderValue(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  if (trimmed === UNCONFIRMED_LABEL) return true;
  if (/^n\/?a$/i.test(trimmed)) return true;
  return trimmed === '-' || trimmed === '?';
}

/**
 * Lista os campos que continuam sem valor verificável depois da alocação.
 *
 * Só conta buraco o campo que **existe no template** e veio vazio. Item extra
 * que o documento trouxe é bônus, não obrigação — e item que veio com valor
 * nunca vira buraco, por mais que o documento seja magro.
 */
export function findSpecGaps(specSections: EBikeSpecSection[], truncated = false): SpecGap[] {
  const gaps: SpecGap[] = [];

  specSections.forEach((section, sectionIndex) => {
    const template = STANDARD_SPEC_BLUEPRINT[sectionIndex];
    const items = section.items ?? [];

    items.forEach((item, itemIndex) => {
      if (!isPlaceholderValue(item.value)) return;
      if (!template?.items?.[itemIndex]) return;

      gaps.push({
        sectionIndex,
        sectionTitle: section.title,
        label: item.label,
        synonyms: template.items[itemIndex]?.synonyms ?? [],
        // Documento cortado não autoriza dizer que o fabricante não falou.
        reason: truncated ? 'não lido — o documento excedeu o limite de extração' : item.notes || undefined,
        truncated,
      });
    });
  });

  return gaps;
}

/* ──────────────────────────── pipeline ──────────────────────────── */

/**
 * Varredura determinística pura: sem `await`, sem rede, sem estado.
 *
 * É o piso garantido do sistema. Se o documento vier com 3 campos em vez de 60,
 * a ficha volta com esses 3 e a lista do resto — que é informação útil, não
 * falha. A única forma de errar aqui é o texto de entrada estar vazio.
 */
export function runDeterministicExtraction(options: IngestOptions): IngestionResult {
  const startedAt = Date.now();

  const rawText = options.rawText ?? options.payload?.rawText ?? '';
  const fileName = options.fileName ?? options.payload?.fileName ?? 'documento.txt';
  const parsedData = options.parsedData ?? options.payload?.parsedYamlOrJson;
  const truncated = Boolean(options.truncated ?? options.payload?.extractionWarnings?.length);

  if (!rawText.trim()) {
    return {
      identity: {},
      specSections: allocateAndNormalizeSpecSections(undefined, [], {}),
      audit: EMPTY_AUDIT_SUMMARY,
      gaps: [],
      rawText: '',
      structuredYaml: '',
      editorial: {},
      priceHistoryData: { hasPriceHistory: false, historicoPrecos: [], ofertas: [] },
      consolidated: {},
      stats: {
        deterministicSections: 0,
        deterministicItems: 0,
        totalCanonicalItems: 0,
        filledItems: 0,
        gapCount: 0,
        integrityScore: 0,
        truncated: false,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // Tabelas markdown viram pares rótulo/valor, formato que o alocador normaliza.
  const flatSpecs = extractMarkdownTablesAndSpecs(rawText);
  const deterministic = parseEBikeDeterministic(rawText, parsedData, fileName);
  const identity = buildIdentity(options.payload, rawText, fileName);

  const incomingSections = [
    Object.entries(flatSpecs).map(([label, value]) => ({ label, value: String(value) })),
    ...(deterministic.specSections ?? []),
  ];

  const stampedSections = stampDocumentSource(
    allocateAndNormalizeSpecSections(undefined, incomingSections, scalarsFrom(identity)),
    fileName
  );

  /**
   * O que segue para o formulário são as seções AUDITADAS, não as carimbadas.
   *
   * É o auditor que padroniza qualquer texto de placeholder para
   * 'Não informado pelo fabricante' e zera a fonte genérica que o alocador
   * deixou atrás. Devolver as seções de antes da auditoria entregaria ao editor
   * um campo vazio fingindo ter 'Ficha Técnica Oficial' como fonte.
   */
  const { specSections, auditSummary } = auditEBikeSpecs(stampedSections);
  const audit = auditSummary;
  const gaps = findSpecGaps(specSections, truncated);

  const totalItems = specSections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0);
  const editorial = stampEditorialSources(deterministic.editorial ?? {}, specSections, fileName);
  const priceHistoryData = deterministic.priceHistoryData ?? {
    hasPriceHistory: false,
    historicoPrecos: [],
    ofertas: [],
  };

  return {
    identity,
    specSections,
    audit,
    gaps,
    rawText,
    structuredYaml: deterministic.structuredYaml ?? '',
    editorial,
    priceHistoryData,
    consolidated: deterministic.consolidated ?? {},
    stats: {
      deterministicSections: specSections.filter(
        (section) => (section.items ?? []).some((item) => !isPlaceholderValue(item.value))
      ).length,
      deterministicItems: (deterministic.specSections ?? []).reduce(
        (sum, section) => sum + (section?.items?.length ?? 0),
        0
      ),
      totalCanonicalItems: totalItems,
      filledItems: totalItems - gaps.length,
      gapCount: gaps.length,
      integrityScore: audit.integrityScore,
      truncated,
      durationMs: Date.now() - startedAt,
    },
  };
}

/** Agrupa os buracos por seção, para a tela mostrar "3 pendências" por bloco. */
function groupGapsBySection(gaps: SpecGap[]): Array<{
  sectionIndex: number;
  sectionTitle: string;
  fields: SpecGap[];
}> {
  const groups = new Map<number, { sectionIndex: number; sectionTitle: string; fields: SpecGap[] }>();

  for (const gap of gaps) {
    const existing = groups.get(gap.sectionIndex);
    if (existing) {
      existing.fields.push(gap);
    } else {
      groups.set(gap.sectionIndex, {
        sectionIndex: gap.sectionIndex,
        sectionTitle: gap.sectionTitle,
        fields: [gap],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);
}
