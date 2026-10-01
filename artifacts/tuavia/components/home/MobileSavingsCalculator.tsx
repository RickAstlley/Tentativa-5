'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Calculator, 
  TrendingDown, 
  DollarSign, 
  Sparkles, 
  ChevronRight, 
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { EBikeGrouped } from '@/types/ebike';

interface MobileSavingsCalculatorProps {
  bikes: EBikeGrouped[];
  formatBrl: (val: number) => string;
}

export default function MobileSavingsCalculator({ bikes, formatBrl }: MobileSavingsCalculatorProps) {
  const [kmPerDay, setKmPerDay] = useState<number>(20);
  const [transportType, setTransportType] = useState<'car' | 'app' | 'bus'>('car');

  // Encontra bike com menor preço para o radar
  const cheapestBike = [...bikes].sort((a, b) => (a.menorPreco || 99999) - (b.menorPreco || 99999))[0] || null;

  // Cálculo da economia estimada mensal:
  // Carro: R$ 0.75 por km (gasolina + manutenção + IPVA/Seguro proporcional)
  // App (Uber/99): R$ 2.10 por km
  // Ônibus/Metrô: R$ 5.40 por passagem (2x ao dia = R$ 10.80/dia)
  const calculateMonthlySavings = () => {
    const workingDays = 22; // Dias úteis por mês
    if (transportType === 'car') {
      const fuelCost = kmPerDay * 0.75 * workingDays;
      const ebikeEletrity = (kmPerDay * 0.03) * workingDays; // R$ 0.03 por km de energia
      return Math.round(fuelCost - ebikeEletrity);
    }
    if (transportType === 'app') {
      const appCost = kmPerDay * 2.10 * workingDays;
      const ebikeEletrity = (kmPerDay * 0.03) * workingDays;
      return Math.round(appCost - ebikeEletrity);
    }
    // Bus
    const busCost = 10.80 * workingDays;
    const ebikeEletrity = (kmPerDay * 0.03) * workingDays;
    return Math.round(Math.max(120, busCost - ebikeEletrity));
  };

  const monthlySavings = calculateMonthlySavings();
  const yearlySavings = monthlySavings * 12;

  return (
    <div className="w-full flex flex-col gap-2.5" id="mobile-savings-calculator">
      
      {/* 1. CABEÇALHO DO BLOCO */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-accent-charge border border-ink text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
            <Calculator className="w-4 h-4 text-ink" />
          </span>
          <div className="flex flex-col">
            <h2 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight">
              Calculadora de Economia Real
            </h2>
          </div>
        </div>

        <span className="bg-emerald-100 text-emerald-900 border border-emerald-600 text-[8.5px] font-mono font-bold px-2 py-1 rounded-xl shrink-0 flex items-center gap-1 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
          <Zap className="w-3 h-3 text-emerald-700 fill-emerald-500" />
          <span>Simulador 2026</span>
        </span>
      </div>

      {/* 2. CARD PRINCIPAL DA CALCULADORA */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3.5 relative overflow-hidden">
        
        {/* Seletor de Tipo de Transporte Atual */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono font-bold text-ink/80 uppercase tracking-wider">
            Como você se desloca hoje?
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'car', label: 'Carro', icon: '🚗' },
              { id: 'app', label: 'Uber / 99', icon: '📱' },
              { id: 'bus', label: 'Ônibus/Metrô', icon: '🚌' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTransportType(t.id as any)}
                className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  transportType === t.id
                    ? 'bg-accent-gold text-ink border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                    : 'bg-neutral-50 hover:bg-white text-ink/70 border-ink/30 hover:border-ink'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Controler de KM Por Dia */}
        <div className="flex flex-col gap-1 bg-amber-50/80 p-3 rounded-xl border border-ink/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-ink">
              Distância diária (ida + volta):
            </span>
            <span className="text-xs font-mono font-black text-primary bg-white px-2 py-0.5 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
              {kmPerDay} km/dia
            </span>
          </div>

          <input
            type="range"
            min="5"
            max="60"
            step="5"
            value={kmPerDay}
            onChange={(e) => setKmPerDay(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer my-1.5"
          />

          <div className="flex justify-between text-[8px] font-mono text-ink/60">
            <span>5 km (Curto)</span>
            <span>25 km (Médio)</span>
            <span>60 km (Longo)</span>
          </div>
        </div>

        {/* Resultado Estimado da Economia */}
        <div className="bg-emerald-600 text-white border-2 border-ink rounded-xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold text-emerald-100 uppercase tracking-wider">
              Economia Estimada no Bolso
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-display font-black text-amber-300">
                {formatBrl(monthlySavings)}
              </span>
              <span className="text-[10px] font-mono text-emerald-100">/ mês</span>
            </div>
            <span className="text-[9px] font-mono text-white/90 mt-0.5">
              Aproximadamente <strong className="text-amber-300">{formatBrl(yearlySavings)}</strong> por ano economizados!
            </span>
          </div>

          <div className="w-10 h-10 rounded-xl bg-white text-ink border border-ink flex items-center justify-center shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        {/* Destaque do Radar do Menor Preço de Entrada */}
        {cheapestBike && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed border-ink/20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-lg bg-amber-400 text-ink border border-ink shrink-0 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                <TrendingDown className="w-3.5 h-3.5" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[8.5px] font-mono font-bold text-ink/60 uppercase">
                  Menor Entrada Hoje:
                </span>
                <span className="text-xs font-display font-black text-ink truncate">
                  {cheapestBike.marca} {cheapestBike.modelo}
                </span>
              </div>
            </div>

            <Link
              href={`/bike/${cheapestBike.slug}`}
              className="text-[9.5px] font-mono font-bold bg-accent-gold hover:bg-amber-400 text-ink px-2.5 py-1.5 rounded-xl border border-ink shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] shrink-0 flex items-center gap-1 active:scale-95 transition-all"
            >
              <span>{formatBrl(cheapestBike.menorPreco || 0)}</span>
              <ArrowUpRight className="w-3 h-3 text-ink" />
            </Link>
          </div>
        )}

      </div>

    </div>
  );
}
