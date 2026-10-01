'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  ChevronRight, 
  ChevronLeft,
  Swords, 
  Scale 
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';
import { getGroupedEBikes } from '@/lib/ebikes';
import { HomeAICurationData } from '@/types/homeCuration';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';

interface MobileVersusCarouselProps {
  bikes: EBikeGrouped[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
}

export default function MobileVersusCarousel({ bikes, curation, formatBrl }: MobileVersusCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const accumulatedScrollRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Gera duelos com base nas bikes disponíveis e na curadoria, com garantia estrita de unicidade
  const duels = useMemo(() => {
    const sourceBikes = (bikes && bikes.length >= 2) ? bikes : getGroupedEBikes(true);
    if (!sourceBikes || sourceBikes.length < 2) return [];

    const validBikes = sourceBikes.filter((b) => b && b.slug && b.modelo);
    if (validBikes.length < 2) return [];

    const getMatchupKey = (slugA: string, slugB: string) => [slugA, slugB].sort().join(':::');

    const seenMatchups = new Set<string>();
    const seenBikeSlugs = new Set<string>();
    const resultDuels: Array<{
      id: string;
      tag: string;
      bikeA: EBikeGrouped;
      bikeB: EBikeGrouped;
      destaque: string;
    }> = [];

    // 1. Processa a curadoria se existir, filtrando rigorosamente qualquer confronto duplicado ou bike repetida
    if (curation?.bikes?.duels && curation.bikes.duels.length > 0) {
      for (const d of curation.bikes.duels) {
        if (!d.bikeASlug || !d.bikeBSlug) continue;
        if (d.bikeASlug === d.bikeBSlug) continue; // Nunca a mesma bike contra ela mesma!

        const mKey = getMatchupKey(d.bikeASlug, d.bikeBSlug);
        if (seenMatchups.has(mKey)) continue; // Nunca repete o mesmo confronto!

        const bikeA = validBikes.find((b) => b.slug === d.bikeASlug);
        const bikeB = validBikes.find((b) => b.slug === d.bikeBSlug);
        if (!bikeA || !bikeB || bikeA.slug === bikeB.slug) continue;

        // Se temos bikes suficientes não usadas no catálogo, evitamos reutilizar bikes repetidas
        const bothUnused = !seenBikeSlugs.has(bikeA.slug) && !seenBikeSlugs.has(bikeB.slug);
        const canReuse = validBikes.length < (resultDuels.length + 1) * 2;

        if (bothUnused || canReuse) {
          seenMatchups.add(mKey);
          seenBikeSlugs.add(bikeA.slug);
          seenBikeSlugs.add(bikeB.slug);
          resultDuels.push({
            id: d.id || `curated-duel-${resultDuels.length + 1}`,
            tag: d.tag || 'Confronto 1v1',
            bikeA,
            bikeB,
            destaque: d.destaque || 'Comparativo Direto',
          });
        }
      }
    }

    // 2. Se temos menos de 3 duelos válidos e não repetidos, geramos confrontos balanceados e diversificados
    const targetCount = Math.min(3, Math.max(1, Math.floor(validBikes.length / 2)));

    // Helper para buscar par ótimo que nunca duelou e prioriza bikes nunca exibidas
    const findBestPair = (
      filterA?: ((b: EBikeGrouped) => boolean) | null,
      filterB?: ((b: EBikeGrouped) => boolean) | null
    ): [EBikeGrouped, EBikeGrouped] | null => {
      const poolA = filterA ? validBikes.filter(filterA) : validBikes;
      const unusedPoolA = poolA.filter((b) => !seenBikeSlugs.has(b.slug));
      const candidatesA = unusedPoolA.length > 0 ? unusedPoolA : poolA;

      for (const candA of candidatesA) {
        const poolB = filterB ? validBikes.filter(filterB) : validBikes;
        const candidatesB = poolB
          .filter((b) => b.slug !== candA.slug)
          .sort((a, b) => {
            const aUsed = seenBikeSlugs.has(a.slug) ? 1 : 0;
            const bUsed = seenBikeSlugs.has(b.slug) ? 1 : 0;
            return aUsed - bUsed;
          });

        for (const candB of candidatesB) {
          const mKey = getMatchupKey(candA.slug, candB.slug);
          if (!seenMatchups.has(mKey)) {
            return [candA, candB];
          }
        }
      }
      return null;
    };

    // Tentativa Duelo 1: Entrada / Custo-benefício (bikes mais acessíveis)
    if (resultDuels.length === 0) {
      const sortedByPrice = [...validBikes].sort((a, b) => (a.menorPreco || 0) - (b.menorPreco || 0));
      const pair = findBestPair(
        (b) => sortedByPrice.slice(0, 4).some((x) => x.slug === b.slug),
        (b) => sortedByPrice.slice(0, 4).some((x) => x.slug === b.slug)
      ) || findBestPair();

      if (pair) {
        const [bikeA, bikeB] = pair;
        const mKey = getMatchupKey(bikeA.slug, bikeB.slug);
        seenMatchups.add(mKey);
        seenBikeSlugs.add(bikeA.slug);
        seenBikeSlugs.add(bikeB.slug);
        resultDuels.push({
          id: 'duel-urbano-entrada',
          tag: 'Duelo Urbano Entrada',
          bikeA,
          bikeB,
          destaque: 'Autonomia vs Preço',
        });
      }
    }

    // Tentativa Duelo 2: Dobrável ou Compacta vs Urbana Intermediária
    if (resultDuels.length < 2) {
      const isFoldableOrLight = (b: EBikeGrouped): boolean => 
        Boolean(
          b.usoPrincipal?.toLowerCase().includes('dobr') ||
          b.modelo.toLowerCase().includes('dobr') ||
          b.modelo.toLowerCase().includes('pliage') ||
          (typeof b.pesoKg === 'number' && b.pesoKg > 0 && b.pesoKg <= 22)
        );

      const pair = findBestPair(
        isFoldableOrLight,
        (b) => !isFoldableOrLight(b)
      ) || findBestPair();

      if (pair) {
        const [bikeA, bikeB] = pair;
        const mKey = getMatchupKey(bikeA.slug, bikeB.slug);
        seenMatchups.add(mKey);
        seenBikeSlugs.add(bikeA.slug);
        seenBikeSlugs.add(bikeB.slug);
        resultDuels.push({
          id: 'duel-dobravel-portabilidade',
          tag: 'Confronto Dobráveis & Compactas',
          bikeA,
          bikeB,
          destaque: 'Portabilidade vs Conforto',
        });
      }
    }

    // Tentativa Duelo 3: Potência / Subidas (maior potência)
    if (resultDuels.length < targetCount) {
      const isHighPower = (b: EBikeGrouped) => (b.potenciaW || 0) >= 350;
      const pair = findBestPair(
        isHighPower,
        (b) => (b.potenciaW || 0) <= 350 || (b.autonomiaKm || 0) >= 45
      ) || findBestPair();

      if (pair) {
        const [bikeA, bikeB] = pair;
        const mKey = getMatchupKey(bikeA.slug, bikeB.slug);
        seenMatchups.add(mKey);
        seenBikeSlugs.add(bikeA.slug);
        seenBikeSlugs.add(bikeB.slug);
        
        const potA = bikeA.potenciaW || 350;
        const potB = bikeB.potenciaW || 250;
        const destaquePot = potA !== potB ? `${potA}W vs ${potB}W Ladeiras` : 'Potência & Autonomia';

        resultDuels.push({
          id: 'duel-potencia-ladeiras',
          tag: 'Duelo de Potência',
          bikeA,
          bikeB,
          destaque: destaquePot,
        });
      }
    }

    // Se ainda houver slots para atingir targetCount, preenche com combinações inéditas
    while (resultDuels.length < targetCount) {
      const pair = findBestPair();
      if (!pair) break; // Sem mais combinações possíveis sem repetir duelo
      const [bikeA, bikeB] = pair;
      const mKey = getMatchupKey(bikeA.slug, bikeB.slug);
      seenMatchups.add(mKey);
      seenBikeSlugs.add(bikeA.slug);
      seenBikeSlugs.add(bikeB.slug);
      resultDuels.push({
        id: `duel-matchup-${resultDuels.length + 1}`,
        tag: 'Confronto Direto',
        bikeA,
        bikeB,
        destaque: 'Custo por Km Rodado',
      });
    }

    return resultDuels;
  }, [bikes, curation]);

  // Monitora capacidade de rolagem para botões manuais
  const checkScrollLimits = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    checkScrollLimits();
    el.addEventListener('scroll', checkScrollLimits, { passive: true });
    window.addEventListener('resize', checkScrollLimits);

    return () => {
      el.removeEventListener('scroll', checkScrollLimits);
      window.removeEventListener('resize', checkScrollLimits);
    };
  }, [duels]);

  // Avanço automático discreto e suave por cards (a cada 6s sem interação)
  useEffect(() => {
    if (isPaused || duels.length <= 1) return;

    const interval = setInterval(() => {
      const el = carouselRef.current;
      if (!el) return;

      const cardWidth = 285; // largura do card padronizado + gap
      const maxScroll = el.scrollWidth - el.clientWidth;
      
      if (el.scrollLeft >= maxScroll - 20) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [isPaused, duels.length]);

  // Controles Manuais de Rolagem por Card
  const handleScrollManual = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;

    setIsPaused(true);
    const cardWidth = 285;
    el.scrollBy({
      left: direction === 'left' ? -cardWidth : cardWidth,
      behavior: 'smooth'
    });

    // Retoma o timer após 6 segundos de inatividade
    setTimeout(() => {
      setIsPaused(false);
    }, 6000);
  };

  if (duels.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2.5" id="mobile-versus-carousel">
      
      {/* CABEÇALHO DO BLOCO COM CONTROLES MANUAIS E INDICADORES */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-2.5 sm:p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1.5 rounded-xl bg-accent-gold border border-ink text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            <Swords className="w-4 h-4 text-ink" />
          </span>
          <div className="flex flex-col min-w-0">
            <h2 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight truncate">
              Duelos da Semana
            </h2>
            <span className="text-[9px] font-mono text-ink/60 hidden xs:inline">
              Confrontos diretos 1v1
            </span>
          </div>
        </div>

        {/* Botões de Controle Manual (Esquerda / Direita / Criar Duelo) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleScrollManual('left')}
            disabled={!canScrollLeft}
            aria-label="Rolar duelo para a esquerda"
            className="w-7 h-7 rounded-xl bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-neutral-100 text-ink border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleScrollManual('right')}
            disabled={!canScrollRight}
            aria-label="Rolar duelo para a direita"
            className="w-7 h-7 rounded-xl bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-neutral-100 text-ink border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <Link
            href="/comparar"
            className="text-[9px] font-mono font-bold text-ink bg-amber-100 hover:bg-accent-gold px-2 py-1.5 rounded-xl border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-0.5 active:scale-95 transition-all shrink-0"
          >
            <span>Criar</span>
            <ChevronRight className="w-3 h-3 text-ink/70" />
          </Link>
        </div>
      </div>

      {/* CARROSSEL HORIZONTAL DE DUELOS (VS) COM SCROLL SNAP DISCRETO */}
      <div 
        ref={carouselRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => {
          setTimeout(() => setIsPaused(false), 5000);
        }}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-1 pt-0.5 select-none snap-x snap-mandatory px-0.5"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          scrollBehavior: 'smooth'
        }}
      >
        {duels.map((duel, idx) => {
          if (!duel?.bikeA?.slug || !duel?.bikeB?.slug) return null;
          return (
          <div
            key={`duel-card-${duel.id || 'duel'}-${idx}`}
            className="w-[270px] sm:w-[285px] md:w-[295px] shrink-0 bg-white border-2 border-ink rounded-2xl p-2.5 sm:p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col justify-between gap-2.5 relative group hover:border-primary transition-colors snap-start"
          >
            {/* Tag Superior */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[8px] sm:text-[8.5px] font-mono font-bold text-ink bg-amber-100 border border-ink px-2 py-0.5 rounded-lg shadow-[1px_1px_0_0_rgba(46,43,39,1)] truncate max-w-[145px]">
                {duel.tag || 'Confronto 1v1'}
              </span>
              <span className="text-[8px] sm:text-[8.5px] font-mono text-ink/70 font-semibold truncate text-right">
                {duel.destaque || 'Comparativo'}
              </span>
            </div>

            {/* Duelo de Bikes (A VS B) */}
            <div className="flex items-center justify-between gap-2 py-1">
              {/* Bike A */}
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div className="w-full aspect-[16/10] relative rounded-xl border border-ink/20 bg-gradient-to-br from-white to-neutral-100 p-1 mb-1.5 overflow-hidden shadow-xs flex items-center justify-center">
                  <SafeImage
                    src={duel.bikeA.imagemUrl || duel.bikeA.galleryImages?.[0] || duel.bikeA.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                    fallbackSrc="/placeholder-bike.png"
                    alt={duel.bikeA.modelo || 'E-bike A'}
                    fill
                    className="object-contain p-0.5"
                    referrerPolicy="no-referrer"
                    sizes="120px"
                  />
                </div>
                <span className="text-[8.5px] font-mono font-bold text-ink/60 uppercase tracking-wide truncate w-full">
                  {duel.bikeA.marca || 'Marca'}
                </span>
                <span className="text-[11px] leading-[14px] font-display font-black text-ink line-clamp-2 h-[28px] w-full mt-0.5 px-0.5">
                  {duel.bikeA.modelo || 'Modelo'}
                </span>
                <span className="text-[11px] font-mono text-primary font-black mt-1">
                  {formatBrl(duel.bikeA.menorPreco || 0)}
                </span>
              </div>

              {/* Insígnia VS Centralizada */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-ink text-accent-gold font-mono font-black text-[9px] sm:text-[10px] flex items-center justify-center shrink-0 border-2 border-accent-gold shadow-[1.5px_1.5px_0_0_rgba(46,43,39,0.3)] my-auto -mx-1 z-10">
                VS
              </div>

              {/* Bike B */}
              <div className="flex flex-col items-center text-center flex-1 min-w-0">
                <div className="w-full aspect-[16/10] relative rounded-xl border border-ink/20 bg-gradient-to-br from-white to-neutral-100 p-1 mb-1.5 overflow-hidden shadow-xs flex items-center justify-center">
                  <SafeImage
                    src={duel.bikeB.imagemUrl || duel.bikeB.galleryImages?.[0] || duel.bikeB.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                    fallbackSrc="/placeholder-bike.png"
                    alt={duel.bikeB.modelo || 'E-bike B'}
                    fill
                    className="object-contain p-0.5"
                    referrerPolicy="no-referrer"
                    sizes="120px"
                  />
                </div>
                <span className="text-[8.5px] font-mono font-bold text-ink/60 uppercase tracking-wide truncate w-full">
                  {duel.bikeB.marca || 'Marca'}
                </span>
                <span className="text-[11px] leading-[14px] font-display font-black text-ink line-clamp-2 h-[28px] w-full mt-0.5 px-0.5">
                  {duel.bikeB.modelo || 'Modelo'}
                </span>
                <span className="text-[11px] font-mono text-primary font-black mt-1">
                  {formatBrl(duel.bikeB.menorPreco || 0)}
                </span>
              </div>
            </div>

            {/* Botão de Ação do Duelo */}
            <Link
              href={`/arena?bike1=${encodeURIComponent(duel.bikeA.slug || '')}&bike2=${encodeURIComponent(duel.bikeB.slug || '')}`}
              className="w-full min-h-[38px] bg-neutral-50 hover:bg-amber-100 text-ink text-[10px] sm:text-[10.5px] font-mono font-bold py-2 px-2.5 rounded-xl border border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-1.5 active:scale-98 transition-all"
            >
              <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Ver na Arena 1v1</span>
              <ChevronRight className="w-3 h-3 text-ink/60 shrink-0" />
            </Link>
          </div>
        );})}
      </div>

      {/* Indicador de rolagem com bicicleta */}
      <BikeScrollIndicator 
        containerRef={carouselRef} 
        label="Deslize ou use os botões para comparar outros duelos" 
      />

    </div>
  );
}
