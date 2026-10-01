'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Swords, TrendingDown, ArrowRight, ShieldCheck, Zap, DollarSign } from 'lucide-react';
import SafeImage from '../ui/SafeImage';
import { EBikeGrouped } from '@/types/ebike';
import { HomeAICurationData } from '@/types/homeCuration';

interface DesktopCockpitSidebarProps {
  bikes: EBikeGrouped[];
  curation?: HomeAICurationData;
  formatBrl: (val: number) => string;
}

export default function DesktopCockpitSidebar({
  bikes,
  curation,
  formatBrl,
}: DesktopCockpitSidebarProps) {
  // 1. Duelo de Destaque
  const duelBikes = useMemo(() => {
    if (!bikes || bikes.length < 2) return null;
    if (curation?.bikes?.weeklyDuel) {
      const b1 = bikes.find((b) => b.slug === curation.bikes.weeklyDuel.bike1Slug);
      const b2 = bikes.find((b) => b.slug === curation.bikes.weeklyDuel.bike2Slug);
      if (b1 && b2) return [b1, b2];
    }
    const duelSlugs = (curation as any)?.versus?.duels?.[0]?.bikes;
    if (duelSlugs && duelSlugs.length === 2) {
      const b1 = bikes.find((b) => b.slug === duelSlugs[0]);
      const b2 = bikes.find((b) => b.slug === duelSlugs[1]);
      if (b1 && b2) return [b1, b2];
    }
    // Fallback: duas primeiras bikes populares
    return [bikes[0], bikes[1]];
  }, [bikes, curation]);

  // 2. Maiores Descontos Detectados Hoje
  const topDiscounts = useMemo(() => {
    if (!bikes) return [];
    return bikes
      .map((b) => {
        const precoCheio = b.precoOriginal && b.precoOriginal > b.menorPreco ? b.precoOriginal : 0;
        const economia = precoCheio > 0 ? precoCheio - b.menorPreco : 0;
        const pctDesconto = precoCheio > 0 ? Math.round((economia / precoCheio) * 100) : 0;
        return { bike: b, economia, pctDesconto };
      })
      .filter((item) => item.economia > 100)
      .sort((a, b) => b.economia - a.economia)
      .slice(0, 3);
  }, [bikes]);

  // 3. Mini Calculadora de Economia
  const [kmPorDia, setKmPorDia] = useState<number>(15);
  const diasMes = 22;
  const kmMensal = kmPorDia * diasMes;
  // Custo Gasolina (~12 km/l @ R$ 6,10/l) + estacionamento/manutenção básica = ~R$ 0,75/km
  // Custo E-Bike (~R$ 0,02/km em energia elétrica residencial)
  const economiaMensal = Math.round(kmMensal * (0.75 - 0.02));

  return (
    <div className="flex flex-col gap-4">
      {/* 1. DUELO DO DIA (HEAD TO HEAD) */}
      {duelBikes && (
        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-dashed border-ink/20 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 border border-ink flex items-center justify-center">
                <Swords className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-xs font-mono font-black text-ink uppercase tracking-wider">
                Duelo Direto do Dia
              </span>
            </div>
            <Link
              href={`/arena?bike1=${duelBikes[0].slug}&bike2=${duelBikes[1].slug}`}
              className="text-[11px] font-mono font-bold text-ink/70 hover:text-ink flex items-center gap-1"
            >
              <span>Ver Arena</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-ink text-white font-mono font-black text-xs flex items-center justify-center border-2 border-white shadow-xs">
              VS
            </div>

            {/* Bike 1 */}
            <div className="bg-neutral-50 rounded-xl p-2.5 border border-ink/10 flex flex-col items-center text-center">
              <div className="relative w-full aspect-video mb-1.5">
                <SafeImage
                  src={duelBikes[0].imagemUrl || duelBikes[0].galleryImages?.[0] || duelBikes[0].ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                  fallbackSrc="/placeholder-bike.png"
                  alt={duelBikes[0].modelo}
                  fill
                  sizes="140px"
                  className="object-contain"
                />
              </div>
              <span className="text-[9px] font-mono font-bold uppercase text-ink/60">{duelBikes[0].marca}</span>
              <strong className="text-xs font-mono font-black text-ink line-clamp-1">{duelBikes[0].modelo}</strong>
              <span className="text-xs font-mono font-bold text-ink mt-1">{formatBrl(duelBikes[0].menorPreco)}</span>
              <span className="text-[10px] font-mono text-ink/60 mt-0.5">{duelBikes[0].potenciaW || 250}W • {duelBikes[0].autonomiaKm || 40}km</span>
            </div>

            {/* Bike 2 */}
            <div className="bg-neutral-50 rounded-xl p-2.5 border border-ink/10 flex flex-col items-center text-center">
              <div className="relative w-full aspect-video mb-1.5">
                <SafeImage
                  src={duelBikes[1].imagemUrl || duelBikes[1].galleryImages?.[0] || duelBikes[1].ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                  fallbackSrc="/placeholder-bike.png"
                  alt={duelBikes[1].modelo}
                  fill
                  sizes="140px"
                  className="object-contain"
                />
              </div>
              <span className="text-[9px] font-mono font-bold uppercase text-ink/60">{duelBikes[1].marca}</span>
              <strong className="text-xs font-mono font-black text-ink line-clamp-1">{duelBikes[1].modelo}</strong>
              <span className="text-xs font-mono font-bold text-ink mt-1">{formatBrl(duelBikes[1].menorPreco)}</span>
              <span className="text-[10px] font-mono text-ink/60 mt-0.5">{duelBikes[1].potenciaW || 250}W • {duelBikes[1].autonomiaKm || 40}km</span>
            </div>
          </div>

          <Link
            href={`/arena?bike1=${duelBikes[0].slug}&bike2=${duelBikes[1].slug}`}
            className="w-full py-2 bg-ink hover:bg-neutral-800 text-white rounded-xl text-xs font-mono font-bold text-center flex items-center justify-center gap-1.5 transition-all shadow-[2px_2px_0_0_rgba(46,43,39,1)]"
          >
            <span>Comparar Frente a Frente</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 2. RADAR DE QUEDAS DE PREÇO DO DIA */}
      {topDiscounts.length > 0 && (
        <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-dashed border-ink/20 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-ink flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-xs font-mono font-black text-ink uppercase tracking-wider">
                Maiores Descontos Hoje
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
              Ao Vivo
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {topDiscounts.map(({ bike, economia, pctDesconto }, idx) => (
              <Link
                key={`discount-item-${bike.slug}-${idx}`}
                href={`/bike/${bike.slug}`}
                className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-neutral-50 hover:bg-emerald-50/50 border border-ink/10 hover:border-emerald-500/40 transition-all group"
              >
<div className="flex items-center gap-2.5 min-w-0">
                   <div className="relative w-full aspect-video max-w-12 max-h-12 bg-white rounded-lg border border-ink/10 overflow-hidden shrink-0">
                     <SafeImage
                       src={bike.imagemUrl || bike.galleryImages?.[0] || bike.ofertas?.[0]?.imagemUrl || '/placeholder-bike.png'}
                       fallbackSrc="/placeholder-bike.png"
                       alt={bike.modelo}
                       fill
                       sizes="48px"
                       className="object-contain p-1"
                     />
                   </div>
                  <div className="min-w-0">
                    <strong className="text-xs font-mono font-bold text-ink group-hover:text-emerald-800 line-clamp-1 block">
                      {bike.modelo}
                    </strong>
                    <span className="text-[10px] font-mono text-ink/60 block">
                      {formatBrl(bike.menorPreco)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 block">
                    -{pctDesconto}%
                  </span>
                  <span className="text-[9px] font-mono text-ink/50 block mt-0.5">
                    Eco. {formatBrl(economia)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 3. CALCULADORA RÁPIDA DE ECONOMIA */}
      <div className="bg-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between border-b border-dashed border-ink/20 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-ink flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-amber-800" />
            </div>
            <span className="text-xs font-mono font-black text-ink uppercase tracking-wider">
              Simulador de Economia Mensal
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-ink/70">Distância diária:</span>
            <strong className="font-bold text-ink">{kmPorDia} km / dia</strong>
          </div>
          <input
            type="range"
            min="5"
            max="40"
            step="5"
            value={kmPorDia}
            onChange={(e) => setKmPorDia(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-200 rounded-lg"
          />
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-amber-900 block">
              Economia estimada vs Carro:
            </span>
            <strong className="text-base font-mono font-black text-emerald-700">
              +{formatBrl(economiaMensal)}/mês
            </strong>
          </div>
          <span className="text-[10px] font-mono text-ink/60 max-w-[90px] text-right">
            R$ {(economiaMensal * 12).toLocaleString('pt-BR')} no ano
          </span>
        </div>
      </div>

      {/* 4. CERTIFICAÇÃO JURÍDICA CONTRAN 996/2023 */}
      <div className="bg-emerald-50/80 border-2 border-emerald-700/60 rounded-2xl p-3 shadow-xs flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-mono font-black uppercase text-emerald-950 block">
            Homologação CONTRAN 996/2023
          </span>
          <p className="text-[11px] font-mono text-emerald-900/80 leading-tight mt-0.5">
            100% dos modelos auditados dispensam CNH, IPVA e emplacamento.
          </p>
        </div>
      </div>
    </div>
  );
}
