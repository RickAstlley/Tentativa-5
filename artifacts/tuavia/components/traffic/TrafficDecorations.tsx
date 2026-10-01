'use client';

import React from 'react';
import { Bike, Navigation, ChevronRight } from 'lucide-react';

/**
 * Semáforo Neo-Brutalista com Sinal Verde de E-Bike
 */
export function TrafficLight({ 
  state = 'green', 
  size = 'md',
  showLabel = true,
  labelText = 'SINAL VERDE',
  bare = false
}: { 
  state?: 'red' | 'yellow' | 'green' | 'all'; 
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelText?: string;
  bare?: boolean;
}) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const boxClasses = isSm 
    ? 'p-1 gap-1 rounded-xl' 
    : isLg 
    ? 'p-2.5 gap-2 rounded-2xl' 
    : 'p-1.5 gap-1.5 rounded-xl';

  const bulbSize = isSm ? 'w-3 h-3' : isLg ? 'w-5 h-5' : 'w-4 h-4';

  const wrapperClasses = bare
    ? "inline-flex items-center gap-2"
    : "inline-flex items-center gap-2 bg-white/95 border-2 border-ink p-1.5 sm:p-2 rounded-2xl shadow-[3px_3px_0_0_rgba(46,43,39,1)]";

  return (
    <div className={wrapperClasses}>
      {/* Caixa do Semáforo */}
      <div className={`flex flex-col bg-neutral-900 border-2 border-ink ${boxClasses} shadow-[1px_1px_0_0_rgba(46,43,39,1)] relative`}>
        {/* Luz Vermelha */}
        <div className={`${bulbSize} rounded-full border border-black/40 transition-all ${
          state === 'red' || state === 'all'
            ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
            : 'bg-red-950/80 opacity-40'
        }`} />

        {/* Luz Amarela */}
        <div className={`${bulbSize} rounded-full border border-black/40 transition-all ${
          state === 'yellow' || state === 'all'
            ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
            : 'bg-amber-950/80 opacity-40'
        }`} />

        {/* Luz Verde com Ícone de Bike */}
        <div className={`${bulbSize} rounded-full border border-black/40 transition-all flex items-center justify-center relative overflow-hidden ${
          state === 'green' || state === 'all'
            ? 'bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse'
            : 'bg-emerald-950/80 opacity-40'
        }`}>
          <Bike className={`${isSm ? 'w-2 h-2' : isLg ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} text-ink stroke-[3]`} />
        </div>
      </div>

      {showLabel && (
        <div className="flex flex-col pr-1">
          <span className="text-[9px] font-mono font-bold text-ink/60 uppercase tracking-widest leading-none">Semáforo</span>
          <span className="text-xs font-mono font-black text-ink uppercase tracking-wider leading-tight">{labelText}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Placa Amarela de Advertência (A-30a: Trânsito de Ciclistas)
 */
export function WarningBikeSign({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const containerSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="relative inline-flex items-center justify-center p-1">
      <div className={`${containerSize} bg-amber-400 border-2 border-ink rounded-lg rotate-45 flex items-center justify-center shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-transform hover:scale-105`}>
        <div className="w-[85%] h-[85%] border border-ink/40 rounded-sm flex items-center justify-center">
          <Bike className={`${iconSize} -rotate-45 text-ink stroke-[2.5]`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Placa Regulamentar de Velocidade Máxima (R-19: 25 km/h)
 */
export function SpeedLimitSign({ speed = 25 }: { speed?: number }) {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white border-2 border-ink rounded-full p-0.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center shrink-0">
      <div className="w-full h-full rounded-full border-2 border-red-600 flex flex-col items-center justify-center text-ink font-mono font-black leading-none bg-white">
        <span className="text-xs sm:text-sm font-black">{speed}</span>
        <span className="text-[7px] font-bold uppercase tracking-tighter text-red-700">km/h</span>
      </div>
    </div>
  );
}

/**
 * Placa Azul Regulamentar de Circulação Exclusiva de Bicicletas (R-34)
 */
export function ExclusiveBikeSign({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-10 h-10 bg-sky-500 border-2 border-ink rounded-full p-0.5 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center shrink-0">
        <div className="w-full h-full rounded-full border border-white/60 flex items-center justify-center">
          <Bike className="w-5 h-5 text-white stroke-[2.5]" />
        </div>
      </div>
      {label && (
        <span className="text-xs font-mono font-bold text-ink bg-white/95 px-2.5 py-1 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Placa Octogonal Vermelha PARE / E-BIKE (R-1)
 */
export function StopBikeSign({ label = 'PREFERÊNCIA DO CICLISTA' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-10 h-10 bg-red-600 text-white border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center shrink-0 [clip-path:polygon(30%_0%,70%_0%,100%_30%,100%_70%,70%_100%,30%_100%,0%_70%,0%_30%)]">
        <span className="font-mono font-black text-[10px] tracking-tight">PARE</span>
      </div>
      {label && (
        <span className="text-xs font-mono font-bold text-ink bg-white/95 px-2.5 py-1 rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Trocadilho 1: Placa PARE ("PARE! Para os Melhores Descontos do Mês")
 */
export function PunStopSign({ 
  text = "PARE! Para os Melhores Descontos da Semana & do Mês",
  subtext = "Não pague caro sem antes comparar a curadoria neutra e auditada!",
  compact = false 
}: { 
  text?: string; 
  subtext?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 bg-red-600 text-white border-2 border-ink px-3 py-1.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
        <div className="w-7 h-7 bg-white text-red-600 border border-ink font-mono font-black text-[9px] flex items-center justify-center shrink-0 [clip-path:polygon(30%_0%,70%_0%,100%_30%,100%_70%,70%_100%,30%_100%,0%_70%,0%_30%)]">
          PARE
        </div>
        <span className="font-mono font-black text-xs tracking-tight uppercase">{text}</span>
      </div>
    );
  }

  return (
    <div className="relative bg-red-600 text-white border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center gap-3.5 overflow-hidden my-2">
      <div className="absolute inset-1 border border-white/40 rounded-xl pointer-events-none" />
      <div className="w-11 h-11 sm:w-13 sm:h-13 bg-white text-red-600 border-2 border-ink font-mono font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)] [clip-path:polygon(30%_0%,70%_0%,100%_30%,100%_70%,70%_100%,30%_100%,0%_70%,0%_30%)]">
        PARE
      </div>

      <div className="flex flex-col relative z-10">
        <span className="font-mono font-black text-sm sm:text-base tracking-tight text-white uppercase leading-tight">
          🛑 {text}
        </span>
        {subtext && (
          <span className="text-xs font-sans text-red-100 font-medium mt-0.5">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Trocadilho 2: Placa DÊ A PREFERÊNCIA ("DÊ PREFERÊNCIA Para o Menor Preço")
 */
export function PunYieldSign({
  text = "DÊ PREFERÊNCIA • Para a loja com menor preço auditado",
  subtext = "Economia direta na compra da sua e-bike urbana ou dobrável"
}: {
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="relative bg-amber-400 text-ink border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center gap-3.5 overflow-hidden my-2">
      <div className="absolute inset-1 border border-ink/20 rounded-xl pointer-events-none" />
      {/* Triângulo Invertido "Dê a Preferência" */}
      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white border-2 border-red-600 flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)] [clip-path:polygon(0%_0%,100%_0%,50%_100%)]">
        <span className="font-mono font-black text-[8px] sm:text-[9px] text-red-600 tracking-tighter text-center leading-none mt-[-8px]">
          DÊ PREF.
        </span>
      </div>

      <div className="flex flex-col relative z-10">
        <span className="font-mono font-black text-sm sm:text-base tracking-tight text-ink uppercase leading-tight">
          🔻 {text}
        </span>
        {subtext && (
          <span className="text-xs font-sans text-ink/80 font-medium mt-0.5">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Trocadilho 3: Placa FISCALIZAÇÃO / RADAR ("RADAR DE OFERTAS 24H")
 */
export function PunRadarSign({
  text = "RADAR DE OFERTAS • Monitoramento 24 Horas em 15+ Lojas",
  subtext = "Identificamos quedas repentinas de preço em tempo real"
}: {
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="relative bg-sky-500 text-white border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center gap-3.5 overflow-hidden my-2">
      <div className="absolute inset-1 border border-white/40 rounded-xl pointer-events-none" />
      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white text-sky-600 border-2 border-ink rounded-xl font-mono font-black text-[9px] flex flex-col items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
        <span className="text-sm">📸</span>
        <span className="text-[7px] font-extrabold leading-none text-ink">RADAR</span>
      </div>

      <div className="flex flex-col relative z-10">
        <span className="font-mono font-black text-sm sm:text-base tracking-tight text-white uppercase leading-tight">
          ⚡ {text}
        </span>
        {subtext && (
          <span className="text-xs font-sans text-sky-100 font-medium mt-0.5">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Trocadilho 4: Placa LOMBADA DE PREÇOS ("LOMBADA! Reduza o preço, não a marcha")
 */
export function PunBumpSign({
  text = "LOMBADA DE PREÇOS • Reduza a fatura, não o ritmo do pedal!",
  subtext = "Garantimos a menor curva de custo do mercado de e-bikes"
}: {
  text?: string;
  subtext?: string;
}) {
  return (
    <div className="relative bg-emerald-600 text-white border-2 border-ink rounded-2xl p-3.5 sm:p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center gap-3.5 overflow-hidden my-2">
      <div className="absolute inset-1 border border-white/40 rounded-xl pointer-events-none" />
      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-amber-400 border-2 border-ink rounded-lg rotate-45 flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
        <span className="-rotate-45 text-ink font-mono font-black text-xs">⚠️</span>
      </div>

      <div className="flex flex-col relative z-10">
        <span className="font-mono font-black text-sm sm:text-base tracking-tight text-white uppercase leading-tight">
          🎢 {text}
        </span>
        {subtext && (
          <span className="text-xs font-sans text-emerald-100 font-medium mt-0.5">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Placa Verde de Orientação de Trânsito / Ciclovia (Estilo rodoviário/urbano)
 */
export function TrafficRouteSign({ 
  title, 
  subtitle,
  direction = 'right'
}: { 
  title: string; 
  subtitle?: string;
  direction?: 'right' | 'left' | 'straight';
}) {
  return (
    <div className="bg-emerald-600 text-white border-2 border-ink rounded-2xl p-3 sm:p-3.5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] inline-flex items-center gap-3 relative overflow-hidden">
      {/* Moldura interna branca clássica das placas de trânsito */}
      <div className="absolute inset-1 border border-white/40 rounded-xl pointer-events-none" />
      
      <div className="w-7 h-7 rounded-xl bg-emerald-800 border border-white/50 flex items-center justify-center text-white shrink-0 relative z-10">
        <Navigation className={`w-4 h-4 ${direction === 'straight' ? '-rotate-45' : direction === 'left' ? '-rotate-90' : ''}`} />
      </div>

      <div className="flex flex-col relative z-10 pr-1">
        <span className="font-mono font-black text-xs sm:text-sm tracking-tight text-white uppercase leading-tight">
          {title}
        </span>
        {subtitle && (
          <span className="text-[10px] font-sans text-emerald-100 font-medium">
            {subtitle}
          </span>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-emerald-200 shrink-0 relative z-10" />
    </div>
  );
}


/**
 * MARCADOR DE TRANSIÇÃO ENTRE SEÇÕES (TIPO PLACA DE SINALIZAÇÃO)
 * Exemplo: PRÓXIMA PARADA: MODELOS EM DESTAQUE
 */
export function SectionSignpostMarker({
  nextSection,
  label = "PRÓXIMA PARADA",
  className = ""
}: {
  nextSection: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 bg-neutral-900 text-white border-2 border-ink px-3.5 py-1.5 rounded-2xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] ${className}`}>
      <div className="w-5 h-5 rounded-lg bg-amber-400 text-ink border border-ink flex items-center justify-center font-mono font-black text-[10px] shrink-0">
        🪧
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs font-black uppercase tracking-wider">
        <span className="text-amber-400">{label}:</span>
        <span className="text-white">{nextSection}</span>
      </div>
    </div>
  );
}
