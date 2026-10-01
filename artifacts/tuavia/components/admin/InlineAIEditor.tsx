'use client';

import { adminFetch } from '@/lib/ai/clientResponse';
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RotateCcw, ArrowUpDown, Type, X, Loader2, Check } from 'lucide-react';

interface InlineAIEditorProps {
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onReplace: (newText: string) => void;
  selectedText: string;
  onClose: () => void;
}

type AIAction = 'rewrite' | 'expand' | 'simplify' | 'translate' | 'seo' | 'factcheck';

const AI_ACTIONS: Array<{ id: AIAction; label: string; icon: typeof RotateCcw; description: string }> = [
  { id: 'rewrite', label: 'Reescrever', icon: RotateCcw, description: 'Melhora clareza e fluidez mantendo o sentido' },
  { id: 'expand', label: 'Expandir', icon: ArrowUpDown, description: 'Adiciona mais detalhes, exemplos e profundidade' },
  { id: 'simplify', label: 'Simplificar', icon: Type, description: 'Torna mais direto, conciso e fácil de ler' },
  { id: 'translate', label: 'Traduzir (EN)', icon: Sparkles, description: 'Traduz para inglês mantendo o tom original' },
  { id: 'seo', label: 'Otimizar SEO', icon: Sparkles, description: 'Adiciona keywords, melhora estrutura para buscadores' },
  { id: 'factcheck', label: 'Fact-check', icon: Sparkles, description: 'Verifica dados técnicos e corrige imprecisões' },
];

export default function InlineAIEditor({ editorRef, onReplace, selectedText, onClose }: InlineAIEditorProps) {
  const [action, setAction] = useState<AIAction>('rewrite');
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isLoading) handleRun();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading]);

  const handleRun = async () => {
    if (!selectedText.trim()) return;
    
    setIsLoading(true);
    setShowResult(false);
    setResult('');

    let instruction = '';
    switch (action) {
      case 'rewrite': instruction = 'Reescreva este texto mantendo o mesmo significado, mas com uma linguagem mais clara, fluida e profissional.'; break;
      case 'expand': instruction = 'Expanda este texto adicionando mais detalhes, exemplos e profundidade, mantendo o tom original.'; break;
      case 'simplify': instruction = 'Simplifique este texto tornando-o mais direto, conciso e fácil de entender, removendo jargões desnecessários.'; break;
      case 'translate': instruction = 'Traduzir para inglês mantendo o tom e estilo original.'; break;
      case 'seo': instruction = 'Otimize para SEO: adicione keywords relevantes naturalmente, melhore a estrutura com headings, adicione meta description implícita.'; break;
      case 'factcheck': instruction = 'Verifique dados técnicos, números, especificações. Corrija imprecisões. Mantenha apenas informações verificáveis.'; break;
    }

    try {
      const response = await adminFetch('/api/admin/llm/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'rewrite',
          text: selectedText,
          instruction,
          model: 'z-ai/glm-5.3',
        }),
      });
      const data = await response.json();
      setResult(data.text || data.result || selectedText);
      setShowResult(true);
    } catch {
      setResult('Erro ao processar. Tente novamente.');
      setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onReplace(result);
      onClose();
    }
  };

  const actionConfig = AI_ACTIONS.find(a => a.id === action)!;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md bg-white border-2 border-stone-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] animate-in slide-in-from-bottom-4 duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Editor IA Inline"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-stone-900 bg-stone-50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span className="font-black text-stone-900">IA Inline</span>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-mono font-bold rounded border border-amber-300">
            {selectedText.length} chars
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Selector */}
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => { setAction(a.id); setShowResult(false); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                action === a.id
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <a.icon className="w-3.5 h-3.5" />
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-stone-500 font-mono bg-stone-50 p-2 rounded">
          {actionConfig.description}
        </p>

        {/* Selected Text Preview */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 max-h-32 overflow-y-auto">
          <p className="text-xs font-bold text-stone-700 mb-1">Texto selecionado:</p>
          <p className="text-sm text-stone-900 font-mono whitespace-pre-wrap">{selectedText.slice(0, 200)}{selectedText.length > 200 ? '...' : ''}</p>
        </div>

        {/* Run Button */}
        <button
          onClick={handleRun}
          disabled={isLoading || !selectedText.trim()}
          className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-black rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Executar {actionConfig.label}</span>
            </>
          )}
        </button>
      </div>

      {/* Result Preview */}
      {showResult && (
        <div className="border-t-2 border-stone-200 bg-stone-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-stone-900">Resultado</span>
            <span className="text-[10px] font-mono text-stone-500">{result.length} chars</span>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-3 max-h-48 overflow-y-auto">
            <p className="text-sm text-stone-900 whitespace-pre-wrap font-mono">{result}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl border-2 border-emerald-700 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Aplicar e Substituir
            </button>
            <button
              onClick={() => setShowResult(false)}
              className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl border-2 border-stone-300"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 rounded-b-2xl text-center">
        <span className="text-[10px] font-mono text-stone-400">Enter → Executar • Ctrl+Enter → Aplicar • Esc → Fechar</span>
      </div>
    </div>
  );
}