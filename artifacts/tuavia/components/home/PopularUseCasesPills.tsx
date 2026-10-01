'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Zap, 
  ShieldCheck, 
  Mountain, 
  Briefcase, 
  BatteryCharging, 
  Tag, 
  Layers, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface UseCaseItem {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  href: string;
  badge: string;
  colorBg: string;
}

const POPULAR_USE_CASES: UseCaseItem[] = [
  {
    id: 'sem-cnh',
    label: 'Sem CNH (CONTRAN 996)',
    sublabel: 'Pedal assistido até 32km/h',
    icon: ShieldCheck,
    href: '/pesquisa?uso=Urbano',
    badge: '100% Legal',
    colorBg: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-800'
  },
  {
    id: 'subidas-fortes',
    label: 'Para Subidas & Ladeiras',
    sublabel: 'Motores potentes ≥500W',
    icon: Mountain,
    href: '/pesquisa?minPower=500',
    badge: 'Torque Alto',
    colorBg: 'bg-amber-100 hover:bg-amber-200 border-amber-800'
  },
  {
    id: 'dobraveis-metro',
    label: 'Dobráveis & Metrô',
    sublabel: 'Para porta-malas e transporte',
    icon: Layers,
    href: '/pesquisa?uso=Dobrável',
    badge: 'Portátil',
    colorBg: 'bg-blue-100 hover:bg-blue-200 border-blue-800'
  },
  {
    id: 'alta-autonomia',
    label: 'Autonomia Estendida',
    sublabel: 'Baterias para mais de 50km',
    icon: BatteryCharging,
    href: '/pesquisa?minAutonomy=50',
    badge: '+50 km',
    colorBg: 'bg-teal-100 hover:bg-teal-200 border-teal-800'
  },
  {
    id: 'custo-beneficio',
    label: 'Abaixo de R$ 5.000',
    sublabel: 'Melhor entrada no mercado',
    icon: Tag,
    href: '/pesquisa?maxPrice=5000',
    badge: 'Econômica',
    colorBg: 'bg-purple-100 hover:bg-purple-200 border-purple-800'
  },
  {
    id: 'trabalho-entregas',
    label: 'Para Trabalho & Entrega',
    sublabel: 'Robustez e bagageiro reforçado',
    icon: Briefcase,
    href: '/pesquisa?q=trabalho',
    badge: 'Uso Diário',
    colorBg: 'bg-rose-100 hover:bg-rose-200 border-rose-800'
  }
];

export default function PopularUseCasesPills() {
  return (
    <div className="w-full bg-white border-2 border-ink rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 md:p-5 shadow-[3.5px_3.5px_0_0_rgba(46,43,39,1)] flex flex-col gap-3 sm:gap-3.5" id="casos-de-uso-rapidos">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 border-b-2 border-ink/15 pb-2.5 sm:pb-3">
        <div>
          <h3 className="font-display font-black text-base sm:text-lg text-ink tracking-tight">
            Qual é o seu objetivo principal de uso?
          </h3>
        </div>
        <p className="text-[11px] sm:text-xs font-mono text-ink/70">
          Filtre instantaneamente pelo perfil que melhor atende sua rotina:
        </p>
      </div>

      {/* Grid de Casos de Uso com visual Neo-Brutalist de alta taxa de clique */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {POPULAR_USE_CASES.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex flex-col justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-neutral-50 hover:bg-white border-2 border-ink shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer min-h-[96px] sm:min-h-[105px]"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="p-1.5 sm:p-2 rounded-xl bg-accent-gold text-ink border-2 border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] group-hover:scale-105 transition-transform">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[8.5px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-ink text-white">
                  {item.badge}
                </span>
              </div>

              <div className="flex flex-col mt-2">
                <span className="text-[11px] sm:text-xs font-display font-black text-ink group-hover:text-primary transition-colors leading-tight">
                  {item.label}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-mono text-ink/70 mt-0.5 leading-snug line-clamp-1">
                  {item.sublabel}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
