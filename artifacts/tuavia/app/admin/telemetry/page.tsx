'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { aiExecutionLogger, type AIExecutionLog, estimatePipelineCost } from '@/lib/ai/telemetry';

function Icon({ name, className = '', ...props }: { name: string; className?: string; [key: string]: any }) {
  // Ícones são escolhidos por nome em runtime; sem o cast, o TypeScript não
  // reconhece o componente como JSX válido.
  const IconComponent = (LucideIcons[name as keyof typeof LucideIcons] ??
    LucideIcons.LayoutDashboard) as React.ComponentType<{ className?: string }>;
  return <IconComponent className={className} {...props} />;
}

const TIME_WINDOWS = [
  { value: 5 * 60 * 1000, label: '5 min' },
  { value: 60 * 60 * 1000, label: '1h' },
  { value: 24 * 60 * 60 * 1000, label: '24h' },
  { value: 7 * 24 * 60 * 60 * 1000, label: '7d' },
  { value: 30 * 24 * 60 * 60 * 1000, label: '30d' },
];

export default function TelemetryPage() {
  const router = useRouter();
  const [timeWindow, setTimeWindow] = useState(24 * 60 * 60 * 1000);
  const [logs, setLogs] = useState<AIExecutionLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AIExecutionLog | null>(null);
  const [filterModel, setFilterModel] = useState('');
  const [filterStatus, setFilterStatus] = useState<AIExecutionLog['status'] | ''>('');
  const [filterTask, setFilterTask] = useState('');

  useEffect(() => {
    const logger = aiExecutionLogger;
    const unsubscribe = logger.subscribe((log) => {
      setLogs(prev => [log, ...prev.slice(0, 4999)]);
    });
    setLogs(logger.getLogs({ since: Date.now() - timeWindow }));
    return unsubscribe;
  }, [timeWindow]);

  const stats = aiExecutionLogger.getStats(timeWindow);
  const modelPerf = aiExecutionLogger.getModelPerformance();
  const recentErrors = aiExecutionLogger.getRecentErrors(10);

  const filteredLogs = logs.filter(log => {
    if (filterModel && log.model !== filterModel) return false;
    if (filterStatus && log.status !== filterStatus) return false;
    if (filterTask && !log.taskName.includes(filterTask)) return false;
    return true;
  });

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCost = (cost: number) => cost === 0 ? 'Free (NVIDIA)' : `$${cost.toFixed(4)}`;

  const statusColors = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    fallback: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-rose-100 text-rose-700 border-rose-200',
    timeout: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-stone-900 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500"
              >
                <Icon name="ArrowLeft" className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-black text-xl text-stone-900">Telemetria IA</h1>
                <p className="text-[11px] text-stone-500 font-mono">
                  Monitoramento em tempo real · Execuções, latência, custos, erros
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(Number(e.target.value))}
                className="text-[11px] bg-white border border-stone-200 rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
              >
                {TIME_WINDOWS.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
              <button
                onClick={() => aiExecutionLogger.clear()}
                className="px-3 py-1 bg-stone-100 text-stone-700 text-[10px] font-mono rounded border border-stone-200 hover:bg-stone-200"
              >
                Limpar Logs
              </button>
              <button
                onClick={() => {
                  const csv = aiExecutionLogger.exportLogs('csv');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `telemetria-${Date.now()}.csv`;
                  a.click();
                }}
                className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-mono rounded hover:bg-emerald-400"
              >
                <Icon name="Download" className="w-3 h-3 mr-1" />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Total de Chamadas"
            value={stats.totalCalls.toLocaleString()}
            icon="Activity"
            color="bg-blue-500"
          />
          <StatCard
            title="Taxa de Sucesso"
            value={`${(stats.successRate * 100).toFixed(1)}%`}
            icon={stats.successRate > 0.95 ? 'CheckCircle2' : 'AlertCircle'}
            color={stats.successRate > 0.95 ? 'bg-emerald-500' : 'bg-amber-500'}
          />
          <StatCard
            title="Latência Média"
            value={formatMs(stats.avgLatencyMs)}
            icon="Clock"
            color="bg-purple-500"
          />
          <StatCard
            title="Tokens Totais"
            value={stats.totalTokens.toLocaleString()}
            icon="Database"
            color="bg-indigo-500"
          />
          <StatCard
            title="Custo Estimado"
            value={formatCost(stats.totalCostUSD)}
            icon="DollarSign"
            color="bg-emerald-500"
          />
        </section>

        {/* Latency Percentiles + Error/Fallback Rates */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6">
            <h3 className="font-black text-lg text-stone-900 mb-4 flex items-center gap-2">
              <Icon name="BarChart3" className="w-5 h-5 text-amber-500" />
              Percentis de Latência
            </h3>
            <div className="space-y-3">
              <PercentileBar label="P50 (mediana)" value={stats.latencyP50} max={stats.latencyP99 || 1} color="bg-emerald-500" />
              <PercentileBar label="P95" value={stats.latencyP95} max={stats.latencyP99 || 1} color="bg-amber-500" />
              <PercentileBar label="P99" value={stats.latencyP99} max={stats.latencyP99 || 1} color="bg-rose-500" />
            </div>
          </div>

          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6">
            <h3 className="font-black text-lg text-stone-900 mb-4 flex items-center gap-2">
              <Icon name="AlertCircle" className="w-5 h-5 text-rose-500" />
              Taxas de Erro & Fallback
            </h3>
            <div className="space-y-3">
              <RateRow label="Erro" value={((1 - stats.successRate) * 100).toFixed(1)} color="bg-rose-500" />
              <RateRow label="Fallback" value={`${(stats.fallbackRate * 100).toFixed(1)}%`} color="bg-amber-500" />
            </div>
          </div>

          <div className="bg-white border-2 border-stone-900 rounded-2xl p-6">
            <h3 className="font-black text-lg text-stone-900 mb-4 flex items-center gap-2">
              <Icon name="Cpu" className="w-5 h-5 text-purple-500" />
              Performance por Modelo
            </h3>
            <div className="space-y-2 max-h-64 overflow-auto">
              {Object.entries(modelPerf).map(([model, perf]) => (
                <ModelPerfRow key={model} model={model} perf={perf} />
              ))}
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="bg-white border-2 border-stone-900 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-stone-500 mb-1">Filtrar Modelo</label>
              <select
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="w-full text-[11px] bg-white border border-stone-200 rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {Object.keys(modelPerf).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className="block text-[10px] font-mono text-stone-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full text-[11px] bg-white border border-stone-200 rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="success">Sucesso</option>
                <option value="fallback">Fallback</option>
                <option value="error">Erro</option>
                <option value="timeout">Timeout</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-mono text-stone-500 mb-1">Buscar Task</label>
              <input
                type="text"
                value={filterTask}
                onChange={(e) => setFilterTask(e.target.value)}
                placeholder="ex: ebike_extract, article_writer..."
                className="w-full text-[11px] bg-white border border-stone-200 rounded px-2 py-1 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Logs Table */}
        <section className="bg-white border-2 border-stone-900 rounded-2xl overflow-hidden">
          <div className="border-b-2 border-stone-900 px-6 py-4 bg-stone-50">
            <h3 className="font-black text-lg text-stone-900 flex items-center gap-2">
              <Icon name="List" className="w-5 h-5 text-amber-500" />
              Logs de Execução ({filteredLogs.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left text-stone-500 font-bold">Timestamp</th>
                  <th className="px-4 py-3 text-left text-stone-500 font-bold">Task</th>
                  <th className="px-4 py-3 text-left text-stone-500 font-bold">Modelo</th>
                  <th className="px-4 py-3 text-right text-stone-500 font-bold">Latência</th>
                  <th className="px-4 py-3 text-center text-stone-500 font-bold">Status</th>
                  <th className="px-4 py-3 text-right text-stone-500 font-bold">Tokens</th>
                  <th className="px-4 py-3 text-right text-stone-500 font-bold">Custo</th>
                  <th className="px-4 py-3 text-center text-stone-500 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLogs.slice(0, 100).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <td className="px-4 py-3 text-stone-600">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-stone-900 max-w-[200px] truncate">{log.taskName}</td>
                    <td className="px-4 py-3 text-stone-700 max-w-[180px] truncate" title={log.model}>{log.model}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{formatMs(log.latencyMs)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('px-2 py-0.5 rounded text-[9px] font-mono font-bold border', statusColors[log.status])}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {log.totalTokens?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">
                      {formatCost(log.costUSD || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="px-2 py-1 text-[10px] font-mono text-stone-500 hover:text-stone-700"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                      Nenhum log encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Errors */}
        {recentErrors.length > 0 && (
          <section className="mt-6 bg-white border-2 border-stone-900 rounded-2xl overflow-hidden">
            <div className="border-b-2 border-stone-900 px-6 py-4 bg-rose-50">
              <h3 className="font-black text-lg text-stone-900 flex items-center gap-2">
                <Icon name="AlertCircle" className="w-5 h-5 text-rose-500" />
                Erros Recentes ({recentErrors.length})
              </h3>
            </div>
            <div className="p-6 space-y-3 max-h-96 overflow-auto">
              {recentErrors.map((log) => (
                <div key={log.id} className="border border-rose-200 bg-rose-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-rose-700">{log.taskName}</span>
                    <span className="text-[10px] font-mono text-stone-500">{log.model}</span>
                  </div>
                  <pre className="text-[10px] font-mono text-rose-800 whitespace-pre-wrap overflow-auto max-h-32">
                    {log.error}
                  </pre>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-stone-500">
                    <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                    <span>·</span>
                    <span>{formatMs(log.latencyMs)}</span>
                    <span>·</span>
                    <span>{log.totalTokens?.toLocaleString()} tokens</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                      className="ml-auto text-rose-500 hover:underline"
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Log Detail Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedLog(null)}>
            <div className="bg-white border-2 border-stone-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <div className="bg-stone-50 border-b-2 border-stone-900 px-6 py-4 flex items-center justify-between">
                <h3 className="font-black text-lg text-stone-900">Detalhes da Execução</h3>
                <button onClick={() => setSelectedLog(null)} className="p-2 text-stone-400 hover:text-stone-700">
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-2 gap-4 mb-4 text-[11px]">
                  <div><span className="font-bold text-stone-500">ID:</span> <span className="font-mono text-stone-900">{selectedLog.id}</span></div>
                  <div><span className="font-bold text-stone-500">Task:</span> <span className="text-stone-900">{selectedLog.taskName}</span></div>
                  <div><span className="font-bold text-stone-500">Modelo:</span> <span className="font-mono text-stone-700">{selectedLog.model}</span></div>
                  <div><span className="font-bold text-stone-500">Provider:</span> <span>{selectedLog.provider}</span></div>
                  <div><span className="font-bold text-stone-500">Latência:</span> <span>{formatMs(selectedLog.latencyMs)}</span></div>
                  <div><span className="font-bold text-stone-500">Status:</span> <span className={cn('px-2 py-0.5 rounded text-[9px] font-mono font-bold border', statusColors[selectedLog.status])}>{selectedLog.status.toUpperCase()}</span></div>
                  <div><span className="font-bold text-stone-500">Tokens:</span> <span>{selectedLog.totalTokens?.toLocaleString() || '-'}</span></div>
                  <div><span className="font-bold text-stone-500">Custo:</span> <span>{formatCost(selectedLog.costUSD || 0)}</span></div>
                  <div><span className="font-bold text-stone-500">Timestamp:</span> <span>{new Date(selectedLog.timestamp).toLocaleString('pt-BR')}</span></div>
                </div>
                {selectedLog.error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-rose-700 mb-2">Erro</h4>
                    <pre className="text-[10px] font-mono text-rose-800 whitespace-pre-wrap">{selectedLog.error}</pre>
                  </div>
                )}
                <details className="border border-stone-200 rounded-xl">
                  <summary className="p-4 font-bold text-stone-700 cursor-pointer">Prompt Hash / Response Hash</summary>
                  <div className="px-4 pb-4 text-[10px] font-mono text-stone-600">
                    <div>Prompt Hash: {selectedLog.promptHash}</div>
                    <div>Response Hash: {selectedLog.responseHash}</div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wide">{title}</p>
          <p className="font-black text-2xl text-stone-900 mt-1">{value}</p>
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
          <Icon name={icon} className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function PercentileBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
        <span className="text-stone-500">{label}</span>
        <span className="font-bold text-stone-900">{value < 1000 ? `${value}ms` : `${(value/1000).toFixed(1)}s`}</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RateRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
        <span className="text-stone-500">{label}</span>
        <span className="font-bold text-stone-900">{value}</span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: label === 'Erro' ? `${Math.min(parseFloat(value) * 5, 100)}%` : '50%' }} />
      </div>
    </div>
  );
}

function ModelPerfRow({ model, perf }: { model: string; perf: any }) {
  const shortName = model.split('/').pop() || model;
  return (
    <div className="border border-stone-200 rounded-xl p-3 hover:bg-stone-50">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-stone-900 truncate max-w-[200px]">{shortName}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200">
          {perf.calls} chamadas
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div><span className="text-stone-500">Latência</span><br/><span className="font-bold">{perf.avgLatency < 1000 ? `${perf.avgLatency.toFixed(0)}ms` : `${(perf.avgLatency/1000).toFixed(1)}s`}</span></div>
        <div><span className="text-stone-500">Sucesso</span><br/><span className="font-bold">{(perf.successRate*100).toFixed(1)}%</span></div>
        <div><span className="text-stone-500">Custo</span><br/><span className="font-bold">{perf.totalCost === 0 ? 'Free' : `$${perf.totalCost.toFixed(4)}`}</span></div>
      </div>
    </div>
  );
}