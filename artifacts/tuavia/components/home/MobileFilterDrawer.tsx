'use client';

import React from 'react';
import { X, SlidersHorizontal, Check, RotateCcw } from 'lucide-react';
import { EBikeCategory } from '@/types/ebike';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedMinPower: number;
  onSelectMinPower: (w: number) => void;
  selectedMinAutonomy: number;
  onSelectMinAutonomy: (km: number) => void;
  maxPrice: number;
  onSelectMaxPrice: (price: number) => void;
  totalFilteredCount: number;
  onResetFilters: () => void;
  formatBrl: (val: number) => string;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  selectedCategory,
  onSelectCategory,
  selectedMinPower,
  onSelectMinPower,
  selectedMinAutonomy,
  onSelectMinAutonomy,
  maxPrice,
  onSelectMaxPrice,
  totalFilteredCount,
  onResetFilters,
  formatBrl
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;

  const categories: { label: string; value: string }[] = [
    { label: 'Todas as Categorias', value: 'Todos' },
    { label: 'Urbana', value: 'Urbana' },
    { label: 'Trilha / MTB', value: 'Trilha/MTB' },
    { label: 'Dobrável', value: 'Dobrável' },
    { label: 'Cargo', value: 'Cargo' },
    { label: 'Speed', value: 'Speed' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-white border-2 border-ink rounded-3xl shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col max-h-[82vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header do Drawer */}
        <div className="p-4 bg-amber-50/90 border-b-2 border-ink flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-accent-gold border border-ink flex items-center justify-center shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-ink" />
            </div>
            <div>
              <h3 className="font-display font-black text-sm text-ink leading-none">
                Filtros do Catálogo
              </h3>
              <span className="text-[10px] font-mono text-ink/70">
                {totalFilteredCount} e-bikes encontradas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[10px] font-mono text-ink/70 hover:text-ink flex items-center gap-1 underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-xl bg-white border border-ink flex items-center justify-center text-ink hover:bg-neutral-100 cursor-pointer"
              aria-label="Fechar filtros"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo com Opções de Filtro */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          
          {/* 1. Categorias */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono font-bold text-ink uppercase tracking-wider">
              Categoria / Tipo de Uso
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => onSelectCategory(cat.value)}
                  className={`p-2 rounded-xl border text-[11px] font-mono font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                    selectedCategory === cat.value
                      ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                      : 'bg-neutral-50 text-ink/70 border-ink/20 hover:bg-neutral-100'
                  }`}
                >
                  <span className="truncate">{cat.label}</span>
                  {selectedCategory === cat.value && <Check className="w-3.5 h-3.5 text-ink shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Potência Mínima */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono font-bold text-ink uppercase tracking-wider">
              Potência Mínima do Motor
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Todas', w: 0 },
                { label: '250W+', w: 250 },
                { label: '350W+', w: 350 },
                { label: '500W+', w: 500 },
              ].map((item) => (
                <button
                  key={item.w}
                  type="button"
                  onClick={() => onSelectMinPower(item.w)}
                  className={`p-2 rounded-xl border text-[10px] font-mono font-bold text-center transition-all cursor-pointer ${
                    selectedMinPower === item.w
                      ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                      : 'bg-neutral-50 text-ink/70 border-ink/20 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Autonomia Mínima */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono font-bold text-ink uppercase tracking-wider">
              Autonomia Mínima da Bateria
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Todas', km: 0 },
                { label: '30 km+', km: 30 },
                { label: '45 km+', km: 45 },
                { label: '60 km+', km: 60 },
              ].map((item) => (
                <button
                  key={item.km}
                  type="button"
                  onClick={() => onSelectMinAutonomy(item.km)}
                  className={`p-2 rounded-xl border text-[10px] font-mono font-bold text-center transition-all cursor-pointer ${
                    selectedMinAutonomy === item.km
                      ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                      : 'bg-neutral-50 text-ink/70 border-ink/20 hover:bg-neutral-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Preço Máximo */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono font-bold text-ink uppercase tracking-wider">
                Preço Máximo
              </label>
              <span className="text-xs font-mono font-black text-primary">
                {maxPrice >= 20000 ? 'Sem limite' : `Até ${formatBrl(maxPrice)}`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Até R$ 5k', val: 5000 },
                { label: 'Até R$ 8k', val: 8000 },
                { label: 'Todos os Preços', val: 99999 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => onSelectMaxPrice(p.val)}
                  className={`p-2 rounded-xl border text-[10px] font-mono font-bold text-center transition-all cursor-pointer ${
                    maxPrice === p.val
                      ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                      : 'bg-neutral-50 text-ink/70 border-ink/20 hover:bg-neutral-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Botão de Aplicação Fixo na Base do Drawer */}
        <div className="p-3 bg-neutral-50 border-t border-ink/20">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-xs py-2.5 px-4 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Ver {totalFilteredCount} E-Bikes Filtradas</span>
          </button>
        </div>

      </div>
    </div>
  );
}
