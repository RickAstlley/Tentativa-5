/**
 * TuaVia — Leitor Seguro de Respostas de API e Requisições Administrativas
 *
 * MOVIDO de `lib/ai/clientResponse.ts` na remoção do subsistema de LLM.
 * Este módulo nunca teve dependência de IA: o único import é `@/lib/adminAuth`.
 * Ele parseia respostas de API, transforma página de erro HTML do proxy (504/502
 * da Hostinger) em erro estruturado em pt-BR, e anexa a sessão de admin.
 *
 * Ficou em `lib/ai/` por conveniência de proximidade com o resto do pipeline, mas
 * 27 arquivos o consomem — a maioria nada a ver com IA (BikeForm, ArticleForm,
 * ImageUploadField, FirebaseStatusWidget, hooks/useApi). Apagar `lib/ai/` sem
 * mover este arquivo antes quebraria 27 arquivos por motivo errado.
 *
 * Previne falhas de parsing JSON causadas por páginas de erro HTML de proxy (como
 * 504 Gateway Timeout ou 502 da Hostinger), transforma respostas com erro em
 * objetos estruturados em português e anexa credenciais de autenticação
 * automaticamente.
 */

import { getStoredAdminSession, AUTHORIZED_ADMIN_EMAIL } from '@/lib/adminAuth';

export interface AdminApiError {
  message: string;
  code: string;
  status: number;
  retryable: boolean;
  requestId?: string;
  details?: string;
}

export interface ApiResponseResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errorCode?: string;
  details?: string;
  retryable?: boolean;
  isHtml?: boolean;
  requestId?: string;
  jobId?: string;
  rawSnippet?: string;
}

/**
 * Lê o corpo de uma resposta HTTP com total segurança contra respostas HTML e erros de proxy/timeout.
 * 
 * Regras estritas:
 * 1. Consome o stream de texto (res.text()) uma única vez.
 * 2. Verifica se a resposta é HTML (502, 503, 504, tags doctype/html/head/body).
 * 3. Faz o parse seguro do JSON e nunca chama res.json() após leitura.
 * 4. Normaliza mensagens amigáveis em português e códigos de erro tipados.
 */
export async function readApiResponse<T = any>(res: Response): Promise<ApiResponseResult<T>> {
  const status = res.status;
  let rawText = '';

  try {
    rawText = await res.text();
  } catch (err: any) {
    return {
      ok: false,
      status,
      error: `Não foi possível ler a resposta do servidor: ${err.message}`,
      errorCode: 'READ_BODY_FAILED',
      retryable: true,
    };
  }

  const trimmed = rawText.trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body') ||
    trimmed.includes('<title>504') ||
    trimmed.includes('<title>502') ||
    trimmed.includes('<title>503') ||
    trimmed.includes('Gateway Timeout') ||
    trimmed.includes('Bad Gateway');

  // 1. Trata respostas HTML (Erros de infraestrutura / proxy / timeout)
  if (isHtml) {
    let friendlyMessage = 'O servidor retornou uma página de erro HTML inesperada.';
    let errorCode = 'SERVER_HTML_ERROR';
    let retryable = true;

    if (status === 504 || trimmed.includes('504') || trimmed.includes('Gateway Timeout')) {
      friendlyMessage =
        'A Hostinger (ou servidor upstream) encerrou a requisição antes da conclusão (Timeout 504). O conteúdo não foi perdido; você pode tentar novamente ou utilizar a fila em segundo plano.';
      errorCode = 'UPSTREAM_TIMEOUT';
      retryable = true;
    } else if (status === 502 || trimmed.includes('502') || trimmed.includes('Bad Gateway')) {
      friendlyMessage = 'Falha temporária de gateway no servidor (502 Bad Gateway). Tente novamente em instantes.';
      errorCode = 'BAD_GATEWAY';
      retryable = true;
    } else if (status === 503 || trimmed.includes('503') || trimmed.includes('Service Unavailable')) {
      friendlyMessage = 'O serviço está temporariamente indisponível (503). Tente novamente em instantes.';
      errorCode = 'SERVICE_UNAVAILABLE';
      retryable = true;
    } else if (status === 401 || status === 403) {
      friendlyMessage = 'Sessão administrativa expirada ou não autorizada. Faça login novamente no painel.';
      errorCode = 'UNAUTHORIZED';
      retryable = false;
    } else if (status === 429) {
      friendlyMessage = 'Limite temporário de requisições atingido. Aguarde alguns instantes antes de tentar novamente.';
      errorCode = 'RATE_LIMIT';
      retryable = true;
    } else if (status >= 500) {
      friendlyMessage = `Erro interno no servidor (${status}). Tente novamente em instantes.`;
      errorCode = 'INTERNAL_ERROR';
      retryable = true;
    }

    return {
      ok: false,
      status,
      isHtml: true,
      error: friendlyMessage,
      errorCode,
      retryable,
      rawSnippet: trimmed.slice(0, 200),
    };
  }

  // 2. Tenta fazer o parse de JSON
  let parsedJson: any = null;
  if (trimmed) {
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      // Se não for JSON nem HTML, pode ser uma resposta de texto puro com status OK
      if (res.ok) {
        return {
          ok: true,
          status,
          data: trimmed as unknown as T,
        };
      }
      return {
        ok: false,
        status,
        error: `Resposta inválida do servidor (${status}): ${trimmed.slice(0, 150)}`,
        errorCode: 'INVALID_JSON',
        retryable: true,
        rawSnippet: trimmed.slice(0, 200),
      };
    }
  }

  // 3. Resposta JSON estruturada com erro HTTP (status >= 400)
  if (!res.ok) {
    const errorMsg =
      parsedJson?.error ||
      parsedJson?.details ||
      parsedJson?.message ||
      `Erro na requisição (${status})`;

    let retryable = parsedJson?.retryable;
    if (retryable === undefined) {
      retryable = status === 504 || status === 502 || status === 503 || status === 429 || status >= 500;
    }

    return {
      ok: false,
      status,
      data: parsedJson as T,
      error: errorMsg,
      errorCode: parsedJson?.errorCode || `HTTP_${status}`,
      details: parsedJson?.details,
      retryable,
      requestId: parsedJson?.requestId,
      jobId: parsedJson?.jobId,
    };
  }

  // 4. Se a API retornou HTTP 200 mas com flag explícita { success: false }
  if (parsedJson && parsedJson.success === false) {
    return {
      ok: false,
      status,
      data: parsedJson as T,
      error: parsedJson.error || parsedJson.message || 'Falha ao processar operação.',
      errorCode: parsedJson.errorCode || 'OPERATION_FAILED',
      details: parsedJson.details,
      retryable: parsedJson.retryable ?? true,
      requestId: parsedJson.requestId,
      jobId: parsedJson.jobId,
    };
  }

  return {
    ok: true,
    status,
    data: parsedJson as T,
    requestId: parsedJson?.requestId,
    jobId: parsedJson?.jobId,
  };
}

/**
 * Obtém os cabeçalhos de autenticação administrativa para chamadas fetch.
 */
export function getAdminAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const session = getStoredAdminSession();

  if (session && session.email && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-admin-passcode'] = session.token;
    headers['x-admin-email'] = session.email;
  }

  return headers;
}

/**
 * Executa fetch anexando automaticamente os cabeçalhos de autenticação administrativa.
 */
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const adminHeaders = getAdminAuthHeaders();
  const combinedHeaders = new Headers(init?.headers || {});

  for (const [key, val] of Object.entries(adminHeaders)) {
    if (!combinedHeaders.has(key)) {
      combinedHeaders.set(key, val);
    }
  }

  return fetch(url, {
    ...init,
    headers: combinedHeaders,
  });
}

/** Limite máximo padrão de uma chamada administrativa (300 segundos / 5 minutos), permitindo operações de IA em múltiplos estágios e busca de mercado sem timeout prematuro. */
export const ADMIN_REQUEST_TIMEOUT_MS = 300000;

export interface FetchAdminOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Executa requisição administrativa e faz a leitura segura da resposta, prevenindo qualquer quebra por 504/HTML.
 * O AbortController permanece ativo durante `res.text()`, evitando que o painel fique preso caso o proxy ou o upstream pare de responder.
 */
export async function fetchAdminJson<T = any>(
  url: string,
  init?: FetchAdminOptions
): Promise<ApiResponseResult<T>> {
  const effectiveTimeout = init?.timeoutMs ?? ADMIN_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  try {
    const { timeoutMs: _ignored, ...fetchInit } = init || {};
    const res = await adminFetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return await readApiResponse<T>(res);
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      status: isAbort ? 408 : 0,
      error: isAbort
        ? `A requisição demorou além do limite de segurança (${Math.round(effectiveTimeout / 1000)}s). Tente novamente ou verifique se a tarefa foi processada em segundo plano.`
        : `Erro de conexão com o servidor: ${err?.message || String(err)}`,
      errorCode: isAbort ? 'CLIENT_TIMEOUT' : 'NETWORK_ERROR',
      retryable: true,
    };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
}
