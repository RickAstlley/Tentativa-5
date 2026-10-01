'use client';

import React, { useState, useEffect } from 'react';
import type { AIExecutionLog } from '@/lib/ai/telemetry';
import { useApi, ADMIN_TAGS } from '@/hooks/useApi';
import {
  Activity,
  Cpu,
  Image as ImageIcon,
  Zap,
  RefreshCw,
  Clock,
  Sparkles,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CSMTelemetryPanelProps {
  compact?: boolean;
}

/** Campos que o painel consome; derivados na rota a partir das métricas internas. */
interface PanelMetrics {
  totalCalls: number;
  totalCallsToday: number;
  totalTokens: number;
  avgTokensPerExecution: number;
  averageLatencyMs: number;
  avgLatencyMs: number;
  imageLlmCountTotal: number;
  imageLlmCountToday: number;
  tokenStats: { prompt: number; completion: number; total: number };
  cacheHitRate: number;
}

export default function CSMTelemetryPanel({ compact = false }: CSMTelemetryPanelProps) {
  const [metrics, setMetrics] = useState<PanelMetrics | null>(null);
  const [logs, setLogs] = useState<AIExecutionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'text'>('all');

  /**
   * Leitura pela camada de estado, não por fetch próprio.
   *
   * O painel continua atualizando a cada 30s e no botão de recarregar, e passa
   * a reagir quando outro lugar invalida a tag `telemetry`: disparar um job na
   * tela de pipelines atualiza os números aqui, sem disputa de polling e sem exigir
   * recarregamento manual.
   */
  const { data, refetch: fetchTelemetry } = useApi<{
    panelMetrics?: PanelMetrics;
    logs?: AIExecutionLog[];
  }>('/api/admin/llm', [ADMIN_TAGS.telemetry], { timeoutMs: 20000 });

  useEffect(() => {
    if (data?.panelMetrics) setMetrics(data.panelMetrics);
    if (data?.logs) setLogs(data.logs);
  }, [data]);

  useEffect(() => {
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const filteredLogs = logs.filter((log) => {
    const taskType = String(log.taskName || '').toLowerCase();
    if (filterType === 'image') {
      return (
        taskType === 'image_search' ||
        taskType === 'vision_analysis' ||
        taskType.includes('image') ||
        taskType.includes('vision')
      );
    }
    if (filterType === 'text') {
      return (
        taskType !== 'image_search' &&
        taskType !== 'vision_analysis' &&
        !taskType.includes('image') &&
        !taskType.includes('vision')
      );
    }
    return true;
  });

  const formatTokens = (tokens?: number | null) => {
    const num = typeof tokens === 'number' ? tokens : Number(tokens) || 0;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
      {/* Cabeçalho do Painel CSM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-400 border-2 border-stone-900 rounded-xl flex items-center justify-center text-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-stone-900 tracking-tight">
                Telemetria & Consumo de IA (CSM)
              </h2>
              <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-[10px] rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ao Vivo
              </span>
            </div>
            <p className="text-stone-600 text-xs font-medium">
              Monitoramento em tempo real de tokens consumidos, requisições de imagem e desempenho dos LLMs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchTelemetry}
          disabled={loading}
          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-stone-700 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Grid de Métricas Principais (Cards do CSM) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tokens Gastos & Média */}
        <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Tokens Gastos (Total)</span>
            <Cpu className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {formatTokens(metrics?.totalTokens ?? metrics?.tokenStats?.total ?? 0)}
          </div>
          <div className="text-[11px] text-stone-600 font-medium mt-2 flex items-center gap-1 border-t border-stone-200 pt-2">
            <Zap className="w-3 h-3 text-amber-500 shrink-0" />
            <span>Média: <strong>{formatTokens(metrics?.avgTokensPerExecution ?? 0)}</strong> / requisição</span>
          </div>
        </div>

        {/* Card 2: LLM de Imagem Hoje */}
        <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>LLM de Imagem (Hoje)</span>
            <ImageIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {metrics?.imageLlmCountToday ?? 0}
            </span>
            <span className="text-xs font-bold text-stone-600">buscas e análises</span>
          </div>
          <div className="text-[11px] text-stone-600 font-medium mt-2 flex items-center gap-1 border-t border-stone-200 pt-2">
            <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Modelo: Inkling + Nemotron</span>
          </div>
        </div>

        {/* Card 3: LLM de Imagem Total */}
        <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>LLM de Imagem (Total)</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-800 font-mono">
              {metrics?.imageLlmCountTotal ?? 0}
            </span>
            <span className="text-xs font-bold text-stone-600">execuções</span>
          </div>
          <div className="text-[11px] text-stone-600 font-medium mt-2 flex items-center gap-1 border-t border-stone-200 pt-2">
            <BarChart3 className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>Busca Real + Visão IA</span>
          </div>
        </div>

        {/* Card 4: Total de Chamadas & Latência */}
        <div className="bg-[#FDFBF7] border-2 border-stone-900 rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Chamadas Hoje (Geral)</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {metrics?.totalCallsToday ?? metrics?.totalCalls ?? 0}
          </div>
          <div className="text-[11px] text-stone-600 font-medium mt-2 flex items-center gap-1 border-t border-stone-200 pt-2">
            <Clock className="w-3 h-3 text-purple-600 shrink-0" />
            <span>Latência média: <strong>{metrics?.avgLatencyMs ?? metrics?.averageLatencyMs ?? 0}ms</strong></span>
          </div>
        </div>
      </div>

      {/* Tabela de Logs e Observabilidade Recente */}
      {!compact && (
        <div className="space-y-3 pt-2 border-t border-stone-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              Histórico de Execuções Recentes
              <span className="text-xs font-normal text-stone-600 font-mono">({filteredLogs.length} registros)</span>
            </h3>

            {/* Filtros de Tipo */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-bold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-stone-900 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('image')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'image' ? 'bg-emerald-600 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                LLM de Imagem
              </button>
              <button
                onClick={() => setFilterType('text')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'text' ? 'bg-purple-600 text-white shadow' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Artigos / Texto
              </button>
            </div>
          </div>

          <div className="border-2 border-stone-900 rounded-xl overflow-hidden overflow-x-auto bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900 text-white font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5">Horário</th>
                  <th className="p-2.5">Tipo de Tarefa</th>
                  <th className="p-2.5">Modelo / Provedor</th>
                  <th className="p-2.5">Latência</th>
                  <th className="p-2.5">Tokens (Entrada / Saída)</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-[11px] text-stone-800">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const rawType = log.taskName || 'geral';
                    const isImg =
                      rawType === 'image_search' ||
                      rawType === 'vision_analysis' ||
                      rawType.toLowerCase().includes('image') ||
                      rawType.toLowerCase().includes('vision');

                    // `AIExecutionLog` expoe o total agregado; a quebra em
                    // entrada/saída não é registrada por LogEntry.
                    const inTok = log.totalTokens;
                    const outTok = 0;

                    return (
                      <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-2.5 whitespace-nowrap text-stone-500">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR') : '--:--'}
                        </td>
                        <td className="p-2.5 font-sans font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 ${
                              isImg
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-purple-100 text-purple-900 border border-purple-300'
                            }`}
                          >
                            {isImg && <ImageIcon className="w-3 h-3 text-emerald-700" />}
                            {rawType}
                          </span>
                        </td>
                        <td className="p-2.5 text-stone-900 font-medium">{log.model || 'Padrão'}</td>
                        <td className="p-2.5 text-stone-600">{log.latencyMs || 0}ms</td>
                        <td className="p-2.5 font-bold text-stone-900">
                          {inTok} in / {outTok} out
                        </td>
                        <td className="p-2.5">
                          {log.status === 'success' ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sucesso
                            </span>
                          ) : (
                            <span className="text-rose-700 font-bold flex items-center gap-1 text-[10px]">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Falha
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-stone-400 font-sans text-xs">
                      Nenhum log registrado para o filtro selecionado. Faça uma busca de imagens ou gere um artigo para visualizar a telemetria ao vivo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
