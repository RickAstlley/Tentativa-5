'use client';

/**
 * components/admin/copilot/CopilotSidebar.tsx
 *
 * Navegação lateral do copilot. Módulo importado por `app/admin/ia/page.tsx`
 * que nunca foi commitado.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { CopilotMode } from '@/types/globalRadar';

export interface CopilotSidebarProps {
  currentMode: CopilotMode;
  onSelectMode: (mode: CopilotMode) => void;
  draftCount?: number;
  onOpenDrafts?: () => void;
  onNewChat?: () => void;
  className?: string;
}

interface ModeEntry {
  id: CopilotMode;
  label: string;
  hint: string;
  icon: string;
}

const MODES: ModeEntry[] = [
  { id: 'chat', label: 'Chat', hint: 'Converse e peça análises', icon: '💬' },
  { id: 'article_writer', label: 'Artigo', hint: 'Escreva um artigo completo', icon: '✍️' },
  { id: 'ebike_analysis', label: 'Ficha de E-Bike', hint: 'Extraia e audite uma ficha', icon: '⚡' },
  { id: 'top_ranking', label: 'Ranking', hint: 'Monte um Top N', icon: '🏆' },
  { id: 'radar_pautas', label: 'Radar', hint: 'Pautas e tendências do setor', icon: '📡' },
  { id: 'audit_anti_hallucination', label: 'Auditoria', hint: 'Anti-alucinação & CONTRAN', icon: '🛡️' },
  { id: 'image_search', label: 'Visual', hint: 'Pesquisa de imagens', icon: '🖼️' },
  { id: 'telemetry', label: 'Status', hint: 'Fila, worker e provedor', icon: '📊' },
  { id: 'llm_panel', label: 'LLM Panel', hint: 'Teste direto de modelos', icon: '🧪' },
];

export function CopilotSidebar({
  currentMode,
  onSelectMode,
  draftCount = 0,
  onOpenDrafts,
  onNewChat,
  className,
}: CopilotSidebarProps): React.ReactElement {
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col gap-4 border-r border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950',
        className
      )}
      aria-label="Modos do copilot"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs font-extrabold uppercase tracking-wider text-stone-500">
          Copilot
        </h2>
        {onNewChat ? (
          <button
            type="button"
            onClick={onNewChat}
            className="rounded-md border border-stone-300 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            Novo chat
          </button>
        ) : null}
      </div>

      <nav className="flex flex-col gap-1.5">
        {MODES.map((mode) => {
          const active = currentMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                active
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-transparent hover:bg-stone-100 dark:hover:bg-stone-800'
              )}
            >
              <span aria-hidden className="text-base leading-none">
                {mode.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                  {mode.label}
                </span>
                <span className="block truncate text-[10px] text-stone-500">{mode.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {onOpenDrafts ? (
        <button
          type="button"
          onClick={onOpenDrafts}
          className="mt-auto flex items-center justify-between rounded-lg border border-dashed border-stone-300 px-2.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900"
        >
          Rascunhos salvos
          <span className="rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-stone-100 dark:text-stone-900">
            {draftCount}
          </span>
        </button>
      ) : null}
    </aside>
  );
}

export default CopilotSidebar;
