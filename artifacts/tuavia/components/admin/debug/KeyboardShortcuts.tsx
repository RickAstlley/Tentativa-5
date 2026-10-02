'use client';

/**
 * components/admin/debug/KeyboardShortcuts.tsx
 *
 * Atalhos de teclado do painel + painel de ajuda. O layout do admin importa
 * este módulo, que nunca foi commitado — sem ele o shell não renderiza.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ShortcutEntry {
  keys: string;
  label: string;
}

/** Atalvos de navegação. Combinados em sequência: "g" e depois a letra. */
export const SEQUENCE_SHORTCUTS: Record<string, string> = {
  d: '/admin',
  c: '/admin/configuracoes',
  a: '/admin/artigos',
  r: '/admin/rankings',
  b: '/admin/bikes',
  n: '/admin/criar',
};

export const SIMPLE_SHORTCUTS: ShortcutEntry[] = [
  { keys: '⌘K / Ctrl+K', label: 'Paleta de comandos' },
  { keys: 'G então D', label: 'Dashboard' },
  { keys: 'G então A', label: 'Artigos' },
  { keys: 'G então B', label: 'E-Bikes' },
  { keys: 'G então R', label: 'Rankings' },
  { keys: 'G então C', label: 'Configurações' },
  { keys: 'G então N', label: 'Criar novo' },
  { keys: '?', label: 'Mostrar esta ajuda' },
  { keys: 'Esc', label: 'Fechar overlays' },
];

const SEQUENCE_TIMEOUT_MS = 1200;

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'SELECT' ||
        element.isContentEditable)
  );
}

export function useKeyboardShortcuts(): void {
  const router = useRouter();
  const sequenceRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSequence = useCallback(() => {
    sequenceRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === '?' && !isTyping(event.target)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('tuavia:toggle-shortcuts'));
        return;
      }

      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      if (sequenceRef.current) {
        const href = SEQUENCE_SHORTCUTS[key];
        resetSequence();
        if (href) {
          event.preventDefault();
          router.push(href);
        }
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        sequenceRef.current = true;
        timerRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router, resetSequence]);
}

export function KeyboardShortcutsHelp({
  className,
  defaultOpen = false,
}: {
  className?: string;
  defaultOpen?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === '?' && !isTyping(event.target)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    function onToggle(): void {
      setOpen((value) => !value);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('tuavia:toggle-shortcuts', onToggle);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('tuavia:toggle-shortcuts', onToggle);
    };
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Atalhos de teclado"
        className={cn(
          'fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-900 hover:text-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200',
          className
        )}
      >
        <Keyboard className="h-3.5 w-3.5" />
        Atalhos
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 w-72 rounded-xl border-2 border-stone-900 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900',
        className
      )}
      role="dialog"
      aria-label="Atalhos de teclado"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
          Atalhos de teclado
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {SIMPLE_SHORTCUTS.map((shortcut) => (
          <li key={shortcut.keys} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-stone-600 dark:text-stone-400">{shortcut.label}</span>
            <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {shortcut.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default KeyboardShortcutsHelp;
