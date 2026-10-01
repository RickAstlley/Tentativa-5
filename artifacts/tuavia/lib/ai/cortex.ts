/**
 * lib/ai/cortex.ts
 *
 * "Cortex" é o barramento de raciocínio do admin: um pedido chega com um
 * contexto, passa pelas ferramentas registradas e devolve um resultado com
 * trilha de auditoria. Substitui `@/src/ai` (que não existia).
 *
 * Não é um modelo novo — é a camada que registra o que cada execução fez, que
 * antes não existia e por isso não havia telemetria.
 */

import { AIRouter } from '@/lib/ai/router';
import { AIExecutionLogger } from '@/lib/ai/telemetry';
import type { AIModelId } from '@/lib/ai/types';

export interface ToolDefinition {
  name: string;
  description: string;
  /** Executa a ferramenta. Deve ser puro e rápido; rede vai no provedor. */
  execute: (input: unknown, context: Record<string, unknown>) => Promise<unknown> | unknown;
  status?: 'available' | 'disabled';
}

export interface AuditEntry {
  id: string;
  at: string;
  task: string;
  model?: string;
  tools: string[];
  durationMs: number;
  success: boolean;
  summary?: string;
}

const auditTrail: AuditEntry[] = [];
const MAX_AUDIT = 200;

class ToolRegistryClass {
  private static tools = new Map<string, ToolDefinition>();

  static register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  static get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  static listTools(): Array<{ name: string; description: string; status: string }> {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      status: tool.status ?? 'available',
    }));
  }
}

class CortexHubClass {
  /**
   * Executa um pedido de raciocínio. Roda as ferramentas registradas que forem
   * relevantes e então pede ao roteador a síntese final.
   */
  static async process(options: {
    task: string;
    context: string;
    depth?: 'shallow' | 'standard' | 'deep';
    model?: AIModelId;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    result: string;
    toolsUsed: string[];
    model: string;
    durationMs: number;
    tokenEstimate: number;
  }> {
    const startedAt = Date.now();
    const depth = options.depth ?? 'standard';
    const usedTools: string[] = [];

    // Ferramentas puras e baratas rodam antes do LLM.
    const toolOutputs: Record<string, unknown> = {};
    if (depth !== 'shallow') {
      for (const entry of ToolRegistryClass.listTools()) {
        if (entry.status === 'disabled') continue;
        const definition = ToolRegistryClass.get(entry.name);
        if (!definition) continue;
        try {
          toolOutputs[entry.name] = await definition.execute(options.context, {
            task: options.task,
            depth,
          });
          usedTools.push(entry.name);
        } catch (error) {
          toolOutputs[entry.name] = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    const toolContext =
      Object.keys(toolOutputs).length > 0
        ? `\n\nRESULTADO DAS FERRAMENTAS (JSON):\n${JSON.stringify(toolOutputs).slice(0, 6000)}`
        : '';

    const dispatch = await AIRouter.dispatch({
      task: options.task,
      rawPrompt: `${options.context}${toolContext}`,
      overrideModel: options.model,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? (depth === 'deep' ? 6000 : 3000),
      priority: depth === 'deep' ? 'high' : 'normal',
    });

    auditTrail.push({
      id: `cortex_${Date.now()}`,
      at: new Date().toISOString(),
      task: options.task,
      model: dispatch.model,
      tools: usedTools,
      durationMs: Date.now() - startedAt,
      success: dispatch.success,
      summary: dispatch.error ?? `${dispatch.text.length} caracteres`,
    });
    if (auditTrail.length > MAX_AUDIT) auditTrail.shift();

    return {
      result: dispatch.text || dispatch.error || '',
      toolsUsed: usedTools,
      model: dispatch.model,
      durationMs: Date.now() - startedAt,
      tokenEstimate: Math.ceil((options.context.length + dispatch.text.length) / 4),
    };
  }
}

class CortexAuditTrailClass {
  static getLogs(limit = 50): AuditEntry[] {
    return auditTrail.slice(-limit).reverse();
  }

  static clear(): void {
    auditTrail.length = 0;
  }
}

export const CortexHub = CortexHubClass;
export const CortexAuditTrail = CortexAuditTrailClass;
export const ToolRegistry = ToolRegistryClass;

// Ferramentas determinísticas registradas por padrão. Nenhuma delas chama LLM.
ToolRegistry.register({
  name: 'spec_audit',
  description: 'Audita itens de ficha técnica e calcula o integrityScore sem chamar LLM.',
  execute: async (input) => {
    const { auditEBikeSpecs } = await import('@/lib/ai/deterministicAuditor');
    const sections =
      typeof input === 'object' && input
        ? (input as { specSections?: unknown }).specSections
        : null;
    if (!Array.isArray(sections)) return { skipped: true, reason: 'sem specSections' };
    return auditEBikeSpecs(sections as never);
  },
});

ToolRegistry.register({
  name: 'contran_check',
  description: 'Classifica a e-bike perante a Resolução CONTRAN 996/2023 a partir da potência.',
  execute: async (input) => {
    const { sanitizeContranValue } = await import('@/lib/specAllocations');
    const potenciaW =
      typeof input === 'object' && input
        ? (input as { potenciaW?: unknown }).potenciaW
        : undefined;
    return { enquadramento: sanitizeContranValue(String(potenciaW ?? ''), potenciaW as never) };
  },
});

export { AIExecutionLogger };
