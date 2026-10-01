'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  Search,
  Bot,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
  Check,
  SlidersHorizontal,
  ExternalLink,
  Cpu,
  Layers,
  ArrowRight,
  Info,
  Flame,
  Bike,
  Gauge,
  BatteryCharging,
  Sparkle,
  Copy,
} from 'lucide-react';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { ExtractedImageFile } from '@/lib/admin/fileIngestion';

export interface BikeAiAssistantCardProps {
  onDataExtracted: (data: any, images?: ExtractedImageFile[]) => void;
  className?: string;
  initialQuery?: string;
}

interface QuickSuggestionCategory {
  category: string;
  icon: string;
  items: string[];
}

const CATEGORIZED_SUGGESTIONS: QuickSuggestionCategory[] = [
  {
    category: 'Mais Buscadas',
    icon: '⚡',
    items: [
      'Caloi E-Vibe City Tour 2026',
      'Sense Move 2026',
      'Oggi Big Wheel 8.0 Sram',
      'Duos Confort Full 800W',
    ],
  },
  {
    category: 'Fat Bike & Alta Potência',
    icon: '🔥',
    items: [
      'LAF L10 MAX 1000W 48V',
      'Engwe Engine Pro 750W',
      'Soul Volcano E-Bike',
    ],
  },
  {
    category: 'Urbanas & Dobráveis',
    icon: '🏙️',
    items: [
      'Lev E-Bike Urbana 350W',
      'Sense Easy Dobrável 2026',
      'Caloi E-Vibe Urbam 2026',
    ],
  },
];

const SAMPLE_TECH_TEXT = `Modelo: Caloi E-Vibe City Tour 2026
Motor: Cubo Traseiro 350W 36V com 5 níveis de assistência
Bateria: Lítio 36V 10.4Ah (374Wh), removível com chave
Autonomia: Até 55 km no modo Eco
Quadro: Alumínio 6061 tratado T6 com cabeamento interno
Suspensão: Garfo dianteiro com 50mm de curso
Pneus: 700x42c com faixa refletiva
Freios: A disco hidráulicos com sensor de corte do motor
Câmbio: Shimano Tourney 7 velocidades
Painel: Display LCD com velocímetro, odômetro e nível de bateria`;

export default function BikeAiAssistantCard({
  onDataExtracted,
  className = '',
  initialQuery = '',
}: BikeAiAssistantCardProps) {
  const [prompt, setPrompt] = useState(initialQuery);
  const [generationMode, setGenerationMode] = useState<'web_search' | 'direct_text'>('web_search');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState(0);
  const [showArchGuide, setShowArchGuide] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    model: string;
    brand: string;
    sectionsCount: number;
    hasImages: boolean;
    hasPrices: boolean;
    hasSeo: boolean;
    potenciaW?: number;
    autonomiaKm?: number;
    bateria?: string;
  } | null>(null);

  // Opções Avançadas
  const [showOptions, setShowOptions] = useState(false);
  const [includeSeo, setIncludeSeo] = useState(true);
  const [includePrices, setIncludePrices] = useState(true);

  // Ref para cancelamento
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cronômetro durante geração
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

  // Limpeza de polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsGenerating(false);
    setProgress(0);
    setCurrentStage('Geração cancelada pelo usuário.');
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    setErrorMessage(null);
  };

  const handleInsertSampleText = () => {
    setPrompt(SAMPLE_TECH_TEXT);
    setErrorMessage(null);
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMessage('Por favor, informe o nome/modelo da E-Bike ou cole as especificações técnicas.');
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setCurrentStage('Iniciando orquestrador de IA e validando parâmetros...');
    setErrorMessage(null);
    setSuccessInfo(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      if (generationMode === 'direct_text' || cleanPrompt.length > 300) {
        // Modo Extração Direta de Texto (Ingestão Rápida)
        setCurrentStage('Executando extração dos 10 blocos canônicos a partir do texto fornecido...');
        setProgress(35);

        const ingestRes = await fetchAdminJson('/api/admin/llm/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ebike',
            rawText: cleanPrompt,
            engine: 'auto',
          }),
          signal: abortController.signal,
          timeoutMs: 180000,
        });

        if (!ingestRes.ok || !ingestRes.data) {
          throw new Error(ingestRes.error || 'Falha na extração dos dados da e-bike.');
        }

        setProgress(100);
        setCurrentStage('Ficha técnica extraída com sucesso!');
        
        const extractedData = ingestRes.data?.data || ingestRes.data;
        onDataExtracted(extractedData);

        setSuccessInfo({
          model: extractedData.modelo || 'Modelo Identificado',
          brand: extractedData.marca || 'Marca Identificada',
          sectionsCount: extractedData.specSections?.length || 10,
          hasImages: false,
          hasPrices: Array.isArray(extractedData.ofertas) && extractedData.ofertas.length > 0,
          hasSeo: !!extractedData.seoReport,
          potenciaW: extractedData.potenciaW,
          autonomiaKm: extractedData.autonomiaKm,
        });
      } else {
        // Modo Pesquisa Web + Extração Completa Multi-Estágio via Job
        setCurrentStage('Criando tarefa de pesquisa web e extração de especificações oficiais...');
        setProgress(10);

        const jobCreateRes = await fetchAdminJson('/api/admin/llm/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ebike_autofill',
            input: {
              query: cleanPrompt,
              includeImages: false,
              includeSeo,
              includePrices,
            },
          }),
          signal: abortController.signal,
          timeoutMs: 120000,
        });

        if (!jobCreateRes.ok || !jobCreateRes.data?.jobId) {
          // Se falhou ao criar job assíncrono, tenta execução síncrona direta como fallback
          setCurrentStage('Fila assíncrona ocupada, executando pipeline direto com IA...');
          setProgress(25);

          const syncRes = await fetchAdminJson('/api/admin/llm/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ebike_autofill',
              input: {
                query: cleanPrompt,
                includeImages: false,
                includeSeo,
                includePrices,
              },
              sync: true,
            }),
            signal: abortController.signal,
            timeoutMs: 240000,
          });

          if (!syncRes.ok || !syncRes.data?.result?.data) {
            throw new Error(syncRes.error || 'Não foi possível gerar a ficha técnica via IA.');
          }

          const completedData = syncRes.data.result.data;
          setProgress(100);
          setCurrentStage('Ficha técnica gerada e consolidada com sucesso!');
          onDataExtracted(completedData, []);

          setSuccessInfo({
            model: completedData.modelo || cleanPrompt,
            brand: completedData.marca || 'Fabricante',
            sectionsCount: completedData.specSections?.length || 10,
            hasImages: false,
            hasPrices: Array.isArray(completedData.priceHistory) && completedData.priceHistory.length > 0,
            hasSeo: !!completedData.seoReport,
            potenciaW: completedData.potenciaW,
            autonomiaKm: completedData.autonomiaKm,
          });
          setIsGenerating(false);
          return;
        }

        const jobId = jobCreateRes.data.jobId;

        // Inicia Polling do Job
        let attempts = 0;
        const maxAttempts = 90; // até ~4.5 minutos

        pollingIntervalRef.current = setInterval(async () => {
          attempts++;
          if (attempts > maxAttempts) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            setErrorMessage('Tempo limite atingido durante a pesquisa. Tente novamente ou use a extração direta.');
            setIsGenerating(false);
            return;
          }

          try {
            const pollRes = await fetchAdminJson(`/api/admin/llm/jobs?limit=10`, {
              signal: abortController.signal,
            });

            if (pollRes.ok && Array.isArray(pollRes.data?.jobs)) {
              const currentJob = pollRes.data.jobs.find((j: any) => j.id === jobId);
              if (currentJob) {
                if (currentJob.progress !== undefined) {
                  setProgress(Math.max(10, currentJob.progress));
                }
                if (currentJob.stage) {
                  setCurrentStage(currentJob.stage);
                }

                if (currentJob.status === 'completed') {
                  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                  setProgress(100);
                  setCurrentStage('Concluído! Alocando 10 blocos canônicos, SEO e ofertas no formulário...');

                  const resultPayload = currentJob.result?.data || currentJob.result;
                  if (resultPayload) {
                    onDataExtracted(resultPayload, []);

                    setSuccessInfo({
                      model: resultPayload.modelo || cleanPrompt,
                      brand: resultPayload.marca || 'Fabricante',
                      sectionsCount: resultPayload.specSections?.length || 10,
                      hasImages: false,
                      hasPrices: Array.isArray(resultPayload.priceHistory) && resultPayload.priceHistory.length > 0,
                      hasSeo: !!resultPayload.seoReport,
                      potenciaW: resultPayload.potenciaW,
                      autonomiaKm: resultPayload.autonomiaKm,
                    });
                  }
                  setIsGenerating(false);
                } else if (currentJob.status === 'failed') {
                  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                  throw new Error(currentJob.error || 'A tarefa de IA encontrou um erro no servidor.');
                }
              }
            }
          } catch (pollErr: any) {
            if (pollErr.name === 'AbortError') return;
            console.warn('[BikeAiAssistant] Erro no polling:', pollErr);
          }
        }, 2000);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setCurrentStage('Geração cancelada.');
        return;
      }
      setErrorMessage(err.message || 'Ocorreu um erro ao gerar a ficha técnica via IA.');
      setIsGenerating(false);
    }
  };

  return (
    <div
      id="bike-ai-generator-panel"
      className={`relative overflow-hidden bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] transition-all ${className}`}
    >
      {/* Barra de Status e Destaque Superior */}
      <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-emerald-950 px-5 sm:px-6 py-4 text-white border-b-2 border-stone-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-stone-950 flex items-center justify-center border-2 border-stone-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] shrink-0">
              <Sparkles className="w-6 h-6 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Gerador de Ficha Técnica via IA (LLM)
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  TuaVia Engine 2026
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Extração eletromecânica de 10 blocos canônicos, conformidade CONTRAN 996, SEO Google Brasil e cotações reais.
              </p>
            </div>
          </div>

          {/* Badges de Capacidade do Engine */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
            <div className="bg-stone-800/90 text-stone-200 border border-stone-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>10 Blocos Canônicos</span>
            </div>
            <div className="bg-stone-800/90 text-stone-200 border border-stone-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>CONTRAN 996</span>
            </div>
            <div className="bg-stone-800/90 text-stone-200 border border-stone-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>SEO Brasil</span>
            </div>
          </div>
        </div>
      </div>

      {/* Corpo do Painel */}
      <div className="p-5 sm:p-6 space-y-5 bg-gradient-to-b from-stone-50/50 to-white">
        {/* Seletor de Modo com Design em Abas Modernas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-stone-200">
          <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl border border-stone-300">
            <button
              type="button"
              onClick={() => setGenerationMode('web_search')}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                generationMode === 'web_search'
                  ? 'bg-white text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100/60'
              }`}
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>Pesquisa Web Oficial + IA</span>
            </button>
            <button
              type="button"
              onClick={() => setGenerationMode('direct_text')}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                generationMode === 'direct_text'
                  ? 'bg-white text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100/60'
              }`}
            >
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Colar Ficha Técnica / Manual</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchGuide(!showArchGuide)}
              className="text-xs font-bold text-stone-600 hover:text-stone-950 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>{showArchGuide ? 'Ocultar Guia' : 'O que a IA preenche?'}</span>
              {showArchGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className={`text-xs font-bold flex items-center gap-1.5 py-1 px-2.5 rounded-lg border transition-all ${
                showOptions
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
              <span>Opções</span>
              {showOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Guia Explicativo dos 10 Blocos Canônicos (Colapsável) */}
        <AnimatePresence>
          {showArchGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-stone-900 border-2 border-stone-900 rounded-xl p-4 text-stone-200 text-xs space-y-3 shadow-inner"
            >
              <div className="flex items-center justify-between text-white font-bold pb-2 border-b border-stone-800">
                <span className="flex items-center gap-2 text-amber-400">
                  <Cpu className="w-4 h-4" />
                  Arquitetura de Extração Factual em 10 Blocos Canônicos
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30">
                  Zero Alucinação
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
                <div className="bg-stone-800/70 p-2.5 rounded-lg border border-stone-700/60">
                  <p className="font-black text-emerald-400">1. Sistema Eletromecânico</p>
                  <p className="text-stone-400 mt-0.5">Motor (W), Tensão (V), Torque (Nm), Bateria (Ah/Wh) e Autonomia real.</p>
                </div>
                <div className="bg-stone-800/70 p-2.5 rounded-lg border border-stone-700/60">
                  <p className="font-black text-blue-400">2. Geometria & Quadro</p>
                  <p className="text-stone-400 mt-0.5">Material do quadro, curso da suspensão, aros, medidas dos pneus e peso total.</p>
                </div>
                <div className="bg-stone-800/70 p-2.5 rounded-lg border border-stone-700/60">
                  <p className="font-black text-amber-400">3. Freios & Transmissão</p>
                  <p className="text-stone-400 mt-0.5">Discos hidráulicos/mecânicos, corte elétrico, câmbio e marchas.</p>
                </div>
                <div className="bg-stone-800/70 p-2.5 rounded-lg border border-stone-700/60">
                  <p className="font-black text-purple-400">4. SEO & Cotações</p>
                  <p className="text-stone-400 mt-0.5">Títulos magnéticos Google Brasil 2026, FAQPage Schema, GEO e preços de lojas.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Principal */}
        <div className="space-y-3">
          {generationMode === 'web_search' ? (
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                Nome do Fabricante e Modelo da Bicicleta Elétrica
              </label>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isGenerating) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    disabled={isGenerating}
                    placeholder="Ex: Caloi E-Vibe City Tour 2026, Sense Move 2026, Oggi Big Wheel 8.0, LAF L10 MAX..."
                    className="w-full pl-11 pr-10 py-3.5 bg-white border-2 border-stone-900 rounded-xl text-sm font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-stone-900 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.03)] transition-all disabled:opacity-60"
                  />
                  <Search className="w-5 h-5 text-stone-400 absolute left-3.5 top-3.5" />
                  {prompt && !isGenerating && (
                    <button
                      type="button"
                      onClick={() => setPrompt('')}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-800 p-1 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Processando Ficha...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>Gerar Ficha Completa</span>
                    </>
                  )}
                </button>
              </div>

              {/* Categorias e Chips Rápidos de Sugestão */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-bold text-stone-500">
                  <span className="uppercase tracking-wider shrink-0 text-stone-400 flex items-center gap-1">
                    <Sparkle className="w-3 h-3 text-amber-500" />
                    Sugestões Rápidas:
                  </span>
                  {CATEGORIZED_SUGGESTIONS.map((cat, idx) => (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setActiveCategoryTab(idx)}
                      className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        activeCategoryTab === idx
                          ? 'bg-stone-900 text-white font-black'
                          : 'bg-stone-200/80 text-stone-700 hover:bg-stone-300'
                      }`}
                    >
                      {cat.icon} {cat.category}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIZED_SUGGESTIONS[activeCategoryTab].items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      disabled={isGenerating}
                      className="px-3 py-1.5 bg-white hover:bg-emerald-50 hover:text-emerald-950 hover:border-emerald-500 border border-stone-300 rounded-lg text-xs font-bold text-stone-700 transition-all active:scale-95 disabled:opacity-50 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bike className="w-3.5 h-3.5 text-stone-400" />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                  Texto Bruto das Especificações Técnicas ou Manual
                </label>
                <button
                  type="button"
                  onClick={handleInsertSampleText}
                  disabled={isGenerating}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-amber-700" />
                  <span>Inserir Exemplo de Ficha</span>
                </button>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
                rows={6}
                placeholder="Cole aqui o texto completo com especificações do fabricante, catálogo em PDF ou tabela técnica..."
                className="w-full p-4 bg-white border-2 border-stone-900 rounded-xl text-xs sm:text-sm font-mono text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-stone-900 transition-all disabled:opacity-60 leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                  <span className="font-mono bg-stone-100 px-2 py-0.5 rounded border border-stone-300 text-stone-700">
                    {prompt.length} caracteres
                  </span>
                  <span>O parser converterá automaticamente para os 10 blocos canônicos.</span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                      <span>Extraindo Ficha...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4 text-stone-950" />
                      <span>Extrair Ficha do Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Opções Avançadas Colapsáveis */}
        <AnimatePresence>
          {showOptions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden bg-white border-2 border-stone-900 rounded-xl p-4 space-y-3 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]"
            >
              <div className="text-xs font-black uppercase text-stone-800 tracking-wider">
                Módulos Ativos no Pipeline de Geração:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={includeSeo}
                    onChange={(e) => setIncludeSeo(e.target.checked)}
                    disabled={isGenerating}
                    className="rounded border-stone-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block font-black">SEO Google Brasil 2026 & Rich Snippets</span>
                    <span className="text-[10px] text-stone-500 font-normal">Gera FAQ Schema, GEO e títulos magnéticos</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={includePrices}
                    onChange={(e) => setIncludePrices(e.target.checked)}
                    disabled={isGenerating}
                    className="rounded border-stone-400 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="block font-black">Cotações Reais de Mercado & Lojas</span>
                    <span className="text-[10px] text-stone-500 font-normal">Busca ofertas ativas e histórico nos e-commerces</span>
                  </div>
                </label>
              </div>
              <p className="text-[11px] text-stone-500 italic">
                * As imagens e galeria de fotos são gerenciadas exclusivamente no painel de fotos abaixo, garantindo estabilidade e tempo de resposta instantâneo.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline Visual e Barra de Progresso Interativo em Tempo Real */}
        {isGenerating && (
          <div className="p-5 bg-gradient-to-br from-emerald-950 via-stone-900 to-slate-950 border-2 border-stone-900 rounded-xl text-white space-y-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] animate-fadeIn">
            {/* Header de Progresso */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Executando Pipeline de Inteligência Artificial
                  </h4>
                  <p className="text-xs text-stone-300 font-semibold mt-0.5">
                    {currentStage || 'Processando extração factual com IA...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs font-mono text-stone-400 bg-stone-800 px-2.5 py-1 rounded-md border border-stone-700">
                  ⏱️ {elapsedSeconds}s
                </span>
                <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-md border border-emerald-500/40">
                  {progress}%
                </span>
              </div>
            </div>

            {/* Barra de Progresso com Gradiente */}
            <div className="w-full bg-stone-800 rounded-full h-3 overflow-hidden border border-stone-700">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 h-3 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* 4 Etapas Visuais do Pipeline */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className={`p-2 rounded-lg border transition-all ${
                progress >= 20 ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-stone-800/40 border-stone-800 text-stone-500'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {progress >= 20 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-stone-600" />}
                  <span>1. Pesquisa Oficial</span>
                </div>
              </div>

              <div className={`p-2 rounded-lg border transition-all ${
                progress >= 50 ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-stone-800/40 border-stone-800 text-stone-500'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {progress >= 50 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-stone-600" />}
                  <span>2. 10 Blocos Canônicos</span>
                </div>
              </div>

              <div className={`p-2 rounded-lg border transition-all ${
                progress >= 75 ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-stone-800/40 border-stone-800 text-stone-500'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {progress >= 75 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-stone-600" />}
                  <span>3. SEO Google Brasil</span>
                </div>
              </div>

              <div className={`p-2 rounded-lg border transition-all ${
                progress >= 95 ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300' : 'bg-stone-800/40 border-stone-800 text-stone-500'
              }`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {progress >= 95 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-stone-600" />}
                  <span>4. Cotações de Lojas</span>
                </div>
              </div>
            </div>

            {/* Footer do Card com Botão de Cancelar */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-800 text-xs text-stone-400">
              <span className="text-[11px]">Tecnologia: Kimi K3 + NVIDIA NIM + Serper Google Search</span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                Cancelar Operação
              </button>
            </div>
          </div>
        )}

        {/* Banner de Erro */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border-2 border-rose-700 rounded-xl text-rose-950 font-semibold text-xs flex items-start justify-between gap-3 animate-fadeIn shadow-[2px_2px_0px_0px_rgba(190,18,60,1)]">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-rose-900 text-sm">Falha ao processar com IA</p>
                <p className="text-rose-800 mt-0.5 font-medium">{errorMessage}</p>
                <p className="text-[11px] text-rose-700 mt-1">
                  Dica: Se a busca web falhar por oscilação, copie e cole o texto técnico na aba &quot;Colar Ficha Técnica / Manual&quot;.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-900 p-1 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner de Sucesso com Resumo Rico dos Dados Preenchidos */}
        {successInfo && (
          <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 border-2 border-emerald-800 rounded-2xl text-emerald-950 space-y-3 animate-fadeIn shadow-[4px_4px_0px_0px_rgba(6,95,70,1)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-emerald-950">
                    Ficha Técnica gerada e alocada com sucesso!
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Os 10 blocos canônicos, SEO e ofertas foram aplicados no formulário.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-emerald-200 text-emerald-950 px-3 py-1 rounded-lg border border-emerald-400 shadow-xs">
                  {successInfo.brand} {successInfo.model}
                </span>
              </div>
            </div>

            {/* Grid de Métricas Extraídas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-bold text-emerald-900">
              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-300/80 shadow-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="block font-black text-emerald-950">{successInfo.sectionsCount} Blocos</span>
                  <span className="text-[10px] text-emerald-700 font-normal">Ficha Canônica</span>
                </div>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-300/80 shadow-xs flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="block font-black text-emerald-950">
                    {successInfo.potenciaW ? `${successInfo.potenciaW}W` : 'Eletromecânica'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-normal">
                    {successInfo.autonomiaKm ? `${successInfo.autonomiaKm}km Autonomia` : 'Motor & Bateria'}
                  </span>
                </div>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-300/80 shadow-xs flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="block font-black text-emerald-950">
                    {successInfo.hasSeo ? 'SEO 2026 Ativo' : 'Metadados Base'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-normal">Google & AI Overviews</span>
                </div>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-300/80 shadow-xs flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="block font-black text-emerald-950">
                    {successInfo.hasPrices ? 'Cotações Ativas' : 'Preço Estruturado'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-normal">Análise de Mercado</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900 border-t border-emerald-200">
              <span className="text-[11px]">
                💡 <strong>Próximo passo:</strong> Role a página para revisar as especificações, selos e adicionar imagens no painel de Fotos.
              </span>
              <button
                type="button"
                onClick={() => {
                  const target = document.getElementById('bike-specs-section') || document.getElementById('bike-photos-section');
                  if (target) target.scrollIntoView({ behavior: 'smooth' });
                }}
                className="font-bold text-emerald-950 underline hover:text-emerald-800 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Revisar Ficha no Formulário</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
