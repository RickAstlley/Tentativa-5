/**
 * lib/globalRadarSearch.ts
 *
 * Varredura global do radar: busca por região e tópico, semeando o feed
 * persistido em `data/global_radar_feed.json`.
 *
 * Substitui o módulo homônimo, que nunca foi commitado.
 */

import fs from 'fs';
import path from 'path';
import { WebSearchTool } from '@/lib/ai/tools/webSearch';
import { TECH_REGIONS } from '@/types/globalRadar';
import type { TechRegionKey, TechTopicKey } from '@/types/globalRadar';

export type { TechRegionKey, TechTopicKey };

const FEED_FILE = path.join(process.cwd(), 'data', 'global_radar_feed.json');
const CACHE_TTL_MS = 55 * 60 * 1000;

/** Teto de buscas por varredura. Em hospedagem compartilhada, paralelizar derruba o proxy. */
const MAX_QUERIES_PER_RUN = 8;

const ALL_REGIONS = Object.keys(TECH_REGIONS) as TechRegionKey[];
const ALL_TOPICS: TechTopicKey[] = [
  'batteries',
  'motors',
  'components',
  'launches',
  'safety',
  'market',
  'promos',
];

export interface GlobalRadarResult {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string;
  region: TechRegionKey;
  topic: TechTopicKey;
  createdAt: string;
  starred: boolean;
}

export interface GlobalRadarFeed {
  results: GlobalRadarResult[];
  lastScanAt: string | null;
  statusMessage: string;
  sourcesSearched: number;
}

const EMPTY_FEED: GlobalRadarFeed = {
  results: [],
  lastScanAt: null,
  statusMessage: 'Radar ainda não executado.',
  sourcesSearched: 0,
};

function readFeed(): GlobalRadarFeed {
  try {
    if (!fs.existsSync(FEED_FILE)) return { ...EMPTY_FEED };
    const parsed = JSON.parse(fs.readFileSync(FEED_FILE, 'utf-8')) as Partial<GlobalRadarFeed>;
    return {
      results: Array.isArray(parsed.results) ? parsed.results : [],
      lastScanAt: parsed.lastScanAt ?? null,
      statusMessage: parsed.statusMessage ?? '',
      sourcesSearched: parsed.sourcesSearched ?? 0,
    };
  } catch {
    return { ...EMPTY_FEED };
  }
}

function writeFeed(feed: GlobalRadarFeed): void {
  try {
    fs.mkdirSync(path.dirname(FEED_FILE), { recursive: true });
    const tmp = `${FEED_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(feed, null, 2));
    fs.renameSync(tmp, FEED_FILE);
  } catch (error) {
    console.warn('[globalRadarSearch] Falha ao gravar o feed:', error);
  }
}

function regionLabel(key: TechRegionKey): string {
  return TECH_REGIONS[key]?.label ?? String(key);
}

/**
 * Termo de busca. Reaproveita os templates que já existem em
 * `TECH_REGIONS[region].searchQueries[topic]` — nenhuma consulta nova é
 * inventada aqui, e o texto continua no idioma da região.
 */
function buildQuery(region: TechRegionKey, topic: TechTopicKey, customQuery: string): string {
  if (customQuery.trim()) return customQuery.trim();

  const baseRegion: TechRegionKey = region === 'all' ? ALL_REGIONS[0]! : region;
  const templates = TECH_REGIONS[baseRegion]?.searchQueries?.[topic] ?? [];
  if (templates.length > 0) return templates[0]!;

  return region === 'all'
    ? 'e-bike tecnologia bicicleta elétrica'
    : `${regionLabel(region)} e-bike tecnologia bicicleta elétrica`;
}

function hashLink(link: string): string {
  let hash = 0;
  for (let i = 0; i < link.length; i += 1) {
    hash = (hash * 31 + link.charCodeAt(i)) | 0;
  }
  return `gr_${Math.abs(hash).toString(36)}`;
}

export interface ExecuteGlobalRadarOptions {
  region?: TechRegionKey;
  topic?: TechTopicKey;
  customQuery?: string;
  limit?: number;
  /** Quando true (padrão), persiste o resultado no feed. */
  saveToRadarStore?: boolean;
  onProgress?: (progress: number, stage: string) => void | Promise<void>;
}

export interface GlobalRadarResultSummary {
  results: GlobalRadarResult[];
  totalFound: number;
  sourcesSearched: number;
  durationMs: number;
  queries: string[];
  errors: string[];
}

/**
 * Executa a varredura. Sequencial por design: disparar várias buscas ao mesmo
 * tempo em hospedagem compartilhada derruba o proxy e queima cota.
 */
export async function executeGlobalRadarSearch(
  options: ExecuteGlobalRadarOptions = {}
): Promise<GlobalRadarResultSummary> {
  const startedAt = Date.now();
  const region = options.region ?? 'all';
  const topic = options.topic ?? 'all';
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 20);

  const regions: TechRegionKey[] = region === 'all' ? ALL_REGIONS : [region];
  const topics: TechTopicKey[] = topic === 'all' ? ALL_TOPICS : [topic];

  const pairs: Array<[TechRegionKey, TechTopicKey]> = [];
  for (const r of regions) {
    for (const t of topics) {
      if (pairs.length >= MAX_QUERIES_PER_RUN) break;
      pairs.push([r, t]);
    }
    if (pairs.length >= MAX_QUERIES_PER_RUN) break;
  }

  const results: GlobalRadarResult[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let sourcesSearched = 0;

  for (let index = 0; index < pairs.length; index += 1) {
    const [r, t] = pairs[index]!;

    await options.onProgress?.(
      Math.round((index / pairs.length) * 85),
      `Buscando em ${regionLabel(r)} · tópico ${t} (${index + 1}/${pairs.length})`
    );

    const query = buildQuery(r, t, options.customQuery ?? '');
    const response = await WebSearchTool.search({ query, limit });

    if (!response.success) {
      if (response.error) errors.push(`${regionLabel(r)}/${t}: ${response.error}`);
      continue;
    }
    sourcesSearched += 1;

    for (const item of response.organic) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      results.push({
        id: hashLink(item.link),
        title: item.title,
        url: item.link,
        source: item.domain || 'web',
        snippet: item.snippet,
        region: r,
        topic: t,
        createdAt: new Date().toISOString(),
        starred: false,
      });
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }

  if (options.saveToRadarStore !== false) {
    const feed = readFeed();
    const merged = new Map(feed.results.map((item) => [item.url, item]));
    for (const item of results) {
      if (!merged.has(item.url)) merged.set(item.url, item);
    }
    // Mantém os itens starred mesmo que a varredura atual não os tenha trazido.
    for (const item of feed.results) {
      if (item.starred) merged.set(item.url, item);
    }
    writeFeed({
      results: [...merged.values()].slice(0, 300),
      lastScanAt: new Date().toISOString(),
      statusMessage:
        errors.length > 0
          ? `${results.length} itens, ${errors.length} busca(s) falharam.`
          : `${results.length} itens encontrados.`,
      sourcesSearched,
    });
  }

  await options.onProgress?.(100, `${results.length} item(ns) em ${sourcesSearched} fonte(s).`);

  return {
    results,
    totalFound: results.length,
    sourcesSearched,
    durationMs: Date.now() - startedAt,
    queries: pairs.map(([r, t]) => buildQuery(r, t, options.customQuery ?? '')),
    errors,
  };
}

/** Feed atual sem disparar varredura. */
export function getGlobalRadarFeed(): GlobalRadarFeed {
  return readFeed();
}

/**
 * Devolve o feed se ainda estiver fresco; senão dispara a varredura.
 * É o que a rota usa para responder rápido sem varrer a cada reload.
 */
export async function getOrTriggerHourlyGlobalRadar(
  options: ExecuteGlobalRadarOptions & { /** Ignora o cache e varre mesmo com feed fresco. */ force?: boolean } = {}
): Promise<{ feed: GlobalRadarFeed; triggered: boolean }> {
  const { force = false, ...searchOptions } = options;
  const feed = readFeed();
  const fresh =
    feed.lastScanAt !== null && Date.now() - new Date(feed.lastScanAt).getTime() < CACHE_TTL_MS;

  if (fresh && !force) return { feed, triggered: false };

  await executeGlobalRadarSearch(searchOptions);
  return { feed: readFeed(), triggered: true };
}

export function toggleStarGlobalRadarItem(id: string): GlobalRadarResult | null {
  const feed = readFeed();
  const target = feed.results.find((item) => item.id === id);
  if (!target) return null;
  target.starred = !target.starred;
  writeFeed(feed);
  return target;
}

export function deleteGlobalRadarItem(id: string): boolean {
  const feed = readFeed();
  const before = feed.results.length;
  feed.results = feed.results.filter((item) => item.id !== id);
  if (feed.results.length === before) return false;
  writeFeed(feed);
  return true;
}
