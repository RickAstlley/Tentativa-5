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
  Award,
  Info,
  Check,
  Share2
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import { getExtraSpecs } from '@/components/EBikeCard';
import { buildEnrichedDetailFromBike } from '@/lib/ebikes';

interface MobileCompareLayoutProps {
  comparedBikes: EBikeGrouped[];
  allBikes: EBikeGrouped[];
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
  onShareClick?: () => void;
  shareCopied?: boolean;
}

export default function MobileCompareLayout({
  comparedBikes = [],
  allBikes = [],
  removeBike,
  setShowSelectorForIndex,
  winners = {},
  onClearAll,
  onShareClick,
  shareCopied = false,
}: MobileCompareLayoutProps) {
  const safeBikes = Array.isArray(comparedBikes) ? comparedBikes : [];
  const safeWinners = winners || {};

  // Acordeões expansíveis de especificações por categoria
  const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({
    motor: true,
    bateria: true,
    quadro: true,
    transmissao: false,
    preco: true,
  });

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Preparação de slots e dados enriquecidos
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
    } catch {
      return null;
    }
  });

  // Estado Vazio (Nenhuma bike selecionada)
  if (safeBikes.length === 0) {
    return (
      <div className="md:hidden bg-surface border-2 border-ink rounded-2xl p-5 text-center shadow-[4px_4px_0_0_rgba(46,43,39,1)] space-y-4 my-2">
        <div className="w-12 h-12 bg-amber-100 border-2 border-ink rounded-2xl flex items-center justify-center mx-auto text-amber-800 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-xs mx-auto">
          <h2 className="text-base font-black text-ink font-display">
            Monte sua comparação
          </h2>
          <p className="text-xs text-ink/80 font-sans leading-relaxed">
            Escolha até 3 e-bikes do catálogo para analisar especificações e preços lado a lado.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowSelectorForIndex(0)}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-accent-charge stroke-[3]" />
            <span>Adicionar Primeira E-Bike</span>
          </button>
          <Link
            href="/#catalogo"
            className="w-full py-2.5 px-4 bg-bg-base hover:bg-white text-ink font-mono font-bold text-xs rounded-xl border border-ink/40 text-center inline-flex items-center justify-center gap-1 min-h-[40px]"
          >
            <span>Ver Catálogo Completo</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden flex flex-col gap-4 pb-12" id="mobile-compare-layout">
      
      {/* 1. BARRA DE AÇÃO PRIORITÁRIA MOBILE */}
      <div className="bg-surface border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2 sticky top-2 z-20 bg-surface/95 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-black text-ink bg-amber-300 border border-ink px-2 py-1 rounded-lg shrink-0">
            {safeBikes.length}/3
          </span>
          <span className="text-xs font-sans font-bold text-ink truncate">
            {safeBikes.length === 1 ? '1 e-bike pronta' : `${safeBikes.length} e-bikes em análise`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {safeBikes.length < 3 && (
            <button
              type="button"
              onClick={() => setShowSelectorForIndex(safeBikes.length)}
              className="px-3 py-2 bg-primary text-white text-xs font-mono font-bold rounded-xl border-2 border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] flex items-center gap-1 cursor-pointer active:scale-95 transition-transform min-h-[40px]"
            >
              <Plus className="w-3.5 h-3.5 text-accent-charge stroke-[3]" />
              <span>Adicionar</span>
            </button>
          )}

          {safeBikes.length === 3 && (
            <button
              type="button"
              onClick={() => setShowSelectorForIndex(0)}
              className="px-3 py-2 bg-amber-300 text-ink text-xs font-mono font-bold rounded-xl border-2 border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] flex items-center gap-1 cursor-pointer active:scale-95 transition-transform min-h-[40px]"
            >
              <span>Trocar Modelo</span>
            </button>
          )}

          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="px-2.5 py-2 bg-white hover:bg-neutral-100 text-ink text-xs font-mono font-bold rounded-xl border-2 border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer min-h-[40px]"
              title="Limpar tudo"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* 2. CARROSSEL HORIZONTAL SNAP DOS MODELOS SELECIONADOS */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono font-bold text-ink/70 uppercase tracking-wider flex items-center gap-1">
            <span>👇</span> Arraste para o lado ({safeBikes.length} de 3)
          </span>
          {safeBikes.length === 1 && (
            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              +1 para comparar
            </span>
          )}
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 pt-1 scrollbar-none -mx-3 px-3">
          {slotsData.map((item, idx) => {
            if (item) {
              const { bike, isPriceWinner, isAutonomyWinner, isPowerWinner } = item;
              return (
                <div
                  key={`mobile-compare-${bike.slug}-${idx}`}
                  className="w-[84vw] max-w-[320px] shrink-0 snap-center bg-white border-2 border-ink rounded-2xl p-3.5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between gap-3 relative"
                >
                  {/* Badge de número e Ações do Card */}
                  <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                    <span className="text-[10px] font-mono font-black text-ink bg-bg-base border border-ink px-2 py-0.5 rounded-md">
                      Modelo #{idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSelectorForIndex(idx)}
                        className="text-[11px] font-mono font-bold text-primary underline cursor-pointer hover:text-primary-dark"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBike(bike.slug)}
                        className="p-1 rounded-lg bg-red-100 hover:bg-red-200 border border-ink text-red-950 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title="Remover e-bike"
                        aria-label={`Remover ${bike.modelo} da comparação`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Foto e Informações Principais */}
                  <div className="flex gap-3 items-center">
                    <div className="relative w-full aspect-video max-w-20 max-h-20 bg-bg-base rounded-xl border border-ink/20 p-1 shrink-0 overflow-hidden">
                      <SafeImage
                        src={bike.imagemUrl || (bike as any).galleryImages?.[0] || (bike as any).ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                        alt={bike.modelo}
                        fill
                        className="object-contain p-1"
                        fallbackSrc="/placeholder-bike.png"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] font-mono font-black uppercase text-ink bg-accent-gold/40 border border-ink/30 px-1.5 py-0.2 rounded w-fit">
                        {bike.marca}
                      </span>
                      <h3 className="font-display font-black text-xs text-ink leading-tight line-clamp-2 mt-0.5">
                        {bike.modelo}
                      </h3>
                      <span className="text-xs font-mono font-black text-primary mt-1">
                        {formatCurrency(bike.menorPreco)}
                      </span>
                    </div>
                  </div>

                  {/* Pills de Métricas Rápidas */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-ink/10 text-[10px] font-mono">
                    <div className={`p-1.5 rounded-lg border border-ink/30 flex items-center gap-1 ${isAutonomyWinner ? 'bg-emerald-100 font-bold border-emerald-500' : 'bg-neutral-50'}`}>
                      <Gauge className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{bike.autonomiaKm} km aut.</span>
                    </div>
                    <div className={`p-1.5 rounded-lg border border-ink/30 flex items-center gap-1 ${isPowerWinner ? 'bg-amber-100 font-bold border-amber-500' : 'bg-neutral-50'}`}>
                      <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                      <span className="truncate">{bike.potenciaW}W pot.</span>
                    </div>
                  </div>

                  <Link
                    href={`/bike/${bike.slug}`}
                    className="w-full py-2 bg-primary text-white text-xs font-bold font-sans rounded-xl border-2 border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-1 mt-1 cursor-pointer"
                  >
                    <span>Ver Ficha &amp; Ofertas</span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent-charge" />
                  </Link>
                </div>
              );
            }

            {/* Slot Vazio no Carrossel */}
            return (
              <div
                key={idx}
                className="w-[78vw] max-w-[280px] shrink-0 snap-center bg-surface border-2 border-dashed border-ink/40 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center min-h-[220px]"
              >
                <div className="w-10 h-10 rounded-xl bg-accent-charge border border-ink flex items-center justify-center text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <span className="font-display font-black text-xs text-ink block">
                    Slot #{idx + 1} Vazio
                  </span>
                  <span className="text-[11px] font-sans text-ink/70 block mt-0.5">
                    Adicione mais um modelo para destravar os troféus
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSelectorForIndex(idx)}
                  className="px-3.5 py-2 bg-amber-300 text-ink text-xs font-mono font-bold rounded-xl border-2 border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] cursor-pointer"
                >
                  ➕ Escolher E-Bike
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. SEÇÕES TÉCNICAS ACORDEÃO PARA COMPARAÇÃO VERTICAL LIMPÍSSIMA */}
      <div className="bg-surface border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] space-y-3">
        <div className="flex items-center justify-between border-b-2 border-ink/20 pb-2 px-1">
          <h2 className="font-display font-black text-sm text-ink flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-primary" />
            <span>Raio-X Técnico por Categoria</span>
          </h2>
          <span className="text-[10px] font-mono text-ink/70 font-bold bg-bg-base border border-ink px-2 py-0.5 rounded-md">
            Toque para expandir
          </span>
        </div>

        {/* --- CATEGORIA 1: MOTOR & SISTEMA ELÉTRICO --- */}
        <div className="border-2 border-ink rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => toggleCategory('motor')}
            className="w-full p-3 bg-bg-base border-b border-ink/20 flex items-center justify-between text-left cursor-pointer font-display font-black text-xs text-ink"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>1. Motor &amp; Sistema Elétrico</span>
            </div>
            {openCategories.motor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openCategories.motor && (
            <div className="p-3 space-y-3 divide-y divide-ink/10 text-xs font-sans">
              {/* Métrica: Potência do Motor */}
              <div className="pt-1 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Potência Nominal (Watts)</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.marca} {item.bike.modelo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <span className="font-mono font-black text-xs text-ink">
                            {item.bike.potenciaW}W
                          </span>
                          {item.isPowerWinner && (
                            <span className="bg-amber-300 border border-ink text-[9px] px-1.5 py-0.5 rounded font-black text-ink shrink-0 whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                              🏆 +Potente
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Métrica: Velocidade Máxima */}
              <div className="pt-2.5 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Velocidade Máxima com Assistência</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    const speedVal = item.enriched.specSections[0]?.items[2]?.value || '25 km/h (limite legal para pedal assistido)';
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="pl-6 sm:pl-0 sm:text-right max-w-full">
                          <span className="font-mono font-bold text-xs text-ink leading-relaxed break-words block">
                            {speedVal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- CATEGORIA 2: BATERIA & ENERGIA --- */}
        <div className="border-2 border-ink rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => toggleCategory('bateria')}
            className="w-full p-3 bg-bg-base border-b border-ink/20 flex items-center justify-between text-left cursor-pointer font-display font-black text-xs text-ink"
          >
            <div className="flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-600" />
              <span>2. Bateria &amp; Autonomia</span>
            </div>
            {openCategories.bateria ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openCategories.bateria && (
            <div className="p-3 space-y-3 divide-y divide-ink/10 text-xs font-sans">
              {/* Métrica: Autonomia */}
              <div className="pt-1 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Autonomia Estimada por Carga</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <span className="font-mono font-bold text-xs text-ink">
                            {item.bike.autonomiaKm} km
                          </span>
                          {item.isAutonomyWinner && (
                            <span className="bg-emerald-300 border border-ink text-[9px] px-1.5 py-0.5 rounded font-black text-ink shrink-0 whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                              🏆 +Autonomia
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Métrica: Tempo de Carga */}
              <div className="pt-2.5 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Tempo de Carga do Carregador</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    const tempo = item.bike.tempoCargaHoras ? `${item.bike.tempoCargaHoras}h` : 'N/I';
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <span className="font-mono font-bold text-xs text-ink">
                            {tempo}
                          </span>
                          {item.isChargeWinner && (
                            <span className="bg-blue-300 border border-ink text-[9px] px-1.5 py-0.5 rounded font-black text-ink shrink-0 whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                              🏆 Recarga Rápida
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- CATEGORIA 3: QUADRO, PESO & ESTRUTURA --- */}
        <div className="border-2 border-ink rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => toggleCategory('quadro')}
            className="w-full p-3 bg-bg-base border-b border-ink/20 flex items-center justify-between text-left cursor-pointer font-display font-black text-xs text-ink"
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span>3. Quadro, Peso &amp; Estrutura</span>
            </div>
            {openCategories.quadro ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openCategories.quadro && (
            <div className="p-3 space-y-3 divide-y divide-ink/10 text-xs font-sans">
              {/* Métrica: Peso Total */}
              <div className="pt-1 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Peso Total da E-Bike</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    const peso = item.bike.pesoKg ? `${item.bike.pesoKg} kg` : 'N/I';
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <span className="font-mono font-bold text-xs text-ink">
                            {peso}
                          </span>
                          {item.isWeightWinner && (
                            <span className="bg-emerald-300 border border-ink text-[9px] px-1.5 py-0.5 rounded font-black text-ink shrink-0 whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                              🏆 +Leve
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Métrica: Material do Quadro */}
              <div className="pt-2.5 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Material do Quadro</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    const frameVal = item.enriched.specSections[2]?.items[0]?.value || 'Alumínio';
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 bg-neutral-50 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="pl-6 sm:pl-0 sm:text-right max-w-full">
                          <span className="font-mono font-bold text-xs text-ink leading-relaxed break-words block">
                            {frameVal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- CATEGORIA 4: PREÇO & OFERTAS --- */}
        <div className="border-2 border-ink rounded-xl overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => toggleCategory('preco')}
            className="w-full p-3 bg-bg-base border-b border-ink/20 flex items-center justify-between text-left cursor-pointer font-display font-black text-xs text-ink"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              <span>4. Preços &amp; Ofertas nas Lojas</span>
            </div>
            {openCategories.preco ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openCategories.preco && (
            <div className="p-3 space-y-3 divide-y divide-ink/10 text-xs font-sans">
              <div className="pt-1 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-ink/80 block">Menor Preço Conferido</span>
                <div className="space-y-1.5">
                  {slotsData.map((item, idx) => {
                    if (!item) return null;
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 bg-amber-50/60 border border-ink/20 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-black bg-bg-base border border-ink px-1.5 py-0.5 rounded shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-ink truncate">
                            {item.bike.modelo}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                          <span className="font-mono font-black text-xs text-ink">
                            {formatCurrency(item.bike.menorPreco)}
                          </span>
                          {item.isPriceWinner && (
                            <span className="bg-amber-300 border border-ink text-[9px] px-1.5 py-0.5 rounded font-black text-ink shrink-0 whitespace-nowrap shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                              🏆 Menor Preço
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
