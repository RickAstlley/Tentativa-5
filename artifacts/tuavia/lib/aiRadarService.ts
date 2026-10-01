import fs from 'fs/promises';
import path from 'path';
import { WebSearchTool } from '@/lib/ai/tools/webSearch';
import { ProviderHub } from '@/lib/ai/providers/hub';
import { ArticleCategory } from '@/types/article';
import { RadarPauta } from '@/types/globalRadar';

export type { RadarPauta };

const DATA_DIR = path.join(process.cwd(), 'data');
const RADAR_FILE = path.join(DATA_DIR, 'ai_radar_pautas.json');

export const RADAR_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 horas de intervalo para o Radar IA Nacional
export const RADAR_RETENTION_NORMAL_MS = 24 * 60 * 60 * 1000; // 24 horas para artigos normais
export const RADAR_RETENTION_HIGH_IMPACT_MS = 48 * 60 * 60 * 1000; // 48 horas para artigos impactantes

export interface RadarStoreData {
  pautas: RadarPauta[];
  lastScanAt: string | null;
  lastCleanupAt: string | null;
  statusMessage?: string;
}

let isScanning = false;
let scanningStartedAt = 0;
let globalRadarTimer: NodeJS.Timeout | null = null;

/**
 * Filtra pautas retidas no site conforme regras de retenção:
 * - ⭐ Starred: mantidas permanentemente
 * - 🔥 Alto impacto: até 48 horas
 * - ⚡ Normal ('medio', 'tendencia'): até 24 horas
 */
export function filterRetainedRadarPautas(
  pautas: RadarPauta[],
  referenceTimeMs: number = Date.now()
): { retained: RadarPauta[]; expiredCount: number } {
  const retained: RadarPauta[] = [];
  let expiredCount = 0;

  for (const p of pautas) {
    if (!p) continue;
    if (p.starred) {
      retained.push(p);
      continue;
    }

    const createdTime = p.createdAt ? new Date(p.createdAt).getTime() : referenceTimeMs;
    const ageMs = referenceTimeMs - (isNaN(createdTime) ? referenceTimeMs : createdTime);

    // Alto impacto: 48 horas
    if (p.impactLevel === 'alto') {
      if (ageMs < RADAR_RETENTION_HIGH_IMPACT_MS) {
        retained.push(p);
      } else {
        expiredCount++;
      }
      continue;
    }

    // Normal: 24 horas
    if (ageMs < RADAR_RETENTION_NORMAL_MS) {
      retained.push(p);
    } else {
      expiredCount++;
    }
  }

  return { retained, expiredCount };
}

export async function readRadarData(): Promise<RadarStoreData> {
  // Leitura ultra-rápida do Cache Local em Disco
  try {
    const content = await fs.readFile(RADAR_FILE, 'utf-8');
    if (content.trim()) {
      const parsed = JSON.parse(content);
      const rawPautas: RadarPauta[] = Array.isArray(parsed.pautas) ? parsed.pautas : [];
      const { retained, expiredCount } = filterRetainedRadarPautas(rawPautas);
      return {
        pautas: retained,
        lastScanAt: parsed.lastScanAt || null,
        lastCleanupAt: parsed.lastCleanupAt || null,
        statusMessage: expiredCount > 0
          ? `${parsed.statusMessage || ''} [${expiredCount} pauta(s) expirada(s) removida(s) pela retenção 48h/24h]`
          : parsed.statusMessage,
      };
    }
  } catch (_) {}

  return { pautas: [], lastScanAt: null, lastCleanupAt: null };
}

export async function writeRadarData(data: RadarStoreData): Promise<void> {
  // Garante que apenas pautas válidas sob a política de retenção sejam persistidas
  const { retained } = filterRetainedRadarPautas(data.pautas || []);
  const sanitizedData: RadarStoreData = {
    ...data,
    pautas: retained,
  };

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(RADAR_FILE, JSON.stringify(sanitizedData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[aiRadarService] Erro ao gravar pautas do radar no disco:', err);
  }
}

export async function toggleStarPauta(pautaId: string): Promise<RadarPauta | null> {
  const store = await readRadarData();
  let updatedPauta: RadarPauta | null = null;
  store.pautas = store.pautas.map((p) => {
    if (p.id === pautaId) {
      updatedPauta = { ...p, starred: !p.starred };
      return updatedPauta;
    }
    return p;
  });
  await writeRadarData(store);
  return updatedPauta;
}

export async function deletePauta(pautaId: string): Promise<boolean> {
  const store = await readRadarData();
  const initialCount = store.pautas.length;
  store.pautas = store.pautas.filter((p) => p.id !== pautaId);
  if (store.pautas.length !== initialCount) {
    await writeRadarData(store);
    return true;
  }
  return false;
}

/**
 * Limpa pautas e artigos do Radar IA com retenção inteligente:
 * - Itens favoritados (⭐): permanecem permanentemente.
 * - Artigos de Alto Impacto ('alto'): permanecem no site por até 48 horas.
 * - Artigos normais ('medio' ou 'tendencia'): permanecem no site por até 24 horas.
 */
export async function clearNonStarredPautas(): Promise<{ removedCount: number; keptCount: number }> {
  const store = await readRadarData();
  const initialTotal = store.pautas.length;
  const now = new Date().getTime();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  const keptPautas = store.pautas.filter((p) => {
    // 1. Sempre mantém itens favoritados
    if (p.starred) return true;

    const createdTime = p.createdAt ? new Date(p.createdAt).getTime() : now;
    const ageMs = now - createdTime;

    // 2. Artigos impactantes permanecem até 48 horas
    if (p.impactLevel === 'alto') {
      return ageMs < FORTY_EIGHT_HOURS_MS;
    }

    // 3. Artigos normais permanecem por até 24 horas
    return ageMs < TWENTY_FOUR_HOURS_MS;
  });

  const removedCount = initialTotal - keptPautas.length;

  store.pautas = keptPautas;
  store.lastCleanupAt = new Date().toISOString();
  store.statusMessage = `Retenção atualizada: ${removedCount} pauta(s) expirada(s) removida(s). ${keptPautas.length} ativa(s) (alto impacto até 48h, normais até 24h, favoritos permanentes).`;

  await writeRadarData(store);
  console.log(`[Radar IA] 🧹 Retenção executada: ${removedCount} pautas expiradas removidas, ${keptPautas.length} pautas mantidas no site.`);
  return { removedCount, keptCount: keptPautas.length };
}

/**
 * Executa a busca ativa na web (notícias, tendências e PROMOÇÕES de e-bikes) e extrai mini-pautas exclusivamente via NVIDIA NIM LLM.
 */
export async function executeRadarScan(
  force: boolean = false,
  onProgress?: (progressPct: number, stageMessage: string) => Promise<void> | void
): Promise<RadarStoreData> {
  const now = new Date();
  const currentHour = now.getHours();

  await onProgress?.(5, 'Iniciando varredura por notícias e promoções de e-bikes...');

  // Executa verificação de limpeza de 23:59/00:00 se estiver na janela da meia-noite e ainda não rodou hoje
  const store = await readRadarData();
  if (store.lastCleanupAt) {
    const lastCleanupDate = new Date(store.lastCleanupAt).toDateString();
    const todayDate = now.toDateString();
    if (lastCleanupDate !== todayDate && (currentHour === 23 || currentHour === 0)) {
      await clearNonStarredPautas();
    }
  }

  // Se não for forçado, valida intervalo de 1 hora
  if (!force && store.lastScanAt) {
    const elapsed = now.getTime() - new Date(store.lastScanAt).getTime();
    if (elapsed < RADAR_INTERVAL_MS) {
      const remainingMinutes = Math.round((RADAR_INTERVAL_MS - elapsed) / (60 * 1000));
      await onProgress?.(100, `Varredura em pausa. Próxima busca automática em ~${remainingMinutes} min.`);
      return {
        ...store,
        statusMessage: `Varredura em pausa. Próxima busca automática em ~${remainingMinutes} min.`,
      };
    }
  }

  if (!force && isScanning && Date.now() - scanningStartedAt < 20000) {
    await onProgress?.(100, 'Varredura já está em andamento em outro processo.');
    return {
      ...store,
      statusMessage: 'Varredura já está em andamento em outro processo.',
    };
  }

  isScanning = true;
  scanningStartedAt = Date.now();

  try {
    console.log('[Radar IA 2h NVIDIA] 🔎 Iniciando varredura por etapas com GLM 5.3...');
    
    // ETAPA 1: Varredura de Notícias e Tendências
    await onProgress?.(15, '[Etapa 1/3] Varrendo notícias e lançamentos de e-bikes no Brasil...');
    const newsQueries = [
      'bicicleta eletrica lancamento brasil noticia 2026',
      'e-bike bateria contran mobilidade urbana tendencias',
      'e-bikes modelos preco tecnologia novidade',
    ];
    const randomNews = newsQueries[Math.floor(Math.random() * newsQueries.length)];
    const newsSearch = await WebSearchTool.search({
      query: randomNews,
      type: 'news',
      limit: 6,
      locale: 'pt-BR',
      country: 'BR',
    });

    const organicNews = (newsSearch.organic || []).filter(
      (item) => item.link && !item.link.toLowerCase().includes('tuavia.com')
    );

    // PAUSA DE SEGURANÇA / RESPIRO ENTRE ETAPAS (10 a 20 segundos)
    const stage1DelayMs = Math.floor(Math.random() * 10000) + 10000;
    const stage1DelaySec = (stage1DelayMs / 1000).toFixed(1);
    console.log(`[Radar IA] ⏸️ Respiro de proteção de taxa: aguardando ${stage1DelaySec}s antes da próxima etapa...`);
    await onProgress?.(35, `[Etapa 1/3 Concluída] Respiro de proteção (${stage1DelaySec}s) para evitar sobrecarga...`);
    await new Promise((resolve) => setTimeout(resolve, stage1DelayMs));

    // ETAPA 2: Varredura de Ofertas, Promoções e Cupons
    await onProgress?.(50, '[Etapa 2/3] Varrendo promoções, descontos e cupons de e-bikes...');
    const promoQueries = [
      'bicicleta eletrica promocao cupom desconto oferta menor preco brasil 2026',
      'e-bike em promocao desconto loja brasil 2026',
      'ofertas e-bikes cupons de desconto mobilidade',
    ];
    const randomPromo = promoQueries[Math.floor(Math.random() * promoQueries.length)];
    const promoSearch = await WebSearchTool.search({
      query: randomPromo,
      type: 'news',
      limit: 6,
      locale: 'pt-BR',
      country: 'BR',
    });

    const organicPromos = (promoSearch.organic || []).filter(
      (item) => item.link && !item.link.toLowerCase().includes('tuavia.com')
    );
    const allOrganic = [...organicPromos, ...organicNews];

    const newsContext = organicNews
      .map((item, idx) => `[Notícia ${idx + 1}] ${item.title} | Fonte: ${item.domain} (${item.link}) | ${item.snippet}`)
      .join('\n');

    const promoContext = organicPromos
      .map((item, idx) => `[Oferta ${idx + 1}] ${item.title} | Fonte: ${item.domain} (${item.link}) | ${item.snippet}`)
      .join('\n');

    // PAUSA DE SEGURANÇA ANTES DO PING NA LLM GLM 5.3 (10 a 20 segundos)
    const stage2DelayMs = Math.floor(Math.random() * 10000) + 10000;
    const stage2DelaySec = (stage2DelayMs / 1000).toFixed(1);
    console.log(`[Radar IA] ⏸️ Respiro de proteção: aguardando ${stage2DelaySec}s antes da síntese na LLM GLM 5.3...`);
    await onProgress?.(70, `[Etapa 2/3 Concluída] Respiro de segurança (${stage2DelaySec}s) antes do ping na LLM GLM 5.3...`);
    await new Promise((resolve) => setTimeout(resolve, stage2DelayMs));

    // ETAPA 3: Síntese e Geração Estruturada com GLM 5.3 (NVIDIA NIM)
    await onProgress?.(85, '[Etapa 3/3] Sintetizando pautas e oportunidades com GLM 5.3 (NVIDIA)...');
    let newPautas: RadarPauta[] = [];

    const prompt = `Você é um jornalista sênior e editor-chefe especializado em Bicicletas Elétricas, Promoções de E-Bikes e Mobilidade Urbana do portal TuaVia.

Analise as seguintes fontes reais obtidas da internet neste momento:

--- NOTÍCIAS E LANÇAMENTOS DE E-BIKES ---
${newsContext || 'Nenhuma notícia nova no momento.'}

--- PROMOÇÕES, CUPONS, DESCONTOS E OFERTAS DE E-BIKES ---
${promoContext || 'Nenhuma promoção recente encontrada.'}

Com base nesses dados reais, crie de 3 a 5 IDEIAS DE PAUTAS E OFERTAS DE E-BIKES em formato JSON estrito para a equipe editorial.
OBRIGATÓRIO: Crie pelo menos 1 a 2 pautas no formato "Promoções" destacando descontos, cupons, ofertas de e-bikes ou menor preço identificado!

Valores permitidos para "category": "Promoções", "Guia de Compra", "Manutenção", "Legislação", "Notícias", "Comparativo".
Valores permitidos para "impactLevel": "alto", "medio", "tendencia".

Responda EXCLUSIVAMENTE com um array JSON válido sem marcações markdown adicionais:
[
  {
    "title": "Título forte e objetivo (ex: Promoção: E-Bike Urbana X com 15% de Desconto ou Cupom Especial)",
    "summary": "Resumo objetivo em 2 a 3 frases explicando o fato, lançamento ou oferta",
    "whyRelevant": "Por que o ciclista ou comprador brasileiro deve se importar com isso agora",
    "keyPoints": ["Ponto 1", "Ponto 2", "Ponto 3"],
    "sourceUrl": "https://link-da-noticia-ou-oferta.com.br",
    "sourceName": "Nome da loja ou portal",
    "category": "Promoções",
    "suggestedKeywords": ["e-bike promoção", "cupom e-bike", "desconto e-bike", "oferta"],
    "impactLevel": "alto"
  }
]`;

    try {
      const llmResult = await ProviderHub.executeWithFallback({
        primaryModel: 'z-ai/glm-5.3',
        fallbackModel: 'nvidia/nemotron-3-super-120b-a12b',
        tertiaryModel: 'moonshotai/kimi-k3',
        taskName: 'radar_pautas',
        messages: [
          { role: 'system', content: 'Você é um assistente especialista da NVIDIA NIM para jornalismo de e-bikes e ofertas de mobilidade elétrica.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 2500,
        enableThinking: false,
        reasoningEffort: 'low',
        timeoutMs: 60000,
      });

      const textResponse = llmResult.text || '';
      const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        const rawParsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(rawParsed)) {
          newPautas = rawParsed.map((item, index) => ({
            id: `pauta_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
            title: item.title || 'Nova Pauta sobre Bicicleta Elétrica',
            summary: item.summary || 'Resumo da novidade ou promoção identificada.',
            whyRelevant: item.whyRelevant || 'Alta relevância para compradores e ciclistas urbanos.',
            keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : ['Análise TuaVia sobre e-bike'],
            sourceUrl: item.sourceUrl || allOrganic[index]?.link || '',
            sourceName: item.sourceName || allOrganic[index]?.domain || 'Portal Web',
            category: (item.category as ArticleCategory) || (item.title?.toLowerCase().includes('promo') ? 'Promoções' : 'Notícias'),
            suggestedKeywords: Array.isArray(item.suggestedKeywords) ? item.suggestedKeywords : ['e-bike', 'promoção', 'bicicleta elétrica'],
            createdAt: new Date().toISOString(),
            starred: false,
            impactLevel: item.impactLevel || 'tendencia',
          }));
        }
      }
    } catch (err: any) {
      console.warn('[Radar IA NVIDIA] Erro ao sintetizar pautas com NVIDIA NIM:', err?.message);
    }

    // Fallback: Se a LLM não retornar ou ocorrer erro de conexão, monta APENAS a partir dos resultados orgânicos reais já filtrados
    if (newPautas.length === 0) {
      if (allOrganic.length > 0) {
        newPautas = allOrganic.slice(0, 4).map((item, idx) => {
          const isPromo = item.title.toLowerCase().includes('promo') || item.title.toLowerCase().includes('oferta') || item.title.toLowerCase().includes('cupom') || idx < 2;
          return {
            id: `pauta_${Date.now()}_fb_${idx}`,
            title: item.title.replace(/\s*-\s*[^-]+$/, ''),
            summary: item.snippet || 'Novidade ou oferta sobre mobilidade elétrica e e-bikes.',
            whyRelevant: 'Tendência ou promoção ativa identificada nas buscas do mercado brasileiro.',
            keyPoints: ['Análise de mercado TuaVia', 'Mobilidade sustentável', 'Oferta / Oportunidade'],
            sourceUrl: item.link,
            sourceName: item.domain,
            category: isPromo ? 'Promoções' : 'Notícias',
            suggestedKeywords: isPromo ? ['e-bike em promoção', 'cupom e-bike', 'desconto'] : ['bicicleta elétrica', 'e-bike'],
            createdAt: new Date().toISOString(),
            starred: false,
            impactLevel: idx === 0 ? 'alto' : 'medio',
          };
        });
      } else {
        console.log('[aiRadarService] Nenhuma fonte orgânica real capturada na web. Varredura finalizada sem pautas fabricadas.');
        newPautas = [];
      }
    }

    // Filtro final anti-alucinação: descarta qualquer pauta cujo sourceUrl não seja uma URL http(s) válida, ou cujo sourceUrl/sourceName contenha tuavia
    newPautas = newPautas.filter((p) => {
      const url = (p.sourceUrl || '').trim();
      const name = (p.sourceName || '').toLowerCase();
      const isValidHttp = /^https?:\/\/.+/i.test(url);
      const isNotSelfReferencing = !url.toLowerCase().includes('tuavia') && !name.includes('tuavia');
      return isValidHttp && isNotSelfReferencing;
    });

    // 3. Mescla com as pautas existentes, removendo duplicadas por título similar
    await onProgress?.(80, 'Aplicando curadoria editorial e regras de retenção (48h impacto / 24h normal)...');
    const existingPautas = store.pautas || [];
    const existingTitlesSet = new Set(existingPautas.map((p) => p.title.toLowerCase().trim()));

    const uniqueNewPautas = newPautas.filter((p) => !existingTitlesSet.has(p.title.toLowerCase().trim()));

    const rawCombined = [...uniqueNewPautas, ...existingPautas];
    const { retained, expiredCount } = filterRetainedRadarPautas(rawCombined, now.getTime());

    // Ordena: favoritados (starred) no topo, seguidos pelos mais recentes
    const sortedPautas = retained.sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    }).slice(0, 150);

    const newStore: RadarStoreData = {
      pautas: sortedPautas,
      lastScanAt: now.toISOString(),
      lastCleanupAt: store.lastCleanupAt,
      statusMessage: `Varredura concluída! ${uniqueNewPautas.length} pauta(s) externa(s) verificada(s) adicionada(s). ${sortedPautas.length} ativa(s) no site (48h alto impacto / 24h normal / ⭐ permanentes).`,
    };

    await writeRadarData(newStore);
    await onProgress?.(100, `Varredura concluída! ${uniqueNewPautas.length} novas pautas integradas ao radar.`);
    console.log(`[Radar IA 1h NVIDIA] ✅ Varredura finalizada. ${uniqueNewPautas.length} pautas adicionadas. Retenção ativa: ${sortedPautas.length} pautas.`);
    return newStore;
  } catch (err: any) {
    console.error('[aiRadarService] Erro durante a varredura do Radar IA NVIDIA:', err);
    return {
      ...store,
      statusMessage: `Erro na varredura NVIDIA: ${err?.message || err}`,
    };
  } finally {
    isScanning = false;
  }
}

/**
 * Agendador do Radar de Pautas e Ofertas.
 * Agora orquestrado centralmente pelo AutoCycleScheduler para garantir fila serial sem colisão de GPU.
 */
export function initAiRadarScheduler(): void {
  // O agendamento é centralizado em lib/orchestration/autoCycleScheduler.ts
  // Esta função é mantida para compatibilidade retroativa.
}
