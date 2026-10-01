'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Calendar, 
  ShieldCheck,
  ChevronRight,
  Cpu,
  Layers,
  FileText,
  Star,
  Tag as TagIcon
} from 'lucide-react';
import SafeImage from '@/components/ui/SafeImage';
import { Article } from '@/types/article';
import { formatArticleDate, getAllArticleTags, getLegislationArticles, isArticleFreshUnder6Hours } from '@/lib/articles';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';
import { HomeAICurationData } from '@/types/homeCuration';
import AlztaTopicSection from '@/components/artigos/AlztaTopicSection';

interface MobileArticlesSectionProps {
  articles: Article[];
  curation?: HomeAICurationData;
}

export default function MobileArticlesSection({ articles, curation }: MobileArticlesSectionProps) {
  const router = useRouter();
  const articlesScrollRef = useRef<HTMLDivElement>(null);
  const topicsScrollRef = useRef<HTMLDivElement>(null);
  const tagsScrollRef = useRef<HTMLDivElement>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Considera apenas artigos elegíveis para feeds/catálogos públicos
  const feedArticles = useMemo(() => {
    return (articles || []).filter((a) => !a.hideFromFeed);
  }, [articles]);

  // Extrai tags dinâmicas presentes nos artigos públicos
  const availableTags = useMemo(() => {
    return getAllArticleTags(feedArticles);
  }, [feedArticles]);

  // Artigos de Legislação e Normas lastreados para a Seção 4 (públicos)
  const legislationArticles = useMemo(() => {
    return getLegislationArticles(feedArticles);
  }, [feedArticles]);

  // 1. Artigo de Maior Impacto Editorial (dinâmico com base no artigo real)
  const weekArticle = useMemo(() => {
    if (!feedArticles || feedArticles.length === 0) return null;
    
    if (curation?.articles?.highRelevanceWeek) {
      const cur = curation.articles.highRelevanceWeek;
      const matched = feedArticles.find((a) => a.slug === cur.slug);
      if (matched) {
        const isLeg = matched.category === 'Legislação' || matched.title.toLowerCase().includes('contran');
        return {
          ...matched,
          editorialBadge: cur.editorialBadge || cur.badge || (isLeg ? 'LEGISLAÇÃO & NORMAS' : 'DESTAQUE PRINCIPAL'),
          editorialHook: cur.editorialHook || matched.excerpt,
        };
      }
    }

    const first = feedArticles[0];
    const isLeg = first.category === 'Legislação' || first.title.toLowerCase().includes('contran');

    return {
      ...first,
      editorialBadge: isLeg ? 'LEGISLAÇÃO & NORMAS' : 'DESTAQUE PRINCIPAL',
      editorialHook: first.excerpt || 'Análise técnica essencial para quem busca pedalar com segurança e economia.',
    };
  }, [feedArticles, curation]);

  // 2. Dossiê Especial do Mês (Curado pela IA)
  const monthArticle = useMemo(() => {
    if (!feedArticles || feedArticles.length === 0) return null;
    if (curation?.articles?.highRelevanceMonth) {
      const cur = curation.articles.highRelevanceMonth;
      const matched = feedArticles.find((a) => a.slug === cur.slug && a.slug !== weekArticle?.slug);
      if (matched) {
        return {
          ...matched,
          editorialBadge: 'DOSSIÊ TÉCNICO',
          editorialHook: cur.editorialHook || matched.excerpt || 'Guia aprofundado com comparativo e critérios de compra.',
        };
      }
    }
    const secondary = feedArticles.find((a) => a.slug !== weekArticle?.slug) || feedArticles[1] || feedArticles[0];
    return {
      ...secondary,
      editorialBadge: 'DOSSIÊ TÉCNICO',
      editorialHook: secondary?.excerpt || 'Guia completo com comparativo técnico e critérios decisivos.',
    };
  }, [feedArticles, curation, weekArticle]);

  // 3. Tópicos Categorizados
  const topics = useMemo(() => {
    if (curation?.articles?.topics && curation.articles.topics.length > 0) {
      return curation.articles.topics;
    }
    if (!feedArticles || feedArticles.length === 0) return [];
    return [
      {
        id: 'topic_contran_legal',
        title: 'Legislação CONTRAN',
        icon: '📜',
        description: 'Regras da Resolução 996/2023 e vias públicas.',
        badge: 'LEIS & REGRAS',
        articleSlugs: legislationArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt)).map((a) => a.slug),
        relevance: 'semana' as const,
      },
      {
        id: 'topic_smart_buying',
        title: 'Guias de Compra',
        icon: '🎯',
        description: 'Potência, autonomia e melhor custo-benefício.',
        badge: 'GUIA COMPLETO',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Guia de Compra').map((a) => a.slug),
        relevance: 'mes' as const,
      },
      {
        id: 'topic_tech_battery',
        title: 'Baterias & Cuidados',
        icon: '⚡',
        description: 'Como prolongar a vida útil das baterias de lítio.',
        badge: 'MANUTENÇÃO',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Manutenção').map((a) => a.slug),
        relevance: 'essencial' as const,
      },
      {
        id: 'topic_promos_deals',
        title: 'Comparativos',
        icon: '⚖️',
        description: 'Confrontos diretos de modelos e custo-benefício.',
        badge: 'ANÁLISE',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Comparativo').map((a) => a.slug),
        relevance: 'semana' as const,
      },
      {
        id: 'topic_news',
        title: 'Notícias & Mercado',
        icon: '📰',
        description: 'Lançamentos, tendências e novidades do setor elétrico.',
        badge: 'NOTÍCIAS',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Notícias').map((a) => a.slug),
        relevance: 'semana' as const,
      },
      {
        id: 'topic_economy',
        title: 'Economia & Mobilidade',
        icon: '💰',
        description: 'Calculadoras de payback, economia por km e isenção de IPVA.',
        badge: 'ALTO IMPACTO',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Economia & Mobilidade').map((a) => a.slug),
        relevance: 'semana' as const,
      },
      {
        id: 'topic_tech_advanced',
        title: 'Tecnologia & Baterias',
        icon: '🔋',
        description: 'Química LFP vs NMC, motores 750W e rastreamento anti-furto.',
        badge: 'ALTO IMPACTO',
        articleSlugs: feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt) && a.category === 'Tecnologia & Baterias').map((a) => a.slug),
        relevance: 'semana' as const,
      },
    ];
  }, [curation, feedArticles, legislationArticles]);

  // Slugs já utilizados nos dois blocos de destaque superior (Hero Principal + Dossiê do Mês)
  const topFeaturedSlugs = useMemo(() => {
    const set = new Set<string>();
    if (weekArticle?.slug) set.add(weekArticle.slug);
    if (monthArticle?.slug) set.add(monthArticle.slug);
    return set;
  }, [weekArticle?.slug, monthArticle?.slug]);

  // Artigos filtrados para o Tópico 01 (Economia & Mobilidade) excluindo os destaques do topo
  const economiaArticles = useMemo(() => {
    const pool = feedArticles.filter((a) => !topFeaturedSlugs.has(a.slug));
    if (pool.length === 0) return [];

    const getEcoScore = (a: Article) => {
      let score = 0;
      const text = `${a.title} ${a.excerpt} ${(a.tags || []).join(' ')}`.toLowerCase();
      if (a.category === 'Economia & Mobilidade') score += 10;
      if (text.includes('mercado') || text.includes('custo') || text.includes('preço') || text.includes('r$') || text.includes('economia') || text.includes('payback') || text.includes('investimento')) score += 5;
      if (text.includes('mobilidade') || text.includes('transporte') || text.includes('urbana')) score += 3;
      return score;
    };

    const scored = pool.filter((a) => getEcoScore(a) > 0);
    const sorted = (scored.length > 0 ? scored : pool).sort((a, b) => getEcoScore(b) - getEcoScore(a));
    return sorted;
  }, [feedArticles, topFeaturedSlugs]);

  // Slug do artigo de maior destaque no Tópico 01
  const economiaHeroSlug = useMemo(() => {
    return economiaArticles[0]?.slug;
  }, [economiaArticles]);

  // Conjunto de slugs já consumidos até o Tópico 02 (Topo + Hero do Tópico 01)
  const topic02ExcludeSlugs = useMemo(() => {
    const set = new Set(topFeaturedSlugs);
    if (economiaHeroSlug) set.add(economiaHeroSlug);
    return set;
  }, [topFeaturedSlugs, economiaHeroSlug]);

  // Artigos filtrados para o Tópico 02 (Tecnologia & Baterias) excluindo os cards anteriores
  const tecnologiaArticles = useMemo(() => {
    const pool = feedArticles.filter((a) => !topic02ExcludeSlugs.has(a.slug));
    if (pool.length === 0) return [];

    const getTechScore = (a: Article) => {
      let score = 0;
      const text = `${a.title} ${a.excerpt} ${(a.tags || []).join(' ')}`.toLowerCase();
      if (a.category === 'Tecnologia & Baterias') score += 10;
      if (text.includes('bateria') || text.includes('sólida') || text.includes('lfp') || text.includes('wh/kg') || text.includes('lítio')) score += 6;
      if (text.includes('abs') || text.includes('motor') || text.includes('cx') || text.includes('750w') || text.includes('torque') || text.includes('gps') || text.includes('conectividade')) score += 4;
      return score;
    };

    const scored = pool.filter((a) => getTechScore(a) > 0);
    const sorted = (scored.length > 0 ? scored : pool).sort((a, b) => getTechScore(b) - getTechScore(a));
    return sorted;
  }, [feedArticles, topic02ExcludeSlugs]);

  // Artigos filtrados pelo tópico ou tag selecionada (sem repetir os destaques do topo no modo padrão)
  const displayedArticles = useMemo(() => {
    if (!feedArticles || feedArticles.length === 0) return [];
    
    // Se filtrou por tag
    if (selectedTag) {
      const lower = selectedTag.toLowerCase();
      const tagged = feedArticles.filter((art) => {
        return (
          art.category.toLowerCase() === lower ||
          (Array.isArray(art.tags) && art.tags.some((t) => t.toLowerCase() === lower))
        );
      });
      const deduplicated = tagged.filter((a) => !topFeaturedSlugs.has(a.slug));
      return deduplicated.length > 0 ? deduplicated : tagged;
    }

    // Se filtrou por tópico
    if (selectedTopicId) {
      const activeTopic = topics.find((t) => t.id === selectedTopicId);
      if (activeTopic && activeTopic.articleSlugs && activeTopic.articleSlugs.length > 0) {
        const topicFiltered = feedArticles.filter((a) => activeTopic.articleSlugs.includes(a.slug));
        const deduplicated = topicFiltered.filter((a) => !topFeaturedSlugs.has(a.slug));
        return deduplicated.length > 0 ? deduplicated : topicFiltered;
      }
    }

    // Sem filtro ativo: exibe artigos mais recentes que NÃO foram consumidos nos dois cards de destaque do topo
    const available = feedArticles.filter((a) => !topFeaturedSlugs.has(a.slug));
    return (available.length > 0 ? available : feedArticles).slice(0, 8);
  }, [feedArticles, selectedTopicId, selectedTag, topics, topFeaturedSlugs]);

  // Lista duplicada 3x para o carrossel contínuo sem fim
  const repeatedDisplayedArticles = useMemo(() => {
    if (!displayedArticles || displayedArticles.length === 0) return [];
    return [...displayedArticles, ...displayedArticles, ...displayedArticles];
  }, [displayedArticles]);

  const isInteractingArticlesRef = useRef(false);
  const isPointerDownArticlesRef = useRef(false);
  const startXArticlesRef = useRef(0);
  const scrollLeftStartArticlesRef = useRef(0);
  const hasDraggedArticlesRef = useRef(false);
  const resumeTimeoutArticlesRef = useRef<NodeJS.Timeout | null>(null);

  // Acumulador de precisão float e Delta-time
  const accumulatedScrollArticlesRef = useRef(0);
  const lastTimestampArticlesRef = useRef<number | null>(null);
  const isVisibleArticlesRef = useRef(true);

  const pauseArticlesAutoScroll = useCallback(() => {
    isInteractingArticlesRef.current = true;
    if (resumeTimeoutArticlesRef.current) {
      clearTimeout(resumeTimeoutArticlesRef.current);
    }
  }, []);

  const scheduleArticlesResume = useCallback((delay = 1800) => {
    if (resumeTimeoutArticlesRef.current) {
      clearTimeout(resumeTimeoutArticlesRef.current);
    }
    resumeTimeoutArticlesRef.current = setTimeout(() => {
      const el = articlesScrollRef.current;
      if (el) {
        accumulatedScrollArticlesRef.current = el.scrollLeft;
      }
      lastTimestampArticlesRef.current = null;
      isInteractingArticlesRef.current = false;
    }, delay);
  }, []);

  // Monitora visibilidade do elemento e da aba
  useEffect(() => {
    const el = articlesScrollRef.current;
    if (!el) return;

    accumulatedScrollArticlesRef.current = el.scrollLeft;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisibleArticlesRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          lastTimestampArticlesRef.current = null;
          accumulatedScrollArticlesRef.current = el.scrollLeft;
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleArticlesRef.current = false;
      } else {
        isVisibleArticlesRef.current = true;
        lastTimestampArticlesRef.current = null;
        if (el) accumulatedScrollArticlesRef.current = el.scrollLeft;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Motor de Auto-Scroll universal
  useEffect(() => {
    const el = articlesScrollRef.current;
    if (!el || repeatedDisplayedArticles.length === 0) return;

    let animationFrameId: number;
    const speedPixelsPerSecond = 34; // Movimento suave e consistente

    el.style.scrollBehavior = 'auto';
    accumulatedScrollArticlesRef.current = el.scrollLeft;

    const step = (timestamp: number) => {
      if (!lastTimestampArticlesRef.current) {
        lastTimestampArticlesRef.current = timestamp;
      }
      const deltaTime = Math.min((timestamp - lastTimestampArticlesRef.current) / 1000, 0.1);
      lastTimestampArticlesRef.current = timestamp;

      if (
        isVisibleArticlesRef.current &&
        !isInteractingArticlesRef.current &&
        !isPointerDownArticlesRef.current
      ) {
        const singleSetWidth = el.scrollWidth / 3;
        if (singleSetWidth > 0) {
          accumulatedScrollArticlesRef.current += speedPixelsPerSecond * deltaTime;

          if (accumulatedScrollArticlesRef.current >= singleSetWidth * 2) {
            accumulatedScrollArticlesRef.current -= singleSetWidth;
          } else if (accumulatedScrollArticlesRef.current <= 0) {
            accumulatedScrollArticlesRef.current += singleSetWidth;
          }

          el.scrollLeft = accumulatedScrollArticlesRef.current;
        }
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resumeTimeoutArticlesRef.current) {
        clearTimeout(resumeTimeoutArticlesRef.current);
      }
    };
  }, [repeatedDisplayedArticles]);

  const handleScrollArticles = () => {
    const el = articlesScrollRef.current;
    if (!el) return;
    if (isInteractingArticlesRef.current || isPointerDownArticlesRef.current) {
      accumulatedScrollArticlesRef.current = el.scrollLeft;
    }
  };

  const handlePointerDownArticles = (e: React.PointerEvent) => {
    const el = articlesScrollRef.current;
    if (!el) return;
    isPointerDownArticlesRef.current = true;
    hasDraggedArticlesRef.current = false;
    startXArticlesRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartArticlesRef.current = el.scrollLeft;
    accumulatedScrollArticlesRef.current = el.scrollLeft;
    pauseArticlesAutoScroll();
  };

  const handlePointerMoveArticles = (e: React.PointerEvent) => {
    if (!isPointerDownArticlesRef.current) return;
    const el = articlesScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXArticlesRef.current) * 1.35;
    if (Math.abs(walk) > 4) {
      hasDraggedArticlesRef.current = true;
    }
    el.scrollLeft = scrollLeftStartArticlesRef.current - walk;
    accumulatedScrollArticlesRef.current = el.scrollLeft;
  };

  const handlePointerUpOrLeaveArticles = () => {
    if (isPointerDownArticlesRef.current) {
      isPointerDownArticlesRef.current = false;
      const el = articlesScrollRef.current;
      if (el) {
        accumulatedScrollArticlesRef.current = el.scrollLeft;
      }
      scheduleArticlesResume(1800);
    }
  };

  if (!feedArticles || feedArticles.length === 0) return null;

  return (
    <section className="w-full flex flex-col gap-3" id="mobile-articles-section">
      
      {/* ----------------------------------------------------
          CABEÇALHO DA SEÇÃO DE ARTIGOS
          ---------------------------------------------------- */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-accent-gold border border-ink text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            <BookOpen className="w-4 h-4" />
          </span>
          <div className="flex flex-col">
            <h2 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight">
              Notícias, Guias &amp; Dossiês
            </h2>
          </div>
        </div>

        <Link
          href="/artigos"
          className="text-[9px] font-mono font-bold text-ink bg-amber-50 hover:bg-accent-gold px-2.5 py-1.5 rounded-xl border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1 active:scale-95 transition-all shrink-0"
        >
          <span>Ver todos ({articles.length})</span>
          <ChevronRight className="w-3 h-3 text-ink/70" />
        </Link>
      </div>

      {/* ----------------------------------------------------
          TÓPICOS TEMÁTICOS & TAGS INTELIGENTES
          ---------------------------------------------------- */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono font-black text-ink uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-primary" />
            <span>Navegue por Temas</span>
          </span>
          {(selectedTopicId || selectedTag) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTopicId(null);
                setSelectedTag(null);
              }}
              className="text-[8.5px] font-mono text-primary underline font-bold cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Linha 1: Tópicos Maiores */}
        <div
          ref={topicsScrollRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
        >
          {topics.map((t) => {
            const isSelected = selectedTopicId === t.id && !selectedTag;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTopicId(isSelected ? null : t.id);
                  setSelectedTag(null);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-left shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-ink text-white border-ink shadow-[2px_2px_0_0_rgba(245,158,11,1)]'
                    : 'bg-neutral-50 hover:bg-amber-50 text-ink border-ink/20 shadow-xs'
                }`}
              >
                <span className="text-xs">{t.icon}</span>
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono font-bold leading-tight whitespace-nowrap">
                    {t.title}
                  </span>
                  <span className={`text-[7px] font-mono ${isSelected ? 'text-amber-300' : 'text-primary'} font-bold`}>
                    {t.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Linha 2: Tags Dinâmicas Separadas */}
        {availableTags.length > 0 && (
          <div className="flex flex-col gap-1 pt-1.5 border-t border-ink/10">
            <div className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-ink/60">
              <TagIcon className="w-2.5 h-2.5 text-primary" />
              <span>Tags em alta:</span>
            </div>
            <div
              ref={tagsScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
            >
              {availableTags.map(({ tag, count }) => {
                const isTagActive = selectedTag === tag;
                const isLegis = ['Legislação', 'CONTRAN 996', 'Regras de Trânsito'].includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isTagActive) {
                        setSelectedTag(null);
                      } else {
                        setSelectedTag(tag);
                        setSelectedTopicId(null);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-lg border text-[8.5px] font-mono font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      isTagActive
                        ? 'bg-primary text-white border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                        : isLegis
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-ink'
                        : 'bg-neutral-100 text-ink/75 border-ink/20 hover:border-ink hover:bg-white'
                    }`}
                  >
                    #{tag} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <BikeScrollIndicator
          containerRef={topicsScrollRef}
          label="Deslize para ver todos os tópicos"
        />
      </div>

      {/* ----------------------------------------------------
          DESTAQUES EDITORIAIS (GRID RESPONSIVO LADO A LADO NO DESKTOP)
          ---------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {weekArticle && (
          <article className="w-full bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between group">
            {/* Capa com Proporção de Dossiê */}
            <Link href={`/artigos/${weekArticle.slug}`} className="relative w-full aspect-video bg-neutral-100 overflow-hidden block">
              <SafeImage
                src={weekArticle.coverImage}
                alt={weekArticle.title}
                fill
                priority={true}
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              
              {/* Badges Flutuantes */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className="bg-primary text-white text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>{weekArticle.editorialBadge}</span>
                </span>
                <span className="bg-ink text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md">
                  {weekArticle.category}
                </span>
              </div>

              <div className="absolute bottom-2.5 right-2.5 bg-ink text-white text-[8px] font-mono px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>{weekArticle.readingTimeMinutes} min de leitura</span>
              </div>
            </Link>

            {/* Conteúdo Textual do Dossiê */}
            <div className="p-3 sm:p-3.5 flex flex-col gap-2 flex-1 justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[8px] sm:text-[8.5px] font-mono text-ink/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatArticleDate(weekArticle.publishedAt, 'short')}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Redação TuaVia
                  </span>
                </div>

                <Link href={`/artigos/${weekArticle.slug}`}>
                  <h3 className="font-display font-black text-xs sm:text-sm text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2 min-h-[32px] sm:min-h-[36px]">
                    {weekArticle.title}
                  </h3>
                </Link>

                {/* Gancho Editorial */}
                <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-[9.5px] font-sans text-ink/90 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <p className="leading-tight line-clamp-2">
                    <strong className="font-mono text-amber-900">Destaque: </strong>
                    {weekArticle.editorialHook || weekArticle.excerpt}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-ink/10 flex items-center justify-between mt-2">
                <span className="text-[8px] sm:text-[8.5px] font-mono text-ink/60 font-medium">
                  Guia Oficial
                </span>
                <Link
                  href={`/artigos/${weekArticle.slug}`}
                  className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-mono font-bold text-ink bg-accent-gold hover:bg-accent-gold-dark px-2.5 py-1.5 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform"
                >
                  <span>Ler Artigo</span>
                  <ArrowRight className="w-3 h-3 text-ink shrink-0" />
                </Link>
              </div>
            </div>
          </article>
        )}

        {monthArticle && monthArticle.slug !== weekArticle?.slug && (
          <article className="w-full bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between group">
            {/* Capa com Proporção de Dossiê */}
            <Link href={`/artigos/${monthArticle.slug}`} className="relative w-full aspect-video bg-neutral-100 overflow-hidden block">
              <SafeImage
                src={monthArticle.coverImage}
                alt={monthArticle.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              
              {/* Badges Flutuantes */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className="bg-indigo-700 text-white text-[8px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                  {monthArticle.editorialBadge}
                </span>
                <span className="bg-ink text-white text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md">
                  {monthArticle.category}
                </span>
              </div>

              <div className="absolute bottom-2.5 right-2.5 bg-ink text-white text-[8px] font-mono px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>{monthArticle.readingTimeMinutes} min de leitura</span>
              </div>
            </Link>

            {/* Conteúdo Textual do Dossiê */}
            <div className="p-3 sm:p-3.5 flex flex-col gap-2 flex-1 justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[8px] sm:text-[8.5px] font-mono text-ink/60">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatArticleDate(monthArticle.publishedAt, 'short')}
                  </span>
                  <span>•</span>
                  <span className="text-indigo-700 font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Dossiê Especial
                  </span>
                </div>

                <Link href={`/artigos/${monthArticle.slug}`}>
                  <h3 className="font-display font-black text-xs sm:text-sm text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2 min-h-[32px] sm:min-h-[36px]">
                    {monthArticle.title}
                  </h3>
                </Link>

                {/* Gancho Editorial */}
                <div className="bg-indigo-50 border border-indigo-200 p-2 rounded-xl text-[9.5px] font-sans text-ink/90 flex items-start gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                  <p className="leading-tight line-clamp-2">
                    <strong className="font-mono text-indigo-900">Análise: </strong>
                    {monthArticle.editorialHook || monthArticle.excerpt}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-ink/10 flex items-center justify-between mt-2">
                <span className="text-[8px] sm:text-[8.5px] font-mono text-ink/60 font-medium">
                  Análise Completa
                </span>
                <Link
                  href={`/artigos/${monthArticle.slug}`}
                  className="inline-flex items-center gap-1 text-[8.5px] sm:text-[9px] font-mono font-bold text-ink bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1.5 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform"
                >
                  <span>Acessar Dossiê</span>
                  <ArrowRight className="w-3 h-3 text-ink shrink-0" />
                </Link>
              </div>
            </div>
          </article>
        )}
      </div>

      {/* ----------------------------------------------------
          CARROSSEL HORIZONTAL DE OUTROS ARTIGOS & GUIAS (LOOP INFINITO CONTÍNUO)
          ---------------------------------------------------- */}
      {displayedArticles.length > 0 && (
        <div className="w-full flex flex-col gap-2 pt-1">
          <div className="inline-flex items-center gap-1.5 self-start bg-white border-2 border-ink px-3 py-1.5 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-[9.5px] font-mono font-bold text-ink uppercase tracking-wider">
              {selectedTopicId ? 'Artigos do Tópico' : 'Mais Guias & Análises Recentes'}
            </span>
          </div>

          <div 
            ref={articlesScrollRef}
            onMouseEnter={pauseArticlesAutoScroll}
            onMouseLeave={handlePointerUpOrLeaveArticles}
            onPointerDown={handlePointerDownArticles}
            onPointerMove={handlePointerMoveArticles}
            onPointerUp={handlePointerUpOrLeaveArticles}
            onPointerCancel={handlePointerUpOrLeaveArticles}
            onScroll={handleScrollArticles}
            onWheel={pauseArticlesAutoScroll}
            className="w-full overflow-x-auto no-scrollbar pb-1 pt-0.5 cursor-grab active:cursor-grabbing select-none"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehaviorX: 'contain'
            }}
          >
            <div className="flex items-stretch gap-2.5 min-w-max">
              {repeatedDisplayedArticles.map((art, idx) => (
                <Link
                  key={`displayed-${art.slug}-${idx}`}
                  href={`/artigos/${art.slug}`}
                  onClick={(e) => {
                    if (hasDraggedArticlesRef.current) {
                      e.preventDefault();
                    }
                  }}
                  draggable={false}
                  className="w-[235px] sm:w-[245px] shrink-0 bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col group hover:border-primary active:scale-[0.98] transition-all cursor-pointer"
                >
                  {/* Miniatura */}
                  <div className="relative w-full aspect-video bg-neutral-100 overflow-hidden">
                    <SafeImage
                      src={art.coverImage}
                      alt={art.title}
                      fill
                      draggable={false}
                      className="object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                      referrerPolicy="no-referrer"
                      sizes="224px"
                    />
                    <span className="absolute top-1.5 left-1.5 bg-ink/90 text-white text-[7px] font-mono font-bold uppercase px-1.5 py-0.5 rounded">
                      {art.category}
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[7px] font-mono px-1 py-0.2 rounded">
                      {art.readingTimeMinutes} min
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1 flex-grow justify-between">
                    <h4 className="font-display font-black text-[11px] text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {art.title}
                    </h4>
                    
                    <div className="flex items-center justify-between text-[8px] font-mono text-ink/60 pt-1 border-t border-ink/10">
                      <span>{formatArticleDate(art.publishedAt, 'short')}</span>
                      <span className="text-primary font-bold flex items-center gap-0.5">
                        Ver <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Indicador em Grid Branco Neobrutalista */}
          <BikeScrollIndicator 
            containerRef={articlesScrollRef} 
            label="Deslize para ver mais artigos" 
          />
        </div>
      )}

      {/* =========================================================================
          NOVAS CATEGORIAS DE ALTO IMPACTO DO MERCADO NA HOME (LAYOUT DE GRIDS 3-NÍVEIS)
          ========================================================================= */}
      <div className="flex flex-col gap-6 pt-2">
        {/* TÓPICO 1: ECONOMIA, MOBILIDADE & CUSTO/BENEFÍCIO */}
        <AlztaTopicSection
          topicNumber="01"
          topicTitle="Economia, Mobilidade & Custo/Benefício"
          topicSubtitle="Simuladores de payback, economia real por km, substituição do segundo carro e isenção de IPVA"
          categoryName="Economia & Mobilidade"
          articles={economiaArticles}
          excludeSlugs={topFeaturedSlugs}
          onSelectTopic={() => router.push('/artigos?categoria=Economia+%26+Mobilidade')}
          accentColor="gold"
        />

        {/* TÓPICO 2: TECNOLOGIA, BATERIAS & SEGURANÇA ANTI-FURTO */}
        <AlztaTopicSection
          topicNumber="02"
          topicTitle="Tecnologia, Baterias & Segurança Anti-Furto"
          topicSubtitle="Química LFP vs NMC, motores de 750W de alto torque, BMS inteligente e rastreamento GPS"
          categoryName="Tecnologia & Baterias"
          articles={tecnologiaArticles}
          excludeSlugs={topic02ExcludeSlugs}
          onSelectTopic={() => router.push('/artigos?categoria=Tecnologia+%26+Baterias')}
          accentColor="charge"
        />
      </div>

    </section>
  );
}
