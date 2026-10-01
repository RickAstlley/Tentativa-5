/**
 * lib/ai/providers/hub.ts
 *
 * Ponto único de chamada ao provedor, com degradação encadeada.
 * Substitui `@/src/ai/providers/ProviderHub`, que não existia.
 *
 * Todo consumidor passa por aqui — assim há um único lugar onde a política de
 * fallback, o rate limit, o circuit breaker e a telemetria são aplicados.
 */

import { NvidiaProvider, ProviderError } from '@/lib/ai/providers/nvidia';
import { AIExecutionLogger } from '@/lib/ai/telemetry';
import type { Priority } from '@/lib/ai/rateLimiter';
import {
  DEFAULT_NVIDIA_MODEL_ID,
  InvalidModelError,
  type NvidiaModelId,
} from '@/lib/ai/nvidiaModelCatalog';
import type {
  AIModelId,
  ChatMessagePayload,
  MultimodalContentPart,
  ProviderResult,
} from '@/lib/ai/types';

export type { ProviderResult, ChatMessagePayload, MultimodalContentPart };

/**
 * Modelo do endpoint `/embeddings`.
 *
 * Não é um LLM de chat e não faz parte de `NVIDIA_MODELS`: o NIM serve
 * embeddings em rota separada, com `input_type` e vetor de saída próprios.
 */
const EMBED_MODEL_ID = 'nvidia/nemotron-3-embed-1b';

export interface ExecuteWithFallbackOptions {
  /** Identificador da operação, usado na telemetria e nos logs. */
  taskName: string;
  primaryModel: AIModelId;
  fallbackModel?: AIModelId;
  tertiaryModel?: AIModelId;
  messages: Array<string | ChatMessagePayload | MultimodalContentPart[]>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  priority?: Priority;
  enableThinking?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
  /** Resposta bruta, sem os campos de degradação. */
  raw?: boolean;
}

class ProviderHubClass {
  /**
   * Modelo padrão do projeto, usado quando nada é especificado.
   *
   * Antes era `nvidia/llama-3.1-nemotron-70b-instruct`, que não existe nem no
   * catálogo nem na tabela de aliases: `resolveModelId` caía no `z-ai/glm-5.3`
   * com um `console.warn`, então o default "Nemotron" rodava GLM em silêncio.
   */
  static readonly DEFAULT: NvidiaModelId = DEFAULT_NVIDIA_MODEL_ID;

  /**
   * Modelo por papel, para quem precisa escolher o primário e o fallback em vez
   * de repetir o mesmo par de modelos em cada chamador.
   *
   * Existia um consumo de `ProviderHub.DEFAULT_MODELS.orchestrator` sem que
   * este mapa existisse: a leitura era `undefined` e a rota do radar caía em
   * `TypeError` antes de falar com o provedor.
   */
  static readonly DEFAULT_MODELS: Record<'orchestrator' | 'reasoning' | 'fast', NvidiaModelId> = {
    orchestrator: DEFAULT_NVIDIA_MODEL_ID,
    /** Raciocínio mais forte, para tarefa que exige raciocínio longo. */
    reasoning: 'nvidia/nemotron-3-ultra-550b-a55b',
    /** Texto corrido e rápido, para resumo e classificação. */
    fast: 'nvidia/nemotron-3-super-120b-a12b',
  };

  /**
   * Tenta primary -> fallback -> tertiary. Só cai para o próximo modelo em
   * falha transitória (timeout, 5xx, 429, cota). Erro de chave inválida ou de
   * prompt é permanente e propaga imediatamente.
   */
  static async executeWithFallback(
    options: ExecuteWithFallbackOptions
  ): Promise<ProviderResult> {
    const chain = [options.primaryModel, options.fallbackModel, options.tertiaryModel].filter(
      (model): model is string => Boolean(model && model.trim())
    );

    if (chain.length === 0) {
      throw new ProviderError('Nenhum modelo informado para executeWithFallback.', {
        errorCode: 'INVALID_MODEL',
      });
    }

    let lastError: ProviderError | null = null;

    for (let index = 0; index < chain.length; index += 1) {
      const model = chain[index];
      if (!model) continue;

      try {
        const result = await NvidiaProvider.chatCompletion(model, options.messages, {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          topP: options.topP,
          timeoutMs: options.timeoutMs,
          priority: options.priority,
          enableThinking: options.enableThinking,
          reasoningEffort: options.reasoningEffort,
          signal: options.signal,
        });

        if (options.raw) return result;

        return {
          ...result,
          degraded: index > 0,
          degradedReason:
            index > 0 ? `Fallback para ${model} após falha em ${chain[index - 1]}.` : undefined,
        };
      } catch (error) {
        // Modelo fora do catálogo é erro do pedido, não do provedor: repetir
        // com o próximo da cadeia só trocaria um ID inválido por outro. Então
        // entra como não-recuperável e aborta a cadeia na hora.
        const providerError =
          error instanceof ProviderError
            ? error
            : error instanceof InvalidModelError
              ? new ProviderError(error.message, {
                  errorCode: 'INVALID_MODEL',
                  retryable: false,
                })
              : new ProviderError(error instanceof Error ? error.message : String(error), {
                  errorCode: 'UNKNOWN',
                  retryable: true,
                });

        lastError = providerError;
        console.warn(
          `[ProviderHub] ${options.taskName}: ${model} falhou (${providerError.errorCode}${
            providerError.status ? `/${providerError.status}` : ''
          }).`
        );

        if (!providerError.retryable) throw providerError;
      }
    }

    throw (
      lastError ??
      new ProviderError(`Falha em todos os modelos para ${options.taskName}.`, {
        errorCode: 'ALL_MODELS_FAILED',
        retryable: true,
      })
    );
  }

  /** Chamada única, sem fallback. Usada por diagnóstico e pelo playground. */
  static async execute(options: ExecuteWithFallbackOptions): Promise<ProviderResult> {
    return ProviderHubClass.executeWithFallback({
      ...options,
      fallbackModel: undefined,
      tertiaryModel: undefined,
    });
  }

  /**
   * Modelo de embedding.
   *
   * Fica de fora do catálogo de propósito: embedding é o endpoint `/embeddings`
   * do NIM, com formato de entrada e saída próprio, e nenhum dos 6 modelos de
   * chat serve para ele. Declarar aqui, em vez de passar o ID por parâmetro,
   * evita que o mesmo modelo apareça como opção em dois lugares com regras
   * diferentes.
   */
  static getEmbedModel(): string {
    return EMBED_MODEL_ID;
  }

  /**
   * Embeddings. Usa o endpoint dedicado e devolve o vetor bruto.
   *
   * Nunca sintetiza o vetor em caso de falha: um vetor inventado é
   * indistinguível de um vetor real para quem consome, e a busca por
   * similaridade passa a devolver resultados arbitrários com aparência de
   * corretude.
   */
  static async embed(input: string, model: string = EMBED_MODEL_ID): Promise<number[]> {
    const keys = NvidiaProvider.getApiKeys();
    if (keys.length === 0) {
      throw new ProviderError('NVIDIA_API_KEY não configurada.', { errorCode: 'API_KEY_MISSING' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${NvidiaProvider.getBaseUrl()}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys[0]}` },
        body: JSON.stringify({ model, input: input.slice(0, 8000), input_type: 'passage' }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ProviderError(`Embeddings ${response.status}.`, {
          status: response.status,
          errorCode: 'EMBEDDING_FAILED',
          retryable: response.status >= 500 || response.status === 429,
        });
      }
      const payload = (await response.json()) as any;
      const vector = payload?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new ProviderError('Resposta de embeddings sem vetor.', { errorCode: 'EMPTY_EMBEDDING' });
      }
      return vector as number[];
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      if (err?.name === 'AbortError') {
        throw new ProviderError('Timeout ao gerar embedding (30s).', {
          errorCode: 'UPSTREAM_TIMEOUT',
          retryable: true,
        });
      }
      throw new ProviderError(`Falha de rede ao gerar embedding: ${err?.message}`, {
        errorCode: 'NETWORK_ERROR',
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Registra uma execução na telemetria (caminhos que não passam por chatCompletion). */
  static log(entry: Parameters<typeof AIExecutionLogger.log>[0]): void {
    AIExecutionLogger.log(entry);
  }
}

export const ProviderHub = ProviderHubClass;
