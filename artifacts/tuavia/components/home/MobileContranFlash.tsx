'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function MobileContranFlash() {
  const contranUrl = '/artigos/legislacao-bicicletas-eletricas-contran';

  return (
    <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-2.5">
      {/* Header interno */}
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[10px] font-mono font-black text-ink uppercase tracking-wider">
            Resolução CONTRAN 996/2023 em 60s
          </span>
        </div>
        <span className="text-[8px] font-mono font-bold bg-amber-100 border border-ink/30 text-ink px-1.5 py-0.5 rounded">
          Guia Legal
        </span>
      </div>

      {/* Grid 3 Colunas de Regras Legais - Cada card envia direto ao seu quadrado no guia */}
      <div className="grid grid-cols-3 gap-1.5">
        
        {/* 1. Pedal Assistido (Verde) */}
        <Link
          href={`${contranUrl}#pedal-assistido`}
          className="bg-emerald-50/70 hover:bg-emerald-100/90 border-2 border-emerald-600 rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-[1px_1px_0_0_rgba(6,78,59,1)] group cursor-pointer"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[7.5px] font-mono font-black bg-emerald-600 text-white px-1 py-0.2 rounded">
                CICLOVIA
              </span>
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            </div>
            <h4 className="text-[9.5px] font-display font-black text-ink leading-tight mt-0.5 group-hover:text-emerald-800">
              Pedal Assistido
            </h4>
            <p className="text-[8px] font-mono text-ink/75 leading-tight">
              Até 1000W e 32 km/h. Sem acelerador.
            </p>
          </div>
          <span className="text-[7.5px] font-mono font-bold text-emerald-800 mt-1 flex items-center justify-between">
            <span>✓ Sem CNH / Placa</span>
            <span className="text-emerald-700 underline font-black">Ver ▶</span>
          </span>
        </Link>

        {/* 2. Com Acelerador / Autopropelido (Amarelo) */}
        <Link
          href={`${contranUrl}#autopropelidos`}
          className="bg-amber-50/70 hover:bg-amber-100/90 border-2 border-amber-600 rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-[1px_1px_0_0_rgba(180,83,9,1)] group cursor-pointer"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[7.5px] font-mono font-black bg-amber-500 text-ink px-1 py-0.2 rounded">
                MÁX 20 KM/H
              </span>
              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
            </div>
            <h4 className="text-[9.5px] font-display font-black text-ink leading-tight mt-0.5 group-hover:text-amber-900">
              Autopropelido
            </h4>
            <p className="text-[8px] font-mono text-ink/75 leading-tight">
              Com acelerador. 20 km/h na ciclovia.
            </p>
          </div>
          <span className="text-[7.5px] font-mono font-bold text-amber-900 mt-1 flex items-center justify-between">
            <span>⚠️ Exige velocímetro</span>
            <span className="text-amber-800 underline font-black">Ver ▶</span>
          </span>
        </Link>

        {/* 3. Ciclomotor (Vermelho) */}
        <Link
          href={`${contranUrl}#ciclomotores`}
          className="bg-red-50/70 hover:bg-red-100/90 border-2 border-red-600 rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-[1px_1px_0_0_rgba(153,27,27,1)] group cursor-pointer"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[7.5px] font-mono font-black bg-red-600 text-white px-1 py-0.2 rounded">
                PROIBIDO
              </span>
              <XCircle className="w-3 h-3 text-red-600 shrink-0" />
            </div>
            <h4 className="text-[9.5px] font-display font-black text-ink leading-tight mt-0.5 group-hover:text-red-900">
              Ciclomotor
            </h4>
            <p className="text-[8px] font-mono text-ink/75 leading-tight">
              &gt;1000W ou &gt;32 km/h. Só na rua.
            </p>
          </div>
          <span className="text-[7.5px] font-mono font-bold text-red-800 mt-1 flex items-center justify-between">
            <span>✕ Exige CNH / Placa</span>
            <span className="text-red-700 underline font-black">Ver ▶</span>
          </span>
        </Link>

      </div>

      {/* Link de aprofundamento */}
      <div className="flex items-center justify-between pt-1 border-t border-ink/5">
        <span className="text-[8px] font-mono text-ink/60">
          Quer saber todas as normas e exigências?
        </span>
        <Link
          href={contranUrl}
          className="text-[8.5px] font-mono font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          <span>Abrir Guia CONTRAN Interativo</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </Link>
      </div>
    </div>
  );
}
