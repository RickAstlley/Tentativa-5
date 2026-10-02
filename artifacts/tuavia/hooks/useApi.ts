'use client';

/**
 * hooks/useApi.ts
 *
 * CAMADA DE ESTADO sobre o transporte administrativo.
 *
 * Isto NÃO é um terceiro cliente de fetch. O transporte é `fetchAdminJson` de
 * `lib/ai/clientResponse.ts`, que já tem 26 consumidores, header de admin,
 * leitura tolerante a 504/HTML e timeout. Este hook acrescenta só o que falta
 * para a interface: re-execução automática por tag, cancelamento, e `mutate`.
 *
 * Antes existiam três camadas concorrentes:
 *   - `fetchAdminJson` (transporte, 26 consumidores) — manda
 *   - `adminFetch` (só header, 4 consumidores) — usado direto
 *   - `apiFetch` (aqui, transporte próprio, ZERO consumidores)
 *
 * O `apiFetch` foi removido. Reimplementar o transporte era duplicação pura.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminJson, type ApiResponseResult } from '@/lib/apiResponse';

export type Tag = string;

/** Registros de tag: salvar um recurso invalida tudo que o exibe. */
const subscribers = new Map<Tag, Set<() => void>>();

export function invalidateTags(...tags: Tag[]): void {
  for (const tag of tags) {
    subscribers.get(tag)?.forEach((notify) => notify());
  }
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  refetch: () => void;
  mutate: (data: T) => void;
}

export interface UseApiOptions {
  /** Não busca enquanto verdadeiro. */
  skip?: boolean;
  timeoutMs?: number;
}

/**
 * Leitura com re-execução automática quando qualquer tag lida for invalidada.
 *
 *   const { data, loading, error, refetch } = useApi<Job[]>('/api/admin/llm/jobs', ['jobs']);
 */
export function useApi<T = unknown>(
  path: string | null,
  tags: Tag[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);
  const mutate = useCallback((next: T) => setData(next), []);

  // Assina as tags pedidas. A chave é o conjunto ordenado, para não reassinar a
  // cada render quando o array de tags é uma literal nova.
  const tagKey = tags.join('|');
  useEffect(() => {
    const list = tagKey ? tagKey.split('|') : [];
    const cleanups = list.map((tag) => {
      const set = subscribers.get(tag) ?? new Set<() => void>();
      set.add(refetch);
      subscribers.set(tag, set);
      return () => {
        set.delete(refetch);
        if (set.size === 0) subscribers.delete(tag);
      };
    });
    return () => cleanups.forEach((dispose) => dispose());
  }, [tagKey, refetch]);

  useEffect(() => {
    if (!path || options.skip) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminJson<T>(path, { timeoutMs: options.timeoutMs })
      .then((response: ApiResponseResult<T>) => {
        if (cancelled) return;
        if (response.ok) {
          setData(response.data ?? null);
        } else {
          setError(response.error || 'Falha ao carregar os dados.');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, options.skip, options.timeoutMs]);

  return { data, loading, error, refetch, mutate };
}

/** Tags dos recursos do painel, para não depender de literais repetidos. */
export const ADMIN_TAGS = {
  jobs: 'jobs',
  bikes: 'bikes',
  articles: 'articles',
  rankings: 'rankings',
  reviews: 'reviews',
  radar: 'radar',
  telemetry: 'telemetry',
  settings: 'settings',
} as const;
