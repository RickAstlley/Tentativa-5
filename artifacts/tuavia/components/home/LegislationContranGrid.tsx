'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle, FileText, ArrowRight, Bike } from 'lucide-react';

export default function LegislationContranGrid() {
  const contranUrl = '/artigos/legislacao-bicicletas-eletricas-contran';

  const regulations = [
    {
      type: 'Bicicleta Elétrica (Pedal Assistido)',
      badge: 'PERMITIDO NA CICLOVIA',
      badgeColor: 'bg-emerald-500 text-white border-ink',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      anchor: '#pedal-assistido',
      cardStyle: 'hover:border-emerald-600 hover:shadow-[5px_5px_0_0_rgba(6,78,59,1)]',
      specs: [
        'Motor até 1000W (assistência somente ao pedalar)',
        'Corta motor a 32 km/h (sem acelerador manual)',
        'Não precisa de CNH, emplacamento ou IPVA',
        'Obrigatório: campainha, espelho esquerdo e iluminação dianteira/traseira',
      ],
      cicloviaStatus: 'Liberado em ciclovias e ciclofaixas',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    },
    {
      type: 'Equipamento Autopropelido (Com Acelerador)',
      badge: 'PERMITIDO COM LIMITE',
      badgeColor: 'bg-amber-500 text-ink border-ink',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      anchor: '#autopropelidos',
      cardStyle: 'hover:border-amber-600 hover:shadow-[5px_5px_0_0_rgba(180,83,9,1)]',
      specs: [
        'Motor até 1000W com acelerador no punho/polegar',
        'Velocidade máx. de 20 km/h em ciclovias e ciclofaixas',
        'Até 32 km/h em vias com velocidade regulamentada',
        'Obrigatório velocímetro e campainha instalados',
      ],
      cicloviaStatus: 'Permitido respeitando o limite de 20 km/h',
      statusColor: 'text-amber-700 bg-amber-50 border-amber-300',
    },
    {
      type: 'Ciclomotores & Scooters Rápidas',
      badge: 'PROIBIDO NA CICLOVIA',
      badgeColor: 'bg-red-600 text-white border-ink',
      icon: XCircle,
      iconColor: 'text-red-600',
      anchor: '#ciclomotores',
      cardStyle: 'hover:border-red-600 hover:shadow-[5px_5px_0_0_rgba(153,27,27,1)]',
      specs: [
        'Motor acima de 1000W até 4000W ou velocidade > 32 km/h',
        'Exige CNH (Categoria A ou ACC)',
        'Exige registro, emplacamento e capacete fechado',
        'Deve circular obrigatoriamente na pista de rolamento com carros',
      ],
      cicloviaStatus: 'Proibido circular em calçadas e ciclovias',
      statusColor: 'text-red-700 bg-red-50 border-red-300',
    },
  ];

  return (
    <section className="flex flex-col gap-5 w-full" id="guia-legislacao-ciclovia">
      {/* Header com Identidade Visual Forte */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)]">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-display font-black text-xl sm:text-2xl text-ink tracking-tight">
              O que Pode Rodar na Ciclovia? Guia da Lei
            </h2>
          </div>
        </div>
        <p className="text-xs text-ink font-mono font-bold bg-neutral-100 px-3 py-2 rounded-xl border border-ink max-w-sm">
          Evite multas e apreensões: clique no quadrado da sua categoria para ver todos os detalhes legais.
        </p>
      </div>

      {/* Grid de 3 Colunas Neo-Brutalistas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {regulations.map((reg) => {
          const IconComp = reg.icon;
          return (
            <Link
              key={reg.type}
              href={`${contranUrl}${reg.anchor}`}
              className={`bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col justify-between gap-4 relative overflow-hidden transition-all duration-200 group cursor-pointer ${reg.cardStyle}`}
            >
              <div className="flex flex-col gap-3">
                {/* Badge de Status na Ciclovia */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-lg border shadow-[1px_1px_0_0_rgba(46,43,39,1)] ${reg.badgeColor}`}>
                    {reg.badge}
                  </span>
                  <IconComp className={`w-5 h-5 ${reg.iconColor} shrink-0`} />
                </div>

                <h3 className="font-display font-black text-base sm:text-lg text-ink tracking-tight leading-snug group-hover:text-primary transition-colors">
                  {reg.type}
                </h3>

                {/* Status na Ciclovia */}
                <div className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border ${reg.statusColor}`}>
                  {reg.cicloviaStatus}
                </div>

                {/* Lista de Especificações */}
                <ul className="flex flex-col gap-2 pt-2 border-t border-ink/15 text-xs text-ink/85 font-sans">
                  {reg.specs.map((spec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary font-bold text-xs mt-0.5">•</span>
                      <span className="leading-snug">{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botão interativo */}
              <div className="inline-flex items-center justify-between w-full bg-neutral-100 group-hover:bg-primary group-hover:text-white font-mono font-bold text-xs px-3 py-2 rounded-xl border border-ink/30 transition-colors">
                <span>Ver no guia ({reg.type.split(' ')[0]})</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
