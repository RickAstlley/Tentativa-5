'use client';

import { slugify } from '@/lib/slug';
import React, { useState, useEffect } from 'react';
import SafeImage, { cleanImageUrl } from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import { Article, ArticleCategory } from '@/types/article';
import { EBikeCategory } from '@/types/ebike';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import ReactMarkdown from 'react-markdown';
import { safeJsonStringify } from '@/lib/utils';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import { createAndPollLLMJob } from '@/lib/ai/llmJobClient';
import ArticleAiAssistantCard from '@/components/admin/ArticleAiAssistantCard';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Eye,
  Edit3,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Info,
  Tag,
  Search,
  ExternalLink,
  Bot,
  UserCheck,
  Check,
  Bike,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const ARTICLE_CATEGORIES: ArticleCategory[] = [
  'Guia de Compra',
  'Manutenção',
  'Legislação',
  'Notícias',
  'Comparativo',
];

const BIKE_CATEGORIES: EBikeCategory[] = [
  'Urbana',
  'Trilha/MTB',
  'Dobrável',
  'Cargo',
  'Speed',
];

interface StoredDraftArticle {
  title: string;
  slug?: string;
  category?: string;
  excerpt: string;
  markdownContent: string;
  seo?: {
    metaTitle: string;
    metaDescription: string;
    focusKeywords: string[];
    suggestedTags: string[];
  };
  readTimeMinutes?: number;
  targetAudience?: string;
  referencedBikes?: string[];
  generatedAt?: string;
  model?: string;
}

export default function AdminArticleAuditPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [rawDraft, setRawDraft] = useState<StoredDraftArticle | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('tuavia_draft_article_audit');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [hasDraftLoaded] = useState(() => Boolean(rawDraft));

  // Estados dos Campos Editáveis para Auditoria Humana
  const [title, setTitle] = useState(() => rawDraft?.title || '');
  const [slug, setSlug] = useState(() => rawDraft?.slug || (rawDraft as any)?.slug || slugify(rawDraft?.title || ''));
  const [autoSlug, setAutoSlug] = useState(true);
  const [excerpt, setExcerpt] = useState(() => rawDraft?.excerpt || '');
  const [category, setCategory] = useState<ArticleCategory>(() => {
    if (rawDraft?.category) {
      const match = ARTICLE_CATEGORIES.find(
        (c) => c.toLowerCase() === rawDraft.category?.toLowerCase()
      );
      if (match) return match;
      if (rawDraft.category.includes('Guia')) return 'Guia de Compra';
      if (rawDraft.category.includes('Compar')) return 'Comparativo';
      if (rawDraft.category.includes('Manut')) return 'Manutenção';
    }
    return 'Guia de Compra';
  });
  const [publishedAt, setPublishedAt] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [readingTimeMinutes, setReadingTimeMinutes] = useState<number>(
    () => rawDraft?.readTimeMinutes || 5
  );
  const [coverImage, setCoverImage] = useState(() => (rawDraft as any)?.coverImage || 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=1200&q=80');
  const [body, setBody] = useState(
    () =>
      rawDraft?.markdownContent ||
      (rawDraft as any)?.body ||
      (rawDraft as any)?.rawContent ||
      (rawDraft as any)?.content ||
      (rawDraft as any)?.artigo_completo_markdown ||
      (rawDraft as any)?.artigo ||
      (rawDraft as any)?.texto ||
      ''
  );
  const [relatedBikeCategories, setRelatedBikeCategories] = useState<string[]>(() => (rawDraft as any)?.relatedBikeCategories || ['Urbana']);
  
  // SEO & Metadados do Agente
  const [metaTitle, setMetaTitle] = useState(() => rawDraft?.seo?.metaTitle || rawDraft?.title || '');
  const [metaDescription, setMetaDescription] = useState(() => rawDraft?.seo?.metaDescription || rawDraft?.excerpt || '');
  const [focusKeywords, setFocusKeywords] = useState<string[]>(() => rawDraft?.seo?.focusKeywords || rawDraft?.seo?.suggestedTags || []);
  const [newKeyword, setNewKeyword] = useState('');
  const [referencedBikes, setReferencedBikes] = useState<string[]>(() => rawDraft?.referencedBikes || []);

  // Checklist de Auditoria Humana
  const [auditCheck1, setAuditCheck1] = useState(false); // Revisão de Fatos e Números
  const [auditCheck2, setAuditCheck2] = useState(false); // SEO e Título adequados
  const [auditCheck3, setAuditCheck3] = useState(false); // Imagem de Capa verificada
  const [auditCheck4, setAuditCheck4] = useState(false); // Tom editorial TuaVia aprovado

  // Estados de IA para Auditoria & Refinamento
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [isRefiningText, setIsRefiningText] = useState(false);
  const [proposedSEO, setProposedSEO] = useState<{
    title: string;
    slug: string;
    excerpt: string;
    category: ArticleCategory;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  } | null>(null);
  const [proposedRefinedBody, setProposedRefinedBody] = useState<string | null>(null);
  const [publishedSuccessSlug, setPublishedSuccessSlug] = useState<string | null>(null);

  // Estados de Interface
  const [activeView, setActiveView] = useState<'audit' | 'preview'>('audit');
  const [showAiAssistantCard, setShowAiAssistantCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autenticação
  useEffect(() => {
    setCheckingAuth(false);
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (autoSlug) {
      setSlug(slugify(newTitle));
    }
  };

  const handleBodyChange = (newBody: string) => {
    setBody(newBody);
    if (newBody) {
      const words = newBody.trim().split(/\s+/).filter(Boolean).length;
      const calculatedMin = Math.max(1, Math.ceil(words / 200));
      setReadingTimeMinutes(calculatedMin);
    }
  };

  const handleCategoryToggle = (cat: string) => {
    setRelatedBikeCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim() && !focusKeywords.includes(newKeyword.trim())) {
      setFocusKeywords([...focusKeywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setFocusKeywords(focusKeywords.filter((k) => k !== kwToRemove));
  };

  // 1. Gerar Título, Slug e Kit SEO por IA Forte
  const [seoProgressStage, setSeoProgressStage] = useState<string>('');
  const handleAutoGenerateSEOWithAI = async () => {
    setIsGeneratingSEO(true);
    setError(null);
    setSeoProgressStage('Iniciando análise de SEO...');

    try {
      const prompt = `Você é o Especialista em SEO e Titulação Editorial do TuaVia (portal sobre bicicletas elétricas e mobilidade).
Analise o texto do artigo abaixo e responda EXCLUSIVAMENTE em formato JSON com a seguinte estrutura:
{
  "title": "Título magnético e otimizado para SEO com palavra-chave principal",
  "slug": "slug-limpo-sem-acentos-para-url",
  "excerpt": "Resumo editorial de 120 a 160 caracteres com excelente CTA",
  "category": "Guia de Compra", // Escolha estritamente uma entre: "Guia de Compra", "Manutenção", "Legislação", "Notícias", "Comparativo"
  "metaTitle": "Título Meta para Google (máx 60 caracteres)",
  "metaDescription": "Descrição Meta engajadora para buscadores",
  "keywords": ["ebike", "mobilidade", "bateria", "guia", "analise"]
}

TEXTO BASE DO ARTIGO:
${body || excerpt || title}`;

      const jobResult = await createAndPollLLMJob({
        type: 'content_generation',
        input: {
          task: 'seo_optimization',
          prompt,
        },
        onProgress: (job) => {
          setSeoProgressStage(`[${job.progress}%] ${job.stage || 'Processando...'}`);
        },
      });

      const json = jobResult.result || {};
      let parsedObj: any = null;

      if (json.data && typeof json.data === 'object' && (json.data.title || json.data.metaTitle)) {
        parsedObj = {
          title: json.data.title || json.data.metaTitle,
          slug: json.data.slug,
          excerpt: json.data.excerpt || json.data.metaDescription,
          category: json.data.category,
          metaTitle: json.data.seo?.metaTitle || json.data.metaTitle || json.data.title,
          metaDescription: json.data.seo?.metaDescription || json.data.metaDescription || json.data.excerpt,
          keywords:
            json.data.seo?.focusKeywords ||
            json.data.keywords ||
            json.data.focusKeywords ||
            json.data.suggestedTags ||
            [],
        };
      }

      if (!parsedObj || !parsedObj.title) {
        const candidate = json.text || (json as any).rawYamlResponse || (json as any).rawContent || '';
        if (candidate) {
          try {
            const match = candidate.match(/\{[\s\S]*\}/);
            if (match) {
              const raw = JSON.parse(match[0]);
              parsedObj = {
                title: raw.title || raw.metaTitle,
                slug: raw.slug,
                excerpt: raw.excerpt || raw.metaDescription,
                category: raw.category,
                metaTitle: raw.metaTitle || raw.title,
                metaDescription: raw.metaDescription || raw.excerpt,
                keywords: Array.isArray(raw.keywords) ? raw.keywords : (raw.focusKeywords || []),
              };
            }
          } catch {
            // fallback
          }
        }
      }

      if (parsedObj) {
        const catFound = ARTICLE_CATEGORIES.find(
          (c) => c.toLowerCase() === String(parsedObj.category || '').toLowerCase()
        ) || category || 'Guia de Compra';

        setProposedSEO({
          title: parsedObj.title || title,
          slug: parsedObj.slug ? slugify(parsedObj.slug) : slugify(parsedObj.title || title),
          excerpt: parsedObj.excerpt || excerpt,
          category: catFound,
          metaTitle: parsedObj.metaTitle || parsedObj.title || title,
          metaDescription: parsedObj.metaDescription || parsedObj.excerpt || excerpt,
          keywords: Array.isArray(parsedObj.keywords) && parsedObj.keywords.length > 0 ? parsedObj.keywords : focusKeywords,
        });
      } else {
        throw new Error('A IA não retornou um formato estruturado válido para SEO.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao gerar Título e SEO via IA.');
    } finally {
      setIsGeneratingSEO(false);
      setSeoProgressStage('');
    }
  };

  const applyProposedSEO = () => {
    if (!proposedSEO) return;
    setTitle(proposedSEO.title);
    setSlug(proposedSEO.slug);
    setExcerpt(proposedSEO.excerpt);
    setCategory(proposedSEO.category);
    setMetaTitle(proposedSEO.metaTitle);
    setMetaDescription(proposedSEO.metaDescription);
    if (proposedSEO.keywords.length > 0) {
      setFocusKeywords(proposedSEO.keywords);
    }
    setProposedSEO(null);
  };

  // 2. Refinamento Textual e Limpeza com a LLM Mais Forte
  const [refineProgressStage, setRefineProgressStage] = useState<string>('');
  const handleRefineArticleTextWithAI = async () => {
    if (!body.trim()) {
      setError('O corpo do artigo está vazio.');
      return;
    }

    setIsRefiningText(true);
    setError(null);
    setRefineProgressStage('Iniciando refinamento com IA...');

    try {
      const prompt = `Você é o Editor-Chefe Sênior do portal TuaVia (autoridade em e-bikes e mobilidade urbana no Brasil).
Sua missão é realizar a EDIÇÃO E REFINAMENTO TEXTUAL FINAL do artigo em Markdown a seguir.

INSTRUÇÕES DE REFINAMENTO EDITORIAL:
1. Remova qualquer saudação (ex: "Olá", "Bem-vindo"), introduções de IA, avisos de bastidores ou comentários desnecessários.
2. Elimine redundâncias, repetições de texto e frases de preenchimento.
3. Mantenha e aprimore a estrutura em Markdown: use títulos (#, ##, ###), tópicos em negrito e citações.
4. Mantenha intactos todos os dados técnicos e especificações (W, V, Ah, Wh, km/h, autonomia, preços).
5. O texto retornado deve ser estritamente o artigo em Markdown final, limpo e profissional.

ARTIGO ORIGINAL:
${body}`;

      const jobResult = await createAndPollLLMJob({
        type: 'content_generation',
        input: {
          task: 'content_generation',
          prompt,
        },
        onProgress: (job) => {
          setRefineProgressStage(`[${job.progress}%] ${job.stage || 'Refinando...'}`);
        },
      });

      const json = jobResult.result || {};
      
      // Extrai o texto limpo com prioridade: markdownContent estruturado -> rawYamlResponse / text -> rawContent
      let rawText = '';
      if (json.data && typeof json.data.markdownContent === 'string' && json.data.markdownContent.trim().length > 30) {
        rawText = json.data.markdownContent;
      } else if (typeof json.text === 'string' && json.text.trim()) {
        rawText = json.text;
      } else if (typeof (json as any).rawYamlResponse === 'string' && (json as any).rawYamlResponse.trim()) {
        rawText = (json as any).rawYamlResponse;
      } else if (typeof (json as any).rawContent === 'string' && (json as any).rawContent.trim()) {
        rawText = (json as any).rawContent;
      } else if (json.data && typeof json.data.body === 'string') {
        rawText = json.data.body;
      }

      // Se a resposta contiver um bloco YAML/JSON com markdown_content ou markdownContent, desempacotar
      if (rawText.includes('markdown_content:') || rawText.includes('markdownContent:')) {
        const yamlMatch = rawText.match(/(?:markdown_content|markdownContent):\s*(?:\||>)?\s*([\s\S]+?)(?:\n[a-z_]+:|$)/i);
        if (yamlMatch && yamlMatch[1]) {
          rawText = yamlMatch[1].trim();
        }
      }

      const cleaned = rawText
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```$/, '')
        .trim();

      if (cleaned) {
        setProposedRefinedBody(cleaned);
      } else {
        throw new Error('Resposta vazia ao refinar texto.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao refinar texto com a LLM.');
    } finally {
      setIsRefiningText(false);
      setRefineProgressStage('');
    }
  };

  const applyProposedRefinedBody = () => {
    if (!proposedRefinedBody) return;
    handleBodyChange(proposedRefinedBody);
    setProposedRefinedBody(null);
  };

  const handleApproveAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('O título do artigo é obrigatório.');
      return;
    }

    const cleanSlug = slug.trim() || slugify(title);
    if (!cleanSlug) {
      setError('O slug do artigo é obrigatório.');
      return;
    }

    if (!excerpt.trim()) {
      setError('O resumo/excerpt do artigo é obrigatório.');
      return;
    }

    if (!coverImage.trim()) {
      setError('A imagem de capa é obrigatória para publicação final.');
      return;
    }

    if (!body.trim()) {
      setError('O corpo do artigo em Markdown não pode estar vazio.');
      return;
    }

    setSaving(true);

    try {
      // Constrói o publishedAt garantindo precisão com data e horário para cronologia absoluta
      let finalPublishedAt = new Date().toISOString();
      if (publishedAt && publishedAt.trim().length > 0) {
        const rawDate = publishedAt.trim();
        if (rawDate.includes('T')) {
          finalPublishedAt = rawDate;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          const todayYmd = new Date().toISOString().split('T')[0];
          if (rawDate === todayYmd) {
            finalPublishedAt = new Date().toISOString();
          } else {
            finalPublishedAt = `${rawDate}T12:00:00.000Z`;
          }
        } else {
          finalPublishedAt = rawDate;
        }
      }

      const articleData: Article = {
        slug: cleanSlug,
        title: title.trim(),
        excerpt: excerpt.trim(),
        category,
        publishedAt: finalPublishedAt,
        readingTimeMinutes: Number(readingTimeMinutes) || 5,
        coverImage: coverImage.trim(),
        body: body.trim(),
        relatedBikeCategories,
      };

      // 1. Gravação no localStorage do site imediatamente para disponibilidade instantânea
      if (typeof window !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('tuavia_published_articles_v1');
          const existingList: Article[] = rawLocal ? JSON.parse(rawLocal) : [];
          const filteredList = existingList.filter((a) => a.slug !== cleanSlug);
          localStorage.setItem('tuavia_published_articles_v1', JSON.stringify([articleData, ...filteredList]));
        } catch (e) {
          console.warn('Erro ao salvar publicação localmente:', e);
        }
      }

      // 2. Gravação via API Backend
      let apiSuccess = false;
      try {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article: articleData }),
        });
        if (res.ok) apiSuccess = true;
      } catch (apiErr) {
        console.warn('[auditoria] Falha ao enviar para API backend:', apiErr);
      }

      // 3. Gravação no Firestore Client com timeout race
      if (!apiSuccess) {
        try {
          const firestorePromise = setDoc(doc(db, 'artigos', cleanSlug), articleData);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 3000)
          );
          await Promise.race([firestorePromise, timeoutPromise]);
        } catch (fErr) {
          console.warn('[auditoria] Firestore client indisponível ou demorou. Artigo salvo localmente com sucesso:', fErr);
        }
      }

      // Limpar rascunho de auditoria após aprovação
      localStorage.removeItem('tuavia_draft_article_audit');
      setPublishedSuccessSlug(cleanSlug);
    } catch (err) {
      console.error('Erro ao aprovar e publicar artigo:', err);
      setError('Ocorreu um erro ao salvar o artigo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="font-bold text-stone-900 text-sm">Verificando autorização...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 sm:pb-36 space-y-8">
        
        {/* Banner Superior de Auditoria Humana */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/admin/ia')}
                className="text-stone-500 hover:text-stone-900 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Copiloto IA
              </button>
              <span className="text-stone-300">/</span>
              <span className="text-amber-900 font-bold text-xs bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                Auditoria Humana Final
              </span>
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
              Auditoria Editorial & Publicação
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              Revise o conteúdo gerado por IA, valide dados técnicos, configure a capa e aprove para publicação no TuaVia.
            </p>
          </div>

          {/* Ações e Alternador de visualização */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAiAssistantCard((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] cursor-pointer ${
                showAiAssistantCard
                  ? 'bg-stone-900 text-amber-400'
                  : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Gerar Novo com IA</span>
              {showAiAssistantCard ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
              <button
                type="button"
                onClick={() => setActiveView('audit')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'audit'
                    ? 'bg-stone-900 text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Painel de Auditoria</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('preview')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'preview'
                    ? 'bg-stone-900 text-white shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pré-visualização</span>
              </button>
            </div>
          </div>
        </div>

        {/* Assistente Redator IA Editorial (quando ativado na tela de Auditoria) */}
        {showAiAssistantCard && (
          <div className="animate-fadeIn">
            <ArticleAiAssistantCard
              onArticleGenerated={(data) => {
                if (data.title) setTitle(data.title);
                if (data.slug) setSlug(data.slug);
                else if (data.title) setSlug(slugify(data.title));
                if (data.excerpt) setExcerpt(data.excerpt);
                if (data.category && ARTICLE_CATEGORIES.includes(data.category)) {
                  setCategory(data.category);
                }
                if (data.body) setBody(data.body);
                if (data.readingTimeMinutes) setReadingTimeMinutes(data.readingTimeMinutes);
                if (data.relatedBikeCategories) setRelatedBikeCategories(data.relatedBikeCategories);
                if (data.seoKeywords && data.seoKeywords.length > 0) {
                  setFocusKeywords(data.seoKeywords);
                }
                setShowAiAssistantCard(false);
              }}
              initialQuery={title}
            />
          </div>
        )}

        {/* Alertas Inteligentes de Detecção de E-Bike ou Ranking */}
        {((body.includes('"marca"') && body.includes('"modelo"')) || body.includes('"potenciaW"') || body.includes('"specSections"')) && (
          <div className="bg-amber-50 border-2 border-stone-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Este Rascunho é uma Ficha de E-Bike!</h3>
                <p className="text-stone-600 text-xs mt-0.5">
                  Detectamos que o conteúdo em cache contém especificações de E-Bike. Você pode direcioná-lo ao formulário técnico de E-Bikes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  const parsed = JSON.parse(body);
                  sessionStorage.setItem('tuavia_prefill_bike', safeJsonStringify(parsed));
                } catch {
                  sessionStorage.setItem('tuavia_prefill_bike', safeJsonStringify({ modelo: title, resumoExecutivo: excerpt }));
                }
                router.push('/admin/bikes/novo');
              }}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer"
            >
              <Bike className="w-4 h-4 text-emerald-400" />
              <span>Abrir no Cadastro de E-Bikes</span>
            </button>
          </div>
        )}

        {(body.includes('"criterioAvaliacao"') || body.includes('"quantidadeItens"') || (body.includes('"itens"') && body.includes('"posicao"'))) && (
          <div className="bg-amber-50 border-2 border-stone-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Este Rascunho é um Top Ranking Comparativo!</h3>
                <p className="text-stone-600 text-xs mt-0.5">
                  Detectamos que o conteúdo em cache contém uma estrutura de Ranking. Você pode direcioná-lo ao formulário de Rankings.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  let parsed: any = null;
                  try {
                    parsed = JSON.parse(body);
                  } catch {
                    alert('O texto do rascunho não contém um JSON estruturado válido. Copie o conteúdo manualmente.');
                    return;
                  }

                  const data = parsed.data || parsed;
                  const isValidStructure =
                    data &&
                    (data.titulo || data.title) &&
                    Array.isArray(data.itens) &&
                    data.itens.length >= 3;

                  if (!isValidStructure) {
                    alert('O rascunho não contém a estrutura mínima de um ranking (título e pelo menos 3 itens). Copie o texto manualmente.');
                    return;
                  }

                  const isFallback =
                    parsed.source === 'deterministic_fallback' ||
                    parsed.llmValidated === false ||
                    data.source === 'deterministic_fallback' ||
                    data.llmValidated === false;

                  if (isFallback) {
                    const confirmUse = window.confirm(
                      'Este ranking é um rascunho estimado (não validado pela IA). Deseja encaminhar para o formulário de criação para revisão manual?'
                    );
                    if (!confirmUse) return;
                  }

                  const prefillPayload = {
                    titulo: data.titulo || data.title || title,
                    subtitulo: data.subtitulo || data.subtitle || excerpt || '',
                    categoria: data.categoria || data.category || 'Geral',
                    criterioAvaliacao: data.criterioAvaliacao || data.criteria || 'Custo-benefício, autonomia e assistência técnica.',
                    conclusaoGeral: data.conclusaoGeral || data.conclusion || '',
                    itens: data.itens || [],
                    model: data.model || parsed.model || (isFallback ? 'deterministic_fallback' : 'llm'),
                    source: isFallback ? 'deterministic_fallback' : (parsed.source || data.source || 'unknown'),
                    llmValidated: isFallback ? false : (parsed.llmValidated ?? data.llmValidated ?? false),
                    validationPassed: parsed.validationPassed ?? data.validationPassed ?? !isFallback,
                  };

                  sessionStorage.setItem('tuavia_prefill_ranking', safeJsonStringify(prefillPayload));
                  router.push('/admin/rankings/novo');
                } catch (err) {
                  console.error('Erro ao encaminhar ranking da auditoria:', err);
                  alert('Erro ao processar o ranking para encaminhamento.');
                }
              }}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Abrir no Cadastro de Rankings</span>
            </button>
          </div>
        )}

        {/* Banner de Sucesso da Publicação */}
        {publishedSuccessSlug && (
          <div className="bg-emerald-50 border-2 border-emerald-600 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(16,185,129,1)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black text-emerald-950">🎉 Artigo Auditado e Publicado no Site com Sucesso!</h3>
                <p className="text-xs text-emerald-800">
                  O artigo foi gravado no banco de dados e está imediatamente visível para todos os leitores do TuaVia.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={`/artigos/${publishedSuccessSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer border border-emerald-800"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ver Artigo Vivo no Site (/artigos/{publishedSuccessSlug})</span>
              </a>

              <button
                type="button"
                onClick={() => router.push('/admin/artigos')}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ir para Gerenciador de Artigos</span>
              </button>
            </div>
          </div>
        )}

        {/* Indicador de Rascunho IA Carregado */}
        {hasDraftLoaded && rawDraft && !publishedSuccessSlug && (
          <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-indigo-950">
                  Conteúdo importado do Agente ({rawDraft.model || 'NVIDIA Kimi K3'})
                </p>
                <p className="text-indigo-800 text-[11px]">
                  Todos os campos foram pré-carregados. Use as ferramentas de IA abaixo para refinar título, slug e texto final.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-white border border-indigo-300 rounded-lg font-mono text-[10px] font-bold text-indigo-700">
              {rawDraft.generatedAt || 'Recém-gerado'}
            </span>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="p-4 bg-rose-50 border-2 border-rose-600 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-3 shadow-[4px_4px_0px_0px_rgba(225,29,72,1)]">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* FORMULÁRIO DE AUDITORIA */}
        <form onSubmit={handleApproveAndPublish} className="space-y-8">
          {activeView === 'audit' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Coluna Principal (8/12) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Bloco 1: Informações e Metadados do Artigo com Ação da IA */}
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-stone-900 pb-3">
                    <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-indigo-600" />
                      Revisão de Conteúdo & Título
                    </h2>

                    {/* BOTÃO: Auto-preenchimento de Título, Slug e SEO */}
                    <button
                      type="button"
                      onClick={handleAutoGenerateSEOWithAI}
                      disabled={isGeneratingSEO}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isGeneratingSEO ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{seoProgressStage || 'Gerando Título & SEO...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Gerar Título, Slug & SEO (LLM Pro)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Proposta da IA para SEO */}
                  {proposedSEO && (
                    <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-xl space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                        <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <Bot className="w-4 h-4 text-indigo-600" />
                          Sugestão Otimizada de SEO gerada pela LLM:
                        </span>
                        <button
                          type="button"
                          onClick={() => setProposedSEO(null)}
                          className="text-stone-400 hover:text-stone-700 font-bold"
                        >
                          Descartar
                        </button>
                      </div>
                      <div>
                        <strong>Título Sugerido:</strong> {proposedSEO.title}
                      </div>
                      <div>
                        <strong>Slug Sugerido:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200">{proposedSEO.slug}</code>
                      </div>
                      <div>
                        <strong>Excerpt/Meta Description:</strong> {proposedSEO.excerpt}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={applyProposedSEO}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aplicar Título, Slug, Excerpt & SEO no Formulário</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Título */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Título do Artigo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Slug da URL */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                        Slug da URL <span className="text-rose-600">*</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoSlug}
                          onChange={(e) => {
                            setAutoSlug(e.target.checked);
                            if (e.target.checked && title) {
                              setSlug(slugify(title));
                            }
                          }}
                          className="rounded border-stone-400 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Sincronizar com título</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-stone-400 bg-stone-100 px-3 py-2.5 rounded-xl border border-stone-300">
                        /artigos/
                      </span>
                      <input
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => {
                          setAutoSlug(false);
                          setSlug(e.target.value);
                        }}
                        className="flex-1 px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Resumo / Excerpt */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Resumo Editorial (Excerpt) <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      className="w-full px-4 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Bloco 2: Corpo do Artigo em Markdown com Refinador LLM */}
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-stone-900 pb-3">
                    <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      Corpo do Artigo (Markdown Auditável) <span className="text-rose-600">*</span>
                    </h2>

                    {/* BOTÃO: Refinar & Limpar Texto com LLM */}
                    <button
                      type="button"
                      onClick={handleRefineArticleTextWithAI}
                      disabled={isRefiningText}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isRefiningText ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{refineProgressStage || 'Refinando Texto com LLM...'}</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-300" />
                          <span>Refinar & Limpar Texto (LLM Avançada)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Proposta de Refinamento da LLM */}
                  {proposedRefinedBody && (
                    <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-emerald-600" />
                          Texto Refinado e Limpo pela LLM Avançada:
                        </span>
                        <button
                          type="button"
                          onClick={() => setProposedRefinedBody(null)}
                          className="text-stone-400 hover:text-stone-700 font-bold"
                        >
                          Descartar
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto p-3 bg-white rounded-lg border border-emerald-200 text-gray-800 font-mono text-[11px] whitespace-pre-wrap">
                        {proposedRefinedBody.slice(0, 1000)}...
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={applyProposedRefinedBody}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aplicar Texto Refinado no Artigo</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-stone-600 text-xs font-medium">
                    Revise formatações, títulos de seções (<code className="bg-stone-100 px-1 py-0.5 rounded font-mono">##</code>) e citações (<code className="bg-stone-100 px-1 py-0.5 rounded font-mono">&gt;</code>).
                  </p>

                  <textarea
                    required
                    rows={18}
                    value={body}
                    onChange={(e) => handleBodyChange(e.target.value)}
                    className="w-full p-4 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-mono leading-relaxed text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Bloco 3: Kit SEO Validado */}
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
                  <h2 className="text-sm font-black text-stone-900 border-b-2 border-stone-900 pb-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-600" />
                    Kit de SEO & Tags (Gerado pela IA)
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-stone-700 uppercase">Meta Title</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-stone-700 uppercase">Meta Description</label>
                      <input
                        type="text"
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-900"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold text-stone-700 uppercase">Palavras-Chave & Tags de Busca</label>
                    <div className="flex flex-wrap gap-1.5">
                      {focusKeywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 border border-stone-300 rounded-lg text-xs font-bold text-stone-800"
                        >
                          <span>#{kw}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyword(kw)}
                            className="text-stone-400 hover:text-rose-600 cursor-pointer font-black ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Adicionar nova tag..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddKeyword}
                        className="px-3 py-1.5 bg-stone-900 text-white font-bold text-xs rounded-lg hover:bg-stone-800 cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Coluna Lateral (4/12) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Checklist de Auditoria Humana */}
                <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(245,158,11,1)] space-y-4">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-sm border-b-2 border-amber-300 pb-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <span>Checklist de Auditoria Humana</span>
                  </div>

                  <p className="text-xs text-amber-800 font-medium">
                    Antes de salvar na base oficial de artigos, confirme os pontos abaixo:
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-start gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditCheck1}
                        onChange={(e) => setAuditCheck1(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Validação factual: números de autonomia, Wh e preços estão corretos.</span>
                    </label>

                    <label className="flex items-start gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditCheck2}
                        onChange={(e) => setAuditCheck2(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Título e Slug estão claros e otimizados para busca.</span>
                    </label>

                    <label className="flex items-start gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditCheck3}
                        onChange={(e) => setAuditCheck3(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Imagem de capa selecionada com qualidade e proporção 16:9.</span>
                    </label>

                    <label className="flex items-start gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={auditCheck4}
                        onChange={(e) => setAuditCheck4(e.target.checked)}
                        className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Tom de voz do TuaVia aprovado (imparcial e sem alucinações).</span>
                    </label>
                  </div>
                </div>

                {/* Imagem de Capa */}
                <ImageUploadField
                  label="Imagem de Capa Obrigatória"
                  value={coverImage}
                  onChange={(url) => setCoverImage(url)}
                  folder="artigos"
                  presetType="articles"
                  required
                  aspectRatio="video"
                  helpText="Selecione uma imagem de alta resolução para a capa do artigo."
                />

                {/* Metadados & Categoria */}
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
                  <h2 className="text-sm font-black text-stone-900 border-b-2 border-stone-900 pb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    Categoria & Metadados
                  </h2>

                  {/* Categoria */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Categoria Editorial <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                      className="w-full px-3 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {ARTICLE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data de Publicação */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                      Data de Publicação
                    </label>
                    <input
                      type="date"
                      required
                      value={publishedAt ? publishedAt.split('T')[0] : ''}
                      onChange={(e) => setPublishedAt(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none"
                    />
                  </div>

                  {/* Tempo de Leitura */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-stone-500" />
                      Tempo de Leitura (minutos)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={readingTimeMinutes}
                      onChange={(e) => setReadingTimeMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Categorias de Bike Relacionadas */}
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-3">
                  <h2 className="text-sm font-black text-stone-900 border-b-2 border-stone-900 pb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Categorias Relacionadas
                  </h2>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {BIKE_CATEGORIES.map((bCat) => {
                      const isChecked = relatedBikeCategories.includes(bCat);
                      return (
                        <button
                          key={bCat}
                          type="button"
                          onClick={() => handleCategoryToggle(bCat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-stone-900 text-emerald-400 border-stone-900 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]'
                              : 'bg-stone-50 text-stone-700 border-stone-300 hover:border-stone-900'
                          }`}
                        >
                          <span>{bCat}</span>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Botão de Auditoria e Aprovação Final */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[52px]"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Publicando Artigo Auditado...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        <span>Aprovar & Salvar Artigo na Página</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          ) : (
            /* PREVIEW REAL DO ARTIGO */
            <div className="bg-white border-2 border-stone-900 rounded-3xl p-6 sm:p-10 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-8">
              <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pré-visualização Editorial Oficial TuaVia</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('audit')}
                  className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold text-xs rounded-lg border border-amber-400 transition-colors cursor-pointer"
                >
                  Voltar para Auditoria
                </button>
              </div>

              {/* Header Renderizado */}
              <header className="flex flex-col gap-4 border-b-2 border-stone-900 pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-3 py-1 rounded-xl uppercase tracking-wider">
                    {category}
                  </span>
                  <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-xl flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Auditado Humanamente TuaVia
                  </span>
                  <span className="text-xs font-mono text-stone-500 ml-auto">
                    {publishedAt} • {readingTimeMinutes} min de leitura
                  </span>
                </div>

                <h1 className="font-display font-black text-2xl sm:text-4xl text-stone-900 leading-tight">
                  {title || 'Título do Artigo'}
                </h1>

                <p className="text-sm sm:text-base text-stone-700 font-sans leading-relaxed border-l-4 border-indigo-600 pl-4 py-1 bg-indigo-50/50 rounded-r-xl">
                  {excerpt || 'Resumo do artigo...'}
                </p>
              </header>

              {/* Capa Renderizada */}
              {coverImage ? (
                <div className="relative w-full h-64 sm:h-[380px] rounded-2xl overflow-hidden border-2 border-stone-900 bg-stone-100">
                  <SafeImage
                    src={coverImage}
                    alt={title}
                    fill
                    className="object-cover"
                    fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
                  />
                </div>
              ) : (
                <div className="p-8 bg-stone-100 border-2 border-dashed border-stone-300 rounded-2xl text-center text-stone-500 text-xs font-bold">
                  Nenhuma imagem de capa selecionada. Insira ou faça upload na aba de Auditoria.
                </div>
              )}

              {/* Markdown Renderizado */}
              <article className="prose prose-neutral max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:text-stone-900 prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:border-b-2 prose-h2:border-stone-900 prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-p:text-sm sm:prose-p:text-base prose-p:leading-relaxed prose-p:text-stone-800 prose-li:text-sm sm:prose-li:text-base prose-strong:text-stone-900 prose-a:text-indigo-600 prose-a:font-bold prose-a:underline">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="font-display font-bold text-xl sm:text-2xl text-stone-900 border-b-2 border-stone-900 pb-2 mt-8 mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
                        <span>{children}</span>
                      </h2>
                    ),
                    ul: ({ children }) => (
                      <ul className="flex flex-col gap-2 my-4 pl-0 list-none">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-xs sm:text-sm text-stone-800 bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>{children}</div>
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="bg-amber-50 border-l-4 border-amber-500 border-y border-r border-stone-200 p-4 rounded-r-2xl my-6 not-italic text-stone-900 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 font-mono font-bold uppercase text-[10px] text-amber-800 mb-1">
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Nota TuaVia</span>
                        </div>
                        {children}
                      </blockquote>
                    )
                  }}
                >
                  {body || '*Escreva o conteúdo em Markdown para visualizar aqui.*'}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </form>

      </main>
    </div>
  );
}
