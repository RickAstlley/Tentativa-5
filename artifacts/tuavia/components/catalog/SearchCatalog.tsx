'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  Filter, 
  ArrowUpDown, 
  RefreshCw, 
  SearchX, 
  RotateCcw, 
  SlidersHorizontal,
  Layers,
  Bike,
  ChevronDown
} from 'lucide-react';
import { getGroupedEBikes, fetchEBikesFromFirestore } from '@/lib/ebikes';
import { EBikeGrouped, EBikeCategory } from '@/types/ebike';

import EBikeCard from '../EBikeCard';
import EBikeCompactCard from './EBikeCompactCard';
import EBikeTableRow from './EBikeTableRow';
import GridDensitySwitcher, { GridDensityMode } from './GridDensitySwitcher';
import CatalogFilters from './CatalogFilters';
import CompareTray from './CompareTray';
import CategorySignBadge from '../traffic/CategorySignBadge';
import { TrafficLight, StopBikeSign } from '../traffic/TrafficDecorations';

interface SearchCatalogProps {
  initialBikes?: EBikeGrouped[];
}

export default function SearchCatalog({ initialBikes }: SearchCatalogProps) {
  const [allBikes, setAllBikes] = useState<EBikeGrouped[]>(() => {
    if (initialBikes && initialBikes.length > 0) return initialBikes;
    return getGroupedEBikes(true);
  });

  useEffect(() => {
    if (initialBikes && initialBikes.length > 0) {
      setAllBikes(initialBikes);
    }
  }, [initialBikes]);

  useEffect(() => {
    let isMounted = true;
    fetchEBikesFromFirestore().then((bikes) => {
      if (isMounted && Array.isArray(bikes) && bikes.length > 0) {
        setAllBikes(bikes);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Estados dos filtros lidos da URL
  const queryFromUrl = searchParams?.get('q') || '';
  const categoryFromUrl = (searchParams?.get('uso') || searchParams?.get('categoria') || 'Todos') as EBikeCategory | 'Todos';
  const brandFromUrl = searchParams?.get('marca') || 'Todos';
  const priceFromUrl = searchParams?.get('precoMax') ? Number(searchParams?.get('precoMax')) : 25000;
  const autonomyFromUrl = searchParams?.get('autonomiaMin') ? Number(searchParams?.get('autonomiaMin')) : 0;
  const powerFromUrl = searchParams?.get('potencia') ? (searchParams?.get('potencia') === 'Todos' ? 'Todos' : Number(searchParams?.get('potencia'))) : 'Todos';
  const availabilityFromUrl = searchParams?.get('estoque') || 'Todos';
  const sortFromUrl = (searchParams?.get('ordenar') as 'recente' | 'menorPreco' | 'maiorPreco' | 'autonomia' | 'potencia') || 'recente';

  // Input local de busca com sincronização em render-time
  const [searchInput, setSearchInput] = useState(queryFromUrl);
  const [prevQueryFromUrl, setPrevQueryFromUrl] = useState(queryFromUrl);

  if (queryFromUrl !== prevQueryFromUrl) {
    setPrevQueryFromUrl(queryFromUrl);
    setSearchInput(queryFromUrl);
  }

  // Controle dos Filtros (Drawer Mobile e Dropdown/Gaveta Desktop)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isDesktopFiltersOpen, setIsDesktopFiltersOpen] = useState(false);
  const abrirFiltrosParam = searchParams?.get('abrirFiltros') === '1';
  const [prevAbrirFiltros, setPrevAbrirFiltros] = useState(abrirFiltrosParam);

  if (abrirFiltrosParam && !prevAbrirFiltros) {
    setPrevAbrirFiltros(true);
    setIsMobileFiltersOpen(true);
  }

  // Estado do Comparador
  const [comparedSlugs, setComparedSlugs] = useState<string[]>([]);
  const [compareMessage, setCompareMessage] = useState<string | null>(null);
  const [densityMode, setDensityMode] = useState<GridDensityMode>('editorial');

  // No mobile (< 768px), define a exibição padrão inicial como 'compact'
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setDensityMode('compact');
    }
  }, []);

  // Event listener customizado para abrir filtros via bottom nav
  useEffect(() => {
    const handleOpenFilters = () => setIsMobileFiltersOpen(true);
    window.addEventListener('open-mobile-filters', handleOpenFilters);
    return () => window.removeEventListener('open-mobile-filters', handleOpenFilters);
  }, []);

  // Timer do aviso do comparador
  useEffect(() => {
    if (compareMessage) {
      const timer = setTimeout(() => setCompareMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [compareMessage]);

  // Rastreia buscas realizadas em /pesquisa no GA4
  useEffect(() => {
    if (queryFromUrl.trim()) {
      window.gtag?.('event', 'busca_realizada', {
        termo_busca: queryFromUrl.trim(),
        categoria: categoryFromUrl,
      });
    }
  }, [queryFromUrl, categoryFromUrl]);

  // Helper para atualizar parâmetros na URL
  const updateUrlParams = useCallback((updates: Record<string, string | number | null | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    
    // Remove o parâmetro temporário de abrir drawer
    params.delete('abrirFiltros');

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'Todos' || (key === 'precoMax' && Number(value) === 25000) || (key === 'autonomiaMin' && Number(value) === 0) || (key === 'ordenar' && value === 'menorPreco')) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();
    const newPath = queryString ? `/ebike?${queryString}` : '/ebike';
    router.replace(newPath, { scroll: false });
  }, [searchParams, router]);

  // Handlers para cada filtro
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ q: searchInput.trim() });
  };

  const handleCategoryChange = (cat: EBikeCategory | 'Todos') => {
    updateUrlParams({ uso: cat, categoria: null });
  };

  const handleBrandChange = (brand: string) => {
    updateUrlParams({ marca: brand });
  };

  const handlePriceChange = (price: number) => {
    updateUrlParams({ precoMax: price });
  };

  const handleAutonomyChange = (autonomy: number) => {
    updateUrlParams({ autonomiaMin: autonomy });
  };

  const handlePowerChange = (power: number | 'Todos') => {
    updateUrlParams({ potencia: power });
  };

  const handleAvailabilityChange = (status: string) => {
    updateUrlParams({ estoque: status });
  };

  const handleSortChange = (sort: 'recente' | 'menorPreco' | 'maiorPreco' | 'autonomia' | 'potencia') => {
    updateUrlParams({ ordenar: sort });
  };

  const handleClearAllFilters = () => {
    setSearchInput('');
    router.replace('/ebike', { scroll: false });
  };

  // Verifica se há qualquer filtro ativo diferente do padrão
  const hasActiveFilters = Boolean(
    queryFromUrl ||
    categoryFromUrl !== 'Todos' ||
    brandFromUrl !== 'Todos' ||
    priceFromUrl < 25000 ||
    autonomyFromUrl > 0 ||
    powerFromUrl !== 'Todos' ||
    availabilityFromUrl !== 'Todos'
  );

  // Opções dinâmicas e estáticas
  const categories: (EBikeCategory | 'Todos')[] = ['Todos', 'Urbana', 'Trilha/MTB', 'Dobrável', 'Cargo', 'Speed'];
  
  const brands = useMemo(() => {
    const brandSet = new Set<string>();
    allBikes.forEach((b) => {
      if (b.marca && b.marca.trim()) brandSet.add(b.marca.trim());
    });
    ['Panda', 'Honeywhale', 'Smartfy', 'Yoo Mobility', 'Two Dogs', 'Xplore', 'Caloi', 'Sense', 'Oggi', 'Lev'].forEach((m) => brandSet.add(m));
    return ['Todos', ...Array.from(brandSet).sort()];
  }, [allBikes]);

  const powers: (number | 'Todos')[] = useMemo(() => {
    const powerSet = new Set<number>();
    allBikes.forEach((b) => {
      if (b.potenciaW) powerSet.add(b.potenciaW);
    });
    [250, 350, 500, 750].forEach((p) => powerSet.add(p));
    return ['Todos', ...Array.from(powerSet).sort((a, b) => a - b)];
  }, [allBikes]);

  const autonomies = [
    { label: 'Qualquer autonomia', value: 0 },
    { label: 'Mais de 30 km', value: 30 },
    { label: 'Mais de 45 km', value: 45 },
    { label: 'Mais de 60 km', value: 60 },
    { label: 'Mais de 75 km', value: 75 },
  ];

  // Alterna e-bike no Comparador
  const handleCompareToggle = (slug: string) => {
    setComparedSlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 3) {
        setCompareMessage('Você pode comparar no máximo 3 e-bikes simultaneamente.');
        return prev;
      }
      return [...prev, slug];
    });
  };

  const handleRemoveFromCompare = (slug: string) => {
    setComparedSlugs((prev) => prev.filter((s) => s !== slug));
  };

  const comparedBikes = useMemo(() => {
    return allBikes.filter((b) => comparedSlugs.includes(b.slug));
  }, [allBikes, comparedSlugs]);

  // Filtragem e Ordenação Segura
  const filteredBikes = useMemo(() => {
    return allBikes
      .filter((bike) => {
        if (!bike || !bike.slug) return false;

        const modeloStr = (bike.modelo || '').toLowerCase();
        const marcaStr = (bike.marca || '').toLowerCase();
        const searchQ = (queryFromUrl || '').toLowerCase().trim();

        const matchesSearch = 
          !searchQ ||
          modeloStr.includes(searchQ) ||
          marcaStr.includes(searchQ);
        
        const matchesCategory = 
          categoryFromUrl === 'Todos' || bike.usoPrincipal === categoryFromUrl;

        const matchesBrand =
          brandFromUrl === 'Todos' || (bike.marca || '').toLowerCase() === (brandFromUrl || '').toLowerCase();

        const menorPreco = typeof bike.menorPreco === 'number' ? bike.menorPreco : 0;
        const matchesPrice = menorPreco <= priceFromUrl;

        const autonomia = typeof bike.autonomiaKm === 'number' ? bike.autonomiaKm : 0;
        const matchesAutonomy = autonomia >= autonomyFromUrl;

        const potencia = typeof bike.potenciaW === 'number' ? bike.potenciaW : 0;
        const matchesPower =
          powerFromUrl === 'Todos' || potencia === powerFromUrl;

        const ofertasList = Array.isArray(bike.ofertas) ? bike.ofertas : [];
        const matchesAvailability =
          availabilityFromUrl === 'Todos' ||
          ofertasList.some((offer) => offer?.disponibilidade === availabilityFromUrl);

        return (
          matchesSearch &&
          matchesCategory &&
          matchesBrand &&
          matchesPrice &&
          matchesAutonomy &&
          matchesPower &&
          matchesAvailability
        );
      })
      .sort((a, b) => {
        const menorPrecoA = typeof a?.menorPreco === 'number' ? a.menorPreco : 0;
        const menorPrecoB = typeof b?.menorPreco === 'number' ? b.menorPreco : 0;
        const autonomiaA = typeof a?.autonomiaKm === 'number' ? a.autonomiaKm : 0;
        const autonomiaB = typeof b?.autonomiaKm === 'number' ? b.autonomiaKm : 0;
        const potenciaA = typeof a?.potenciaW === 'number' ? a.potenciaW : 0;
        const potenciaB = typeof b?.potenciaW === 'number' ? b.potenciaW : 0;

        if (sortFromUrl === 'recente') {
          const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
          const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
          return timeB - timeA;
        }
        if (sortFromUrl === 'menorPreco') {
          return menorPrecoA - menorPrecoB;
        }
        if (sortFromUrl === 'maiorPreco') {
          return menorPrecoB - menorPrecoA;
        }
        if (sortFromUrl === 'autonomia') {
          return autonomiaB - autonomiaA;
        }
        if (sortFromUrl === 'potencia') {
          return potenciaB - potenciaA;
        }
        return 0;
      });
  }, [
    allBikes,
    queryFromUrl,
    categoryFromUrl,
    brandFromUrl,
    priceFromUrl,
    autonomyFromUrl,
    powerFromUrl,
    availabilityFromUrl,
    sortFromUrl,
  ]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  const totalCount = filteredBikes.length;

  return (
    <div className="w-full flex flex-col gap-5 p-3 sm:p-5 md:p-6 max-w-5xl xl:max-w-6xl mx-auto" id="search-catalog-page">
      
      {/* BARRA DE PESQUISA EXCLUSIVA MOBILE - STICKY AO ROLAR (Oculta no Desktop onde já existe a barra inteligente da sidebar) */}
      <div className="block md:hidden sticky top-2 z-30 bg-surface/95 backdrop-blur-md border-2 border-ink rounded-2xl p-2.5 sm:p-3 shadow-[4px_4px_0_0_rgba(46,43,39,1)] transition-all">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/50" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar modelo, marca ou motor..."
              className="w-full bg-white border-2 border-ink rounded-xl pl-10 pr-9 py-2 text-xs font-mono font-bold text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              aria-label="Buscar bicicleta elétrica"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateUrlParams({ q: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/60 hover:text-ink cursor-pointer"
                aria-label="Limpar termo de busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="bg-primary text-white font-mono font-bold text-xs px-3.5 py-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0 cursor-pointer min-h-[38px]"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* 1. BARRA SUPERIOR DE CONTROLES & ORDENAÇÃO */}
      <div className="bg-surface border-2 border-ink rounded-2xl p-3 sm:p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Contagem e Status de Busca da Sidebar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-black bg-ink text-white px-2.5 py-1 rounded-lg border border-ink shadow-2xs">
            {totalCount} {totalCount === 1 ? 'E-Bike' : 'E-Bikes'}
          </span>

          {searchInput ? (
            <div className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-400 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-emerald-950">
              <Search className="w-3.5 h-3.5 text-emerald-800" />
              <span>&ldquo;{searchInput}&rdquo;</span>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateUrlParams({ q: null });
                }}
                className="ml-1 p-0.5 hover:bg-emerald-200 rounded text-emerald-900 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span className="text-xs font-mono text-ink/70 font-semibold">
              Catálogo Completo Auditado
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
          {/* Botão de Filtros Mobile */}
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(true)}
            className="md:hidden flex-1 sm:flex-initial bg-primary text-white font-mono font-bold text-xs px-3.5 py-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-2 cursor-pointer min-h-[40px] focus-visible:outline-none"
            aria-label="Abrir filtros de busca no mobile"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent-charge" />
            <span>Filtros {hasActiveFilters && '• Ativos'}</span>
          </button>

          {/* Botão de Filtros Desktop (Dropdown / Expansão Elegante) */}
          <button
            type="button"
            onClick={() => setIsDesktopFiltersOpen(!isDesktopFiltersOpen)}
            className={`hidden md:flex items-center gap-2 font-mono font-bold text-xs px-4 py-2 rounded-xl border-2 border-ink transition-all duration-200 cursor-pointer min-h-[40px] focus-visible:outline-none ${
              isDesktopFiltersOpen
                ? 'bg-primary text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] translate-x-[1px] translate-y-[1px]'
                : 'bg-white hover:bg-bg-base text-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
            }`}
            aria-label="Alternar painel de filtros avançados"
            aria-expanded={isDesktopFiltersOpen}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${isDesktopFiltersOpen ? 'text-accent-charge' : 'text-primary'}`} />
            <span>Filtros Avançados</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-accent-charge animate-pulse" />
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDesktopFiltersOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Selector de Ordenação */}
          <div className="flex items-center gap-1.5 bg-bg-base border-2 border-ink px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-ink shrink-0 min-h-[40px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-primary shrink-0" />
            <select
              value={sortFromUrl}
              onChange={(e: any) => handleSortChange(e.target.value as any)}
              className="bg-transparent text-xs font-mono font-bold text-ink focus:outline-none cursor-pointer pr-1"
              aria-label="Ordenar resultados de busca por"
            >
              <option value="recente">Mais Recentes</option>
              <option value="menorPreco">Menor Preço</option>
              <option value="maiorPreco">Maior Preço</option>
              <option value="autonomia">Maior Autonomia</option>
              <option value="potencia">Maior Potência</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. PAINEL EXPANSÍVEL DE FILTROS DESKTOP */}
      {isDesktopFiltersOpen && (
        <div className="hidden md:block bg-surface border-2 border-ink rounded-2xl p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-line pb-3 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <span className="font-display font-bold text-base text-ink">Filtros Refinados</span>
            </div>
            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-mono font-bold text-accent-gold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar Todos</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDesktopFiltersOpen(false)}
                className="p-1.5 rounded-lg border border-line hover:bg-bg-base cursor-pointer flex items-center justify-center text-ink"
                title="Fechar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <CatalogFilters
            maxPrice={priceFromUrl}
            setMaxPrice={handlePriceChange}
            selectedBrand={brandFromUrl}
            setSelectedBrand={handleBrandChange}
            brands={brands}
            minAutonomy={autonomyFromUrl}
            setMinAutonomy={handleAutonomyChange}
            autonomies={autonomies}
            selectedPower={powerFromUrl}
            setSelectedPower={handlePowerChange}
            powers={powers}
            selectedAvailability={availabilityFromUrl}
            setSelectedAvailability={handleAvailabilityChange}
            hasActiveFilters={hasActiveFilters}
            clearFilters={handleClearAllFilters}
          />
        </div>
      )}

      {/* 3. BARRA DE CATEGORIAS RÁPIDAS (CHIPS COM FORMATO DE PLACA) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-none w-full shrink-0">
        <span className="bg-surface border-2 border-ink px-2.5 py-1 rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] font-mono text-[10px] font-black text-ink uppercase tracking-wider shrink-0 flex items-center gap-1">
          Uso:
        </span>
        {categories.map((cat) => {
          const isActive = categoryFromUrl === cat;
          return (
            <CategorySignBadge
              key={cat}
              category={cat}
              active={isActive}
              onClick={() => handleCategoryChange(cat)}
              className="shrink-0"
            />
          );
        })}
      </div>

      {/* 4. RESUMO DOS FILTROS ATIVOS (SE HOUVER) */}
      {hasActiveFilters && (
        <div className="bg-white border border-line p-3 sm:p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-ink/60 uppercase tracking-wider">Filtros Ativos:</span>
            
            {queryFromUrl && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Busca: &quot;{queryFromUrl}&quot;
                <button type="button" onClick={() => updateUrlParams({ q: null })} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {categoryFromUrl !== 'Todos' && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Uso: {categoryFromUrl}
                <button type="button" onClick={() => handleCategoryChange('Todos')} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {brandFromUrl !== 'Todos' && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Marca: {brandFromUrl}
                <button type="button" onClick={() => handleBrandChange('Todos')} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {priceFromUrl < 25000 && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Até {formatCurrency(priceFromUrl)}
                <button type="button" onClick={() => handlePriceChange(25000)} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {autonomyFromUrl > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Autonomia {autonomyFromUrl}+ km
                <button type="button" onClick={() => handleAutonomyChange(0)} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {powerFromUrl !== 'Todos' && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                Potência {powerFromUrl}W
                <button type="button" onClick={() => handlePowerChange('Todos')} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}

            {availabilityFromUrl !== 'Todos' && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-ink text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                {availabilityFromUrl}
                <button type="button" onClick={() => handleAvailabilityChange('Todos')} className="hover:text-primary cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClearAllFilters}
            className="text-xs font-mono font-bold text-accent-gold hover:underline flex items-center gap-1 cursor-pointer min-h-[44px] px-2 rounded-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar Todos</span>
          </button>
        </div>
      )}

      {/* Mensagem do Comparador */}
      {compareMessage && (
        <div className="bg-accent-gold text-ink font-mono text-xs font-bold p-3 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] animate-in fade-in">
          ⚠️ {compareMessage}
        </div>
      )}

      {/* 5. LAYOUT PRINCIPAL FULL-WIDTH: GRID DE RESULTADOS */}
      <div className="w-full">
        <main className="w-full flex flex-col gap-6">
          
          <div className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h1 className="font-display font-black text-xl sm:text-2xl text-ink tracking-tight flex items-center gap-2">
              <span>Catálogo de E-Bikes</span>
              <span className="text-xs font-mono font-bold bg-primary text-white border border-ink px-2.5 py-0.5 rounded-xl">
                {filteredBikes.length} {filteredBikes.length === 1 ? 'modelo' : 'modelos'}
              </span>
            </h1>

            {filteredBikes.length > 0 && (
              <GridDensitySwitcher
                mode={densityMode}
                onChange={setDensityMode}
              />
            )}
          </div>

          {/* ESTADO VAZIO COM TROCADILHO DE SINALIZAÇÃO / RUA SEM SAÍDA */}
          {filteredBikes.length === 0 ? (
            <div className="bg-white border-2 border-ink rounded-3xl p-6 sm:p-10 text-center flex flex-col items-center gap-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] my-6 relative overflow-hidden">
              {/* Aviso de Rua Sem Saída / Nenhum Resultado */}
              <div className="flex items-center gap-2 bg-amber-400 text-ink border-2 border-ink px-4 py-2 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-mono font-black text-xs sm:text-sm uppercase tracking-wider">
                <span>⚠️ RUA SEM SAÍDA • DESVIO DETECTADO</span>
              </div>

              <div className="flex flex-col gap-2 max-w-md">
                <h3 className="font-display font-black text-xl sm:text-2xl text-ink">
                  Nenhuma e-bike nesta rota
                </h3>
                <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
                  Não encontramos nenhum modelo que satisfaça todos os filtros ativos simultaneamente. Tente aumentar o teto de orçamento, liberar as marcas ou desobstruir os filtros.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-1 bg-amber-400 hover:bg-amber-500 text-ink font-mono font-black text-xs sm:text-sm py-3.5 px-6 rounded-2xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center gap-2 cursor-pointer min-h-[44px] uppercase tracking-wide"
              >
                <RotateCcw className="w-4 h-4 text-ink shrink-0" />
                <span>Limpar Desvios & Resetar Filtros</span>
              </button>
            </div>
          ) : (
            <>
              {densityMode === 'editorial' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredBikes.map((bike, idx) => (
                    <EBikeCard
                      key={`search-editorial-${bike.slug}-${idx}`}
                      bike={bike}
                      priority={false}
                      isCompared={comparedSlugs.includes(bike.slug)}
                      onCompareToggle={() => handleCompareToggle(bike.slug)}
                    />
                  ))}
                </div>
              )}

              {densityMode === 'compact' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {filteredBikes.map((bike, idx) => (
                    <EBikeCompactCard
                      key={`search-compact-${bike.slug}-${idx}`}
                      bike={bike}
                      priority={false}
                      isCompared={comparedSlugs.includes(bike.slug)}
                      onCompareToggle={() => handleCompareToggle(bike.slug)}
                    />
                  ))}
                </div>
              )}

              {densityMode === 'table' && (
                <div className="flex flex-col gap-2.5">
                  {filteredBikes.map((bike, idx) => (
                    <EBikeTableRow
                      key={`search-table-${bike.slug}-${idx}`}
                      bike={bike}
                      isCompared={comparedSlugs.includes(bike.slug)}
                      onCompareToggle={() => handleCompareToggle(bike.slug)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* DRAWER DE FILTROS MOBILE */}
      {isMobileFiltersOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in" 
          id="mobile-filter-drawer"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-surface h-full flex flex-col overflow-y-auto p-6 shadow-2xl relative animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <span className="font-display font-bold text-lg text-ink">Filtros do Catálogo</span>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="p-2 rounded-full border border-line hover:bg-bg-base cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Fechar gaveta de filtros"
              >
                <X className="w-5 h-5 text-ink" />
              </button>
            </div>

            <CatalogFilters
              maxPrice={priceFromUrl}
              setMaxPrice={handlePriceChange}
              selectedBrand={brandFromUrl}
              setSelectedBrand={handleBrandChange}
              brands={brands}
              minAutonomy={autonomyFromUrl}
              setMinAutonomy={handleAutonomyChange}
              autonomies={autonomies}
              selectedPower={powerFromUrl}
              setSelectedPower={handlePowerChange}
              powers={powers}
              selectedAvailability={availabilityFromUrl}
              setSelectedAvailability={handleAvailabilityChange}
              hasActiveFilters={hasActiveFilters}
              clearFilters={handleClearAllFilters}
            />

            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(false)}
              className="mt-6 w-full bg-primary text-white font-mono font-bold text-xs py-3.5 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] cursor-pointer min-h-[44px]"
            >
              Ver {filteredBikes.length} {filteredBikes.length === 1 ? 'Resultado' : 'Resultados'}
            </button>
          </div>
        </div>
      )}

      {/* COMPARADOR EM BANNER FLUTUANTE */}
      <CompareTray
        comparedSlugs={comparedSlugs}
        comparedBikes={comparedBikes}
        handleRemoveFromCompare={handleRemoveFromCompare}
        clearCompare={() => setComparedSlugs([])}
      />

    </div>
  );
}
