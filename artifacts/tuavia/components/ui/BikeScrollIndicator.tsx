'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface BikeScrollIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  className?: string;
  label?: string;
  variant?: 'box' | 'minimal' | 'compact';
}

export default function BikeScrollIndicator({
  containerRef,
  className = '',
  label = 'Deslize para ver mais artigos',
  variant = 'box'
}: BikeScrollIndicatorProps) {
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScroll = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 5) {
        setCanScroll(true);
      } else {
        setCanScroll(false);
      }
    };

    updateScroll();
    const timer = setTimeout(updateScroll, 200);

    el.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [containerRef]);

  if (!canScroll) return null;

  if (variant === 'minimal' || variant === 'compact') {
    return (
      <div className={`w-full flex items-center justify-center py-0.5 select-none ${className}`}>
        <div className="inline-flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100/80 text-[8.5px] font-mono font-semibold text-ink/70 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-gold border border-ink animate-pulse shrink-0" />
          <span className="truncate">{label}</span>
          <ArrowLeftRight className="w-2.5 h-2.5 text-primary shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full flex items-center justify-center py-2 select-none ${className}`}>
      {/* Grid Branco Neobrutalista para leitura excelente */}
      <div className="bg-white border-2 border-ink rounded-xl px-4 py-2 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex items-center justify-center gap-2 text-[10px] sm:text-xs font-mono font-bold text-ink uppercase tracking-wider text-center max-w-full">
        <span className="w-2 h-2 rounded-full bg-accent-gold border border-ink animate-pulse shrink-0" />
        <span className="truncate">{label}</span>
        <ArrowLeftRight className="w-3.5 h-3.5 text-primary shrink-0" />
      </div>
    </div>
  );
}

