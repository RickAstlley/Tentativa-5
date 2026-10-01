'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  Globe,
  FileText,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Tag,
  ShieldCheck,
  Flame,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';
import { ARTICLE_CATEGORIES, ArticleCategory } from '@/types/article';

export interface ArticleAiAssistantCardProps {
  onArticleGenerated: (data: {
    title: string;
    slug?: string;
    excerpt?: string;
    category?: ArticleCategory;
    body: string;
    readingTimeMinutes?: number;
    relatedBikeCategories?: string[];
    seoKeywords?: string[];
  }) => void;
  className?: string;
  initialQuery?: string;
}

interface QuickSuggestionCategory {
  category: string;
  icon: string;
  items: string[];
}

const QUICK_SUGGESTIONS: QuickSuggestionCategory[] = [
  {
    category: 'Lançamentos & Motores 2026',
    icon: '⚡',
    items: [
      'DJI Avinox: A revolução dos motores centrais de 120Nm para E-MTB',
      'Bafang M820: O novo motor ultra-leve para e-bikes urbanas e de estrada',
      'Bosch Performance Line CX Gen 5: O que muda no mercado brasileiro',
      'Baterias de Células 21700 vs 18650: Qual garante maior vida útil?',
    ],
  },
  {
    category: 'Guias de Compra & Comparativos',
    icon: '🚲',
    items: [
      'Caloi E-Vibe City Tour vs Sense Move: Qual a melhor e-bike urbana de 2026?',
      'E-Bikes de Entrada até R$ 7.000: Guia completo de modelos que valem a pena',
      'Kit de Conversão Elétrica vs E-Bike de Fábrica: Análise de custo, segurança e durabilidade',
    ],
  },
  {
    category: 'Legislação & Manutenção',
    icon: '⚖️',
    items: [
      'Resolução CONTRAN 996/2023: Tudo o que você precisa saber sobre regras para e-bikes',
      'Como cuidar da bateria da sua e-bike para durar mais de 5 anos: Guia de recarga e armazenamento',
      'Freios Hidráulicos com Sensor de Corte em E-Bikes: Por que eles são vitais para segurança?',
    ],
  },
];

export default function ArticleAiAssistantCard({
  onArticleGenerated,
  className = '',
  initialQuery = '',
}: ArticleAiAssistantCardProps) {
  const [prompt, setPrompt] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory>('Notícias');
  const [targetAudience, setTargetAudience] = useState('Ciclistas urbanos, cicloturistas e compradores de e-bikes no Brasil');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [activeSuggestionTab, setActiveSuggestionTab] = useState(0);

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
    category: string;
    wordCount: number;
    readingTime: number;
    slug: string;
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
        const stored = sessionStorage.getItem('tuavia_prefill_article') || localStorage.getItem('tuavia_prefill_article');
        if (stored) {
          const parsed = JSON.parse(stored);
          const pautaTitle = parsed.title || parsed.titulo || parsed.prompt || '';
          if (pautaTitle) {
            setPrompt(pautaTitle);
            if (parsed.category && ARTICLE_CATEGORIES.includes(parsed.category)) {
              setSelectedCategory(parsed.category as ArticleCategory);
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
        console.warn('Erro ao carregar pré-preenchimento do Radar Global:', err);
      }
    }
  }, []);

  const handleGenerate = async (queryToUse?: string) => {
    const finalPrompt = (queryToUse || prompt).trim();
    if (!finalPrompt) {
      setErrorMessage('Digite o título, tema ou selecione uma pauta do Radar para redigir o artigo.');
      return;
    }

    setErrorMessage(null);
    setSuccessSummary(null);
    setIsGenerating(true);
    setProgress(5);
    setCurrentStage('[Ping 1/2] Iniciando redação técnica com GLM 5.3...');

    abortControllerRef.current = new AbortController();

    try {
      const completedJob = await createAndPollLLMJob({
        type: 'article_autofill',
        input: {
          query: finalPrompt,
          category: selectedCategory,
          targetAudience: targetAudience.trim() || undefined,
          articleType: 'Artigo Jornalístico e Técnico Profundo com Formatação GFM',
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
        pollIntervalMs: 1200,
        maxPollAttempts: 180,
      });

      if (completedJob.status === 'completed' && completedJob.result?.data) {
        const articleData = completedJob.result.data;
        const bodyContent = articleData.body || articleData.markdownContent || '';
        const words = bodyContent.trim().split(/\s+/).filter(Boolean).length;
        const readingTime = articleData.readingTimeMinutes || Math.max(3, Math.ceil(words / 200));

        const formattedCategory = (
          ARTICLE_CATEGORIES.includes(articleData.category) ? articleData.category : selectedCategory
        ) as ArticleCategory;

        onArticleGenerated({
          title: articleData.title || finalPrompt,
          slug: articleData.slug,
          excerpt: articleData.excerpt,
          category: formattedCategory,
          body: bodyContent,
          readingTimeMinutes: readingTime,
          relatedBikeCategories: Array.isArray(articleData.relatedBikeCategories)
            ? articleData.relatedBikeCategories
            : ['Urbana'],
          seoKeywords: Array.isArray(articleData.seoKeywords) ? articleData.seoKeywords : [],
        });

        setSuccessSummary({
          title: articleData.title || finalPrompt,
          category: formattedCategory,
          wordCount: words,
          readingTime,
          slug: articleData.slug || '',
        });

        // Limpa cache de prefill após sucesso
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tuavia_prefill_article');
          localStorage.removeItem('tuavia_prefill_article');
        }
        setHasRadarPrefill(false);
      } else {
        throw new Error(completedJob.error || 'Não foi possível concluir a redação do artigo.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('cancelada')) {
        setErrorMessage('Geração cancelada pelo usuário.');
      } else {
        console.error('Erro no Redator IA (GLM 5.3):', err);
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
  };

  return (
    <div
      id="article-ai-assistant-card"
      className={`bg-stone-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl text-stone-100 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-stone-100 tracking-tight">
                Redator IA Editorial
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full">
                GLM 5.3 (2 Pings: Conteúdo + SEO)
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Redação jornalística completa em Markdown GFM com otimização de metadados e SEO para o Google Brasil
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {hasRadarPrefill && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 rounded-lg animate-pulse">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              Pauta do Radar Pronta
            </span>
          )}
        </div>
      </div>

      {/* Radar Global Pauta Banner (se detectada) */}
      {hasRadarPrefill && radarPautaInfo && !isGenerating && (
        <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-stone-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Globe className="w-3.5 h-3.5" />
              <span>PAUTA IMPORTADA DO RADAR GLOBAL</span>
              {radarPautaInfo.sourceName && (
                <span className="text-stone-400 font-normal">({radarPautaInfo.sourceName})</span>
              )}
            </div>
            <p className="text-sm font-semibold text-stone-200 line-clamp-1">
              {radarPautaInfo.title}
            </p>
            {radarPautaInfo.summary && (
              <p className="text-xs text-stone-400 line-clamp-2">
                {radarPautaInfo.summary}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-emerald-300 text-emerald-300" />
            <span>Redigir Agora (1-Clique)</span>
          </button>
        </div>
      )}

      {/* Input principal de Pauta / Título */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-stone-300 mb-1.5">
            Título, Tema ou Pauta do Artigo
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              rows={2}
              placeholder="Ex: Lançamento do motor DJI Avinox 120Nm: A gigante dos drones invade o mercado de e-bikes premium"
              className="w-full bg-stone-950/80 border border-stone-700/80 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 transition-all resize-none"
            />
          </div>
        </div>

        {/* Seleção de Categoria e Opções Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400 font-medium">Categoria:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ArticleCategory)}
              disabled={isGenerating}
              className="bg-stone-950 border border-stone-700 text-xs font-medium text-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 transition-colors"
            >
              {ARTICLE_CATEGORIES.map((cat: ArticleCategory) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 transition-colors"
          >
            <span>{showOptions ? 'Ocultar Diretrizes' : 'Personalizar Público / Tom'}</span>
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Opções Avançadas Colapsáveis */}
        <AnimatePresence>
          {showOptions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-1"
            >
              <div className="p-3 bg-stone-950/60 rounded-xl border border-stone-800 space-y-2">
                <label className="block text-[11px] font-medium text-stone-400">
                  Público-Alvo e Tom Editorial
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  disabled={isGenerating}
                  placeholder="Ex: Ciclistas urbanos, compradores de primeira e-bike e cicloturistas no Brasil"
                  className="w-full bg-stone-900 border border-stone-700/60 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sugestões Rápidas de Pautas */}
        {!isGenerating && !hasRadarPrefill && (
          <div className="pt-2 border-t border-stone-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                Pautas em Alta no Mercado Brasileiro
              </span>
              <div className="flex gap-1">
                {QUICK_SUGGESTIONS.map((s, idx) => (
                  <button
                    key={s.category}
                    type="button"
                    onClick={() => setActiveSuggestionTab(idx)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      activeSuggestionTab === idx
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {s.icon} {s.category.split('&')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {QUICK_SUGGESTIONS[activeSuggestionTab].items.map((itemText) => (
                <button
                  key={itemText}
                  type="button"
                  onClick={() => {
                    setPrompt(itemText);
                    setErrorMessage(null);
                  }}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-stone-950/40 hover:bg-stone-950 border border-stone-800 hover:border-amber-500/40 text-xs text-stone-300 hover:text-stone-100 transition-all line-clamp-1 cursor-pointer"
                >
                  ⚡ {itemText}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Progresso e Estágios em Tempo Real */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 bg-stone-950 rounded-xl border border-amber-500/30 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                <span>{currentStage || 'Processando na LLM GLM 5.3...'}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>{elapsedSeconds}s</span>
                <span className="text-amber-400 font-bold">{progress}%</span>
              </div>
            </div>

            <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
                initial={{ width: '5%' }}
                animate={{ width: `${Math.max(5, progress)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
              <span>Ping 1: Redação do Artigo ➔ Ping 2: SEO & Metadados</span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Erro ao gerar artigo</p>
              <p className="text-red-300/90">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Resumo de Sucesso */}
        {successSummary && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Artigo e SEO Gerados com Sucesso pelo GLM 5.3!
              </span>
              <span className="text-[11px] text-stone-400">Campos preenchidos no formulário</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-stone-300">
              <div className="bg-stone-900/60 p-2 rounded-lg">
                <span className="text-stone-400 block">Categoria</span>
                <span className="font-bold text-stone-100">{successSummary.category}</span>
              </div>
              <div className="bg-stone-900/60 p-2 rounded-lg">
                <span className="text-stone-400 block">Extensão</span>
                <span className="font-bold text-stone-100">~{successSummary.wordCount} palavras</span>
              </div>
              <div className="bg-stone-900/60 p-2 rounded-lg">
                <span className="text-stone-400 block">Leitura</span>
                <span className="font-bold text-stone-100">{successSummary.readingTime} min</span>
              </div>
              <div className="bg-stone-900/60 p-2 rounded-lg">
                <span className="text-stone-400 block">URL (Slug)</span>
                <span className="font-bold text-stone-100 truncate block">/{successSummary.slug}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Botão de Disparo */}
        {!isGenerating && (
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating || !prompt.trim()}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-stone-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-stone-950 text-stone-950" />
              <span>Redigir Artigo Completo com GLM 5.3</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
