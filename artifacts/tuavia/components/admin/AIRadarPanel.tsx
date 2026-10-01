'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { pollExistingLLMJob } from '@/lib/ai/llmJobClient';
import {
  Sparkles,
  Star,
  RefreshCw,
  Trash2,
  ExternalLink,
  Zap,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowRight,
  Bookmark,
  Share2,
  Tag,
  ShieldCheck,
} from 'lucide-react';

import {
  classifyRadarPauta,
  dispatchRadarPauta,
  CopilotMode,
} from '@/lib/ai/radarDispatcher';
import { RadarPauta } from '@/types/globalRadar';

export type { RadarPauta };

interface AIRadarPanelProps {
  onSelectMode?: (mode: CopilotMode) => void;
}

export default function AIRadarPanel({ onSelectMode }: AIRadarPanelProps = {}) {
  const router = useRouter();
  const [pautas, setPautas] = useState<RadarPauta[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [nextScanInMinutes, setNextScanInMinutes] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'starred' | 'high_impact' | 'promos'>('all');

  const loadRadarPautas = useCallback(async (showLoadingSpinner: boolean = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      const res = await fetchAdminJson<{
        success: boolean;
        pautas: RadarPauta[];
        statusMessage?: string;
        nextScanInMinutes?: number;
      }>('/api/admin/llm/radar', { cache: 'no-store' });

      if (res.ok && res.data) {
        const incoming = res.data.pautas || [];
        setPautas((prev) => {
          if (!prev || prev.length === 0) return incoming;
          if (incoming.length === 0) return prev; // Proteção: nunca zera pautas locais com resposta vazia
          const incomingIds = new Set(incoming.map((p) => p.id).filter(Boolean));
          const kept = prev.filter((p) => !incomingIds.has(p.id));
          return [...incoming, ...kept];
        });
        if (res.data.statusMessage) setStatusMessage(res.data.statusMessage);
        if (typeof res.data.nextScanInMinutes === 'number') {
          setNextScanInMinutes(res.data.nextScanInMinutes);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar pautas do radar:', err);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRadarPautas(true);

    // Auto-refresh a cada 30 segundos para acompanhar o ciclo de 1h em background
    const interval = setInterval(() => {
      loadRadarPautas(false);
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [loadRadarPautas]);

  const handleRunScan = async () => {
    setScanning(true);
    setProgressPct(10);
    setStageMessage('Conectando ao orquestrador de IA...');
    setStatusMessage('Iniciando varredura sequencial via NVIDIA NIM...');

    try {
      const res = await fetchAdminJson<{
        success: boolean;
        queued?: boolean;
        jobId?: string;
        message?: string;
        data?: { pautas: RadarPauta[] };
      }>('/api/admin/llm/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 30000,
        body: JSON.stringify({ action: 'scan' }),
      });

      if (res.ok && res.data?.success) {
        if (res.data.jobId) {
          const completedJob = await pollExistingLLMJob({
            jobId: res.data.jobId,
            type: 'ai_radar_scan',
            onProgress: (job) => {
              if (job.progress) setProgressPct(job.progress);
              if (job.stage) setStageMessage(job.stage);
            },
            pollIntervalMs: 1500,
            maxPollAttempts: 60,
          });

          if (completedJob.status === 'completed') {
            const jobPautas: RadarPauta[] = completedJob.result?.pautas || [];
            if (jobPautas.length > 0) {
              setPautas((prev) => {
                const existingIds = new Set((prev || []).map((p) => p.id).filter(Boolean));
                const fresh = jobPautas.filter((p) => !existingIds.has(p.id));
                return [...fresh, ...(prev || [])];
              });
            }
            setProgressPct(100);
            setStageMessage('Varredura e curadoria concluídas com sucesso!');
            setStatusMessage('Varredura concluída! Pautas integradas com retenção de 48h/24h.');
          } else {
            setStatusMessage(`Job finalizado com status: ${completedJob.status}`);
          }
        } else {
          setStatusMessage(res.data.message || 'Varredura concluída!');
        }
        await loadRadarPautas(false);
      } else {
        setStatusMessage(res.error || 'Falha ao iniciar varredura.');
      }
    } catch (err: any) {
      setStatusMessage(`Erro: ${err?.message || err}`);
    } finally {
      setScanning(false);
    }
  };

  const handleClearUnstarred = async () => {
    if (
      !confirm(
        'Deseja sincronizar a política de retenção no site? Artigos de alto impacto permanecem por até 48 horas, normais por até 24 horas e favoritos (⭐) são mantidos permanentemente.'
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetchAdminJson<{
        success: boolean;
        message?: string;
      }>('/api/admin/llm/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_expired' }),
      });

      if (res.ok && res.data) {
        setStatusMessage(res.data.message || 'Retenção aplicada com sucesso!');
        await loadRadarPautas(false);
      } else {
        setStatusMessage(res.error || 'Falha ao executar retenção.');
      }
    } catch (err: any) {
      setStatusMessage(`Erro ao limpar: ${err?.message || err}`);
    } finally {
      setClearing(false);
    }
  };

  const handleToggleStar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Otimismo visual
    setPautas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, starred: !p.starred } : p))
    );

    try {
      await fetchAdminJson('/api/admin/llm/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_star', pautaId: id }),
      });
    } catch (err) {
      console.error('Erro ao favoritar pauta:', err);
      // Reverte em caso de erro
      loadRadarPautas();
    }
  };

  const handleDeletePauta = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir esta pauta?')) return;

    setPautas((prev) => prev.filter((p) => p.id !== id));

    try {
      await fetchAdminJson('/api/admin/llm/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', pautaId: id }),
      });
    } catch (err) {
      console.error('Erro ao apagar pauta:', err);
      loadRadarPautas();
    }
  };

  const handleGenerateFullArticle = (
    pauta: RadarPauta,
    forcedTarget?: 'article_writer' | 'ebike_analysis' | 'top_ranking',
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    dispatchRadarPauta(pauta, onSelectMode, router, forcedTarget);
  };

  const filteredPautas = pautas.filter((p) => {
    if (filter === 'starred') return p.starred;
    if (filter === 'high_impact') return p.impactLevel === 'alto';
    if (filter === 'promos') {
      return (
        p.category === 'Promoções' ||
        p.title.toLowerCase().includes('promo') ||
        p.title.toLowerCase().includes('oferta') ||
        p.title.toLowerCase().includes('desconto') ||
        p.title.toLowerCase().includes('cupom')
      );
    }
    return true;
  });

  const starredCount = pautas.filter((p) => p.starred).length;
  const unstarredCount = pautas.filter((p) => !p.starred).length;
  const promosCount = pautas.filter(
    (p) =>
      p.category === 'Promoções' ||
      p.title.toLowerCase().includes('promo') ||
      p.title.toLowerCase().includes('oferta') ||
      p.title.toLowerCase().includes('desconto') ||
      p.title.toLowerCase().includes('cupom')
  ).length;

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-5 md:p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-5">
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-stone-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-amber-400 border-2 border-stone-900 rounded-xl text-stone-900 font-bold shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] shrink-0">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-stone-900 font-mono tracking-tight">
                Radar IA: Pautas & Promoções de E-Bikes
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-bold rounded-full">
                Exclusivo NVIDIA NIM
              </span>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 font-mono text-xs font-bold rounded-full">
                A cada 1h
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl">
              Varredura com IA (NVIDIA NIM) executada automaticamente <strong className="text-stone-900 font-bold">a cada 1 hora</strong>.
              Retenção inteligente no site: artigos de <strong className="text-rose-700 font-bold">alto impacto</strong> permanecem por <strong className="text-stone-900">48 horas</strong>, artigos <strong className="text-stone-700 font-bold">normais</strong> por <strong className="text-stone-900">24 horas</strong> e itens <strong className="text-amber-700 font-bold">favoritados (⭐)</strong> são permanentes.
            </p>
          </div>
        </div>

        {/* BOTOES DE ACAO */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleRunScan}
            disabled={scanning}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Varrendo Web (NVIDIA)...' : 'Buscar Novas Pautas & Ofertas'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearUnstarred}
            disabled={clearing}
            className="px-3 py-2 bg-stone-50 hover:bg-stone-100 text-stone-800 border-2 border-stone-900 font-mono font-bold text-xs rounded-xl shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Aplica retenção de 48h para alto impacto, 24h para normais e preserva favoritos permanentemente"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sincronizar Retenção (48h/24h)</span>
          </button>
        </div>
      </div>

      {/* PROGRESS BAR QUANDO SCANNING */}
      {scanning && (
        <div className="space-y-1.5 p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
          <div className="flex justify-between text-xs font-mono font-bold text-indigo-950">
            <span>{stageMessage || 'Varrendo a web por novidades e ofertas...'}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* STATUS BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {nextScanInMinutes !== null && nextScanInMinutes > 0
              ? `Próxima busca automática NVIDIA NIM em ~${nextScanInMinutes} minutos.`
              : 'Varredura automática ativa a cada 1 hora.'}
          </span>
        </div>

        {statusMessage && (
          <span className="text-stone-700 font-medium bg-white px-2.5 py-1 border border-stone-200 rounded-lg">
            {statusMessage}
          </span>
        )}
      </div>

      {/* FILTROS */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 font-mono text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            Todas ({pautas.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('promos')}
            className={`px-3 py-1.5 font-mono text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              filter === 'promos'
                ? 'bg-emerald-600 text-white border-stone-900 font-extrabold'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Promoções & Ofertas ({promosCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('starred')}
            className={`px-3 py-1.5 font-mono text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              filter === 'starred'
                ? 'bg-amber-400 text-stone-900 border-stone-900 font-black'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-stone-900" />
            <span>Favoritadas / Salvas ({starredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('high_impact')}
            className={`px-3 py-1.5 font-mono text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              filter === 'high_impact'
                ? 'bg-rose-500 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Alto Impacto</span>
          </button>
        </div>

        <span className="text-xs text-stone-500 font-mono">
          Mostrando {filteredPautas.length} pauta(s)
        </span>
      </div>

      {/* LISTA DE PAUTAS */}
      {loading && pautas.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-mono font-bold text-stone-600 uppercase tracking-wider">
            Carregando pautas do Radar IA...
          </p>
        </div>
      ) : filteredPautas.length === 0 ? (
        <div className="py-10 border-2 border-dashed border-stone-200 rounded-xl flex flex-col items-center justify-center p-6 text-center gap-3 bg-stone-50/50">
          <Sparkles className="w-8 h-8 text-amber-500" />
          <div>
            <h4 className="font-bold text-stone-900 text-sm">Nenhuma pauta encontrada neste filtro</h4>
            <p className="text-xs text-stone-500 mt-1 max-w-md">
              Clique no botão <strong>&quot;Buscar Novas Pautas Agora&quot;</strong> acima para acionar a LLM e trazer as últimas tendências da internet.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPautas.map((pauta) => {
            const classification = classifyRadarPauta(pauta);

            return (
              <div
                key={pauta.id}
                onClick={() => handleGenerateFullArticle(pauta)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 relative cursor-pointer hover:scale-[1.01] ${
                  pauta.starred
                    ? 'bg-amber-50/60 border-amber-400 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
                    : 'bg-white border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md'
                }`}
              >
                {/* CARTAO TOPO */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase rounded-md border ${classification.badgeBg}`}>
                        {classification.badgeText}
                      </span>

                      <span className="px-2 py-0.5 bg-stone-100 text-stone-800 font-mono text-[10px] font-extrabold uppercase rounded-md border border-stone-200">
                        {pauta.category || 'Notícias'}
                      </span>

                      {pauta.starred ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-extrabold rounded-md flex items-center gap-1">
                          ⭐ Permanente
                        </span>
                      ) : pauta.impactLevel === 'alto' ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-mono text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-600" />
                          48h Retenção
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-300 font-mono text-[10px] font-bold rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-500" />
                          24h Retenção
                        </span>
                      )}
                    </div>

                    {/* ACOES FAVORITAR E EXCLUIR */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(pauta.id, e)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          pauta.starred
                            ? 'bg-amber-400 border-stone-900 text-stone-900 shadow-[1px_1px_0px_0px_rgba(28,25,23,1)]'
                            : 'bg-stone-50 border-stone-200 hover:bg-amber-100 text-stone-400 hover:text-amber-600'
                        }`}
                        title={pauta.starred ? 'Favoritada (Permanente no site)' : 'Favoritar Pauta (Permanente no site)'}
                      >
                        <Star className={`w-4 h-4 ${pauta.starred ? 'fill-stone-900' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeletePauta(pauta.id, e)}
                        className="p-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-all cursor-pointer"
                        title="Excluir Pauta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* TITULO E RESUMO */}
                  <h3 className="font-extrabold text-stone-900 text-base leading-snug group-hover:text-indigo-600">
                    {pauta.title}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">
                    {pauta.summary}
                  </p>

                  {/* CALLOUT POR QUE É RELEVANTE */}
                  <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] text-stone-700 font-mono space-y-1">
                    <span className="font-bold text-indigo-900 block uppercase">💡 Por que é relevante:</span>
                    <p>{pauta.whyRelevant}</p>
                  </div>

                  {/* PONTOS CHAVE */}
                  {pauta.keyPoints && pauta.keyPoints.length > 0 && (
                    <ul className="space-y-1 text-xs text-stone-700 pt-1">
                      {pauta.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CARTAO RODAPE E BOTAO DE DISPARO INTELIGENTE */}
                <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono">
                    <span>
                      {pauta.sourceName && pauta.sourceUrl ? (
                        <a
                          href={pauta.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline flex items-center gap-1 text-indigo-600 font-bold"
                        >
                          {pauta.sourceName} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        'Fonte Web'
                      )}
                    </span>
                    <span>{new Date(pauta.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* BOTAO PRINCIPAL CLASSIFICADO */}
                  <button
                    type="button"
                    onClick={(e) => handleGenerateFullArticle(pauta, undefined, e)}
                    className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-white font-mono font-black text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>{classification.buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                  </button>

                  {/* OPCOES ALTERNATIVAS RÁPIDAS */}
                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono">Alternativas de Envio:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleGenerateFullArticle(pauta, 'article_writer', e)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          classification.target === 'article_writer'
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                        title="Enviar para o Redator Editorial"
                      >
                        📝 Artigo
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleGenerateFullArticle(pauta, 'ebike_analysis', e)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          classification.target === 'ebike_analysis'
                            ? 'bg-cyan-50 border-cyan-300 text-cyan-700 font-bold'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                        title="Enviar para Ficha de E-Bike"
                      >
                        ⚡ Ficha E-Bike
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleGenerateFullArticle(pauta, 'top_ranking', e)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                          classification.target === 'top_ranking'
                            ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                        }`}
                        title="Enviar para Top Ranking"
                      >
                        🏆 Ranking
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
