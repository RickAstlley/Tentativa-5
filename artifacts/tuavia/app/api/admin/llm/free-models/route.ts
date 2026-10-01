import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';
import { NvidiaProvider } from '@/lib/ai/providers/nvidia';
import {
  NVIDIA_MODELS,
  CHAT_MODEL_IDS,
  getModelInfo,
  isValidNvidiaModel,
  type NvidiaModelId,
} from '@/lib/ai/nvidiaModelCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATALOG_TTL_MS = 60 * 60 * 1000; // 1 hora
const PROBE_TIMEOUT_MS = 4000;

interface CatalogEntry {
  id: NvidiaModelId;
  name: string;
  category: string;
  contextWindow: number;
  maxOutputTokens: number;
  multimodal: boolean;
  bestFor: string[];
  free: true;
  status: 'available' | 'unavailable' | 'unconfigured' | 'error';
  latencyMs?: number;
  error?: string;
}

let cache: { at: number; baseUrl: string; entries: CatalogEntry[]; totalRemote: number } | null = null;

/**
 * Busca o catálogo REAL direto da API da NVIDIA.
 * Se falhar, usa o catálogo curado local (lib/ai/nvidiaModelCatalog.ts),
 * que contém apenas IDs validados.
 */
async function fetchRemoteCatalog(
  apiKey: string,
  baseUrl: string
): Promise<{ ids: string[] } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.data)) return null;
    return { ids: json.data.map((m: any) => m.id as string) };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Testa se um modelo responde de fato (não basta existir no catálogo:
 * a NVIDIA retorna 200 no /models mesmo para modelos sem permissão).
 */
async function probeModel(
  modelId: string,
  apiKey: string,
  baseUrl: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    if (res.ok) return { ok: true, latencyMs: latency };
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      latencyMs: latency,
      error: body ? `HTTP ${res.status}: ${body.slice(0, 120)}` : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'Timeout' : err.message,
    };
  }
}

export async function GET(req: NextRequest) {
  ensureServerEnvLoaded();
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const apiKeys = NvidiaProvider.getApiKeys();
  const primaryKey = (apiKeys[0] || cleanEnvValue(process.env.NVIDIA_API_KEY) || '').trim();
  const baseUrl = NvidiaProvider.getBaseUrl();
  const isLocalNIM =
    baseUrl.includes('localhost') ||
    baseUrl.includes('0.0.0.0') ||
    baseUrl.includes('127.0.0.1');

  // NIM local não exige chave
  const effectiveKey = isLocalNIM ? (primaryKey || 'local-nim') : primaryKey;
  const keyConfigured = Boolean(primaryKey) || isLocalNIM;

  // Cache 1h por baseUrl
  if (cache && Date.now() - cache.at < CATALOG_TTL_MS && cache.baseUrl === baseUrl) {
    return NextResponse.json(
      {
        success: true,
        models: cache.entries,
        provider: 'nvidia',
        baseUrl,
        isLocalNIM,
        totalRemote: cache.totalRemote,
        cached: true,
        source: 'nvidia-api',
      },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    );
  }

  let entries: CatalogEntry[] = [];
  let totalRemote = 0;
  let notInAccount: string[] = [];
  let source: 'nvidia-api' | 'curated-fallback' = 'curated-fallback';

  if (keyConfigured) {
    // 1) Catálogo real da NVIDIA
    const remote = await fetchRemoteCatalog(effectiveKey, baseUrl);
    const remoteIds = new Set(remote?.ids || []);

    if (remote) {
      totalRemote = remote.ids.length;
      source = 'nvidia-api';
    }

    // 2) Cruza catálogo curado com o que a NVIDIA realmente retornou.
    //    `remoteIds` pode trazer modelos que não estão no catálogo do TuaVia —
    //    eles são ignorados de propósito: o runtime só sabe falar com os 6 do
    //    catálogo, então anunciar um modelo que nenhuma rota usaria seria
    //    enganoso no painel.
    const candidates = CHAT_MODEL_IDS.filter(
      (id) => isValidNvidiaModel(id) && (isLocalNIM ? true : remoteIds.has(id))
    );

    // Modelos do catálogo que a conta ainda não enxerga. Não é erro: a conta
    // pode não ter acesso a todos os endpoints, e o operador precisa saber
    // exatamente qual está faltando.
    notInAccount = isLocalNIM ? [] : CHAT_MODEL_IDS.filter((id) => !remoteIds.has(id));

    if (candidates.length === 0) {
      // 3) Fallback: todos os curados (permite descobrir via probe)
      entries = CHAT_MODEL_IDS.map((id) => toEntry(id, 'unconfigured'));
    } else {
      // 4) Probe real em paralelo (limitado a 6 para não estourar rate limit)
      const probeTargets = candidates.slice(0, 6);
      const probes = await Promise.all(
        probeTargets.map((id) => probeModel(id, effectiveKey, baseUrl))
      );
      const probeMap = new Map(probeTargets.map((id, i) => [id, probes[i]]));

      entries = candidates.map((id) => {
        const p = probeMap.get(id);
        if (!p) return toEntry(id, 'available');
        return toEntry(id, p.ok ? 'available' : 'unavailable', p.latencyMs, p.error);
      });
    }
  } else {
    entries = CHAT_MODEL_IDS.map((id) => toEntry(id, 'unconfigured'));
  }

  cache = { at: Date.now(), baseUrl, entries, totalRemote };

  return NextResponse.json(
    {
      success: true,
      models: entries,
      provider: 'nvidia',
      baseUrl,
      isLocalNIM,
      totalRemote,
      // Modelos do catálogo que a conta não enxerga. Sem isso a única pista de
      // "minha conta não tem acesso ao Kimi" era a ausência dele na lista.
      notInAccount: keyConfigured ? notInAccount : [],
      cached: false,
      source,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
  );
}

function toEntry(
  id: NvidiaModelId,
  status: CatalogEntry['status'],
  latencyMs?: number,
  error?: string
): CatalogEntry {
  const info = NVIDIA_MODELS[id];
  return {
    id,
    name: info?.name || id.split('/').pop() || id,
    category: info?.category || 'chat',
    contextWindow: info?.contextWindow || 0,
    maxOutputTokens: info?.maxOutputTokens || 0,
    multimodal: info?.multimodal || false,
    bestFor: info?.bestFor || [],
    free: true,
    status,
    latencyMs,
    error,
  };
}
