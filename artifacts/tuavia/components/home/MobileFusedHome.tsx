import React, { useState, useMemo, useRef, useEffect } from 'react';
import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Sparkles, 
  SlidersHorizontal, 
  Layers, 
  Check, 
  Tag, 
  TrendingDown, 
  ShieldCheck,
  Zap,
  ArrowRight,
  Compass,
  Trophy,
  Calculator,
  BookOpen,
  ShoppingBag,
  Info
} from 'lucide-react';
import { LOGO_TUAVIA_DATA_URI } from '@/logoTuaViaDataUri';
import { EBikeGrouped } from '@/types/ebike';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';
import { HomeAICurationData } from '@/types/homeCuration';
import dynamic from 'next/dynamic';

import MobileMasterHeader from './MobileMasterHeader';
import MobileBentoGrid from './MobileBentoGrid';
import PopularUseCasesPills from './PopularUseCasesPills';
import ZoneDivider from './ZoneDivider';
import SectionErrorBoundary from '@/components/ui/SectionErrorBoundary';
import { Container } from '@/components/ui';

// Carregamento dinâmico otimizado (Code-splitting) para componentes abaixo da dobra (elimina TBT)
const MobileTop3Podium = dynamic(() => import('./MobileTop3Podium'), { ssr: true });
const MobileVersusCarousel = dynamic(() => import('./MobileVersusCarousel'), { ssr: true });
const MobileDecisionAssistant = dynamic(() => import('./MobileDecisionAssistant'), { ssr: true });
const MobileSavingsCalculator = dynamic(() => import('./MobileSavingsCalculator'), { ssr: true });
const PriceDropTicker = dynamic(() => import('./PriceDropTicker'), { ssr: true });
const HomeTopRankingsSection = dynamic(() => import('./HomeTopRankingsSection'), { ssr: true });
const MobileContranFlash = dynamic(() => import('./MobileContranFlash'), { ssr: true });
const MobileArticlesSection = dynamic(() => import('./MobileArticlesSection'), { ssr: true });
const MobileCatalogGrid = dynamic(() => import('./MobileCatalogGrid'), { ssr: true });
const MobileFilterDrawer = dynamic(() => import('./MobileFilterDrawer'), { ssr: false });

interface MobileFusedHomeProps {
  bikes: EBikeGrouped[];
  articles: Article[];
  rankings?: TopRanking[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
  comparedSlugs: string[];
  onCompareToggle: (slug: string) => void;
}

export default function MobileFusedHome({
  bikes,
  articles,
  rankings = [],
  curation,
  formatBrl,
  comparedSlugs,
  onCompareToggle
}: MobileFusedHomeProps) {
  const router = useRouter();

  // Estados de Busca e Filtros
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedMinPower, setSelectedMinPower] = useState<number>(0);
  const [selectedMinAutonomy, setSelectedMinAutonomy] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(99999);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isCatalogVisible, setIsCatalogVisible] = useState(false);

  // Monitora visibilidade da Zona 05 (Catálogo) para exibir o botão flutuante de filtros estritamente no catálogo
  useEffect(() => {
    const catalogEl = document.getElementById('zona-05-catalogo');
    const scrollContainer = document.getElementById('main-scrollable-content');
    if (!catalogEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCatalogVisible(entry.isIntersecting);
      },
      { 
        root: scrollContainer || null,
        rootMargin: '0px', 
        threshold: 0.05 
      }
    );

    observer.observe(catalogEl);
    return () => observer.disconnect();
  }, []);

  // Submissão da Busca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/pesquisa?q=${encodeURIComponent(searchInput.trim())}`);
    } else {
      router.push('/pesquisa');
    }
  };

  // Aplicação rápida de chip de busca
  const handleQuickChip = (type: 'price' | 'power' | 'autonomy' | 'category', val: any) => {
    if (type === 'price') {
      setMaxPrice((prev) => (prev === val ? 99999 : val));
    } else if (type === 'power') {
      setSelectedMinPower((prev) => (prev === val ? 0 : val));
    } else if (type === 'autonomy') {
      setSelectedMinAutonomy((prev) => (prev === val ? 0 : val));
    } else if (type === 'category') {
      setSelectedCategory((prev) => (prev === val ? 'Todos' : val));
    }
  };

  // Reset de Filtros
  const handleResetFilters = () => {
    setSelectedCategory('Todos');
    setSelectedMinPower(0);
    setSelectedMinAutonomy(0);
    setMaxPrice(99999);
    setSearchInput('');
  };

  // Contagem de filtros ativos
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'Todos') count++;
    if (selectedMinPower > 0) count++;
    if (selectedMinAutonomy > 0) count++;
    if (maxPrice < 20000) count++;
    return count;
  }, [selectedCategory, selectedMinPower, selectedMinAutonomy, maxPrice]);

  // Lista Filtrada para a grade de catálogo
  const filteredBikes = useMemo(() => {
    if (!bikes || bikes.length === 0) return [];

    return bikes.filter((b) => {
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
      // 5. Query local se digitada
      if (searchInput.trim()) {
        const q = searchInput.toLowerCase();
        const matchesName = b.modelo.toLowerCase().includes(q);
        const matchesBrand = b.marca.toLowerCase().includes(q);
        const matchesCategory = b.usoPrincipal?.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesCategory) return false;
      }
      return true;
    });
  }, [bikes, selectedCategory, selectedMinPower, selectedMinAutonomy, maxPrice, searchInput]);

  return (
    <Container size="mobile-full">
      <div className="w-full flex flex-col gap-4 sm:gap-6 pb-20" id="mobile-fused-layout-root">
      
      {/* ----------------------------------------------------
          1. NOVO CABEÇALHO MASTER MOBILE (DESIGN ELEGANTE NEO-BRUTALIST)
          ---------------------------------------------------- */}
      <MobileMasterHeader
        bikesCount={bikes.length}
        comparedSlugs={comparedSlugs}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        selectedCategory={selectedCategory}
        selectedMinPower={selectedMinPower}
        selectedMinAutonomy={selectedMinAutonomy}
        maxPrice={maxPrice}
        onQuickChip={handleQuickChip}
        onResetFilters={handleResetFilters}
        activeFilterCount={activeFilterCount}
        onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
      />

      {/* RADAR DE OPORTUNIDADES & QUEDAS DE PREÇO EM TEMPO REAL */}
      <PriceDropTicker bikes={bikes} formatBrl={formatBrl} />

      {/* ATALHOS RÁPIDOS POR CASOS DE USO */}
      <PopularUseCasesPills />

      {/* ====================================================
          ZONA 01 // 🧭 ASSISTENTE INTELIGENTE DE ESCOLHA
          ==================================================== */}
      <section className="w-full flex flex-col gap-3" id="zona-01-escolha">
        <ZoneDivider
          zoneNumber="01"
          title="Assistente de Escolha"
          subtitle="Encontre em 3 cliques"
          icon={Compass}
          accentColor="bg-amber-300"
        />

        {/* Assistente de Decisão Rápida (3 Perguntas) */}
        <SectionErrorBoundary sectionName="Assistente de Escolha">
          <MobileDecisionAssistant
            bikes={bikes}
            formatBrl={formatBrl}
            onCompareToggle={onCompareToggle}
            comparedSlugs={comparedSlugs}
          />
        </SectionErrorBoundary>
      </section>

      {/* ====================================================
          ZONA 02 // 🏆 ARENA & CURADORIA DE PERFORMANCE
          ==================================================== */}
      <section className="w-full flex flex-col gap-4 cv-auto" id="zona-02-arena">
        <ZoneDivider
          zoneNumber="02"
          title="Arena &amp; Pódio dos Melhores"
          subtitle="Top 3 e confrontos diretos"
          icon={Trophy}
          accentColor="bg-emerald-300"
        />

        {/* Pódio Top 3 por Categoria (Curadoria Auditada) */}
        <SectionErrorBoundary sectionName="Podio Top 3">
          <MobileTop3Podium
            bikes={bikes}
            curation={curation}
            formatBrl={formatBrl}
            onCompareToggle={onCompareToggle}
            comparedSlugs={comparedSlugs}
          />
        </SectionErrorBoundary>

        {/* Carrossel de Duelos Populares (VS) */}
        <SectionErrorBoundary sectionName="Duelos Populares">
          <MobileVersusCarousel
            bikes={bikes}
            curation={curation}
            formatBrl={formatBrl}
          />
        </SectionErrorBoundary>

        {/* Top Rankings & Pódios Oficiais */}
        <SectionErrorBoundary sectionName="Rankings">
          <HomeTopRankingsSection rankings={rankings} />
        </SectionErrorBoundary>
      </section>

      {/* ====================================================
          ZONA 03 // 💰 INTELIGÊNCIA FINANCEIRA & RADAR
          ==================================================== */}
      <section className="w-full flex flex-col gap-3 cv-auto" id="zona-03-mercado">
        <ZoneDivider
          zoneNumber="03"
          title="Inteligência de Economia &amp; Ofertas"
          subtitle="Simulador real e quedas de preço"
          icon={Calculator}
          accentColor="bg-indigo-300"
        />

        {/* Radar de Mercado & Calculadora de Economia Real */}
        <SectionErrorBoundary sectionName="Calculadora de Economia">
          <MobileSavingsCalculator
            bikes={bikes}
            formatBrl={formatBrl}
          />
        </SectionErrorBoundary>

        {/* Bento Grid Modular (Destaques & Radar Técnico) */}
        <SectionErrorBoundary sectionName="Bento Grid">
          <MobileBentoGrid
            bikes={bikes}
            curation={curation}
            formatBrl={formatBrl}
            onCompareToggle={onCompareToggle}
            comparedSlugs={comparedSlugs}
          />
        </SectionErrorBoundary>
      </section>

      {/* ====================================================
          ZONA 04 // 📜 LEGISLAÇÃO CONTRAN & DOSSIÊS
          ==================================================== */}
      <section className="w-full flex flex-col gap-3 cv-auto" id="zona-04-conteudo">
        <ZoneDivider
          zoneNumber="04"
          title="Legislação &amp; Análises Especializadas"
          subtitle="Regras de trânsito e guias"
          icon={BookOpen}
          accentColor="bg-orange-300"
        />

        {/* Mini-Guia CONTRAN Flash (Resolução 996/2023) */}
        <SectionErrorBoundary sectionName="Contran Flash">
          <MobileContranFlash />
        </SectionErrorBoundary>

        {/* Publicações Editoriais & Dossiês */}
        <SectionErrorBoundary sectionName="Artigos Editorial">
          <MobileArticlesSection articles={articles} curation={curation} />
        </SectionErrorBoundary>
      </section>

      {/* ====================================================
          ZONA 05 // 🛒 VITRINE COMPLETA & CATÁLOGO AUDITADO
          ==================================================== */}
      <section className="w-full flex flex-col gap-3 cv-auto" id="zona-05-catalogo">
        <ZoneDivider
          zoneNumber="05"
          title="Vitrine Completa &amp; Catálogo"
          subtitle={`${filteredBikes.length} modelos auditados`}
          icon={ShoppingBag}
          accentColor="bg-teal-300"
        />

        {/* Catálogo em Grade Dupla 2 Colunas */}
        <SectionErrorBoundary sectionName="Catalogo de Bikes">
          <MobileCatalogGrid
            bikes={filteredBikes}
            formatBrl={formatBrl}
            onCompareToggle={onCompareToggle}
            comparedSlugs={comparedSlugs}
            onOpenFilters={() => setIsFilterDrawerOpen(true)}
            activeFilterCount={activeFilterCount}
          />
        </SectionErrorBoundary>
      </section>

      {/* ----------------------------------------------------
          BOTÃO FLUTUANTE ERGONÔMICO NO POLEGAR (EXIBIDO ESTRITAMENTE NO CATÁLOGO)
          POSICIONADO ACIMA DO BOTÃO 1V1 PARA EVITAR QUALQUER SOBREPOSIÇÃO
          ---------------------------------------------------- */}
      {isCatalogVisible && (
        <div 
          className="fixed right-4 z-[70] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto"
          style={{ bottom: '146px' }}
        >
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className="bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-xs w-[110px] h-[38px] rounded-full border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none touch-manipulation"
          >
            <SlidersHorizontal className="w-4 h-4 text-ink shrink-0" />
            <span>Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
          </button>
        </div>
      )}

      {/* ----------------------------------------------------
          DRAWER DE FILTROS RÁPIDOS
          ---------------------------------------------------- */}
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

      {/*
        Um anúncio, no fim da página. A home mobile é a de maior tráfego do
        site, mas anúncio no topo competiria com a curadoria; aqui ele vem
        depois de todo o conteúdo.
      */}
      <AdSenseBanner
        slotId={getAdSenseSlot('HOME_BOTTOM')}
        slotName="HOME_FUNDO_MOBILE"
        format="horizontal"
        minHeight={90}
      />

    </Container>
  );
}
