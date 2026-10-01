'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { 
  GitCompare, 
  ArrowRight, 
  Sparkles, 
  BatteryCharging, 
  Zap, 
  Scale, 
  ShieldCheck, 
  ExternalLink,
  Tag
} from 'lucide-react';

interface RelatedSimilarBikesProps {
  currentBike: EBikeGrouped;
  allBikes: EBikeGrouped[];
  formatCurrency: (val: number) => string;
}

export default function RelatedSimilarBikes({
  currentBike,
  allBikes,
  formatCurrency
}: RelatedSimilarBikesProps) {
  // Encontra modelos concorrentes diretos (mesma categoria ou faixa de preço similar ±30%)
  const similarBikes = React.useMemo(() => {
    if (!allBikes || allBikes.length <= 1) return [];

    const minPriceLimit = currentBike.menorPreco * 0.65;
    const maxPriceLimit = currentBike.menorPreco * 1.35;

    const filtered = allBikes
      .filter((b) => b.slug !== currentBike.slug)
      .map((b) => {
        let score = 0;
        // Mesmo uso principal / categoria
        if (b.usoPrincipal === currentBike.usoPrincipal) score += 5;
        // Faixa de preço parecida
        if (b.menorPreco >= minPriceLimit && b.menorPreco <= maxPriceLimit) score += 3;
        // Potência semelhante
        if (Math.abs((b.potenciaW || 0) - (currentBike.potenciaW || 0)) <= 100) score += 1;

        return { bike: b, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.bike);

    return filtered.slice(0, 3);
  }, [currentBike, allBikes]);

  if (similarBikes.length === 0) return null;

  return (
    <div className="w-full bg-white border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-5 mt-6" id="modelos-similares-concorrentes">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-line pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-accent-gold rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] text-ink">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-ink/70 uppercase">
              Alternativas &amp; Concorrentes
            </span>
            <h3 className="font-display font-black text-lg sm:text-xl text-ink">
              Modelos Similares a {currentBike.modelo}
            </h3>
          </div>
        </div>

        <Link
          href={`/ebike?uso=${encodeURIComponent(currentBike.usoPrincipal || '')}`}
          className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          <span>Ver mais em {currentBike.usoPrincipal}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid de 3 Concorrentes Diretos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {similarBikes.map((bike, idx) => {
          const priceDiff = bike.menorPreco - currentBike.menorPreco;
          const isCheaper = priceDiff < 0;

          return (
            <div
              key={`similar-bike-${bike.slug}-${idx}`}
              className="bg-neutral-50 hover:bg-white border-2 border-ink rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex flex-col justify-between gap-3 group"
            >
              <div className="flex flex-col gap-2">
                <div className="relative w-full aspect-video rounded-xl bg-white border-2 border-ink/30 overflow-hidden p-2">
                  <SafeImage
                    src={bike.imagemUrl}
                    alt={bike.modelo}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-mono font-bold text-ink/70 uppercase">
                    {bike.marca}
                  </span>
                  <Link
                    href={`/bike/${bike.slug}`}
                    className="font-display font-black text-sm text-ink group-hover:text-primary transition-colors line-clamp-1"
                  >
                    {bike.modelo}
                  </Link>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-black text-primary text-sm">
                      {formatCurrency(bike.menorPreco)}
                    </span>
                    {priceDiff !== 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isCheaper 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {isCheaper ? `-${formatCurrency(Math.abs(priceDiff))}` : `+${formatCurrency(priceDiff)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparador de Specs Rápidas */}
              <div className="grid grid-cols-2 gap-1.5 bg-white border border-ink/20 rounded-xl p-2 font-mono text-[10px] text-ink">
                <div>
                  <span className="text-ink/60 block text-[8px]">Potência</span>
                  <span className="font-bold">{bike.potenciaW || 250}W</span>
                </div>
                <div className="border-l border-ink/15 pl-1.5">
                  <span className="text-ink/60 block text-[8px]">Autonomia</span>
                  <span className="font-bold">{bike.autonomiaKm || 35}km</span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/comparar?slugs=${currentBike.slug},${bike.slug}`}
                  className="flex-1 text-center py-2 rounded-xl bg-accent-gold hover:bg-amber-400 border-2 border-ink font-mono text-[11px] font-black text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] transition-all flex items-center justify-center gap-1"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Comparar 1v1</span>
                </Link>
                <Link
                  href={`/bike/${bike.slug}`}
                  className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-ink text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] transition-all"
                  title="Ver Ficha"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
