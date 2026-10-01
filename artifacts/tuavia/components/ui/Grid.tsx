'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 12;
export type GridGap = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface GridProps {
  children: ReactNode;
  cols?: GridColumns | { base: GridColumns; sm?: GridColumns; md?: GridColumns; lg?: GridColumns; xl?: GridColumns; '2xl'?: GridColumns };
  gap?: GridGap;
  className?: string;
  as?: React.ElementType;
}

const gapStyles: Record<GridGap, string> = {
  none: 'gap-0',
  sm: 'gap-2 sm:gap-3',      /* 8px / 12px */
  md: 'gap-3 sm:gap-4 lg:gap-5',  /* 12px / 16px / 20px */
  lg: 'gap-4 sm:gap-5 lg:gap-6',  /* 16px / 20px / 24px */
  xl: 'gap-5 sm:gap-6 lg:gap-8',  /* 20px / 24px / 32px */
};

function getGridTemplateColumns(cols: GridProps['cols']): string {
  if (typeof cols === 'number') {
    return `grid-cols-${cols}`;
  }
  if (!cols) return 'grid-cols-1';
  
  const parts: string[] = ['grid-cols-1'];
  if (cols.base) parts[0] = `grid-cols-${cols.base}`;
  if (cols.sm) parts.push(`sm:grid-cols-${cols.sm}`);
  if (cols.md) parts.push(`md:grid-cols-${cols.md}`);
  if (cols.lg) parts.push(`lg:grid-cols-${cols.lg}`);
  if (cols.xl) parts.push(`xl:grid-cols-${cols.xl}`);
  if (cols['2xl']) parts.push(`2xl:grid-cols-${cols['2xl']}`);
  
  return parts.join(' ');
}

export function Grid({ 
  children, 
  cols = { base: 1, sm: 2, md: 3, lg: 4, xl: 5, '2xl': 6 },
  gap = 'md',
  className,
  as: Component = 'div',
}: GridProps) {
  return (
    <Component 
      className={cn(
        'grid',
        getGridTemplateColumns(cols),
        gapStyles[gap],
        className
      )}
    >
      {children}
    </Component>
  );
}

export default Grid;