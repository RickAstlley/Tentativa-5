'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  Sparkles,
  Zap,
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  SlidersHorizontal,
  ExternalLink,
  Cpu,
  Layers,
  Info,
  Bike,
  Flame,
  Check,
  Award,
} from 'lucide-react';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';
import { RankingCategory } from '@/types/ranking';

export interface RankingAiAssistantCardProps {
  onRankingGenerated: (data: any) => void;
  className?: string;
  initialQuery?: string;
}

interface QuickSuggestionCategory {
  category: string;
  icon: string;
  items: string[];
}

const QUICK_RANKING_SUGGESTIONS: QuickSuggestionCategory[] = [
  {
    category: 'Melhores & Custo-Benefício',
    icon: '🏆',
    items: [
      'Top 5 Melhores E-Bikes Urbanas até R$ 6.000',
      'Top 5 E-Bikes Custo-Benefício para Trabalhar com Entregas 2026',
      'Top 3 Melhores Bicicletas Elétricas Nacionais com Motor 350W',
    ],
  },
  {
    category: 'Alta Potência & Fat Bikes',
    icon: '⚡',
    items: [
      'Top 5 E-Bikes Fat Bike com Mais de 750W de Potência',
      'Top 3 E-Bikes para Subidas Fortes e Ladeiras Íngremes',
      'Top 5 Melhores Bicicletas Elétricas Off-Road e Trilha',
    ],
  },
  {
    category: 'Dobráveis & Portáteis',
    icon: '🏙️',
    items: [
      'Top 5 E-Bikes Dobráveis Mais Leves para Metrô e Porta-Malas',
      'Top 3 Bicicletas Elétricas Urbanas Mais Confortáveis de 2026',
      'Top 5 E-Bikes com Maior Autonomia de Bateria no Brasil',
    ],
  },
];

export default function RankingAiAssistantCard({
  onRankingGenerated,
  className = '',
  initialQuery = '',
}: RankingAiAssistantCardProps) {
  const [prompt, setPrompt] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<RankingCategory>('ebikes');
  const [quantity, setQuantity] = useState<number>(5);
  const [focusArea, setFocusArea] = useState<'geral' | 'custo_beneficio' | 'potencia' | 'autonomia' | 'urbana'>('geral');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSuggestionTab, setActiveSuggestionTab] = useState(0);
  const [showOptions, setShowOptions] = useState(false);

  // Radar Global Prefill Detection
  const [hasRadarPrefill, setHasRadarPrefill] = useState(false);
  const [radarPautaInfo, setRadarPautaInfo] = useState<{
    title: string;
    sourceName?: string;
    sourceUrl?: string;
    summary?: string;
  } | null>(null);

  // Success summary
  const [successSummary, setSuccessSummary] = useState<{
    title: string;
    itemsCount: number;
    category: string;
    models: string[];
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cronômetro
  useEffect(() => {
    if (isGenerating) {
      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isGenerating]);

  // Checa pauta vinda do Radar Global ao carregar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('tuavia_prefill_ranking') || localStorage.getItem('tuavia_prefill_ranking');
        if (stored) {
          const parsed = JSON.parse(stored);
          const pautaTitle = parsed.title || parsed.titulo || parsed.prompt || '';
          if (pautaTitle) {
            setPrompt(pautaTitle);
            if (parsed.category) {
              setSelectedCategory(parsed.category as RankingCategory);
            }
            if (parsed.quantidade) {
              setQuantity(Number(parsed.quantidade) || 5);
            }
            setHasRadarPrefill(true);
            setRadarPautaInfo({
              title: pautaTitle,
              sourceName: parsed.sourceName || 'Radar Global',
              sourceUrl: parsed.sourceUrl || '',
              summary: parsed.excerpt || parsed.summary || '',
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar pré-preenchimento do Radar Global para ranking:', err);
      }
    }
  }, []);

  const handleGenerate = async (queryToUse?: string) => {
    const finalPrompt = (queryToUse || prompt).trim();
    if (!finalPrompt) {
      setErrorMessage('Digite o título, nicho ou selecione uma sugestão para estruturar e gerar o Top Ranking.');
      return;
    }

    setErrorMessage(null);
    setSuccessSummary(null);
    setIsGenerating(true);
    setProgress(5);
    setCurrentStage('[Ping 1/N] Planejando estrutura, critérios e seleção dos modelos com GLM 5.3...');

    abortControllerRef.current = new AbortController();

    try {
      const completedJob = await createAndPollLLMJob({
        type: 'ranking_generation',
        input: {
          query: finalPrompt,
          categoria: selectedCategory,
          quantidade: quantity,
          focusArea,
        },
        signal: abortControllerRef.current.signal,
        onProgress: (job) => {
          if (job.stage) {
            setCurrentStage(job.stage);
          }
          if (typeof job.progress === 'number') {
            setProgress(job.progress);
          }
        },
        pollIntervalMs: 1400,
        maxPollAttempts: 300,
      });

      if (completedJob.status === 'completed' && completedJob.result?.data) {
        const rankingData = completedJob.result.data;
        const rankingItens = Array.isArray(rankingData.itens) ? rankingData.itens : [];
        const modelNames = rankingItens.map((it: any) => it.tituloItem || `${it.marca || ''} ${it.modelo || ''}`.trim());

        onRankingGenerated(rankingData);

        setSuccessSummary({
          title: rankingData.titulo || finalPrompt,
          itemsCount: rankingItens.length,
          category: rankingData.categoria || selectedCategory,
          models: modelNames,
        });

        // Limpa cache de prefill após sucesso
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tuavia_prefill_ranking');
          localStorage.removeItem('tuavia_prefill_ranking');
        }
        setHasRadarPrefill(false);
      } else {
        throw new Error(completedJob.error || 'Não foi possível concluir a geração do Top Ranking.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('cancelada')) {
        setErrorMessage('Geração cancelada pelo usuário.');
      } else {
        console.error('Erro no Gerador de Ranking IA:', err);
        setErrorMessage(err.message || 'Falha na comunicação com o provedor de IA. Tente novamente.');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setCurrentStage('Cancelamento solicitado.');
  };

  const clearRadarPrefill = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('tuavia_prefill_ranking');
      localStorage.removeItem('tuavia_prefill_ranking');
    }
    setHasRadarPrefill(false);
    setRadarPautaInfo(null);
  };

  return (
    <div
      id="ranking-ai-assistant-card"
      className={`bg-stone-900 border-2 border-amber-400 rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(251,191,36,1)] text-stone-100 transition-all ${className}`}
    >
      {/* CABEÇALHO DO CARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-inner">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-amber-400 tracking-wide uppercase">
                Redator IA de Top Rankings & Comparativos
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400/10 border border-amber-400/30 text-amber-300">
                GLM 5.3 + Multi-Ping
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Pesquisa web profunda em tempo real, geração por pings isolados para cada e-bike, ficha técnica no catálogo e comparativo analítico no ranking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold border border-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Opções</span>
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* BANNER DE PAUTA DETECTADA DO RADAR GLOBAL */}
      {hasRadarPrefill && radarPautaInfo && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-400/10 border border-amber-400/40 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded">
                  Pauta do Radar Global Carregada
                </span>
                {radarPautaInfo.sourceName && (
                  <span className="text-[11px] text-stone-400 font-medium">
                    Fonte: {radarPautaInfo.sourceName}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-stone-200 mt-1 line-clamp-1">
                {radarPautaInfo.title}
              </p>
              {radarPautaInfo.summary && (
                <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {radarPautaInfo.summary}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearRadarPrefill}
            title="Remover pauta pré-carregada"
            className="text-stone-400 hover:text-rose-400 p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* OPÇÕES AVANÇADAS EXPANSÍVEIS */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-4 bg-stone-950/70 border border-stone-800 rounded-xl space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Quantidade de E-Bikes no Pódio */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                    Quantidade de E-Bikes no Ranking
                  </label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-200 text-xs font-bold focus:border-amber-400 focus:outline-none"
                  >
                    <option value={3}>Top 3 (Rápido e Conciso)</option>
                    <option value={5}>Top 5 (Padrão Recomendado)</option>
                    <option value={7}>Top 7 (Completo)</option>
                    <option value={10}>Top 10 (Guia Definitivo)</option>
                  </select>
                </div>

                {/* Categoria do Ranking */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                    Categoria do Ranking
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as RankingCategory)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-200 text-xs font-bold focus:border-amber-400 focus:outline-none"
                  >
                    <option value="ebikes">E-Bikes Completas</option>
                    <option value="custo-beneficio">Melhor Custo-Benefício</option>
                    <option value="baterias">Baterias & Autonomia</option>
                    <option value="pecas">Peças & Motores</option>
                    <option value="acessorios">Acessórios Urbanos</option>
                    <option value="seguranca">Segurança & Travas</option>
                  </select>
                </div>

                {/* Foco Avaliativo */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-amber-300 mb-1">
                    Foco Avaliativo do Ranking
                  </label>
                  <select
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value as any)}
                    disabled={isGenerating}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-200 text-xs font-bold focus:border-amber-400 focus:outline-none"
                  >
                    <option value="geral">Equilíbrio Geral e Mercado BR</option>
                    <option value="custo_beneficio">Preço Baixo e Custo-Benefício</option>
                    <option value="potencia">Força, Subidas e Alta Potência (W)</option>
                    <option value="autonomia">Autonomia Extrema e Bateria (Wh)</option>
                    <option value="urbana">Mobilidade Urbana & Conforto Diário</option>
                  </select>
                </div>
              </div>

              {/* Informação sobre Arquitetura Multi-Ping e Separação de Conteúdo */}
              <div className="p-3 bg-stone-900/90 border border-amber-400/20 rounded-lg text-[11px] text-stone-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-amber-300">Arquitetura de Pings Separados:</strong> Cada e-bike é formulada via chamada individual com busca web de preços no Mercado Livre e lojas parceiras. A ficha técnica (motor, bateria, fotos, SEO e ofertas) é gravada na coleção de catálogo <code className="text-amber-400">/bikes</code>. O texto analítico da análise comparativa fica restrito ao campo <code className="text-amber-400">observacoes</code> de cada item do ranking.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT PRINCIPAL COM BOTÃO DE REDIGIR */}
      <div className="space-y-3">
        <label className="block text-xs font-black uppercase tracking-wider text-amber-400">
          Título, Tema ou Critério do Ranking
        </label>
        <div className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isGenerating && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            disabled={isGenerating}
            placeholder="Ex: Top 5 Melhores E-Bikes Urbanas para Comprar em 2026..."
            className="w-full pl-4 pr-32 py-3 bg-stone-950 border-2 border-stone-700 focus:border-amber-400 rounded-xl text-stone-100 placeholder-stone-500 font-bold text-sm outline-none transition-all disabled:opacity-50"
          />

          <div className="absolute right-2 top-2 bottom-2 flex items-center">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={!prompt.trim()}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-black text-xs rounded-lg border border-amber-300 flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(251,191,36,0.6)] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Gerar Ranking</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FEEDBACK DE GERAÇÃO EM ANDAMENTO (PROGRESSO E MULTI-PING) */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-stone-800 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-amber-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                {currentStage || 'Processando pipeline por pings sequenciais...'}
              </span>
              <span className="text-stone-400 font-mono">
                {elapsedSeconds}s · {progress}%
              </span>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300"
                style={{ width: `${Math.max(5, progress)}%` }}
                transition={{ ease: 'easeOut', duration: 0.3 }}
              />
            </div>

            <p className="text-[11px] text-stone-400 font-medium">
              A IA está executando o ciclo sequencial de pings: pesquisa web, auditoria dos modelos, obtenção de especificações, scraping de preços nas lojas parceiras e gravação das e-bikes no catálogo.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MENSAGEM DE ERRO */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-950/80 border border-rose-700/60 rounded-xl text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* RESUMO DE SUCESSO */}
      {successSummary && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 font-black flex items-center gap-1.5 uppercase text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Top Ranking Gerado e Sincronizado com Sucesso!
            </span>
            <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-700">
              {successSummary.itemsCount} e-bikes enriquecidas
            </span>
          </div>

          <p className="text-stone-200 font-bold text-sm">
            {successSummary.title}
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {successSummary.models.map((mod, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-stone-900 border border-stone-700 rounded-md text-[11px] text-stone-300 font-medium flex items-center gap-1"
              >
                <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                {mod}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-stone-400">
            Os dados foram preenchidos automaticamente no formulário abaixo. Cada modelo foi cadastrado no catálogo de e-bikes solo com suas especificações e ofertas, enquanto as análises comparativas foram alocadas exclusivamente nas observações do ranking.
          </p>
        </motion.div>
      )}

      {/* SUGESTÕES RÁPIDAS DE TOP RANKINGS POR NICHO */}
      {!isGenerating && (
        <div className="mt-4 pt-4 border-t border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase text-stone-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Sugestões de Pautas para Top Ranking
            </span>

            <div className="flex gap-1">
              {QUICK_RANKING_SUGGESTIONS.map((cat, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSuggestionTab(idx)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    activeSuggestionTab === idx
                      ? 'bg-amber-400 text-stone-950'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {cat.icon} {cat.category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUICK_RANKING_SUGGESTIONS[activeSuggestionTab].items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setPrompt(item);
                  handleGenerate(item);
                }}
                className="p-2.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 hover:border-amber-400/60 rounded-xl text-left text-xs font-medium text-stone-300 hover:text-amber-300 transition-all flex items-start gap-2 group cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
