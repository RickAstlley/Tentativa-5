'use client';

/**
 * components/admin/ui.tsx
 *
 * Primitivas visuais do painel (Card, Button, Badge, Field). O import antigo
 * `@/components/admin/ui` apontava para um diretório que não existe.
 *
 * `Button` aceita `asChild` para renderizar um <Link> com a mesma aparência —
 * é assim que o dashboard navega sem duplicar estilos.
 */

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ────────────────────────────── Card ────────────────────────────── */

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hover?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: 'border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900',
  elevated: 'border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900',
  outlined: 'border-2 border-dashed border-stone-300 bg-transparent dark:border-stone-700',
  ghost: 'border-0 bg-transparent',
};

const CARD_PADDINGS: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  /**
   * `Tag` é `div`, `section`, `article` ou `li`, mas `CardProps` estende
   * `HTMLAttributes<HTMLDivElement>`. Quando renderizado como `li`, o TypeScript
   * reconcilia para a união de todos os elementos possíveis e reclama dos
   * atributos. O cast documenta a intenção: o `Card` não se importa com a tag.
   */
  const TagAny = Tag as React.ElementType;
  return (
    <TagAny
      className={cn(
        'rounded-xl transition-colors',
        CARD_VARIANTS[variant],
        CARD_PADDINGS[padding],
        hover && 'hover:border-emerald-500/50',
        className
      )}
      {...rest}
    >
      {children}
    </TagAny>
  );
}

/* ────────────────────────────── Button ──────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Renderiza como <Link> herdando a aparência. */
  asChild?: boolean;
  href?: string;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800 hover:border-emerald-800',
  secondary:
    'bg-stone-900 text-white border-stone-900 hover:bg-stone-700 hover:border-stone-700 dark:bg-stone-100 dark:text-stone-900',
  ghost:
    'bg-transparent text-stone-700 border-transparent hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
  outline:
    'bg-transparent text-stone-800 border-stone-900 hover:bg-stone-900 hover:text-white dark:text-stone-200',
  danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-[11px]',
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  asChild = false,
  href,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);

  if (asChild && href) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || loading || undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/* ────────────────────────────── Badge ───────────────────────────── */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-300',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ────────────────────────────── Field ───────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="flex items-center gap-1 text-xs font-bold text-stone-700 dark:text-stone-300">
        {label}
        {required ? <span className="text-red-600">*</span> : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-[11px] text-stone-500">{hint}</span>
      ) : null}
      {error ? (
        <span className="block text-[11px] font-semibold text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border-2 border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-colors focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';
