'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEBikesFromFirestore, getGroupedEBikes } from '@/lib/ebikes';
import { fetchArticlesFromFirestore, getAllArticles } from '@/lib/articles';
import { EBikeCategory, EBikeGrouped, EBikeStoreOffer } from '@/types/ebike';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';

import dynamic from 'next/dynamic';
import CompareTray from './CompareTray';

// Tipo local para curadoria da Home (substitui o que vinha de homeCurationService)
interface CuratedBikeDeal {
  slug: string;
  modelo: string;
  marca: string;
  menorPreco: number;
  maiorPreco: number;
  economiaBrl: number;
  discountPct: number;
  badge: string;
  headline: string;
  aiVerdict: string;
  autonomiaKm?: number;
  potenciaW?: number;
  pesoKg?: number;
  imagemUrl?: string;
}

interface CuratedArticleHighlight {
  slug: string;
  title: string;
  summary: string;
  category: string;
  badge: string;
  editorialHook: string;
  readTimeMinutes: number;
  imageUrl?: string;
  publishedAt: string;
}

interface CuratedTopic {
  id: string;
  title: string;
  icon: string;
  description: string;
  badge: string;
  articleSlugs: string[];
  relevance: 'semana' | 'mes' | 'essencial';
}

interface HomeCurationData {
  bikes: {
    dealOfWeek: CuratedBikeDeal;
    dealOfMonth: CuratedBikeDeal;
    bestValuePick: CuratedBikeDeal;
    topUrbanRange: CuratedBikeDeal;
    hotPriceDrops: CuratedBikeDeal[];
    weeklyDuel: {
      bike1Slug: string;
      bike2Slug: string;
      title: string;
      category: string;
      aiVerdictPreview: string;
    };
    podiums?: {
      custoBeneficioSlugs: string[];
      subidasSlugs: string[];
      dobraveisSlugs: string[];
      urbanasSlugs: string[];
    };
    duels?: Array<{
      id: string;
      tag: string;
      bikeASlug: string;
      bikeBSlug: string;
      destaque: string;
    }>;
    catalogPrioritySlugs?: string[];
  };
  articles: {
    highRelevanceWeek: CuratedArticleHighlight;
    highRelevanceMonth: CuratedArticleHighlight;
    topics: CuratedTopic[];
    radarTrendSummary: string;
  };
}

const MobileFusedHome = dynamic(() => import('../home/MobileFusedHome'), { ssr: true });
const DesktopHome = dynamic(() => import('../home/DesktopHome'), { ssr: true });

interface CatalogGridProps {
  initialBikes?: EBikeGrouped[];
  initialArticles?: Article[];
  initialRankings?: TopRanking[];
  initialCuration?: HomeCurationData;
}

export default function CatalogGrid({
  initialBikes = [],
  initialArticles = [],
  initialRankings = [],
  initialCuration,
}: CatalogGridProps) {
  const [curation, setCuration] = useState<HomeCurationData | undefined>(initialCuration);
  const [allBikes, setAllBikes] = useState<EBikeGrouped[]>(() => {
    const map = new Map<string, EBikeGrouped>();
    const sourceList = initialBikes && initialBikes.length > 0 ? initialBikes : getGroupedEBikes(true);
    sourceList.forEach((b) => {
      if (b && b.slug) map.set(b.slug, b);
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      return timeB - timeA;
    });
  });

  const [homeArticles, setHomeArticles] = useState<Article[]>(() => {
    const map = new Map<string, Article>();
    const sourceList = initialArticles && initialArticles.length > 0 ? initialArticles : getAllArticles();
    sourceList.forEach((a) => {
      if (a && a.slug) map.set(a.slug, a);
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  });

  const [rankings, setRankings] = useState<TopRanking[]>(() => {
    const map = new Map<string, TopRanking>();
    const sourceList = initialRankings || [];
    sourceList.forEach((r) => {
      if (r && r.slug) map.set(r.slug, r);
    });
    return Array.from(map.values());
  });

  // Separação inteligente de carregamento Mobile vs Desktop
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop' | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setDeviceMode(mql.matches ? 'desktop' : 'mobile');

    const handler = (e: MediaQueryListEvent) => {
      setDeviceMode(e.matches ? 'desktop' : 'mobile');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const router = useRouter();

  const deduplicateBikes = (list: EBikeGrouped[]) => {
    if (!list || !Array.isArray(list)) return [];
    const map = new Map<string, EBikeGrouped>();
    list.forEach((b) => {
      if (b && b.slug) map.set(b.slug, b);
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      return timeB - timeA;
    });
  };

  const deduplicateArticles = (list: Article[]) => {
    if (!list || !Array.isArray(list)) return [];
    const map = new Map<string, Article>();
    list.forEach((a) => {
      if (a && a.slug) map.set(a.slug, a);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  };

  const deduplicateRankings = (list: TopRanking[]) => {
    if (!list || !Array.isArray(list)) return [];
    const map = new Map<string, TopRanking>();
    list.forEach((r) => {
      if (r && (r.slug || r.id)) map.set(r.slug || r.id, r);
    });
    return Array.from(map.values());
  };

  // Sincronização direta e reativa com as props do Server Component (SSR / ISR)
  useEffect(() => {
    if (initialBikes && initialBikes.length > 0) {
      setAllBikes(deduplicateBikes(initialBikes));
    }
  }, [initialBikes]);

  useEffect(() => {
    if (initialArticles && initialArticles.length > 0) {
      setHomeArticles(deduplicateArticles(initialArticles));
    }
  }, [initialArticles]);

  useEffect(() => {
    if (initialRankings && initialRankings.length > 0) {
      setRankings(deduplicateRankings(initialRankings));
    }
  }, [initialRankings]);

  useEffect(() => {
    if (initialCuration) {
      setCuration(initialCuration);
    }
  }, [initialCuration]);

  // Input de Busca Rápida no Hero Desktop
  const [heroSearchInput, setHeroSearchInput] = useState('');

  // Estado do Comparador Avançado
  const [comparedSlugs, setComparedSlugs] = useState<string[]>([]);
  const [compareMessage, setCompareMessage] = useState<string | null>(null);

  // Estado para controle de expansão de categorias na home
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Timer do aviso do comparador
  useEffect(() => {
    if (compareMessage) {
      const timer = setTimeout(() => setCompareMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [compareMessage]);

  // Handler de envio da busca rápida
  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearchInput.trim()) {
      router.push(`/ebike?q=${encodeURIComponent(heroSearchInput.trim())}`);
    } else {
      router.push('/ebike');
    }
  };

  // Formatador BRL
  const formatBrl = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

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
    return (allBikes || []).filter((b) => b && b.slug && comparedSlugs.includes(b.slug));
  }, [allBikes, comparedSlugs]);

  // 3 Destaques de Maior Economia Real
  const featuredBikes = useMemo(() => {
    const validBikes = (allBikes || []).filter((b) => b && b.slug);
    const multiOffer = validBikes
      .filter((b) => Array.isArray(b.ofertas) && b.ofertas.length > 1 && (b.maiorPreco || 0) > (b.menorPreco || 0))
      .map((b) => ({
        ...b,
        diff: (b.maiorPreco || 0) - (b.menorPreco || 0),
      }))
      .sort((a, b) => b.diff - a.diff);

    if (multiOffer.length > 0) {
      return multiOffer.slice(0, 3);
    }

    return validBikes.slice(0, 3);
  }, [allBikes]);

  // Estatísticas Reais Auditadas
  const catalogStats = useMemo(() => {
    if (!allBikes || !allBikes.length) return { count: 0, storesCount: 0, minPrice: 0, maxPrice: 0 };
    const storesSet = new Set<string>();
    let min = Infinity;
    let max = 0;

    allBikes.forEach((b) => {
      if (!b) return;
      if (Array.isArray(b.ofertas)) {
        b.ofertas.forEach((o: EBikeStoreOffer) => {
          if (o && o.loja) storesSet.add(o.loja);
        });
      }
      const price = typeof b.menorPreco === 'number' ? b.menorPreco : 0;
      if (price > 0 && price < min) min = price;
      if (price > max) max = price;
    });

    return {
      count: allBikes.length,
      storesCount: storesSet.size,
      minPrice: min === Infinity ? 0 : min,
      maxPrice: max,
    };
  }, [allBikes]);

  // Artigos/Matérias por Categoria Curada
  const categoryArticles = useMemo(() => {
    const articleMeta: Record<EBikeCategory, { title: string; subtitle: string }> = {
      'Urbana': {
        title: 'As e-bikes urbanas mais equilibradas do mês',
        subtitle: 'Unindo quadros confortáveis, autonomia de até 45 km e motores ideais para o deslocamento diário, a categoria urbana oferece o melhor custo-benefício para fugir do trânsito com segurança.',
      },
      'Trilha/MTB': {
        title: 'Modelos de Trilha e MTB para encarar qualquer terreno',
        subtitle: 'Com motores de 350W a 500W, suspensão reforçada e bateria duradoura, estes modelos oferecem controle total em terrenos irregulares e subidas íngremes.',
      },
      'Dobrável': {
        title: 'E-bikes dobráveis práticas para transporte multimodal',
        subtitle: 'Projetadas para quem precisa de facilidade no transporte público ou possui espaço reduzido em casa, mantendo a assistência elétrica ágil no trânsito urbano.',
      },
      'Cargo': {
        title: 'Modelos Cargo com alta capacidade para cargas e entregas',
        subtitle: 'Com capacidade de carga expandida e estrutura de alta resistência, são a alternativa sustentável perfeita para transporte de bagagens e entregas.',
      },
      'Speed': {
        title: 'E-bikes Speed de alta performance e peso reduzido',
        subtitle: 'Geometria aerodinâmica e componentes leves para ciclistas que buscam alto rendimento no asfalto com assistência elétrica fluida e responsiva.',
      },
    };

    const categoryList: EBikeCategory[] = ['Urbana', 'Trilha/MTB', 'Dobrável', 'Cargo', 'Speed'];

    return categoryList
      .map((cat) => {
        const bikes = (allBikes || []).filter((b) => b && b.usoPrincipal === cat);
        return {
          category: cat,
          title: articleMeta[cat]?.title || `Bicicletas Elétricas ${cat}`,
          subtitle: articleMeta[cat]?.subtitle || `Confira a seleção curada de modelos de e-bikes para uso ${cat}.`,
          bikes: bikes,
          totalCount: bikes.length,
        };
      })
      .filter((art) => art.totalCount >= 1)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [allBikes]);

  return (
    <div className="w-full flex flex-col px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4 lg:px-5 lg:py-4" id="home-editorial-grid">
      {/* 
        SEPARAÇÃO INTELIGENTE DE HTML E RECURSOS:
        - No SSR (deviceMode === null): entrega casca responsiva sem layout shift para SEO.
        - No Cliente Hidratado: descarrega completamente o componente não utilizado da memória e DOM.
      */}
      {deviceMode === null ? (
        <>
          {/* SSR Fallback Mobile */}
          <div className="block md:hidden w-full" id="mobile-home-section">
            <MobileFusedHome
              bikes={allBikes}
              articles={homeArticles}
              rankings={rankings}
              curation={curation}
              formatBrl={formatBrl}
              comparedSlugs={comparedSlugs}
              onCompareToggle={handleCompareToggle}
            />
          </div>

          {/* SSR Fallback Desktop */}
          <div className="hidden md:block w-full" id="desktop-home-section">
            <DesktopHome
              bikes={allBikes}
              articles={homeArticles}
              rankings={rankings}
              curation={curation}
              heroSearchInput={heroSearchInput}
              setHeroSearchInput={setHeroSearchInput}
              handleHeroSearchSubmit={handleHeroSearchSubmit}
              formatBrl={formatBrl}
              comparedSlugs={comparedSlugs}
              onCompareToggle={handleCompareToggle}
              featuredBikes={featuredBikes}
              catalogStats={catalogStats}
              categoryArticles={categoryArticles}
              expandedCategories={expandedCategories}
              toggleCategoryExpand={toggleCategoryExpand}
            />
            <CompareTray
              comparedSlugs={comparedSlugs}
              comparedBikes={comparedBikes}
              handleRemoveFromCompare={handleRemoveFromCompare}
              clearCompare={() => setComparedSlugs([])}
            />
          </div>
        </>
      ) : deviceMode === 'mobile' ? (
        /* CLIENTE MOBILE: DesktopHome 100% descarregado */
        <div className="w-full" id="mobile-home-section">
          <MobileFusedHome
            bikes={allBikes}
            articles={homeArticles}
            rankings={rankings}
            curation={curation}
            formatBrl={formatBrl}
            comparedSlugs={comparedSlugs}
            onCompareToggle={handleCompareToggle}
          />
        </div>
      ) : (
        /* CLIENTE DESKTOP: MobileFusedHome 100% descarregado */
        <div className="w-full" id="desktop-home-section">
          <DesktopHome
            bikes={allBikes}
            articles={homeArticles}
            rankings={rankings}
            curation={curation}
            heroSearchInput={heroSearchInput}
            setHeroSearchInput={setHeroSearchInput}
            handleHeroSearchSubmit={handleHeroSearchSubmit}
            formatBrl={formatBrl}
            comparedSlugs={comparedSlugs}
            onCompareToggle={handleCompareToggle}
            featuredBikes={featuredBikes}
            catalogStats={catalogStats}
            categoryArticles={categoryArticles}
            expandedCategories={expandedCategories}
            toggleCategoryExpand={toggleCategoryExpand}
          />
          <CompareTray
            comparedSlugs={comparedSlugs}
            comparedBikes={comparedBikes}
            handleRemoveFromCompare={handleRemoveFromCompare}
            clearCompare={() => setComparedSlugs([])}
          />
        </div>
      )}
    </div>
  );
}
