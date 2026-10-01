'use client';

/**
 * hooks/useCrudSave.ts
 *
 * Salvamento único para os três formulários do painel.
 *
 * `BikeForm`, `ArticleForm` e `RankingForm` repetiam a mesma sequência: montar
 * documento → clonar com JSON → gravar em localStorage → chamar a API → cair
 * em `setDoc` do Firestore client. Duas consequências:
 *
 *   1. a escrita otimista gravava local ANTES do servidor. Se o save falhasse,
 *      o admin via o dado como salvo e só descobria ao recarregar;
 *   2. o fallback `setDoc` nunca disparava — `firestore.rules` exige
 *      `request.auth != null` e o painel não usa Firebase Auth. Era um
 *      caminho morto que mascarava falhas de rede.
 *
 * Aqui a ordem é invertida: o servidor responde, o cliente espelha.
 */

import { useCallback, useRef, useState } from 'react';
import { invalidateTags, type Tag } from '@/hooks/useApi';
import { fetchAdminJson } from '@/lib/ai/clientResponse';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CrudSaveOptions<T> {
  /** Rota do recurso, ex.: '/api/bikes'. */
  endpoint: string;
  /** Tags a invalidar depois de salvar. */
  tags?: Tag[];
  /** Monta o corpo da requisição a partir da entidade do formulário. */
  serialize: (entity: T) => Record<string, unknown>;
  /** Idempotência: PUT em vez de POST quando informado. */
  id?: string;
  /** Validação antes de enviar. Retornar string impede o envio. */
  validate?: (entity: T) => string | null;
  onSaved?: (response: unknown) => void;
  onError?: (message: string) => void;
}

export interface CrudSaveResult<T> {
  status: SaveStatus;
  error: string;
  lastSavedAt: string | null;
  save: (entity: T) => Promise<boolean>;
  reset: () => void;
}

export function useCrudSave<T>(options: CrudSaveOptions<T>): CrudSaveResult<T> {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Impede envio duplicado quando o usuário clica duas vezes.
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const save = useCallback(
    async (entity: T): Promise<boolean> => {
      if (inFlight.current) return false;

      const validationError = options.validate?.(entity);
      if (validationError) {
        setStatus('error');
        setError(validationError);
        options.onError?.(validationError);
        return false;
      }

      inFlight.current = true;
      setStatus('saving');
      setError('');

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const method = options.id ? 'PUT' : 'POST';
      const path = options.id ? `${options.endpoint}/${options.id}` : options.endpoint;

      // Transporte pelo mesmo caminho do resto do painel. Sem retry: salvar é
      // ação explícita, e repetir automaticamente poderia duplicar um registro.
      const response = await fetchAdminJson(path, {
        method,
        body: JSON.stringify(options.serialize(entity)),
        signal: controller.signal,
        timeoutMs: 45_000,
      });

      inFlight.current = false;

      if (response.ok) {
        setStatus('saved');
        setLastSavedAt(new Date().toISOString());
        if (options.tags?.length) invalidateTags(...options.tags);
        options.onSaved?.(response.data);
        return true;
      }

      // `ApiResponseResult.error` e opcional: um 500 com corpo vazio chega aqui.
      const message = response.error || `Falha ao salvar (HTTP ${response.status}).`;
      setStatus('error');
      setError(message);
      options.onError?.(message);
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.id, options.endpoint, options.tags?.join('|')]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError('');
    setLastSavedAt(null);
  }, []);

  return { status, error, lastSavedAt, save, reset };
}
