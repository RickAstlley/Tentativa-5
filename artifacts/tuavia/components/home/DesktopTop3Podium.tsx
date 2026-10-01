'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Trophy, ArrowRight, Zap, BatteryCharging, Scale, Check, Plus, Minus } from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { HomeAICurationData } from '@/types/homeCuration';

interface DesktopTop3PodiumProps {
  bikes: EBikeGrouped[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
  onCompareToggle: (slug: string) => void;
  comparedSlugs: string[];
}

type PodiumCategory = 'custo-beneficio' | 'subidas' | 'dobraveis' | 'urbanas';

export default function DesktopTop3Podium({
  bikes,
  curation,
  formatBrl,
  onCompareToggle,
  comparedSlugs,
}: DesktopTop3PodiumProps) {
  const [activeTab, setActiveTab] = useState<PodiumCategory>('custo-beneficio');

  // Filtra as top 3 e-bikes de acordo com a aba e curadoria
  const podiumBikes = useMemo(() => {
    if (!bikes || bikes.length === 0) return [];

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
      list.sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (activeTab === 'subidas') {
      list = list.filter((b) => Boolean(b.usoPrincipal === 'Trilha/MTB' || (typeof b.potenciaW === 'number' && b.potenciaW >= 350)));
      list.sort((a, b) => (b.potenciaW || 0) - (a.potenciaW || 0));
    } else if (activeTab === 'dobraveis') {
      list = list.filter((b) => Boolean((b as any).quadroDobravel || b.usoPrincipal === 'Dobrável' || (b as any).categoria === 'Dobrável'));
      list.sort((a, b) => a.menorPreco - b.menorPreco);
    } else if (activeTab === 'urbanas') {
      list = list.filter((b) => b.usoPrincipal === 'Urbana');
      list.sort((a, b) => (b.autonomiaKm || 0) - (a.autonomiaKm || 0));
    }

    if (list.length < 3) {
      const remaining = bikes.filter((b) => !list.some((item) => item.slug === b.slug));
      list = [...list, ...remaining];
    }

    return list.slice(0, 3);
  }, [bikes, activeTab, curation]);

  const tabs: Array<{ id: PodiumCategory; label: string; icon: string }> = [
    { id: 'custo-beneficio', label: 'Custo-Benefício', icon: '💰' },
    { id: 'subidas', label: 'Subidas Fortes (350W+)', icon: '⚡' },
    { id: 'dobraveis', label: 'Dobráveis & Metrô', icon: '🚇' },
    { id: 'urbanas', label: 'Uso Diário Urbano', icon: '🏙️' },
  ];

  const podiumBadges = [
    { rank: '1º LUGAR', title: 'Campeã Escolha TuaVia', bg: 'bg-amber-400 text-ink border-ink', ring: 'border-amber-400 shadow-[4px_4px_0_0_rgba(245,158,11,1)]' },
    { rank: '2º LUGAR', title: 'Prata Técnica', bg: 'bg-neutral-200 text-ink border-ink', ring: 'border-neutral-300 shadow-[3px_3px_0_0_rgba(46,43,39,0.8)]' },
    { rank: '3º LUGAR', title: 'Bronze de Destaque', bg: 'bg-amber-700/20 text-amber-900 border-amber-800/30', ring: 'border-amber-800/30 shadow-[3px_3px_0_0_rgba(46,43,39,0.8)]' },
  ];

  return (
    <div className="w-full bg-white border-2 border-ink rounded-2xl p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-4">
      {/* CABEÇALHO DO PÓDIO DESKTOP COM TABS EM UMA LINHA */}
      <div className="flex items-center justify-between gap-4 border-b border-dashed border-ink/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-400 border-2 border-ink flex items-center justify-center shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
            <Trophy className="w-5 h-5 text-ink" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/60 block">
              Curadoria Oficial Auditada
            </span>
            <h3 className="text-base font-black font-mono text-ink">
              Pódio dos 3 Melhores Modelos do Brasil
            </h3>
          </div>
        </div>

        {/* SELETORES DE CATEGORIA EM PILLS DESKTOP */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl border border-ink/20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-ink text-white shadow-xs'
                  : 'text-ink/70 hover:text-ink hover:bg-neutral-200/60'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* GRID DOS 3 CARDS LADO A LADO (3 COLUNAS PERFEITAS PARA TELA LARGA) */}
      <div className="grid grid-cols-3 gap-4">
        {podiumBikes.map((bike, index) => {
          const badge = podiumBadges[index] || podiumBadges[2];
          const isCompared = comparedSlugs.includes(bike.slug);
          const photoUrl =
            bike.imagemUrl ||
            (bike as any).imagemCard ||
            bike.galleryImages?.[0] ||
            bike.ofertas?.[0]?.imagemUrl ||
            '/placeholder-bike.png';

          return (
            <div
              key={`podium-desktop-${bike.slug}-${index}`}
              className={`bg-white border-2 border-ink rounded-xl p-4 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-[5px_5px_0_0_rgba(46,43,39,1)] relative ${
                index === 0 ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''
              }`}
            >
              {/* BADGE DE COLOCAÇÃO */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border ${badge.bg}`}>
                  {badge.rank} • {badge.title}
                </span>

                <button
                  type="button"
                  onClick={() => onCompareToggle(bike.slug)}
                  title={isCompared ? 'Remover do Comparador' : 'Adicionar ao Comparador'}
                  className={`p-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isCompared
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-ink border-ink/30'
                  }`}
                >
                  {isCompared ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{isCompared ? 'Comparando' : 'Comparar'}</span>
                </button>
              </div>

              {/* FOTO DA E-BIKE (Com Fundo Studio Suave e Enquadramento Completo) */}
              <Link href={`/bike/${bike.slug}`} className="block relative w-full aspect-[16/10] bg-gradient-to-b from-white to-neutral-100/90 rounded-xl border border-ink/15 overflow-hidden mb-3 group shrink-0 p-1">
                <SafeImage
                  src={photoUrl}
                  fallbackSrc="/placeholder-bike.png"
                  alt={`${bike.marca} ${bike.modelo}`}
                  fill
                  sizes="320px"
                  className="object-contain p-0.5 group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              {/* TÍTULO E MARCA */}
              <div className="flex flex-col mb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/60">
                  {bike.marca}
                </span>
                <Link
                  href={`/bike/${bike.slug}`}
                  className="text-sm font-black font-mono text-ink hover:text-primary transition-colors line-clamp-1"
                >
                  {bike.modelo}
                </Link>
              </div>

              {/* SPECS TÉCNICAS EM MINI GRID DE 3 COLUNAS */}
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-50 border border-ink/10 rounded-lg p-2 mb-3 text-center">
                <div>
                  <span className="block text-[9px] font-mono text-ink/50 uppercase">Potência</span>
                  <strong className="text-xs font-mono font-bold text-ink flex items-center justify-center gap-0.5">
                    <Zap className="w-3 h-3 text-amber-500" />
                    {bike.potenciaW || '250'}W
                  </strong>
                </div>
                <div className="border-x border-ink/10">
                  <span className="block text-[9px] font-mono text-ink/50 uppercase">Autonomia</span>
                  <strong className="text-xs font-mono font-bold text-ink flex items-center justify-center gap-0.5">
                    <BatteryCharging className="w-3 h-3 text-emerald-600" />
                    {bike.autonomiaKm || '40'}km
                  </strong>
                </div>
                <div>
                  <span className="block text-[9px] font-mono text-ink/50 uppercase">Peso</span>
                  <strong className="text-xs font-mono font-bold text-ink flex items-center justify-center gap-0.5">
                    <Scale className="w-3 h-3 text-sky-600" />
                    {bike.pesoKg ? `${bike.pesoKg}kg` : 'N/I'}
                  </strong>
                </div>
              </div>

              {/* PREÇO E CTA */}
              <div className="flex items-center justify-between pt-2 border-t border-dashed border-ink/15 mt-auto">
                <div>
                  <span className="block text-[9px] font-mono text-ink/60 uppercase">Menor Oferta</span>
                  <strong className="text-sm font-mono font-black text-ink">
                    {formatBrl(bike.menorPreco)}
                  </strong>
                </div>

                <Link
                  href={`/bike/${bike.slug}`}
                  className="px-3 py-1.5 rounded-lg bg-ink hover:bg-neutral-800 text-white text-xs font-mono font-bold flex items-center gap-1 transition-all shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]"
                >
                  <span>Análise</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
