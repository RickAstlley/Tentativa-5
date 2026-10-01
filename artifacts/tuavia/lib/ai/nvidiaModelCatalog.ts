/**
 * Catálogo de modelos NVIDIA NIM — os 6 modelos oficiais usados pelo TuaVia
 * =====================================================================
 *
 * Fonte: https://integrate.api.nvidia.com/v1/models
 *
 * Este arquivo é a ÚNICA fonte de verdade sobre quais modelos existem.
 * Não há tabela de aliases nem modelos "obsoletos": o catálogo é fechado e
 * `resolveModelId` rejeita qualquer ID fora dele, em vez de remapear para
 * outro modelo em silêncio.
 *
 * A consequência é deliberada: se um dia alguém escrever
 * `deepseek-ai/deepseek-v4.1-flash` no código, o typecheck falha e, se passar
 * por dado externo, a chamada é rejeitada com erro explícito. Antes, um ID
 * inexistente era convertido em `z-ai/glm-5.3` com um `console.warn` — a UI
 * prometia um modelo e o provedor executava outro, sem ninguém perceber.
 *
 * `recommendedParams` reproduz os parâmetros de referência da NVIDIA para cada
 * modelo (temperatura, top_p, teto de tokens, thinking e streaming), para que a
 * UI e o pipeline não inventem valores que o modelo não foi calibrado para.
 */

export type NvidiaModelId =
  /** Chat balanceado, PT-BR. Padrão de texto do site. */
  | 'z-ai/glm-5.3'
  /** Raciocínio máximo com streaming de pensamento. Plano, auditoria, veredito. */
  | 'nvidia/nemotron-3-ultra-550b-a55b'
  /** Raciocínio rápido e barato. Classificação, resumo, extração de campo único. */
  | 'nvidia/nemotron-3-super-120b-a12b'
  /** Multimodal de contexto longo. Visão + comparação, reasoning_effort alto. */
  | 'moonshotai/kimi-k3'
  /** Multimodal de contexto curto. Visão e análise de imagem com janela apertada. */
  | 'google/gemma-4-31b-it'
  /** Compatível com a API open-source da OpenAI. Síntese, auditoria e fallback. */
  | 'openai/gpt-oss-20b';

export type NvidiaModelCategory = 'chat' | 'reasoning' | 'multimodal';

/** Parâmetros de referência do modelo, conforme a documentação da NVIDIA. */
export interface NvidiaModelRecommendedParams {
  temperature: number;
  topP: number;
  /** Teto de tokens de saída que o modelo documenta como estável. */
  maxTokens: number;
  /** Habilita o fluxo de pensamento exposto em `reasoning_content`. */
  enableThinking?: boolean;
  /** Nível de raciocínio, para os modelos que o exponem. */
  reasoningEffort?: 'low' | 'medium' | 'high' | 'max';
  /** Semente para reprodutibilidade das extrações. */
  seed?: number;
  /** O modelo de raciocínio só transmite raciocínio em streaming. */
  streaming?: boolean;
}

export interface NvidiaModelInfo {
  id: NvidiaModelId;
  name: string;
  category: NvidiaModelCategory;
  contextWindow: number;
  maxOutputTokens: number;
  multimodal: boolean;
  /** Streaming necessário para receber `reasoning_content`. */
  requiresStreamingForReasoning?: boolean;
  recommendedParams: NvidiaModelRecommendedParams;
  /** Funções para as quais este modelo é a primeira escolha. */
  bestFor: string[];
}

export const NVIDIA_MODELS: Record<NvidiaModelId, NvidiaModelInfo> = {
  'z-ai/glm-5.3': {
    id: 'z-ai/glm-5.3',
    name: 'GLM 5.3',
    category: 'chat',
    contextWindow: 131072,
    maxOutputTokens: 16384,
    multimodal: false,
    recommendedParams: { temperature: 0.5, topP: 1, maxTokens: 16384 },
    bestFor: [
      'chat',
      'pt-br',
      'conteudo',
      'redacao',
      'seo',
      'classificacao',
      'extracao',
      'resumo',
      'default',
    ],
  },

  'nvidia/nemotron-3-ultra-550b-a55b': {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'Nemotron 3 Ultra 550B',
    category: 'reasoning',
    contextWindow: 131072,
    maxOutputTokens: 16384,
    multimodal: false,
    // Sem streaming não chega `reasoning_content`: o modelo entrega só a resposta
    // final, e a UI que mostra o raciocínio ficaria vazia.
    requiresStreamingForReasoning: true,
    recommendedParams: {
      temperature: 1,
      topP: 0.95,
      maxTokens: 16384,
      enableThinking: true,
      seed: 0,
      streaming: true,
    },
    bestFor: [
      'raciocinio',
      'planejamento',
      'pesquisa',
      'auditoria',
      'veredito',
      'extracao-profunda',
    ],
  },

  'nvidia/nemotron-3-super-120b-a12b': {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B',
    category: 'reasoning',
    contextWindow: 131072,
    maxOutputTokens: 16384,
    multimodal: false,
    recommendedParams: { temperature: 0.5, topP: 1, maxTokens: 16384 },
    bestFor: ['rapido', 'classificacao', 'resumo', 'triagem', 'tarefa-simples', 'fallback-barato'],
  },

  'moonshotai/kimi-k3': {
    id: 'moonshotai/kimi-k3',
    name: 'Kimi K3',
    category: 'multimodal',
    contextWindow: 131072,
    maxOutputTokens: 16384,
    multimodal: true,
    recommendedParams: {
      temperature: 1,
      topP: 1,
      maxTokens: 16384,
      reasoningEffort: 'max',
      seed: 0,
    },
    bestFor: ['visao', 'imagem', 'multimodal', 'comparacao', 'mercado', 'relatorio-visual'],
  },

  'google/gemma-4-31b-it': {
    id: 'google/gemma-4-31b-it',
    name: 'Gemma 4 31B IT',
    category: 'multimodal',
    // Janela curta: é o modelo de visão para documento denso e imagem única,
    // não para arquivo longo. Para contexto longo, kimi-k3.
    contextWindow: 8192,
    maxOutputTokens: 8192,
    multimodal: true,
    recommendedParams: { temperature: 0.5, topP: 1, maxTokens: 8192, seed: 0 },
    bestFor: ['visao', 'imagem', 'multimodal', 'pesquisa-imagem', 'relevancia-de-imagem'],
  },

  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    category: 'chat',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    multimodal: false,
    recommendedParams: { temperature: 1, topP: 1, maxTokens: 4096 },
    bestFor: ['auditoria', 'sintese', 'open-compat', 'responses-api', 'fallback'],
  },
};

export const ALL_NVIDIA_MODEL_IDS = Object.keys(NVIDIA_MODELS) as NvidiaModelId[];

/**
 * Modelos que aceitam imagem.
 *
 * Uma chamada com `image_url` para fora desta lista é rejeitada pelo endpoint,
 * então o filtro é a guarda mais barata antes de gastar uma requisição.
 */
export const VISION_MODEL_IDS = ALL_NVIDIA_MODEL_IDS.filter((id) => NVIDIA_MODELS[id].multimodal);

/**
 * Modelos de texto (sem visão). Primeiro da lista, por papel:
 * `chat` é o padrão de texto, `fast` o de triagem, `open` o de compatibilidade.
 */
export const CHAT_MODEL_IDS = ALL_NVIDIA_MODEL_IDS.filter((id) => !NVIDIA_MODELS[id].multimodal);

/** Modelo padrão quando nenhum é especificado. */
export const DEFAULT_NVIDIA_MODEL_ID: NvidiaModelId = 'z-ai/glm-5.3';

export function isValidNvidiaModel(id: string): id is NvidiaModelId {
  return id in NVIDIA_MODELS;
}

export function getModelInfo(id: string): NvidiaModelInfo | undefined {
  return isValidNvidiaModel(id) ? NVIDIA_MODELS[id] : undefined;
}

export function getRecommendedParams(id: NvidiaModelId): NvidiaModelRecommendedParams {
  return NVIDIA_MODELS[id].recommendedParams;
}

/** Cota efetiva: o menor `maxTokens` entre o pedido e o teto do modelo. */
export function clampMaxTokens(id: NvidiaModelId, requested?: number): number {
  const ceiling = NVIDIA_MODELS[id].maxOutputTokens;
  if (!requested || !Number.isFinite(requested) || requested <= 0) return ceiling;
  return Math.min(Math.floor(requested), ceiling);
}

/**
 * Modelo mais próximo de um papel, para quem precisa de um default sem
 * consultar a tabela de tarefas inteira.
 */
export function getModelForRole(
  role: 'chat' | 'fast' | 'reasoning' | 'vision' | 'vision-long' | 'audit'
): NvidiaModelId {
  switch (role) {
    case 'fast':
      return 'nvidia/nemotron-3-super-120b-a12b';
    case 'reasoning':
      return 'nvidia/nemotron-3-ultra-550b-a55b';
    case 'vision':
      return 'google/gemma-4-31b-it';
    case 'vision-long':
      return 'moonshotai/kimi-k3';
    case 'audit':
      return 'openai/gpt-oss-20b';
    case 'chat':
    default:
      return DEFAULT_NVIDIA_MODEL_ID;
  }
}

/**
 * Valida um ID vindo de fora do código.
 *
 * Antes existia uma tabela de ~35 aliases que convertia IDs aposentados no
 * modelo "parecido" e, no fim da cadeia, caía em `z-ai/glm-5.3`. O efeito era
 * silencioso: `ProviderHub.DEFAULT` apontava para um ID inexistente e rodava
 * GLM; o seletor de modelos prometia "DeepSeek v4 Pro" e executava Nemotron.
 * Um ID desconhecido agora é erro, não um silencioso "deu certo".
 */
export function resolveModelId(id: string): NvidiaModelId {
  const requested = (id || '').trim();
  if (isValidNvidiaModel(requested)) return requested;

  throw new InvalidModelError(
    requested,
    `Modelo "${requested}" não está no catálogo NVIDIA NIM do TuaVia. ` +
      `Modelos válidos: ${ALL_NVIDIA_MODEL_IDS.join(', ')}.`
  );
}

/**
 * Erro de modelo inválido, para a cadeia de fallback saber que não há o que tentar.
 *
 * Expõe `errorCode` (e não só `code`) porque é o campo que as rotas de API leem
 * para montar a resposta e que o `ProviderError` usa internamente. Com `code`
 * apenas, o `errorCode` chegava vazio e toda falha de catálogo voltava como
 * `NVIDIA_EXECUTION_ERROR` genérico.
 */
export class InvalidModelError extends Error {
  readonly code = 'INVALID_MODEL';
  readonly errorCode = 'INVALID_MODEL';
  /** Sem retry: repetir com outro modelo não corrige um ID fora do catálogo. */
  readonly retryable = false;

  constructor(
    readonly modelId: string,
    message: string
  ) {
    super(message);
    this.name = 'InvalidModelError';
  }
}

/** Diagnóstico para a UI: o que foi pedido e o que existe. */
export function describeCatalog(): string {
  return ALL_NVIDIA_MODEL_IDS.map((id) => {
    const info = NVIDIA_MODELS[id];
    return `${info.name} (${id}) — ${info.category}, ${info.contextWindow} ctx${
      info.multimodal ? ', visão' : ''
    }`;
  }).join('\n');
}
