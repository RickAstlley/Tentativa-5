'use client';

import React from 'react';
import Link from 'next/link';
import SafeImage from './ui/SafeImage';
import { 
  Gauge, 
  Zap, 
  ArrowRight, 
  Scale, 
  Clock, 
  ShieldCheck, 
  Layers, 
  Check 
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import BatteryChargeIndicator from './BatteryChargeIndicator';
import CategorySignBadge from './traffic/CategorySignBadge';
import { getEBikePricingDetails, formatBrl } from '@/lib/ebikeUtils';

interface EBikeCardProps {
  bike: EBikeGrouped;
  isCompared?: boolean;
  onCompareToggle?: () => void;
  featured?: boolean;
  priority?: boolean;
}

// Dicionário de destaques editoriais baseados no modelo
export const getExtraSpecs = (modelo: string) => {
  const m = modelo.toLowerCase();
  if (m.includes('easy rider')) return { destaque: 'Conforto Premium' };
  if (m.includes('easy one')) return { destaque: 'Custo-Benefício' };
  if (m.includes('big wheel')) return { destaque: 'Alta Performance MTB' };
  if (m.includes('trendy')) return { destaque: 'Estilo Urbano Slim' };
  if (m.includes('moby')) return { destaque: 'Dia a Dia Prático' };
  if (m.includes('impulse')) return { destaque: 'Dupla Suspensão Trail' };
  if (m.includes('sampa')) return { destaque: 'Extremamente Dobrável' };
  if (m.includes('cargo')) return { destaque: 'Carga Pesada Profissional' };
  if (m.includes('vado')) return { destaque: 'Tecnologia Premium Suíça' };
  return { destaque: 'Uso Geral' };
};

export default function EBikeCard({ bike, isCompared = false, onCompareToggle, featured = false, priority = false }: EBikeCardProps) {
  const extraSpecs = getExtraSpecs(bike.modelo);
  const pricing = getEBikePricingDetails(bike);
  const displayBadge = bike.badge || (extraSpecs.destaque && extraSpecs.destaque !== 'Uso Geral' ? extraSpecs.destaque : null);
  const displayTagOferta = bike.tagOferta;

  return (
    <div 
      className={`bg-surface border-2 border-ink transition-all duration-300 flex flex-col group h-full relative overflow-hidden rounded-[20px] sm:rounded-[24px] w-full ${
        isCompared 
          ? 'shadow-[3px_3px_0_0_rgba(16,185,129,1)] sm:shadow-[4px_4px_0_0_rgba(16,185,129,1)] translate-x-0 translate-y-0' 
          : 'shadow-[3px_3px_0_0_rgba(46,43,39,1)] sm:shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px]'
      }`}
      id={`ebike-card-${bike.slug}`}
    >
      
      {/* 1. IMAGEM DO PRODUTO AMPLA E COM DESTAQUE (Top Card - 16:10 Studio) */}
      <div className="relative w-full aspect-[16/10] bg-gradient-to-b from-neutral-50 to-neutral-100/80 border-b-2 border-ink flex items-center justify-center overflow-hidden p-1.5 sm:p-2 shrink-0">
        <SafeImage
          src={bike.imagemUrl}
          alt={`${bike.marca} ${bike.modelo}`}
          variant="card"
          priority={priority}
          className="object-contain object-center group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />

        {/* Badge Sutil de Categoria no Canto Superior Esquerdo */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <CategorySignBadge category={bike.usoPrincipal} size="xs" />
        </div>

        {/* Tag Comercial de Conversão no Canto Superior Direito */}
        {displayTagOferta && (
          <div className="absolute top-2.5 right-2.5 bg-rose-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider z-10 shadow-xs border border-ink/20">
            {displayTagOferta}
          </div>
        )}

        {/* Tag de Destaque Editorial / Badge no Rodapé da Imagem */}
        {displayBadge && (
          <div className="absolute bottom-2.5 left-2.5 bg-surface/95 backdrop-blur-xs border border-ink/40 text-amber-900 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider z-10 shadow-xs max-w-[85%] truncate">
            {displayBadge}
          </div>
        )}
      </div>

      {/* 2. CONTEÚDO PRINCIPAL DO CARD (LIMPO, EQUILIBRADO E RESPIRADO) */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between gap-3 min-w-0">
        
        {/* Marca & Modelo */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] sm:text-[11px] font-mono font-black text-primary uppercase tracking-wider">
            {bike.marca}
          </span>
          <h3 
            className="font-display font-bold text-ink leading-tight group-hover:text-primary transition-colors text-base sm:text-lg line-clamp-1"
            title={`${bike.marca} ${bike.modelo}`}
          >
            {bike.modelo}
          </h3>
        </div>

        {/* ESPECIFICAÇÕES ESSENCIAIS EM LINHA ÚNICA E LIMPA (SEM SOBRECARGA) */}
        <div className="flex items-center gap-2 py-2 px-2.5 bg-bg-base/70 rounded-xl border border-line text-ink font-mono text-xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Gauge className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex items-baseline gap-1 truncate">
              <span className="font-bold">{bike.autonomiaKm}</span>
              <span className="text-[10px] text-ink/60">km</span>
            </div>
          </div>

          <div className="w-[1px] h-3.5 bg-line shrink-0" />

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="flex items-baseline gap-1 truncate">
              <span className="font-bold">{bike.potenciaW}</span>
              <span className="text-[10px] text-ink/60">W</span>
            </div>
          </div>

          {bike.pesoKg && (
            <>
              <div className="w-[1px] h-3.5 bg-line shrink-0" />
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Scale className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <div className="flex items-baseline gap-1 truncate">
                  <span className="font-bold">{bike.pesoKg}</span>
                  <span className="text-[10px] text-ink/60">kg</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* BLOCO DE PREÇO & BOTÃO DE AÇÃO PRINCIPAL */}
        <div className="flex flex-col gap-2.5 pt-2 mt-auto border-t border-line/60">
          {/* Preço */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 h-4">
                {pricing.hasDiscount ? (
                  <>
                    <span className="text-xs font-mono text-stone-400 line-through">
                      De {formatBrl(pricing.precoOriginal)}
                    </span>
                    <span className="text-[10px] font-mono font-black bg-rose-600 text-white px-1.5 py-0.5 rounded">
                      -{pricing.percentualDesconto}%
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-ink/60 uppercase">
                    Menor Preço Conferido
                  </span>
                )}
              </div>
              <span className="font-mono font-black text-ink text-xl sm:text-2xl tracking-tight leading-none mt-1">
                {formatBrl(pricing.menorPreco)}
              </span>
            </div>

            <div className="shrink-0 scale-90 origin-right">
              <BatteryChargeIndicator 
                price={pricing.menorPreco} 
                minPrice={pricing.menorPreco} 
                maxPrice={pricing.precoOriginal}
                showLabel={false} 
              />
            </div>
          </div>

          {/* Botões de Ação com Texto Visível e Destaque: Comparar + Ver Ofertas */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCompareToggle) onCompareToggle();
              }}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-mono font-bold border-2 border-ink transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                isCompared
                  ? 'bg-emerald-600 text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                  : 'bg-white hover:bg-neutral-100 text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              }`}
              title={isCompared ? `Remover da comparação` : `Comparar`}
              aria-label={isCompared ? `Remover da comparação` : `Comparar`}
              aria-pressed={isCompared}
            >
              {isCompared ? <Check className="w-3.5 h-3.5 text-white stroke-[3] shrink-0" /> : <Layers className="w-3.5 h-3.5 text-primary shrink-0" />}
              <span className="whitespace-nowrap">{isCompared ? 'Comparando' : 'Comparar'}</span>
            </button>

            <Link 
              href={`/bike/${bike.slug}`}
              className="flex-1 min-h-[40px] bg-primary hover:bg-primary-dark text-white border-2 border-ink py-2 px-3 rounded-xl text-xs sm:text-sm font-bold font-mono flex items-center justify-center gap-1.5 transition-all duration-200 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:translate-x-[1px] active:translate-y-[1px] min-w-0"
              aria-label={`Ver ofertas para ${bike.marca} ${bike.modelo}`}
            >
              <span className="truncate whitespace-nowrap">Ver Ofertas</span>
              <ArrowRight className="w-4 h-4 text-accent-charge shrink-0" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
