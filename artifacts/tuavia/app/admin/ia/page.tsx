'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowLeft,
  Database,
  PanelLeft,
  MessageSquare,
  FileText,
  Bike,
  Trophy,
  ShieldCheck,
  ImageIcon,
  AlertTriangle,
  Wand2,
  Cpu,
  Terminal,
  GitBranch,
  Settings,
  Brain,
  ArrowRight,
  X,
} from 'lucide-react';
import type { CopilotMode } from '@/types/globalRadar';
import { AITask } from '@/lib/ai/types';
import { QuickActionItem } from '@/lib/ai/validation/schemas';
import { getAIDrafts, saveAIDraft } from '@/lib/aiDraftCache';
import { cn, safeJsonStringify } from '@/lib/utils';
import AIDraftCacheDrawer from '@/components/admin/AIDraftCacheDrawer';
import CopilotSidebar from '@/components/admin/copilot/CopilotSidebar';
import CopilotChatView, { ChatMessage } from '@/components/admin/copilot/CopilotChatView';
import CopilotArticleWriterView from '@/components/admin/copilot/CopilotArticleWriterView';
import CopilotEBikeAnalysisView from '@/components/admin/copilot/CopilotEBikeAnalysisView';
import CopilotTopRankingView from '@/components/admin/copilot/CopilotTopRankingView';
import CopilotSystemStatusView from '@/components/admin/copilot/CopilotSystemStatusView';
import AIRadarPanel from '@/components/admin/AIRadarPanel';
import LLMPanel from '@/components/admin/LLMPanel';
import SectionErrorBoundary from '@/components/ui/SectionErrorBoundary';
import { adminFetch, fetchAdminJson } from '@/lib/ai/clientResponse';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';

/**
 * Modos sem tela própria. Não são placeholder de verdade: cada um aponta para
 * a página que realmente executa a tarefa, para o menu lateral nunca levar a
 * um beco sem saída.
 */
const MODE_PLACEHOLDER: Partial<
  Record<CopilotMode, { icon: React.ReactNode; title: string; description: string; href: string; cta: string }>
> = {
  audit_anti_hallucination: {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: 'Auditoria anti-alucinação',
    description:
      'Auditoria determinística contra a Resolução CONTRAN 996/2023 e verificação de fonte de cada campo da ficha antes de publicar.',
    href: '/admin/artigos/auditoria',
    cta: 'Abrir auditoria',
  },
  image_search: {
    icon: <ImageIcon className="w-6 h-6" />,
    title: 'Pesquisa de imagens',
    description:
      'A pesquisa visual roda dentro do editor de artigo, onde a imagem é aplicada ao corpo do texto e à galeria.',
    href: '/admin/artigos/novo',
    cta: 'Abrir editor de artigo',
  },
};

/** Atalhos para as demais telas de IA, que vivem fora do copiloto. */
const AI_TOOL_LINKS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  { href: '/admin/ia/setup', label: 'Setup de chaves', icon: <Settings className="w-3.5 h-3.5" /> },
  { href: '/admin/ia/pipelines', label: 'Pipelines', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { href: '/admin/ia/playground', label: 'Playground', icon: <Terminal className="w-3.5 h-3.5" /> },
  { href: '/admin/ia/vector-store', label: 'Base de conhecimento', icon: <Brain className="w-3.5 h-3.5" /> },
  { href: '/admin/configuracoes', label: 'Configurações', icon: <Wand2 className="w-3.5 h-3.5" /> },
];

function generateMsgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getCurrentTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const BRAINSTORM_THEMES = [
  {
    id: 'artigos_seo',
    label: 'Pautas de Artigos & SEO',
    desc: 'Tópicos com alta busca no Brasil (CONTRAN, Baterias, Guias de Compra)',
  },
  {
    id: 'analise_ebikes',
    label: 'Engenharia & Fichas de E-Bikes',
    desc: 'Análises de motores centrais, baterias de lítio e conformidade 996/2023',
  },
  {
    id: 'rankings_top',
    label: 'Top Rankings & Comparativos',
    desc: 'Classificações Top 3/5/10 de bikes, baterias e acessórios com lojas',
  },
  {
    id: 'auditoria_conformidade',
    label: 'Auditoria & Anti-Alucinação',
    desc: 'Verificação jurídica contra CONTRAN e normas reais de potência/velocidade',
  },
];

export default function AdminDedicatedCopilotPage() {
  const router = useRouter();

  // Modo ativo da página
  const [currentMode, setCurrentMode] = useState<CopilotMode>('chat');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const modeFromUrl = urlParams.get('mode') as CopilotMode | null;
    const modeFromStorage = sessionStorage.getItem('tuavia_copilot_active_mode') as CopilotMode | null;

    const validModes: CopilotMode[] = [
      'chat',
      'article_writer',
      'radar_pautas',
      'ebike_analysis',
      'top_ranking',
      'audit_anti_hallucination',
      'image_search',
      'telemetry',
      'llm_panel',
    ];

    if (modeFromUrl && validModes.includes(modeFromUrl)) {
      setCurrentMode(modeFromUrl);
      sessionStorage.removeItem('tuavia_copilot_active_mode');
    } else if (modeFromStorage && validModes.includes(modeFromStorage)) {
      setCurrentMode(modeFromStorage);
      sessionStorage.removeItem('tuavia_copilot_active_mode');
    }
  }, []);

  // Sidebar responsiva
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Esc fecha o drawer mobile. Sem isso o overlay só saía pelo overlay ou
  // escolhendo um modo — num celular não há como apertar Esc.
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileSidebarOpen]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Olá! Sou o **Copiloto IA do TuaVia**, seu assistente especializado em **Bicicletas Elétricas, Engenharia, Legislação CONTRAN, Top Rankings e Produção Editorial**.

### O que você pode fazer aqui:
- ✍️ **Redator Editorial**: Crie artigos estruturados e completos com SEO e exportação direta.
- ⚡ **Análise de E-Bikes**: Calcule Wh, Wh/km, W/kg e conformidade com a Resolução CONTRAN 996/2023.
- 🏆 **Top Rankings**: Gere comparativos Top 3/5/10 com pontuações, ofertas de lojas e veredito final.
- 💬 **Chat Inteligente**: Tire dúvidas técnicas sobre baterias, motores e manutenção.

*Navegue pelas ferramentas no menu lateral ou envie sua mensagem abaixo!*`,
      timestamp: getCurrentTimeStr(),
      task: 'content_generation',
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<AITask>('content_generation');
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Ações Rápidas do Brainstorm
  const [selectedTheme, setSelectedTheme] = useState<string | null>('artigos_seo');
  const [quickActions, setQuickActions] = useState<QuickActionItem[]>([
    {
      id: 'act-1',
      title: 'Bosch CX Gen 5 vs Shimano EP801',
      description: 'Comparativo técnico entre os dois maiores motores centrais para e-MTB no Brasil.',
      task: 'ebike_analysis',
      confidence: 0.98,
      sourceModel: 'Kimi K3',
      prompt: 'Faça um comparativo técnico aprofundado entre Bosch Performance Line CX Gen 5 e Shimano EP801 (85Nm).',
      tags: ['Motores', 'e-MTB', 'Torque'],
    },
    {
      id: 'act-2',
      title: 'Guia CONTRAN 996/2023 em Linguagem Simples',
      description: 'Explique para o leitor comum o que precisa para andar legalmente na ciclovia.',
      task: 'article_writer',
      confidence: 0.96,
      sourceModel: 'Kimi K3',
      prompt: 'Escreva um artigo didático e com SEO sobre a Resolução CONTRAN 996/2023 para e-bikes.',
      tags: ['Legislação', 'CONTRAN', 'SEO'],
    },
    {
      id: 'act-3',
      title: 'Top 5 E-Bikes Urbanas até R$ 7.000',
      description: 'Ranking comparativo com Caloi, Sense, Oggi e Duos.',
      task: 'top_ranking',
      confidence: 0.95,
      sourceModel: 'Kimi K3',
      prompt: 'Gere um ranking Top 5 das melhores e-bikes urbanas de até R$ 7.000 no Brasil em 2026.',
      tags: ['Rankings', 'Urbana', 'Custo-Benefício'],
    },
  ]);
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);
  const [actionReasoning, setActionReasoning] = useState<string | null>(null);
  const [showReasoningBox, setShowReasoningBox] = useState(false);
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<{
    model: string;
    time: string;
    theme: string;
    isLiveLLM: boolean;
  } | null>({
    model: 'Kimi K3 + Nemotron (TuaVia Core)',
    time: getCurrentTimeStr(),
    theme: 'Pautas de Artigos & SEO',
    isLiveLLM: true,
  });

  // Drawer de Rascunhos
  const [isDraftDrawerOpen, setIsDraftDrawerOpen] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  const refreshDraftList = () => {
    try {
      const drafts = getAIDrafts();
      setDraftCount(drafts.length);
    } catch {
      setDraftCount(0);
    }
  };

  useEffect(() => {
    refreshDraftList();
  }, []);

  // Enviar Mensagem no Chat
  const handleSendMessage = async (textToSend?: string, taskOverride?: AITask) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputMessage).trim();
    if (!text || isGenerating) return;

    const currentTask = taskOverride || selectedTask;

    const userMsg: ChatMessage = {
      id: generateMsgId(),
      role: 'user',
      content: text,
      timestamp: getCurrentTimeStr(),
      task: currentTask,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (typeof textToSend !== 'string') {
      setInputMessage('');
    }

    const assistantMsgId = generateMsgId();
    const placeholderAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: getCurrentTimeStr(),
      task: currentTask,
    };

    setMessages((prev) => [...prev, placeholderAssistantMsg]);
    setIsGenerating(true);
    setApiError(null);

    try {
      const jobResult = await createAndPollLLMJob({
        type: 'content_generation',
        input: {
          task: currentTask,
          prompt: text,
        },
        allowSyncFallback: true,
        onProgress: (job) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: `⏳ [${job.progress}%] ${job.stage || 'Processando com IA...'}\n\n*Aguardando processamento atômico em segundo plano.*`,
                  }
                : msg
            )
          );
        },
      });

      const finalContent =
        jobResult.result?.text ||
        jobResult.result?.data?.text ||
        jobResult.result?.data?.body ||
        jobResult.result?.data?.markdownContent ||
        (typeof jobResult.result?.data === 'string' ? jobResult.result?.data : '') ||
        '';

      if (!finalContent.trim()) {
        throw new Error('O Copiloto de IA retornou uma resposta vazia.');
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, content: finalContent } : msg))
      );

      saveAIDraft({
        taskType: currentTask,
        title: text.slice(0, 50),
        summary: finalContent.slice(0, 140).replace(/[*_#]/g, ''),
        model: 'Copiloto TuaVia IA',
        rawContent: finalContent,
      });
      refreshDraftList();
    } catch (err: any) {
      let errorMessage = err?.message || 'Erro ao processar mensagem.';
      let tipMessage = '*Dica: Você pode verificar o status dos provedores na aba Status do Sistema.*';

      if (
        err.errorCode === 'CONFIG_QUEUE_UNWRITABLE' ||
        err.errorCode === 'CONFIG_QUEUE_PATH_MISSING' ||
        err.errorCode === 'JOB_PERSISTENCE_FAILED'
      ) {
        errorMessage = 'O servidor não conseguiu gravar a tarefa na fila persistente. Verifique LLM_JOBS_FILE e as permissões da pasta na Hostinger.';
        tipMessage = '*Dica: Certifique-se de que a pasta configurada possui permissão de leitura e escrita pelo usuário Node.*';
      } else if (err.errorCode === 'API_KEY_MISSING') {
        errorMessage = 'A chave da NVIDIA não está configurada no servidor (NVIDIA_API_KEY).';
        tipMessage = '*Dica: Adicione NVIDIA_API_KEY no painel de variáveis de ambiente da Hostinger.*';
      } else if (err.errorCode === 'WORKER_UNAUTHORIZED' || err.errorCode === 'UNAUTHORIZED') {
        errorMessage = 'Autenticação do worker ou sessão administrativa inválida.';
        tipMessage = '*Dica: Verifique se LLM_WORKER_SECRET é idêntico no servidor e no worker.*';
      } else if (err.errorCode === 'EXECUTOR_UNREACHABLE') {
        errorMessage = 'O worker não conseguiu se comunicar com o servidor da aplicação.';
        tipMessage = '*Dica: Verifique LLM_EXECUTOR_BASE_URL no painel da Hostinger.*';
      }

      setApiError(errorMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ **Informação do Copiloto:** ${errorMessage}\n\n${tipMessage}`,
              }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Gerar Ações Rápidas via API
  const handleGenerateQuickActions = async (themeOverride?: string) => {
    const themeToUse = themeOverride || selectedTheme;
    setIsGeneratingActions(true);
    setActionReasoning(null);

    try {
      const jobResult = await createAndPollLLMJob({
        type: 'content_generation',
        input: {
          task: 'quick_actions',
          prompt: `Gere 3 sugestões estratégicas e acionáveis sobre o tema: ${themeToUse}.`,
        },
      });

      const data = jobResult.result?.data;
      if (data && data.actions && Array.isArray(data.actions)) {
        setQuickActions(data.actions);
        setActionReasoning(data.reasoning || null);
        setLastGeneratedInfo({
          model: 'Kimi K3 + Nemotron (TuaVia Core)',
          time: getCurrentTimeStr(),
          theme: BRAINSTORM_THEMES.find((t) => t.id === themeToUse)?.label || themeToUse || '',
          isLiveLLM: true,
        });
      }
    } catch (e: any) {
      console.warn('Fallback nas ações rápidas:', e);
    } finally {
      setIsGeneratingActions(false);
    }
  };

  const handleForwardToAudit = (articlePayload: any) => {
    try {
      localStorage.setItem('tuavia_draft_article_audit', safeJsonStringify(articlePayload));
      router.push('/admin/artigos/auditoria');
    } catch (e) {
      console.error('Erro ao salvar rascunho para auditoria:', e);
      router.push('/admin/artigos/auditoria');
    }
  };

  /**
   * Escolhe a tela do modo ativo.
   *
   * Cada ramo é isolado por `SectionErrorBoundary`: uma tela que quebra por
   * dado ruim não pode derrubar o copiloto inteiro, porque as outras oito
   * continuam utilizáveis.
   */
  const renderActiveMode = () => {
    const placeholder = MODE_PLACEHOLDER[currentMode];

    if (placeholder) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-stone-900/70 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-800 text-emerald-400">
              {placeholder.icon}
            </div>
            <h2 className="text-base font-black text-white">{placeholder.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-stone-400">
              {placeholder.description}
            </p>
            <Link
              href={placeholder.href}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
            >
              {placeholder.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      );
    }

    switch (currentMode) {
      case 'article_writer':
        return (
          <SectionErrorBoundary sectionName="Redator de Artigos">
            <CopilotArticleWriterView
              onRefreshDraftCount={refreshDraftList}
              onForwardToAudit={handleForwardToAudit}
            />
          </SectionErrorBoundary>
        );

      case 'ebike_analysis':
        return (
          <SectionErrorBoundary sectionName="Ficha E-Bike">
            <CopilotEBikeAnalysisView onRefreshDraftCount={refreshDraftList} />
          </SectionErrorBoundary>
        );

      case 'top_ranking':
        return (
          <SectionErrorBoundary sectionName="Top Rankings">
            <CopilotTopRankingView onRefreshDraftCount={refreshDraftList} />
          </SectionErrorBoundary>
        );

      case 'radar_pautas':
        return (
          <SectionErrorBoundary sectionName="Radar de Pautas">
            <div className="space-y-4 p-2 sm:p-4">
              <AIRadarPanel onSelectMode={(mode) => setCurrentMode(mode)} />
            </div>
          </SectionErrorBoundary>
        );

      case 'telemetry':
        return (
          <SectionErrorBoundary sectionName="Status do sistema">
            <div className="p-2 sm:p-4">
              <CopilotSystemStatusView />
            </div>
          </SectionErrorBoundary>
        );

      case 'llm_panel':
        return (
          <SectionErrorBoundary sectionName="LLM Panel">
            <div className="p-2 sm:p-4">
              <LLMPanel />
            </div>
          </SectionErrorBoundary>
        );

      case 'chat':
      default:
        return (
          <SectionErrorBoundary sectionName="Chat do Copiloto">
            <div className="h-full min-h-0">
              <CopilotChatView
                messages={messages}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                selectedTask={selectedTask}
                setSelectedTask={setSelectedTask}
                isGenerating={isGenerating}
                onSendMessage={handleSendMessage}
                quickActions={quickActions}
                isGeneratingActions={isGeneratingActions}
                selectedTheme={selectedTheme}
                setSelectedTheme={setSelectedTheme}
                onGenerateQuickActions={handleGenerateQuickActions}
                actionReasoning={actionReasoning}
                showReasoningBox={showReasoningBox}
                setShowReasoningBox={setShowReasoningBox}
                lastGeneratedInfo={
                  lastGeneratedInfo
                    ? `${lastGeneratedInfo.model} · ${lastGeneratedInfo.theme} · ${lastGeneratedInfo.time}`
                    : undefined
                }
                brainstormThemes={BRAINSTORM_THEMES}
              />
            </div>
          </SectionErrorBoundary>
        );
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-stone-950 text-stone-100">
      {/* Topo do Copiloto Dedicado - Fixo no Topo */}
      <header className="sticky top-0 z-30 shrink-0 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Voltar e Identidade */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Abrir menu do copiloto"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-700 bg-stone-800 text-stone-300 transition-all hover:bg-stone-700 hover:text-white lg:hidden"
            >
              <PanelLeft className="w-4 h-4 text-emerald-400" />
            </button>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold border border-stone-700 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Painel Admin</span>
            </Link>

            <div className="flex min-w-0 items-center gap-2 border-l border-stone-800 pl-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-xs font-bold text-white sm:text-sm">
                  <span className="truncate">Copiloto IA TuaVia</span>
                  <span className="hidden items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 sm:inline-flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Kimi K3 + Nemotron
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Abas Rápidas no Topo do Header */}
          <div className="hidden md:flex items-center gap-1 bg-stone-950/80 p-1 rounded-xl border border-stone-800 text-xs">
            <button
              onClick={() => setCurrentMode('chat')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                currentMode === 'chat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chatbot</span>
            </button>

            <button
              onClick={() => setCurrentMode('article_writer')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                currentMode === 'article_writer'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Redator de Artigos</span>
            </button>

            <button
              onClick={() => setCurrentMode('ebike_analysis')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                currentMode === 'ebike_analysis'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Ficha E-Bike</span>
            </button>

            <button
              onClick={() => setCurrentMode('top_ranking')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                currentMode === 'top_ranking'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Top Rankings</span>
            </button>

<button
              onClick={() => setCurrentMode('llm_panel')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                currentMode === 'llm_panel'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>LLM Panel</span>
            </button>
          </div>

          {/* Rascunhos em Cache */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDraftDrawerOpen(true)}
              aria-label={`Abrir rascunhos salvos (${draftCount})`}
              className="flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 px-2.5 py-2 text-xs font-medium text-stone-200 transition-all hover:bg-stone-700 hover:text-white sm:px-3 sm:py-1.5"
            >
              <Database className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden md:inline">Rascunhos</span>
              <span className="rounded-full border border-emerald-800 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                {draftCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Alerta de Erro */}
      {apiError && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{apiError}</span>
            </div>
            <button
              type="button"
              onClick={() => setApiError(null)}
              aria-label="Fechar alerta"
              className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-400 hover:bg-amber-900/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/*
        Estrutura Principal: coluna, com a barra "Ferramentas" embaixo e a linha
        `sidebar + conteúdo` acima.

        Este container é `flex-col` de propósito. A barra "Ferramentas" é filha
        direta dele, então com o container em `flex-row` ela virava uma coluna
        vertical espremida entre a sidebar e o `<main>`, roubando largura útil
        do conteúdo em tela estreita. O `border-t` que ela sempre carregou e o
        `pb-28 sm:pb-32` que o `<main>` sempre teve indicavam que a intenção já
        era uma barra inferior — o padding existia só para abrir espaço para uma
        barra que, na prática, nunca ficou embaixo.
      */}
      <div className="relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar Lateral */}
        <aside className="hidden w-72 shrink-0 border-r border-stone-800 bg-stone-950 lg:block">
<CopilotSidebar
            currentMode={currentMode}
            onSelectMode={(mode) => setCurrentMode(mode)}
            draftCount={draftCount}
            onOpenDrafts={() => setIsDraftDrawerOpen(true)}
            onNewChat={() => {
              setCurrentMode('chat');
              setMessages([
                {
                  id: generateMsgId(),
                  role: 'assistant',
                  content: 'Nova conversa iniciada. Em que posso colaborar com você agora?',
                  timestamp: getCurrentTimeStr(),
                  task: selectedTask,
                },
              ]);
            }}
          />
        </aside>

        {/* Sidebar Mobile Overlay */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do copiloto">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="relative flex h-full w-80 max-w-[85vw] flex-col bg-stone-950 shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-stone-800 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Menu do copiloto
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  aria-label="Fechar menu"
                  className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
              <CopilotSidebar
                currentMode={currentMode}
                onSelectMode={(mode) => {
                  setCurrentMode(mode);
                  setIsMobileSidebarOpen(false);
                }}
                draftCount={draftCount}
                onOpenDrafts={() => {
                  setIsDraftDrawerOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                onNewChat={() => {
                  setCurrentMode('chat');
                  setIsMobileSidebarOpen(false);
                  setMessages([
                    {
                      id: generateMsgId(),
                      role: 'assistant',
                      content: 'Nova conversa iniciada. Em que posso colaborar com você agora?',
                      timestamp: getCurrentTimeStr(),
                      task: selectedTask,
                    },
                  ]);
                }}
              />
              </div>
            </div>
          </div>
        )}

        {/* Container Principal do Modo Ativo */}
        <main
          className={cn(
            'flex min-w-0 flex-1 flex-col bg-stone-900/40',
            currentMode === 'chat' ? 'overflow-hidden p-2 sm:p-4' : 'overflow-y-auto p-2 sm:p-4'
          )}
        >
          {renderActiveMode()}
        </main>
        </div>

        {/* Atalhos para as demais telas de IA — barra inferior, irmã da linha acima */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-stone-800 bg-stone-950/60 px-3 py-2 sm:px-4">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Ferramentas
          </span>
          {AI_TOOL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1.5 text-[11px] font-medium text-stone-400 transition-colors hover:bg-stone-800 hover:text-stone-200"
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Drawer de Rascunhos Salvos */}
      <AIDraftCacheDrawer
        isOpen={isDraftDrawerOpen}
        onClose={() => setIsDraftDrawerOpen(false)}
        onSelectForAudit={(draft) => {
          setInputMessage(draft.rawContent || draft.summary);
          setCurrentMode('chat');
          setIsDraftDrawerOpen(false);
        }}
      />
    </div>
  );
}
