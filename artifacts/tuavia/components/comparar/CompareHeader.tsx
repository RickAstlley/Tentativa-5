'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Layers, Sparkles } from 'lucide-react';

interface CompareHeaderProps {
  shareCopied?: boolean;
  onShareClick?: () => void;
  comparedCount: number;
  totalCatalogCount?: number;
  onOpenSelector?: () => void;
  onClearAll?: () => void;
}

export default function CompareHeader({
  shareCopied = false,
  onShareClick,
  comparedCount,
  totalCatalogCount,
  onOpenSelector,
  onClearAll,
}: CompareHeaderProps) {
  const handleShare = () => {
    if (onShareClick) {
      onShareClick();
    } else if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
    }
  };
  return (
    <div className="bg-surface border-2 border-ink rounded-2xl md:rounded-3xl p-3.5 sm:p-6 md:p-8 shadow-[3px_3px_0_0_rgba(46,43,39,1)] md:shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3 md:gap-6" id="compare-header-component">
      
      {/* --- VISÃO MOBILE COMPACTA (md:hidden) --- */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-ink bg-white border-2 border-ink px-2.5 py-1.5 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform min-h-[38px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-primary" />
          <span>Voltar</span>
        </Link>

        <span className="text-xs font-mono font-bold text-ink bg-bg-base border-2 border-ink px-2.5 py-1.5 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase tracking-wider flex items-center gap-1 truncate max-w-[200px]">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">
            {totalCatalogCount ?? 0} ativas · {comparedCount} sel.
          </span>
        </span>

        {comparedCount > 0 && (
          <button
            onClick={handleShare}
            className="p-1.5 bg-white text-ink rounded-xl border-2 border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
            title="Compartilhar comparação"
          >
            {shareCopied ? <Check className="w-4 h-4 text-accent-verde" /> : <Layers className="w-4 h-4 text-primary" />}
          </button>
        )}
      </div>

      {/* --- VISÃO DESKTOP COMPLETA (hidden md:flex) --- */}
      <div className="hidden md:flex items-center justify-between gap-3 flex-wrap">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-ink bg-white border-2 border-ink px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 transition-all group"
        >
          <ArrowLeft className="w-4 h-4 text-primary group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar ao Catálogo</span>
        </Link>

        <span className="text-xs font-mono font-bold text-ink bg-bg-base border-2 border-ink px-3 py-1.5 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase tracking-wider flex items-center gap-1.5 whitespace-normal">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>
            {totalCatalogCount ?? 0} {totalCatalogCount === 1 ? 'e-bike ativa' : 'e-bikes ativas'} · {comparedCount} {comparedCount === 1 ? 'selecionada' : 'selecionadas'}
          </span>
        </span>
      </div>

      {/* Hero do Comparador */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-6 pt-2 md:pt-4 border-t-2 border-dashed border-ink/20">
        <div className="max-w-2xl flex flex-col gap-1 md:gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 md:px-3 md:py-1 bg-amber-400 border border-ink rounded-full w-fit shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
            <span className="text-[9px] md:text-xs font-mono font-black text-ink uppercase tracking-wider flex items-center gap-1">
              <span>🚦</span> Pare, veja e compare
            </span>
          </div>
          <h1 className="font-display font-black text-xl sm:text-3xl md:text-5xl text-ink tracking-tight">
            Comparador <span className="text-primary">Lado a Lado</span>
          </h1>
          <p className="text-xs md:text-base text-ink/80 font-sans leading-snug md:leading-relaxed mt-0.5 md:mt-1 hidden sm:block">
            Escolha até 3 bicicletas elétricas para comparar fichas técnicas auditadas, autonomia real, potência e preços das lojas brasileiras.
          </p>
        </div>

        {comparedCount > 0 && (
          <button
            onClick={handleShare}
            className="hidden md:inline-flex items-center justify-center gap-2 bg-white hover:bg-neutral-50 text-ink text-xs font-mono font-bold py-3 px-4 rounded-2xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all cursor-pointer shrink-0 min-h-[44px]"
            title="Copiar link de compartilhamento para aplicativos de mensagem"
          >
            {shareCopied ? (
              <>
                <Check className="w-4 h-4 text-accent-verde animate-in fade-in zoom-in-75 duration-200" />
                <span className="text-accent-verde font-black">Link de Comparação Copiado!</span>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 text-primary" />
                <span>Compartilhar Comparação</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

