'use client';

/**
 * lib/utils/browserParser.ts
 *
 * Parser de saída estruturada de LLM para o cliente. Roda no browser (o
 * playground e os cards de resposta do admin precisam parsear localmente),
 * então não pode depender de `fs` nem do SDK de servidor.
 *
 * Usa a mesma estratégia em cascata do `lib/ai/validation/parser.ts`:
 * bloco cercado -> documento inteiro -> extração do objeto mais externo -> null.
 */

import { load } from 'js-yaml';

const FENCED_RE = /```(?:json|yaml|yml)\s*\n?([\s\S]*?)```/gi;

function stripFences(input: string): string {
  return input.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
}

/** Extrai o primeiro objeto/array balanceado, ignorando chaves dentro de strings. */
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

/**
 * Tenta converter uma resposta de LLM em objeto.
 * Retorna `fallback` quando nada é parseável — nunca lança.
 */
export function parseJsonOrYamlClient<T = Record<string, unknown>>(
  raw: string | null | undefined,
  fallback: T | null = null
): T | null {
  if (!raw || typeof raw !== 'string') return fallback;
  const input = raw.trim();
  if (!input) return fallback;

  const fenced: string[] = [];
  FENCED_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCED_RE.exec(input)) !== null) {
    const body = match[1]?.trim();
    if (body) fenced.push(body);
  }

  const candidates = [fenced, [stripFences(input), input], [extractOutermost(input)]]
    .flat()
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        const parsed = load(candidate);
        if (parsed && typeof parsed === 'object') return parsed as T;
      } catch {
        /* tenta o próximo candidato */
      }
    }
  }

  return fallback;
}

/** Igual `parseJsonOrYamlClient`, mas devolve string quando o LLM respondeu texto puro. */
export function parseLooseClient<T = Record<string, unknown>>(
  raw: string | null | undefined
): T | string | null {
  const parsed = parseJsonOrYamlClient<T>(raw, null);
  if (parsed) return parsed;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}
