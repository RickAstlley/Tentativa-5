'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  as?: React.ElementType;
  onClick?: () => void;
  href?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-surface border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)]',
  elevated: 'bg-surface border-2 border-ink shadow-[6px_6px_0_0_rgba(46,43,39,1)]',
  outlined: 'bg-transparent border-2 border-ink',
  ghost: 'bg-transparent border-0',
};

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3 sm:p-4',      /* 12px / 16px */
  md: 'p-4 sm:p-5 lg:p-6',  /* 16px / 20px / 24px */
  lg: 'p-5 sm:p-6 lg:p-8',  /* 20px / 24px / 32px */
};

export function Card({ 
  children, 
  variant = 'default',
  padding = 'md',
  className,
  as: Component = 'div',
  onClick,
  href,
}: CardProps) {
  const isInteractive = onClick || href;
  
  const Comp = href ? 'a' : Component;
  
  const classNameBase = cn(
    'rounded-2xl transition-all duration-200',
    variantStyles[variant],
    paddingStyles[padding],
    isInteractive && 'cursor-pointer hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0',
    className
  );

  if (href) {
    return (
      <Comp 
        href={href}
        className={classNameBase}
        onClick={onClick}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp 
      className={classNameBase}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </Comp>
  );
}

export default Card;