'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatMarkdownForDisplay } from '@/lib/utils/markdownFormatter';
import {
  FileText,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Eye,
  Code,
  Columns,
  Tag,
  Clock,
  Database,
  ArrowRight,
  X,
  AlertCircle,
  PlusCircle,
  Wand2,
  ListFilter,
  Brain,
} from 'lucide-react';
import { ArticleCategory, ARTICLE_CATEGORIES } from '@/types/article';
import { saveAIDraft } from '@/lib/aiDraftCache';
import { safeJsonStringify } from '@/lib/utils';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';
import { autoLinkEBikesInText } from '@/lib/ai/ebikeAutoLinker';
import { NVIDIA_MODELS, ALL_NVIDIA_MODEL_IDS, type NvidiaModelId } from '@/lib/ai/nvidiaModelCatalog';

const BIKE_CATEGORIES = [
  'Urbana',
  'Trilha/MTB',
  'Dobrável',
  'Cargo',
  'Speed',
];

const SUGESTOES_ARTIGOS = [
  {
    tema: 'Como Escolher a Primeira E-Bike para Trabalhar como Entregador',
    categoria: 'Guia de Compra' as ArticleCategory,
    publico: 'Trabalhadores e ciclistas urbanos',
    palavras: 'e-bike entregador, custo beneficio, bateria duravel, ifood',
  },
  {
    tema: 'Resolução CONTRAN 996/2023 Explicada: O que é E-Bike vs Autopropelido vs Ciclomotor',
    categoria: 'Legislação' as ArticleCategory,
    publico: 'Proprietários de e-bike e interessados em mobilidade',
    palavras: 'contran 996, lei ebike brasil, capacete ciclovia, acelerador',
  },
  {
    tema: 'Guia de Vida Útil da Bateria de Lítio: Como Fazer Durar Mais de 5 Anos',
    categoria: 'Manutenção' as ArticleCategory,
    publico: 'Ciclistas urbanos e donos de bicicletas elétricas',
    palavras: 'bateria litio ebike, ciclos de carga, cuidado no calor, autonomia',
  },
  {
    tema: 'Comparativo: Motor Central vs Motor de Cubo Traseiro em Ladeiras Brasileiras',
    categoria: 'Comparativo' as ArticleCategory,
    publico: 'Ciclistas exigentes e entusiastas técnicos',
    palavras: 'motor central ebike, motor de cubo, torque nm, subida ingreme',
  },
];

interface GeneratedArticleData {
  title: string;
  slug: string;
  excerpt: string;
  category: ArticleCategory;
  readingTimeMinutes: number;
  relatedBikeCategories: string[];
  seoKeywords?: string[];
  body: string;
}

interface CopilotArticleWriterViewProps {
  onRefreshDraftCount: () => void;
  onForwardToAudit?: (articlePayload: any) => void;
}

export default function CopilotArticleWriterView({
  onRefreshDraftCount,
  onForwardToAudit,
}: CopilotArticleWriterViewProps) {
  const router = useRouter();

  // Campos de Entrada da Pauta
  const [topic, setTopic] = useState('Como Escolher a Primeira E-Bike Urbana em 2026: Guia Definitivo');
  const [category, setCategory] = useState<ArticleCategory>('Guia de Compra');
  const [targetAudience, setTargetAudience] = useState('Ciclistas urbanos iniciantes e pessoas buscando economizar no transporte');
  const [keywords, setKeywords] = useState('ebike urbana, comprar e-bike brasil, autonomia real, contran 996');
  const [articleType, setArticleType] = useState<'guide' | 'review' | 'comparison' | 'news'>('guide');
  const [enableThinking, setEnableThinking] = useState<boolean>(true);
  const [reasoningEffort, setReasoningEffort] = useState<'high' | 'medium' | 'low'>('high');
  const [selectedModel, setSelectedModel] = useState<NvidiaModelId>('z-ai/glm-5.3');

  // Estados de Geração e Exibição
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticleData | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'fields' | 'markdown' | 'split'>('preview');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado do Job Assíncrono.
  // `jobErrorCode` e `activeJobId` eram setados aqui e nunca renderizados — o
  // código do erro já viaja dentro de `errorMessage`, e o id do job é interno
  // ao `createAndPollLLMJob`. Ficavam como escrita morta.
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobStage, setJobStage] = useState<string>('');
  const [jobRetryable, setJobRetryable] = useState<boolean>(true);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefillRaw =
      sessionStorage.getItem('tuavia_prefill_article') ||
      localStorage.getItem('tuavia_prefill_article');

    if (prefillRaw) {
      try {
        const data = JSON.parse(prefillRaw);
        sessionStorage.removeItem('tuavia_prefill_article');
        localStorage.removeItem('tuavia_prefill_article');

        if (data.title) setTopic(data.title);
        if (data.category && ARTICLE_CATEGORIES.includes(data.category as ArticleCategory)) {
          setCategory(data.category as ArticleCategory);
        } else if (data.category === 'Notícia / Lançamento') {
          setCategory('Notícias');
        } else if (data.category === 'Análise Técnica') {
          setCategory('Guia de Compra');
        }
        if (data.prompt && !data.title) setTopic(data.prompt);
        if (data.suggestedKeywords && Array.isArray(data.suggestedKeywords)) {
          setKeywords(data.suggestedKeywords.join(', '));
        }
      } catch (err) {
        console.warn('Erro ao ler tuavia_prefill_article:', err);
      }
    }
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim() || isGenerating) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsGenerating(true);
    setErrorMessage(null);
    setSaveSuccess(false);
    setJobStage('Criando tarefa assíncrona para redação do artigo...');
    setJobProgress(10);

    try {
      const job = await createAndPollLLMJob({
        type: 'article_autofill',
        input: {
          query: topic.trim(),
          category,
          targetAudience,
          keywords,
          articleType,
          model: selectedModel,
          enableThinking,
          reasoningEffort,
        },
        allowSyncFallback: false,
        signal,
        onProgress: (progressJob) => {
          if (isMountedRef.current) {
            setJobStage(progressJob.stage || 'Redigindo artigo em etapas com IA...');
            setJobProgress(progressJob.progress || 35);

            // CRIAÇÃO POR PARTES: Conforme a Etapa 1 conclui, já renderiza o rascunho do artigo no preview!
            const partialData = progressJob.result?.data;
            if (partialData && (partialData.body || partialData.markdownContent)) {
              const partialBody = partialData.body || partialData.markdownContent;
              setGeneratedArticle((prev) => ({
                title: partialData.title || prev?.title || topic,
                slug: partialData.slug || prev?.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                excerpt: partialData.excerpt || prev?.excerpt || '',
                category: (partialData.category || prev?.category || category) as ArticleCategory,
                readingTimeMinutes: Number(partialData.readingTimeMinutes) || prev?.readingTimeMinutes || 5,
                relatedBikeCategories: partialData.relatedBikeCategories || prev?.relatedBikeCategories || ['Urbana'],
                seoKeywords: partialData.seoKeywords || prev?.seoKeywords || (keywords ? keywords.split(',').map((k) => k.trim()) : ['e-bike']),
                body: autoLinkEBikesInText(partialBody).updatedText,
              }));
            }
          }
        },
      });

      if (!isMountedRef.current) return;

      setIsGenerating(false);
      setJobProgress(100);
      setJobStage('Artigo redigido e SEO otimizado com sucesso pela IA!');

      const resultData = job.result?.data;
      const resultText = job.result?.text;

      let parsedArticle: any = resultData;
      if (!parsedArticle && resultText) {
        try {
          let cleanText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const fb = cleanText.indexOf('{');
          const lb = cleanText.lastIndexOf('}');
          if (fb !== -1 && lb > fb) {
            cleanText = cleanText.substring(fb, lb + 1);
          }
          parsedArticle = JSON.parse(cleanText);
        } catch {
          // mantém parsedArticle como undefined
        }
      }

      const bodyText =
        parsedArticle?.markdownContent ||
        parsedArticle?.body ||
        (typeof resultText === 'string' && !resultText.trim().startsWith('{') ? resultText : '');

      if (!bodyText || !bodyText.trim()) {
        throw new Error('A IA gerou um resultado sem o corpo do artigo.');
      }

      const articleResult: GeneratedArticleData = {
        title: parsedArticle?.title || topic,
        slug: parsedArticle?.slug || topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        excerpt: parsedArticle?.excerpt || parsedArticle?.seo?.metaDescription || '',
        category: (parsedArticle?.category && ARTICLE_CATEGORIES.includes(parsedArticle.category)
          ? parsedArticle.category
          : category) as ArticleCategory,
        readingTimeMinutes: Number(parsedArticle?.readTimeMinutes || parsedArticle?.readingTimeMinutes) || 5,
        relatedBikeCategories: Array.isArray(parsedArticle?.referencedBikes)
          ? parsedArticle.referencedBikes
          : Array.isArray(parsedArticle?.relatedBikeCategories)
          ? parsedArticle.relatedBikeCategories
          : ['Urbana'],
        seoKeywords: Array.isArray(parsedArticle?.seo?.focusKeywords)
          ? parsedArticle.seo.focusKeywords
          : Array.isArray(parsedArticle?.seoKeywords)
          ? parsedArticle.seoKeywords
          : keywords.split(',').map((k) => k.trim()),
        body: autoLinkEBikesInText(bodyText).updatedText,
      };

      setGeneratedArticle(articleResult);

      saveAIDraft({
        taskType: 'content_generation',
        title: articleResult.title,
        summary: articleResult.excerpt || articleResult.title,
        model: 'GLM-5.2 + Motor Editorial TuaVia',
        rawContent: articleResult.body,
        parsedData: articleResult,
      });
      onRefreshDraftCount();
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelada') || signal?.aborted) {
        return;
      }
      console.error('[CopilotArticleWriter] Erro ao gerar:', err);
      if (isMountedRef.current) {
        setIsGenerating(false);
        setJobRetryable(err.retryable ?? true);

        let userMsg = err.message || 'A tarefa de redação do artigo falhou.';
        if (
          err.errorCode === 'CONFIG_QUEUE_UNWRITABLE' ||
          err.errorCode === 'CONFIG_QUEUE_PATH_MISSING' ||
          err.errorCode === 'JOB_PERSISTENCE_FAILED'
        ) {
          userMsg = 'O servidor não conseguiu gravar a tarefa na fila persistente. Verifique LLM_JOBS_FILE e as permissões da pasta na Hostinger.';
        } else if (err.errorCode === 'API_KEY_MISSING') {
          userMsg = 'A chave NVIDIA não está configurada no ambiente do worker/servidor (NVIDIA_API_KEY).';
        } else if (err.errorCode === 'WORKER_UNAUTHORIZED' || err.errorCode === 'UNAUTHORIZED') {
          userMsg = 'O worker está usando LLM_WORKER_SECRET diferente do servidor.';
        } else if (err.errorCode === 'INVALID_MODEL') {
          userMsg = `Modelo fora do catálogo NVIDIA NIM: ${err.message}`;
        } else if (err.errorCode === 'UPSTREAM_TIMEOUT') {
          userMsg = 'A API da NVIDIA demorou além do limite.';
        } else if (err.errorCode === 'POLL_TIMEOUT' || err.errorCode === 'JOB_POLLING_TIMEOUT') {
          // `lib/ai/llmJobClient.ts` emite `POLL_TIMEOUT`. O `JOB_POLLING_TIMEOUT`
          // nunca foi produzido por nenhum caminho do servidor, então a tela só
          // mostrava a mensagem genérica de "tempo limite" ao usuário.
          userMsg = `A tarefa foi registrada (Job: ${err.jobId || 'em fila'}), mas o worker não devolveu o resultado no tempo limite. Verifique se o supervisor está ativo no servidor.`;
        }

        setErrorMessage(userMsg);
      }
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleApplyPreset = (preset: typeof SUGESTOES_ARTIGOS[0]) => {
    setTopic(preset.tema);
    setCategory(preset.categoria);
    setTargetAudience(preset.publico);
    setKeywords(preset.palavras);
  };

  const handleRefineBody = async () => {
    if (!generatedArticle?.body || isRefining) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsRefining(true);
    setErrorMessage(null);
    setJobStage('Enfileirando tarefa de refinamento do artigo...');
    setJobProgress(15);

    try {
      const refinePrompt = `Você é o Editor-Chefe Sênior do portal TuaVia (autoridade em e-bikes e mobilidade urbana no Brasil).
Sua missão é aprimorar, enriquecer a formatação, polir o tom editorial e aprofundar as seções técnicas do artigo abaixo em formato Markdown.
Mantenha rigorosamente corretos todos os dados técnicos (Wh, km/h, CONTRAN 996/2023, preços em R$).

Retorne ESTRITAMENTE um JSON válido com a estrutura:
{
  "markdownContent": "# Corpo refinado completo em Markdown..."
}

ARTIGO ATUAL:
${generatedArticle.body}`;

      const job = await createAndPollLLMJob({
        type: 'content_generation',
        input: {
          task: 'content_generation',
          model: 'z-ai/glm-5.3',
          prompt: refinePrompt,
        },
        signal,
        onProgress: (progressJob) => {
          if (isMountedRef.current) {
            setJobStage(progressJob.stage || 'Refinando texto com IA...');
            setJobProgress(progressJob.progress || 45);
          }
        },
      });

      if (!isMountedRef.current) return;

      setIsRefining(false);
      setJobProgress(100);

      const resultData = job.result?.data;
      const resultText = job.result?.text;

      let refined = resultData?.markdownContent || resultData?.body;
      if (!refined && resultText) {
        try {
          let cleanText = resultText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const fb = cleanText.indexOf('{');
          const lb = cleanText.lastIndexOf('}');
          if (fb !== -1 && lb > fb) {
            cleanText = cleanText.substring(fb, lb + 1);
          }
          const parsed = JSON.parse(cleanText);
          refined = parsed.markdownContent || parsed.body;
        } catch {
          if (typeof resultText === 'string' && !resultText.trim().startsWith('{')) {
            refined = resultText;
          }
        }
      }

      if (refined && typeof refined === 'string' && refined.trim()) {
        const autoLinked = autoLinkEBikesInText(refined.trim());
        setGeneratedArticle((prev) => (prev ? { ...prev, body: autoLinked.updatedText } : prev));
      } else {
        setErrorMessage('O refinamento da IA retornou um texto vazio. O corpo atual do artigo foi preservado.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelada') || signal?.aborted) {
        return;
      }
      console.error('[CopilotArticleWriter] Erro ao refinar:', err);
      if (isMountedRef.current) {
        setIsRefining(false);
        setErrorMessage(err.message || 'Falha ao processar refinamento.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefining(false);
      }
    }
  };

  const handleSendToArticleForm = () => {
    if (!generatedArticle) return;
    try {
      const payload = safeJsonStringify(generatedArticle);
      sessionStorage.setItem('tuavia_prefill_article', payload);
      localStorage.setItem('tuavia_prefill_article', payload);
      router.push('/admin/artigos/novo');
    } catch (err) {
      console.error('Erro ao salvar rascunho de artigo para redirecionamento:', err);
      router.push('/admin/artigos/novo');
    }
  };

  const handleSendToAudit = () => {
    if (!generatedArticle) return;
    if (onForwardToAudit) {
      onForwardToAudit(generatedArticle);
    } else {
      router.push('/admin/artigos/auditoria');
    }
  };

  const handleCopyMarkdown = async () => {
    if (!generatedArticle) return;
    const fullDoc = `# ${generatedArticle.title}\n\n*${generatedArticle.excerpt}*\n\n**Categoria:** ${generatedArticle.category} | **Tempo de Leitura:** ${generatedArticle.readingTimeMinutes} min\n\n---\n\n${generatedArticle.body}`;
    try {
      // Sem `await`, uma clipboard negada (contexto não seguro, permissão do
      // navegador) virava rejeição não tratada e a UI mostrava "Copiado!" mesmo
      // sem ter copiado nada.
      await navigator.clipboard.writeText(fullDoc);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar o Markdown:', err);
      setErrorMessage(
        'Não foi possível copiar. Libere a permissão de área de transferência ou use o modo Markdown para copiar manualmente.'
      );
    }
  };

  const handleSaveDraft = () => {
    if (!generatedArticle) return;
    saveAIDraft({
      taskType: 'content_generation',
      title: generatedArticle.title,
      summary: generatedArticle.excerpt || generatedArticle.title,
      model: 'GLM-5.2 + Motor Editorial TuaVia',
      rawContent: generatedArticle.body,
    });
    onRefreshDraftCount();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
      {/* Header do Módulo */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-800 bg-stone-900 p-3 sm:p-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20 text-blue-400">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="truncate">Redator Editorial & Artigos SEO</span>
              <span className="hidden shrink-0 rounded-md border border-blue-500/30 bg-blue-500/20 font-mono text-[9px] text-blue-300 md:inline-block">
                Padrão TuaVia Completo
              </span>
            </h2>
            <p className="hidden text-[10px] text-stone-400 sm:block">
              Gera título SEO, slug, resumo, categoria, tempo de leitura, FAQs e corpo
              completo em Markdown
            </p>
          </div>
        </div>

        {generatedArticle && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleSendToArticleForm}
              aria-label="Salvar ou publicar o artigo no formulário"
              className="flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-2.5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-500 active:scale-95 sm:px-3 sm:py-1.5"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salvar / Publicar Artigo</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Indicador de Progresso de Job Assíncrono */}
      {(isGenerating || isRefining) && (
        <div className="p-3.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
              <span>{jobStage || 'Processando tarefa de IA em segundo plano...'}</span>
            </span>
            <span className="font-mono text-blue-700 font-bold">{jobProgress}%</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${jobProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerta de erro */}
      {errorMessage && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {jobRetryable && !isGenerating && !isRefining && (
              <button
                type="button"
                onClick={handleGenerate}
                className="min-h-10 cursor-pointer rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-red-700"
              >
                Tentar novamente
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Fechar alerta"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-red-700 hover:bg-red-100 hover:text-red-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Corpo: Painel Esquerdo (Inputs) / Painel Direito (Resultados) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna de Configuração da Pauta */}
          <div className="lg:col-span-4 space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                Tema / Pauta do Artigo *
              </label>
              <textarea
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Como escolher a primeira e-bike para trabalhar como entregador"
                className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 text-xs text-stone-900 focus:bg-white focus:border-blue-500 transition-all outline-none font-medium leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-xs text-stone-900 font-medium"
                >
                  {ARTICLE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Formato
                </label>
                <select
                  value={articleType}
                  onChange={(e) => setArticleType(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-xs text-stone-900 font-medium"
                >
                  <option value="guide">📘 Guia Completo</option>
                  <option value="review">🔍 Review Técnico</option>
                  <option value="comparison">🥊 Comparativo</option>
                  <option value="news">📰 Notícia</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                Público-Alvo
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ex: Ciclistas urbanos e entregadores de app"
                className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-xs text-stone-900"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                Palavras-Chave SEO (separadas por vírgula)
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Ex: e-bike barata, autonomia 60km, ifood"
                className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2 text-xs text-stone-900"
              />
            </div>

            {/* Controle de Modo Pensamento (Reasoning Mode) & Modelo */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Modelo de Redação IA (NVIDIA NIM)
                  </label>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as NvidiaModelId)}
                  className="w-full rounded-xl border border-amber-300/80 bg-white p-2 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {ALL_NVIDIA_MODEL_IDS.map((id) => {
                    const info = NVIDIA_MODELS[id];
                    return (
                      <option key={id} value={id}>
                        {info.name} — {info.recommendedParams.maxTokens} tok · {info.category}
                        {info.multimodal ? ' · visão' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] leading-relaxed text-amber-800/80">
                  Os {ALL_NVIDIA_MODEL_IDS.length} modelos do catálogo NVIDIA NIM. O GLM 5.3 é o padrão
                  da redação; o Nemotron Ultra é o de raciocínio mais forte.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                <div className="flex items-center gap-1.5">
                  <Brain className={`w-4 h-4 ${enableThinking ? 'text-amber-600' : 'text-stone-400'}`} />
                  <span className="text-xs font-bold text-stone-900">Modo Pensamento (Reasoning)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableThinking}
                    onChange={(e) => setEnableThinking(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {enableThinking && (
                <div className="space-y-2 pt-1 border-t border-amber-200/60 text-[11px]">
                  <div className="flex items-center justify-between text-stone-600">
                    <span className="font-semibold">Nível de Raciocínio:</span>
                    <div className="flex gap-1">
                      {(['low', 'medium', 'high'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setReasoningEffort(lvl)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            reasoningEffort === lvl
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white text-stone-600 border border-stone-200 hover:bg-amber-100/50'
                          }`}
                        >
                          {lvl === 'high' ? 'Alto' : lvl === 'medium' ? 'Médio' : 'Leve'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800/80 leading-relaxed">
                    A IA analisa fatos, normas CONTRAN e estrutura editorial antes de redigir cada seção do artigo.
                  </p>
                </div>
              )}
            </div>

            {/* Sugestões Rápidas de Pautas */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Sugestões de Pautas com Alto Tráfego:
              </span>
              <div className="space-y-1">
                {SUGESTOES_ARTIGOS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(sug)}
                    className="w-full text-left p-2 rounded-xl bg-stone-50 hover:bg-blue-50/80 border border-stone-200 hover:border-blue-300 text-stone-700 hover:text-stone-900 text-xs transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate flex-1 font-medium">{sug.tema}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-600 shrink-0 ml-1" />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-950/10 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Redigindo Artigo Completo com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Artigo Completo com SEO</span>
                </>
              )}
            </button>
          </div>

          {/* Coluna de Visualização do Artigo */}
          <div className="lg:col-span-8 flex flex-col min-h-[450px]">
            {generatedArticle ? (
              <div className="bg-stone-50 rounded-2xl border border-stone-200 flex flex-col flex-1 overflow-hidden">
                {/* Barra de Controles de Visualização */}
                <div className="p-3 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'preview'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualização</span>
                    </button>
                    <button
                      onClick={() => setViewMode('fields')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'fields'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                      <span>Campos & SEO</span>
                    </button>
                    <button
                      onClick={() => setViewMode('markdown')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        viewMode === 'markdown'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Markdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('split')}
                      className={`hidden cursor-pointer items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition-all md:flex ${
                        viewMode === 'split'
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>Dividido</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefineBody}
                      disabled={isRefining}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-purple-200 cursor-pointer disabled:opacity-50"
                      title="Refinar e aprofundar texto com IA"
                    >
                      {isRefining ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      <span>Refinar Texto</span>
                    </button>

                    <button
                      onClick={handleCopyMarkdown}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-stone-200 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar Markdown</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleSaveDraft}
                      className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-stone-200 cursor-pointer"
                    >
                      {saveSuccess ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Salvo!</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3 h-3" />
                          <span>Salvar Cache</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadados do Artigo */}
                <div className="p-4 bg-blue-50/50 border-b border-blue-100 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-stone-900">
                      {generatedArticle.title || 'Artigo sem título'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                      {generatedArticle.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-stone-600">
                    <span className="flex items-center gap-1 font-mono">
                      <Tag className="w-3 h-3 text-blue-600" />
                      <strong>Slug:</strong> /{generatedArticle.slug}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-600" />
                      <strong>Leitura:</strong> {generatedArticle.readingTimeMinutes || 5} min
                    </span>
                    {generatedArticle.relatedBikeCategories && (
                      <span className="flex items-center gap-1">
                        <strong>Bikes:</strong>{' '}
                        {generatedArticle.relatedBikeCategories.join(', ')}
                      </span>
                    )}
                  </div>

                  {generatedArticle.excerpt && (
                    <p className="text-stone-700 italic border-l-2 border-blue-400 pl-2 bg-white/60 p-1.5 rounded-r-lg">
                      {generatedArticle.excerpt}
                    </p>
                  )}
                </div>

                {/* Conteúdo Principal por Modo.
                    Sem `max-h`: o pai (`.flex-1.overflow-y-auto`) já é a região
                    que rola. O teto de 500px criava um segundo scroll aninhado
                    dentro do primeiro — o usuário rolava o artigo sem sair do
                    lugar, e no celular o gesto competia com o scroll da página. */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-thin sm:p-6">
                  {viewMode === 'preview' && (
                    <div className="prose prose-stone max-w-none text-xs sm:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {formatMarkdownForDisplay(generatedArticle.body || '')}
                      </ReactMarkdown>
                    </div>
                  )}

                  {viewMode === 'fields' && (
                    <div className="space-y-4 text-xs">
                      <div className="space-y-1">
                        <label className="font-bold text-stone-700 uppercase tracking-wider block">
                          Título Otimizado para SEO:
                        </label>
                        <input
                          type="text"
                          value={generatedArticle.title}
                          onChange={(e) =>
                            setGeneratedArticle({ ...generatedArticle, title: e.target.value })
                          }
                          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-stone-900 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-stone-700 uppercase tracking-wider block">
                            Slug da URL:
                          </label>
                          <input
                            type="text"
                            value={generatedArticle.slug}
                            onChange={(e) =>
                              setGeneratedArticle({ ...generatedArticle, slug: e.target.value })
                            }
                            className="w-full bg-white border border-stone-300 rounded-xl p-2 font-mono text-stone-800"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-stone-700 uppercase tracking-wider block">
                            Tempo Estimado (min):
                          </label>
                          <input
                            type="number"
                            value={generatedArticle.readingTimeMinutes}
                            onChange={(e) =>
                              setGeneratedArticle({
                                ...generatedArticle,
                                readingTimeMinutes: Number(e.target.value),
                              })
                            }
                            className="w-full bg-white border border-stone-300 rounded-xl p-2 text-stone-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-stone-700 uppercase tracking-wider block">
                          Resumo Editorial (Meta Description):
                        </label>
                        <textarea
                          rows={2}
                          value={generatedArticle.excerpt}
                          onChange={(e) =>
                            setGeneratedArticle({ ...generatedArticle, excerpt: e.target.value })
                          }
                          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-stone-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-stone-700 uppercase tracking-wider block">
                          Palavras-chave SEO:
                        </label>
                        <input
                          type="text"
                          value={(generatedArticle.seoKeywords || []).join(', ')}
                          onChange={(e) =>
                            setGeneratedArticle({
                              ...generatedArticle,
                              seoKeywords: e.target.value.split(',').map((s) => s.trim()),
                            })
                          }
                          className="w-full bg-white border border-stone-300 rounded-xl p-2 text-stone-800"
                        />
                      </div>
                    </div>
                  )}

                  {viewMode === 'markdown' && (
                    <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                      {generatedArticle.body || ''}
                    </pre>
                  )}

                  {viewMode === 'split' && (
                    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2">
                      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-900 p-3 font-mono text-xs text-stone-100 scrollbar-thin">
                        {generatedArticle.body || ''}
                      </pre>
                      <div className="max-h-[420px] overflow-auto p-2 prose prose-stone max-w-none text-xs scrollbar-thin">
                        <ReactMarkdown>{generatedArticle.body || ''}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[350px] bg-stone-50 rounded-2xl border border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-500 p-6 text-center space-y-2">
                <FileText className="w-12 h-12 text-stone-300" />
                <p className="text-sm font-bold text-stone-700">Nenhum artigo redigido ainda</p>
                <p className="text-xs text-stone-500 max-w-sm">
                  Preencha o tema e as palavras-chave ao lado e clique em &quot;Gerar Artigo Completo&quot; para acionar o motor editorial.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
