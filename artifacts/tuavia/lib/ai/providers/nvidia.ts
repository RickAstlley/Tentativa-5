/**
 * lib/ai/providers/nvidia.ts
 *
 * Cliente do NVIDIA NIM (endpoint OpenAI-compatível) com rotação de chaves.
 * Substitui `@/src/ai/providers/NvidiaProvider`, que não existia.
 *
 * Todo o controle de taxa e o circuit breaker ficam em `lib/ai/rateLimiter.ts`;
 * aqui fica apenas o transporte e a normalização de modelo.
 */

import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import { rateLimiter, extractRateLimitHeaders, type Priority } from '@/lib/ai/rateLimiter';
import {
  resolveModelId,
  getRecommendedParams,
  clampMaxTokens,
  DEFAULT_NVIDIA_MODEL_ID,
  type NvidiaModelId,
} from '@/lib/ai/nvidiaModelCatalog';
import type {
  ChatMessagePayload,
  MultimodalContentPart,
  ProviderResult,
  ProviderUsage,
} from '@/lib/ai/types';

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_TIMEOUT_MS = 90_000;
/**
 * Usado quando a chamada chega sem `model`. Antes era
 * `nvidia/llama-3.1-nemotron-70b-instruct`, que não está no catálogo — e este
 * caminho é justamente o que *pula* o `normalizeModel`, então o ID obsoleto
 * ia cru para a API em vez de ser remapeado.
 */
const FALLBACK_MODEL = DEFAULT_NVIDIA_MODEL_ID;

/** Erros de transporte que valem nova tentativa em outro modelo ou chave. */
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export type { ChatMessagePayload, MultimodalContentPart, ProviderUsage };

export class ProviderError extends Error {
  readonly status?: number;
  readonly errorCode: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status?: number; errorCode?: string; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status;
    this.errorCode = options.errorCode ?? 'PROVIDER_ERROR';
    this.retryable = options.retryable ?? false;
  }
}

interface NvidiaOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  priority?: Priority;
  enableThinking?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
  /** Semente para tornar a resposta reprodutível. */
  seed?: number;
  /**
   * Chave e endpoint de teste, enviados pelo painel de IA.
   *
   * Sem estes dois campos o botão "testar conexão" não testava nada: os
   * valores arriving do formulário eram descartados e a chamada saía sempre com
   * a chave e a URL do servidor. Agora a chave informada é a que é usada
   * **apenas nesta chamada** — nada é persistido em variável de ambiente.
   */
  apiKey?: string;
  baseURL?: string;
}

class NvidiaProviderClass {
  /**
   * Chaves aceitas. `NVIDIA_API_KEY` pode vir com várias chaves separadas por
   * vírgula, e a rotação do `rateLimiter` aproveita isso.
   */
  static getApiKeys(): string[] {
    ensureServerEnvLoaded();
    const raw = cleanEnvValue(process.env.NVIDIA_API_KEY || '');
    if (!raw) return [];
    return raw
      .split(',')
      .map((key) => cleanEnvValue(key))
      .filter((key) => key.length > 0 && !key.toLowerCase().includes('placeholder'));
  }

  static getBaseUrl(): string {
    ensureServerEnvLoaded();
    const base = cleanEnvValue(process.env.NVIDIA_BASE_URL || '') || DEFAULT_BASE_URL;
    return base.replace(/\/+$/, '');
  }

  static isConfigured(): boolean {
    return NvidiaProviderClass.getApiKeys().length > 0;
  }

  /**
   * Valida o modelo contra o catálogo fechado.
   *
   * Deixa de existir o caminho silencioso: antes, um ID fora do catálogo era
   * convertido no GLM com um `console.warn` e a requisição ia mesmo assim.
   * Agora um ID inválido é `INVALID_MODEL`, que `ProviderHub` trata como erro
   * permanente — não adianta tentar os outros modelos da cadeia, porque o
   * defeito é no pedido, não no provedor.
   */
  static normalizeModel(model?: string | null): NvidiaModelId {
    const requested = (model || '').trim();
    if (!requested) return FALLBACK_MODEL;
    return resolveModelId(requested);
  }

  private static buildMessages(
    messages: Array<string | ChatMessagePayload | MultimodalContentPart[]>
  ): unknown[] {
    return messages.map((message) => {
      if (typeof message === 'string') return { role: 'user', content: message };
      if (Array.isArray(message)) return { role: 'user', content: message };
      return message;
    });
  }

  private static extractText(payload: any): string {
    const choice = payload?.choices?.[0];
    const content = choice?.message?.content ?? choice?.text ?? '';
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
        .join('');
    }
    return typeof content === 'string' ? content : '';
  }

  private static extractUsage(payload: any): ProviderUsage | undefined {
    const usage = payload?.usage;
    if (!usage) return undefined;
    const promptTokens = Number(usage.prompt_tokens ?? usage.total_tokens ?? 0) || 0;
    const completionTokens = Number(usage.completion_tokens ?? 0) || 0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: Number(usage.total_tokens ?? promptTokens + completionTokens) || 0,
    };
  }

  /**
   * Puxa o raciocínio do canal separado.
   *
   * Os provedores com raciocínio devolvem o texto em
   * `choices[0].message.reasoning_content` (OpenAI-compatível) ou em
   * `choices[0].message.reasoning`. Sem isso, o painel de teste mostrava o
   * raciocínio como vazio mesmo com `enableThinking` ligado.
   */
  private static extractReasoning(payload: any): string | undefined {
    const message = payload?.choices?.[0]?.message;
    const reasoning = message?.reasoning_content ?? message?.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim()) return reasoning;
    if (Array.isArray(reasoning)) {
      const joined = reasoning
        .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
        .join('')
        .trim();
      return joined || undefined;
    }
    return undefined;
  }

  /** Chamada de chat com rotação entre as chaves disponíveis. */
  static async chatCompletion(
    model: string,
    messages: Array<string | ChatMessagePayload | MultimodalContentPart[]>,
    options: NvidiaOptions = {}
  ): Promise<ProviderResult> {
    const resolvedModel = NvidiaProviderClass.normalizeModel(model);
    const keys = options.apiKey
      ? [options.apiKey.trim()]
      : NvidiaProviderClass.getApiKeys();
    if (keys.length === 0) {
      throw new ProviderError('NVIDIA_API_KEY não configurada no servidor.', {
        errorCode: 'API_KEY_MISSING',
      });
    }

    const baseUrl = (options.baseURL?.trim() || NvidiaProviderClass.getBaseUrl()).replace(/\/+$/, '');
    // Cada modelo é calibrado pela NVIDIA para um par temperatura/top_p e um
    // teto de saída próprios. Mandar 0.3/4000 fixo para os seis significava
    // pedir sampling mais conservador do que o modelo foi ajustado para e truncar
    // saída cedo nos que documentam mais. Aqui o default é a recomendação do
    // catálogo, e o chamador ainda pode sobrescrever.
    const recommended = getRecommendedParams(resolvedModel);
    const body: Record<string, unknown> = {
      model: resolvedModel,
      messages: NvidiaProviderClass.buildMessages(messages),
      temperature: options.temperature ?? recommended.temperature,
      max_tokens: clampMaxTokens(resolvedModel, options.maxTokens ?? recommended.maxTokens),
      stream: false,
    };
    const topP = options.topP ?? recommended.topP;
    if (topP !== undefined) body.top_p = topP;

    const enableThinking = options.enableThinking ?? recommended.enableThinking;
    if (enableThinking !== undefined) {
      body.enable_thinking = enableThinking;
      // O NIM aceita o parâmetro direto e também dentro de chat_template_kwargs;
      // mandar os dois cobre as duas formas de template.
      body.chat_template_kwargs = { enable_thinking: enableThinking };
    }

    const reasoningEffort = options.reasoningEffort ?? recommended.reasoningEffort;
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;
    if (typeof options.seed === 'number') body.seed = options.seed;
    else if (recommended.seed !== undefined) body.seed = recommended.seed;

    let lastError: ProviderError | null = null;

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const apiKey = keys[keyIndex];
      if (!apiKey) continue;

      try {
        await rateLimiter.acquire(resolvedModel, keyIndex, 'primary', options.priority ?? 'normal');
      } catch (error) {
        lastError = new ProviderError(
          `Rate limit local: ${error instanceof Error ? error.message : String(error)}`,
          { errorCode: 'CIRCUIT_OPEN', retryable: true }
        );
        break;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const onExternalAbort = () => controller.abort();
      options.signal?.addEventListener('abort', onExternalAbort, { once: true });
      const startedAt = Date.now();

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const limitHeaders = extractRateLimitHeaders(response);
        if (limitHeaders) rateLimiter.onResponseHeaders(resolvedModel, keyIndex, limitHeaders);

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          const retryable = TRANSIENT_STATUS.has(response.status);
          lastError = new ProviderError(`NVIDIA NIM ${response.status}: ${detail.slice(0, 400)}`, {
            status: response.status,
            errorCode:
              response.status === 401 || response.status === 403 ? 'INVALID_KEY' : 'PROVIDER_ERROR',
            retryable,
          });
          if (!retryable) break;
          continue;
        }

        const payload = (await response.json()) as any;
        const text = NvidiaProviderClass.extractText(payload);
        if (!text) {
          lastError = new ProviderError('Resposta do provedor sem conteúdo de texto.', {
            errorCode: 'EMPTY_RESPONSE',
            retryable: true,
          });
          continue;
        }

        rateLimiter.onSuccess(resolvedModel, keyIndex);
        return {
          text,
          model: resolvedModel,
          usage: NvidiaProviderClass.extractUsage(payload),
          reasoningContent: NvidiaProviderClass.extractReasoning(payload),
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        lastError = new ProviderError(
          aborted
            ? `Timeout de ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms chamando o provedor.`
            : error instanceof Error
              ? error.message
              : 'Falha de rede ao chamar o provedor.',
          { errorCode: aborted ? 'TIMEOUT' : 'NETWORK_ERROR', retryable: true }
        );
        rateLimiter.onFailure(resolvedModel, keyIndex, lastError.status ?? undefined);
        continue;
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', onExternalAbort);
        rateLimiter.release(resolvedModel, keyIndex);
      }
    }

    throw (
      lastError ??
      new ProviderError('Nenhuma chave do provedor respondeu.', {
        errorCode: 'NO_PROVIDER_RESPONSE',
        retryable: true,
      })
    );
  }

  /**
   * Endpoint `/responses` da NVIDIA, usado por modelos com raciocínio.
   * Cai para chat completion quando o endpoint não existe na conta.
   */
  static async executeResponsesApi(
    model: string,
    prompt: string,
    systemPrompt?: string,
    options: NvidiaOptions = {}
  ): Promise<ProviderResult> {
    const resolvedModel = NvidiaProviderClass.normalizeModel(model);
    const keys = options.apiKey ? [options.apiKey.trim()] : NvidiaProviderClass.getApiKeys();
    if (keys.length === 0) {
      throw new ProviderError('NVIDIA_API_KEY não configurada no servidor.', {
        errorCode: 'API_KEY_MISSING',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(
        `${(options.baseURL?.trim() || NvidiaProviderClass.getBaseUrl()).replace(/\/+$/, '')}/responses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys[0]}` },
          body: JSON.stringify({
            model: resolvedModel,
            input: prompt,
            instructions: systemPrompt,
            max_output_tokens: clampMaxTokens(
              resolvedModel,
              options.maxTokens ?? getRecommendedParams(resolvedModel).maxTokens
            ),
            temperature: options.temperature ?? getRecommendedParams(resolvedModel).temperature,
          }),
          signal: controller.signal,
        }
      );

      if (response.ok) {
        const payload = (await response.json()) as any;
        const text = payload?.output_text || payload?.output?.[0]?.content?.[0]?.text || '';
        if (text) {
          return {
            text: String(text),
            model: resolvedModel,
            usage: NvidiaProviderClass.extractUsage(payload),
            latencyMs: Date.now() - startedAt,
          };
        }
      }
    } catch {
      /* cai para chat completion */
    } finally {
      clearTimeout(timeout);
    }

    return NvidiaProviderClass.chatCompletion(
      resolvedModel,
      systemPrompt
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ]
        : [prompt],
      options
    );
  }

  /** Lista de modelos da conta, para o seletor do playground. */
  static async listAvailableModels(): Promise<Array<{ id: string; contextLength?: number }>> {
    const keys = NvidiaProviderClass.getApiKeys();
    if (keys.length === 0) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${NvidiaProviderClass.getBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${keys[0]}` },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as any;
      return Array.isArray(payload?.data) ? payload.data : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const NvidiaProvider = NvidiaProviderClass;
