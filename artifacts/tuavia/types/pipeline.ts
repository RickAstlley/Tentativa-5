/**
 * types/pipeline.ts
 *
 * Contrato do orquestrador sequencial de agentes (`lib/ai/agentPipeline.ts`).
 * Cada passo declara o modelo, o prompt e uma validação opcional; o contexto
 * é acumulado entre os passos.
 */

import type { NvidiaModelId } from '@/lib/ai/nvidiaModelCatalog';

/**
 * Alias mantido para não espalhar o nome do catálogo por todo o código.
 *
 * Antes o tipo vinha de `lib/ai/modelRouter.ts`, que tinha uma SEGUNDA tabela
 * de modelos — paralela à de `nvidiaModelCatalog.ts`, que é a que o provedor
 * realmente usa. Duas fontes de verdade para os mesmos modelos é como um
 * modelo aparentemente configurado acaba não funcionando.
 */
export type NVIDIAModel = NvidiaModelId | string;

export type PipelineStepId = string;

/**
 * Saídas nomeadas de cada passo do pipeline.
 *
 * Antes estas chaves caíam no index signature `[key: string]: unknown`, então
 * quem lia `result.classification.category` recebia `{}` e o compilador
 * apontava erro onde o dado existia de fato. Os formatos abaixo são os JSON
 * que cada passo pede ao modelo (ver `PipelineFactory` em
 * `lib/ai/agentPipeline.ts`).
 */
export interface PipelineClassification {
  category?: string;
  contranStatus?: string;
  contranNotes?: string;
  powerClass?: string;
  speedClass?: string;
  requiresRegistration?: boolean;
  [key: string]: unknown;
}

export interface PipelineTechnicalSpecs {
  specSections?: unknown[];
  [key: string]: unknown;
}

export interface PipelineStoreSuggestion {
  store?: string;
  estimatedPrice?: number;
  affiliateUrl?: string;
  [key: string]: unknown;
}

export interface PipelineMarketAnalysis {
  competitors?: Array<{ model?: string; price?: number; pros?: string[]; cons?: string[] }>;
  priceRange?: { min?: number; max?: number; sweetSpot?: number };
  positioning?: string;
  targetAudience?: string;
  sellingPoints?: string[];
  storeSuggestions?: PipelineStoreSuggestion[];
  [key: string]: unknown;
}

export interface PipelineVerdictPackage {
  badge?: string;
  resumoExecutivo?: string;
  idealFor?: string;
  pros?: string[];
  cons?: string[];
  score?: Record<string, number>;
  [key: string]: unknown;
}

export interface PipelineSeoOutput {
  focusKeyword?: string;
  serpTitle?: string;
  serpDescription?: string;
  secondaryKeywords?: string[];
  faqSchema?: Array<{ q?: string; a?: string } | Record<string, unknown>>;
  richSnippets?: Record<string, unknown>;
  llmGeoSummary?: string;
  [key: string]: unknown;
}

export interface PipelineContext {
  /** Assunto raiz do pipeline (título da pauta, slug, query). */
  query?: string;
  /** Texto do usuário como o agente o nomeia internamente. */
  userPrompt?: string;
  /** Tipo de conteúdo alvo ('article' | 'ebike' | 'ranking'). */
  targetType?: string;
  /** Texto bruto de origem, quando houver (ficha técnica, artigo, transcrição). */
  rawText?: string;
  /** Resultado determinístico prévio, para ancorar o LLM. */
  deterministic?: unknown;
  /** Saídas nomeadas de cada passo (`step.output` -> `context[output]`). */
  classification?: PipelineClassification;
  technicalSpecs?: PipelineTechnicalSpecs;
  marketAnalysis?: PipelineMarketAnalysis;
  verdictPackage?: PipelineVerdictPackage;
  finalOutput?: PipelineSeoOutput;
  [key: string]: unknown;

  // Acumuladores preenchidos pelo orquestrador. O construtor sempre os
  // inicializa, mas o tipo os deixa opcionais porque `AgentStep` grava
  // chaves livres no contexto.
  tokensUsed?: number;
  costEstimate?: number;
  modelsUsed?: string[];
  errors?: Array<{ step: PipelineStepId; message: string; timestamp?: number; recovered?: boolean }>;
  durationMs?: number;
}

export interface AgentStep {
  id: PipelineStepId;
  /** Rótulo humano exibido no console de workflow. */
  name?: string;
  /** Prompt estático ou função que recebe o contexto acumulado. */
  prompt: string | ((context: PipelineContext) => string);
  /** Chave em `PipelineContext` onde a saída deste passo é gravada. */
  output: string;
  /** Chave de um passo anterior cujo valor é anexado ao prompt como "INPUT ANTERIOR". */
  input?: PipelineStepId;
  model?: NVIDIAModel | string;
  temperature?: number;
  maxTokens?: number;
  /** Número de novas tentativas antes de desistir. Padrão: 1 (sem retry). */
  retryOnFail?: number;
  /** Gate de aceitação da saída. Retornar false reprocessa o passo. */
  validation?: (output: unknown) => boolean;
}

export interface PipelineExecutionResult {
  context: PipelineContext;
  durationMs: number;
  stepsCompleted: number;
  stepsFailed: number;
}
