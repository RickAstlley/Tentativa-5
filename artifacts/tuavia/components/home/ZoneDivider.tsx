'use client';

import React from 'react';

interface ZoneDividerProps {
  zoneNumber: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accentColor?: string;
}

export default function ZoneDivider({
  zoneNumber,
  title,
  subtitle,
  icon: Icon,
  accentColor = 'bg-accent-gold'
}: ZoneDividerProps) {
  return (
    <div className="w-full flex flex-col gap-2 py-2">
      {/* Linha tracejada divisora */}
      <div className="-mx-4 sm:-mx-5 w-[calc(100%+2rem)] sm:w-[calc(100%+2.5rem)] py-1 overflow-hidden">
        <div className="w-full border-t-2 border-dashed border-ink/30" />
      </div>

      {/* Card Branco de Alto Contraste Compacto */}
      <div className="w-full bg-white border-2 border-ink rounded-2xl p-3 sm:p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${accentColor} border-2 border-ink text-ink font-mono font-black text-xs sm:text-sm flex items-center justify-center shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] shrink-0`}>
            {zoneNumber}
          </span>
          <h2 className="text-xs sm:text-sm font-display font-black text-ink tracking-tight flex items-center gap-1.5 truncate">
            <Icon className="w-4 h-4 text-ink shrink-0" />
            <span className="truncate">{title}</span>
          </h2>
        </div>

        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-ink bg-neutral-100 px-2.5 py-1 rounded-lg border border-ink/20 shadow-xs shrink-0 whitespace-nowrap">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
