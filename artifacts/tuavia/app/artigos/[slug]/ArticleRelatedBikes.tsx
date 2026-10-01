'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bike, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import EBikeCompactCard from '@/components/catalog/EBikeCompactCard';
import CompareTray from '@/components/catalog/CompareTray';

interface ArticleRelatedBikesProps {
  relatedBikes: EBikeGrouped[];
  categoryName: string;
}

export default function ArticleRelatedBikes({ relatedBikes, categoryName }: ArticleRelatedBikesProps) {
  const [comparedSlugs, setComparedSlugs] = useState<string[]>([]);

  const handleCompareToggle = (slug: string) => {
    setComparedSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, slug];
    });
  };

  const handleRemoveFromCompare = (slug: string) => {
    setComparedSlugs((prev) => prev.filter((s) => s !== slug));
  };

  const comparedBikes = relatedBikes.filter((b) => comparedSlugs.includes(b.slug));

  return (
    <section className="bg-surface border-2 border-ink rounded-3xl p-4 sm:p-6 lg:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-5 sm:gap-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-black bg-accent-charge text-ink border border-ink px-2.5 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-primary" />
              <span>No Catálogo</span>
            </span>
            <span className="text-[11px] font-mono text-ink/70 font-bold">
              • {relatedBikes.length} {relatedBikes.length === 1 ? 'modelo auditado' : 'modelos auditados'}
            </span>
          </div>
          <h2 className="font-display font-black text-lg sm:text-xl md:text-2xl text-ink leading-snug">
            Modelos Recomendados de E-Bikes {categoryName}
          </h2>
          <p className="text-xs sm:text-sm text-ink/75 font-sans">
            Confira ofertas e especificações auditadas para este perfil de uso no comparador TuaVia.
          </p>
        </div>

        <Link
          href={`/ebike?uso=${encodeURIComponent(categoryName)}`}
          className="bg-white hover:bg-neutral-50 text-ink font-mono font-bold text-xs px-4 py-2.5 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer min-h-[40px]"
        >
          <span>Ver todos os modelos</span>
          <ArrowRight className="w-4 h-4 text-primary" />
        </Link>
      </div>

      {/* Dica de Swipe no Mobile */}
      {relatedBikes.length > 1 && (
        <div className="flex items-center justify-between sm:hidden -mt-1 text-[11px] font-mono text-ink/60">
          <span className="flex items-center gap-1.5 font-bold text-ink/70">
            <span>Deslize para comparar</span>
            <ArrowRight className="w-3 h-3 text-primary animate-pulse" />
          </span>
          <span className="text-[10px] text-ink/50 bg-neutral-100 border border-ink/20 px-1.5 py-0.5 rounded">
            1 a {relatedBikes.length}
          </span>
        </div>
      )}

      {/* Carrossel no Mobile / Grid a partir de Tablet */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-3 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 no-scrollbar">
        {relatedBikes.map((bike) => (
          <div key={bike.slug} className="w-[78vw] xs:w-[280px] sm:w-auto shrink-0 snap-start h-full">
            <EBikeCompactCard
              bike={bike}
              isCompared={comparedSlugs.includes(bike.slug)}
              onCompareToggle={() => handleCompareToggle(bike.slug)}
            />
          </div>
        ))}
      </div>

      {/* Comparador Flutuante se Selecionado */}
      {comparedSlugs.length > 0 && (
        <CompareTray
          comparedSlugs={comparedSlugs}
          comparedBikes={comparedBikes}
          handleRemoveFromCompare={handleRemoveFromCompare}
          clearCompare={() => setComparedSlugs([])}
        />
      )}

    </section>
  );
}
