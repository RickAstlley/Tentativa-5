/**
 * lib/ai/tools/webSearch.ts
 *
 * Busca web server-side para fundamentar as extrações de IA. Substitui
 * `@/src/ai/tools/WebSearchTool`, que não existia.
 *
 * Providers, em ordem de preferência:
 *   1. Serper.dev          (SERPER_API_KEY)
 *   2. Google Custom Search (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID)
 *
 * Sem nenhuma chave configurada, devolve vazio. Nunca lança: quem chama trata
 * ausência de resultado como "sem evidência externa", e o auditor marca os
 * campos como NAO_CONFIRMADA — que é o comportamento correto.
 */

import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import type { PriceCandidate, WebSearchResult } from '@/lib/ai/types';

export type SearchType = 'search' | 'news' | 'shopping';

export interface WebSearchResponse {
  success: boolean;
  results: WebSearchResult[];
  organic: WebSearchResult[];
  provider: string;
  query: string;
  totalFound: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isUsable(result: WebSearchResult): boolean {
  return Boolean(result.title && result.link && result.snippet);
}

/** Converte "1.234,56" / "1234.56" / "1234" em número. */
function parseBrazilianNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '');
  if (!cleaned) return NaN;
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ''));
  return Number(cleaned);
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSerper(
  query: string,
  limit: number
): Promise<WebSearchResponse | null> {
  const apiKey = cleanEnvValue(process.env.SERPER_API_KEY || '');
  if (!apiKey) return null;

  const payload = await fetchJson('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: Math.min(limit, 20), gl: 'br', hl: 'pt-br' }),
  });

  const organic: WebSearchResult[] = [
    ...(payload?.organic ?? []),
    ...(payload?.news ?? []),
    ...(payload?.shopping ?? []),
  ]
    .map((item: any) => ({
      title: String(item.title ?? ''),
      link: String(item.link ?? item.url ?? ''),
      snippet: String(item.snippet ?? item.description ?? ''),
      domain: domainOf(String(item.link ?? item.url ?? '')),
      source: 'serper' as const,
    }))
    .filter(isUsable);

  return {
    success: true,
    results: organic,
    organic,
    provider: 'serper',
    query,
    totalFound: organic.length,
  };
}

async function searchGoogleCse(query: string, limit: number): Promise<WebSearchResponse | null> {
  const apiKey = cleanEnvValue(process.env.GOOGLE_SEARCH_API_KEY || '');
  const engineId = cleanEnvValue(process.env.GOOGLE_SEARCH_ENGINE_ID || '');
  if (!apiKey || !engineId) return null;

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', engineId);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(limit, 10)));

  const payload = await fetchJson(url.toString(), { method: 'GET' });
  const organic: WebSearchResult[] = (payload?.items ?? [])
    .map((item: any) => ({
      title: String(item.title ?? ''),
      link: String(item.link ?? ''),
      snippet: String(item.snippet ?? ''),
      domain: domainOf(String(item.link ?? '')),
      source: 'google-cse' as const,
    }))
    .filter(isUsable);

  return {
    success: true,
    results: organic,
    organic,
    provider: 'google-cse',
    query,
    totalFound: organic.length,
  };
}

class WebSearchToolClass {
  /**
   * Busca na web. Tenta os providers em ordem e devolve o primeiro que
   * responder. Sem credencial, devolve resposta vazia com `success: false`.
   */
  static async search(options: {
    query: string;
    type?: SearchType;
    limit?: number;
    country?: string;
    locale?: string;
  }): Promise<WebSearchResponse> {
    ensureServerEnvLoaded();
    const query = String(options.query ?? '').trim();
    const limit = Math.min(Math.max(options.limit ?? 6, 1), 20);

    if (!query) {
      return {
        success: false,
        results: [],
        organic: [],
        provider: 'none',
        query: '',
        totalFound: 0,
        error: 'Query vazia.',
      };
    }

    const providers: Array<() => Promise<WebSearchResponse | null>> = [
      () => searchSerper(query, limit),
      () => searchGoogleCse(query, limit),
    ];

    const errors: string[] = [];
    for (const run of providers) {
      try {
        const response = await run();
        if (response) return response;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      success: false,
      results: [],
      organic: [],
      provider: 'none',
      query,
      totalFound: 0,
      error:
        errors.length > 0
          ? `Nenhum provider respondeu: ${errors.join(' | ')}`
          : 'Nenhuma chave de busca configurada (SERPER_API_KEY ou GOOGLE_SEARCH_API_KEY).',
    };
  }

  /** Achata qualquer forma de resposta (a diferente, `organic` ou array) em uma lista. */
  static normalize(input: unknown): WebSearchResult[] {
    if (Array.isArray(input)) return input.filter(isUsable) as WebSearchResult[];
    if (input && typeof input === 'object') {
      const response = input as Partial<WebSearchResponse>;
      const list = response.results ?? response.organic ?? [];
      return Array.isArray(list) ? list.filter(isUsable) : [];
    }
    return [];
  }

  /** Formata resultados como contexto textual para o prompt. */
  static formatForPrompt(input: unknown, limit = 8): string {
    const results = WebSearchToolClass.normalize(input).slice(0, limit);
    if (results.length === 0) return '(nenhum resultado web disponível)';
    return results
      .map(
        (result, index) =>
          `[resultado ${index + 1}] ${result.title} — ${result.domain}\n${result.snippet}`
      )
      .join('\n\n');
  }

  /** Extrai candidatos de preço a partir dos snippets de busca. */
  static extractPriceCandidates(input: unknown): PriceCandidate[] {
    const results = WebSearchToolClass.normalize(input);
    const candidates: PriceCandidate[] = [];
    const seen = new Set<string>();
    const pricePattern = /R\$\s*([\d.]+(?:,\d{2})?)/gi;

    for (const result of results) {
      const haystack = `${result.title} ${result.snippet}`;
      pricePattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pricePattern.exec(haystack)) !== null) {
        const price = parseBrazilianNumber(match[1]);
        // Faixa plausível para e-bike no Brasil; descarta "R$ 0,00" e ruído.
        if (!Number.isFinite(price) || price < 500 || price > 250_000) continue;

        const key = `${result.domain}|${price}`;
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          store: result.domain || result.title.slice(0, 40),
          price,
          url: result.link,
          rawText: match[0],
        });
      }
    }

    return candidates.sort((a, b) => a.price - b.price);
  }

  /** Formata candidatos de preço para o prompt, exigindo citação da fonte. */
  static formatPriceCandidatesForPrompt(candidates: PriceCandidate[], limit = 8): string {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return '(nenhum preço encontrado na web)';
    }
    return candidates
      .slice(0, limit)
      .map(
        (candidate) =>
          `- ${candidate.store}: R$ ${candidate.price.toFixed(2)} (fonte: ${candidate.url ?? candidate.rawText})`
      )
      .join('\n');
  }
}

export const WebSearchTool = WebSearchToolClass;
