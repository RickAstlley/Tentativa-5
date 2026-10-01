'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SectionSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SectionProps {
  children: ReactNode;
  size?: SectionSize;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
}

const sizeStyles = {
  sm: 'py-6 sm:py-8',
  md: 'py-8 sm:py-10 lg:py-12',
  lg: 'py-10 sm:py-12 lg:py-16',
  xl: 'py-12 sm:py-16 lg:py-20',
};

export function Section({ 
  children, 
  size = 'md', 
  className, 
  id,
  'aria-labelledby': ariaLabelledby,
}: SectionProps) {
  return (
    <section 
      id={id}
      aria-labelledby={ariaLabelledby}
      className={cn(
        'w-full',
        sizeStyles[size],
        className
      )}
    >
      {children}
    </section>
  );
}

export default Section;