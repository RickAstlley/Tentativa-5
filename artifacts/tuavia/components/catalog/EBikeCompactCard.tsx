'use client';

import React from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  Gauge, 
  Zap, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Check,
  ExternalLink,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import CategorySignBadge from '@/components/traffic/CategorySignBadge';
import { getEBikePricingDetails, formatBrl } from '@/lib/ebikeUtils';

interface EBikeCompactCardProps {
  bike: EBikeGrouped;
  isCompared?: boolean;
  onCompareToggle?: () => void;
  priority?: boolean;
}

export default function EBikeCompactCard({
  bike,
  isCompared = false,
  onCompareToggle,
  priority = false
}: EBikeCompactCardProps) {
  const pricing = getEBikePricingDetails(bike);

  return (
    <div 
      className={`h-full min-w-0 w-full bg-surface border-2 border-ink rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between group ${
        isCompared 
          ? 'shadow-[2.5px_2.5px_0_0_rgba(16,185,129,1)] ring-1 ring-emerald-500' 
          : 'shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
      }`}
      id={`ebike-compact-${bike.slug}`}
    >
      {/* Imagem Superior Compacta (16:9) */}
      <div className="relative w-full aspect-video bg-neutral-100 overflow-hidden border-b-2 border-ink shrink-0 flex items-center justify-center">
        <SafeImage
          src={bike.imagemUrl || bike.galleryImages?.[0] || bike.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
          fallbackSrc="/placeholder-bike.png"
          alt={`${bike.marca} ${bike.modelo}`}
          variant="compact"
          priority={priority}
          className="object-contain p-1.5 sm:p-2 object-center group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />

        {/* Categoria com largura máxima controlada */}
        <div className="absolute top-1.5 left-1.5 z-10 max-w-[calc(100%-48px)] truncate">
          <CategorySignBadge category={bike.usoPrincipal} size="xs" />
        </div>

        {/* Badge Economia se houver */}
        {pricing.hasDiscount && (
          <div className="absolute top-1.5 right-1.5 bg-accent-warm text-white font-mono text-[7.5px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded border border-ink shadow-xs z-10 whitespace-nowrap">
            -{pricing.percentualDesconto}%
          </div>
        )}
      </div>

      {/* Dados Rápidos com Conteúdo Contido */}
      <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1 gap-2 min-w-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[8.5px] sm:text-[9px] font-mono font-black text-primary uppercase tracking-wider truncate block">
            {bike.marca}
          </span>
          <Link href={`/bike/${bike.slug}`}>
            <h4 
              className="font-display font-bold text-xs sm:text-[13px] text-ink leading-snug group-hover:text-primary transition-colors line-clamp-2 min-h-[30px] sm:min-h-[34px]"
              title={`${bike.marca} ${bike.modelo}`}
            >
              {bike.modelo}
            </h4>
          </Link>
        </div>

        {/* Micro-Dashboard de 2 Métricas */}
        <div className="grid grid-cols-2 gap-1 py-1 px-1.5 bg-neutral-50 border border-ink/15 rounded-lg text-[9px] sm:text-[10px] font-mono min-w-0">
          <div className="flex items-center gap-1 min-w-0 overflow-hidden" title={`Autonomia estimada: ${bike.autonomiaKm || 'N/D'} km`}>
            <Gauge className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
            <span className="font-bold text-ink truncate">{bike.autonomiaKm ? `${bike.autonomiaKm}km` : '-'}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0 overflow-hidden" title={`Potência do motor: ${bike.potenciaW || 'N/D'}W`}>
            <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600 shrink-0" />
            <span className="font-bold text-ink truncate">{bike.potenciaW ? `${bike.potenciaW}W` : '-'}</span>
          </div>
        </div>

        {/* Preço e Botões */}
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-dashed border-ink/15 mt-auto min-w-0">
          <div className="flex flex-col min-w-0">
            {pricing.hasDiscount ? (
              <div className="flex items-baseline gap-1 flex-wrap min-w-0">
                <span className="text-[8.5px] sm:text-[9px] font-mono text-stone-400 line-through truncate">
                  {formatBrl(pricing.precoOriginal)}
                </span>
                <span className="text-[7.5px] sm:text-[8px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 rounded truncate">
                  Econ. {formatBrl(pricing.economia)}
                </span>
              </div>
            ) : (
              <span className="text-[7.5px] sm:text-[8px] font-mono text-ink/60 uppercase">Menor preço</span>
            )}
            <div className="font-mono font-black text-xs sm:text-sm text-ink truncate leading-tight mt-0.5">
              {formatBrl(pricing.menorPreco)}
            </div>
            {pricing.parcelas12x && pricing.parcelas12x > 0 && (
              <div className="text-[7.5px] sm:text-[8.5px] font-mono text-emerald-700 font-bold truncate mt-0.5">
                12x {formatBrl(pricing.parcelas12x)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 sm:gap-1.5 pt-0.5 w-full min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCompareToggle) onCompareToggle();
              }}
              className={`w-full min-w-0 py-1 sm:py-1.5 px-1 rounded-lg text-[8.5px] sm:text-[9.5px] font-mono font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                isCompared
                  ? 'bg-emerald-600 text-white border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                  : 'bg-white hover:bg-neutral-100 text-ink border-ink/40 hover:border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              }`}
              title={isCompared ? 'Remover da comparação' : 'Comparar especificações'}
              aria-label={isCompared ? 'Remover da comparação' : 'Comparar especificações'}
              aria-pressed={isCompared}
            >
              {isCompared ? (
                <>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white shrink-0 stroke-[3]" />
                  <span className="truncate">Salva</span>
                </>
              ) : (
                <>
                  <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
                  <span className="truncate">Comp.</span>
                </>
              )}
            </button>

            <Link
              href={`/bike/${bike.slug}`}
              className="w-full min-w-0 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-[9px] sm:text-[10px] py-1 sm:py-1.5 px-1 rounded-lg border border-ink flex items-center justify-center gap-0.5 sm:gap-1 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:shadow-[0.5px_0.5px_0_0_rgba(46,43,39,1)]"
              title={`Ver ofertas para ${bike.modelo}`}
            >
              <span className="truncate">Ofertas</span>
              <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent-charge shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
