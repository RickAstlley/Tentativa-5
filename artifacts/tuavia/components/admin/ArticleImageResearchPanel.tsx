/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import SafeImage, { cleanImageUrl } from '@/components/ui/SafeImage';
import { VerifiedImageItem } from '@/lib/ai/types';
import { fetchAdminJson, readApiResponse } from '@/lib/ai/clientResponse';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  ShieldCheck,
  Eye,
  Plus,
  Trash2,
  Layers,
  Filter,
  Check,
  Copy,
  RefreshCw,
  Info,
  Clock,
  Terminal,
} from 'lucide-react';

/**
 * Imagem como a TELA precisa, não como o AGENTE entrega.
 *
 * `searchAndValidateTarget` devolve `VerifiedImageItem` — `url`, `sourceName`,
 * `score`, `verified`. A tela, porém, lê `imageUrl`, `title`, `altText`,
 * `relevanceScore`, `selected`… campos que não existiam no objeto real, então
 * todo card renderizava sem URL, sem título e sem pontuação, e o botão de
 * selecionar nunca marcava nada. Este adaptador é a fronteira entre os dois.
 */
interface ResearchImageView extends VerifiedImageItem {
  id: string;
  imageUrl: string;
  title: string;
  altText: string;
  caption: string;
  sourceDomain: string;
  /** 0–100, mesma escala de `score`. */
  relevanceScore: number;
  needsManualReview: boolean;
  placement: string;
  selected: boolean;
}

function toResearchImageView(raw: any, index: number): ResearchImageView {
  const imageUrl: string = raw?.url || raw?.imageUrl || '';
  const title: string = raw?.title || raw?.sourceName || raw?.sourceDomain || 'Imagem';
  const score = Number(raw?.score ?? raw?.relevanceScore ?? 0) || 0;

  return {
    // `sourceUrl` é a página de origem; `url` é o arquivo. Os dois existem.
    ...raw,
    id: raw?.id || `img-${index}-${imageUrl.slice(-24)}`,
    imageUrl,
    url: imageUrl,
    title,
    sourceName: raw?.sourceName || title,
    altText: raw?.altText || raw?.title || title,
    caption: raw?.caption || raw?.evidence || '',
    sourceDomain: raw?.sourceDomain || raw?.domain || '',
    relevanceScore: score,
    needsManualReview: raw?.needsManualReview ?? (raw?.verified === false),
    placement: raw?.placement || 'inline',
    selected: raw?.selected ?? false,
  };
}

function toResearchImageViews(rawList: unknown): ResearchImageView[] {
  return Array.isArray(rawList) ? rawList.map(toResearchImageView) : [];
}

interface ArticleImageResearchPanelProps {
  articleTopic: string;
  articleCategory?: string;
  articleContext?: string;
  onSetCoverImage: (url: string) => void;
  onInsertIntoBody: (markdownImageTag: string) => void;
  onAddToGallery?: (url: string) => void;
}

export function ArticleImageResearchPanel({
  articleTopic,
  articleCategory,
  articleContext,
  onSetCoverImage,
  onInsertIntoBody,
  onAddToGallery,
}: ArticleImageResearchPanelProps) {
  const [customQuery, setCustomQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [stageText, setStageText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryable, setRetryable] = useState<boolean>(true);
  const [images, setImages] = useState<ResearchImageView[]>([]);
  const [discardedImages, setDiscardedImages] = useState<ResearchImageView[]>([]);
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [audit, setAudit] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'selected' | 'high_score' | 'review'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedCoverUrl, setAppliedCoverUrl] = useState<string | null>(null);
  const [addedGalleryUrls, setAddedGalleryUrls] = useState<string[]>([]);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Inicia o job assíncrono e faz o polling de progresso
  const handleSearchImages = async () => {
    const topic = customQuery.trim() || articleTopic.trim();
    if (!topic) {
      setError('Informe o tema do artigo ou digite um termo de busca para pesquisar imagens reais.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    setErrorCode(null);
    setStageText('Criando tarefa assíncrona de pesquisa...');
    setProgressPercent(10);
    setActiveJobId(null);

    try {
      const job = await createAndPollLLMJob({
        type: 'image_research',
        input: {
          articleTopic: topic,
          articleCategory,
          articleContext,
          desiredCount: 4,
        },
        signal,
        onProgress: (progressJob) => {
          if (isMountedRef.current) {
            setStageText(progressJob.stage || 'Processando pipeline de imagens...');
            setProgressPercent(progressJob.progress || 30);

            // Se tiver resultados parciais, atualiza a UI imediatamente
            if (progressJob.result?.article_images && progressJob.result.article_images.length > 0) {
              setImages(toResearchImageViews(progressJob.result.article_images));
              setDiscardedImages(progressJob.result.discarded_candidates || []);
              setTelemetry(progressJob.result.telemetry || null);
              setAudit(progressJob.result.audit || null);
            }
          }
        },
      });

      if (!isMountedRef.current) return;

      setLoading(false);
      setProgressPercent(100);
      setStageText(job.stage || 'Pesquisa e curadoria finalizadas.');

      if (job.result?.article_images) {
        setImages(toResearchImageViews(job.result.article_images));
        setDiscardedImages(job.result.discarded_candidates || []);
        setTelemetry(job.result.telemetry || null);
        setAudit(job.result.audit || null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelada') || signal?.aborted) {
        return;
      }
      console.error('Erro na pesquisa de imagens:', err);
      if (isMountedRef.current) {
        setLoading(false);
        setError(err.message || 'Erro inesperado ao pesquisar imagens.');
        setErrorCode(err.errorCode || 'JOB_FAILED');
        setRetryable(err.retryable ?? true);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleToggleSelect = (item: ResearchImageView) => {
    setImages((prev) =>
      prev.map((img) => (img.id === item.id ? { ...img, selected: !img.selected } : img))
    );
  };

  const handleApplyAsCover = (img: ResearchImageView) => {
    const clean = cleanImageUrl(img.imageUrl || '');
    onSetCoverImage(clean);
    setAppliedCoverUrl(img.imageUrl || null);
    setTimeout(() => setAppliedCoverUrl(null), 3000);
  };

  const handleInsertMarkdown = (img: ResearchImageView) => {
    const clean = cleanImageUrl(img.imageUrl || '');
    const tag = `\n\n![${img.altText || ''}](${clean} "${img.title || ''}")\n*${img.caption || ''}*\n\n`;
    onInsertIntoBody(tag);
    setCopiedId(img.id || null);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleAddToGalleryItem = (img: ResearchImageView) => {
    if (onAddToGallery && img.imageUrl) {
      const clean = cleanImageUrl(img.imageUrl);
      onAddToGallery(clean);
      const url = img.imageUrl;
      setAddedGalleryUrls((prev) => [...prev, url]);
      setTimeout(() => {
        setAddedGalleryUrls((prev) => prev.filter((u) => u !== url));
      }, 3000);
    }
  };

  const filteredImages = images.filter((img) => {
    if (activeFilter === 'selected') return img.selected;
    if (activeFilter === 'high_score') return (img.relevanceScore ?? 0) >= 85;
    if (activeFilter === 'review') return img.needsManualReview;
    return true;
  });

  return (
    <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-600" />
              Imagens Reais do Artigo
            </h2>
            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-md text-[10px] font-black tracking-wide uppercase">
              Pipeline Assíncrono + Visão Multimodal
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Pesquisa fotos reais na Web via <strong>WebImageSearchTool</strong>, inspeciona visualmente com <strong>Inkling</strong>, seleciona com <strong>Nemotron Ultra</strong> e gera <strong>Image SEO</strong> em PT-BR.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSearchImages}
          disabled={loading}
          className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-black rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 text-xs shrink-0 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>Pesquisando & Inspecionando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Pesquisar Imagens Reais</span>
            </>
          )}
        </button>
      </div>

      {/* Barra de Busca Customizada */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchImages();
              }
            }}
            placeholder={
              articleTopic
                ? `Padrão: "${articleTopic.slice(0, 45)}..." (ou digite um termo específico)`
                : 'Digite um termo (ex: Caloi E-Vibe ciclovia, motor bafang 48v...)'
            }
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Barra de Progresso e Estágio Atual durante Execução */}
      {loading && (
        <div className="p-4 bg-indigo-50/70 border-2 border-indigo-900/20 rounded-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-black text-indigo-950">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>{stageText || 'Processando pesquisa visual...'}</span>
            </div>
            <span className="font-mono text-indigo-700">{progressPercent}%</span>
          </div>
          <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {activeJobId && (
            <p className="text-[10px] font-mono text-indigo-700/80">
              ID da Tarefa: {activeJobId}
            </p>
          )}
        </div>
      )}

      {/* Erro Estruturado com Botão de Retentativa */}
      {error && (
        <div className="p-4 bg-rose-50 border-2 border-rose-900 rounded-xl space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-950 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            {retryable && (
              <button
                type="button"
                onClick={handleSearchImages}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shrink-0 transition-colors cursor-pointer"
              >
                Tentar Novamente
              </button>
            )}
          </div>
          {errorCode && (
            <p className="text-[10px] font-mono text-rose-700">
              Código de Erro: {errorCode}
            </p>
          )}
        </div>
      )}

      {/* Telemetria e Auditoria */}
      {telemetry && (
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-600 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-900">Provedor:</span>
            <span className="px-2 py-0.5 bg-stone-200 rounded font-mono text-[10px] text-stone-800">
              {telemetry.provider_used}
            </span>
          </div>
          <div>
            <span className="font-bold text-stone-900">Encontradas:</span> {telemetry.total_raw_found} |{' '}
            <span className="font-bold text-stone-900">Deduplicadas:</span> {telemetry.duplicates_removed} |{' '}
            <span className="font-bold text-stone-900">Selecionadas:</span> {telemetry.selected_count}
          </div>
          <div>
            <span className="font-bold text-stone-900">Tempo:</span> {telemetry.duration_ms}ms
          </div>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Terminal className="w-3 h-3" />
            {showTechnicalDetails ? 'Ocultar Auditoria Técnica' : 'Ver Auditoria Técnica'}
          </button>
        </div>
      )}

      {/* Detalhes Técnicos de Auditoria */}
      {showTechnicalDetails && audit && (
        <div className="p-4 bg-stone-900 text-stone-100 rounded-xl text-xs font-mono space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <span className="font-black text-amber-400">AUDITORIA DE IMAGENS — RELATÓRIO DO PIPELINE</span>
            <span className={audit.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {audit.passed ? 'APROVADO' : 'REVISÃO REQUERIDA'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-stone-400">URLs Acessíveis:</span> {audit.sources_accessible ? 'Sim' : 'Não'}
            </div>
            <div>
              <span className="text-stone-400">Alt Texts SEO:</span> {audit.alt_texts_generated ? 'Gerados' : 'Pendentes'}
            </div>
            <div>
              <span className="text-stone-400">Revisão Manual:</span> {audit.manual_review_flagged_count}
            </div>
            <div>
              <span className="text-stone-400">Job ID:</span> {activeJobId || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Imagens Curadas */}
      {images.length > 0 && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-[11px] font-black uppercase text-stone-700 mr-1">Filtros:</span>
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Todas ({images.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('selected')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeFilter === 'selected'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Selecionadas ({images.filter((i) => i.selected).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('high_score')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activeFilter === 'high_score'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Relevância Alta 85%+ ({images.filter((i) => (i.relevanceScore ?? 0) >= 85).length})
              </button>
            </div>
          </div>

          {/* Grid de Imagens */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredImages.map((img) => {
              const isCoverApplied = appliedCoverUrl === img.imageUrl;
              const isCopied = copiedId === img.id;
              const isGalleryAdded = !!img.imageUrl && addedGalleryUrls.includes(img.imageUrl);

              return (
                <div
                  key={img.id}
                  className={`border-2 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${
                    img.selected
                      ? 'border-indigo-600 bg-indigo-50/20 shadow-[3px_3px_0px_0px_rgba(79,70,229,1)]'
                      : 'border-stone-900 bg-stone-50 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Imagem + Badges */}
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-stone-200 border border-stone-300">
                      <SafeImage
                        src={img.imageUrl || ''}
                        alt={img.altText || ''}
                        fill
                        className="object-cover"
                        fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
                      />
                      <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-stone-900/90 backdrop-blur-md text-amber-300 rounded font-black text-[10px] uppercase tracking-wider">
                          {typeof img.placement === 'object' ? (img.placement as any)?.type : (img.placement || 'inline')}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-900/90 backdrop-blur-md text-white rounded font-black text-[10px]">
                          Score: {img.relevanceScore ?? 0}/100
                        </span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <a
                          href={img.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-white/90 hover:bg-white text-stone-900 rounded-md shadow flex items-center gap-1 text-[10px] font-bold"
                          title="Abrir página fonte original"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Dados Editoriais e SEO */}
                    <div className="space-y-1.5 text-xs">
                      <h4 className="font-black text-stone-900 line-clamp-1">{img.title}</h4>
                      <p className="text-stone-600 text-[11px] leading-relaxed line-clamp-2">
                        {img.caption}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px] text-stone-500 font-mono">
                        <span>Alt: {(img.altText || '').slice(0, 35)}...</span>
                        <span>•</span>
                        <span>Fonte: {img.sourceDomain || 'Web'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(img)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        img.selected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                      }`}
                    >
                      {img.selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {img.selected ? 'Selecionada' : 'Selecionar'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApplyAsCover(img)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                          isCoverApplied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-900 hover:bg-stone-800 text-amber-300'
                        }`}
                      >
                        {isCoverApplied ? <Check className="w-3 h-3" /> : null}
                        {isCoverApplied ? 'Capa Aplicada!' : 'Usar como Capa'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInsertMarkdown(img)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                          isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-400 hover:bg-amber-500 text-stone-900'
                        }`}
                        title="Inserir no corpo do texto em Markdown"
                      >
                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {isCopied ? 'Inserido!' : 'Inserir no Texto'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
