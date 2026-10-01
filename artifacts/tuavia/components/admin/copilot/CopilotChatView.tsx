'use client';

/**
 * components/admin/copilot/CopilotChatView.tsx
 *
 * Transcrição do chat do copilot, com seletor de tarefa, ações rápidas geradas
 * pela IA e caixa de raciocínio. Módulo importado por `app/admin/ia/page.tsx`
 * que nunca foi commitado.
 */

import React, { useEffect, useRef } from 'react';
import { Send, Sparkles, Brain, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AITask } from '@/lib/ai/types';
import type { QuickActionItem } from '@/lib/ai/validation/schemas';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  /** Horário de exibição, `HH:MM`. Vem do relógio do browser, não do servidor. */
  timestamp?: string;
  createdAt?: string;
  /** Tarefa que originou a mensagem, para reenviar o mesmo contexto. */
  task?: AITask;
}

export interface CopilotChatViewProps {
  messages: ChatMessage[];
  inputMessage: string;
  setInputMessage: (value: string) => void;
  selectedTask: AITask;
  setSelectedTask: (task: AITask) => void;
  isGenerating: boolean;
  onSendMessage: (textToSend?: string, taskOverride?: AITask) => void;
  quickActions: QuickActionItem[];
  isGeneratingActions: boolean;
  selectedTheme: string | null;
  setSelectedTheme: (theme: string | null) => void;
  onGenerateQuickActions: () => void;
  actionReasoning: string | null;
  showReasoningBox: boolean;
  setShowReasoningBox: (show: boolean) => void;
  /**
   * Resumo da última geração de ações. Aceita string ou um objeto com `model`:
   * um objeto completo não pode ser renderizado direto, porque React não aceita
   * objeto como filho.
   */
  lastGeneratedInfo?: string | { model?: string; theme?: string; time?: string };
  brainstormThemes?: Array<string | { id: string; label: string; desc?: string }>;
  onForwardToAudit?: (payload: unknown) => void;
}

const TASKS: Array<{ id: AITask; label: string }> = [
  { id: 'chat', label: 'Conversa' },
  { id: 'content_generation', label: 'Conteúdo' },
  { id: 'ebike_autofill', label: 'Ficha de e-bike' },
  { id: 'ranking_generation', label: 'Ranking' },
  { id: 'radar_scan', label: 'Radar' },
];

export function CopilotChatView(props: CopilotChatViewProps): React.ReactElement {
  const {
    messages,
    inputMessage,
    setInputMessage,
    selectedTask,
    setSelectedTask,
    isGenerating,
    onSendMessage,
    quickActions,
    isGeneratingActions,
    selectedTheme,
    setSelectedTheme,
    onGenerateQuickActions,
    actionReasoning,
    showReasoningBox,
    setShowReasoningBox,
    lastGeneratedInfo,
    brainstormThemes,
  } = props;

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isGenerating && inputMessage.trim()) onSendMessage();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
          Tarefa
          <select
            value={selectedTask}
            onChange={(event) => setSelectedTask(event.target.value as AITask)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
          >
            {TASKS.map((task) => (
              <option key={task.id} value={task.id}>
                {task.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onGenerateQuickActions}
          disabled={isGeneratingActions}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Sugerir ações
        </button>

        {selectedTheme ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            {selectedTheme}
          </span>
        ) : null}

        {lastGeneratedInfo ? (
          <span className="text-[10px] text-stone-400">
            {typeof lastGeneratedInfo === 'string'
              ? lastGeneratedInfo
              : (lastGeneratedInfo.model ?? '')}
          </span>
        ) : null}
      </div>

      {quickActions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setSelectedTheme(action.title);
                setInputMessage(action.prompt ?? action.description);
              }}
              className="rounded-full border border-stone-300 px-2.5 py-1 text-[11px] text-stone-600 hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:text-stone-400"
              title={action.description}
            >
              {action.icon ? `${action.icon} ` : ''}
              {action.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Brain className="h-6 w-6 text-stone-400" />
            <p className="text-xs text-stone-500">
              Pergunte sobre o catálogo, a Regulação CONTRAN, specs ou preços.
            </p>
            {brainstormThemes && brainstormThemes.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {brainstormThemes.map((theme, idx) => {
                  const themeKey = typeof theme === 'string' ? theme : theme.id || String(idx);
                  const themeLabel = typeof theme === 'string' ? theme : theme.label || theme.id;
                  const themePrompt = typeof theme === 'string' ? theme : theme.desc ? `${theme.label} - ${theme.desc}` : theme.label;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => {
                        setSelectedTheme(themeLabel);
                        setInputMessage(themePrompt);
                      }}
                      className="rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-[11px] text-stone-500 hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700"
                    >
                      <Lightbulb className="mr-1 inline h-3 w-3" />
                      {themeLabel}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
              message.role === 'user'
                ? 'ml-auto bg-emerald-700 text-white'
                : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-100'
            )}
          >
            {message.content}
            {message.model || message.createdAt || message.timestamp ? (
              <span className="mt-1 block text-right font-mono text-[9px] opacity-60">
                {message.model || message.createdAt || message.timestamp}
              </span>
            ) : null}
          </div>
        ))}

        {isGenerating ? (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Consultando a IA…
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {showReasoningBox ? (
        <div className="rounded-lg border border-dashed border-stone-300 p-2 dark:border-stone-700">
          <button
            type="button"
            onClick={() => setShowReasoningBox(!showReasoningBox)}
            className="flex w-full items-center gap-1.5 text-[11px] font-bold text-stone-500"
          >
            {showReasoningBox ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Raciocínio
          </button>
          {showReasoningBox ? (
            <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-stone-500">
              {actionReasoning || 'Sem raciocínio registrado para esta ação.'}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          value={inputMessage}
          onChange={(event) => setInputMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Escreva sua pergunta ou pedido…  (Enter envia, Shift+Enter quebra linha)"
          className="flex-1 resize-none rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />
        <button
          type="button"
          onClick={() => onSendMessage()}
          disabled={isGenerating || !inputMessage.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Enviar
        </button>
      </div>
    </div>
  );
}

export default CopilotChatView;
