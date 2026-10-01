'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  BatteryCharging, 
  ArrowRight, 
  Scale, 
  Layers, 
  Check, 
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import EBikeCompactCard from '@/components/catalog/EBikeCompactCard';
import EBikeTableRow from '@/components/catalog/EBikeTableRow';
import GridDensitySwitcher, { GridDensityMode } from '@/components/catalog/GridDensitySwitcher';
import { getEBikePricingDetails } from '@/lib/ebikeUtils';

interface MobileCatalogGridProps {
  bikes: EBikeGrouped[];
  formatBrl: (val: number) => string;
  onCompareToggle: (slug: string) => void;
  comparedSlugs: string[];
  onOpenFilters: () => void;
  activeFilterCount: number;
}

export default function MobileCatalogGrid({
  bikes,
  formatBrl,
  onCompareToggle,
  comparedSlugs,
  onOpenFilters,
  activeFilterCount
}: MobileCatalogGridProps) {
  const [displayLimit, setDisplayLimit] = useState(8);
  const [densityMode, setDensityMode] = useState<GridDensityMode>('editorial');

  const visibleBikes = useMemo(() => {
    return bikes.slice(0, displayLimit);
  }, [bikes, displayLimit]);

  const hasMore = bikes.length > displayLimit;

  return (
    <div className="w-full flex flex-col gap-3" id="mobile-catalog-grid-section">
      
      {/* Header do Catálogo (Card Branco Unificado) */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-accent-gold border border-ink flex items-center justify-center shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
              <Zap className="w-3.5 h-3.5 text-ink" />
            </div>
            <div>
              <h3 className="font-display font-black text-xs sm:text-sm text-ink tracking-tight">
                Todas as E-Bikes Monitoradas ({bikes.length})
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenFilters}
            className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
              activeFilterCount > 0
                ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                : 'bg-amber-50 hover:bg-accent-gold text-ink border-ink/40 hover:border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
          </button>
        </div>

        {/* Alternador de Densidade para Mobile */}
        <div className="flex items-center justify-between pt-1 border-t border-dashed border-ink/15">
          <span className="text-[9px] font-mono font-bold text-ink/60 uppercase">Visualização:</span>
          <GridDensitySwitcher
            mode={densityMode}
            onChange={setDensityMode}
          />
        </div>
      </div>

      {/* Exibição conforme o modo selecionado */}
      {visibleBikes.length > 0 ? (
        <>
          {densityMode === 'editorial' && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2 lg:gap-2.5">
              {visibleBikes.map((bike, idx) => {
                const isCompared = comparedSlugs.includes(bike.slug);
                const pricing = getEBikePricingDetails(bike);

                return (
                  <div
                    key={`${bike.slug}-${idx}`}
                    className={`bg-white border-2 border-ink rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-200 ${
                      isCompared 
                        ? 'shadow-[2px_2px_0_0_rgba(16,185,129,1)] ring-2 ring-emerald-500' 
                        : 'shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                    }`}
                  >
                    {/* Topo do Card com Foto */}
                    <div className="flex flex-col gap-1.5">
                      <div className="relative w-full aspect-video rounded-lg sm:rounded-xl bg-neutral-100 border border-ink/15 overflow-hidden flex items-center justify-center">
                        <SafeImage
                          src={bike.imagemUrl || '/placeholder-bike.png'}
                          alt={`${bike.marca} ${bike.modelo}`}
                          variant="compact"
                          className="object-contain p-1.5"
                          referrerPolicy="no-referrer"
                        />

                        {/* Tag de Categoria */}
                        <span className="absolute top-1 left-1 bg-ink/85 text-white font-mono font-bold text-[7px] px-1 py-0.2 rounded">
                          {bike.usoPrincipal}
                        </span>

                        {/* Badge de Desconto se houver */}
                        {pricing.hasDiscount && (
                          <span className="absolute top-1 right-1 bg-red-600 text-white font-mono font-black text-[7px] px-1 py-0.2 rounded border border-ink">
                            -{pricing.percentualDesconto}%
                          </span>
                        )}
                      </div>

                      {/* Informações Básicas */}
                      <div>
                        <span className="text-[8px] sm:text-[8.5px] font-mono font-bold text-primary uppercase">
                          {bike.marca}
                        </span>
                        <Link href={`/bike/${bike.slug}`}>
                          <h4 className="font-display font-black text-xs sm:text-[13px] text-ink leading-tight line-clamp-2 hover:text-primary transition-colors mt-0.5 min-h-[30px] sm:min-h-[34px]">
                            {bike.modelo}
                          </h4>
                        </Link>
                      </div>

                      {/* Micro Specs */}
                      <div className="flex items-center gap-1 text-[7.5px] sm:text-[8px] font-mono text-ink/70">
                        {bike.autonomiaKm && (
                          <span className="flex items-center gap-0.5 bg-neutral-50 px-1 py-0.5 rounded border border-ink/10">
                            <BatteryCharging className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            {bike.autonomiaKm}km
                          </span>
                        )}
                        {bike.potenciaW && (
                          <span className="flex items-center gap-0.5 bg-neutral-50 px-1 py-0.5 rounded border border-ink/10">
                            <Zap className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            {bike.potenciaW}W
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bloco de Preço e Ações */}
                    <div className="mt-2 pt-1.5 border-t border-ink/10 flex flex-col gap-1.5">
                      <div>
                        {pricing.hasDiscount && (
                          <div className="text-[7.5px] sm:text-[8px] font-mono text-ink/40 line-through">
                            {formatBrl(pricing.precoOriginal)}
                          </div>
                        )}
                        <div className="font-mono font-black text-xs sm:text-sm text-primary leading-none">
                          {formatBrl(pricing.menorPreco)}
                        </div>
                        <div className="text-[7px] sm:text-[7.5px] font-mono text-emerald-700 font-bold mt-0.5">
                          12x {formatBrl(pricing.parcelas12x)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                        <Link
                          href={`/bike/${bike.slug}`}
                          className="bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-[9px] py-1.5 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] text-center active:scale-95 transition-transform"
                        >
                          Ver
                        </Link>
                        <button
                          type="button"
                          onClick={() => onCompareToggle(bike.slug)}
                          className={`font-mono text-[8.5px] py-1.5 rounded-lg border transition-all cursor-pointer ${
                            isCompared
                              ? 'bg-emerald-500 text-white border-emerald-600 font-bold'
                              : 'bg-white hover:bg-neutral-100 text-ink border-ink/40'
                          }`}
                        >
                          {isCompared ? '✓ Comp.' : '+ Comp.'}
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {densityMode === 'compact' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2 lg:gap-2.5">
              {visibleBikes.map((bike, idx) => (
                <EBikeCompactCard
                  key={`compact-${bike.slug}-${idx}`}
                  bike={bike}
                  priority={false}
                  isCompared={comparedSlugs.includes(bike.slug)}
                  onCompareToggle={() => onCompareToggle(bike.slug)}
                />
              ))}
            </div>
          )}

          {densityMode === 'table' && (
            <div className="flex flex-col gap-2">
              {visibleBikes.map((bike, idx) => (
                <EBikeTableRow
                  key={`table-${bike.slug}-${idx}`}
                  bike={bike}
                  isCompared={comparedSlugs.includes(bike.slug)}
                  onCompareToggle={() => onCompareToggle(bike.slug)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border-2 border-ink rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
          <span className="font-display font-black text-xs text-ink">Nenhuma e-bike encontrada para esses filtros</span>
          <p className="text-[10px] font-mono text-ink/70">
            Tente relaxar os filtros de preço, potência ou categoria para ver mais opções.
          </p>
        </div>
      )}

      {/* Botão de Carregar Mais */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setDisplayLimit((prev) => prev + 8)}
          className="w-full bg-white hover:bg-neutral-50 text-ink font-mono font-black text-xs py-2.5 px-4 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
        >
          <Plus className="w-3.5 h-3.5 text-ink shrink-0" />
          <span>Ver Mais E-Bikes ({bikes.length - displayLimit} restantes)</span>
        </button>
      )}

    </div>
  );
}
