/**
 * lib/ingestion/pipeline.ts
 *
 * PIPELINE ÚNICO DE INGESTÃO.
 *
 * Substitui quatro motores que faziam o mesmo trabalho de formas diferentes —
 * o scanner determinístico do dropzone, o `semantic_pipeline` (10 chamadas de
 * LLM em paralelo), o `llm_extract_tags` e o `allocate_tagged_specs`. O sintoma
 * era o mesmo nos quatro: a extração não preenchia direito e a distribuição nas
 * especificações ficava errada.
 *
 * A regra nova é uma só:
 *
 *     DETERMINÍSTICO PRIMEIRO. O LLM SÓ ENTRA PARA FECHAR BURACO.
 *
 * Fluxo:
 *   1. Extrai o texto do arquivo (já existe em `lib/admin/fileIngestion`).
 *   2. Varre o texto de forma determinística — tabelas, bullets, marca/modelo.
 *   3. Aloca TUDO nas 10 seções canônicas pelo alocador único.
 *   4. Audita (integridade, fonte genérica, confiança sem fonte).
 *   5. Lista os campos que sobraram sem fonte.
 *   6. Se a política permitir, faz **uma** chamada de IA com esses campos.
 *   7. Realoca pelo mesmo alocador e reaudita.
 *
 * O passo 6 é o único que consome token, e só existe quando há buraco.
 */

import { z } from 'zod';
import {
  parseEBikeDeterministic,
  extractMarkdownTablesAndSpecs,
  decomposeBrandAndModel,
  type IngestedFilePayload,
} from '@/lib/admin/fileIngestion';
import {
  allocateAndNormalizeSpecSections,
  allocateFromTaggedSpecs,
  STANDARD_SPEC_BLUEPRINT,
  type TaggedSpecItemLike,
} from '@/lib/specAllocations';
import { auditEBikeSpecs, type EBikeAuditSummary } from '@/lib/ai/deterministicAuditor';
import { AIRouter } from '@/lib/ai/router';
import { redactPII } from '@/lib/ai/piiRedaction';
import { YAMLParser } from '@/lib/ai/validation/parser';
import type { EBikeSpecSection } from '@/types/ebike';

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

/** Política de uso de IA. `never` deixa o admin fazer 100% do trabalho. */
export type LlmPolicy = 'never' | 'gaps-only' | 'always';

export interface IngestionPolicy {
  /**
   * Quantos campos sem fonte justificam uma chamada de IA.
   * Abaixo disso, não compensa o custo: o editor preenche na mão.
   */
  minGapsForLlm: number;
  /** Teto de campos por chamada, para o prompt não estourar. */
  maxFieldsPerCall: number;
  /** Política geral. */
  llm: LlmPolicy;
}

export const DEFAULT_POLICY: IngestionPolicy = {
  // 6 é o ponto em que a ficha já está inutilizável sem ajuda. Abaixo disso
  // uma chamada custa mais do que entrega.
  minGapsForLlm: 6,
  maxFieldsPerCall: 25,
  llm: 'gaps-only',
};

/**
 * Teto de relógio da chamada de IA dentro do pipeline.
 *
 * O job roda em `maxDuration = 300` (`app/api/admin/llm/jobs/route.ts`) e o
 * worker externo pode ter orçamento menor. Com 60s por modelo e fallback
 * sequencial, uma ficha com a IA travada consumia a janela inteira e o job
 * morria sem devolver nada. 25s por modelo mantém a folga para as duas
 * tentativas e para a escrita do resultado.
 */
export const LLM_STEP_TIMEOUT_MS = 25_000;

export interface SpecGap {
  sectionIndex: number;
  sectionTitle: string;
  label: string;
  synonyms: string[];
  /** Trecho do documento que mais se aproxima deste campo, se houver. */
  hint?: string;
}

export interface IngestionResult {
  identity: Record<string, unknown>;
  specSections: EBikeSpecSection[];
  audit: EBikeAuditSummary;
  /** Campos que ficaram sem valor verificável. */
  gaps: SpecGap[];
  /** Texto bruto preservado para a etapa de buraco. */
  rawText: string;
  structuredYaml: string;
  /**
   * Veredito editorial, prós e contras.
   *
   * O scanner determinístico já constrói esse objeto inteiro
   * (`parseEBikeDeterministic`). Ele era montado e jogado fora: o pipeline só
   * repassava `specSections` e `structuredYaml`, então o formulário recebia
   * `resumoExecutivo` vazio, `pros`/`cons` vazios e um badge fixo.
   */
  editorial: Record<string, unknown>;
  /** Ofertas e série de preços, quando o documento traz histórico. */
  priceHistoryData: {
    hasPriceHistory: boolean;
    historicoPrecos: any[];
    ofertas: any[];
  };
  /** Objeto único já mesclado, para quem não quer montar o formulário à mão. */
  consolidated: Record<string, unknown>;
  /** Estatísticas reais, para o admin mostrar sem inventar número. */
  stats: {
    deterministicSections: number;
    deterministicItems: number;
    totalCanonicalItems: number;
    filledItems: number;
    gapCount: number;
    llmUsed: boolean;
    llmFieldsFilled: number;
    /** Por que a IA não rodou ou não conseguiu rodar. Vazio se rodou bem. */
    llmError: string | null;
    durationMs: number;
  };
}

/* ──────────────────────────── etapas 1-2 ──────────────────────────── */

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

/* ──────────────────────────── etapa 5 ──────────────────────────── */

/**
 * Lista os campos que continuam sem valor verificável depois da alocação.
 *
 * Um campo só conta como preenchido se tiver valor que não seja o placeholder.
 * É a mesma invariante do auditor, aplicada aqui para decidir se vale a pena
 * chamar a IA.
 */
export function findSpecGaps(specSections: EBikeSpecSection[]): SpecGap[] {
  const gaps: SpecGap[] = [];

  specSections.forEach((section, sectionIndex) => {
    const template = STANDARD_SPEC_BLUEPRINT[sectionIndex];
    const items = section.items ?? [];

    items.forEach((item, itemIndex) => {
      const value = (item.value ?? '').trim();
      const isPlaceholder =
        !value ||
        value === UNCONFIRMED_LABEL ||
        /^n\/?a$/i.test(value) ||
        value === '-' ||
        value === '?';

      // Se o item existe no template mas veio vazio, é buraco. Itens extras
      // que a IA trouxe não contam — são bônus, não obrigação.
      if (!isPlaceholder) return;
      if (!template?.items?.[itemIndex]) return;

      gaps.push({
        sectionIndex,
        sectionTitle: section.title,
        label: item.label,
        synonyms: template.items[itemIndex]?.synonyms ?? [],
      });
    });
  });

  return gaps;
}

/** Anexa a cada buraco o trecho de texto mais próximo, para ancorar a IA. */
function attachHints(gaps: SpecGap[], rawText: string): SpecGap[] {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 3)
    .slice(0, 2000);

  return gaps.map((gap) => {
    const needles = [gap.label.toLowerCase(), ...gap.synonyms.map((s) => s.toLowerCase())].filter(
      (needle) => needle.length > 3
    );
    const hit = lines.find((line) => {
      const lower = line.toLowerCase();
      return needles.some((needle) => lower.includes(needle));
    });
    return hit ? { ...gap, hint: hit.slice(0, 300) } : gap;
  });
}

/* ──────────────────────────── etapa 6 ──────────────────────────── */

const GAP_FILL_SCHEMA = z.object({
  specs: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        evidence: z.string().optional(),
      })
    )
    .default([]),
});

const GAP_FILL_SYSTEM_PROMPT = `Você preenche campos de ficha técnica de bicicleta elétrica a partir de um documento do fabricante.

REGRAS INVIOLÁVEIS:
- Só responda com valores que estejam LITERALMENTE no documento fornecido.
- Nunca calcule, estime ou complete por conhecimento próprio.
- Se o documento não traz o valor, devolva o campo com value "".
- evidence deve ser o trecho exato do documento de onde saiu o valor.
- Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem comentários, sem texto extra.
- Formato EXATO: {"specs":[{"label":"string","value":"string","evidence":"string"}]}

EXEMPLO:
{"specs":[{"label":"Potência Nominal (W)","value":"350","evidence":"Motor: Cubo Traseiro 350W 36V"},{"label":"Autonomia (km)","value":"55","evidence":"Autonomia: Até 55 km no modo Eco"}]}`;

/**
 * UMA chamada de IA, só com os buracos.
 *
 * Nunca lança. Se o provedor falhar, estourar o tempo ou devolver lixo, o
 * chamador recebe `{ tagged: [], filled: 0, error }` e segue com o que a
 * varredura determinística já entregou. Uma falha de IA não pode invalidar
 * uma extração que já deu certo — era exatamente isso que descartava a ficha
 * inteira quando a Hostinger cortava a requisição.
 */
async function fillGapsWithLlm(
  gaps: SpecGap[],
  rawText: string,
  policy: IngestionPolicy
): Promise<{ tagged: TaggedSpecItemLike[]; filled: number; error?: string }> {
  const batch = gaps.slice(0, policy.maxFieldsPerCall);
  if (batch.length === 0) return { tagged: [], filled: 0 };

  try {
    const fieldList = batch
      .map((gap) => `- "${gap.label}" (sinônimos: ${gap.synonyms.slice(0, 4).join(', ') || '—'})`)
      .join('\n');

    const context = batch
      .filter((gap) => gap.hint)
      .map((gap) => `[${gap.label}] … ${gap.hint}`)
      .join('\n');

    const prompt = [
      'DOCUMENTO (trechos relevantes):',
      context || '(nenhum trecho relevante identificado)',
      '',
      'CAMPOS QUE PRECISO PREENCHER:',
      fieldList,
      '',
      rawText
        ? `DOCUMENTO COMPLETO (referência, pode estar truncado):\n${rawText.slice(0, 12000)}`
        : '',
    ].join('\n');

    // Redige dados pessoais antes de qualquer chamada de IA.
    //
    // O módulo existia com 11 detectores (CPF, CNPJ, RG, CNH, PIX, placa...) e
    // não era importado por nada: um documento do fabricante com dados de
    // fornecedor ia inteiro para o provedor.
    //
    // A redação acontece AQUI, e não antes de toda a ingestão: `sanitizeLLMPrompt`
    // converte `;` em `&#59;` e apaga tags HTML, o que quebrava os
    // delimitadores de CSV/tabela antes da varredura determinística rodar.
    const safePrompt = redactPII(prompt).redacted;

    const dispatch = await AIRouter.dispatch({
      task: 'bicycle_extraction',
      rawPrompt: safePrompt,
      systemPrompt: GAP_FILL_SYSTEM_PROMPT,
      temperature: 0.05,
      maxTokens: 3000,
      priority: 'normal',
      timeoutMs: LLM_STEP_TIMEOUT_MS,
    });

    if (!dispatch.success) {
      return { tagged: [], filled: 0, error: dispatch.error || 'provedor recusou a chamada' };
    }

    const parsed = YAMLParser.parseWithSchema<z.infer<typeof GAP_FILL_SCHEMA>>(
      dispatch.text,
      GAP_FILL_SCHEMA
    );
    if (!parsed.success) {
      return { tagged: [], filled: 0, error: parsed.errors.join('; ') };
    }

    const byLabel = new Map(batch.map((gap) => [gap.label.toLowerCase(), gap] as const));

    const tagged: TaggedSpecItemLike[] = [];
    for (const entry of parsed.data.specs ?? []) {
      const value = (entry.value ?? '').trim();
      if (!value) continue;

      const gap =
        byLabel.get(entry.label.toLowerCase()) ??
        batch.find((candidate) =>
          candidate.synonyms.some(
            (synonym) => synonym.toLowerCase() === entry.label.toLowerCase()
          )
        );
      if (!gap) continue;

      tagged.push({
        blocoIndex: gap.sectionIndex,
        blocoNome: gap.sectionTitle,
        campo: gap.label,
        valor: value,
        // A evidência vira a fonte. Sem evidência, o auditor rebaixa a confiança.
        source: entry.evidence ?? '',
        evidence: entry.evidence,
        // A IA não se autodeclara confiável: a confiança sobe só com evidência.
        confidence: entry.evidence ? 'MEDIA' : 'NAO_CONFIRMADA',
        status: entry.evidence ? 'CONFIRMADO' : 'NAO_INFORMADO',
      });
    }

    return { tagged, filled: tagged.length };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn('[ingestion] Etapa de IA falhou; mantida a extração determinística:', reason);
    return { tagged: [], filled: 0, error: reason };
  }
}

/**
 * Atribui a referência do documento aos campos que têm valor.
 *
 * O alocador escreve rótulos genéricos de fonte ("Ficha Técnica Oficial"), e o
 * auditor — com razão — descarta a confiança de quem não tem fonte verificável
 * (invariante em `auditSpecItem`). Sem esta etapa, toda ficha extraída de um
 * PDF real auditava com score 0 por não ter de onde veio.
 *
 * A referência é o nome do arquivo ingerido, que é rastreável no cache de
 * extração. Nada inventado: é o documento de onde o texto saiu.
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

/* ──────────────────────────── pipeline ──────────────────────────── */

export interface IngestOptions {
  payload?: IngestedFilePayload;
  rawText?: string;
  fileName?: string;
  parsedData?: unknown;
  policy?: Partial<IngestionPolicy>;
}

/**
 * VARREDURA DETERMINÍSTICA PURA. Sem IA, sem `await`, sem rede.
 *
 * É o piso garantido do sistema: o que ela extrai existe mesmo que o provedor
 * esteja fora, a fila esteja travada ou a requisição morra no meio. A etapa de
 * IA só *acrescenta* sobre este resultado.
 */
export function runDeterministicExtraction(options: IngestOptions): IngestionResult {
  const startedAt = Date.now();

  const rawText = options.rawText ?? options.payload?.rawText ?? '';
  const fileName = options.fileName ?? options.payload?.fileName ?? 'documento.txt';
  const parsedData = options.parsedData ?? options.payload?.parsedYamlOrJson;

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
        llmUsed: false,
        llmFieldsFilled: 0,
        llmError: null,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // 2. Varredura determinística. `extractMarkdownTablesAndSpecs` devolve um
  //    record plano `rótulo -> valor`, formato que o alocador já normaliza.
  const flatSpecs = extractMarkdownTablesAndSpecs(rawText);
  const deterministic = parseEBikeDeterministic(rawText, parsedData, fileName);
  const identity = buildIdentity(options.payload, rawText, fileName);

  // 3. Alocação única nas 10 seções canônicas.
  const incomingSections = [
    Object.entries(flatSpecs).map(([label, value]) => ({ label, value: String(value) })),
    ...(deterministic.specSections ?? []),
  ];

  const specSections = stampDocumentSource(
    allocateAndNormalizeSpecSections(undefined, incomingSections, scalarsFrom(identity)),
    fileName
  );

  // 4. Auditoria.
  const audit = auditEBikeSpecs(specSections as never).auditSummary;
  const gaps = findSpecGaps(specSections);

  const totalItems = specSections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0);
  const editorial = deterministic.editorial ?? {};
  const priceHistoryData = deterministic.priceHistoryData ?? {
    hasPriceHistory: false,
    historicoPrecos: [],
    ofertas: [],
  };

  const result: IngestionResult = {
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
      deterministicSections: deterministic.specSections?.length ?? 0,
      deterministicItems: (deterministic.specSections ?? []).reduce(
        (sum, section) => sum + (section?.items?.length ?? 0),
        0
      ),
      totalCanonicalItems: totalItems,
      filledItems: totalItems - gaps.length,
      gapCount: gaps.length,
      llmUsed: false,
      llmFieldsFilled: 0,
      llmError: null,
      durationMs: Date.now() - startedAt,
    },
  };

  return { ...result, editorial: stampEditorialSources(editorial, specSections, fileName) };
}

/**
 * Repassa para o veredito apenas o que a ficha realmente comprova.
 *
 * O scanner gera o texto do veredito a partir de valores que podem ter caído
 * para "não informado" na alocação. Um veredito que afirma "autonomia de 80 km"
 * quando a ficha está sem esse campo é pior do que nenhum veredito — é
 * alucinação determinística. Se nenhum campo de identidade sobreviveu à
 * alocação, o veredito sai vazio em vez de affirmar o que não foi confirmado.
 */
function stampEditorialSources(
  editorial: Record<string, unknown>,
  specSections: EBikeSpecSection[],
  fileName: string
): Record<string, unknown> {
  if (!editorial || Object.keys(editorial).length === 0) return {};

  const hasValue = (label: string): boolean =>
    specSections.some((section) =>
      (section.items ?? []).some((item) => {
        const value = (item.value ?? '').trim();
        return (
          item.label?.toLowerCase() === label.toLowerCase() &&
          value &&
          value !== UNCONFIRMED_LABEL
        );
      })
    );

  const identityConfirmed = ['Potência Nominal (W)', 'Autonomia (km)'].some(hasValue);

  if (!identityConfirmed) {
    return {
      ...editorial,
      // Sem base verificável, o veredito não se sustenta.
      resumoExecutivo: '',
      verdict: '',
      idealFor: '',
    };
  }

  return { ...editorial, fonteDocumento: fileName };
}

/**
 * PIPELINE COMPLETO: determinístico primeiro, IA só para fechar buraco.
 *
 * A IA roda por último e éBest-effort: `fillGapsWithLlm` nunca lança, então
 * esta função devolve a ficha mesmo com o provedor fora. O motivo do erro, se
 * houver, fica em `stats.llmError` para o admin ver em vez de perder o
 * resultado.
 */
export async function runIngestionPipeline(options: IngestOptions): Promise<IngestionResult> {
  const policy: IngestionPolicy = { ...DEFAULT_POLICY, ...options.policy };
  const base = runDeterministicExtraction(options);

  // 5-6. Uma chamada de IA, só se a política permitir e houver buraco suficiente.
  const shouldCallLlm =
    policy.llm === 'always' || (policy.llm === 'gaps-only' && base.gaps.length >= policy.minGapsForLlm);

  if (!shouldCallLlm || base.gaps.length === 0) {
    return {
      ...base,
      stats: {
        ...base.stats,
        llmError:
          base.gaps.length > 0 && policy.llm !== 'always'
            ? `buraco abaixo do mínimo (${base.gaps.length}/${policy.minGapsForLlm})`
            : null,
      },
    };
  }

  const hinted = attachHints(base.gaps, base.rawText);
  const { tagged, filled, error } = await fillGapsWithLlm(hinted, base.rawText, policy);

  if (tagged.length === 0) {
    return {
      ...base,
      stats: { ...base.stats, llmUsed: true, llmError: error ?? 'IA não preencheu nenhum campo' },
    };
  }

  // 7. Realoca pelo MESMO alocador. Não existe caminho paralelo.
  const llmSections = allocateFromTaggedSpecs(
    tagged,
    base.rawText,
    base.identity,
    options.parsedData ?? options.payload?.parsedYamlOrJson
  );

  const fileName = options.fileName ?? options.payload?.fileName ?? 'documento.txt';
  const specSections = stampDocumentSource(
    allocateAndNormalizeSpecSections(
      undefined,
      mergeSections(base.specSections, llmSections),
      scalarsFrom(base.identity)
    ),
    fileName
  );

  const audit = auditEBikeSpecs(specSections as never).auditSummary;
  const gaps = findSpecGaps(specSections);
  const totalItems = specSections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0);

  return {
    ...base,
    specSections,
    audit,
    gaps,
    editorial: stampEditorialSources(base.editorial, specSections, fileName),
    stats: {
      ...base.stats,
      totalCanonicalItems: totalItems,
      filledItems: totalItems - gaps.length,
      gapCount: gaps.length,
      llmUsed: true,
      llmFieldsFilled: filled,
      llmError: null,
      durationMs: base.stats.durationMs + (Date.now() - base.stats.durationMs),
    },
  };
}

/** A entrada determinística tem prioridade; a da IA só preenche buraco. */
function mergeSections(base: EBikeSpecSection[], incoming: EBikeSpecSection[]): EBikeSpecSection[] {
  const merged: EBikeSpecSection[] = base.map((section) => ({
    ...section,
    items: [...(section.items ?? [])],
  }));

  incoming.forEach((section, sectionIndex) => {
    const target = merged[sectionIndex];
    if (!target) return;

    for (const item of section.items ?? []) {
      const value = (item.value ?? '').trim();
      if (!value || value === UNCONFIRMED_LABEL) continue;

      // Já tem valor determinístico: a IA não sobrescreve.
      const alreadyFilled = target.items.some(
        (candidate) =>
          candidate.label.toLowerCase() === item.label.toLowerCase() &&
          candidate.value !== UNCONFIRMED_LABEL
      );
      if (alreadyFilled) continue;

      const slot = target.items.find(
        (candidate) => candidate.label.toLowerCase() === item.label.toLowerCase()
      );
      if (slot) {
        slot.value = value;
        slot.status = item.status;
        slot.confidence = item.confidence;
        slot.source = item.source || '';
        slot.sourceUrl = item.sourceUrl || '';
        slot.notes = item.notes || '';
      } else {
        target.items.push({ ...item, value });
      }
    }
  });

  return merged;
}
