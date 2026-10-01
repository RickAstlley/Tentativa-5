'use client';

import { adminFetch } from '@/lib/ai/clientResponse';
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Copy,
  ClipboardList,
  Settings,
  GitBranch,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface FreeModel {
  id: string;
  name: string;
  category: string;
  contextWindow: number;
  free: boolean;
  multimodal?: boolean;
  status?: 'available' | 'unavailable' | 'unconfigured' | 'error' | 'unknown';
  latencyMs?: number;
}

interface PingResult {
  modelId: string;
  modelName: string;
  success: boolean;
  latencyMs: number;
  text?: string;
  error?: string;
}

interface AgentStep {
  modelId: string;
  modelName: string;
  prompt: string;
  result?: string;
  error?: string;
}

export default function LLMPanel() {
  const [models, setModels] = useState<FreeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState<Set<string>>(new Set());
  const [pingResults, setPingResults] = useState<PingResult[]>([]);
  const [agentMode, setAgentMode] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const fetchModels = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/llm/free-models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (e) {
      console.error('Failed to fetch models:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const pingModel = async (model: FreeModel) => {
    const newPinging = new Set(pinging);
    newPinging.add(model.id);
    setPinging(newPinging);

    const startTime = Date.now();
    try {
      const res = await adminFetch('/api/admin/llm/nvidia-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.id,
          prompt: 'Responda apenas: "Pong - modelo funcionando"',
          maxTokens: 50,
          temperature: 0.1,
        }),
      });
      const latency = Date.now() - startTime;
      const data = await res.json();

      const result: PingResult = {
        modelId: model.id,
        modelName: model.name,
        success: data.success === true,
        latencyMs: latency,
        text: data.result?.text || data.result?.result?.text,
        error: data.error,
      };

      setPingResults(prev => {
        const filtered = prev.filter(r => r.modelId !== model.id);
        return [result, ...filtered];
      });

      setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: result.success ? 'available' : 'unavailable', latencyMs: latency } : m));
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const result: PingResult = {
        modelId: model.id,
        modelName: model.name,
        success: false,
        latencyMs: latency,
        error: err.message,
      };
      setPingResults(prev => [result, ...prev.filter(r => r.modelId !== model.id)]);
      setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'error', latencyMs: latency } : m));
    } finally {
      const newPinging = new Set(pinging);
      newPinging.delete(model.id);
      setPinging(newPinging);
    }
  };

  const pingAll = async () => {
    const availableModels = models.filter(m => m.status !== 'unconfigured');
    await Promise.allSettled(availableModels.map(m => pingModel(m)));
  };

  const runAgentChain = async () => {
    if (agentSteps.length === 0) return;
    setAgentRunning(true);

    let previousOutput = '';
    for (let i = 0; i < agentSteps.length; i++) {
      const step = agentSteps[i];
      const fullPrompt = previousOutput ? `${step.prompt}\n\nContexto anterior:\n${previousOutput}` : step.prompt;

      try {
        const res = await adminFetch('/api/admin/llm/nvidia-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: step.modelId, prompt: fullPrompt, maxTokens: 1000, temperature: 0.3 }),
        });
        const data = await res.json();
        const output = data.result?.text || data.result?.result?.text || '';
        setAgentSteps(prev => prev.map((s, idx) => idx === i ? { ...s, result: output } : s));
        previousOutput = output;
      } catch (err: any) {
        setAgentSteps(prev => prev.map((s, idx) => idx === i ? { ...s, error: err.message } : s));
        break;
      }
    }
    setAgentRunning(false);
  };

  const addAgentStep = () => {
    const availableModels = models.filter(m => m.status === 'available');
    if (availableModels.length === 0) return;
    setAgentSteps(prev => [...prev, { modelId: availableModels[0].id, modelName: availableModels[0].name, prompt: '' }]);
  };

  const copyResults = () => {
    const output = pingResults.map(r => `${r.modelName} (${r.latencyMs}ms): ${r.success ? 'OK' : 'ERRO'} - ${r.error || r.text?.slice(0, 100) || ''}`).join('\n');
    navigator.clipboard.writeText(output);
  };

  const copyAgentOutput = () => {
    const lastStep = agentSteps[agentSteps.length - 1];
    if (lastStep?.result) navigator.clipboard.writeText(lastStep.result);
  };

  const getStatusBadge = (status: FreeModel['status']) => {
    const styles = {
      available: 'bg-emerald-500 text-white',
      unavailable: 'bg-rose-500 text-white',
      unconfigured: 'bg-stone-500 text-white',
      error: 'bg-amber-500 text-stone-950',
      unknown: 'bg-stone-400 text-white',
    };
    const labels = { available: 'Disponível', unavailable: 'Indisponível', unconfigured: 'Sem API Key', error: 'Erro', unknown: 'Desconhecido' };
    return <span className={cn('px-2 py-0.5 rounded text-[10px] font-mono font-bold', styles[status || 'unknown'])}>{labels[status || 'unknown']}</span>;
  };

  const categoryColors: Record<string, string> = {
    reasoning: 'bg-purple-100 text-purple-800',
    chat: 'bg-blue-100 text-blue-800',
    multimodal: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 border-2 border-stone-900 rounded-xl flex items-center justify-center text-amber-800">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900">LLM Panel - Modelos Free NVIDIA</h2>
            <p className="text-stone-500 text-xs">Teste ping paralelo e encadeie agentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchModels}
            disabled={loading}
            className={cn('px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5', loading && 'opacity-60')}
          >
            <Loader2 className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Atualizar
          </button>
          <button onClick={pingAll} disabled={pinging.size > 0 || loading} className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-stone-900 bg-emerald-500 hover:bg-emerald-600 text-white transition-colors flex items-center gap-1.5 disabled:opacity-60">
            <Zap className="w-3.5 h-3.5" /> Ping All
          </button>
          <button onClick={copyResults} disabled={pingResults.length === 0} className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1.5 disabled:opacity-60">
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
          <button onClick={() => setAgentMode(!agentMode)} className={cn('px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors flex items-center gap-1.5', agentMode ? 'bg-emerald-500 text-white border-emerald-700' : 'bg-stone-100 border-stone-900 hover:bg-stone-200')}>
            <GitBranch className="w-3.5 h-3.5" /> {agentMode ? 'Sair Agent' : 'Agent Mode'}
          </button>
        </div>
      </div>

      {!agentMode ? (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-stone-900 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    <th className="pb-2 pr-4">Modelo</th>
                    <th className="pb-2 pr-4">Categoria</th>
                    <th className="pb-2 pr-4">Context</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Latência</th>
                    <th className="pb-2 pr-4">Último Ping</th>
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(model => {
                    const result = pingResults.find(r => r.modelId === model.id);
                    const isPinging = pinging.has(model.id);
                    const expanded = expandedResults.has(model.id);

                    return (
                      <tr key={model.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-bold text-stone-900">{model.name}</div>
                          <div className="text-[10px] font-mono text-stone-400">{model.id}</div>
                          {model.multimodal && <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">Multimodal</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold', categoryColors[model.category] || 'bg-stone-100 text-stone-700')}>
                            {model.category}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-stone-600 font-mono text-[11px]">{(model.contextWindow / 1000).toFixed(0)}k</td>
                        <td className="py-3 pr-4">{getStatusBadge(model.status)}</td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-stone-600">
                          {model.latencyMs ? `${model.latencyMs}ms` : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          {result ? (
                            <div className="flex items-center gap-2">
                              <span className={cn('w-2 h-2 rounded-full', result.success ? 'bg-emerald-500' : 'bg-rose-500')} />
                              <span className="text-[10px] font-mono">{result.latencyMs}ms</span>
                            </div>
                          ) : (
                            <span className="text-stone-400 text-[10px]">Nunca testado</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => pingModel(model)}
                              disabled={isPinging || loading}
                              className={cn('p-1.5 rounded-lg border-2 transition-colors flex items-center', isPinging ? 'bg-amber-100 border-amber-500 text-amber-700 cursor-wait' : 'bg-stone-100 border-stone-900 hover:bg-stone-200 text-stone-700')}
                              title="Pingar"
                            >
                              {isPinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            </button>
                            {result && (
                              <button
                                onClick={() => setExpandedResults(prev => prev.has(model.id) ? new Set([...prev].filter(id => id !== model.id)) : new Set([...prev, model.id]))}
                                className="p-1.5 rounded-lg border-2 bg-stone-100 border-stone-900 hover:bg-stone-200 text-stone-700 transition-colors"
                                title={expanded ? 'Recolher' : 'Expandir'}
                              >
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pingResults.length > 0 && (
            <details className="mt-6 group">
              <summary className="flex items-center gap-2 cursor-pointer font-bold text-sm text-stone-700">
                <ClipboardList className="w-4 h-4" />
                Resultados detalhados dos pings
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180 ml-auto" />
              </summary>
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {pingResults.map((r, i) => (
                  <div key={`${r.modelId}-${i}`} className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('w-2 h-2 rounded-full', r.success ? 'bg-emerald-500' : 'bg-rose-500')} />
                      <span className="font-bold text-stone-900">{r.modelName}</span>
                      <span className="text-stone-500">{r.latencyMs}ms</span>
                    </div>
                    {r.error && <div className="text-rose-600">Erro: {r.error}</div>}
                    {r.text && !r.error && <div className="text-stone-700 line-clamp-2">{r.text}</div>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 text-amber-900 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold text-sm">Agent Mode: encadeie modelos sequencialmente</span>
            </div>
            <p className="text-amber-800 text-xs">A saída de cada modelo vira contexto do próximo. Use para refinamento progressivo.</p>
          </div>

          <div className="space-y-3">
            {agentSteps.map((step, idx) => (
              <div key={idx} className="bg-stone-50 border-2 border-stone-900 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">Passo {idx + 1}</span>
                  <button onClick={() => setAgentSteps(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-rose-500 hover:text-rose-700">✕</button>
                </div>
                <select
                  value={step.modelId}
                  onChange={e => setAgentSteps(prev => prev.map((s, i) => i === idx ? { ...s, modelId: e.target.value, modelName: models.find(m => m.id === e.target.value)?.name || e.target.value } : s))}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {models.filter(m => m.status === 'available').map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
                  ))}
                </select>
                <textarea
                  value={step.prompt}
                  onChange={e => setAgentSteps(prev => prev.map((s, i) => i === idx ? { ...s, prompt: e.target.value } : s))}
                  placeholder="Prompt para este passo..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border-2 border-stone-900 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                />
                {step.result && (
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Resultado ({step.result.length} chars)
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 ml-auto" />
                    </summary>
                    <div className="mt-2 p-3 bg-white border border-stone-200 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {step.result}
                    </div>
                  </details>
                )}
                {step.error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-mono">
                    Erro: {step.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-stone-200">
            <button onClick={addAgentStep} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 flex items-center gap-1.5 transition-colors">
              <GitBranch className="w-3.5 h-3.5" /> Adicionar Passo
            </button>
            <button
              onClick={runAgentChain}
              disabled={agentRunning || agentSteps.length === 0}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl border-2 border-emerald-700 flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {agentRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {agentRunning ? 'Executando...' : 'Executar Chain'}
            </button>
            {agentSteps.length > 0 && agentSteps[agentSteps.length - 1].result && (
              <button onClick={copyAgentOutput} className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 flex items-center gap-1.5 transition-colors">
                <Copy className="w-3.5 h-3.5" /> Copiar Último
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}