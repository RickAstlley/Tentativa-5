'use client';

import React, { useState, useMemo } from 'react';
import { 
  BatteryCharging, 
  Zap, 
  Gauge, 
  AlertCircle, 
  Mountain, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Coins,
  TrendingDown,
  Info,
  Scale
} from 'lucide-react';
import { RealRangeCommunityStats } from '@/types/ebike';

interface RealRangeComparisonCardProps {
  stats: RealRangeCommunityStats;
  bikeModelo: string;
  onOpenReviewModal: () => void;
  batteryWh?: number;
  motorWatts?: number;
  compact?: boolean;
}

export default function RealRangeComparisonCard({
  stats,
  bikeModelo,
  onOpenReviewModal,
  batteryWh,
  motorWatts,
  compact = false,
}: RealRangeComparisonCardProps) {
  const [selectedTerrain, setSelectedTerrain] = useState<'todos' | 'plano' | 'misto' | 'íngreme'>('todos');
  const [riderWeightCategory, setRiderWeightCategory] = useState<'leve' | 'medio' | 'pesado'>('medio');
  const [showCostDetails, setShowCostDetails] = useState(false);

  const { advertisedKm, averageRealKm, accuracyPercent, sampleCount, terrainBreakdown } = stats;

  // Ajuste fino do simulador conforme relevo e peso do ciclista
  const currentDisplayKm = useMemo(() => {
    let baseKm = averageRealKm;

    if (selectedTerrain === 'plano') {
      baseKm = terrainBreakdown?.plano || Math.round(averageRealKm * 1.15);
    } else if (selectedTerrain === 'misto') {
      baseKm = terrainBreakdown?.misto || averageRealKm;
    } else if (selectedTerrain === 'íngreme') {
      baseKm = terrainBreakdown?.íngreme || Math.round(averageRealKm * 0.82);
    }

    // Fator de peso do ciclista
    const weightFactor = riderWeightCategory === 'leve' ? 1.07 : riderWeightCategory === 'pesado' ? 0.92 : 1.0;
    return Math.round(baseKm * weightFactor);
  }, [selectedTerrain, riderWeightCategory, averageRealKm, terrainBreakdown]);

  // Delta em relação ao anunciado
  const deltaKm = currentDisplayKm - advertisedKm;
  const currentAccuracy = Math.round((currentDisplayKm / advertisedKm) * 100);

  // Estimativa de custo por carga e por km
  // Média nacional de tarifa residencial: ~R$ 0,85 por kWh
  const estimatedWh = batteryWh || (advertisedKm >= 60 ? 500 : advertisedKm >= 45 ? 380 : 280);
  const costPerFullCharge = (estimatedWh / 1000) * 0.85; // Custo em R$ por carga de 0 a 100%
  const costPerKm = currentDisplayKm > 0 ? costPerFullCharge / currentDisplayKm : 0.012;
  const costPer100Km = costPerKm * 100;

  // Comparação com gasolina (carro popular 12km/L a R$ 6,10/L = R$ 0,51/km => R$ 51,00/100km)
  const gasEconomyPer100Km = Math.max(0, 51 - costPer100Km);

  // Veredito de acurácia
  const verdictText = currentAccuracy >= 85
    ? 'Fidelidade Excepcional: O fabricante adota parâmetros conservadores e a autonomia real no trânsito se aproxima muito dos números de catálogo.'
    : currentAccuracy >= 70
    ? 'Fidelidade Típica de Mercado: Queda esperada de 18% a 30% decorrente de paradas de semáforo, arrancadas com aceleração máxima e relevo urbano comum.'
    : 'Atenção ao Relevo e Nível de Assistência: O número de catálogo exige modo estritamente econômico e pista plana; em trajetos com ladeiras ou vento contra a bateria exigirá recargas mais frequentes.';

  const verdictBadge = currentAccuracy >= 85
    ? { label: 'Alta Fidelidade', color: 'bg-emerald-100 text-emerald-950 border-emerald-500' }
    : currentAccuracy >= 70
    ? { label: 'Fidelidade Típica (Padrão)', color: 'bg-amber-100 text-amber-950 border-amber-500' }
    : { label: 'Exige Recarga Mais Frequente', color: 'bg-rose-100 text-rose-950 border-rose-500' };

  return (
    <section 
      id="painel-autonomia-comparativa"
      aria-labelledby="titulo-autonomia-real"
      className={`bg-white border-2 border-stone-900 ${
        compact 
          ? 'rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] gap-4' 
          : 'rounded-3xl p-5 sm:p-7 shadow-[5px_5px_0px_0px_rgba(28,25,23,1)] gap-6'
      } flex flex-col`}
    >
      {/* Cabeçalho */}
      <div className={`flex flex-col ${compact ? 'gap-2.5' : 'sm:flex-row sm:items-center justify-between gap-3'} border-b-2 border-stone-100 pb-4`}>
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-400 border-2 border-stone-900 rounded-xl text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
              <Gauge className="w-4 h-4" />
            </div>
            <h3 id="titulo-autonomia-real" className={`font-black ${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} text-stone-900 uppercase tracking-tight`}>
              Autonomia de Fábrica vs. Vida Real
            </h3>
          </div>
          <p className="text-xs text-stone-600 font-medium mt-1.5 max-w-2xl leading-relaxed">
            Análise independente do TuaVia confrontando a promessa de laboratório do fabricante contra medições auditadas de ciclistas em rotas urbanas reais.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <span className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-xl border-2 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] ${verdictBadge.color}`}>
            {verdictBadge.label}
          </span>
        </div>
      </div>

      {/* Grid Comparativo de Medidores Lado a Lado */}
      <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'md:grid-cols-2 gap-4'}`}>
        {/* Medidor 1: Laboratório / Catálogo Oficial */}
        <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-5 flex flex-col justify-between shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              Promessa de Catálogo
            </span>
            <span className="text-[10px] font-mono font-bold text-stone-600 bg-stone-200 border border-stone-300 px-2 py-0.5 rounded-md">
              Teste Ideal de Fábrica
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black font-mono text-stone-900">
              {advertisedKm}
            </span>
            <span className="text-base font-bold text-stone-600">km / carga</span>
          </div>

          <div className="space-y-1 text-xs text-stone-600 font-medium bg-white/70 p-3 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span>Medido em circuito fechado 100% plano</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span>Ciclista de ~65kg mantendo modo Eco (assistência mínima)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span>Sem paradas de semáforo ou vento contra</span>
            </div>
          </div>
        </div>

        {/* Medidor 2: Vida Real / Comunidade Consolidada */}
        <div className="bg-emerald-50/90 border-2 border-emerald-900 rounded-2xl p-5 flex flex-col justify-between shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4 text-emerald-700" />
              Autonomia Medida na Vida Real
            </span>
            <span className="text-[10px] font-mono font-black text-emerald-900 bg-emerald-200 border border-emerald-400 px-2 py-0.5 rounded-md">
              {sampleCount > 0 ? `${sampleCount} relatos validados` : 'Média Técnica Consolidada'}
            </span>
          </div>

          <div className="my-4 flex flex-wrap items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black font-mono text-emerald-950">
              {currentDisplayKm}
            </span>
            <span className="text-base font-bold text-emerald-900">km por carga</span>
            <span className="text-xs font-black font-mono text-emerald-950 bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-400 ml-auto">
              {currentAccuracy}% da fábrica ({deltaKm >= 0 ? `+${deltaKm}` : deltaKm} km)
            </span>
          </div>

          <div className="space-y-1 text-xs text-emerald-950 font-medium bg-white/80 p-3 rounded-xl border border-emerald-300">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Trânsito real com semáforos, paradas e arrancadas</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Ciclistas reais com peso entre 65kg e 90kg</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>Uso combinado de níveis médios e altos de assistência</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Fidelidade Visual com Escala */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-stone-800">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Índice de Entrega da Promessa Elétrica
          </span>
          <span className="font-mono font-black text-stone-900">
            {currentAccuracy}% entregues no dia a dia
          </span>
        </div>

        <div className="w-full h-4 bg-stone-100 border-2 border-stone-900 rounded-full overflow-hidden p-0.5 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-600 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${Math.min(100, Math.max(12, currentAccuracy))}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-stone-500 font-bold px-1">
          <span>0% (Sem carga)</span>
          <span>50% (Metade)</span>
          <span>75% (Média Urbana)</span>
          <span>100% (Igual Catálogo)</span>
        </div>
      </div>

      {/* Simulador Interativo por Relevo e Peso */}
      <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-4 sm:p-5 space-y-4 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-stone-900 flex items-center gap-2">
            <Mountain className="w-4 h-4 text-stone-700" />
            Simulador de Autonomia Real para a Sua Rotina:
          </span>
          <span className="text-[11px] text-stone-500 font-medium">
            Selecione seu relevo e perfil de peso
          </span>
        </div>

        {/* Eixo 1: Relevo */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
            1. Relevo Predominante do Seu Trajeto:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedTerrain('todos')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                selectedTerrain === 'todos'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,0.4)]'
                  : 'bg-white text-stone-800 border-stone-300 hover:border-stone-900'
              }`}
            >
              Média Geral (~{averageRealKm} km)
            </button>

            <button
              type="button"
              onClick={() => setSelectedTerrain('plano')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                selectedTerrain === 'plano'
                  ? 'bg-emerald-600 text-white border-emerald-900 shadow-[2px_2px_0px_0px_rgba(5,150,105,0.4)]'
                  : 'bg-white text-stone-800 border-stone-300 hover:border-emerald-600'
              }`}
            >
              Plano / Ciclovia (~{terrainBreakdown?.plano || Math.round(averageRealKm * 1.15)} km)
            </button>

            <button
              type="button"
              onClick={() => setSelectedTerrain('misto')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                selectedTerrain === 'misto'
                  ? 'bg-amber-400 text-stone-900 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,0.4)]'
                  : 'bg-white text-stone-800 border-stone-300 hover:border-amber-500'
              }`}
            >
              Misto com Subidas (~{terrainBreakdown?.misto || averageRealKm} km)
            </button>

            <button
              type="button"
              onClick={() => setSelectedTerrain('íngreme')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                selectedTerrain === 'íngreme'
                  ? 'bg-rose-600 text-white border-rose-900 shadow-[2px_2px_0px_0px_rgba(225,29,72,0.4)]'
                  : 'bg-white text-stone-800 border-stone-300 hover:border-rose-600'
              }`}
            >
              Muitas Ladeiras (~{terrainBreakdown?.íngreme || Math.round(averageRealKm * 0.82)} km)
            </button>
          </div>
        </div>

        {/* Eixo 2: Peso do Ciclista */}
        <div className="space-y-1.5 pt-2 border-t border-stone-200">
          <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-stone-500" />
            2. Peso do Ciclista + Mochila/Carga:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRiderWeightCategory('leve')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                riderWeightCategory === 'leve'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
              }`}
            >
              Leve (até 65 kg)
            </button>
            <button
              type="button"
              onClick={() => setRiderWeightCategory('medio')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                riderWeightCategory === 'medio'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
              }`}
            >
              Médio (66 a 85 kg)
            </button>
            <button
              type="button"
              onClick={() => setRiderWeightCategory('pesado')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                riderWeightCategory === 'pesado'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
              }`}
            >
              Pesado (86 kg ou mais)
            </button>
          </div>
        </div>
      </div>

      {/* Card Especial de Economia no Bolso (Custo por Km Elétrico) */}
      <div className={`bg-emerald-500/10 border-2 border-emerald-900/40 rounded-2xl ${compact ? 'p-3.5 gap-3' : 'p-4 sm:p-5 gap-4'} flex flex-col ${compact ? '' : 'sm:flex-row sm:items-center justify-between'}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500 text-white rounded-xl border border-stone-900 shadow-xs mt-0.5 shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs sm:text-sm text-stone-900 uppercase">
                Custo Real por Km
              </span>
              <span className="text-[9px] font-bold text-emerald-900 bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-400">
                Tarifa Brasil
              </span>
            </div>
            <p className="text-[11px] text-stone-600 mt-0.5">
              Carga 0-100%: ~<strong>R$ {costPerFullCharge.toFixed(2)}</strong>
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-3 ${compact ? 'border-t border-emerald-900/20 pt-2.5 justify-between' : 'border-t sm:border-t-0 sm:border-l-2 border-emerald-900/20 pt-3 sm:pt-0 sm:pl-5 self-stretch sm:self-auto justify-between sm:justify-end'}`}>
          <div className="text-left sm:text-right">
            <span className="text-[9px] font-mono font-bold text-stone-500 uppercase block">Custo / km</span>
            <span className="text-lg sm:text-xl font-black font-mono text-emerald-900">
              R$ {costPerKm.toFixed(2)}
            </span>
          </div>

          <div className="text-right bg-white p-1.5 px-2.5 rounded-xl border border-emerald-900/30">
            <span className="text-[9px] font-mono font-bold text-emerald-800 uppercase block">100 km custam</span>
            <span className="text-sm font-black font-mono text-emerald-900">
              R$ {costPer100Km.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Veredito Especialista TuaVia e CTA para Avaliar */}
      <div className={`flex flex-col ${compact ? 'gap-3' : 'sm:flex-row sm:items-center justify-between gap-4'} pt-2 border-t border-stone-200`}>
        <div className="flex items-start gap-2.5 text-xs text-stone-700 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Veredito Técnico:</strong> {verdictText}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenReviewModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-amber-400 hover:bg-amber-300 border-2 border-stone-900 text-stone-900 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all shrink-0 select-none"
        >
          <Sparkles className="w-3.5 h-3.5 text-stone-900" />
          <span>Contribuir com Meu Teste Real</span>
          <ChevronRight className="w-3.5 h-3.5 text-stone-900" />
        </button>
      </div>
    </section>
  );
}
