'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  Sparkles, 
  Zap, 
  BatteryCharging,
} from 'lucide-react';
import { LOGO_TUAVIA_DATA_URI } from '@/logoTuaViaDataUri';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';

interface MobileMasterHeaderProps {
  bikesCount: number;
  comparedSlugs?: string[];
  searchInput: string;
  setSearchInput: (val: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  selectedCategory: string;
  selectedMinPower: number;
  selectedMinAutonomy: number;
  maxPrice: number;
  onQuickChip: (type: 'price' | 'power' | 'autonomy' | 'category', val: any) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  onOpenFilterDrawer?: () => void;
  hideLogo?: boolean;
}

export default function MobileMasterHeader({
  bikesCount,
  comparedSlugs = [],
  searchInput,
  setSearchInput,
  onSearchSubmit,
  selectedCategory,
  selectedMinPower,
  selectedMinAutonomy,
  maxPrice,
  onQuickChip,
  onResetFilters,
  activeFilterCount,
  onOpenFilterDrawer,
  hideLogo = false,
}: MobileMasterHeaderProps) {
  const quickChipsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  return (
    <header className="w-full flex flex-col gap-1.5" id="mobile-master-header">
      {/* CARD PRINCIPAL DO CABEÇALHO COM ESTILO NEO-BRUTALIST PREMIUM & COMPACTO */}
      <div className="w-full bg-white/95 backdrop-blur-md border-2 border-ink rounded-2xl p-2.5 sm:p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-2 relative overflow-hidden">
        
        {/* Faixa Decorativa Sutil Superior (Ciclovia / Linha Esportiva) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-gold via-primary to-accent-gold opacity-90" />

        {/* 1. LINHA UNIFICADA: LOGO + BARRA DE BUSCA */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Logo TuaVia (Exibida no mobile ou quando não ocultada pelo desktop) */}
          {!hideLogo && (
            <Link href="/" className="flex items-center group shrink-0" aria-label="TuaVia Início">
              <div className="h-8 xs:h-9 w-auto max-w-[95px] xs:max-w-[110px] flex items-center transition-transform group-hover:scale-[1.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={LOGO_TUAVIA_DATA_URI}
                  alt="TuaVia"
                  width={110}
                  height={36}
                  className="h-full w-auto object-contain select-none pointer-events-none"
                />
              </div>
            </Link>
          )}

          {/* Barra de Busca Inteligente Integrada na Mesma Linha */}
          <form onSubmit={onSearchSubmit} className="relative flex-1 min-w-0">
            <div className="relative flex items-center w-full">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar modelo, marca..."
                className="w-full h-8 pl-7 pr-14 text-[11px] font-sans font-medium text-ink bg-neutral-50/90 border-2 border-ink rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-gold transition-all placeholder:text-ink/40"
              />
              <Search className="w-3.5 h-3.5 text-ink/60 absolute left-2 top-2 pointer-events-none" />
              
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Limpar busca"
                  className="absolute right-12 top-1.5 h-5 w-5 rounded-full bg-neutral-200 text-ink hover:bg-neutral-300 flex items-center justify-center text-[10px] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="submit"
                aria-label="Executar busca"
                className="absolute right-1 top-1 h-6 px-2 bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-[8.5px] rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>

        {/* 2. CHIPS DE ATALHO DE 1 TOQUE (HORIZONTAL SCROLL RÁPIDO COM FADE SUTIL) */}
        <div className="relative flex flex-col w-full">
          <div 
            ref={quickChipsRef}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5"
          >
            {/* Todas */}
            <button
              type="button"
              onClick={onResetFilters}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                activeFilterCount === 0 && !searchInput
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5 text-amber-700" />
              <span>Todas ({bikesCount})</span>
            </button>

            {/* Até R$ 5k */}
            <button
              type="button"
              onClick={() => onQuickChip('price', 5000)}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                maxPrice === 5000
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <span>🏷️ Até R$ 5k</span>
            </button>

            {/* 350W+ */}
            <button
              type="button"
              onClick={() => onQuickChip('power', 350)}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                selectedMinPower === 350
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <Zap className="w-2.5 h-2.5 text-amber-700" />
              <span>350W+</span>
            </button>

            {/* 50km+ */}
            <button
              type="button"
              onClick={() => onQuickChip('autonomy', 50)}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                selectedMinAutonomy === 50
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <BatteryCharging className="w-2.5 h-2.5 text-emerald-700" />
              <span>50km+</span>
            </button>

            {/* Dobráveis */}
            <button
              type="button"
              onClick={() => onQuickChip('category', 'Dobrável')}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                selectedCategory === 'Dobrável'
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <span>🎒 Dobráveis</span>
            </button>

            {/* Urbanas */}
            <button
              type="button"
              onClick={() => onQuickChip('category', 'Urbana')}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                selectedCategory === 'Urbana'
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <span>🏙️ Urbanas</span>
            </button>

            {/* Trilha/MTB */}
            <button
              type="button"
              onClick={() => onQuickChip('category', 'Trilha/MTB')}
              className={`px-2.5 py-1 rounded-lg border text-[9px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
                selectedCategory === 'Trilha/MTB'
                  ? 'bg-amber-300 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-black'
                  : 'bg-neutral-100 text-ink/80 border-ink/30 hover:bg-neutral-200'
              }`}
            >
              <span>⛰️ Trilha/MTB</span>
            </button>
          </div>

          {/* Suave indicação visual de continuidade no canto direito */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white/90 to-transparent" />
        </div>

        {/* 3. MICRO-TARJA EDITORIAL DE CONFIANÇA & CONTRAN */}
        <div className="w-full pt-1 border-t border-ink/10 flex items-center justify-between text-[8.5px] font-mono font-semibold text-ink/75">
          <span className="flex items-center gap-1">
            <span className="text-emerald-600 font-bold">✓</span> Fichas Técnicas Verificadas
          </span>
          <span className="flex items-center gap-1 text-primary font-bold">
            ⚡ Normas CONTRAN 996
          </span>
        </div>
      </div>

      {/* DICA DE SCROLL RETIRADA DO GRID: FORA DO GRID, COMPACTA E MINIMALISTA */}
      <BikeScrollIndicator 
        containerRef={quickChipsRef} 
        label="Deslize para mais atalhos" 
        variant="minimal"
        className="py-0 -mt-0.5"
      />
    </header>
  );
}
