'use client';

import React, { useState } from 'react';
import SafeImage from '@/components/ui/SafeImage';
import Link from 'next/link';
import { 
  Plus, 
  X, 
  Gauge, 
  Zap, 
  Scale, 
  Clock, 
  ShoppingCart, 
  ChevronRight, 
  Layers,
  Sparkles,
  Trophy,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  BatteryCharging,
  ShieldCheck,
  Disc,
  CheckCircle2,
  AlertTriangle,
  Target,
  LayoutGrid,
  TableProperties,
  Award,
  Sliders,
  Settings2,
  Info
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import { getExtraSpecs } from '@/components/EBikeCard';
import { buildEnrichedDetailFromBike } from '@/lib/ebikes';
import MobileCompareLayout from '@/components/comparar/MobileCompareLayout';

interface UnifiedCompareGridProps {
  comparedBikes: EBikeGrouped[];
  allBikes?: EBikeGrouped[];
  removeBike: (slug: string) => void;
  setShowSelectorForIndex: (index: number | null) => void;
  winners: {
    price?: string;
    autonomy?: string;
    power?: string;
    weight?: string;
    charge?: string;
  };
  onClearAll?: () => void;
}

export default function UnifiedCompareGrid({
  comparedBikes = [],
  allBikes = [],
  removeBike,
  setShowSelectorForIndex,
  winners = {},
  onClearAll,
}: UnifiedCompareGridProps) {
  const safeBikes = Array.isArray(comparedBikes) ? comparedBikes : [];
  const safeWinners = winners || {};

  // Modo de visualização: 'matrix' (excelente para mobile com scroll lateral) ou 'cards' (empilhado)
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');

  // Estado para expandir ficha técnica completa individual no modo 'cards'
  const [expandedDetails, setExpandedDetails] = useState<{ [key: number]: boolean }>({
    0: true,
    1: true,
    2: true
  });

  // Aba ativa para scroll rápido no mobile no modo 'cards'
  const [activeMobileTab, setActiveMobileTab] = useState<number>(0);

  const toggleExpand = (index: number) => {
    setExpandedDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getSpecValue = (specSections: any[] | undefined, labelRegex: RegExp, defaultValue: string): string => {
    if (!specSections || !Array.isArray(specSections)) return defaultValue;
    for (const sec of specSections) {
      if (!sec.items || !Array.isArray(sec.items)) continue;
      for (const item of sec.items) {
        if (labelRegex.test(item.label) && item.value && item.value !== 'Não informado pelo fabricante' && item.value !== 'Não informado') {
          return item.value;
        }
      }
    }
    return defaultValue;
  };

  // Prepara dados enriquecidos para os 3 slots
  const slotsData = [0, 1, 2].map((idx) => {
    const bike = safeBikes[idx];
    if (!bike) return null;
    try {
      return {
        bike,
        enriched: buildEnrichedDetailFromBike(bike),
        extra: getExtraSpecs(bike.modelo || ''),
        isPriceWinner: safeWinners.price === bike.slug && safeBikes.length >= 2,
        isAutonomyWinner: safeWinners.autonomy === bike.slug && safeBikes.length >= 2,
        isPowerWinner: safeWinners.power === bike.slug && safeBikes.length >= 2,
        isWeightWinner: safeWinners.weight === bike.slug && safeBikes.length >= 2,
        isChargeWinner: safeWinners.charge === bike.slug && safeBikes.length >= 2,
      };
    } catch (err) {
      console.warn('[UnifiedCompareGrid] Erro ao processar bike no slot:', err);
      return null;
    }
  });

  return (
    <>
      {/* VISÃO MOBILE DEDICADA */}
      <MobileCompareLayout
        comparedBikes={safeBikes}
        allBikes={allBikes}
        removeBike={removeBike}
        setShowSelectorForIndex={setShowSelectorForIndex}
        winners={safeWinners}
        onClearAll={onClearAll}
      />

      {/* VISÃO DESKTOP PRESERVADA */}
      <div className="hidden md:flex flex-col gap-5" id="unified-compare-grid-section">
        {/* Se nenhuma bike estiver selecionada no desktop, exibe estado vazio */}
        {safeBikes.length === 0 ? (
          <div className="bg-white border-2 border-stone-900 rounded-3xl p-8 sm:p-12 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-5 my-6">
            <div className="w-14 h-14 bg-amber-100 border-2 border-stone-900 rounded-2xl flex items-center justify-center mx-auto text-amber-700 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
              <Layers className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl font-black text-stone-900">
                Nenhuma e-bike selecionada para comparação
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
                Escolha até 3 modelos do nosso catálogo para comparar potência, autonomia de bateria, peso e menor preço lado a lado.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSelectorForIndex(0)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] transition-all text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Selecionar Primeira E-Bike</span>
              </button>
              <Link
                href="/#catalogo"
                className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all text-xs inline-flex items-center gap-2"
              >
                <span>Ver Catálogo Completo</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
      
      {/* Banner de Estado e Alternador de Modo de Visualização */}
      <div className="bg-surface border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-4">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-charge border-2 border-ink flex items-center justify-center text-ink shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-bold">
              <Layers className="w-5 h-5 text-ink" />
            </div>
            <div>
              <h2 className="font-display font-black text-base sm:text-lg text-ink leading-tight">
                Análise Técnica &amp; Comparativo Lado a Lado
              </h2>
              <p className="text-xs font-sans text-ink/80 mt-0.5">
                {comparedBikes.length === 0 
                  ? 'Selecione abaixo as bicicletas elétricas que deseja analisar.'
                  : comparedBikes.length === 1
                  ? '1 e-bike selecionada. Escolha a 2ª para desbloquear o raio-x e os troféus comparativos.'
                  : `${comparedBikes.length} e-bikes em comparação com especificações completas de motor, bateria, quadro e câmbio.`
                }
              </p>
            </div>
          </div>

          {comparedBikes.length >= 2 && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-300 border-2 border-ink text-emerald-950 font-mono font-black text-xs px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] shrink-0 self-start md:self-auto">
              <Trophy className="w-4 h-4 fill-emerald-950/20" />
              <span>Troféus Ativos</span>
            </div>
          )}
        </div>

        {/* Seletor do Modo de Visualização no Mobile & Desktop */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t-2 border-dashed border-ink/20 flex-wrap">
          <span className="text-[11px] font-mono font-bold text-ink/70 uppercase tracking-wider flex items-center gap-1">
            Visualização Mobile/Desktop:
          </span>

          <div className="inline-flex rounded-xl border-2 border-ink bg-bg-base p-1 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-primary text-white border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                  : 'text-ink hover:bg-white'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Tabela Lado a Lado</span>
              <span className="text-[9px] bg-amber-300 text-ink border border-ink px-1 rounded font-bold ml-0.5">Ideal Mobile</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-primary text-white border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                  : 'text-ink hover:bg-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards Individuais</span>
            </button>
          </div>
        </div>

        {/* Barra de Abas Rápidas no Mobile (quando em modo Cards) */}
        {viewMode === 'cards' && (
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
            {[0, 1, 2].map((idx) => {
              const item = slotsData[idx];
              const isActive = activeMobileTab === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveMobileTab(idx);
                    const el = document.getElementById(`bike-card-slot-${idx}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`px-3 py-1.5 rounded-xl border-2 border-ink text-xs font-mono font-bold whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-300 text-ink font-black'
                      : 'bg-white text-ink/80 hover:bg-neutral-100'
                  }`}
                >
                  {item ? `Slot #${idx + 1}: ${item.bike.marca}` : `Slot #${idx + 1}: ➕ Vazio`}
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* OPÇÃO 1: VISÃO DE TABELA MATRIZ COMPLETA LADO A LADO */}
      {/* ========================================================================= */}
      {viewMode === 'matrix' && (
        <div className="bg-surface border-2 border-ink rounded-3xl p-3 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] overflow-hidden">
          
          <div className="text-[11px] font-mono font-bold text-ink/70 mb-3 px-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              👈 Arraste pro lado para comparar todas as especificações em detalhes 👉
            </span>
            <span className="bg-amber-300 border border-ink text-ink text-[10px] px-2 py-0.5 rounded-md font-bold">
              {comparedBikes.length} de 3 modelos
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-ink/20 pb-2">
            <table className="w-full min-w-[720px] border-collapse">
              
              {/* CABEÇALHO DA TABELA DE COMPARATIVO */}
              <thead>
                <tr>
                  {/* Coluna 0: Título da Métrica */}
                  <th className="w-44 sm:w-56 p-3 text-left align-bottom bg-bg-base border-2 border-ink rounded-tl-2xl font-mono text-xs font-black text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
                    Especificação Auditada
                  </th>

                  {/* Colunas 1, 2, 3: As E-Bikes */}
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];

                    if (item) {
                      const { bike, isPriceWinner } = item;
                      return (
                        <th 
                          key={idx}
                          className="w-52 sm:w-64 p-3 text-center align-top bg-white border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] rounded-t-2xl"
                        >
                          <div className="flex flex-col items-center gap-2">
                            
                            {/* Ações superiores */}
                            <div className="flex items-center justify-between w-full border-b border-ink/10 pb-1.5">
                              <span className="text-[9px] font-mono font-black text-ink bg-bg-base border border-ink px-2 py-0.5 rounded-md">
                                #{idx + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setShowSelectorForIndex(idx)}
                                  className="text-[10px] font-mono font-bold text-ink underline cursor-pointer hover:text-primary"
                                >
                                  Trocar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeBike(bike.slug)}
                                  className="p-1 rounded bg-red-100 hover:bg-red-200 border border-ink text-red-950 cursor-pointer"
                                  title="Remover"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Foto e Modelo */}
                            <div className="relative w-full aspect-video bg-bg-base rounded-xl border border-ink/20 p-1 flex items-center justify-center overflow-hidden">
                              <SafeImage 
                                src={bike.imagemUrl || (bike as any).galleryImages?.[0] || (bike as any).ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'} 
                                alt={bike.modelo}
                                fill
                                className="object-contain p-1"
                                fallbackSrc="/placeholder-bike.png"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-mono font-black uppercase text-ink bg-accent-gold border border-ink/30 px-1.5 py-0.2 rounded">
                                {bike.marca}
                              </span>
                              <h4 className="font-display font-black text-xs text-ink leading-tight line-clamp-2">
                                {bike.modelo}
                              </h4>
                            </div>

                            {/* Preço em destaque */}
                            <div className={`p-2 rounded-xl border border-ink w-full flex flex-col items-center ${isPriceWinner ? 'bg-amber-300' : 'bg-bg-base'}`}>
                              <span className="text-[8px] font-mono font-bold uppercase text-ink/70">Menor Preço</span>
                              <span className="font-mono font-black text-xs sm:text-sm text-ink">{formatCurrency(bike.menorPreco)}</span>
                            </div>

                          </div>
                        </th>
                      );
                    }

                    {/* Slot Vazio */}
                    return (
                      <th 
                        key={idx}
                        className="w-52 sm:w-64 p-3 text-center align-middle bg-surface border-2 border-dashed border-ink/40 shadow-[1px_1px_0_0_rgba(46,43,39,1)] rounded-t-2xl"
                      >
                        <button
                          type="button"
                          onClick={() => setShowSelectorForIndex(idx)}
                          className="flex flex-col items-center justify-center gap-2 p-4 text-center cursor-pointer w-full group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-accent-charge border border-ink flex items-center justify-center text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] group-hover:scale-110 transition-transform">
                            <Plus className="w-5 h-5 stroke-[3]" />
                          </div>
                          <span className="font-display font-black text-xs text-ink">
                            ➕ Slot #{idx + 1} Vazio
                          </span>
                          <span className="text-[10px] font-mono bg-amber-300 border border-ink px-2 py-1 rounded-lg text-ink font-bold uppercase">
                            Escolher E-Bike
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* CORPO DA TABELA COMPARATIVA EXTENSA */}
              <tbody className="divide-y-2 divide-ink/10 font-sans text-xs">

                {/* ========================================================================= */}
                {/* SEÇÃO 1: RESUMO & VENCEDORES COMPARATIVOS */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-accent-gold border-2 border-ink">
                    🏆 Destaques, Categoria &amp; Troféus
                  </td>
                </tr>

                {/* ROW: Vantagens/Troféus */}
                {comparedBikes.length >= 2 && (
                  <tr className="bg-amber-50/50">
                    <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Troféus da Comparação</span>
                    </td>
                    {[0, 1, 2].map((idx) => {
                      const item = slotsData[idx];
                      if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                      return (
                        <td key={idx} className="p-3 border-x-2 border-ink text-center align-middle bg-white">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {item.isPriceWinner && <span className="bg-amber-300 border border-ink text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">🏆 Menor Preço</span>}
                            {item.isAutonomyWinner && <span className="bg-emerald-300 border border-ink text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">🏆 +Autonomia</span>}
                            {item.isPowerWinner && <span className="bg-amber-300 border border-ink text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">🏆 +Potente</span>}
                            {item.isWeightWinner && <span className="bg-emerald-300 border border-ink text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">🏆 +Leve</span>}
                            {item.isChargeWinner && <span className="bg-blue-300 border border-ink text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">🏆 Recarga Rápida</span>}
                            {!item.isPriceWinner && !item.isAutonomyWinner && !item.isPowerWinner && !item.isWeightWinner && !item.isChargeWinner && (
                              <span className="text-[10px] font-mono text-ink/60">Equilibrado</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* ROW: Uso Indicado */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <span>Uso Principal / Categoria</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center bg-white">
                        <span className="bg-bg-base border border-ink px-2.5 py-1 rounded-lg font-mono text-xs font-black text-ink inline-block">
                          {item.bike.usoPrincipal}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Perfil Ideal */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>Perfil Recomendado</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-left text-[11px] font-medium bg-amber-50/50 text-ink leading-relaxed">
                        {item.enriched.idealFor}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Foco do Quadro */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <span>Destaque de Engenharia</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {item.extra.destaque}
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* SEÇÃO 2: MOTOR & SISTEMA ELÉTRICO */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-accent-charge border-2 border-ink">
                    ⚡ Motor &amp; Desempenho Elétrico
                  </td>
                </tr>

                {/* ROW: Potência do Motor */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-primary shrink-0" />
                    <span>Potência Nominal</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const motorPowerText = item.enriched.specSections[0]?.items[1]?.value || `${item.bike.potenciaW}W reais`;
                    return (
                      <td key={idx} className={`p-3 border-x-2 border-ink text-center font-mono font-black text-sm ${item.isPowerWinner ? 'bg-amber-100 text-amber-950 font-black' : 'bg-white text-ink'}`}>
                        {motorPowerText}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Tipo de Motor */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Tipo de Motor
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const motorVal = item.enriched.specSections[0]?.items[0]?.value || 'Motor Elétrico de Cubo';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {motorVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Velocidade Máxima */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Velocidade Máxima
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const speedVal = item.enriched.specSections[0]?.items[2]?.value || '25 km/h (limite legal para pedal assistido)';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {speedVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Modos de Assistência */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Modos de Assistência
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const modesVal = item.enriched.specSections[0]?.items[3]?.value || '5 níveis de potência';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {modesVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Sensor de Pedalada */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Sensor de Pedalada
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const sensorVal = item.enriched.specSections[0]?.items[4]?.value || 'Sensor de cadência magnético';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {sensorVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* SEÇÃO 3: BATERIA & AUTONOMIA */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-emerald-200 border-2 border-ink">
                    🔋 Bateria, Autonomia &amp; Recarga
                  </td>
                </tr>

                {/* ROW: Autonomia */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-primary shrink-0" />
                    <span>Autonomia Máxima</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className={`p-3 border-x-2 border-ink text-center font-mono font-black text-sm ${item.isAutonomyWinner ? 'bg-emerald-100 text-emerald-950 font-black' : 'bg-white text-ink'}`}>
                        Até {item.bike.autonomiaKm} km
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Capacidade Bateria */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Capacidade da Bateria
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const batVal = item.enriched.specSections[1]?.items[1]?.value || '36V Íons de Lítio';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {batVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Composição Bateria */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Química / Composição
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const chemVal = item.enriched.specSections[1]?.items[0]?.value || 'Íons de Lítio (Células de alta densidade)';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {chemVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Tempo de Recarga */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span>Tempo de Recarga</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className={`p-3 border-x-2 border-ink text-center font-mono font-bold text-xs ${item.isChargeWinner ? 'bg-blue-100 text-blue-950 font-black' : 'bg-white text-ink'}`}>
                        {item.bike.tempoCargaHoras ? `${item.bike.tempoCargaHoras} horas` : 'Não informado'}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Bateria Removível */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Bateria Removível &amp; Trava
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const remVal = item.enriched.specSections[1]?.items[4]?.value || 'Sim, com chave de segurança antifurto';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {remVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* SEÇÃO 4: QUADRO, SUSPENSÃO & PNEUS */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-amber-200 border-2 border-ink">
                    🚲 Quadro, Suspensão &amp; Rodas
                  </td>
                </tr>

                {/* ROW: Material do Quadro */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Material do Quadro
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const frameVal = item.enriched.specSections[2]?.items[0]?.value || 'Alumínio de liga aeroespacial 6061 T6';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {frameVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Suspensão */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Garfo / Suspensão
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const forkVal = item.enriched.specSections[2]?.items[1]?.value || 'Suspensão Dianteira';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {forkVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Medida dos Pneus */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Medida dos Pneus / Rodas
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const tireVal = item.enriched.specSections[2]?.items[2]?.value || 'Aro de liga reforçada';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {tireVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Peso Total */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-primary shrink-0" />
                    <span>Peso Total da E-Bike</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className={`p-3 border-x-2 border-ink text-center font-mono font-bold text-xs ${item.isWeightWinner ? 'bg-emerald-100 text-emerald-950 font-black' : 'bg-white text-ink'}`}>
                        {item.bike.pesoKg ? `${item.bike.pesoKg} kg` : 'Não informado'}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Capacidade de Carga */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Capacidade de Carga
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const loadVal = item.enriched.specSections[2]?.items[4]?.value || '120 kg máximo (ciclista + bagagem)';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {loadVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* SEÇÃO 5: TRANSMISSÃO, FREIOS & SEGURANÇA */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-blue-200 border-2 border-ink">
                    ⚙️ Transmissão, Freios &amp; Segurança
                  </td>
                </tr>

                {/* ROW: Câmbio / Transmissão */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Sistema de Transmissão
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const transVal = item.enriched.specSections[3]?.items[0]?.value || 'Shimano Tourney de 7 Velocidades';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {transVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Trocadores */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Trocadores de Marcha
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const shiftVal = item.enriched.specSections[3]?.items[1]?.value || 'Shimano Grip Shift ou Rapidfire';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {shiftVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Freio Dianteiro */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Freio Dianteiro
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const brakeFront = item.enriched.specSections[3]?.items[2]?.value || 'Disco Mecânico 160mm';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {brakeFront}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Freio Traseiro */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Freio Traseiro
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const brakeRear = item.enriched.specSections[3]?.items[3]?.value || 'Disco Mecânico 160mm';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {brakeRear}
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Corte de Energia */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink">
                    Corte de Energia ao Frear
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    const cutoffVal = item.enriched.specSections[3]?.items[4]?.value || 'Sensores integrados nos manetes de freio desativam o motor instantaneamente';
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-center font-bold text-[11px] bg-white text-ink">
                        {cutoffVal}
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* SEÇÃO 6: VANTAGENS & PONTOS DE ATENÇÃO AUDITADOS */}
                {/* ========================================================================= */}
                <tr className="bg-neutral-100 border-y-2 border-ink">
                  <td colSpan={4} className="p-2.5 font-mono font-black text-xs text-ink uppercase tracking-wider bg-emerald-300 border-2 border-ink">
                    ✅ Pontos Fortes &amp; Aspectos de Atenção
                  </td>
                </tr>

                {/* ROW: Prós */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Pontos Fortes (Prós)</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-left bg-emerald-50/50">
                        <ul className="flex flex-col gap-1 text-[11px] font-sans text-ink">
                          {item.enriched.pros.slice(0, 3).map((pro, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1 leading-tight">
                              <span className="text-emerald-700 font-bold shrink-0">✓</span>
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>

                {/* ROW: Contras */}
                <tr className="hover:bg-neutral-50">
                  <td className="p-3 font-mono font-bold text-ink bg-bg-base border-x-2 border-ink flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Pontos de Atenção</span>
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-x-2 border-ink text-center text-ink/40 font-mono text-[10px]">-</td>;
                    return (
                      <td key={idx} className="p-3 border-x-2 border-ink text-left bg-amber-50/40">
                        <ul className="flex flex-col gap-1 text-[11px] font-sans text-ink">
                          {item.enriched.cons.slice(0, 2).map((con, cIdx) => (
                            <li key={cIdx} className="flex items-start gap-1 leading-tight">
                              <span className="text-amber-800 font-bold shrink-0">⚠️</span>
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>

                {/* ========================================================================= */}
                {/* ROW FINAL: Ação de Compra */}
                {/* ========================================================================= */}
                <tr className="bg-bg-base border-t-2 border-ink">
                  <td className="p-3 font-mono font-black text-ink bg-bg-base border-2 border-ink rounded-bl-2xl">
                    Ação &amp; Ofertas
                  </td>
                  {[0, 1, 2].map((idx) => {
                    const item = slotsData[idx];
                    if (!item) return <td key={idx} className="p-3 border-2 border-ink text-center rounded-b-2xl bg-surface">-</td>;
                    return (
                      <td key={idx} className="p-3 border-2 border-ink text-center bg-white rounded-b-2xl">
                        <Link 
                          href={`/bike/${item.bike.slug}`}
                          className="bg-primary hover:bg-primary-dark text-white font-mono font-black text-xs py-2.5 px-3 rounded-xl border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-all inline-flex items-center justify-center gap-1 w-full"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Ver {item.bike.ofertas.length} Ofertas</span>
                        </Link>
                      </td>
                    );
                  })}
                </tr>

              </tbody>

            </table>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* OPÇÃO 2: CARDS INDIVIDUAIS EMPILHADOS (DESKTOP E ALTERNATIVA MOBILE) */}
      {/* ========================================================================= */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {[0, 1, 2].map((index) => {
            const bike = comparedBikes[index];

            if (bike) {
              const enriched = buildEnrichedDetailFromBike(bike);
              const extra = getExtraSpecs(bike.modelo);
              const isExpanded = expandedDetails[index] ?? true;

              const isPriceWinner = winners.price === bike.slug && comparedBikes.length >= 2;
              const isAutonomyWinner = winners.autonomy === bike.slug && comparedBikes.length >= 2;
              const isPowerWinner = winners.power === bike.slug && comparedBikes.length >= 2;
              const isWeightWinner = winners.weight === bike.slug && comparedBikes.length >= 2;
              const isChargeWinner = winners.charge === bike.slug && comparedBikes.length >= 2;

              return (
                <div 
                  id={`bike-card-slot-${index}`}
                  key={`compare-card-${bike.slug}-${index}`}
                  className="bg-surface border-2 border-ink rounded-3xl p-4 sm:p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 relative group scroll-mt-24"
                >
                  {/* Header do Card da Bike */}
                  <div className="flex items-center justify-between gap-2 border-b-2 border-dashed border-ink/20 pb-3">
                    <span className="text-[10px] font-mono font-black text-ink bg-bg-base border-2 border-ink px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase tracking-wider">
                      E-Bike #{index + 1}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => setShowSelectorForIndex(index)}
                        className="text-[11px] font-mono font-bold text-ink bg-white hover:bg-neutral-100 border-2 border-ink px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-transform active:scale-95 cursor-pointer"
                        title="Substituir por outro modelo"
                      >
                        Substituir
                      </button>
                      <button 
                        type="button"
                        onClick={() => removeBike(bike.slug)}
                        className="p-1.5 rounded-xl bg-red-100 hover:bg-red-200 border-2 border-ink text-red-950 cursor-pointer shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-transform active:scale-95"
                        title="Remover modelo da comparação"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Imagem e Identificação */}
                  <div className="flex flex-col gap-3 items-center text-center">
                    <div className="relative w-full h-44 sm:h-48 rounded-2xl bg-white border-2 border-ink p-3 flex items-center justify-center shadow-[2px_2px_0_0_rgba(46,43,39,1)] overflow-hidden">
                      <SafeImage 
                        src={bike.imagemUrl || (bike as any).galleryImages?.[0] || (bike as any).ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'} 
                        alt={bike.modelo}
                        fill
                        className="object-contain p-2 hover:scale-105 transition-transform duration-300"
                        fallbackSrc="/placeholder-bike.png"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="flex flex-col items-center gap-1.5 w-full">
                      <span className="text-[10px] font-mono font-black uppercase text-ink bg-accent-gold border border-ink px-2.5 py-0.5 rounded-md shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                        {bike.marca}
                      </span>
                      <h3 className="font-display font-black text-base sm:text-lg text-ink leading-snug">
                        {bike.modelo}
                      </h3>
                    </div>

                    {/* Preço de Hoje */}
                    <div className="bg-white border-2 border-ink p-3 rounded-2xl w-full shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-mono uppercase font-bold text-ink/60">Menor preço auditado</span>
                      <span className="text-xl font-mono font-black text-primary">{formatCurrency(bike.menorPreco)}</span>
                    </div>
                  </div>

                  {/* Trophies / Winner Badges */}
                  {comparedBikes.length >= 2 && (
                    <div className="flex flex-wrap gap-1.5 justify-center py-1">
                      {isPriceWinner && (
                        <span className="inline-flex items-center gap-1 bg-amber-300 border border-ink text-amber-950 text-[10px] font-mono font-black px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                          🏆 Menor Preço
                        </span>
                      )}
                      {isAutonomyWinner && (
                        <span className="inline-flex items-center gap-1 bg-emerald-300 border border-ink text-emerald-950 text-[10px] font-mono font-black px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                          🏆 Maior Autonomia
                        </span>
                      )}
                      {isPowerWinner && (
                        <span className="inline-flex items-center gap-1 bg-amber-300 border border-ink text-amber-950 text-[10px] font-mono font-black px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                          🏆 Mais Potente
                        </span>
                      )}
                      {isWeightWinner && (
                        <span className="inline-flex items-center gap-1 bg-emerald-300 border border-ink text-emerald-950 text-[10px] font-mono font-black px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                          🏆 Mais Leve
                        </span>
                      )}
                      {isChargeWinner && (
                        <span className="inline-flex items-center gap-1 bg-blue-300 border border-ink text-blue-950 text-[10px] font-mono font-black px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                          🏆 Recarga Rápida
                        </span>
                      )}
                    </div>
                  )}

                  {/* RESUMO RÁPIDO DE ESPECIFICAÇÕES */}
                  <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-2 text-xs">
                    <div className="font-mono text-[10px] font-black uppercase text-ink/70 border-b-2 border-ink/10 pb-1.5 flex items-center justify-between">
                      <span>Métricas Essenciais</span>
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    </div>

                    {/* Autonomia */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-ink/10">
                      <div className="flex items-center gap-1.5 text-ink/80 font-mono font-bold">
                        <Gauge className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Autonomia:</span>
                      </div>
                      <span className={`font-mono font-black text-sm ${isAutonomyWinner ? 'text-primary' : 'text-ink'}`}>
                        {bike.autonomiaKm} km
                      </span>
                    </div>

                    {/* Potência */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-ink/10">
                      <div className="flex items-center gap-1.5 text-ink/80 font-mono font-bold">
                        <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Potência Motor:</span>
                      </div>
                      <span className={`font-mono font-black text-sm ${isPowerWinner ? 'text-primary' : 'text-ink'}`}>
                        {bike.potenciaW} W
                      </span>
                    </div>

                    {/* Peso */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-ink/10">
                      <div className="flex items-center gap-1.5 text-ink/80 font-mono font-bold">
                        <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Peso Total:</span>
                      </div>
                      <span className="font-mono font-bold text-ink">
                        {bike.pesoKg ? `${bike.pesoKg} kg` : 'Não informado'}
                      </span>
                    </div>

                    {/* Recarga */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-ink/10">
                      <div className="flex items-center gap-1.5 text-ink/80 font-mono font-bold">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Tempo Recarga:</span>
                      </div>
                      <span className="font-mono font-bold text-ink">
                        {bike.tempoCargaHoras ? `${bike.tempoCargaHoras}h` : 'Não informado'}
                      </span>
                    </div>

                    {/* Categoria */}
                    <div className="flex items-center justify-between gap-2 py-1 border-b border-ink/10">
                      <span className="text-ink/80 font-mono font-bold">Uso Indicado:</span>
                      <span className="bg-bg-base border border-ink/30 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold text-ink">
                        {bike.usoPrincipal}
                      </span>
                    </div>

                    {/* Destaque */}
                    <div className="flex flex-col gap-0.5 pt-1">
                      <span className="text-ink/80 font-mono font-bold">Foco do Quadro:</span>
                      <span className="font-sans text-[11px] font-bold text-ink leading-tight">
                        {extra.destaque}
                      </span>
                    </div>
                  </div>

                  {/* BOTÃO PARA ALTERNAR EXIBIÇÃO DA FICHA COMPLETA */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(index)}
                    className="w-full bg-bg-base hover:bg-neutral-100 text-ink border-2 border-ink py-2.5 px-3 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-mono font-black text-xs flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-primary" />
                      <span>Ficha Técnica Auditada Detalhada</span>
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-ink" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-ink" />
                    )}
                  </button>

                  {/* FICHA TÉCNICA DETALHADA E COMPLETA */}
                  {isExpanded && enriched && (
                    <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                      
                      {/* Seções Técnicas */}
                      {enriched.specSections.map((sec, secIdx) => {
                        let SectionIcon = Cpu;
                        if (sec.title.includes('Bateria')) SectionIcon = BatteryCharging;
                        if (sec.title.includes('Quadro')) SectionIcon = ShieldCheck;
                        if (sec.title.includes('Transmissão')) SectionIcon = Disc;

                        return (
                          <div 
                            key={secIdx} 
                            className="bg-white border-2 border-ink rounded-2xl p-3.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-2"
                          >
                            <div className="font-mono text-[10px] font-black uppercase text-ink flex items-center gap-1.5 border-b-2 border-ink/10 pb-1.5">
                              <SectionIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>{sec.title}</span>
                            </div>

                            <div className="flex flex-col gap-1.5 pt-0.5">
                              {sec.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex flex-col text-[11px] font-sans border-b border-ink/5 pb-1 last:border-0 last:pb-0">
                                  <span className="font-mono font-bold text-ink/60 text-[9px] uppercase tracking-wider">{item.label}</span>
                                  <span className="font-bold text-ink leading-tight">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Perfil Ideal */}
                      <div className="bg-amber-100/60 border-2 border-ink rounded-2xl p-3.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-amber-950">
                          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>Perfil Ideal de Uso</span>
                        </div>
                        <p className="text-xs font-sans text-ink font-medium leading-relaxed">
                          {enriched.idealFor}
                        </p>
                      </div>

                      {/* Vantagens Auditadas */}
                      <div className="bg-emerald-50 border-2 border-ink rounded-2xl p-3.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase text-emerald-950">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Pontos Fortes da Engenharia</span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                          {enriched.pros.slice(0, 3).map((pro, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1.5 text-[11px] font-sans text-ink leading-snug">
                              <span className="text-emerald-700 font-bold shrink-0">✓</span>
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                    </div>
                  )}

                  {/* Botão de Ofertas */}
                  <Link 
                    href={`/bike/${bike.slug}`}
                    className="bg-primary hover:bg-primary-dark text-white font-mono font-black text-xs py-3.5 px-4 rounded-2xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-auto"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Ver {bike.ofertas.length} Ofertas no Mercado</span>
                    <ChevronRight className="w-4 h-4 text-accent-charge" />
                  </Link>
                </div>
              );
            }

            // Card de Slot Vazio
            return (
              <div 
                key={index}
                onClick={() => setShowSelectorForIndex(index)}
                className="bg-surface/90 hover:bg-white border-2 border-dashed border-ink hover:border-primary rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[6px_6px_0_0_rgba(46,43,39,1)] hover:scale-[1.01] transition-all min-h-[480px] group gap-4"
              >
                <div className="w-16 h-16 rounded-3xl bg-accent-charge border-2 border-ink flex items-center justify-center text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] group-hover:scale-110 group-hover:rotate-6 transition-all shrink-0">
                  <Plus className="w-8 h-8 stroke-[3]" />
                </div>

                <div className="flex flex-col gap-1.5 max-w-xs">
                  <h3 className="font-display font-black text-base text-ink group-hover:text-primary transition-colors">
                    {index === 0 
                      ? '➕ Escolher 1ª E-Bike' 
                      : index === 1 
                      ? '➕ Adicionar 2ª E-Bike' 
                      : '➕ Adicionar 3ª E-Bike'}
                  </h3>
                  <p className="text-xs text-ink/70 font-sans leading-relaxed">
                    Clique para abrir o catálogo e selecionar uma bicicleta elétrica para comparar.
                  </p>
                </div>

                <button 
                  type="button"
                  className="mt-2 bg-amber-400 border-2 border-ink text-ink font-mono font-black text-xs px-5 py-3 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] uppercase tracking-wider group-hover:bg-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Selecionar E-Bike</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
      </div>
    </>
  );
}
