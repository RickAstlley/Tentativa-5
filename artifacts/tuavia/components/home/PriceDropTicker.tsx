'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  TrendingDown, 
  ArrowRight, 
  Flame, 
  Zap, 
  BatteryCharging, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import { getEBikePricingDetails, formatBrl } from '@/lib/ebikeUtils';
import { getGroupedEBikes } from '@/lib/ebikes';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';

interface PriceDropTickerProps {
  bikes: EBikeGrouped[];
  formatBrl?: (val: number) => string;
}

export default function PriceDropTicker({ bikes }: PriceDropTickerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [isPaused, setIsPaused] = useState(false);
  const isInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Acumulador preciso em float para evitar truncamento/arredondamento em Safari e telas Retina
  const accumulatedScrollRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const isVisibleRef = useRef(true);

  // Estados para Drag Unificado (PointerEvents)
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Encontra no máximo 10 modelos com maior economia real ou melhores ofertas auditadas
  const dealBikes = useMemo(() => {
    const source = bikes && bikes.length > 0 ? bikes : getGroupedEBikes(true);
    if (!source || source.length === 0) return [];
    
    // Mapeia todas as bikes com seus dados de precificação e desconto unificados
    const enriched = source.map((b) => {
      const pricing = getEBikePricingDetails(b);
      return {
        bike: b,
        pricing,
      };
    });

    // Filtra bikes com desconto real (economia > 0) ou mais de 1 loja monitorada
    const withSavings = enriched
      .filter((item) => item.pricing.hasDiscount || item.pricing.lojasCount > 1)
      .sort((a, b) => b.pricing.economia - a.pricing.economia || b.pricing.percentualDesconto - a.pricing.percentualDesconto);

    if (withSavings.length >= 3) {
      return withSavings.slice(0, 10);
    }

    // Se houver poucas com desconto explícito, traz as 10 principais
    return enriched.slice(0, 10);
  }, [bikes]);

  // Lista duplicada 3x para loop infinito verdadeiramente contínuo e sem sobressaltos
  const repeatedDeals = useMemo(() => {
    if (dealBikes.length === 0) return [];
    return [...dealBikes, ...dealBikes, ...dealBikes];
  }, [dealBikes]);

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
      const el = scrollContainerRef.current;
      if (el) {
        accumulatedScrollRef.current = el.scrollLeft;
      }
      lastTimestampRef.current = null;
      isInteractingRef.current = false;
      setIsPaused(false);
    }, delay);
  }, []);

  // Monitora visibilidade (IntersectionObserver + Page Visibility)
  useEffect(() => {
    const el = scrollContainerRef.current;
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

  // Motor de Auto-Scroll contínuo infinito com Delta-Time e precisão Subpixel universal
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || repeatedDeals.length === 0) return;

    let animationFrameId: number;
    const speedPixelsPerSecond = 36; // Velocidade suave e constante em qualquer taxa de Hz (60Hz, 120Hz, etc.)

    // Garante que o scrollBehavior seja 'auto' durante a interpolação contínua
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

          // Wrap-around contínuo para efeito infinito
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

    // Posterga início da rolagem em 1.2s para priorizar FCP/LCP e thread ociosa
    const startDelayTimer = setTimeout(() => {
      animationFrameId = requestAnimationFrame(step);
    }, 1200);

    return () => {
      clearTimeout(startDelayTimer);
      cancelAnimationFrame(animationFrameId);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, [repeatedDeals]);

  // Sincroniza acumulador no evento nativo de scroll (ex: usuário usando trackpad/wheel)
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (isInteractingRef.current || isPointerDownRef.current) {
      accumulatedScrollRef.current = el.scrollLeft;
    }
  };

  // Handlers Unificados com PointerEvents (Mouse, Touch, Pen)
  const handlePointerDown = (e: React.PointerEvent) => {
    const el = scrollContainerRef.current;
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
    const el = scrollContainerRef.current;
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
      const el = scrollContainerRef.current;
      if (el) {
        accumulatedScrollRef.current = el.scrollLeft;
      }
      scheduleResume(1800);
    }
  };

  // Botões de navegação rápida (Desktop e Mobile)
  const handleScrollManual = (direction: 'left' | 'right') => {
    pauseAutoScroll();
    const el = scrollContainerRef.current;
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

  if (dealBikes.length === 0) return null;

  return (
    <div 
      className="w-full bg-white border-2 border-ink rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3.5 overflow-hidden" 
      id="radar-oportunidades-ticker"
    >
      {/* Cabeçalho do Radar */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 border-b-2 border-line pb-3 w-full min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent-warm text-white border-2 border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] animate-pulse shrink-0">
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h3 className="text-xs sm:text-base font-display font-black text-ink tracking-tight leading-tight min-w-0">
                Oportunidades em Destaque &amp; Melhores Ofertas
              </h3>
              <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-mono font-bold bg-amber-100 border border-ink/20 px-2 py-0.5 rounded-full text-ink/80 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}`} />
                {isPaused ? 'Pausa manual' : 'Pedalando ofertas'}
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-ink/65 hidden sm:inline truncate">
              Até 10 ofertas selecionadas • O pedal gira conforme o avanço
            </span>
          </div>
        </div>

        {/* Controles e CTA Direto */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Botões de seta para navegação manual imediata */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleScrollManual('left')}
              title="Voltar oferta"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-100 hover:bg-white border-2 border-ink flex items-center justify-center text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollManual('right')}
              title="Avançar oferta"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-neutral-100 hover:bg-white border-2 border-ink flex items-center justify-center text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <Link
            href="/ebike?ordenar=maiorPreco"
            className="shrink-0 text-[10px] sm:text-xs font-mono font-black text-ink bg-accent-gold hover:bg-amber-400 border-2 border-ink px-2 sm:px-3 py-1.5 rounded-xl shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] sm:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Ver Todas as Ofertas</span>
            <span className="sm:hidden">Ver Todas</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-ink shrink-0" />
          </Link>
        </div>
      </div>

      {/* Carrossel de Cards com Passagem Lenta da Direita para Esquerda & Loop Infinito Contínuo (Seamless) */}
      <div className="relative w-full overflow-hidden">
        {/* Gradientes de Fade nas laterais para design premium */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-r from-white via-white/80 to-transparent z-20" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-12 bg-gradient-to-l from-white via-white/80 to-transparent z-20" />

        <div 
          ref={scrollContainerRef}
          onMouseEnter={pauseAutoScroll}
          onMouseLeave={handlePointerUpOrLeave}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrLeave}
          onPointerCancel={handlePointerUpOrLeave}
          onScroll={handleScroll}
          onWheel={pauseAutoScroll}
          className="w-full overflow-x-auto no-scrollbar pb-2 pt-1 -mx-1 px-4 cursor-grab active:cursor-grabbing select-none"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorX: 'contain'
          }}
        >
          <div className="flex items-stretch gap-3.5 min-w-max">
            {repeatedDeals.map(({ bike, pricing }, idx) => (
              <Link
                key={`ticker-deal-${bike.slug || 'bike'}-${idx}`}
                href={`/bike/${bike.slug}`}
                onClick={(e) => {
                  // Se o usuário estava arrastando, impede navegação acidental
                  if (hasDraggedRef.current) {
                    e.preventDefault();
                  }
                }}
                draggable={false}
                className="group flex flex-col w-44 sm:w-48 md:w-52 bg-neutral-50 hover:bg-white border-2 border-ink rounded-xl sm:rounded-2xl overflow-hidden shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
              >
                {/* Foto no Topo Cobrindo Toda a Largura Horizontal (16:9) */}
                <div className="relative w-full aspect-video bg-neutral-100 border-b-2 border-ink overflow-hidden group-hover:bg-neutral-50 transition-colors shrink-0 flex items-center justify-center">
                  <SafeImage
                    src={bike.imagemUrl || bike.galleryImages?.[0] || bike.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                    fallbackSrc="/placeholder-bike.png"
                    alt={`${bike.marca} ${bike.modelo}`}
                    fill
                    draggable={false}
                    className="object-contain p-1.5 group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                    sizes="(max-width: 640px) 176px, (max-width: 768px) 192px, 208px"
                  />
                  
                  {/* Tag de Categoria */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                    <span className="bg-ink text-white font-mono font-bold text-[8.5px] px-1.5 py-0.5 rounded border border-white/20">
                      {bike.usoPrincipal || 'E-Bike'}
                    </span>
                  </div>

                  {/* Tag de Desconto Real Auditado */}
                  {pricing.hasDiscount && (
                    <span className="absolute top-2 right-2 bg-accent-warm text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded-md border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] z-10">
                      -{pricing.percentualDesconto}%
                    </span>
                  )}
                </div>

                {/* Informações de Preço, Economia e Specs */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2 bg-neutral-50 group-hover:bg-white transition-colors">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">
                      {bike.marca}
                    </span>
                    <h4 className="text-xs sm:text-sm font-display font-black text-ink group-hover:text-primary transition-colors line-clamp-1 mt-0.5">
                      {bike.modelo}
                    </h4>
                  </div>

                  {/* Specs Rápidas da Publicação */}
                  <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-ink/75 bg-white border border-ink/15 rounded-md px-1.5 py-1">
                    {bike.potenciaW && (
                      <span className="flex items-center gap-0.5 font-bold">
                        <Zap className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        {bike.potenciaW}W
                      </span>
                    )}
                    {bike.autonomiaKm && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 font-bold">
                          <BatteryCharging className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          {bike.autonomiaKm}km
                        </span>
                      </>
                    )}
                  </div>

                  {/* Preço e Economia Auditada */}
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-ink/10">
                    {pricing.hasDiscount ? (
                      <div className="flex items-center justify-between text-[9px] font-mono">
                        <span className="text-stone-400 line-through">
                          De {formatBrl(pricing.precoOriginal)}
                        </span>
                        <span className="text-emerald-700 bg-emerald-100 font-bold px-1 rounded">
                          Econ. {formatBrl(pricing.economia)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[8.5px] font-mono text-ink/60">A partir de</span>
                    )}

                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-primary font-mono font-black text-sm sm:text-base">
                        {formatBrl(pricing.menorPreco)}
                      </span>
                      <span className="text-[8px] font-mono text-ink/70">
                        12x {formatBrl(pricing.parcelas12x)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Orientação de Arraste Lateral Simples e Elegante */}
      <div className="w-full flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-ink/65 px-1 pt-1 border-t border-ink/10">
        <span className="flex items-center gap-1">◀ Arraste para os lados</span>
        <span className="font-bold text-ink/80 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          Passagem contínua das ofertas
        </span>
        <span className="flex items-center gap-1">Use o mouse ou touch ▶</span>
      </div>
    </div>
  );
}
