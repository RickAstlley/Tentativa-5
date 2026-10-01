'use client';

import React from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  Gauge, 
  Zap, 
  ArrowRight, 
  Scale, 
  ShieldCheck, 
  Layers, 
  Check,
  TrendingDown,
  Store
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import CategorySignBadge from '@/components/traffic/CategorySignBadge';

interface EBikeTableRowProps {
  bike: EBikeGrouped;
  isCompared?: boolean;
  onCompareToggle?: () => void;
}

export default function EBikeTableRow({
  bike,
  isCompared = false,
  onCompareToggle
}: EBikeTableRowProps) {
  const offerCount = bike.ofertas?.length || 0;
  const economy = (bike.maiorPreco || 0) - (bike.menorPreco || 0);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    });
  };

  return (
    <div 
      className={`bg-white border-2 border-ink rounded-xl p-3 sm:p-4 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 group ${
        isCompared 
          ? 'shadow-[3px_3px_0_0_rgba(16,185,129,1)]' 
          : 'shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
      }`}
      id={`ebike-row-${bike.slug}`}
    >
      {/* 1. Imagem e Info Primária (Marca, Modelo, Categoria) */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 lg:w-[36%] shrink-0">
        <div className="relative w-full aspect-video sm:max-w-24 sm:max-h-24 rounded-xl overflow-hidden bg-neutral-100 border border-ink/40 shrink-0">
          <SafeImage
            src={bike.imagemUrl || bike.galleryImages?.[0] || bike.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
            fallbackSrc="/placeholder-bike.png"
            alt={`${bike.marca} ${bike.modelo}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            sizes="96px"
          />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-black text-primary uppercase tracking-wider">
              {bike.marca}
            </span>
            <CategorySignBadge category={bike.usoPrincipal} size="xs" />
          </div>

          <Link href={`/bike/${bike.slug}`}>
            <h4 className="font-display font-bold text-sm sm:text-base text-ink group-hover:text-primary transition-colors truncate" title={`${bike.marca} ${bike.modelo}`}>
              {bike.modelo}
            </h4>
          </Link>

          <span className="text-[10px] font-mono text-ink/60 mt-0.5">
            {offerCount > 1 ? `${offerCount} lojas auditadas` : '1 loja com oferta verificada'}
          </span>
        </div>
      </div>

      {/* 2. Métricas Técnicas em Grade Horizontal com largura isolada */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:w-[28%] bg-neutral-50 p-2 sm:p-2.5 rounded-lg border border-ink/20 font-mono text-xs shrink-0">
        <div className="flex flex-col">
          <span className="text-[9px] text-ink/60 uppercase flex items-center gap-1 truncate">
            <Gauge className="w-3 h-3 text-primary shrink-0" /> Autonomia
          </span>
          <strong className="text-ink text-xs sm:text-sm mt-0.5 whitespace-nowrap">{bike.autonomiaKm} km</strong>
        </div>

        <div className="flex flex-col border-l border-ink/15 pl-1.5 sm:pl-2">
          <span className="text-[9px] text-ink/60 uppercase flex items-center gap-1 truncate">
            <Zap className="w-3 h-3 text-amber-600 shrink-0" /> Potência
          </span>
          <strong className="text-ink text-xs sm:text-sm mt-0.5 whitespace-nowrap">{bike.potenciaW}W</strong>
        </div>

        <div className="flex flex-col border-l border-ink/15 pl-1.5 sm:pl-2">
          <span className="text-[9px] text-ink/60 uppercase flex items-center gap-1 truncate">
            <Scale className="w-3 h-3 text-ink/70 shrink-0" /> Peso
          </span>
          <strong className="text-ink text-xs sm:text-sm mt-0.5 whitespace-nowrap">{bike.pesoKg ? `${bike.pesoKg}kg` : 'N/I'}</strong>
        </div>
      </div>

      {/* 3. Preço Isolado (sem colisão com as especificações) */}
      <div className="flex flex-col lg:items-end lg:w-[15%] shrink-0">
        {economy > 0 ? (
          <span className="text-[9px] font-mono font-bold text-emerald-700 whitespace-nowrap">
            Economize {formatCurrency(economy)}
          </span>
        ) : (
          <span className="text-[9px] font-mono text-ink/50 uppercase">
            Menor preço
          </span>
        )}
        <span className="font-mono font-black text-base sm:text-lg text-ink tracking-tight whitespace-nowrap">
          {formatCurrency(bike.menorPreco)}
        </span>
      </div>

      {/* 4. Ações: Comparar e Ver Lojas */}
      <div className="flex items-center gap-2 lg:w-[21%] justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-dashed border-ink/20 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onCompareToggle) onCompareToggle();
          }}
          className={`py-2 px-2.5 sm:px-3 rounded-xl font-mono text-xs font-bold border-2 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
            isCompared
              ? 'bg-emerald-600 text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              : 'bg-white hover:bg-neutral-100 text-ink border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
          }`}
          title={isCompared ? 'Remover da comparação' : 'Comparar especificações'}
          aria-label={isCompared ? 'Remover da comparação' : 'Comparar'}
          aria-pressed={isCompared}
        >
          {isCompared ? <Check className="w-3.5 h-3.5 text-white stroke-[3] shrink-0" /> : <Layers className="w-3.5 h-3.5 text-primary shrink-0" />}
          <span className="whitespace-nowrap">{isCompared ? 'Comparando' : 'Comparar'}</span>
        </button>

        <Link
          href={`/bike/${bike.slug}`}
          className="bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs py-2 px-3 sm:px-3.5 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-1.5 transition-all shrink-0 whitespace-nowrap"
        >
          <span>Ver Lojas</span>
          <ArrowRight className="w-3.5 h-3.5 text-accent-charge shrink-0" />
        </Link>
      </div>
    </div>
  );
}
