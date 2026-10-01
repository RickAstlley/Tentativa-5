import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte qualquer objeto ou valor em string JSON com segurança contra referências circulares,
 * elementos DOM, funções, BigInts e propriedades indisponíveis.
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  const seen = new WeakSet();
  
  try {
    return JSON.stringify(
      value,
      (key, val) => {
        if (typeof val === 'bigint') {
          return val.toString();
        }
        if (typeof val === 'function') {
          return undefined;
        }
        if (typeof window !== 'undefined' && val instanceof HTMLElement) {
          return '[HTMLElement]';
        }
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular]';
          }
          seen.add(val);
        }
        return val;
      },
      space
    ) || '{}';
  } catch (err) {
    console.error('[safeJsonStringify] Erro ao serializar objeto:', err);
    return '{}';
  }
}

