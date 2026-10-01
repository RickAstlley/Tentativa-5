import { safeJsonStringify } from '@/lib/utils';
import { ExtractedImageFile } from '@/lib/admin/fileIngestion';

export interface TaggedExtractedSpec {
  blocoIndex: number;
  blocoNome: string;
  campo: string;
  valor: string;
  tag: string;
  evidencia?: string;
  status: 'CONFIRMADO' | 'NAO_INFORMADO' | 'CALCULADO' | 'FONTE_COMERCIAL';
  confidence: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_CONFIRMADA';
}

export interface ExtractionCacheData {
  cacheId: string;
  fileHash: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractedAt: string;
  updatedAt: string;
  mode: 'ebike' | 'article' | 'ranking';
  detectedKind?: 'ebike' | 'article' | 'ranking';
  wordCount?: number;
  status: 'ready' | 'extracted_paused' | 'step_1_completed' | 'step_2_completed' | 'step_3_completed' | 'completed';
  rawText: string;
  structuredYaml: string;
  taggedSpecs?: TaggedExtractedSpec[];
  isAllocatedToForm?: boolean;
  identity?: {
    marca?: string;
    modelo?: string;
    versao?: string;
    ano?: number;
    categoria?: string;
    potenciaW?: number;
    autonomiaKm?: number;
    capacidadeBateriaWh?: number;
    pesoKg?: number;
    tempoCargaHoras?: number;
    menorPreco?: number;
    maiorPreco?: number;
    precoDe?: number;
    lojasDetectadas?: string[];
    [key: string]: any;
  };
  specSections?: any[];
  editorial?: any;
  priceHistoryData?: {
    hasPriceHistory: boolean;
    historicoPrecos: any[];
    ofertas: any[];
    message?: string;
  };
  seoAndMarket?: any;
  images?: ExtractedImageFile[];
  binaryInfo?: any;
  completedSteps: number[]; // [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]
  currentStageLabel?: string;
}

const STORAGE_PREFIX = 'tuavia_extraction_cache_v3';
const ACTIVE_CACHE_KEY = 'tuavia_active_extraction_cache_id';

/**
 * Gera um hash simples e rápido para identificar o arquivo e seu conteúdo
 */
export function generateFileContentHash(fileName: string, rawText: string, sizeBytes: number): string {
  let hash = 0;
  const str = `${fileName}_${sizeBytes}_${rawText.slice(0, 1000)}_${rawText.slice(-1000)}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Converte para inteiro de 32 bits
  }
  return `h_${Math.abs(hash).toString(36)}_${sizeBytes}`;
}

/**
 * Salva ou atualiza uma extração no cache local do navegador (localStorage)
 */
export function saveExtractionCache(cache: ExtractionCacheData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Sanitiza imagens para não estourar megabytes de base64 no localStorage
    const sanitizedImages = (cache.images || []).map((img) => {
      const uri = img.dataUri || '';
      if (uri && uri.length > 5000) {
        return {
          ...img,
          dataUri: uri.startsWith('data:') ? uri.slice(0, 100) + '...[truncated]' : uri,
        };
      }
      return img;
    });

    const updated: ExtractionCacheData = {
      ...cache,
      images: sanitizedImages,
      updatedAt: new Date().toISOString(),
    };

    const storageKey = `${STORAGE_PREFIX}_${cache.cacheId}`;
    const stringified = safeJsonStringify(updated);

    try {
      localStorage.setItem(storageKey, stringified);
      localStorage.setItem(ACTIVE_CACHE_KEY, cache.cacheId);
    } catch (quotaErr) {
      console.warn('[extractionCache] Quota de localStorage cheia. Compactando caches antigos...', quotaErr);

      // Remove caches mais antigos do localStorage
      const indexKey = `${STORAGE_PREFIX}_index`;
      const rawIndex = localStorage.getItem(indexKey);
      let indexList: string[] = rawIndex ? JSON.parse(rawIndex) : [];

      while (indexList.length > 2) {
        const oldestId = indexList.pop();
        if (oldestId) {
          try {
            localStorage.removeItem(`${STORAGE_PREFIX}_${oldestId}`);
          } catch {}
        }
      }

      // Salva versão otimizada
      const lightweight: ExtractionCacheData = {
        ...updated,
        rawText: updated.rawText ? updated.rawText.slice(0, 12000) : '',
        images: [],
      };

      localStorage.setItem(storageKey, safeJsonStringify(lightweight));
      localStorage.setItem(ACTIVE_CACHE_KEY, cache.cacheId);
      indexList = [cache.cacheId, ...indexList.filter((id) => id !== cache.cacheId)].slice(0, 6);
      localStorage.setItem(indexKey, safeJsonStringify(indexList));
      return true;
    }

    // Mantém um índice dos últimos 8 caches salvos localmente
    const indexKey = `${STORAGE_PREFIX}_index`;
    const rawIndex = localStorage.getItem(indexKey);
    let indexList: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    if (!indexList.includes(cache.cacheId)) {
      indexList = [cache.cacheId, ...indexList].slice(0, 8);
      localStorage.setItem(indexKey, safeJsonStringify(indexList));
    }
    return true;
  } catch (err) {
    console.error('[extractionCache] Erro ao salvar cache de extração:', err);
    return false;
  }
}

/**
 * Recupera um cache de extração específico pelo ID
 */
export function getExtractionCache(cacheId: string): ExtractionCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}_${cacheId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[extractionCache] Erro ao carregar cache de extração:', err);
    return null;
  }
}

/**
 * Retorna todos os caches de extração armazenados localmente
 */
export function getAllExtractionCaches(): ExtractionCacheData[] {
  if (typeof window === 'undefined') return [];
  try {
    const indexKey = `${STORAGE_PREFIX}_index`;
    const rawIndex = localStorage.getItem(indexKey);
    const indexList: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    const caches: ExtractionCacheData[] = [];

    for (const cacheId of indexList) {
      const cache = getExtractionCache(cacheId);
      if (cache) {
        caches.push(cache);
      }
    }
    return caches;
  } catch (err) {
    console.error('[extractionCache] Erro ao listar caches:', err);
    return [];
  }
}

/**
 * Recupera o último cache de extração ativo
 */
export function getActiveExtractionCache(mode?: 'ebike' | 'article' | 'ranking'): ExtractionCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const activeId = localStorage.getItem(ACTIVE_CACHE_KEY);
    if (!activeId) return null;
    const cache = getExtractionCache(activeId);
    if (!cache) return null;
    if (mode && cache.mode !== mode) return null;
    return cache;
  } catch {
    return null;
  }
}

/**
 * Define o cache ativo atual
 */
export function setActiveExtractionCacheId(cacheId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_CACHE_KEY, cacheId);
  } catch (err) {
    console.error('[extractionCache] Erro ao setar cache ativo:', err);
  }
}

/**
 * Busca se já existe um cache salvo correspondente a um determinado arquivo (por hash)
 */
export function findExtractionCacheByHash(fileHash: string): ExtractionCacheData | null {
  if (typeof window === 'undefined') return null;
  try {
    const indexKey = `${STORAGE_PREFIX}_index`;
    const rawIndex = localStorage.getItem(indexKey);
    const indexList: string[] = rawIndex ? JSON.parse(rawIndex) : [];

    for (const cacheId of indexList) {
      const cache = getExtractionCache(cacheId);
      if (cache && cache.fileHash === fileHash) {
        return cache;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove um cache de extração específico
 */
export function deleteExtractionCache(cacheId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}_${cacheId}`);
    const activeId = localStorage.getItem(ACTIVE_CACHE_KEY);
    if (activeId === cacheId) {
      localStorage.removeItem(ACTIVE_CACHE_KEY);
    }
    const indexKey = `${STORAGE_PREFIX}_index`;
    const rawIndex = localStorage.getItem(indexKey);
    if (rawIndex) {
      const indexList: string[] = JSON.parse(rawIndex);
      const updated = indexList.filter((id) => id !== cacheId);
      localStorage.setItem(indexKey, safeJsonStringify(updated));
    }
  } catch (err) {
    console.error('[extractionCache] Erro ao excluir cache:', err);
  }
}

/**
 * Limpa todos os caches de extração
 */
export function clearAllExtractionCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const indexKey = `${STORAGE_PREFIX}_index`;
    const rawIndex = localStorage.getItem(indexKey);
    const indexList: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    for (const cacheId of indexList) {
      localStorage.removeItem(`${STORAGE_PREFIX}_${cacheId}`);
    }
    localStorage.removeItem(indexKey);
    localStorage.removeItem(ACTIVE_CACHE_KEY);
  } catch (err) {
    console.error('[extractionCache] Erro ao limpar caches:', err);
  }
}

/**
 * Calcula a estimativa de uso de armazenamento do cache local
 */
export function getStorageUsageEstimate(): { count: number; totalBytes: number; formattedSize: string } {
  if (typeof window === 'undefined') return { count: 0, totalBytes: 0, formattedSize: '0 KB' };
  try {
    const all = getAllExtractionCaches();
    let totalBytes = 0;
    for (const item of all) {
      const storageKey = `${STORAGE_PREFIX}_${item.cacheId}`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        totalBytes += raw.length * 2; // UTF-16 in JS string
      } else {
        totalBytes += item.fileSizeBytes || 1024;
      }
    }
    let formattedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
    if (totalBytes > 1024 * 1024) {
      formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return { count: all.length, totalBytes, formattedSize };
  } catch {
    return { count: 0, totalBytes: 0, formattedSize: '0 KB' };
  }
}

/**
 * Utilitário para acionar o download de um arquivo gerado no navegador do usuário
 */
export function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converte as especificações técnicas da tabela para formato CSV compatível com Excel e Google Sheets
 */
/**
 * Converte a tabela técnica em formato CSV para download e auditoria
 */
export function exportSpecsToCsv(specSectionsOrCache: any[] | ExtractionCacheData | any, identityParam?: any): string {
  const isCache = specSectionsOrCache && !Array.isArray(specSectionsOrCache) && typeof specSectionsOrCache === 'object';
  const specSections = isCache ? specSectionsOrCache.specSections : specSectionsOrCache;
  const identity = isCache ? specSectionsOrCache.identity : identityParam;

  const lines: string[] = [];
  lines.push('Marca;Modelo;Seção;Item / Especificação;Valor;Status de Confiança;Fonte Oficial / Origem');

  const bikeMarca = identity?.marca || '';
  const bikeModelo = identity?.modelo || '';

  if (Array.isArray(specSections) && specSections.length > 0) {
    for (const section of specSections) {
      const secTitle = section.title || 'Seção Sem Título';
      const items = Array.isArray(section.items) ? section.items : [];
      for (const item of items) {
        const label = (item.label || '').replace(/;/g, ',');
        const val = (item.value || '').replace(/;/g, ',');
        const conf = (item.confidence || item.status || 'NAO_INFORMADO').replace(/;/g, ',');
        const src = (item.source || '').replace(/;/g, ',');

        lines.push(`"${bikeMarca}";"${bikeModelo}";"${secTitle}";"${label}";"${val}";"${conf}";"${src}"`);
      }
    }
  } else if (identity) {
    lines.push(`"${bikeMarca}";"${bikeModelo}";"Identidade";"Potência (W)";"${identity.potenciaW || ''}";"CONFIRMADO";"Extração Fase 1"`);
    lines.push(`"${bikeMarca}";"${bikeModelo}";"Identidade";"Autonomia (km)";"${identity.autonomiaKm || ''}";"CONFIRMADO";"Extração Fase 1"`);
    lines.push(`"${bikeMarca}";"${bikeModelo}";"Identidade";"Bateria (Wh)";"${identity.capacidadeBateriaWh || ''}";"CONFIRMADO";"Extração Fase 1"`);
    lines.push(`"${bikeMarca}";"${bikeModelo}";"Identidade";"Peso (kg)";"${identity.pesoKg || ''}";"CONFIRMADO";"Extração Fase 1"`);
  }

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Converte toda a estrutura técnica para JSON formatado
 */
export function exportSpecsToJson(specSectionsOrCache: any[] | ExtractionCacheData | any, identityParam?: any, editorialParam?: any, seoAndMarketParam?: any): string {
  const isCache = specSectionsOrCache && !Array.isArray(specSectionsOrCache) && typeof specSectionsOrCache === 'object';
  const specSections = isCache ? specSectionsOrCache.specSections : specSectionsOrCache;
  const identity = isCache ? specSectionsOrCache.identity : identityParam;
  const editorial = isCache ? specSectionsOrCache.editorial : editorialParam;
  const seoAndMarket = isCache ? specSectionsOrCache.marketAndSeo || specSectionsOrCache.seoReport : seoAndMarketParam;

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    engine: 'TuaVia AI Specification Engine 2026',
    identity: identity || {},
    specSections: specSections || [],
    editorial: editorial || {},
    marketAndSeo: seoAndMarket || {},
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Converte a tabela para Markdown/YAML limpo para documentação externa
 */
export function exportSpecsToMarkdown(specSectionsOrCache: any[] | ExtractionCacheData | any, identityParam?: any): string {
  const isCache = specSectionsOrCache && !Array.isArray(specSectionsOrCache) && typeof specSectionsOrCache === 'object';
  const specSections = isCache ? specSectionsOrCache.specSections : specSectionsOrCache;
  const identity = isCache ? specSectionsOrCache.identity : identityParam;

  const lines: string[] = [];
  const bikeMarca = identity?.marca || '';
  const bikeModelo = identity?.modelo || '';

  lines.push(`# Ficha Técnica: ${bikeMarca} ${bikeModelo}`.trim());
  lines.push(`*Exportado do TuaVia em ${new Date().toLocaleDateString('pt-BR')}*`);
  lines.push('');

  if (Array.isArray(specSections) && specSections.length > 0) {
    for (const section of specSections) {
      lines.push(`## ${section.title}`);
      lines.push('| Especificação | Valor | Confiança | Fonte |');
      lines.push('| :--- | :--- | :--- | :--- |');
      const items = Array.isArray(section.items) ? section.items : [];
      for (const item of items) {
        lines.push(`| **${item.label}** | ${item.value || 'Não informado'} | ${item.confidence || 'NAO_INFORMADO'} | ${item.source || '-'} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
