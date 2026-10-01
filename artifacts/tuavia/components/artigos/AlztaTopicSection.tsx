'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  ArrowRight, 
  Clock, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  ShieldCheck,
  Star,
  Layers,
  BookOpen
} from 'lucide-react';
import { Article } from '@/types/article';
import { formatArticleDate, isArticleFreshUnder6Hours } from '@/lib/articles';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';

interface AlztaTopicSectionProps {
  topicNumber: string;
  topicTitle: string;
  topicSubtitle?: string;
  categoryName: string;
  articles: Article[];
  allArticlesFallback?: Article[];
  excludeSlugs?: string[] | Set<string>;
  onSelectTopic?: (topic: string) => void;
  accentColor?: 'gold' | 'green' | 'primary' | 'charge' | 'dark';
}

export default function AlztaTopicSection({
  topicNumber,
  topicTitle,
  topicSubtitle,
  categoryName,
  articles,
  allArticlesFallback = [],
  excludeSlugs,
  onSelectTopic,
  accentColor = 'gold',
}: AlztaTopicSectionProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const isInteractingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Acumulador de precisão float e Delta-time para suporte perfeito a 60/120/144Hz e Safari/iOS
  const accumulatedScrollRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);

  // Conjunto de exclusão de slugs já utilizados em seções anteriores
  const excludeSet = useMemo(() => {
    if (!excludeSlugs) return new Set<string>();
    return new Set(Array.isArray(excludeSlugs) ? excludeSlugs : Array.from(excludeSlugs));
  }, [excludeSlugs]);

  // 0. Deduplica a lista de entrada e remove slugs explicitamente excluídos
  const uniqueInputArticles = useMemo(() => {
    const seen = new Set<string>();
    const res: Article[] = [];
    (articles || []).forEach((a) => {
      if (a && a.slug && !seen.has(a.slug) && !excludeSet.has(a.slug)) {
        seen.add(a.slug);
        res.push(a);
      }
    });
    return res;
  }, [articles, excludeSet]);

  // 1. O Grande (Hero Principal da Categoria)
  const heroArticle = uniqueInputArticles.length > 0 ? uniqueInputArticles[0] : null;

  // Identificadores de artigos já usados no tópico
  const usedSlugs = new Set<string>(heroArticle ? [heroArticle.slug] : []);

  // 2. Os Médios (Cards secundários de impacto)
  let secondaryArticles = uniqueInputArticles.slice(1, 3).filter((a) => !usedSlugs.has(a.slug));
  secondaryArticles.forEach((a) => usedSlugs.add(a.slug));

  // Se houver menos de 2 secundários, preenche com artigos do mesmo tópico do fallback
  if (secondaryArticles.length < 2 && allArticlesFallback.length > 0) {
    const extraForMedium = allArticlesFallback
      .filter((a) => {
        if (categoryName !== 'Todos' && categoryName !== 'Ultimas' && isArticleFreshUnder6Hours(a.publishedAt)) {
          return false;
        }
        return (categoryName === 'Todos' || a.category === categoryName) && !usedSlugs.has(a.slug) && !excludeSet.has(a.slug);
      })
      .slice(0, 2 - secondaryArticles.length);
    extraForMedium.forEach((a) => usedSlugs.add(a.slug));
    secondaryArticles = [...secondaryArticles, ...extraForMedium];
  }

  // 3. Vários Pequenos (Cards compactos dispostos embaixo no carrossel)
  let smallArticles = uniqueInputArticles.slice(3).filter((a) => !usedSlugs.has(a.slug));
  smallArticles.forEach((a) => usedSlugs.add(a.slug));

  // Preenche pequeno carrossel apenas com artigos da mesma categoria ainda não usados
  if (smallArticles.length < 4 && allArticlesFallback.length > 0) {
    const extraForSmall = allArticlesFallback
      .filter((a) => {
        if (categoryName !== 'Todos' && categoryName !== 'Ultimas' && isArticleFreshUnder6Hours(a.publishedAt)) {
          return false;
        }
        return (categoryName === 'Todos' || a.category === categoryName) && !usedSlugs.has(a.slug) && !excludeSet.has(a.slug);
      })
      .slice(0, 6 - smallArticles.length);
    extraForSmall.forEach((a) => usedSlugs.add(a.slug));
    smallArticles = [...smallArticles, ...extraForSmall];
  }

  // Sempre triplica a base com pelo menos 4 itens para marquee contínuo matematicamente perfeito
  const repeatedArticles = useMemo(() => {
    if (!smallArticles || smallArticles.length === 0) return [];
    let base = [...smallArticles];
    let guard = 0;
    while (base.length < 4 && smallArticles.length > 0 && guard < 10) {
      base = [...base, ...smallArticles];
      guard++;
    }
    return [...base, ...base, ...base];
  }, [smallArticles]);

  // Pausa a animação temporariamente quando o usuário interage
  const pauseAutoScroll = useCallback(() => {
    isInteractingRef.current = true;
    setIsPaused(true);
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
  }, []);

  // Retoma a animação suavemente após um tempo sem interação do usuário
  const scheduleResume = useCallback((delay = 1800) => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }
    resumeTimeoutRef.current = setTimeout(() => {
      const el = carouselRef.current;
      if (el) {
        accumulatedScrollRef.current = el.scrollLeft;
      }
      lastTimestampRef.current = null;
      isInteractingRef.current = false;
      setIsPaused(false);
    }, delay);
  }, []);

  // Monitora visibilidade na viewport e aba
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    accumulatedScrollRef.current = el.scrollLeft;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          lastTimestampRef.current = null;
          accumulatedScrollRef.current = el.scrollLeft;
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
      } else {
        isVisibleRef.current = true;
        lastTimestampRef.current = null;
        if (el) accumulatedScrollRef.current = el.scrollLeft;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Motor de Auto-Scroll contínuo infinito com Delta-Time e precisão float cross-browser
  useEffect(() => {
    const el = carouselRef.current;
    if (!el || smallArticles.length < 4 || repeatedArticles.length === 0) return;

    let animationFrameId: number;
    const speedPixelsPerSecond = 34; // Velocidade suave e constante

    el.style.scrollBehavior = 'auto';
    accumulatedScrollRef.current = el.scrollLeft;

    const step = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }
      const deltaTime = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.1);
      lastTimestampRef.current = timestamp;

      if (
        isVisibleRef.current &&
        !isInteractingRef.current &&
        !isPointerDownRef.current
      ) {
        const singleSetWidth = el.scrollWidth / 3;

        if (singleSetWidth > 0) {
          accumulatedScrollRef.current += speedPixelsPerSecond * deltaTime;

          if (accumulatedScrollRef.current >= singleSetWidth * 2) {
            accumulatedScrollRef.current -= singleSetWidth;
          } else if (accumulatedScrollRef.current <= 0) {
            accumulatedScrollRef.current += singleSetWidth;
          }

          el.style.scrollBehavior = 'auto';
          el.scrollLeft = Math.round(accumulatedScrollRef.current);
        }
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [repeatedArticles, smallArticles.length]);

  if (!articles || articles.length === 0 || !heroArticle) return null;

  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    if (isInteractingRef.current || isPointerDownRef.current) {
      accumulatedScrollRef.current = el.scrollLeft;
    }
  };

  // Handlers unificados de PointerEvents (Mouse, Touch, Pen)
  const handlePointerDown = (e: React.PointerEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    isPointerDownRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartRef.current = el.scrollLeft;
    accumulatedScrollRef.current = el.scrollLeft;
    pauseAutoScroll();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    const el = carouselRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.35;
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = scrollLeftStartRef.current - walk;
    accumulatedScrollRef.current = el.scrollLeft;
  };

  const handlePointerUpOrLeave = () => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      const el = carouselRef.current;
      if (el) {
        accumulatedScrollRef.current = el.scrollLeft;
      }
      scheduleResume(1800);
    }
  };

  const handleScrollManual = (direction: 'left' | 'right') => {
    pauseAutoScroll();
    const el = carouselRef.current;
    if (el) {
      const scrollAmount = el.clientWidth * 0.75;
      el.style.scrollBehavior = 'smooth';
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(() => {
        if (el) {
          el.style.scrollBehavior = 'auto';
          accumulatedScrollRef.current = el.scrollLeft;
        }
      }, 500);
    }
    scheduleResume(2500);
  };

  const getAccentBadgeBg = () => {
    switch (accentColor) {
      case 'green':
        return 'bg-accent-verde text-white';
      case 'primary':
        return 'bg-primary text-white';
      case 'charge':
        return 'bg-accent-charge text-ink';
      case 'dark':
        return 'bg-neutral-900 text-white';
      case 'gold':
      default:
        return 'bg-accent-gold text-ink';
    }
  };

  if (!heroArticle && secondaryArticles.length === 0 && smallArticles.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-5 w-full" id={`topico-${topicNumber}`}>
      
      {/* ── CABEÇALHO DO TÓPICO EDITORIAL ── */}
      <div className="bg-white border-2 border-ink rounded-2xl p-3.5 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl border-2 border-ink flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-mono font-black text-xs sm:text-sm ${getAccentBadgeBg()}`}>
            {topicNumber}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className="font-display font-black text-base sm:text-xl md:text-2xl text-ink leading-tight truncate">
              {topicTitle}
            </h2>
            {topicSubtitle && (
              <p className="text-xs font-mono text-ink/70 hidden md:block line-clamp-1">
                {topicSubtitle}
              </p>
            )}
          </div>
        </div>

        {onSelectTopic && (
          <button
            type="button"
            onClick={() => onSelectTopic(categoryName)}
            className="bg-neutral-100 hover:bg-neutral-200 border-2 border-ink text-ink font-mono font-bold text-xs px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 min-h-[38px] self-start sm:self-auto active:scale-[0.98]"
          >
            <span>Ver Tópico Completo</span>
            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
          </button>
        )}
      </div>

      {/* ── 1. CARD GRANDE (ARTIGO DE MAIOR IMPACTO DO TÓPICO) ── */}
      {heroArticle && (
        <article className="w-full bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col lg:grid lg:grid-cols-12 group hover:border-primary transition-all">
          
          {/* Capa com Proporção de Dossiê */}
          <Link href={`/artigos/${heroArticle.slug}`} className="lg:col-span-5 relative w-full aspect-video lg:min-h-[220px] bg-neutral-100 overflow-hidden block border-b-2 lg:border-b-0 lg:border-r-2 border-ink">
            <SafeImage
              src={heroArticle.coverImage}
              alt={heroArticle.title}
              fill
              priority={true}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            
            {/* Badges Flutuantes sobre a Imagem */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap z-10">
              <span className="bg-primary text-white text-[8.5px] sm:text-[9.5px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1">
                <Star className="w-3 h-3 fill-current shrink-0 text-accent-gold" />
                <span>DESTAQUE PRINCIPAL</span>
              </span>
              <span className="bg-ink text-white text-[8.5px] sm:text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded-md">
                {heroArticle.category}
              </span>
            </div>

            <div className="absolute bottom-2.5 right-2.5 bg-ink text-white text-[8.5px] font-mono px-2 py-0.5 rounded border border-white/20 flex items-center gap-1.5 z-10">
              <Clock className="w-3 h-3 shrink-0 text-accent-gold" />
              <span>{heroArticle.readingTimeMinutes} min de leitura</span>
            </div>
          </Link>

          {/* Conteúdo Textual do Dossiê Grande */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between gap-3.5">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-mono text-ink/60">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 shrink-0 text-primary" />
                  {formatArticleDate(heroArticle.publishedAt, 'short')}
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  Redação Editorial TuaVia
                </span>
              </div>

              <Link href={`/artigos/${heroArticle.slug}`}>
                <h3 className="font-display font-black text-base sm:text-xl lg:text-2xl text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2">
                  {heroArticle.title}
                </h3>
              </Link>

              {/* Gancho / Destaque Editorial */}
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10.5px] sm:text-xs font-sans text-ink/90 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-tight">
                  <strong className="font-mono text-amber-900">Em Destaque: </strong>
                  {heroArticle.excerpt}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-ink/75 font-sans leading-relaxed line-clamp-2">
                Análise aprofundada com os critérios decisivos de compra, regulamentação técnica e dados práticos.
              </p>
            </div>

            <div className="pt-3 border-t border-ink/10 flex items-center justify-between gap-3">
              <span className="text-[9px] sm:text-[10px] font-mono text-ink/60 font-medium">
                Guia Oficial TuaVia
              </span>
              <Link
                href={`/artigos/${heroArticle.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-ink bg-accent-gold hover:bg-amber-300 px-3.5 py-1.5 rounded-xl border border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform shrink-0"
              >
                <span>Ler Artigo Completo</span>
                <ArrowRight className="w-3.5 h-3.5 text-ink shrink-0" />
              </Link>
            </div>
          </div>
        </article>
      )}

      {/* ── 2. CARDS MÉDIOS (DOSSIÊS TÉCNICOS SEGUNDÁRIOS) ── */}
      {secondaryArticles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {secondaryArticles.map((secArticle, idx) => (
            <article 
              key={`medium-${secArticle.slug}-${idx}`}
              className="w-full bg-white border-2 border-ink rounded-2xl p-3.5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between gap-3 group hover:border-primary transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[8.5px] font-mono font-black bg-indigo-700 text-white px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] uppercase">
                  DOSSIÊ TÉCNICO MÉDIO
                </span>
                <span className="text-[9px] font-mono text-ink/60 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent-gold" />
                  {secArticle.readingTimeMinutes} min de leitura
                </span>
              </div>

              <div className="flex items-start gap-3">
                <Link 
                  href={`/artigos/${secArticle.slug}`}
                  className="w-full aspect-video max-w-28 max-h-28 sm:max-w-32 sm:max-h-32 rounded-xl bg-neutral-100 border border-ink/30 relative overflow-hidden shrink-0 group block"
                >
                  <SafeImage
                    src={secArticle.coverImage}
                    alt={secArticle.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    sizes="128px"
                  />
                  <div className="absolute top-1 left-1">
                    <span className="text-[7.5px] font-mono font-bold bg-white/90 text-ink border border-ink/40 px-1.5 py-0.2 rounded">
                      {secArticle.category}
                    </span>
                  </div>
                </Link>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <Link href={`/artigos/${secArticle.slug}`}>
                    <h4 className="font-display font-black text-xs sm:text-sm text-ink tracking-tight line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {secArticle.title}
                    </h4>
                  </Link>
                  <p className="text-[10px] sm:text-[11px] font-sans text-ink/75 line-clamp-2 leading-relaxed">
                    {secArticle.excerpt}
                  </p>
                </div>
              </div>

              <Link
                href={`/artigos/${secArticle.slug}`}
                className="w-full bg-neutral-100 hover:bg-neutral-200 text-ink font-mono font-bold text-[10px] py-2 px-3 rounded-xl border border-ink text-center flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <span>Acessar Dossiê do Mês</span>
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
              </Link>
            </article>
          ))}
        </div>
      )}

      {/* ── 3. CARROSSEL HORIZONTAL DE MATÉRIAS PEQUENAS COM SCROLL ── */}
      {smallArticles.length > 0 && (
        <div className="w-full flex flex-col gap-2 pt-1">
          
          {/* Header da Faixa de Cards Pequenos */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 bg-white border-2 border-ink px-3 py-1.5 rounded-full shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="text-[9.5px] font-mono font-bold text-ink uppercase tracking-wider">
                Mais Guias &amp; Análises de {categoryName}
              </span>
            </div>

            {/* Setas do Carrossel Pequeno */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleScrollManual('left')}
                className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center text-ink cursor-pointer active:scale-95 transition-all"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => handleScrollManual('right')}
                className="w-7 h-7 rounded-lg bg-white hover:bg-neutral-100 border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center text-ink cursor-pointer active:scale-95 transition-all"
                aria-label="Próximo"
              >
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Trilho Deslizante com Cards Pequenos (Loop Infinito Contínuo Sem Fim) */}
          <div 
            ref={carouselRef}
            onMouseEnter={pauseAutoScroll}
            onMouseLeave={handlePointerUpOrLeave}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUpOrLeave}
            onPointerCancel={handlePointerUpOrLeave}
            onScroll={handleScroll}
            onWheel={pauseAutoScroll}
            className="w-full overflow-x-auto no-scrollbar pb-1.5 pt-0.5 cursor-grab active:cursor-grabbing select-none"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehaviorX: 'contain'
            }}
          >
            <div className="flex items-stretch gap-2.5 min-w-max">
              {repeatedArticles.map((art, idx) => (
                <Link
                  key={`small-${art.slug}-${idx}`}
                  href={`/artigos/${art.slug}`}
                  onClick={(e) => {
                    if (hasDraggedRef.current) {
                      e.preventDefault();
                    }
                  }}
                  draggable={false}
                  className="w-56 sm:w-60 shrink-0 bg-white border-2 border-ink rounded-xl overflow-hidden shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col group hover:border-primary active:scale-[0.98] transition-all cursor-pointer"
                >
                  {/* Miniatura do Card Pequeno */}
                  <div className="relative w-full h-24 bg-neutral-100 overflow-hidden">
                    <SafeImage
                      src={art.coverImage}
                      alt={art.title}
                      fill
                      draggable={false}
                      className="object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                      referrerPolicy="no-referrer"
                      sizes="240px"
                    />
                    <span className="absolute top-1.5 left-1.5 bg-ink/90 text-white text-[7px] font-mono font-bold uppercase px-1.5 py-0.5 rounded">
                      {art.category}
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[7px] font-mono px-1 py-0.2 rounded">
                      {art.readingTimeMinutes} min
                    </span>
                  </div>

                  {/* Informações do Card Pequeno */}
                  <div className="p-2.5 flex flex-col gap-1 flex-grow justify-between">
                    <h4 className="font-display font-black text-[11px] sm:text-xs text-ink group-hover:text-primary transition-colors leading-snug line-clamp-2">
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
            containerRef={carouselRef} 
            label="Deslize para ver mais matérias deste tópico" 
          />
        </div>
      )}

    </section>
  );
}
