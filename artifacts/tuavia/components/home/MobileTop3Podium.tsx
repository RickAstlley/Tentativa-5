'use client';

import React, { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Award, Trophy, ArrowRight, BatteryCharging, Zap, Layers, Star } from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { HomeAICurationData } from '@/types/homeCuration';
import BikeScrollIndicator from '@/components/ui/BikeScrollIndicator';

interface MobileTop3PodiumProps {
  bikes: EBikeGrouped[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
  onCompareToggle: (slug: string) => void;
  comparedSlugs: string[];
}

type PodiumCategory = 'custo-beneficio' | 'subidas' | 'dobraveis' | 'urbanas';

export default function MobileTop3Podium({
  bikes,
  curation,
  formatBrl,
  onCompareToggle,
  comparedSlugs
}: MobileTop3PodiumProps) {
  const [activeTab, setActiveTab] = useState<PodiumCategory>('custo-beneficio');
  const tabsRef = useRef<HTMLDivElement>(null);

  // Filtra as top 3 e-bikes de acordo com a aba e curadoria
  const podiumBikes = useMemo(() => {
    if (!bikes || bikes.length === 0) return [];

    // Se temos curadoria específica para o pódio:
    if (curation?.bikes?.podiums) {
      let curatedSlugs: string[] | undefined;
      if (activeTab === 'custo-beneficio') curatedSlugs = curation.bikes.podiums.custoBeneficioSlugs;
      else if (activeTab === 'subidas') curatedSlugs = curation.bikes.podiums.subidasSlugs;
      else if (activeTab === 'dobraveis') curatedSlugs = curation.bikes.podiums.dobraveisSlugs;
      else if (activeTab === 'urbanas') curatedSlugs = curation.bikes.podiums.urbanasSlugs;

      if (curatedSlugs && curatedSlugs.length > 0) {
        const found = curatedSlugs.map((s) => bikes.find((b) => b.slug === s)).filter(Boolean) as EBikeGrouped[];
        if (found.length >= 3) {
          return found.slice(0, 3);
        }
      }
    }

    let list = [...bikes];

    if (activeTab === 'custo-beneficio') {
      // Ordena por menor preço mantendo modelos válidos
      list.sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (activeTab === 'subidas') {
      // Prioriza potência alta e MTB
      list = list.filter((b) => Boolean(b.usoPrincipal === 'Trilha/MTB' || (typeof b.potenciaW === 'number' && b.potenciaW >= 350)));
      list.sort((a, b) => (b.potenciaW || 0) - (a.potenciaW || 0));
    } else if (activeTab === 'dobraveis') {
      list = list.filter((b) => Boolean(b.usoPrincipal === 'Dobrável' || b.modelo.toLowerCase().includes('dobr') || (typeof b.pesoKg === 'number' && b.pesoKg <= 23)));
      list.sort((a, b) => (a.pesoKg || 99) - (b.pesoKg || 99));
    } else if (activeTab === 'urbanas') {
      list = list.filter((b) => b.usoPrincipal === 'Urbana');
      list.sort((a, b) => (b.autonomiaKm || 0) - (a.autonomiaKm || 0));
    }

    if (list.length < 3) {
      list = [...bikes];
    }

    return list.slice(0, 3);
  }, [bikes, curation, activeTab]);

  if (!bikes || bikes.length === 0 || !podiumBikes || podiumBikes.length === 0) {
    return null;
  }

  const medals = [
    { rank: '1º Lugar', icon: '🥇', bg: 'bg-amber-100 border-amber-400 text-amber-900', badge: 'bg-amber-400 text-ink' },
    { rank: '2º Lugar', icon: '🥈', bg: 'bg-slate-100 border-slate-300 text-slate-800', badge: 'bg-slate-300 text-ink' },
    { rank: '3º Lugar', icon: '🥉', bg: 'bg-orange-50 border-orange-300 text-orange-900', badge: 'bg-orange-300 text-ink' },
  ];

  return (
    <div className="w-full bg-white border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-3" id="mobile-top3-podium-section">
      
      {/* Header do Pódio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-xl bg-accent-gold border border-ink flex items-center justify-center shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            <Trophy className="w-3.5 h-3.5 text-ink" />
          </div>
          <div>
            <h3 className="font-display font-black text-xs sm:text-sm text-ink tracking-tight">
              Pódio Top 3 por Categoria
            </h3>
          </div>
        </div>

        <span className="text-[8px] font-mono font-bold bg-neutral-100 text-ink border border-ink px-1.5 py-0.5 rounded shrink-0">
          Auditado
        </span>
      </div>

      {/* Tabs com Scroll Horizontal */}
      <div 
        ref={tabsRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pr-6"
      >
        <button
          type="button"
          onClick={() => setActiveTab('custo-beneficio')}
          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'custo-beneficio'
              ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-50 text-ink/70 border-ink/30 hover:bg-neutral-100'
          }`}
        >
          🏆 Custo-Benefício
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('subidas')}
          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'subidas'
              ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-50 text-ink/70 border-ink/30 hover:bg-neutral-100'
          }`}
        >
          ⚡ Para Subidas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dobraveis')}
          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'dobraveis'
              ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-50 text-ink/70 border-ink/30 hover:bg-neutral-100'
          }`}
        >
          🎒 Dobráveis / Leves
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('urbanas')}
          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
            activeTab === 'urbanas'
              ? 'bg-amber-400 text-ink border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
              : 'bg-neutral-50 text-ink/70 border-ink/30 hover:bg-neutral-100'
          }`}
        >
          🏙️ Melhores Urbanas
        </button>
      </div>

      {/* Indicador de rolagem com bicicleta se as abas transbordarem */}
      <BikeScrollIndicator 
        containerRef={tabsRef} 
        label="Deslize para ver mais categorias" 
      />

      {/* Carrossel / Cards do Pódio Responsivo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
        {podiumBikes.map((bike, idx) => {
          const medal = medals[idx] || medals[0];
          const isCompared = comparedSlugs.includes(bike.slug);
          const photoUrl = bike.imagemUrl || bike.galleryImages?.[0] || bike.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png';

          return (
            <div
              key={`podium-mobile-${bike.slug}-${idx}`}
              className={`p-2.5 sm:p-3 rounded-2xl border-2 border-ink flex flex-row md:flex-col items-center md:items-stretch justify-between gap-2.5 sm:gap-3 shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] transition-all ${
                idx === 0 ? 'bg-amber-50/90' : 'bg-neutral-50/90'
              }`}
            >
              {/* Medalha & Foto com Proporção e Enquadramento Otimizados */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {/* Cabeçalho do Pódio / Badge */}
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-lg border border-ink flex items-center gap-1 shadow-xs ${medal.badge}`}>
                    <span>{medal.icon}</span>
                    <span>{medal.rank}</span>
                  </span>
                  <span className="hidden md:inline-block text-[8px] font-mono text-ink/60">
                    Posição #{idx + 1}
                  </span>
                </div>

                <Link
                  href={`/bike/${bike.slug}`}
                  className="w-24 h-20 sm:w-28 sm:h-22 md:w-full md:h-32 md:aspect-[16/10] rounded-xl bg-gradient-to-br from-white to-neutral-100 border border-ink/20 relative overflow-hidden block shrink-0 shadow-xs group p-1"
                >
                  <SafeImage
                    src={photoUrl}
                    fallbackSrc="/placeholder-bike.png"
                    alt={bike.modelo}
                    fill
                    className="object-contain p-0.5 group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                    sizes="(max-width: 768px) 112px, 33vw"
                  />
                </Link>
              </div>

              {/* Informações Centrais com Hierarquia Rigorosa */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 md:py-0">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[8px] font-mono font-bold text-ink uppercase bg-amber-200/80 border border-ink/40 px-1.5 py-0.5 rounded">
                      {bike.marca}
                    </span>
                    {bike.usoPrincipal && (
                      <span className="text-[8px] font-mono text-ink/60 truncate max-w-[110px]">
                        {bike.usoPrincipal}
                      </span>
                    )}
                  </div>
                  <Link href={`/bike/${bike.slug}`}>
                    <h4 className="font-display font-black text-xs sm:text-[13px] leading-tight text-ink line-clamp-2 hover:text-primary transition-colors mt-1 min-h-[30px] sm:min-h-[34px]">
                      {bike.modelo}
                    </h4>
                  </Link>
                </div>

                <div className="flex items-baseline justify-between gap-2 mt-1.5">
                  <strong className="font-mono font-black text-xs sm:text-sm text-primary">
                    {formatBrl(bike.menorPreco)}
                  </strong>
                  <span className="text-[8px] sm:text-[8.5px] font-mono text-ink/60 whitespace-nowrap">
                    {bike.autonomiaKm ? `${bike.autonomiaKm}km` : ''} {bike.potenciaW ? `• ${bike.potenciaW}W` : ''}
                  </span>
                </div>
              </div>

              {/* Botões de Ação com Melhor Área de Toque */}
              <div className="flex flex-col md:grid md:grid-cols-2 items-end md:items-stretch gap-1.5 shrink-0 pl-1 md:pl-0 md:pt-2 md:border-t md:border-ink/10 md:w-full">
                <Link
                  href={`/bike/${bike.slug}`}
                  className="bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-[9.5px] sm:text-[10px] px-2.5 py-1.5 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] active:scale-95 transition-transform text-center min-w-[56px] md:w-full"
                >
                  Ver
                </Link>
                <button
                  type="button"
                  onClick={() => onCompareToggle(bike.slug)}
                  className={`font-mono text-[8.5px] sm:text-[9px] px-2 py-1.5 rounded-lg border transition-all cursor-pointer min-w-[56px] md:w-full text-center ${
                    isCompared
                      ? 'bg-emerald-500 text-white border-ink font-bold shadow-[1px_1px_0_0_rgba(46,43,39,1)]'
                      : 'bg-white text-ink/80 border-ink/40 hover:border-ink hover:bg-neutral-50'
                  }`}
                >
                  {isCompared ? '✓ Comp.' : '+ Comp.'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
