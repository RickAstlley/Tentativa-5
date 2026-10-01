'use client';

import React from 'react';
import SafeImage from '@/components/ui/SafeImage';
import Link from 'next/link';
import { Layers, X, ArrowRight } from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';

interface CompareTrayProps {
  comparedSlugs: string[];
  comparedBikes: EBikeGrouped[];
  handleRemoveFromCompare: (slug: string) => void;
  clearCompare: () => void;
}

export default function CompareTray({
  comparedSlugs,
  comparedBikes,
  handleRemoveFromCompare,
  clearCompare,
}: CompareTrayProps) {
  if (comparedSlugs.length === 0) return null;

  return (
    <div className="fixed bottom-[92px] md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 max-w-2xl bg-white text-ink p-4 sm:p-5 rounded-2xl md:rounded-3xl shadow-[5px_5px_0_0_rgba(46,43,39,1)] border-2 border-ink z-40 animate-in slide-in-from-bottom duration-300 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-accent-gold border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] text-ink flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-mono font-black uppercase text-ink tracking-wider">Comparador de E-Bikes</p>
          <p className="text-[11px] text-ink/75 font-sans font-medium mt-0.5">
            {comparedSlugs.length} {comparedSlugs.length === 1 ? 'modelo selecionado' : 'modelos selecionados'} (máx. 3)
          </p>
        </div>
      </div>

      {/* Previews rápidos das bikes selecionadas */}
      <div className="flex gap-2.5 items-center">
        {comparedBikes.map((bike) => (
          <div key={bike.slug} className="relative group/tray">
            <div className="relative w-full aspect-video max-w-12 max-h-12 rounded-xl overflow-hidden bg-neutral-100 border-2 border-ink shadow-xs flex items-center justify-center p-0.5">
              <SafeImage 
                src={bike.imagemUrl || (bike as any).galleryImages?.[0] || (bike as any).ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'} 
                alt={bike.modelo}
                fill
                className="object-contain"
                fallbackSrc="/placeholder-bike.png"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Botão de excluir rápida */}
            <button
              type="button"
              onClick={() => handleRemoveFromCompare(bike.slug)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 border-2 border-ink hover:scale-110 transition-transform cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={`Remover ${bike.modelo}`}
              aria-label={`Remover ${bike.modelo} da comparação`}
            >
              <X className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
        ))}

        {Array.from({ length: 3 - comparedSlugs.length }).map((_, i) => (
          <div 
            key={i} 
            className="w-full aspect-video max-w-12 max-h-12 rounded-xl border-2 border-dashed border-ink/40 bg-neutral-50 flex items-center justify-center text-ink/40 text-sm font-mono font-bold"
            title="Selecione outro modelo no card"
          >
            +
          </div>
        ))}
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-2 w-full sm:w-auto shrink-0 border-t-2 border-dashed border-ink/20 sm:border-t-0 pt-3 sm:pt-0">
        <button
          type="button"
          onClick={clearCompare}
          className="flex-1 sm:flex-initial text-center px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-ink/70 hover:text-ink hover:bg-neutral-100 transition-all cursor-pointer min-h-[44px] flex items-center justify-center border-2 border-transparent hover:border-ink"
          aria-label="Limpar comparação"
        >
          Limpar
        </button>
        <Link
          href={`/comparar?slugs=${comparedSlugs.join(',')}`}
          className="flex-1 sm:flex-initial bg-primary hover:bg-primary-dark text-white border-2 border-ink px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer min-h-[44px]"
          aria-label={`Comparar os ${comparedSlugs.length} modelos selecionados agora`}
        >
          <span>Comparar</span>
          <ArrowRight className="w-3.5 h-3.5 text-accent-charge shrink-0" />
        </Link>
      </div>
    </div>
  );
}
