/**
 * lib/ai/router.ts
 *
 * Roteador de tarefa -> modelo. Substitui `@/src/ai/router/AIRouter`.
 *
 * Não é um "LLM" novo: é a política de escolha de modelo que já existia
 * espalhada em `modelRouter.ts`, `nvidiaModelCatalog.ts` e `agentPipeline.ts`.
 * Aqui fica uma única tabela.
 */

import { ProviderHub } from '@/lib/ai/providers/hub';
import { YAMLParser, type AIExecutionSchema } from '@/lib/ai/validation/parser';
import { AIExecutionLogger } from '@/lib/ai/telemetry';
import { ContentGenerationOutputSchema } from '@/lib/ai/validation/schemas';
import type { AIModelId } from '@/lib/ai/types';
import type { Priority } from '@/lib/ai/rateLimiter';

export interface ModelChain {
  primary: AIModelId;
  fallback?: AIModelId;
  tertiary?: AIModelId;
}

/**
 * Cadeias por tarefa. Modelos pequenos e gratuitos cobrem classificação e
 * extração; o modelo grande fica reservado para escrita criativa.
 * 
 * Catálogo ativo: 5 modelos (glm-5.3, nemotron-3-ultra, gemma-4-31b-it, kimi-k3, gpt-oss-20b)
 */
const MODEL_CHAINS: Record<string, ModelChain> = {
  bicycle_extraction: {
    primary: 'nvidia/nemotron-3-ultra-550b-a55b',
    fallback: 'z-ai/glm-5.3',
  },
  ebike_extraction: {
    primary: 'nvidia/nemotron-3-ultra-550b-a55b',
    fallback: 'z-ai/glm-5.3',
  },
  spec_classification: {
    primary: 'z-ai/glm-5.3',
    fallback: 'openai/gpt-oss-20b',
  },
  content_generation: {
    primary: 'z-ai/glm-5.3',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b',
    tertiary: 'moonshotai/kimi-k3',
  },
  ranking_generation: {
    primary: 'z-ai/glm-5.3',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b',
    tertiary: 'openai/gpt-oss-20b',
  },
  article_writer: {
    primary: 'z-ai/glm-5.3',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b',
    tertiary: 'moonshotai/kimi-k3',
  },
  seo: { primary: 'z-ai/glm-5.3', fallback: 'openai/gpt-oss-20b' },
  image_research: {
    primary: 'google/gemma-4-31b-it',
    fallback: 'moonshotai/kimi-k3',
  },
  web_search_summary: {
    primary: 'z-ai/glm-5.3',
    fallback: 'nvidia/nemotron-3-ultra-550b-a55b',
  },
  chat: { primary: 'z-ai/glm-5.3' },
  default: {
    primary: 'z-ai/glm-5.3',
    fallback: 'openai/gpt-oss-20b',
  },
};

export interface DispatchOptions {
  task: string;
  rawPrompt?: string;
  /** Alias de `rawPrompt`, usado pelo chamador legado do job de conteúdo. */
  prompt?: string;
  systemPrompt?: string;
  /** Aceito e ignorado: a execução é sempre síncrona. */
  enableStreaming?: boolean;
  overrideModel?: AIModelId;
  temperature?: number;
  maxTokens?: number;
  enableThinking?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  priority?: Priority;
  timeoutMs?: number;
  /** Faz o parse da resposta em `data`. Padrão: true. */
  parse?: boolean;
  signal?: AbortSignal;
}

export interface DispatchResult {
  success: boolean;
  text: string;
  data: unknown;
  model: string;
  /** Alias de `model`, lido pelo `jobStore` ao montar o resultado do job. */
  modelUsed?: string;
  degraded: boolean;
  latencyMs: number;
  /** Alias de `latencyMs`, mesmo motivo. */
  executionTimeMs?: number;
  /** Preenchido por `routeAndExecute`. */
  validationPassed?: boolean;
  error?: string;
}

class AIRouterClass {
  static getModelChain(task: string): ModelChain {
    return MODEL_CHAINS[task] ?? MODEL_CHAINS.default!;
  }

  /** Envia o prompt e tenta extrair estrutura da resposta. */
  static async dispatch(options: DispatchOptions): Promise<DispatchResult> {
    const rawPrompt = options.rawPrompt ?? options.prompt ?? '';
    const chain = AIRouterClass.getModelChain(options.task);
    const primary = options.overrideModel ?? chain.primary;
    const fallback = options.overrideModel ? undefined : chain.fallback;
    const tertiary = options.overrideModel ? undefined : chain.tertiary;
    const startedAt = Date.now();

    try {
      const result = await ProviderHub.executeWithFallback({
        taskName: options.task,
        primaryModel: primary,
        fallbackModel: fallback,
        tertiaryModel: tertiary,
        messages: options.systemPrompt
          ? [
              { role: 'system', content: options.systemPrompt },
              { role: 'user', content: rawPrompt },
            ]
          : [rawPrompt],
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        enableThinking: options.enableThinking,
        reasoningEffort: options.reasoningEffort,
        priority: options.priority ?? 'normal',
        timeoutMs: options.timeoutMs,
        signal: options.signal,
      });

      const latencyMs = Date.now() - startedAt;
      const parsed =
        options.parse === false
          ? null
          : YAMLParser.parseWithSchema(result.text, ContentGenerationOutputSchema);

      AIExecutionLogger.log({
        task: options.task,
        model: result.model,
        latencyMs,
        success: true,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
      });

      return {
        success: true,
        text: result.text,
        data: parsed?.success ? parsed.data : null,
        model: result.model,
        modelUsed: result.model,
        degraded: result.degraded ?? false,
        latencyMs,
        executionTimeMs: latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      AIExecutionLogger.log({
        task: options.task,
        model: primary,
        latencyMs,
        success: false,
        errorCode: 'DISPATCH_FAILED',
        errorMessage: message,
      });
      return {
        success: false,
        text: '',
        data: null,
        model: primary,
        modelUsed: primary,
        degraded: false,
        latencyMs,
        executionTimeMs: latencyMs,
        error: message,
      };
    }
  }

  /** Igual `dispatch`, mas valida contra um schema específico. */
  static async routeAndExecute(
    options: DispatchOptions & { schema?: AIExecutionSchema }
  ): Promise<DispatchResult & { validated: boolean }> {
    const result = await AIRouterClass.dispatch({ ...options, parse: false });
    if (!result.success || !options.schema) return { ...result, validated: false };

    const parsed = YAMLParser.parseWithSchema(result.text, options.schema);
    return {
      ...result,
      data: parsed.success ? parsed.data : null,
      validated: parsed.success,
      validationPassed: parsed.success,
    };
  }

  /** Lista as tarefas conhecidas — usada pela tela de pipelines do admin. */
  static listTasks(): string[] {
    return Object.keys(MODEL_CHAINS);
  }
}

export const AIRouter = AIRouterClass;
