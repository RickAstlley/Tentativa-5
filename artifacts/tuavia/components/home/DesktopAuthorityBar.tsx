'use client';

import React from 'react';
import { ShieldCheck, BatteryCharging, TrendingDown } from 'lucide-react';

export default function DesktopAuthorityBar() {
  return (
    <div className="w-full bg-neutral-900 text-white border-2 border-ink rounded-2xl p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] grid grid-cols-3 gap-4 font-mono">
      <div className="flex items-center gap-3 border-r border-white/15 pr-3">
        <div className="w-10 h-10 rounded-xl bg-amber-400 text-ink flex items-center justify-center shrink-0 border border-ink shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-amber-300 block tracking-wider">
            Legislação Brasileira
          </span>
          <strong className="text-xs text-white block">
            Resolução CONTRAN 996/2023
          </strong>
          <span className="text-[10px] text-white/60 block">
            Sem CNH, sem emplacamento, 100% legal
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 border-r border-white/15 pr-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 border border-ink shadow-xs">
          <BatteryCharging className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider">
            Autonomia Auditada
          </span>
          <strong className="text-xs text-white block">
            Testes no Relevo Real
          </strong>
          <span className="text-[10px] text-white/60 block">
            Medição com ciclista de 75kg e subidas
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 border border-ink shadow-xs">
          <TrendingDown className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-primary/60 block tracking-wider">
            Rastreador de Ofertas
          </span>
          <strong className="text-xs text-white block">
            Preços Auditados a Cada 30 Minutos
          </strong>
          <span className="text-[10px] text-white/60 block">
            Histórico real e sem promoções falsas
          </span>
        </div>
      </div>
    </div>
  );
}
