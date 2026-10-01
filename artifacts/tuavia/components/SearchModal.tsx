'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  ArrowUpDown, 
  Filter, 
  SlidersHorizontal, 
  Bike, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight 
} from 'lucide-react';
import { EBikeCategory } from '@/types/ebike';

export default function SearchModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Estados locais do formulário de busca rápida no modal
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EBikeCategory | 'Todos'>('Todos');
  const [priceSort, setPriceSort] = useState<'menorPreco' | 'maiorPreco'>('menorPreco');

  useEffect(() => {
    const handleOpenSearchModal = () => {
      if (window.location.pathname !== '/ebike' && window.location.pathname !== '/pesquisa') {
        router.push('/ebike');
      }
      setIsOpen(true);
    };

    window.addEventListener('open-search-modal', handleOpenSearchModal);
    return () => window.removeEventListener('open-search-modal', handleOpenSearchModal);
  }, [router]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('q', searchTerm.trim());
    }
    if (selectedCategory !== 'Todos') {
      params.set('uso', selectedCategory);
    }
    if (priceSort === 'maiorPreco') {
      params.set('ordenar', 'maiorPreco');
    } else {
      params.set('ordenar', 'menorPreco');
    }

    const queryString = params.toString();
    const destination = queryString ? `/ebike?${queryString}` : '/ebike';

    setIsOpen(false);
    router.push(destination);
  };

  if (!isOpen) return null;

  const categories: (EBikeCategory | 'Todos')[] = ['Todos', 'Urbana', 'Trilha/MTB', 'Dobrável', 'Cargo', 'Speed'];

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      id="search-popup-backdrop"
      onClick={handleClose}
    >
      <div 
        className="w-full sm:max-w-lg bg-surface border-t-2 sm:border-2 border-ink rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 pb-8 sm:pb-6 shadow-2xl relative animate-in slide-in-from-bottom duration-200 flex flex-col gap-3.5 sm:gap-5 max-h-[80dvh] sm:max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        id="search-popup-modal"
      >
        {/* Cabeçalho do Pop-Up */}
        <div className="flex items-center justify-between border-b-2 border-ink pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-ink leading-tight">Buscar e Filtrar</h2>
              <p className="text-[11px] font-mono font-medium text-ink/70">Encontre a e-bike perfeita para você</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl border-2 border-ink bg-bg-base hover:bg-neutral-200 text-ink cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Fechar busca"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário Principal de Pesquisa */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-5">
          
          {/* 1. BARRA DE BUSCA (INPUT) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="search-input-modal" className="text-xs font-mono font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-primary" />
              <span>O que você procura?</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="search-input-modal"
                type="text"
                placeholder="Ex: Caloi, Sense, Urbana, Dobrável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full bg-bg-base border-2 border-ink text-ink font-mono text-sm px-4 py-3.5 pr-10 rounded-xl focus:outline-none placeholder-ink/40 shadow-[2px_2px_0_0_rgba(46,43,39,1)] focus:ring-2 focus:ring-primary/40 min-h-[48px]"
                aria-label="Buscar e-bike por modelo ou marca"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 p-1 text-ink/50 hover:text-ink cursor-pointer rounded-md"
                  title="Limpar texto"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. ORDENAÇÃO POR PREÇO (PREÇO BAIXO OU MAIOR) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
              <span>Ordenar por Preço:</span>
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPriceSort('menorPreco')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-ink text-xs font-mono font-bold transition-all cursor-pointer min-h-[44px] ${
                  priceSort === 'menorPreco'
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                    : 'bg-bg-base text-ink hover:bg-neutral-100 shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-accent-charge shrink-0" />
                <span>Preço Menor</span>
              </button>

              <button
                type="button"
                onClick={() => setPriceSort('maiorPreco')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-ink text-xs font-mono font-bold transition-all cursor-pointer min-h-[44px] ${
                  priceSort === 'maiorPreco'
                    ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                    : 'bg-bg-base text-ink hover:bg-neutral-100 shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-accent-gold shrink-0" />
                <span>Preço Maior</span>
              </button>
            </div>
          </div>

          {/* 3. BOTÃO DO FILTRO DE CATEGORIA/USO */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>Filtrar por Categoria de Uso:</span>
            </span>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs font-mono font-bold px-3 py-2 rounded-xl border-2 border-ink transition-all cursor-pointer min-h-[40px] flex items-center justify-center ${
                      isActive
                        ? 'bg-ink text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                        : 'bg-bg-base text-ink hover:bg-neutral-100 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. BOTÃO COM A LUPA PARA CLICAR E PESQUISAR */}
          <button
            type="submit"
            className="mt-2 w-full bg-primary hover:bg-primary-dark text-white font-mono font-bold text-sm py-4 px-6 rounded-2xl border-2 border-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[52px]"
          >
            <Search className="w-5 h-5 text-accent-charge shrink-0" />
            <span>Buscar E-Bikes</span>
            <ArrowRight className="w-4 h-4 ml-auto text-white/80" />
          </button>

        </form>
      </div>
    </div>
  );
}
