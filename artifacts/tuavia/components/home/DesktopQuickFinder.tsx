'use client';

import React from 'react';
import { Search, Compass, Check, ArrowRight } from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';

interface DesktopQuickFinderProps {
  bikes: EBikeGrouped[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedPriceRange: string;
  onSelectPriceRange: (range: string) => void;
  onScrollToCatalog: () => void;
}

export default function DesktopQuickFinder({
  bikes,
  selectedCategory,
  onSelectCategory,
  selectedPriceRange,
  onSelectPriceRange,
  onScrollToCatalog,
}: DesktopQuickFinderProps) {
  const useCases = [
    { id: 'all', label: 'Todos os Usos', icon: '⚡' },
    { id: 'Urbana', label: 'Urbano & Trabalho', icon: '💼' },
    { id: 'Dobrável', label: 'Dobrável & Metrô', icon: '🚇' },
    { id: 'Trilha/MTB', label: 'Subidas Fortes & MTB', icon: '⛰️' },
    { id: 'Carga', label: 'Carga & Entregas', icon: '📦' },
  ];

  const priceRanges = [
    { id: 'all', label: 'Qualquer Preço' },
    { id: 'ate-4k', label: 'Até R$ 4.000' },
    { id: '4k-7k', label: 'R$ 4.000 a R$ 7.000' },
    { id: 'acima-7k', label: 'Acima de R$ 7.000' },
  ];

  // Cálculo de modelos correspondentes aos critérios
  const matchCount = React.useMemo(() => {
    let list = bikes;
    if (selectedCategory !== 'all') {
      list = list.filter((b) => b.usoPrincipal === selectedCategory);
    }
    if (selectedPriceRange === 'ate-4k') {
      list = list.filter((b) => b.menorPreco <= 4000);
    } else if (selectedPriceRange === '4k-7k') {
      list = list.filter((b) => b.menorPreco > 4000 && b.menorPreco <= 7000);
    } else if (selectedPriceRange === 'acima-7k') {
      list = list.filter((b) => b.menorPreco > 7000);
    }
    return list.length;
  }, [bikes, selectedCategory, selectedPriceRange]);

  return (
    <div className="w-full bg-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-ink/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-ink flex items-center justify-center">
            <Compass className="w-4 h-4 text-ink" />
          </div>
          <span className="text-xs font-mono font-black text-ink uppercase tracking-wider">
            Encontre sua E-Bike Ideal em 3 Segundos
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-ink/70">
            {matchCount} {matchCount === 1 ? 'modelo encontrado' : 'modelos encontrados'}
          </span>
          <button
            type="button"
            onClick={onScrollToCatalog}
            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-ink border-2 border-ink rounded-xl text-xs font-mono font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
          >
            <span>Ver Resultados</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* LINHAS DE FILTRO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        {/* Linha 1: Escolha seu Uso Principal */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/60">
            1. Perfil de Uso
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {useCases.map((uc) => {
              const isSelected = selectedCategory === uc.id;
              return (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => onSelectCategory(uc.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-ink text-white border-ink shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-ink/80 border-ink/20'
                  }`}
                >
                  <span>{uc.icon}</span>
                  <span>{uc.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha 2: Faixa de Orçamento */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/60">
            2. Faixa de Orçamento
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {priceRanges.map((pr) => {
              const isSelected = selectedPriceRange === pr.id;
              return (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => onSelectPriceRange(pr.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-amber-400 text-ink border-ink font-black shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-ink/80 border-ink/20'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{pr.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
