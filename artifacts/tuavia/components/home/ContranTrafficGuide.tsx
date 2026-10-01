'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRight, BookOpen } from 'lucide-react';

export default function ContranTrafficGuide() {
  const contranUrl = '/artigos/legislacao-bicicletas-eletricas-contran';

  return (
    <div className="w-full bg-white border-2 border-ink rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_rgba(46,43,39,1)] md:shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-6" id="guia-contran-996-visual">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-ink/15 pb-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display font-black text-xl sm:text-2xl text-ink tracking-tight">
            Sinal Verde vs. Sinal Vermelho: O Que Pode e Não Pode Rodar
          </h3>
          <p className="text-xs font-mono text-ink/70">
            Resolução CONTRAN nº 996/2023 • Clique na categoria para ver todas as especificações técnicas
          </p>
        </div>
        
        <Link
          href={contranUrl}
          className="text-xs font-mono font-black text-ink bg-neutral-100 hover:bg-accent-gold border-2 border-ink px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Guia CONTRAN Interativo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid de 2 Colunas: Sinal Verde (E-Bike) vs Sinal Vermelho (Ciclomotor) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        
        {/* COLUNA SINAL VERDE: E-BIKE CONFORME (PEDAL ASSISTIDO) */}
        <Link
          href={`${contranUrl}#pedal-assistido`}
          className="bg-emerald-50 border-2 border-emerald-800 rounded-2xl p-5 shadow-[3px_3px_0_0_rgba(6,78,59,1)] hover:shadow-[5px_5px_0_0_rgba(6,78,59,1)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group cursor-pointer"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                ✓
              </div>
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-900 uppercase">
                  SINAL VERDE (100% LIVRE)
                </span>
                <h4 className="font-display font-black text-base text-emerald-950 group-hover:text-emerald-700 transition-colors">
                  Bicicleta Elétrica / Pedelec
                </h4>
              </div>
            </div>

            <ul className="flex flex-col gap-2 font-mono text-xs text-emerald-950/90">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>Sem CNH e sem emplacamento:</strong> não requer nenhum documento do condutor.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>Permitida em ciclovias e ciclofaixas:</strong> velocidade assistida de até 32 km/h.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span><strong>Motor de até 1000W:</strong> pedal assistido (Pedelec) com corte automático.</span>
              </li>
            </ul>
          </div>

          <div className="w-full text-center py-2.5 rounded-xl bg-white group-hover:bg-emerald-100 border-2 border-emerald-800 font-mono text-xs font-black text-emerald-950 shadow-[2px_2px_0_0_rgba(6,78,59,1)] transition-all flex items-center justify-center gap-1.5">
            <span>Ver Detalhes do Quadrado Verde</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-800" />
          </div>
        </Link>

        {/* COLUNA SINAL VERMELHO: CICLOMOTORES & EXIGÊNCIAS */}
        <Link
          href={`${contranUrl}#ciclomotores`}
          className="bg-rose-50 border-2 border-rose-800 rounded-2xl p-5 shadow-[3px_3px_0_0_rgba(159,18,57,1)] hover:shadow-[5px_5px_0_0_rgba(159,18,57,1)] hover:-translate-y-0.5 transition-all flex flex-col justify-between gap-4 group cursor-pointer"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                !
              </div>
              <div>
                <span className="text-[10px] font-mono font-black text-rose-900 uppercase">
                  ATENÇÃO (EXIGE DOCUMENTO)
                </span>
                <h4 className="font-display font-black text-base text-rose-950 group-hover:text-rose-700 transition-colors">
                  Ciclomotores &amp; Scooters Acima de 32km/h
                </h4>
              </div>
            </div>

            <ul className="flex flex-col gap-2 font-mono text-xs text-rose-950/90">
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span><strong>Proibido em ciclovias:</strong> deve circular obrigatoriamente na via comum de trânsito.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span><strong>Exige Habilitação (ACC ou CNH A):</strong> condutor deve ser maior de 18 anos.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <span><strong>Exige Emplacamento &amp; Registro no Detran:</strong> capacete motociclístico fechado obrigatório.</span>
              </li>
            </ul>
          </div>

          <div className="w-full text-center py-2.5 rounded-xl bg-white group-hover:bg-rose-100 border-2 border-rose-800 font-mono text-xs font-black text-rose-950 shadow-[2px_2px_0_0_rgba(159,18,57,1)] transition-all flex items-center justify-center gap-1.5">
            <span>Ver Detalhes do Quadrado Vermelho</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-800" />
          </div>
        </Link>

      </div>
    </div>
  );
}
