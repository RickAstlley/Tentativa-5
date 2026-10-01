'use client';

import React, { useState, useEffect } from 'react';
import { TrafficLight } from '@/components/traffic/TrafficDecorations';

interface TrafficLightLoaderProps {
  label?: string;
  className?: string;
}

const LIGHT_STATES: Array<'red' | 'yellow' | 'green'> = ['red', 'yellow', 'green'];

/**
 * Componente de Carregamento de Página Baseado no Semáforo de Trânsito
 * Alterna ciclicamente as luzes (Vermelho -> Amarelo -> Verde) a cada 550ms
 */
export default function TrafficLightLoader({
  label = "Sinalizando rota e ofertas...",
  className = ""
}: TrafficLightLoaderProps) {
  const [lightIndex, setLightIndex] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLightIndex((prev) => (prev + 1) % LIGHT_STATES.length);
    }, 550);

    return () => clearInterval(interval);
  }, []);

  const currentState = LIGHT_STATES[lightIndex];

  return (
    <div className={`inline-flex items-center gap-3.5 bg-white/95 border-2 border-ink p-3 sm:p-4 rounded-2xl shadow-[4px_4px_0_0_rgba(46,43,39,1)] ${className}`}>
      {/* Semáforo em Ciclo Automático sem Label Interna */}
      <TrafficLight state={currentState} size="md" showLabel={false} />

      {/* Rótulo de Carregamento */}
      <div className="flex flex-col text-left pr-1">
        <span className="text-[10px] font-mono font-bold text-ink/60 uppercase tracking-widest leading-none">
          Carregando TuaVia
        </span>
        <span className="text-xs sm:text-sm font-mono font-black text-ink uppercase tracking-wider leading-tight mt-0.5">
          {label}
        </span>
      </div>
    </div>
  );
}
