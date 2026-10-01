'use client';

import React from 'react';
import { LayoutGrid, List, Grid3X3 } from 'lucide-react';

export type GridDensityMode = 'editorial' | 'compact' | 'table';

interface GridDensitySwitcherProps {
  mode: GridDensityMode;
  onChange: (mode: GridDensityMode) => void;
  className?: string;
}

export default function GridDensitySwitcher({
  mode,
  onChange,
  className = '',
}: GridDensitySwitcherProps) {
  return (
    <div 
      className={`inline-flex items-center p-1 bg-neutral-100 border-2 border-ink rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] ${className}`}
      role="radiogroup"
      aria-label="Modo de visualização da grade"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'editorial'}
        onClick={() => onChange('editorial')}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          mode === 'editorial'
            ? 'bg-primary text-white shadow-xs'
            : 'text-ink/70 hover:text-ink hover:bg-neutral-200/60'
        }`}
        title="Grade Visual Editorial (Cards Detalhados)"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Visual</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === 'compact'}
        onClick={() => onChange('compact')}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          mode === 'compact'
            ? 'bg-primary text-white shadow-xs'
            : 'text-ink/70 hover:text-ink hover:bg-neutral-200/60'
        }`}
        title="Grade Compacta (Mais modelos por tela)"
      >
        <Grid3X3 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Compacta</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={mode === 'table'}
        onClick={() => onChange('table')}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
          mode === 'table'
            ? 'bg-primary text-white shadow-xs'
            : 'text-ink/70 hover:text-ink hover:bg-neutral-200/60'
        }`}
        title="Lista Técnica Comparativa"
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Tabela</span>
      </button>
    </div>
  );
}
