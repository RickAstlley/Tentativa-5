import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Compass, 
  Trophy, 
  Calculator, 
  BookOpen, 
  ShoppingBag,
  SlidersHorizontal,
  Search,
  Zap,
  BatteryCharging,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { EBikeGrouped, EBikeCategory } from '@/types/ebike';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';
import { HomeAICurationData } from '@/types/homeCuration';

import dynamic from 'next/dynamic';

import ZoneDivider from './ZoneDivider';
import SectionErrorBoundary from '@/components/ui/SectionErrorBoundary';
import LegislationContranGrid from './LegislationContranGrid';
import ContranTrafficGuide from './ContranTrafficGuide';
import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import PopularUseCasesPills from './PopularUseCasesPills';
import EBikeCompactCard from '@/components/catalog/EBikeCompactCard';
import EBikeTableRow from '@/components/catalog/EBikeTableRow';
import GridDensitySwitcher, { GridDensityMode } from '@/components/catalog/GridDensitySwitcher';
import { Container } from '@/components/ui';

// Componentes dedicados para a experiência Desktop (Cockpit de Inteligência)
import DesktopTop3Podium from './DesktopTop3Podium';
import DesktopQuickFinder from './DesktopQuickFinder';
import DesktopCockpitSidebar from './DesktopCockpitSidebar';
import DesktopAuthorityBar from './DesktopAuthorityBar';

// Carregamento dinâmico otimizado (Code-splitting) para componentes abaixo da dobra
const PriceDropTicker = dynamic(() => import('./PriceDropTicker'), { ssr: true });
const HomeTopRankingsSection = dynamic(() => import('./HomeTopRankingsSection'), { ssr: true });
const MobileArticlesSection = dynamic(() => import('./MobileArticlesSection'), { ssr: true });
const MobileFilterDrawer = dynamic(() => import('./MobileFilterDrawer'), { ssr: false });

interface DesktopHomeProps {
  bikes: EBikeGrouped[];
  articles: Article[];
  rankings?: TopRanking[];
  curation?: HomeAICurationData;
  heroSearchInput: string;
  setHeroSearchInput: (val: string) => void;
  handleHeroSearchSubmit: (e: React.FormEvent) => void;
  formatBrl: (val: number) => string;
  comparedSlugs: string[];
  onCompareToggle: (slug: string) => void;
  featuredBikes: EBikeGrouped[];
  catalogStats: {
    count: number;
    storesCount: number;
    minPrice: number;
    maxPrice: number;
  };
  categoryArticles: Array<{
    category: EBikeCategory;
    title: string;
    subtitle: string;
    bikes: EBikeGrouped[];
    totalCount: number;
  }>;
  expandedCategories: Record<string, boolean>;
  toggleCategoryExpand: (cat: string) => void;
}

type SortOption = 'menorPreco' | 'maiorDesconto' | 'maiorPotencia' | 'maiorAutonomia';

export default function DesktopHome({
  bikes,
  articles,
  rankings = [],
  curation,
  formatBrl,
  comparedSlugs,
  onCompareToggle,
}: DesktopHomeProps) {
  const router = useRouter();

  // Estados de Busca, Filtros e Ordenação
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedMinPower, setSelectedMinPower] = useState<number>(0);
  const [selectedMinAutonomy, setSelectedMinAutonomy] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(99999);
  const [sortBy, setSortBy] = useState<SortOption>('menorPreco');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [densityMode, setDensityMode] = useState<GridDensityMode>('editorial');
  const [displayLimit, setDisplayLimit] = useState(15);

  const handlePriceRangeChange = (range: string) => {
    setSelectedPriceRange(range);
    if (range === 'ate-4k') {
      setMaxPrice(4000);
    } else if (range === '4k-7k') {
      setMaxPrice(7000);
    } else {
      setMaxPrice(99999);
    }
  };

  const handleScrollToCatalog = () => {
    const el = document.getElementById('zona-catalogo-completo');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Categorias disponíveis e suas contagens em tempo real
  const categoriesList = ['Todos', 'Urbana', 'Dobrável', 'Trilha/MTB', 'Cargo', 'Speed'];

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: bikes.length };
    bikes.forEach((b) => {
      const cat = b.usoPrincipal || 'Urbana';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [bikes]);

  // Reset de Filtros
  const handleResetFilters = () => {
    setSelectedCategory('Todos');
    setSelectedMinPower(0);
    setSelectedMinAutonomy(0);
    setMaxPrice(99999);
    setSearchInput('');
    setSortBy('menorPreco');
  };

  // Contagem de filtros ativos
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'Todos') count++;
    if (selectedMinPower > 0) count++;
    if (selectedMinAutonomy > 0) count++;
    if (maxPrice < 20000) count++;
    if (searchInput.trim()) count++;
    return count;
  }, [selectedCategory, selectedMinPower, selectedMinAutonomy, maxPrice, searchInput]);

  // Lista Filtrada e Ordenada
  const filteredBikes = useMemo(() => {
    if (!bikes || bikes.length === 0) return [];

    let result = bikes.filter((b) => {
      // 1. Categoria
      if (selectedCategory !== 'Todos' && b.usoPrincipal !== selectedCategory) {
        return false;
      }
      // 2. Potência
      if (selectedMinPower > 0 && (!b.potenciaW || b.potenciaW < selectedMinPower)) {
        return false;
      }
      // 3. Autonomia
      if (selectedMinAutonomy > 0 && (!b.autonomiaKm || b.autonomiaKm < selectedMinAutonomy)) {
        return false;
      }
      // 4. Preço Máximo
      if (maxPrice < 90000 && b.menorPreco > maxPrice) {
        return false;
      }
      // 5. Query local de busca
      if (searchInput.trim()) {
        const q = searchInput.toLowerCase();
        const matchesName = b.modelo.toLowerCase().includes(q);
        const matchesBrand = b.marca.toLowerCase().includes(q);
        const matchesCategory = b.usoPrincipal?.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesCategory) return false;
      }
      return true;
    });

    // Ordenação
    if (sortBy === 'menorPreco') {
      result.sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (sortBy === 'maiorDesconto') {
      result.sort((a, b) => {
        const discA = a.precoOriginal ? (a.precoOriginal - a.menorPreco) : 0;
        const discB = b.precoOriginal ? (b.precoOriginal - b.menorPreco) : 0;
        return discB - discA;
      });
    } else if (sortBy === 'maiorPotencia') {
      result.sort((a, b) => (b.potenciaW || 0) - (a.potenciaW || 0));
    } else if (sortBy === 'maiorAutonomia') {
      result.sort((a, b) => (b.autonomiaKm || 0) - (a.autonomiaKm || 0));
    }

    return result;
  }, [bikes, selectedCategory, selectedMinPower, selectedMinAutonomy, maxPrice, searchInput, sortBy]);

  const visibleBikes = useMemo(() => {
    return filteredBikes.slice(0, displayLimit);
  }, [filteredBikes, displayLimit]);

  const hasMore = filteredBikes.length > displayLimit;

  return (
    <Container size="wide">
      <div className="w-full flex flex-col gap-5 sm:gap-6 pt-2 sm:pt-3 pb-16" id="desktop-home-main-stream">
      {/* 1. BARRA DE AUTORIDADE & PILARES DE CERTIFICAÇÃO */}
      <DesktopAuthorityBar />

      {/* 2. RADAR DE OPORTUNIDADES & TICKER DE PREÇOS EM TEMPO REAL */}
      <PriceDropTicker bikes={bikes} formatBrl={formatBrl} />

      {/* 3. ATALHOS RÁPIDOS POR CASOS DE USO POPULARES */}
      <PopularUseCasesPills />

      {/* 4. HERO DASHBOARD PRINCIPAL - BENTO COCKPIT DE INTELIGÊNCIA (GRID 8 COLS + 4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" id="desktop-hero-dashboard">
        
        {/* COLUNA PRINCIPAL DA ESQUERDA (8 COLUNAS) */}
        <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
          
          {/* FINDER INTELIGENTE EM 3 CLIQUES */}
          <SectionErrorBoundary sectionName="Finder Rapido Desktop">
            <DesktopQuickFinder
              bikes={bikes}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedPriceRange={selectedPriceRange}
              onSelectPriceRange={handlePriceRangeChange}
              onScrollToCatalog={handleScrollToCatalog}
            />
          </SectionErrorBoundary>

          {/* PÓDIO TOP 3 POR CATEGORIA (GRID 3 COLUNAS DESKTOP) */}
          <SectionErrorBoundary sectionName="Podio Top 3 Desktop">
            <DesktopTop3Podium
              bikes={bikes}
              curation={curation}
              formatBrl={formatBrl}
              onCompareToggle={onCompareToggle}
              comparedSlugs={comparedSlugs}
            />
          </SectionErrorBoundary>

          {/* TOP RANKINGS & PÓDIOS OFICIAIS AUDITADOS */}
          <div id="zona-top-rankings" className="w-full">
            <SectionErrorBoundary sectionName="Rankings Desktop">
              <HomeTopRankingsSection rankings={rankings} />
            </SectionErrorBoundary>
          </div>

        </div>

        {/* COLUNA LATERAL DE APOIO / COCKPIT DE DECISÃO RÁPIDA (4 COLUNAS - STICKY) */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-w-0 sticky top-4">
          <SectionErrorBoundary sectionName="Sidebar Cockpit Desktop">
            <DesktopCockpitSidebar
              bikes={bikes}
              curation={curation}
              formatBrl={formatBrl}
            />
          </SectionErrorBoundary>
        </div>

      </div>

      {/* 4. VITRINE COMPLETA & CATÁLOGO GERAL EM ALTA DENSIDADE */}
      <section className="w-full flex flex-col gap-3.5 pt-2 cv-auto" id="zona-catalogo-completo">
        <ZoneDivider
          zoneNumber="03"
          title="Vitrine Geral de E-Bikes Monitoradas"
          subtitle={`${filteredBikes.length} modelos auditados com preços em tempo real`}
          icon={ShoppingBag}
          accentColor="bg-amber-300"
        />

        {/* BARRA DE FERRAMENTAS E FILTROS COMPACTOS NO TOPO DO CATÁLOGO */}
        <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 sm:p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
          
          {/* Linha 1: Busca rápida, Categoria pills e Alternador de Densidade */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Input de Busca Integrada */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ink/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por marca, modelo ou uso..."
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 hover:bg-white focus:bg-white border-2 border-ink rounded-xl text-xs font-mono font-semibold placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink text-xs font-mono font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Controles da Direita: Ordenação e Densidade */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Seletor de Ordenação */}
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <ArrowUpDown className="w-3.5 h-3.5 text-ink/60" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-neutral-50 border border-ink/30 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-ink cursor-pointer focus:outline-none focus:border-ink hover:bg-neutral-100"
                >
                  <option value="menorPreco">Menor Preço</option>
                  <option value="maiorDesconto">Maior Desconto</option>
                  <option value="maiorPotencia">Maior Potência (W)</option>
                  <option value="maiorAutonomia">Maior Autonomia (km)</option>
                </select>
              </div>

              {/* Botão de Filtros Avançados */}
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(true)}
                className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  activeFilterCount > 0
                    ? 'bg-amber-400 text-ink border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]'
                    : 'bg-neutral-100 hover:bg-accent-gold text-ink border-ink/40 hover:border-ink shadow-xs'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
              </button>

              {/* Alternador de Densidade (Grade vs Tabela) */}
              <GridDensitySwitcher
                mode={densityMode}
                onChange={setDensityMode}
              />
            </div>

          </div>

          {/* Linha 2: Badges Clicáveis de Categoria */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-dashed border-ink/15">
            <span className="text-[10px] font-mono font-bold text-ink/50 uppercase tracking-wider shrink-0 mr-1">
              Categoria:
            </span>
            {categoriesList.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-ink text-white border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-ink/80 border-ink/20 hover:border-ink/50'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-ink/60'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto text-xs font-mono text-red-600 hover:text-red-800 font-bold flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-red-50 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

        </div>

        {/* GRADE DE CARDS EM ALTA DENSIDADE (4 a 5 COLUNAS NO DESKTOP) */}
        {visibleBikes.length > 0 ? (
          <>
            {densityMode === 'editorial' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5">
                {visibleBikes.map((bike, idx) => {
                  const isCompared = comparedSlugs.includes(bike.slug);
                  return (
                    <div key={`${bike.slug}-${idx}`} className="min-w-0">
                      <EBikeCompactCard
                        bike={bike}
                        isCompared={isCompared}
                        onCompareToggle={() => onCompareToggle(bike.slug)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {densityMode === 'compact' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
                {visibleBikes.map((bike, idx) => {
                  const isCompared = comparedSlugs.includes(bike.slug);
                  return (
                    <div key={`${bike.slug}-${idx}`} className="min-w-0">
                      <EBikeCompactCard
                        bike={bike}
                        isCompared={isCompared}
                        onCompareToggle={() => onCompareToggle(bike.slug)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {densityMode === 'table' && (
              <div className="w-full bg-white border-2 border-ink rounded-2xl p-2 sm:p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-1.5 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <div className="min-w-[640px] flex flex-col gap-1.5">
                    {visibleBikes.map((bike, idx) => {
                      const isCompared = comparedSlugs.includes(bike.slug);
                      return (
                        <EBikeTableRow
                          key={`${bike.slug}-${idx}`}
                          bike={bike}
                          isCompared={isCompared}
                          onCompareToggle={() => onCompareToggle(bike.slug)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* BOTÃO CARREGAR MAIS MODELOS */}
            {hasMore && (
              <div className="w-full flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 15)}
                  className="bg-white hover:bg-neutral-50 text-ink font-mono font-bold text-xs px-6 py-2.5 rounded-xl border-2 border-ink shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>Carregar Mais E-Bikes (+15 modelos)</span>
                </button>
                <span className="text-[10px] font-mono text-ink/60">
                  Exibindo {visibleBikes.length} de {filteredBikes.length} bicicletas encontradas
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full bg-white border-2 border-dashed border-ink/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-2">
            <span className="text-2xl">🚲</span>
            <h4 className="font-display font-black text-sm text-ink">Nenhuma e-bike encontrada</h4>
            <p className="text-xs font-mono text-ink/60 max-w-sm">
              Nenhum modelo corresponde aos filtros aplicados. Experimente limpar ou afrouxar os critérios.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 bg-accent-gold text-ink font-mono font-bold text-xs px-4 py-2 rounded-xl border border-ink shadow-xs cursor-pointer"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        )}
      </section>

      {/* 5. DOSSIÊS EDITORIAIS & GUIAS DE COMPRA */}
      <section className="w-full flex flex-col gap-3.5 pt-2" id="zona-artigos-editoriais">
        <ZoneDivider
          zoneNumber="04"
          title="Dossiês &amp; Análises Especializadas"
          subtitle="Guias de compra, testes e comparativos técnicos"
          icon={BookOpen}
          accentColor="bg-orange-300"
        />

        <SectionErrorBoundary sectionName="Artigos Desktop">
          <MobileArticlesSection articles={articles} curation={curation} />
        </SectionErrorBoundary>
      </section>

      {/*
        CONTRAN — por que esta seção existe.

        A diferenciação do site é conformidade legal, e a home de desktop não
        mostrava nada disso: os dois componentes que explicam o enquadramento
        (pedal assistido, autopropelido, ciclomotor) estavam prontos mas não
        eram renderizados por ninguém. Quem chega pela busca — quase sempre
        perguntando se precisa de emplacamento — não encontrava a resposta.
      */}
      <section className="flex flex-col gap-5" id="desktop-contran">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/50">
            Resolução CONTRAN 996/2023
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-black text-ink">
            Precisa de emplacamento? A lei depende da potência, não da aparência
          </h2>
          <p className="text-xs sm:text-sm font-mono text-ink/60 max-w-3xl">
            Os três enquadramentos legais e o que cada um permite fazer na via. Confira antes de
            comprar — a diferença entre eles é de registro, não de aparência.
          </p>
        </div>

        <SectionErrorBoundary sectionName="Legislação CONTRAN">
          <LegislationContranGrid />
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Guia de trânsito CONTRAN">
          <ContranTrafficGuide />
        </SectionErrorBoundary>
      </section>

      {/*
        Anúncio no fim da home, abaixo da seção CONTRAN e de todo o catálogo.

        Só um, e no rodapé: a home é a página de conversão do site, e anúncio
        perto do topo compete com a curadoria e derruba o clique tanto no
        anúncio quanto no conteúdo.
      */}
      <AdSenseBanner
        slotId={getAdSenseSlot('HOME_BOTTOM')}
        slotName="HOME_FUNDO"
        format="horizontal"
        minHeight={90}
      />

      {/* DRAWER DE FILTROS DETALHADOS (MODAL LATERAL/POPUP) */}
      <MobileFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedMinPower={selectedMinPower}
        onSelectMinPower={setSelectedMinPower}
        selectedMinAutonomy={selectedMinAutonomy}
        onSelectMinAutonomy={setSelectedMinAutonomy}
        maxPrice={maxPrice}
        onSelectMaxPrice={setMaxPrice}
        totalFilteredCount={filteredBikes.length}
        onResetFilters={handleResetFilters}
        formatBrl={formatBrl}
      />
      </div>
    </Container>
  );
}

