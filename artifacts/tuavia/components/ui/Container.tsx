'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ContainerSize = 'narrow' | 'default' | 'wide' | 'full' | 'mobile-full';

export interface ContainerProps {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
  as?: React.ElementType;
}

export function Container({ 
  children, 
  size = 'default', 
  className, 
  as: Component = 'div' 
}: ContainerProps) {
  const sizes = {
    narrow: 'max-w-[var(--container-narrow)]',
    default: 'max-w-[var(--container-default)]',
    wide: 'max-w-[var(--container-wide)]',
    full: 'max-w-full',
    'mobile-full': 'max-w-full',
  };

  // Padding responsivo: mobile-full usa padding mínimo no mobile
  const paddingClasses = size === 'mobile-full' 
    ? 'px-1 sm:px-4 md:px-5 lg:px-6'  // 4px mobile, padrão no desktop
    : 'px-4 sm:px-5 md:px-6 lg:px-8';

  return (
    <Component className={cn(
      'w-full mx-auto',
      paddingClasses,
      sizes[size],
      className
    )}>
      {children}
    </Component>
  );
}

export default Container;