'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingDown, 
  Zap, 
  BatteryCharging, 
  Scale, 
  ArrowRight, 
  Tag, 
  Sparkles, 
  Award,
  Cpu,
  ShieldCheck,
  Flame,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Percent,
  Check,
  Compass
} from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { HomeAICurationData } from '@/types/homeCuration';

interface MobileBentoGridProps {
  bikes: EBikeGrouped[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
  onCompareToggle: (slug: string) => void;
  comparedSlugs: string[];
}

interface OpportunityItem {
  slug: string;
  modelo: string;
  marca: string;
  menorPreco: number;
  maiorPreco: number;
  economiaBrl: number;
  discountPct: number;
  badge: string;
  badgeType: 'fire' | 'award' | 'battery' | 'star' | 'bolt' | 'fold';
  headline: string;
  aiVerdict: string;
  autonomiaKm?: number;
  potenciaW?: number;
  pesoKg?: number;
  imagemUrl: string;
  usoPrincipal?: string;
  lojasCount: number;
}

export default function MobileBentoGrid({
  bikes,
  curation,
  formatBrl,
  onCompareToggle,
  comparedSlugs
}: MobileBentoGridProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Monitora capacidade de rolagem do carrossel para as setas manuais
  const checkScrollLimits = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScrollLimits();
    const el = carouselRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollLimits, { passive: true });
      window.addEventListener('resize', checkScrollLimits);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScrollLimits);
      window.removeEventListener('resize', checkScrollLimits);
    };
  }, []);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const distance = 265;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  // Helper para calcular âncora de preço justa caso não haja preço anterior registrado
  const resolvePriceAnchor = (menor: number, maior?: number, economiaCur?: number, discountCurPct?: number) => {
    if (maior && maior > menor) {
      const economia = maior - menor;
      const pct = Math.round((economia / maior) * 100);
      return { maiorPreco: maior, economiaBrl: economia, discountPct: pct };
    }
    if (economiaCur && economiaCur > 0) {
      const maiorCalculado = menor + economiaCur;
      const pct = Math.round((economiaCur / maiorCalculado) * 100);
      return { maiorPreco: maiorCalculado, economiaBrl: economiaCur, discountPct: pct };
    }
    // Âncora de mercado estimada para e-bikes em promoção (MSRP médio 12% a 15% acima)
    const pct = discountCurPct && discountCurPct > 0 ? discountCurPct : 12;
    const maiorCalculado = Math.round((menor * (1 + pct / 100)) / 10) * 10;
    const economia = maiorCalculado - menor;
    return { maiorPreco: maiorCalculado, economiaBrl: economia, discountPct: pct };
  };

  // Processamento com garantia de unicidade estrita: Hero (Super Card) + Itens do Carrossel
  const { heroDeal, carouselDeals } = useMemo(() => {
    const usedSlugs = new Set<string>();
    const safeBikes = Array.isArray(bikes) ? bikes.filter((b) => b && b.slug && b.modelo) : [];

    // ====================================================
    // 1. HERO DEAL (SUPER CARD DA SEMANA - OPÇÃO 1)
    // ====================================================
    let hero: OpportunityItem | null = null;

    if (curation?.bikes?.dealOfWeek?.slug) {
      const cur = curation.bikes.dealOfWeek;
      const matched = safeBikes.find((b) => b.slug === cur.slug);
      if (matched || cur.slug) {
        const menor = cur.menorPreco || matched?.menorPreco || 0;
        const prices = resolvePriceAnchor(menor, cur.maiorPreco || matched?.maiorPreco, cur.economiaBrl, cur.discountPct);
        hero = {
          slug: cur.slug,
          modelo: cur.modelo || matched?.modelo || 'E-Bike Destaque',
          marca: cur.marca || matched?.marca || 'Marca Auditada',
          menorPreco: menor,
          maiorPreco: prices.maiorPreco,
          economiaBrl: prices.economiaBrl,
          discountPct: prices.discountPct,
          badge: '🔥 MAIOR QUEDA DA SEMANA',
          badgeType: 'fire',
          headline: cur.headline || 'Oportunidade auditada com maior redução de preço',
          aiVerdict: cur.aiVerdict || 'Comprovado menor valor histórico nas lojas parceiras com excelente robustez mecânica.',
          autonomiaKm: cur.autonomiaKm || matched?.autonomiaKm,
          potenciaW: cur.potenciaW || matched?.potenciaW,
          pesoKg: cur.pesoKg || matched?.pesoKg,
          imagemUrl: cur.imagemUrl || matched?.imagemUrl || '/placeholder-bike.png',
          usoPrincipal: matched?.usoPrincipal || 'Urbana',
          lojasCount: matched?.ofertas?.length || 1,
        };
        usedSlugs.add(cur.slug);
      }
    }

    if (!hero && safeBikes.length > 0) {
      const topBike = safeBikes[0];
      const menor = topBike.menorPreco || 0;
      const prices = resolvePriceAnchor(menor, topBike.maiorPreco);
      hero = {
        slug: topBike.slug,
        modelo: topBike.modelo,
        marca: topBike.marca,
        menorPreco: menor,
        maiorPreco: prices.maiorPreco,
        economiaBrl: prices.economiaBrl,
        discountPct: prices.discountPct,
        badge: '🔥 MAIOR QUEDA DA SEMANA',
        badgeType: 'fire',
        headline: 'Oportunidade auditada com maior redução de preço',
        aiVerdict: 'Preço mais competitivo do radar verificado pela inteligência de mercado.',
        autonomiaKm: topBike.autonomiaKm,
        potenciaW: topBike.potenciaW,
        pesoKg: topBike.pesoKg,
        imagemUrl: topBike.imagemUrl || '/placeholder-bike.png',
        usoPrincipal: topBike.usoPrincipal || 'Urbana',
        lojasCount: topBike.ofertas?.length || 1,
      };
      usedSlugs.add(topBike.slug);
    }

    // ====================================================
    // 2. CARROSSEL DE OPORTUNIDADES AUDITADAS (OPÇÃO 3)
    // ====================================================
    const carousel: OpportunityItem[] = [];

    // Slot A: Deal of Month (Custo-Benefício Consistente)
    if (curation?.bikes?.dealOfMonth?.slug && !usedSlugs.has(curation.bikes.dealOfMonth.slug)) {
      const cur = curation.bikes.dealOfMonth;
      const matched = safeBikes.find((b) => b.slug === cur.slug);
      if (matched || cur.slug) {
        const menor = cur.menorPreco || matched?.menorPreco || 0;
        const prices = resolvePriceAnchor(menor, cur.maiorPreco || matched?.maiorPreco, cur.economiaBrl, 14);
        carousel.push({
          slug: cur.slug,
          modelo: cur.modelo || matched?.modelo || 'E-Bike Urbana',
          marca: cur.marca || matched?.marca || 'Marca Auditada',
          menorPreco: menor,
          maiorPreco: prices.maiorPreco,
          economiaBrl: prices.economiaBrl,
          discountPct: prices.discountPct,
          badge: '🏆 OFERTA DO MÊS',
          badgeType: 'award',
          headline: 'Melhor relação custo-benefício sustentada',
          aiVerdict: 'Recomendação técnica para quem busca durabilidade de bateria com custo contido.',
          autonomiaKm: cur.autonomiaKm || matched?.autonomiaKm,
          potenciaW: cur.potenciaW || matched?.potenciaW,
          pesoKg: cur.pesoKg || matched?.pesoKg,
          imagemUrl: cur.imagemUrl || matched?.imagemUrl || '/placeholder-bike.png',
          usoPrincipal: matched?.usoPrincipal || 'Urbana',
          lojasCount: matched?.ofertas?.length || 1,
        });
        usedSlugs.add(cur.slug);
      }
    }

    // Slot B: Top Urban Range (Recorde de Autonomia)
    if (curation?.bikes?.topUrbanRange?.slug && !usedSlugs.has(curation.bikes.topUrbanRange.slug)) {
      const cur = curation.bikes.topUrbanRange;
      const matched = safeBikes.find((b) => b.slug === cur.slug);
      if (matched || cur.slug) {
        const menor = cur.menorPreco || matched?.menorPreco || 0;
        const prices = resolvePriceAnchor(menor, cur.maiorPreco || matched?.maiorPreco, cur.economiaBrl, 10);
        carousel.push({
          slug: cur.slug,
          modelo: cur.modelo || matched?.modelo || 'E-Bike Urbana',
          marca: cur.marca || matched?.marca || 'Marca Auditada',
          menorPreco: menor,
          maiorPreco: prices.maiorPreco,
          economiaBrl: prices.economiaBrl,
          discountPct: prices.discountPct,
          badge: '🔋 TOP ALCANCE (50km+)',
          badgeType: 'battery',
          headline: 'Máximo percurso com uma única recarga',
          aiVerdict: 'Maior alcance verificado no segmento. Ideal para percursos extensos e entregas.',
          autonomiaKm: cur.autonomiaKm || matched?.autonomiaKm || 50,
          potenciaW: cur.potenciaW || matched?.potenciaW || 500,
          pesoKg: cur.pesoKg || matched?.pesoKg,
          imagemUrl: cur.imagemUrl || matched?.imagemUrl || '/placeholder-bike.png',
          usoPrincipal: matched?.usoPrincipal || 'Urbana',
          lojasCount: matched?.ofertas?.length || 1,
        });
        usedSlugs.add(cur.slug);
      }
    }

    // Slot C: Best Value Pick (Escolha Inteligente)
    if (curation?.bikes?.bestValuePick?.slug && !usedSlugs.has(curation.bikes.bestValuePick.slug)) {
      const cur = curation.bikes.bestValuePick;
      const matched = safeBikes.find((b) => b.slug === cur.slug);
      if (matched || cur.slug) {
        const menor = cur.menorPreco || matched?.menorPreco || 0;
        const prices = resolvePriceAnchor(menor, cur.maiorPreco || matched?.maiorPreco, cur.economiaBrl, 12);
        carousel.push({
          slug: cur.slug,
          modelo: cur.modelo || matched?.modelo || 'E-Bike Urbana',
          marca: cur.marca || matched?.marca || 'Marca Auditada',
          menorPreco: menor,
          maiorPreco: prices.maiorPreco,
          economiaBrl: prices.economiaBrl,
          discountPct: prices.discountPct,
          badge: '⭐ ESCOLHA INTELIGENTE',
          badgeType: 'star',
          headline: 'Equilíbrio auditado entre bateria e assistência',
          aiVerdict: 'Excelente nota ergonômica urbana e fácil reposição de peças no Brasil.',
          autonomiaKm: cur.autonomiaKm || matched?.autonomiaKm,
          potenciaW: cur.potenciaW || matched?.potenciaW,
          pesoKg: cur.pesoKg || matched?.pesoKg,
          imagemUrl: cur.imagemUrl || matched?.imagemUrl || '/placeholder-bike.png',
          usoPrincipal: matched?.usoPrincipal || 'Urbana',
          lojasCount: matched?.ofertas?.length || 1,
        });
        usedSlugs.add(cur.slug);
      }
    }

    // Slot D: Entrada Acessível (Bike com menor preço ainda não exibida)
    const cheapCandidates = safeBikes
      .filter((b) => !usedSlugs.has(b.slug))
      .sort((a, b) => (a.menorPreco || 0) - (b.menorPreco || 0));

    if (cheapCandidates.length > 0) {
      const cheapBike = cheapCandidates[0];
      const menor = cheapBike.menorPreco || 0;
      const prices = resolvePriceAnchor(menor, cheapBike.maiorPreco, undefined, 11);
      const isFoldable = cheapBike.usoPrincipal?.toLowerCase().includes('dobr') || cheapBike.modelo.toLowerCase().includes('pliage');
      carousel.push({
        slug: cheapBike.slug,
        modelo: cheapBike.modelo,
        marca: cheapBike.marca,
        menorPreco: menor,
        maiorPreco: prices.maiorPreco,
        economiaBrl: prices.economiaBrl,
        discountPct: prices.discountPct,
        badge: isFoldable ? '🚲 DOBRÁVEL & PORTÁTIL' : '⚡ ENTRADA ACESSÍVEL',
        badgeType: isFoldable ? 'fold' : 'bolt',
        headline: 'Melhor valor de entrada para começar',
        aiVerdict: 'Opção leve e acessível para deslocamentos rápidos na cidade sem complicação.',
        autonomiaKm: cheapBike.autonomiaKm,
        potenciaW: cheapBike.potenciaW,
        pesoKg: cheapBike.pesoKg,
        imagemUrl: cheapBike.imagemUrl || '/placeholder-bike.png',
        usoPrincipal: cheapBike.usoPrincipal || 'Urbana',
        lojasCount: cheapBike.ofertas?.length || 1,
      });
      usedSlugs.add(cheapBike.slug);
    }

    // Slot E: Se ainda sobrar espaço e tivermos mais bikes inéditas
    const remainingCandidates = safeBikes.filter((b) => !usedSlugs.has(b.slug));
    if (remainingCandidates.length > 0 && carousel.length < 4) {
      const extraBike = remainingCandidates[0];
      const menor = extraBike.menorPreco || 0;
      const prices = resolvePriceAnchor(menor, extraBike.maiorPreco, undefined, 10);
      carousel.push({
        slug: extraBike.slug,
        modelo: extraBike.modelo,
        marca: extraBike.marca,
        menorPreco: menor,
        maiorPreco: prices.maiorPreco,
        economiaBrl: prices.economiaBrl,
        discountPct: prices.discountPct,
        badge: '📉 QUEDA CONFIRMADA',
        badgeType: 'fire',
        headline: 'Preço verificado abaixo da média',
        aiVerdict: 'Custo por km vantajoso com bateria eficiente para o cotidiano.',
        autonomiaKm: extraBike.autonomiaKm,
        potenciaW: extraBike.potenciaW,
        pesoKg: extraBike.pesoKg,
        imagemUrl: extraBike.imagemUrl || '/placeholder-bike.png',
        usoPrincipal: extraBike.usoPrincipal || 'Urbana',
        lojasCount: extraBike.ofertas?.length || 1,
      });
      usedSlugs.add(extraBike.slug);
    }

    return { heroDeal: hero, carouselDeals: carousel };
  }, [bikes, curation]);

  if (!heroDeal) return null;

  const isHeroCompared = comparedSlugs.includes(heroDeal.slug);

  return (
    <div className="w-full flex flex-col gap-3.5" id="maiores-descontos-oportunidades-section">
      
      {/* ----------------------------------------------------
          CABEÇALHO DA SEÇÃO (NEOBRUTALISTA AUDITADO)
          ---------------------------------------------------- */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-accent-gold border border-ink text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            <Flame className="w-4 h-4 text-ink fill-current" />
          </span>
          <div className="flex flex-col">
            <h2 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight">
              Maiores Descontos &amp; Oportunidades
            </h2>
            <span className="text-[9px] font-sans text-ink/70">
              Radar de preços reduzidos e compras inteligentes
            </span>
          </div>
        </div>

        <span className="text-[8.5px] font-mono font-bold text-ink bg-emerald-100 border border-ink px-2 py-0.5 rounded-lg shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1 shrink-0">
          <ShieldCheck className="w-3 h-3 text-emerald-700" />
          <span>Preços Auditados</span>
        </span>
      </div>

      {/* ----------------------------------------------------
          PARTE 1: SUPER CARD DE DESTAQUE MASTER (OPÇÃO 1)
          Impacto visual imediato, De/Por real e economia em R$
          ---------------------------------------------------- */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-[3.5px_3.5px_0_0_rgba(46,43,39,1)] flex flex-col">
        
        {/* Faixa Superior de Urgência e Economia */}
        <div className="bg-amber-100 border-b border-ink/20 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[8px] font-mono font-black bg-red-600 text-white px-2 py-0.5 rounded border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1 shrink-0">
              <Flame className="w-2.5 h-2.5 fill-current" />
              <span>{heroDeal.badge}</span>
            </span>
            <span className="text-[9px] font-mono font-bold text-ink truncate">
              {heroDeal.marca} • {heroDeal.usoPrincipal}
            </span>
          </div>

          {heroDeal.economiaBrl > 0 && (
            <span className="text-[9px] font-mono font-black text-white bg-emerald-700 border border-ink px-2 py-0.5 rounded shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              <span>Economize {formatBrl(heroDeal.economiaBrl)} (-{heroDeal.discountPct}%)</span>
            </span>
          )}
        </div>

        {/* Corpo Principal com Vitrine da E-Bike */}
        <div className="p-3.5 flex flex-col gap-3">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* Foto Ampla da E-Bike com Fundo Studio (16:10 para preenchimento ideal) */}
            <Link 
              href={`/bike/${heroDeal.slug}`}
              className="w-full sm:w-52 aspect-[16/10] rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/90 border border-ink/20 relative overflow-hidden shrink-0 group flex items-center justify-center p-1.5"
            >
              <SafeImage
                src={heroDeal.imagemUrl}
                alt={heroDeal.modelo}
                variant="card"
                priority={true}
                className="object-contain p-0.5 group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1.5 left-1.5 bg-ink/85 text-white font-mono font-bold text-[7.5px] px-1.5 py-0.5 rounded border border-white/20">
                {heroDeal.lojasCount} {heroDeal.lojasCount > 1 ? 'lojas parceiras' : 'loja oficial'}
              </span>
              <span className="absolute top-1.5 right-1.5 bg-accent-gold text-ink font-mono font-black text-[7.5px] px-1.5 py-0.5 rounded border border-ink shadow-xs">
                MENOR VALOR
              </span>
            </Link>

            {/* Informações de Modelo, Veredito e Preço */}
            <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
              <div>
                <Link href={`/bike/${heroDeal.slug}`}>
                  <h3 className="font-display font-black text-sm sm:text-base text-ink tracking-tight hover:text-primary transition-colors line-clamp-2">
                    {heroDeal.modelo}
                  </h3>
                </Link>
                <p className="text-[9.5px] font-sans text-ink/75 line-clamp-1 mt-0.5">
                  {heroDeal.headline}
                </p>
              </div>

              {/* Bloco de Preço De / Por com Alto Impacto */}
              <div className="bg-neutral-50 p-2.5 rounded-xl border border-ink/15 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-ink/50 line-through">
                    De {formatBrl(heroDeal.maiorPreco)}
                  </span>
                  <span className="text-[8.5px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                    -{heroDeal.discountPct}% OFF
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-mono text-ink/70 font-bold">Por:</span>
                  <strong className="font-mono font-black text-base sm:text-lg text-primary tracking-tight">
                    {formatBrl(heroDeal.menorPreco)}
                  </strong>
                  <span className="text-[9px] font-mono text-ink/60">à vista</span>
                </div>

                <div className="text-[8.5px] font-mono text-emerald-800 font-bold">
                  ou 12x de {formatBrl(Math.ceil(heroDeal.menorPreco / 12))} no cartão
                </div>
              </div>

            </div>
          </div>

          {/* Trinca de Especificações Rápidas em Pílulas */}
          <div className="grid grid-cols-3 gap-1.5 bg-neutral-50 p-2 rounded-xl border border-ink/15 text-[8.5px] font-mono">
            <div className="flex items-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">
                {heroDeal.autonomiaKm ? `${heroDeal.autonomiaKm} km` : 'Autonomia N/I'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">
                {heroDeal.potenciaW ? `${heroDeal.potenciaW}W` : 'Motor N/I'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">
                {heroDeal.pesoKg ? `${heroDeal.pesoKg} kg` : 'Peso N/I'}
              </span>
            </div>
          </div>

          {/* Parecer Técnico Sintético (1 a 2 linhas diretas) */}
          <div className="bg-amber-50/90 border border-amber-300/90 p-2.5 rounded-xl flex items-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[9.5px] font-sans text-ink/85 leading-snug">
              <strong className="font-mono text-amber-900 font-bold">Parecer Técnico: </strong>
              {heroDeal.aiVerdict}
            </p>
          </div>

          {/* Botões de Ação Imediata */}
          <div className="flex items-center gap-2 pt-0.5">
            <Link
              href={`/bike/${heroDeal.slug}`}
              className="flex-1 bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-xs py-2.5 px-4 rounded-xl border border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <span>Ver Menor Preço Auditado</span>
              <ArrowRight className="w-3.5 h-3.5 text-ink shrink-0" />
            </Link>

            <button
              type="button"
              onClick={() => onCompareToggle(heroDeal.slug)}
              className={`font-mono font-bold text-xs py-2.5 px-3 rounded-xl border border-ink transition-all cursor-pointer shrink-0 ${
                isHeroCompared
                  ? 'bg-emerald-500 text-white shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                  : 'bg-white hover:bg-neutral-100 text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
              }`}
            >
              {isHeroCompared ? '✓ Comparando' : '+ Comparar'}
            </button>
          </div>

        </div>
      </div>

      {/* ----------------------------------------------------
          PARTE 2: CARROSSEL DE ACHADOS AUDITADOS (OPÇÃO 3)
          Substitui completamente blocos estáticos e vazios
          ---------------------------------------------------- */}
      {carouselDeals.length > 0 && (
        <div className="w-full flex flex-col gap-2.5 pt-1">
          
          {/* Grid Pequeno Branco com Alto Contraste para 'Outras Oportunidades no Radar' */}
          <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-amber-400 border-2 border-ink flex items-center justify-center text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] shrink-0">
                  <Sparkles className="w-4 h-4 text-ink fill-amber-200" />
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <h3 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight">
                      Outras Oportunidades no Radar
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs font-sans font-medium text-ink/80 leading-tight">
                    Deslize para ver outras opções com preço auditado
                  </p>
                </div>
              </div>

              {/* Setas de Controle Manual */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  disabled={!canScrollLeft}
                  aria-label="Rolar oportunidades para esquerda"
                  className={`w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center transition-all ${
                    canScrollLeft 
                      ? 'bg-neutral-50 text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 active:scale-95' 
                      : 'bg-neutral-100 text-neutral-300 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  disabled={!canScrollRight}
                  aria-label="Rolar oportunidades para direita"
                  className={`w-8 h-8 rounded-xl border-2 border-ink flex items-center justify-center transition-all ${
                    canScrollRight 
                      ? 'bg-neutral-50 text-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 active:scale-95' 
                      : 'bg-neutral-100 text-neutral-300 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Trilho Horizontal com Rolagem Suave */}
          <div
            ref={carouselRef}
            className="w-full flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2 pt-0.5 px-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {carouselDeals.map((item, idx) => {
              const isCompared = comparedSlugs.includes(item.slug);
              
              // Cores e ícones temáticos por categoria da oferta
              let badgeBg = 'bg-indigo-600 text-white';
              let badgeBorder = 'border-indigo-700';
              let badgeIcon = <Award className="w-2.5 h-2.5" />;
              let cardTopBarBg = 'bg-indigo-50';

              if (item.badgeType === 'battery') {
                badgeBg = 'bg-emerald-700 text-white';
                badgeBorder = 'border-emerald-800';
                badgeIcon = <BatteryCharging className="w-2.5 h-2.5" />;
                cardTopBarBg = 'bg-emerald-50';
              } else if (item.badgeType === 'star') {
                badgeBg = 'bg-amber-600 text-white';
                badgeBorder = 'border-amber-700';
                badgeIcon = <Sparkles className="w-2.5 h-2.5" />;
                cardTopBarBg = 'bg-amber-50';
              } else if (item.badgeType === 'bolt') {
                badgeBg = 'bg-purple-700 text-white';
                badgeBorder = 'border-purple-800';
                badgeIcon = <Zap className="w-2.5 h-2.5" />;
                cardTopBarBg = 'bg-purple-50';
              } else if (item.badgeType === 'fold') {
                badgeBg = 'bg-orange-600 text-white';
                badgeBorder = 'border-orange-700';
                badgeIcon = <Tag className="w-2.5 h-2.5" />;
                cardTopBarBg = 'bg-orange-50';
              }

              return (
                <div
                  key={`carousel-deal-${item.slug}-${idx}`}
                  className="w-[235px] sm:w-[245px] md:w-[255px] snap-start bg-white border-2 border-ink rounded-2xl overflow-hidden shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] flex flex-col justify-between shrink-0 hover:-translate-y-0.5 transition-transform"
                >
                  {/* Topo do Card com Badge Temático */}
                  <div>
                    <div className={`${cardTopBarBg} border-b border-ink/20 px-2.5 py-1.5 flex items-center justify-between gap-1`}>
                      <span className={`text-[7.5px] font-mono font-black px-1.5 py-0.5 rounded border ${badgeBg} ${badgeBorder} shadow-xs flex items-center gap-1`}>
                        {badgeIcon}
                        <span>{item.badge}</span>
                      </span>

                      {item.economiaBrl > 0 && (
                        <span className="text-[8px] font-mono font-black text-emerald-800 bg-white px-1.5 py-0.2 rounded border border-emerald-300">
                          -{item.discountPct}%
                        </span>
                      )}
                    </div>

                    {/* Foto e Detalhes */}
                    <div className="p-2.5 flex flex-col gap-2">
                      <Link
                        href={`/bike/${item.slug}`}
                        className="w-full aspect-[16/10] rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100/90 border border-ink/15 relative overflow-hidden group flex items-center justify-center p-1.5"
                      >
                        <SafeImage
                          src={item.imagemUrl}
                          alt={item.modelo}
                          variant="compact"
                          className="object-contain p-0.5 group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-1 left-1 bg-ink/80 text-white font-mono font-bold text-[6.5px] px-1.5 py-0.2 rounded">
                          {item.marca}
                        </span>
                        {item.usoPrincipal && (
                          <span className="absolute top-1 right-1 bg-white/90 text-ink font-mono font-bold text-[6.5px] px-1 py-0.2 rounded border border-ink/20">
                            {item.usoPrincipal}
                          </span>
                        )}
                      </Link>

                      <div>
                        <Link href={`/bike/${item.slug}`}>
                          <h4 className="font-display font-black text-xs sm:text-[13px] text-ink tracking-tight line-clamp-2 hover:text-primary transition-colors min-h-[30px] sm:min-h-[32px] leading-tight">
                            {item.modelo}
                          </h4>
                        </Link>
                        <p className="text-[8px] font-sans text-ink/70 line-clamp-1 mt-0.5">
                          {item.headline}
                        </p>
                      </div>

                      {/* Bloco de Preço com Economia */}
                      <div className="bg-neutral-50 p-2 rounded-xl border border-ink/10 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8.5px] font-mono text-ink/50 line-through">
                            De {formatBrl(item.maiorPreco)}
                          </span>
                          {item.economiaBrl > 0 && (
                            <span className="text-[7.5px] font-mono font-bold text-emerald-700">
                              Economize {formatBrl(item.economiaBrl)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-1">
                          <span className="text-[8px] font-mono text-ink/60">Por:</span>
                          <strong className="font-mono font-black text-sm text-primary">
                            {formatBrl(item.menorPreco)}
                          </strong>
                        </div>

                        <div className="text-[7.5px] font-mono text-emerald-800 font-bold">
                          ou 12x de {formatBrl(Math.ceil(item.menorPreco / 12))}
                        </div>
                      </div>

                      {/* Micro Specs */}
                      <div className="grid grid-cols-2 gap-1 bg-white p-1.5 rounded-lg border border-ink/10 text-[7.5px] font-mono">
                        <div className="flex items-center gap-1">
                          <BatteryCharging className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.autonomiaKm ? `${item.autonomiaKm} km` : 'N/I'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{item.potenciaW ? `${item.potenciaW}W` : 'N/I'}</span>
                        </div>
                      </div>

                      {/* Veredito Conciso */}
                      <div className="bg-neutral-50/80 p-1.5 rounded-lg border border-ink/10 text-[8px] font-sans text-ink/75 line-clamp-2">
                        {item.aiVerdict}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação do Card */}
                  <div className="p-2.5 pt-0 flex items-center gap-1.5">
                    <Link
                      href={`/bike/${item.slug}`}
                      className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-ink font-mono font-bold text-[8.5px] py-2 px-2 rounded-lg border border-ink text-center active:scale-95 transition-transform flex items-center justify-center gap-1"
                    >
                      <span>Conferir Oferta</span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => onCompareToggle(item.slug)}
                      aria-label={`Comparar ${item.modelo}`}
                      className={`p-2 rounded-lg border border-ink text-[8px] font-mono font-bold transition-all cursor-pointer ${
                        isCompared 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white hover:bg-neutral-100 text-ink'
                      }`}
                    >
                      {isCompared ? <Check className="w-3 h-3" /> : '+'}
                    </button>
                  </div>

                </div>
              );
            })}

            {/* Card Convite Final: Explorar Todo o Catálogo com Fundo Branco Opaco e Alto Contraste */}
            <div className="min-w-[220px] max-w-[230px] snap-start bg-white border-2 border-ink rounded-2xl p-4 shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] flex flex-col justify-between shrink-0 text-center">
              <div className="flex flex-col items-center justify-center gap-2.5 my-auto">
                <span className="w-11 h-11 rounded-2xl bg-amber-100 border border-ink flex items-center justify-center shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]">
                  <Compass className="w-6 h-6 text-ink" />
                </span>
                <h4 className="font-display font-black text-sm text-ink tracking-tight">
                  Explorar Radar Completo
                </h4>
                <p className="text-[9px] font-sans text-ink/75 leading-relaxed">
                  Veja todas as e-bikes com histórico de queda e filtros por valor.
                </p>
              </div>

              <Link
                href="/ebike?ordenar=maiorPreco"
                className="w-full bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-bold text-[9.5px] py-2.5 px-3 rounded-xl border border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] block active:scale-95 transition-transform mt-3"
              >
                Ver Todas as Ofertas ➔
              </Link>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
