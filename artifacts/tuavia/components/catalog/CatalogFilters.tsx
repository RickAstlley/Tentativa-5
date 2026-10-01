'use client';

import React from 'react';
import { Filter, Check, Gauge, Zap } from 'lucide-react';

interface CatalogFiltersProps {
  maxPrice: number;
  setMaxPrice: (price: number) => void;
  selectedBrand: string;
  setSelectedBrand: (brand: string) => void;
  brands: string[];
  minAutonomy: number;
  setMinAutonomy: (autonomy: number) => void;
  autonomies: { label: string; value: number }[];
  selectedPower: number | 'Todos';
  setSelectedPower: (power: number | 'Todos') => void;
  powers: (number | 'Todos')[];
  selectedAvailability: string;
  setSelectedAvailability: (availability: string) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

export default function CatalogFilters({
  maxPrice,
  setMaxPrice,
  selectedBrand,
  setSelectedBrand,
  brands,
  minAutonomy,
  setMinAutonomy,
  autonomies,
  selectedPower,
  setSelectedPower,
  powers,
  selectedAvailability,
  setSelectedAvailability,
  hasActiveFilters,
  clearFilters,
}: CatalogFiltersProps) {
  
  // Formatador de moedas brasileiro
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="flex flex-col gap-6" id="catalog-filter-panel-inner">
      {/* Título do Painel de Filtros */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h3 className="font-display font-bold text-base text-ink flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filtros Avançados
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-mono font-bold text-accent-gold hover:underline flex items-center gap-0.5 cursor-pointer min-h-[44px] px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Limpar todos os filtros selecionados"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Filtro: Faixa de Preço */}
      <div className="flex flex-col gap-2">
        <label htmlFor="price-range-slider" className="text-[11px] font-mono font-bold text-ink/80 uppercase tracking-wider flex justify-between">
          <span>Preço Máximo:</span>
          <span className="text-primary font-bold">{formatCurrency(maxPrice)}</span>
        </label>
        <input
          id="price-range-slider"
          type="range"
          min={4000}
          max={25000}
          step={500}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full h-2.5 bg-line rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Ajustar preço máximo de e-bike"
        />
        <div className="flex justify-between text-[10px] font-mono text-ink/70">
          <span>{formatCurrency(4000)}</span>
          <span>{formatCurrency(25000)}</span>
        </div>
      </div>

      {/* Filtro: Marca */}
      <div className="flex flex-col gap-3 pt-2 border-t border-line/40">
        <span className="text-[10px] font-mono font-bold text-ink/70 uppercase tracking-widest">
          Marca do Fabricante
        </span>
        <div className="flex flex-col gap-1.5">
          {brands.map((brand) => {
            const isSelected = selectedBrand === brand;
            return (
              <button
                type="button"
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`min-h-[44px] flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl transition-all duration-200 border-2 border-ink text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] translate-x-[2px] translate-y-[2px] font-bold'
                    : 'bg-white text-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] font-medium'
                }`}
                aria-label={`Filtrar por marca ${brand === 'Todos' ? 'Todas' : brand}`}
                aria-pressed={isSelected}
              >
                <span>{brand === 'Todos' ? 'Todas as marcas' : brand}</span>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro: Autonomia Mínima */}
      <div className="flex flex-col gap-3 pt-4 border-t border-line/40">
        <span className="text-[10px] font-mono font-bold text-ink/70 uppercase tracking-widest flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-primary" />
          <span>Autonomia por Carga</span>
        </span>
        <div className="flex flex-col gap-1.5">
          {autonomies.map((auto) => {
            const isSelected = minAutonomy === auto.value;
            return (
              <button
                type="button"
                key={auto.value}
                onClick={() => setMinAutonomy(auto.value)}
                className={`min-h-[44px] flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl transition-all duration-200 border-2 border-ink text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] translate-x-[2px] translate-y-[2px] font-bold'
                    : 'bg-white text-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] font-medium'
                }`}
                aria-label={`Filtrar por autonomia ${auto.label}`}
                aria-pressed={isSelected}
              >
                <span>{auto.label}</span>
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro: Potência */}
      <div className="flex flex-col gap-3 pt-4 border-t border-line/40">
        <span className="text-[10px] font-mono font-bold text-ink/70 uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span>Potência do Motor</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {powers.map((p) => {
            const isSelected = selectedPower === p;
            return (
              <button
                type="button"
                key={p}
                onClick={() => setSelectedPower(p)}
                className={`min-h-[44px] flex-1 text-center text-xs px-3 py-2 rounded-xl border-2 border-ink font-mono transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] translate-x-[2px] translate-y-[2px] font-bold'
                    : 'bg-white text-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] font-medium'
                }`}
                aria-label={`Filtrar por potência ${p === 'Todos' ? 'Todas' : `${p}W`}`}
                aria-pressed={isSelected}
              >
                {p === 'Todos' ? 'Todas' : `${p}W`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtro: Disponibilidade */}
      <div className="flex flex-col gap-3 pt-4 border-t border-line/40">
        <span className="text-[10px] font-mono font-bold text-ink/70 uppercase tracking-widest">
          Status de Estoque
        </span>
        <div className="grid grid-cols-2 gap-2">
          {['Todos', 'Em estoque', 'Sob encomenda'].map((status) => {
            const isSelected = selectedAvailability === status;
            return (
              <button
                type="button"
                key={status}
                onClick={() => setSelectedAvailability(status)}
                className={`min-h-[44px] text-center text-xs px-3 py-2 rounded-xl border-2 border-ink transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isSelected
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] translate-x-[2px] translate-y-[2px] font-bold'
                    : 'bg-white text-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] font-medium'
                } ${status === 'Todos' ? 'col-span-2' : 'col-span-1'}`}
                aria-label={`Filtrar por disponibilidade ${status === 'Todos' ? 'Ver todos' : status}`}
                aria-pressed={isSelected}
              >
                {status === 'Todos' ? 'Ver todos' : status}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
