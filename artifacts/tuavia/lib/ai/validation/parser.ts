/**
 * lib/ai/validation/parser.ts
 *
 * Parser da saída de LLM. Substitui `@/src/ai/validation/YAMLParser`.
 *
 * LLM devolve JSON com cercas de markdown, YAML com indentação irregular e
 * comentário antes e depois. O parser normaliza isso em cascata e valida com
 * Zod quando há schema. Nunca lança: devolve `{ success: false, errors }`.
 */

import { load, dump } from 'js-yaml';
import { z } from 'zod';

export type AIExecutionSchema = z.ZodTypeAny;

export interface ParseSuccess<T = unknown> {
  success: true;
  data: T;
  raw: string;
}

export interface ParseFailure {
  success: false;
  errors: string[];
  raw: string;
}

export type ParseResult<T = unknown> = ParseSuccess<T> | ParseFailure;

const FENCED_RE = /```(?:json|yaml|yml)?\s*\n?([\s\S]*?)```/gi;

/** Remove cercas de markdown das pontas. */
function stripFences(input: string): string {
  return input.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
}

/** Extrai o primeiro `{...}` ou `[...]` balanceado, ignorando chaves em strings. */
function extractOutermost(input: string): string | null {
  const start = input.search(/[[{]/);
  if (start === -1) return null;

  const open = input[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const char = input[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function tryYaml(text: string): unknown {
  try {
    return load(text);
  } catch {
    return undefined;
  }
}

class YAMLParserClass {
  /** Parse best-effort. Devolve `null` quando nada é interpretável. */
  static parse(raw: string | null | undefined): unknown {
    if (typeof raw !== 'string') return null;
    const input = raw.trim();
    if (!input) return null;

    const fenced: string[] = [];
    FENCED_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FENCED_RE.exec(input)) !== null) {
      const body = match[1]?.trim();
      if (body) fenced.push(body);
    }

    const candidates = [...fenced, stripFences(input), extractOutermost(input)].filter(
      (candidate): candidate is string => Boolean(candidate)
    );

    for (const candidate of candidates) {
      const asJson = tryJson(candidate);
      if (asJson !== undefined) return asJson;
      const asYaml = tryYaml(candidate);
      if (asYaml !== undefined && typeof asYaml === 'object') return asYaml;
    }

    return null;
  }

  /** Valida a saída contra um schema Zod. Nunca lança. */
  static parseWithSchema<T = unknown>(raw: string, schema: AIExecutionSchema): ParseResult<T> {
    const parsed = YAMLParserClass.parse(raw);
    const safeRaw = typeof raw === 'string' ? raw : '';

    if (parsed === null) {
      return {
        success: false,
        errors: ['Não foi possível interpretar a resposta como JSON ou YAML.'],
        raw: safeRaw,
      };
    }

    const result = schema.safeParse(parsed);
    if (result.success) return { success: true, data: result.data as T, raw: safeRaw };

    return {
      success: false,
      errors: result.error.issues
        .slice(0, 8)
        .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`),
      raw: safeRaw,
    };
  }

  /** Serializa um objeto para YAML/JSON, conforme pedido. */
  static stringify(value: unknown, format: 'yaml' | 'json' = 'yaml'): string {
    try {
      return format === 'json' ? JSON.stringify(value, null, 2) : dump(value, { lineWidth: 120 });
    } catch {
      return String(value);
    }
  }

  /**
   * Limpa o markdown de artigo que o LLM devolveu: remove cercas residuais e
   * prefixos de "Aqui está o artigo".
   */
  static cleanMarkdownArticleText(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return '';
    let text = raw.trim();

    text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    text = text.replace(/^(?:Aqui (?:está|segue) (?:o|a) [^:\n]*:\s*\n+)/i, '');
    text = text.replace(/^(?:Claro!|Certamente!|Perfeito!)[^\n]*\n+/i, '');

    // Garante exatamente um H1 no topo.
    text = text.replace(/^(#\s+.+\n+)+/m, '');
    return `# ${text}`.trim();
  }

  /** Extrai o primeiro H1 e devolve { title, body }. */
  static extractTitle(raw: string | null | undefined): { title: string; body: string } {
    const text = typeof raw === 'string' ? raw : '';
    const match = text.match(/^#\s+(.+)$/m);
    if (!match?.[1]) return { title: '', body: text.trim() };
    return { title: match[1].trim(), body: text.replace(/^#\s+.+\n+/m, '').trim() };
  }
}

export const YAMLParser = YAMLParserClass;
