/**
 * lib/ai/types.ts
 *
 * Contratos compartilhados da camada de integração com o provedor de IA.
 * Substitui `@/src/ai/types`, que não existia no repositório.
 */

/** IDs de modelo aceitos pelo roteador. O catálogo completo está em `nvidiaModelCatalog.ts`. */
export type AIModelId = string;

/** Tarefas de alto nível que o admin pode disparar. */
export type AITask =
  | 'chat'
  | 'article_autofill'
  | 'article_seo'
  | 'ebike_autofill'
  | 'ebike_seo'
  | 'ebike_section_autofill'
  | 'ebike_ingest_step'
  | 'ranking_generation'
  | 'content_generation'
  | 'image_research'
  | 'image_search_validate'
  | 'radar_scan'
  | 'ai_radar_scan'
  | 'rewrite'
  | 'extract'
  | 'classify';

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  /**
   * Texto simples ou blocos multimodais.
   *
   * O provider já sabe serializar os dois (`buildMessages` em
   * `providers/nvidia.ts`), mas o tipo aceitava só `string` — então o painel
   * de teste de visão passava um array e o compilador acusava erro onde não
   * havia bug.
   */
  content: string | MultimodalContentPart[];
}

export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderResult {
  text: string;
  model: string;
  usage?: ProviderUsage;
  latencyMs: number;
  /** `true` quando a resposta veio de um modelo de fallback, não do primário. */
  degraded?: boolean;
  /** Motivo da degradação, quando houve. */
  degradedReason?: string;
  /**
   * Raciocínio do modelo, quando ele expõe.
   *
   * Vem num canal separado da resposta final em todos os provedores com
   * raciocínio (Nemotron, DeepSeek). Antes não era tipado nem extraído, e o
   * painel de teste lia um `reasoning` inexistente — sempre `undefined`.
   */
  reasoningContent?: string;
}

/** Candidato de imagem antes da validação. */
export interface ImageCandidate {
  url: string;
  sourceName: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  domain?: string;
}

/** Imagem que passou pela auditoria e pode ser publicada. */
export interface VerifiedImageItem {
  url: string;
  sourceName: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  /** 0–100. Combina relevância, resolução e procedência. */
  score: number;
  verified: boolean;
  /** Motivo da reprovação quando `verified === false`. */
  rejectedReason?: string;
  evidence?: string;
  articleRelevant?: boolean;
}

export interface ExecutionLog {
  id: string;
  task: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  /** `true` quando a resposta veio do cache em vez do provedor. */
  cacheHit?: boolean;
  provider?: string;
}

export interface TelemetryMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  cacheHits: number;
  byModel: Record<string, { count: number; avgLatencyMs: number; failures: number }>;
  byTask: Record<string, { count: number; failures: number }>;
}

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  domain: string;
  source?: 'serper' | 'google-cse' | 'openrouter';
}

export interface PriceCandidate {
  store: string;
  price: number;
  url?: string;
  rawText: string;
}
