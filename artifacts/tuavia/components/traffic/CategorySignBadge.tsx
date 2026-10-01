'use client';

import React from 'react';
import { 
  Bike, 
  Compass, 
  Zap, 
  ShieldAlert, 
  Mountain, 
  Package, 
  Navigation,
  Signpost,
  Wrench,
  Newspaper,
  GitFork
} from 'lucide-react';

interface CategorySignBadgeProps {
  category: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  active?: boolean;
  onClick?: () => void;
  className?: string;
  showIcon?: boolean;
}

export function getCategoryIcon(cat: string) {
  const c = cat.toLowerCase();

  // Categorias de Artigos / Hub Editorial
  if (c.includes('guia de compra') || c.includes('guia')) return <Signpost className="w-3 h-3 text-amber-600 stroke-[2.5]" />;
  if (c.includes('legislação') || c.includes('legislacao')) return <ShieldAlert className="w-3 h-3 text-red-600 stroke-[2.5]" />;
  if (c.includes('manutenção') || c.includes('manutencao')) return <Wrench className="w-3 h-3 text-sky-600 stroke-[2.5]" />;
  if (c.includes('notícias') || c.includes('noticias')) return <Newspaper className="w-3 h-3 text-indigo-600 stroke-[2.5]" />;
  if (c.includes('comparativo') || c.includes('comparacao')) return <GitFork className="w-3 h-3 text-emerald-600 stroke-[2.5]" />;

  // Categorias de E-Bikes
  if (c.includes('urbana') || c.includes('cidade')) return <Bike className="w-3 h-3 text-sky-600 stroke-[2.5]" />;
  if (c.includes('trilha') || c.includes('mtb')) return <Mountain className="w-3 h-3 text-emerald-600 stroke-[2.5]" />;
  if (c.includes('dobrável') || c.includes('dobravel')) return <Zap className="w-3 h-3 text-amber-500 stroke-[2.5]" />;
  if (c.includes('cargo') || c.includes('carga')) return <Package className="w-3 h-3 text-purple-600 stroke-[2.5]" />;
  if (c.includes('speed') || c.includes('estrada')) return <Navigation className="w-3 h-3 text-red-500 stroke-[2.5]" />;
  return <Compass className="w-3 h-3 text-primary stroke-[2.5]" />;
}

export default function CategorySignBadge({
  category,
  size = 'sm',
  active = false,
  onClick,
  className = '',
  showIcon = true,
}: CategorySignBadgeProps) {
  const isXs = size === 'xs';
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const sizeClasses = isXs
    ? 'text-[8px] sm:text-[9px] px-2 py-0.5 gap-1'
    : isSm
    ? 'text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-1 gap-1 sm:gap-1.5'
    : isLg
    ? 'text-xs sm:text-sm px-3.5 py-1.5 gap-2'
    : 'text-[10px] sm:text-xs px-2.5 py-1 gap-1.5';

  const activeClasses = active
    ? 'bg-amber-400 text-ink border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
    : 'bg-white text-ink border-ink hover:bg-neutral-50 shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]';

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-mono font-black uppercase tracking-wider border-2 transition-all cursor-pointer whitespace-nowrap shrink-0 rounded-md relative overflow-hidden ${sizeClasses} ${activeClasses} ${className}`}
      style={{
        // Formato sutil de placa de trânsito (cantos chanfrados nos vértices superiores/inferiores)
        clipPath: 'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)'
      }}
    >
      {/* Linha interna decorativa estilo placa de trânsito */}
      <span className="absolute inset-[1px] border border-ink/20 pointer-events-none rounded-[3px]" />
      
      {showIcon && (
        <span className="shrink-0 relative z-10">
          {getCategoryIcon(category)}
        </span>
      )}
      <span className="relative z-10 whitespace-nowrap">{category}</span>
    </Component>
  );
}
