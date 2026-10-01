'use client';

import React from 'react';
import SafeImage from '@/components/ui/SafeImage';
import { Search, X, Plus } from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';

interface CompareSelectorModalProps {
  showSelectorForIndex: number | null;
  setShowSelectorForIndex: (index: number | null) => void;
  selectorSearch: string;
  setSelectorSearch: (val: string) => void;
  candidateBikes: EBikeGrouped[];
  selectedSlugs: string[];
  addBike: (slug: string) => void;
  replaceBike: (index: number, slug: string) => void;
}

export default function CompareSelectorModal({
  showSelectorForIndex,
  setShowSelectorForIndex,
  selectorSearch,
  setSelectorSearch,
  candidateBikes,
  selectedSlugs,
  addBike,
  replaceBike,
}: CompareSelectorModalProps) {
  if (showSelectorForIndex === null) return null;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const isReplacing = showSelectorForIndex < selectedSlugs.length;

  return (
    <div
      className="fixed inset-0 bg-ink/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      id="compare-selector-modal-wrapper"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSelectorForIndex(null);
          setSelectorSearch('');
        }
      }}
    >
      <div className="bg-surface border-2 border-ink rounded-3xl w-full max-w-lg shadow-[6px_6px_0_0_rgba(46,43,39,1)] md:shadow-[8px_8px_0_0_rgba(46,43,39,1)] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header do Seletor */}
        <div className="p-4 sm:p-5 border-b-2 border-ink flex items-center justify-between bg-bg-base">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-charge border border-ink flex items-center justify-center text-ink font-bold shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-black text-sm sm:text-base text-ink">
                {isReplacing ? `Substituir na Posição ${showSelectorForIndex + 1}` : 'Escolher E-Bike para Comparar'}
              </h3>
              <p className="text-xs font-sans text-ink/70">
                Selecione um modelo do catálogo auditado
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowSelectorForIndex(null);
              setSelectorSearch('');
            }}
            className="p-2.5 rounded-xl border-2 border-ink bg-white hover:bg-neutral-100 text-ink cursor-pointer shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-transform active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Fechar janela"
            aria-label="Fechar janela de seleção"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Busca de Modelo - text-base (16px) no mobile para evitar zoom automático no iOS Safari */}
        <div className="p-3.5 sm:p-4 border-b-2 border-ink bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/60 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por marca ou modelo..."
              value={selectorSearch}
              onChange={(e) => setSelectorSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-bg-base text-base md:text-xs font-sans rounded-2xl border-2 border-ink text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-[2px_2px_0_0_rgba(46,43,39,1)] placeholder:text-ink/40"
              autoFocus
            />
          </div>
        </div>

        {/* Lista de Candidatos */}
        <div className="flex-1 overflow-y-auto divide-y-2 divide-ink/10 p-2 bg-surface">
          {candidateBikes.length > 0 ? (
            candidateBikes.map((bike, idx) => (
              <button
                key={`candidate-${bike.slug}-${idx}`}
                onClick={() => {
                  const idx = showSelectorForIndex;
                  if (idx !== null) {
                    if (idx < selectedSlugs.length) {
                      replaceBike(idx, bike.slug);
                    } else {
                      addBike(bike.slug);
                    }
                  }
                }}
                className="w-full p-3 sm:p-3.5 my-1 hover:bg-white border-2 border-transparent hover:border-ink rounded-2xl text-left flex gap-3.5 items-center transition-all cursor-pointer group shadow-none hover:shadow-[3px_3px_0_0_rgba(46,43,39,1)] min-h-[52px]"
              >
                <div className="relative w-full aspect-video max-w-16 max-h-12 rounded-xl bg-white border border-ink/20 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                  <SafeImage 
                    src={bike.imagemUrl || '/placeholder-bike.png'} 
                    alt={bike.modelo}
                    fill
                    className="object-contain p-0.5"
                    fallbackSrc="/placeholder-bike.png"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-mono font-bold text-ink uppercase tracking-wider bg-accent-gold/30 border border-ink/20 px-2 py-0.5 rounded-md w-fit inline-block">
                    {bike.marca}
                  </span>
                  <h4 className="font-display font-black text-xs text-ink leading-tight truncate mt-0.5 group-hover:text-primary transition-colors">
                    {bike.modelo}
                  </h4>
                  <div className="flex gap-1.5 text-[9px] font-mono text-ink/70 mt-1 flex-wrap">
                    <span className="bg-white border border-ink/20 px-1.5 py-0.2 rounded">{bike.autonomiaKm}km aut.</span>
                    <span className="bg-white border border-ink/20 px-1.5 py-0.2 rounded">{bike.potenciaW}W pot.</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-primary block">{formatCurrency(bike.menorPreco)}</span>
                  <span className="text-[9px] font-mono font-bold bg-amber-300 border border-ink px-2 py-0.5 rounded-full inline-block mt-1 text-ink">
                    + Selecionar
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-ink/80 font-mono flex flex-col items-center gap-3">
              <span className="font-black text-amber-900 bg-amber-300 border-2 border-ink px-4 py-2 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
                ⚠️ NENHUM MODELO ENCONTRADO
              </span>
              <span>Ajuste o termo digitado na busca acima para ver outras opções do catálogo.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

