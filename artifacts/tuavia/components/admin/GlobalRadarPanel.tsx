'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { pollExistingLLMJob } from '@/lib/ai/llmJobClient';
import {
  Globe2,
  Sparkles,
  Search,
  RefreshCw,
  Star,
  ExternalLink,
  BatteryCharging,
  Cpu,
  Bike,
  TrendingUp,
  Tag,
  AlertCircle,
  Copy,
  Filter,
  Layers,
  Flame,
  ShieldCheck,
  Share2,
  Download,
  CheckCircle2,
  FileText,
  Clock,
  Trophy,
} from 'lucide-react';
import {
  TechRegionKey,
  TechTopicKey,
  TECH_REGIONS,
  GlobalRadarSearchResultItem,
} from '@/types/globalRadar';

// Helper para identificar o tipo exato do item e aplicar cores de alto contraste
function getItemTypeBadge(item: GlobalRadarSearchResultItem) {
  const cat = (item.category || '').toLowerCase();
  const text = (
    item.title +
    ' ' +
    (item.summary || '') +
    ' ' +
    (item.whyRelevant || '') +
    ' ' +
    (item.specsSummary?.bateria || '') +
    ' ' +
    (item.specsSummary?.motor || '')
  ).toLowerCase();

  if (
    cat.includes('promo') ||
    text.includes('desconto') ||
    text.includes('cupom') ||
    text.includes('oferta') ||
    text.includes('liquidação') ||
    text.includes('promoção') ||
    text.includes('black friday') ||
    text.includes('preço promocional')
  ) {
    return {
      type: 'promo',
      label: '🏷️ OFERTA & PROMOÇÃO',
      badgeBg: 'bg-rose-500 text-white border-rose-600',
      tagBg: 'bg-rose-100 text-rose-900 border-rose-300',
      cardBorder: 'border-rose-400 hover:border-rose-500 shadow-[4px_4px_0px_0px_rgba(244,63,94,1)]',
    };
  }

  if (
    cat.includes('bateria') ||
    cat.includes('química') ||
    text.includes('bateria') ||
    text.includes('sódio') ||
    text.includes('sodium') ||
    text.includes('lfp') ||
    text.includes('lifepo4') ||
    text.includes('célula') ||
    text.includes('estado sólido') ||
    text.includes('solid state') ||
    text.includes('4680') ||
    text.includes('21700') ||
    text.includes('bms')
  ) {
    return {
      type: 'battery',
      label: '🔋 BATERIA & QUÍMICA',
      badgeBg: 'bg-emerald-600 text-white border-emerald-700',
      tagBg: 'bg-emerald-100 text-emerald-950 border-emerald-300',
      cardBorder: 'border-emerald-400 hover:border-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]',
    };
  }

  if (
    cat.includes('motor') ||
    cat.includes('transmissão') ||
    text.includes('motor') ||
    text.includes('mid-drive') ||
    text.includes('avinox') ||
    text.includes('bafang') ||
    text.includes('bosch') ||
    text.includes('pinion') ||
    text.includes('shimano') ||
    text.includes('torque') ||
    text.includes('câmbio') ||
    text.includes('mgu')
  ) {
    return {
      type: 'motor',
      label: '⚙️ MOTOR & TRANSMISSÃO',
      badgeBg: 'bg-amber-500 text-stone-950 border-amber-600',
      tagBg: 'bg-amber-100 text-amber-950 border-amber-300',
      cardBorder: 'border-amber-400 hover:border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]',
    };
  }

  if (
    cat.includes('peça') ||
    cat.includes('componente') ||
    cat.includes('kit') ||
    text.includes('kit conversão') ||
    text.includes('freio') ||
    text.includes('abs') ||
    text.includes('display') ||
    text.includes('painel') ||
    text.includes('sensor') ||
    text.includes('pneu') ||
    text.includes('suspensão')
  ) {
    return {
      type: 'parts',
      label: '🛠️ PEÇAS & KITS CONVERSÃO',
      badgeBg: 'bg-purple-600 text-white border-purple-700',
      tagBg: 'bg-purple-100 text-purple-950 border-purple-300',
      cardBorder: 'border-purple-400 hover:border-purple-500 shadow-[4px_4px_0px_0px_rgba(168,85,247,1)]',
    };
  }

  if (
    cat.includes('bike') ||
    cat.includes('e-bike') ||
    cat.includes('bicicleta') ||
    text.includes('e-mtb') ||
    text.includes('mountain bike') ||
    text.includes('bicicleta elétrica') ||
    text.includes('dobrável') ||
    text.includes('cargo') ||
    text.includes('speed')
  ) {
    return {
      type: 'bike',
      label: '🚲 E-BIKE COMPLETA',
      badgeBg: 'bg-cyan-700 text-white border-cyan-800',
      tagBg: 'bg-cyan-100 text-cyan-950 border-cyan-300',
      cardBorder: 'border-cyan-400 hover:border-cyan-500 shadow-[4px_4px_0px_0px_rgba(6,182,212,1)]',
    };
  }

  return {
    type: 'dossier',
    label: '📑 DOSSIÊ & TECNOLOGIA',
    badgeBg: 'bg-indigo-600 text-white border-indigo-700',
    tagBg: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    cardBorder: 'border-indigo-400 hover:border-indigo-500 shadow-[4px_4px_0px_0px_rgba(99,102,241,1)]',
  };
}

export default function GlobalRadarPanel() {
  const router = useRouter();

  // Filtros de busca e visualização
  const [selectedRegion, setSelectedRegion] = useState<TechRegionKey>('all');
  const [selectedTopic, setSelectedTopic] = useState<TechTopicKey>('all');
  const [customQuery, setCustomQuery] = useState('');
  const [searchLimit] = useState(8);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [inFeedSearch, setInFeedSearch] = useState('');

  // Estados de execução
  const [loading, setLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [results, setResults] = useState<GlobalRadarSearchResultItem[]>([]);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [nextScanInMinutes, setNextScanInMinutes] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);

  // Carrega feed e status horário do servidor sem apagar achados recentes em tela
  const loadHourlyFeed = useCallback(async (force = false) => {
    try {
      const res = await fetchAdminJson<{
        success: boolean;
        results: GlobalRadarSearchResultItem[];
        lastScanAt: string | null;
        nextScanInMinutes: number;
        statusMessage?: string;
        isScanning?: boolean;
      }>(`/api/admin/llm/radar/global-search${force ? '?force=true' : ''}`, {
        timeoutMs: 180000,
      });

      if (res.ok && res.data?.success) {
        const incoming = res.data.results || [];
        setResults((prev) => {
          if (!prev || prev.length === 0) return incoming;
          if (incoming.length === 0) return prev; // Proteção: nunca zera achados em memória com resposta vazia

          const incomingIds = new Set(incoming.map((item) => item.id).filter(Boolean));
          const incomingTitles = new Set(
            incoming.map((item) => (item.titleOriginal || item.title || '').toLowerCase().trim()).filter(Boolean)
          );
          const incomingUrls = new Set(
            incoming.map((item) => (item.sourceUrl || '').toLowerCase().trim()).filter(Boolean)
          );

          // Preserva itens que estão em tela e ainda não vieram na resposta do servidor
          const keptExisting = prev.filter((p) => {
            if (p.id && incomingIds.has(p.id)) return false;
            const titleKey = (p.titleOriginal || p.title || '').toLowerCase().trim();
            if (titleKey && incomingTitles.has(titleKey)) return false;
            const urlKey = (p.sourceUrl || '').toLowerCase().trim();
            if (urlKey && incomingUrls.has(urlKey)) return false;
            return true;
          });

          return [...incoming, ...keptExisting];
        });

        if (res.data.lastScanAt) {
          setLastScanAt(res.data.lastScanAt);
        }
        if (typeof res.data.nextScanInMinutes === 'number') {
          setNextScanInMinutes(res.data.nextScanInMinutes);
        }
        if (res.data.statusMessage) {
          setStatusMessage(res.data.statusMessage);
        }
      }
    } catch (err) {
      console.warn('[GlobalRadarPanel] Erro ao obter status horário:', err);
    }
  }, []);

  // Tópicos com ícones expandidos
  const topicsList: { key: TechTopicKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'all', label: 'Todos os Tópicos', icon: Layers },
    { key: 'components', label: 'Peças, Baterias & Kits', icon: Cpu },
    { key: 'batteries', label: 'Baterias & Células (Sódio/LFP)', icon: BatteryCharging },
    { key: 'motors', label: 'Motores & Transmissões (Mid-Drive)', icon: Cpu },
    { key: 'launches', label: 'Lançamentos & E-Bikes', icon: Bike },
    { key: 'safety', label: 'Segurança, ABS & IoT Antifurto', icon: ShieldCheck },
    { key: 'market', label: 'Mercado, Tendências & Dossiês', icon: TrendingUp },
    { key: 'promos', label: 'Promoções & Ofertas Globais', icon: Tag },
  ];

  // Sugestões rápidas de pesquisa por região
  const quickSuggestions: Record<TechRegionKey, string[]> = {
    all: ['Baterias de Íon-Sódio 2026', 'DJI Avinox vs Bosch CX Gen 5', 'Transmissão Pinion MGU', 'Kits de Conversão Elétrica', 'Promoções de E-Bikes 2026', 'Sistemas ABS para E-Bikes'],
    china: ['CATL bateria sódio e-bike', 'Bafang M820 motor central', 'DJI Avinox sistema 120Nm', 'Kits conversão Bafang 2026', 'BMS inteligente anti-incêndio'],
    japan: ['Shimano EP801 Auto Shift', 'Yamaha PW-X3 e-bike', 'Panasonic bateria alta densidade', 'E-bike dobrável minivelo', 'Sensores quádruplos de torque'],
    korea: ['Samsung SDI 21700 5000mAh', 'LG Energy Solution e-bike pack', 'Smart IoT e-mobility bike', 'Telemetria 5G e-bike'],
    usa: ['Specialized Turbo Levo 2026', 'Solid-state battery ebike test', 'Class 3 commuter ebike review', 'UL 2849 fire certification', 'Garmin Varia radar e-bike'],
    europe: ['Bosch Performance Line CX Gen 5', 'Eurobike Frankfurt 2026 novidades', 'Pinion MGU caixa integrada', 'Fazua Ride 60 review', 'Bosch eBike ABS Gen 2'],
    russia: ['Электровелосиped полный привод', 'Аккумулятор морозостойкий LTO', 'Электрофэтбайк 1000W', 'Bafang Ultra 1500W'],
    brazil: ['Resolução CONTRAN 996 e-bikes', 'Caloi E-Vibe 2026 lançamento', 'Oggi e-bike motor central', 'Promoção e-bike Brasil', 'Bateria e-bike segurança Inmetro'],
  };

  // Executa a busca internacional com chamadas atômicas independentes (encerramento e início por região)
  const handleExecuteSearch = useCallback(
    async (overrideRegion?: TechRegionKey, overrideTopic?: TechTopicKey, overrideQuery?: string) => {
      const reg = overrideRegion || selectedRegion;
      const top = overrideTopic || selectedTopic;
      const q = overrideQuery !== undefined ? overrideQuery : customQuery;

      setLoading(true);
      setError(null);
      setStatusMessage(null);
      setProgressPct(5);

      // Define a lista de polos a serem processados de forma 100% atômica e independente
      const regionsToExecute: TechRegionKey[] =
        reg === 'all'
          ? ['china', 'japan', 'europe', 'usa', 'korea', 'russia', 'brazil']
          : [reg];

      let totalNewItems = 0;

      try {
        for (let i = 0; i < regionsToExecute.length; i++) {
          const currentRegionKey = regionsToExecute[i];
          const regionInfo = TECH_REGIONS[currentRegionKey];
          const currentStep = i + 1;
          const totalSteps = regionsToExecute.length;
          const stepPercent = Math.round((i / totalSteps) * 90) + 10;

          setProgressPct(stepPercent);
          setStageMessage(`[${currentStep}/${totalSteps}] Conectando e varrendo ${regionInfo?.flag || '🌍'} ${regionInfo?.label || currentRegionKey} (${regionInfo?.language || 'Nativo'})...`);

          try {
            // Chamada atômica independente para a região atual: encerra e retorna com 200
            const res = await fetchAdminJson<{
              success: boolean;
              queued?: boolean;
              jobId?: string;
              results?: GlobalRadarSearchResultItem[];
              totalFound?: number;
              message?: string;
              error?: string;
            }>('/api/admin/llm/radar/global-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              timeoutMs: 25000,
              body: JSON.stringify({
                region: currentRegionKey,
                topic: top,
                customQuery: q,
                limit: reg === 'all' ? 3 : searchLimit,
                saveToRadarStore: true,
              }),
            });

            if (res.ok && res.data?.success) {
              if (res.data.jobId) {
                const jobId = res.data.jobId;
                setStageMessage(`[${currentStep}/${totalSteps}] Processando análise de ${regionInfo?.label}...`);

                try {
                  let lastFeedSync = Date.now();
                  const completedJob = await pollExistingLLMJob({
                    jobId,
                    type: 'radar_scan',
                    onProgress: (job) => {
                      if (job.stage) {
                        setStageMessage(`[${currentStep}/${totalSteps}] ${job.stage}`);
                      }
                      if (job.progress !== undefined) {
                        const subProgress = Math.min(99, Math.max(0, job.progress));
                        const stepBase = ((currentStep - 1) / totalSteps) * 90;
                        const stepSpan = (1 / totalSteps) * 90;
                        setProgressPct(Math.round(stepBase + (subProgress / 100) * stepSpan));
                      }
                      // Atualização progressiva da tela a cada 3 segundos
                      if (Date.now() - lastFeedSync > 3000) {
                        lastFeedSync = Date.now();
                        loadHourlyFeed(false).catch(() => {});
                      }
                    },
                    pollIntervalMs: 1200,
                    maxPollAttempts: 180,
                  });

                  if (completedJob.status === 'completed') {
                    await loadHourlyFeed(false);
                    const jobResults: GlobalRadarSearchResultItem[] = completedJob.result?.results || [];
                    if (jobResults.length > 0) {
                      totalNewItems += jobResults.length;
                      setResults((prev) => {
                        const existingIds = new Set((prev || []).map((p) => p.id).filter(Boolean));
                        const existingTitles = new Set(
                          (prev || []).map((p) => (p.titleOriginal || p.title || '').toLowerCase().trim()).filter(Boolean)
                        );
                        const existingUrls = new Set(
                          (prev || []).map((p) => (p.sourceUrl || '').toLowerCase().trim()).filter(Boolean)
                        );
                        const freshItems = jobResults.filter((j) => {
                          if (existingIds.has(j.id)) return false;
                          const tKey = (j.titleOriginal || j.title || '').toLowerCase().trim();
                          if (tKey && existingTitles.has(tKey)) return false;
                          const uKey = (j.sourceUrl || '').toLowerCase().trim();
                          if (uKey && existingUrls.has(uKey)) return false;
                          return true;
                        });
                        return [...freshItems, ...(prev || [])];
                      });
                    }
                  }
                } catch (pollErr) {
                  console.warn(`[GlobalRadarPanel] Aviso no polo ${currentRegionKey}:`, pollErr);
                }
              } else if (res.data.results && res.data.results.length > 0) {
                totalNewItems += res.data.results.length;
                setResults((prev) => {
                  const existingIds = new Set((prev || []).map((p) => p.id).filter(Boolean));
                  const existingTitles = new Set(
                    (prev || []).map((p) => (p.titleOriginal || p.title || '').toLowerCase().trim()).filter(Boolean)
                  );
                  const existingUrls = new Set(
                    (prev || []).map((p) => (p.sourceUrl || '').toLowerCase().trim()).filter(Boolean)
                  );
                  const freshItems = (res.data?.results || []).filter((j) => {
                    if (existingIds.has(j.id)) return false;
                    const tKey = (j.titleOriginal || j.title || '').toLowerCase().trim();
                    if (tKey && existingTitles.has(tKey)) return false;
                    const uKey = (j.sourceUrl || '').toLowerCase().trim();
                    if (uKey && existingUrls.has(uKey)) return false;
                    return true;
                  });
                  return [...freshItems, ...(prev || [])];
                });
              }
            }
          } catch (regionErr: any) {
            console.warn(`[GlobalRadarPanel] Falha no ciclo isolado de ${currentRegionKey}:`, regionErr);
          }

          // Pausa controlada de 400ms antes de abrir a nova conexão limpa
          if (i < regionsToExecute.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }

        // Finaliza o pipeline completo
        setProgressPct(100);
        setStageMessage('Varredura atômica de todos os polos concluída com sucesso!');
        setStatusMessage(
          totalNewItems > 0
            ? `Varredura finalizada! ${totalNewItems} novas pautas adicionadas ao radar.`
            : 'Varredura finalizada! Feed atualizado com as últimas novidades internacionais.'
        );
        await loadHourlyFeed(false);
      } catch (err: any) {
        setError(err?.message || 'Erro durante a varredura internacional.');
      } finally {
        setLoading(false);
      }
    },
    [selectedRegion, selectedTopic, customQuery, searchLimit, loadHourlyFeed]
  );

  // Carrega apenas o cache existente ao abrir/recarregar a página. NUNCA dispara busca automática na abertura.
  useEffect(() => {
    loadHourlyFeed(false);

    // Atualiza o feed local silenciosamente a cada 30s se houver jobs em andamento
    const interval = setInterval(() => {
      loadHourlyFeed(false);
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [loadHourlyFeed]);

  // Favoritar / Desfavoritar pauta
  const handleToggleStar = async (pautaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResults((prev) =>
      prev.map((p) => (p.id === pautaId ? { ...p, starred: !p.starred } : p))
    );

    try {
      await fetchAdminJson('/api/admin/llm/radar/global-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_star', pautaId }),
      });
    } catch (err) {
      console.error('Erro ao favoritar pauta internacional:', err);
    }
  };

  // Disparo com 1 clique para o gerador de artigos ou ficha de e-bike
  const handleDispatch = (
    item: GlobalRadarSearchResultItem,
    target: 'article_writer' | 'ebike_analysis' | 'top_ranking',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    if (typeof window !== 'undefined') {
      const regionBadge = `${item.countryFlag} ${item.regionLabel} (${item.originalLanguage})`;
      
      const markdownArticleBody = `# ${item.title}

> **Resumo Executivo:** ${item.summary}

## 1. Panorama da Inovação & Origem Internacional
Identificado diretamente no polo tecnológico de **${item.regionLabel} (${item.countryFlag})**, este avanço representa um salto de inovação no ecossistema global de mobilidade elétrica.

${item.titleOriginal && item.titleOriginal !== item.title ? `*Título catalogado originalmente:* "${item.titleOriginal}" (${item.originalLanguage})` : ''}

${item.summary}

## 2. Especificações de Engenharia & Ficha Técnica
Abaixo detalhamos a configuração mecânica, elétrica e estrutural levantada pelo Radar Internacional:

| Especificação | Configuração & Detalhes |
| :--- | :--- |
| **Motorização** | ${item.specsSummary?.motor || 'Motor de alta eficiência'} |
| **Potência Estimada** | ${item.specsSummary?.potenciaWatts || '250W nominal / pico ampliado'} |
| **Torque do Motor** | ${item.specsSummary?.torqueNm || 'Sob consulta'} |
| **Bateria / Química** | ${item.specsSummary?.bateria || 'Células de alta densidade'} |
| **Capacidade de Energia** | ${item.specsSummary?.capacidadeWh || 'Autonomia estendida'} |
| **Autonomia Estimada** | ${item.specsSummary?.autonomiaEstimadaKm || '100+ km'} |
| **Peso Total** | ${item.specsSummary?.pesoKg || 'Estrutura leve'} |
| **Preço Original (Exterior)** | ${item.specsSummary?.precoOriginal || 'Sob consulta'} |
| **Estimativa no Mercado Brasileiro** | ${item.specsSummary?.precoEstimadoBRL || 'Calculado com tributos de importação'} |
| **Conformidade CONTRAN 996** | ${item.specsSummary?.conformidadeContran996 || '100% Compatível (Bike Elétrica)'} |

## 3. Principais Diferenciais e Destaques Técnicos
${(item.keyPoints || []).map((pt) => `- **${pt}**`).join('\n')}

## 4. Análise de Relevância e Impacto para o Ciclista no Brasil
${item.whyRelevant}

Para o mercado brasileiro, a chegada e disseminação de tecnologias como esta traz impactos positivos diretos: maior autonomia nas cidades, redução no custo de manutenção e expansão das opções de mobilidade sustentável com segurança.

## 5. Perguntas Frequentes (FAQ)
### Esta novidade já está disponível para compra no Brasil?
Atualmente a tecnologia foi catalogada em ${item.regionLabel}. Produtos e componentes costumam ingressar no Brasil via importadores oficiais, distribuidores credenciados ou importação direta nos meses subsequentes.

### Como fica a regulamentação no Brasil (CONTRAN 996)?
${item.specsSummary?.conformidadeContran996?.includes('100% Compatível') 
  ? 'Bicicletas elétricas com motor até 1000W, velocidade assistida até 32 km/h e pedal assistido (pedelec) possuem trânsito livre em ciclovias e ciclofaixas, sem necessidade de CNH ou emplacamento.' 
  : 'Recomenda-se verificar os limites de potência e velocidade para garantir a conformidade com as regras de trânsito locais e ciclovias.'}

## 6. Conclusão & Veredito Editorial
Esta novidade reafirma a velocidade da inovação global no universo das bicicletas elétricas e mobilidade sustentável. Acompanhe os comparativos e análises do TuaVia para saber quando testaremos esta tecnologia no Brasil.

---
*Fonte Oficial de Referência:* [${item.sourceName || 'Portal Internacional'}](${item.sourceUrl || '#'})
`;

      const promptText = `Escreva um artigo jornalístico completo e aprofundado para o público brasileiro sobre esta inovação internacional de ${regionBadge}:
Título Internacional: "${item.titleOriginal || item.title}"
Título no Brasil: "${item.title}"
Resumo Técnico: ${item.summary}
Impacto no Mercado Brasileiro: ${item.whyRelevant}
Especificações:
- Motor: ${item.specsSummary?.motor || 'Não informado'} (${item.specsSummary?.potenciaWatts || ''} / ${item.specsSummary?.torqueNm || ''})
- Bateria: ${item.specsSummary?.bateria || 'Não informado'} (${item.specsSummary?.capacidadeWh || ''})
- Autonomia: ${item.specsSummary?.autonomiaEstimadaKm || 'Sob teste'} | Peso: ${item.specsSummary?.pesoKg || 'Sob consulta'}
- Preço Original: ${item.specsSummary?.precoOriginal || 'Sob consulta'} (Estimativa Brasil: ${item.specsSummary?.precoEstimadoBRL || 'Sob cálculo'})
- Conformidade CONTRAN 996: ${item.specsSummary?.conformidadeContran996 || '100% Compatível (Bike Elétrica)'}
- Inovação Chave: ${item.specsSummary?.inovacaoChave || 'Avanço tecnológico'}
Pontos Principais:
- ${(item.keyPoints || []).join('\n- ')}
Fonte Internacional: ${item.sourceName} (${item.sourceUrl})`;

      if (target === 'article_writer') {
        const prefillArticle = {
          title: item.title,
          excerpt: item.summary,
          category: 'Notícias',
          keywords: (item.suggestedKeywords || []).join(', '),
          targetAudience: 'Ciclistas urbanos, cicloturistas e compradores de e-bikes no Brasil',
          prompt: promptText,
          aiPromptInput: promptText,
          body: markdownArticleBody,
          suggestedKeywords: item.suggestedKeywords,
          autoGenerateOnLoad: false,
          autoGenerate: false,
        };
        sessionStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
        localStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
        router.push('/admin/artigos/novo?radar=1');
      } else if (target === 'ebike_analysis') {
        const prefillBike = {
          nome: item.title.replace(/^(Lançamento|Novo|Nova|Review|Análise)\s*/i, ''),
          modelo: item.title,
          marca: item.regionLabel,
          motorPowerW: item.specsSummary?.potenciaWatts || item.specsSummary?.motor || '350W',
          motor: item.specsSummary?.motor || '350W',
          batteryDetails: item.specsSummary?.bateria || '48V (Alta densidade)',
          bateria: item.specsSummary?.bateria || '48V',
          priceEstimated: item.specsSummary?.precoEstimadoBRL?.replace(/\D/g, '') || '9900',
          preco: item.specsSummary?.precoEstimadoBRL?.replace(/\D/g, '') || '9900',
          usoPrincipal: 'Urbana',
          uso: 'Urbana',
          resumoExecutivo: `${item.summary}\n\n💡 Impacto Brasil: ${item.whyRelevant}`,
          destaques: item.keyPoints,
          sourceUrl: item.sourceUrl,
          sourceName: item.sourceName,
          badge: `${item.countryFlag} Lançamento Internacional`,
          prompt: promptText,
          autoGenerate: true,
        };
        sessionStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
        localStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
        router.push('/admin/bikes/novo?radar=1');
      } else if (target === 'top_ranking') {
        const titleLower = item.title.toLowerCase();
        const summaryLower = (item.summary || '').toLowerCase();
        const textToAnalyze = `${titleLower} ${summaryLower} ${(item.keyPoints || []).join(' ')}`.toLowerCase();

        let rankingCategory = 'ebikes';
        if (/bateria|battery|célula|amper|carregador|48v|36v|52v|wh\b/i.test(textToAnalyze)) {
          rankingCategory = 'baterias';
        } else if (/motor|bafang|bosch|shimano|câmbio|freio|suspens|peça|pneu|quadro/i.test(textToAnalyze)) {
          rankingCategory = 'pecas';
        } else if (/cadeado|trava|rastreador|alarme|segurança/i.test(textToAnalyze)) {
          rankingCategory = 'seguranca';
        } else if (/capacete|bagageiro|alforge|farol|lanterna|acessório/i.test(textToAnalyze)) {
          rankingCategory = 'acessorios';
        } else if (/custo.benef|barata|barato|promoção|oferta|econômica|preço baixo/i.test(textToAnalyze)) {
          rankingCategory = 'custo-beneficio';
        }

        const qtdMatch = item.title.match(/top\s*(\d+)/i);
        const quantidade = qtdMatch ? Math.min(Math.max(parseInt(qtdMatch[1], 10), 3), 10) : 5;

        let rankingTitle = item.title;
        if (!/top\s*\d+/i.test(rankingTitle)) {
          rankingTitle = `Top ${quantidade} Melhores: ${item.title.replace(/^(Lançamento|Novo|Nova|Review|Análise|Dossiê)\s*/i, '')}`;
        }

        const specsLines: string[] = [];
        if (item.specsSummary?.potenciaWatts || item.specsSummary?.motor) {
          specsLines.push(`- Motor/Potência: ${item.specsSummary.potenciaWatts || item.specsSummary.motor}`);
        }
        if (item.specsSummary?.bateria) {
          specsLines.push(`- Bateria: ${item.specsSummary.bateria}`);
        }
        if (item.specsSummary?.autonomiaKm) {
          specsLines.push(`- Autonomia Estimada: ${item.specsSummary.autonomiaKm}`);
        }
        if (item.specsSummary?.velocidadeMaxKmH) {
          specsLines.push(`- Velocidade Máxima: ${item.specsSummary.velocidadeMaxKmH}`);
        }
        if (item.specsSummary?.precoEstimadoBRL) {
          specsLines.push(`- Faixa de Preço Estimada: ${item.specsSummary.precoEstimadoBRL}`);
        }

        const focoEspecifico = `Origem do Radar Internacional (${regionBadge} - ${item.sourceName}):
${item.summary}

💡 Relevância e Impacto para o Mercado Brasileiro:
${item.whyRelevant}

Destaques e Inovações Técnicas:
${(item.keyPoints || []).map((kp) => `- ${kp}`).join('\n')}
${specsLines.length > 0 ? `\nEspecificações Técnicas Detectadas:\n${specsLines.join('\n')}` : ''}

Diretriz para a LLM: Formule um ranking comparativo técnico, rigoroso e imparcial com as melhores opções disponíveis ou equivalentes diretos no Brasil, destacando especificações reais, pontos fortes e pontos fracos.`;

        const prefillRanking = {
          titulo: rankingTitle,
          tema: rankingTitle,
          categoria: rankingCategory,
          quantidade: quantidade,
          focoEspecifico: focoEspecifico,
          resumo: item.summary,
          criterioAvaliacao: `Relação custo-benefício, confiabilidade dos componentes, autonomia real e impacto das inovações detectadas no radar internacional (${regionBadge}).`,
          autoGenerate: true,
        };
        sessionStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
        localStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
        router.push('/admin/rankings/novo?radar=1');
      }
    }
  };

  const copyText = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportAllMarkdown = () => {
    if (results.length === 0) return;
    const header = `# Relatório Radar Global de E-Bikes - TuaVia (${new Date().toLocaleDateString('pt-BR')})\n\n`;
    const body = results
      .map((item, idx) => {
        return `## ${idx + 1}. ${item.countryFlag} ${item.title}\n` +
          `**Origem:** ${item.regionLabel} (${item.originalLanguage})\n` +
          `**Título Original:** "${item.titleOriginal || item.title}"\n` +
          `**Resumo:** ${item.summary}\n\n` +
          `💡 **Impacto Brasil:** ${item.whyRelevant}\n\n` +
          `**Especificações Técnicas:**\n` +
          `- Motor: ${item.specsSummary?.motor || 'N/A'}\n` +
          `- Bateria: ${item.specsSummary?.bateria || 'N/A'}\n` +
          `- Estimativa R$: ${item.specsSummary?.precoEstimadoBRL || 'Sob consulta'}\n` +
          `- Regulação CONTRAN 996: ${item.specsSummary?.conformidadeContran996 || '100% Compatível'}\n\n` +
          `**Fonte:** [${item.sourceName}](${item.sourceUrl})\n\n` +
          `---\n`;
      })
      .join('\n');

    navigator.clipboard.writeText(header + body);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2500);
  };

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-5 md:p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
      {/* CABEÇALHO DO RADAR GLOBAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-stone-100 pb-5">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-amber-500 border-2 border-stone-900 rounded-xl text-stone-900 font-black shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] shrink-0">
            <Globe2 className="w-6 h-6 animate-pulse text-stone-950" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-stone-900 tracking-tight">
                Radar Global & Multilíngue de E-Bikes
              </h2>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-950 border border-indigo-300 font-mono text-xs font-bold rounded-full">
                🇨🇳 CN • 🇯🇵 JP • 🇰🇷 KR • 🇺🇸 US • 🇪🇺 EU • 🇷🇺 RU • 🇧🇷 BR
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl font-medium">
              Monitora em tempo real os 7 maiores polos industriais e de P&D do mundo nos idiomas nativos (Mandarim, Japonês, Coreano, Alemão, Russo e Inglês), traduzindo especificações e calculando o impacto direto no Brasil.
            </p>
          </div>
        </div>

        {/* AÇÕES NO TOPO */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {results.length > 0 && (
            <button
              type="button"
              onClick={handleExportAllMarkdown}
              className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-mono font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Copiar relatório completo em formato Markdown"
            >
              {exportCopied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copiado p/ Área de Transferência!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-stone-700" />
                  <span>Exportar Pautas (MD)</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            disabled={loading}
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-mono font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Varrendo Polos...' : 'Escanear Radar Internacional'}</span>
          </button>
        </div>
      </div>

      {/* BANNER DE VARREDURA HORÁRIA E ECOSSISTEMA COMPLETO */}
      <div className="p-3.5 bg-stone-950 text-white border-2 border-stone-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wide uppercase text-amber-400 font-mono">
                Varredura Horária Automática Ativa
              </span>
              <span className="text-[10px] font-mono bg-stone-800 text-stone-300 px-2 py-0.5 rounded-md border border-stone-700">
                1h em 1h
              </span>
              <span className="text-[10px] font-mono bg-stone-800 text-emerald-400 px-2 py-0.5 rounded-md border border-stone-700 font-bold">
                Retenção no Site: 48h Impacto / 24h Normal
              </span>
            </div>
            <p className="text-[11px] text-stone-300 font-mono">
              Última varredura:{' '}
              <span className="text-white font-bold">
                {lastScanAt ? new Date(lastScanAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recente'}
              </span>
              {' '}• Próxima varredura em:{' '}
              <span className="text-amber-400 font-bold">~{nextScanInMinutes} min</span>
            </p>
          </div>
        </div>

        {/* Badges de Cobertura Total do Ecossistema */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">🚲 E-Bikes</span>
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">🔋 Baterias & Células</span>
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">⚙️ Motores</span>
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">🛠️ Peças & Kits</span>
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">🏷️ Promoções</span>
          <span className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded border border-stone-700">📑 Dossiês Técnicos</span>
        </div>
      </div>

      {/* SELETOR DE POLOS TECNOLÓGICOS / PAÍSES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            1. Polo Tecnológico & Idioma Nativo de Origem
          </label>
          <span className="text-[11px] font-mono text-stone-500 font-medium hidden sm:inline">
            Clique em qualquer polo para busca instantânea
          </span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {(Object.keys(TECH_REGIONS) as TechRegionKey[]).map((regKey) => {
            const reg = TECH_REGIONS[regKey];
            const isSelected = selectedRegion === regKey;

            return (
              <button
                key={regKey}
                type="button"
                onClick={() => {
                  setSelectedRegion(regKey);
                  handleExecuteSearch(regKey, selectedTopic, customQuery);
                }}
                disabled={loading}
                className={`p-2.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] scale-[1.02]'
                    : 'bg-stone-50 border-stone-200 hover:border-stone-400 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{reg.flag}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-stone-900" />}
                </div>
                <div>
                  <div className="text-[11px] font-black text-stone-900 truncate leading-tight">
                    {reg.label.split(' ')[0]}
                  </div>
                  <div className="text-[9px] font-mono text-stone-600 truncate">
                    {reg.language.split(' ')[0]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Resumo do polo selecionado + Termos Nativos */}
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-base">{TECH_REGIONS[selectedRegion].flag}</span>
              <span className="font-bold text-stone-900">{TECH_REGIONS[selectedRegion].label}:</span>
              <span className="text-stone-600">{TECH_REGIONS[selectedRegion].techFocus}</span>
            </div>
            <span className="text-[10px] bg-white px-2 py-0.5 border border-stone-200 rounded text-stone-500 font-bold">
              Idioma: {TECH_REGIONS[selectedRegion].language}
            </span>
          </div>

          {/* Badges de Termos Nativos Pesquisados */}
          {TECH_REGIONS[selectedRegion].nativeKeywordsSample && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-stone-200/60">
              <span className="text-[10px] font-bold text-stone-400 uppercase font-mono">
                Termos Técnicos Nativos:
              </span>
              {TECH_REGIONS[selectedRegion].nativeKeywordsSample.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-white border border-stone-300 text-stone-800 text-[10px] font-mono font-medium rounded-md shadow-2xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SELETOR DE TÓPICOS & CAMPO DE BUSCA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Tópicos */}
        <div className="lg:col-span-7 space-y-2">
          <label className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            2. Filtrar por Especialidade Tecnológica
          </label>
          <div className="flex flex-wrap gap-1.5">
            {topicsList.map((top) => {
              const Icon = top.icon;
              const isSelected = selectedTopic === top.key;
              return (
                <button
                  key={top.key}
                  type="button"
                  onClick={() => {
                    setSelectedTopic(top.key);
                    handleExecuteSearch(selectedRegion, top.key, customQuery);
                  }}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{top.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Busca Customizada */}
        <div className="lg:col-span-5 space-y-2">
          <label className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-amber-600" />
            3. Palavra-Chave ou Modelo Específico (Opcional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteSearch();
              }}
              placeholder="Ex: DJI Avinox, Bafang M820, Bateria Sódio..."
              className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-200 focus:border-stone-900 rounded-xl text-xs font-medium text-stone-900 outline-none transition-all"
            />
            {customQuery && (
              <button
                type="button"
                onClick={() => {
                  setCustomQuery('');
                  handleExecuteSearch(selectedRegion, selectedTopic, '');
                }}
                className="px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs rounded-xl font-bold border border-stone-300"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUGESTÕES RÁPIDAS DE PESQUISA */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
        <span className="font-bold text-stone-500 font-mono">Sugestões Rápidas:</span>
        {(quickSuggestions[selectedRegion] || quickSuggestions.all).map((sug, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setCustomQuery(sug);
              handleExecuteSearch(selectedRegion, selectedTopic, sug);
            }}
            className="px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 rounded-md text-amber-900 font-medium transition-all hover:scale-105 cursor-pointer"
          >
            ⚡ {sug}
          </button>
        ))}
      </div>

      {/* BARRA DE PROGRESSO & STATUS AO CARREGAR */}
      {loading && (
        <div className="p-4 bg-stone-900 text-white rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="font-bold text-amber-400 uppercase tracking-wide">
                Varredura Global & Multilíngue em Execução
              </span>
            </div>
            <span className="text-stone-400 font-bold">{progressPct}%</span>
          </div>

          <p className="text-xs text-stone-300 font-mono">{stageMessage}</p>

          <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden border border-stone-700">
            <div
              className="bg-amber-400 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ERROS */}
      {error && !loading && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs uppercase">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Falha na Busca Internacional
          </div>
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* LISTA DE RESULTADOS DO RADAR GLOBAL COM FILTRO POR TAGS */}
      {!loading && results.length > 0 && (() => {
        // Cálculo dos contadores em tempo real para cada tag
        const tagCounts = {
          all: results.length,
          'alto-impacto': results.filter((i) => i.impactLevel === 'alto' || (i.classifiedTags || []).includes('alto impacto')).length,
          'e-bike': results.filter((i) => getItemTypeBadge(i).type === 'bike' || (i.classifiedTags || []).includes('e-bike')).length,
          'promocao': results.filter((i) => getItemTypeBadge(i).type === 'promo' || (i.classifiedTags || []).includes('promoção') || (i.classifiedTags || []).includes('promocao')).length,
          'bateria': results.filter((i) => getItemTypeBadge(i).type === 'battery' || (i.classifiedTags || []).includes('bateria')).length,
          'motor': results.filter((i) => getItemTypeBadge(i).type === 'motor' || (i.classifiedTags || []).includes('motor')).length,
          'pecas': results.filter((i) => getItemTypeBadge(i).type === 'parts' || (i.classifiedTags || []).includes('peças') || (i.classifiedTags || []).includes('pecas')).length,
          'noticias': results.filter((i) => i.category === 'Notícias' || (i.classifiedTags || []).includes('notícias') || (i.classifiedTags || []).includes('noticias')).length,
          'artigo': results.filter((i) => i.category !== 'Notícias' || (i.classifiedTags || []).includes('artigo') || (i.classifiedTags || []).includes('guia')).length,
          'favoritos': results.filter((i) => i.starred).length,
        };

        // Aplica filtros de tag e busca textual no feed
        const filteredResults = results.filter((item) => {
          if (inFeedSearch.trim()) {
            const q = inFeedSearch.toLowerCase().trim();
            const matchesText =
              (item.title || '').toLowerCase().includes(q) ||
              (item.titleOriginal || '').toLowerCase().includes(q) ||
              (item.summary || '').toLowerCase().includes(q) ||
              (item.whyRelevant || '').toLowerCase().includes(q) ||
              (item.specsSummary?.motor || '').toLowerCase().includes(q) ||
              (item.specsSummary?.bateria || '').toLowerCase().includes(q) ||
              (item.sourceName || '').toLowerCase().includes(q) ||
              (item.regionLabel || '').toLowerCase().includes(q);
            if (!matchesText) return false;
          }

          if (selectedTagFilter === 'all') return true;
          if (selectedTagFilter === 'favoritos') return !!item.starred;

          const itemTags = (item.classifiedTags || []).map((t) => t.toLowerCase());
          const itemType = getItemTypeBadge(item).type;

          if (selectedTagFilter === 'alto-impacto') {
            return item.impactLevel === 'alto' || itemTags.includes('alto impacto');
          }
          if (selectedTagFilter === 'promocao') {
            return itemType === 'promo' || itemTags.includes('promoção') || itemTags.includes('promocao');
          }
          if (selectedTagFilter === 'bateria') {
            return itemType === 'battery' || itemTags.includes('bateria');
          }
          if (selectedTagFilter === 'motor') {
            return itemType === 'motor' || itemTags.includes('motor');
          }
          if (selectedTagFilter === 'pecas') {
            return itemType === 'parts' || itemTags.includes('peças') || itemTags.includes('pecas');
          }
          if (selectedTagFilter === 'e-bike') {
            return itemType === 'bike' || itemTags.includes('e-bike') || itemTags.includes('bicicleta');
          }
          if (selectedTagFilter === 'noticias') {
            return item.category === 'Notícias' || itemTags.includes('notícias') || itemTags.includes('noticias');
          }
          if (selectedTagFilter === 'artigo') {
            return item.category !== 'Notícias' || itemTags.includes('artigo') || itemTags.includes('guia');
          }

          return true;
        });

        const filterTagsList = [
          { key: 'all', label: 'Todas as Pautas', icon: Layers, count: tagCounts.all },
          { key: 'alto-impacto', label: 'Alto Impacto', icon: Flame, count: tagCounts['alto-impacto'], color: 'text-rose-600' },
          { key: 'e-bike', label: 'E-Bikes', icon: Bike, count: tagCounts['e-bike'], color: 'text-cyan-700' },
          { key: 'promocao', label: 'Promoções & Ofertas', icon: Tag, count: tagCounts.promocao, color: 'text-rose-600' },
          { key: 'noticias', label: 'Notícias', icon: FileText, count: tagCounts.noticias, color: 'text-blue-600' },
          { key: 'artigo', label: 'Artigos & Guias', icon: Sparkles, count: tagCounts.artigo, color: 'text-indigo-600' },
          { key: 'bateria', label: 'Baterias & Células', icon: BatteryCharging, count: tagCounts.bateria, color: 'text-emerald-700' },
          { key: 'motor', label: 'Motores & Câmbios', icon: Cpu, count: tagCounts.motor, color: 'text-amber-600' },
          { key: 'pecas', label: 'Peças & Kits', icon: ShieldCheck, count: tagCounts.pecas, color: 'text-purple-600' },
          { key: 'favoritos', label: 'Salvas', icon: Star, count: tagCounts.favoritos, color: 'text-amber-500' },
        ];

        return (
          <div className="space-y-4 pt-2">
            {/* CABEÇALHO DA LISTA + CONTADOR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
              <span className="font-black text-stone-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                Pautas Internacionais Traduzidas & Estruturadas ({filteredResults.length} de {results.length})
              </span>

              {/* BUSCA RÁPIDA DENTRO DAS PAUTAS ENCONTRADAS */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inFeedSearch}
                  onChange={(e) => setInFeedSearch(e.target.value)}
                  placeholder="Filtrar por termo, motor, bateria..."
                  className="w-full pl-9 pr-7 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white transition-all"
                />
                {inFeedSearch && (
                  <button
                    type="button"
                    onClick={() => setInFeedSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* BARRA DE FILTRO POR TAGS EXISTENTES (ALTO IMPACTO, ARTIGO, NOTÍCIAS, E-BIKE, PROMOÇÃO...) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-stone-700 uppercase font-mono tracking-wider">
                <Tag className="w-3 h-3 text-amber-600" />
                <span>Filtrar Pautas por Tags:</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {filterTagsList.map((tag) => {
                  const Icon = tag.icon;
                  const isSelected = selectedTagFilter === tag.key;

                  return (
                    <button
                      key={tag.key}
                      type="button"
                      onClick={() => setSelectedTagFilter(tag.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-xs scale-102'
                          : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : tag.color || 'text-stone-500'}`} />
                      <span>{tag.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                          isSelected ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {tag.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SE NENHUM RESULTADO COMBINAR COM O FILTRO */}
            {filteredResults.length === 0 && (
              <div className="py-8 border-2 border-dashed border-stone-200 rounded-xl text-center p-4 space-y-2 bg-stone-50">
                <p className="text-xs font-bold text-stone-700">
                  Nenhuma pauta encontrada para o filtro de tag selecionado ({selectedTagFilter}) ou termo pesquisado.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTagFilter('all');
                    setInFeedSearch('');
                  }}
                  className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Limpar Filtros
                </button>
              </div>
            )}

            {/* GRADE DE CARDS DAS PAUTAS FILTRADAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredResults.map((item) => {
                const contranStatus = item.specsSummary?.conformidadeContran996;
                const isContranFull = contranStatus?.includes('100% Compatível');
                const itemType = getItemTypeBadge(item);
                const itemTags = item.classifiedTags || [];

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 relative ${
                      item.starred
                        ? 'bg-amber-50/70 border-amber-400 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]'
                        : `bg-white ${itemType.cardBorder}`
                    }`}
                  >
                    {/* TOPO DO CARD: TIPO DE CONTEÚDO E PAÍS DE ORIGEM */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Selo Principal de Tipo de Tecnologia / Produto */}
                          <span className={`px-2.5 py-1 font-mono text-[10px] font-black rounded-lg border shadow-xs ${itemType.badgeBg}`}>
                            {itemType.label}
                          </span>

                          {/* Badge do País & Idioma de Origem */}
                          <span className="px-2 py-0.5 bg-stone-900 text-white font-mono text-[10px] font-bold rounded-lg flex items-center gap-1.5 shadow-2xs">
                            <span className="text-sm">{item.countryFlag}</span>
                            <span>{item.regionLabel}</span>
                            <span className="text-amber-400 font-normal text-[9px]">({item.originalLanguage})</span>
                          </span>

                          {item.starred ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[10px] font-black rounded-md border border-amber-300 flex items-center gap-1">
                              ⭐ Permanente
                            </span>
                          ) : item.impactLevel === 'alto' ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-mono text-[10px] font-black rounded-md border border-rose-300 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-rose-600" />
                              48h Retenção
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-stone-100 text-stone-700 font-mono text-[10px] font-bold rounded-md border border-stone-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-500" />
                              24h Retenção
                            </span>
                          )}

                          {/* Badge CONTRAN 996 */}
                          {contranStatus && (
                            <span
                              className={`px-2 py-0.5 font-mono text-[9px] font-bold rounded-md flex items-center gap-1 ${
                                isContranFull
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {contranStatus}
                            </span>
                          )}
                        </div>

                        {/* Botão de Favoritar */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(item.id, e)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                            item.starred
                              ? 'bg-amber-400 border-stone-900 text-stone-900 shadow-[1px_1px_0px_0px_rgba(28,25,23,1)]'
                              : 'bg-stone-50 border-stone-200 hover:bg-amber-100 text-stone-400 hover:text-amber-600'
                          }`}
                          title={item.starred ? 'Favoritada (Permanente no site)' : 'Favoritar pauta (Permanente no site)'}
                        >
                          <Star className={`w-4 h-4 ${item.starred ? 'fill-stone-900' : ''}`} />
                        </button>
                      </div>

                      {/* TÍTULO EM PORTUGUÊS DO BRASIL */}
                      <div>
                        <h3 className="font-extrabold text-stone-950 text-base sm:text-lg leading-snug">
                          {item.title}
                        </h3>

                        {/* Título original em idioma nativo */}
                        {item.titleOriginal && item.titleOriginal !== item.title && (
                          <p className="text-[11px] text-stone-500 font-mono mt-0.5 italic line-clamp-1">
                            <span className="font-bold text-stone-400">Original ({item.originalLanguage}):</span> &quot;{item.titleOriginal}&quot;
                          </p>
                        )}
                      </div>

                      {/* TAGS CLASSIFICADAS DO ITEM (CLICÁVEIS PARA FILTRAR) */}
                      {itemTags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {itemTags.map((tag, idx) => {
                            const isSelected = selectedTagFilter === tag.toLowerCase().replace(/\s+/g, '-');
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  const normalizedTag = tag.toLowerCase().replace(/\s+/g, '-');
                                  setSelectedTagFilter(selectedTagFilter === normalizedTag ? 'all' : normalizedTag);
                                }}
                                className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-stone-900 text-amber-300 border-stone-900'
                                    : 'bg-stone-100 hover:bg-amber-100 text-stone-600 border-stone-200'
                                }`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* SOBRE O QUE SE TRATA (BOX DE IDENTIFICAÇÃO IMEDIATA) */}
                      <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                          <FileText className="w-3 h-3 text-stone-500" />
                          <span>Em Resumo: O que é essa novidade?</span>
                        </div>
                        <p className="text-xs text-stone-800 leading-relaxed font-medium">
                          {item.summary}
                        </p>
                      </div>

                      {/* IMPACTO DIRETO NO BRASIL */}
                      <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-1 text-[11px]">
                        <span className="font-bold text-amber-950 flex items-center gap-1 font-mono uppercase">
                          💡 Aplicação & Mercado Brasileiro:
                        </span>
                        <p className="text-amber-950 font-medium leading-relaxed">
                          {item.whyRelevant}
                        </p>
                      </div>

                      {/* ESPECIFICAÇÕES TÉCNICAS EXTRAÍDAS */}
                      {item.specsSummary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                          <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg">
                            <span className="text-stone-400 block font-bold text-[9px]">MOTOR / TORQUE</span>
                            <span className="font-black text-stone-900 truncate block">
                              {item.specsSummary.motor || 'Avançado'}
                            </span>
                          </div>
                          <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg">
                            <span className="text-stone-400 block font-bold text-[9px]">BATERIA / CÉLULA</span>
                            <span className="font-black text-stone-900 truncate block">
                              {item.specsSummary.bateria || 'Lítio / Sódio'}
                            </span>
                          </div>
                          <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg">
                            <span className="text-stone-400 block font-bold text-[9px]">AUTONOMIA / PESO</span>
                            <span className="font-black text-stone-900 truncate block">
                              {item.specsSummary.autonomiaEstimadaKm || '100+ km'} | {item.specsSummary.pesoKg || 'Leve'}
                            </span>
                          </div>
                          <div className="p-2 bg-stone-50 border border-stone-200 rounded-lg">
                            <span className="text-stone-400 block font-bold text-[9px]">ESTIMATIVA BRASIL</span>
                            <span className="font-black text-emerald-700 truncate block">
                              {item.specsSummary.precoEstimadoBRL || 'Sob consulta'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* PONTOS TÉCNICOS CHAVE */}
                      {item.keyPoints && item.keyPoints.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-bold text-stone-400 uppercase font-mono">Destaques da Tecnologia:</span>
                          <ul className="space-y-1 text-xs text-stone-700">
                            {item.keyPoints.map((pt, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-500 font-bold">•</span>
                                <span className="text-[11px]">{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* RODAPÉ DO CARD: LINKS E AÇÕES COM 1 CLIQUE */}
                    <div className="pt-3 border-t border-stone-100 flex flex-col gap-3">
                      {/* Fonte Internacional e Botão Copiar */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono flex-wrap gap-2">
                        <span className="flex items-center gap-1">
                          <span>Fonte:</span>
                          {item.sourceUrl ? (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline font-bold flex items-center gap-1"
                            >
                              {item.sourceName || 'Portal Internacional'}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span>{item.sourceName || 'Web Global'}</span>
                          )}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Copiar para WhatsApp / Redes */}
                          <button
                            type="button"
                            onClick={(e) =>
                              copyText(
                                `${item.socialSnippet || `🚴 Novidade Internacional: ${item.title}\n\n${item.summary}\n\n💡 Impacto Brasil: ${item.whyRelevant}`}\n\nFonte: ${item.sourceUrl}`,
                                item.id,
                                e
                              )
                            }
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md border border-stone-200 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            title="Copiar texto formatado para WhatsApp ou redes sociais"
                          >
                            <Share2 className="w-3 h-3 text-stone-600" />
                            <span>{copiedId === item.id ? 'Copiado!' : 'Redes / Zap'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => copyText(`${item.title}\n\n${item.summary}\n\nFonte: ${item.sourceUrl}`, `${item.id}_raw`, e)}
                            className="text-stone-400 hover:text-stone-800 flex items-center gap-1 text-[10px]"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedId === `${item.id}_raw` ? 'Copiado!' : 'Copiar Pauta'}</span>
                          </button>
                        </div>
                      </div>

                      {/* BOTÕES DE DISPARO PARA PRODUÇÃO EDITORIAL */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleDispatch(item, 'article_writer')}
                          className="py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white font-mono font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>Redigir Artigo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDispatch(item, 'ebike_analysis')}
                          className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white font-mono font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>Ficha E-Bike</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDispatch(item, 'top_ranking')}
                          className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-stone-950 font-mono font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trophy className="w-3.5 h-3.5 text-stone-950" />
                          <span>Top Ranking</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ESTADO VAZIO */}
      {!loading && results.length === 0 && !error && (
        <div className="py-12 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-3 bg-stone-50">
          <div className="w-14 h-14 bg-white border border-stone-200 rounded-2xl flex items-center justify-center text-stone-300">
            <Globe2 className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h4 className="font-extrabold text-stone-900 text-sm">
              Pronto para Pesquisar os Maiores Polos de E-Bikes
            </h4>
            <p className="text-xs text-stone-500 mt-1 max-w-md">
              Selecione o polo desejado (China 🇨🇳, Japão 🇯🇵, Coreia 🇰🇷, EUA 🇺🇸, Europa 🇪🇺 ou Rússia 🇷🇺) e clique no botão acima para trazer novidades traduzidas para o Brasil.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
