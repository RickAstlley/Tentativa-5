'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  Clock, 
  Share2, 
  Check, 
  Copy, 
  BookOpen, 
  ShieldCheck, 
  List, 
  Zap, 
  Bike, 
  Bookmark, 
  ThumbsUp, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Info,
  ChevronRight,
  Mail,
  Images,
  Maximize2,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatMarkdownForDisplay } from '@/lib/utils/markdownFormatter';
import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import { Article } from '@/types/article';
import { EBikeGrouped } from '@/types/ebike';
import { formatArticleDate, getArticleBySlug, fetchArticleBySlugFromFirestore } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';
import CategorySignBadge from '@/components/traffic/CategorySignBadge';
import ArticleRelatedBikes from './ArticleRelatedBikes';
import ContranGuideDedicatedView from '@/components/artigos/ContranGuideDedicatedView';
import Footer from '@/components/Footer';

interface ArticleClientContentProps {
  article?: Article | null;
  slug?: string;
  relatedBikes?: EBikeGrouped[];
  otherArticles?: Article[];
  prevArticle?: Article;
  nextArticle?: Article;
}

export default function ArticleClientContent({
  article,
  slug,
  relatedBikes = [],
  otherArticles = [],
  prevArticle,
  nextArticle,
}: ArticleClientContentProps) {
  const [currentArticle, setCurrentArticle] = useState<Article | null>(article || null);
  const [isLoading, setIsLoading] = useState<boolean>(!article);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [activeGalleryModalImage, setActiveGalleryModalImage] = useState<string | null>(null);

  // Resolução resiliente caso o artigo não venha pré-carregado do servidor
  useEffect(() => {
    if (!currentArticle && slug) {
      const local = getArticleBySlug(slug);
      if (local) {
        setCurrentArticle(local);
        setIsLoading(false);
        return;
      }

      fetchArticleBySlugFromFirestore(slug)
        .then((art) => {
          if (art) {
            setCurrentArticle(art);
          } else {
            return fetch(`/api/articles?slug=${encodeURIComponent(slug)}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.success && data.article) {
                  setCurrentArticle(data.article);
                } else {
                  setNotFound(true);
                }
              });
          }
        })
        .catch(() => {
          setNotFound(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (article) {
      setCurrentArticle(article);
      setIsLoading(false);
    }
  }, [article, currentArticle, slug]);

  // Formatar data em UTC longo
  const formattedDate = currentArticle ? formatArticleDate(currentArticle.publishedAt, 'long') : '';

  // Monitorar scroll para a barra de progresso no topo
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Extração automática de títulos h2 do Markdown para o Índice (TOC)
  const headings = React.useMemo(() => {
    const articleBody = currentArticle?.body;
    if (!articleBody) return [];
    const regex = /^##\s+(.+)$/gm;
    const matches: { text: string; id: string }[] = [];
    let match;
    while ((match = regex.exec(articleBody)) !== null) {
      const text = match[1].trim();
      const id = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      matches.push({ text, id });
    }
    return matches;
  }, [currentArticle?.body]);

  // Copiar Link
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Compartilhar WhatsApp
  const handleShareWhatsApp = () => {
    if (typeof window !== 'undefined' && currentArticle) {
      const text = encodeURIComponent(`Confira este guia no TuaVia: ${currentArticle.title}\n${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  // Compartilhar Twitter/X
  const handleShareTwitter = () => {
    if (typeof window !== 'undefined' && currentArticle) {
      const text = encodeURIComponent(`${currentArticle.title} — via TuaVia`);
      const url = encodeURIComponent(window.location.href);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    }
  };

  // Inscrição na Newsletter
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setNewsletterSubscribed(true);
      setTimeout(() => {
        setNewsletterEmail('');
      }, 3000);
    }
  };

  const CONTRAN_OFFICIAL_SLUGS = new Set([
    'legislacao-bicicletas-eletricas-contran',
    'resolucao-contran-996-2023',
    'guia-contran-996',
    'legislacao-ebikes-contran-996',
  ]);

  const cleanSlug = (slug || '').toLowerCase().trim();
  const cleanArticleSlug = (currentArticle?.slug || '').toLowerCase().trim();

  const isContranGuide = Boolean(
    CONTRAN_OFFICIAL_SLUGS.has(cleanSlug) ||
    CONTRAN_OFFICIAL_SLUGS.has(cleanArticleSlug)
  );

  if (!isLoading && !isContranGuide && (!currentArticle || notFound)) {
    return (
      <div className="w-full min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border-2 border-ink rounded-2xl p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto text-amber-700">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-ink">Artigo Não Encontrado</h2>
          <p className="text-xs font-mono text-neutral-600">
            O artigo &quot;{slug || 'solicitado'}&quot; não foi encontrado ou está em fase de publicação.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/artigos"
              className="px-4 py-2.5 bg-primary hover:bg-emerald-700 text-white font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all"
            >
              Ver Todos os Artigos
            </Link>
            <Link
              href="/"
              className="px-4 py-2.5 bg-surface hover:bg-neutral-100 text-ink font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all"
            >
              Ir para o Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentArticle && !isContranGuide) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const primaryCategory = currentArticle?.relatedBikeCategories?.[0] || 'Urbana';

  return (
    <div className="w-full min-h-screen flex flex-col justify-between relative" id="article-detail-page">
      
      {/* Barra de Progresso de Leitura Fixa no Topo */}
      <div 
        className="fixed top-0 left-0 h-1.5 bg-primary z-50 transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      <main className="flex-grow pt-6 sm:pt-10 pb-12 sm:pb-16 px-4 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Top Sticky Bar / Breadcrumb Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border-2 border-ink rounded-2xl p-3 sm:p-4 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-ink">
            <Link
              href="/artigos"
              className="inline-flex items-center gap-1.5 bg-white border border-ink px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] min-h-[36px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Todos os Artigos</span>
            </Link>

            <span className="text-ink/40 hidden sm:inline">/</span>

            <span className="hidden sm:inline-block text-ink/70 font-sans font-medium truncate max-w-[200px] md:max-w-[350px]">
              {currentArticle?.title || 'Guia CONTRAN 996'}
            </span>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-ink bg-white border border-ink px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] min-h-[36px] cursor-pointer"
              title="Copiar Link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="text-green-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="hidden xs:inline">Copiar Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-[#25D366] border border-ink px-3 py-1.5 rounded-xl hover:brightness-105 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] min-h-[36px] cursor-pointer"
              title="Compartilhar no WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 fill-current" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setBookmarked(!bookmarked)}
              className={`inline-flex items-center justify-center w-9 h-9 border border-ink rounded-xl transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer ${
                bookmarked ? 'bg-accent-gold text-ink' : 'bg-white text-ink hover:bg-neutral-100'
              }`}
              title={bookmarked ? 'Salvo nos favoritos' : 'Salvar guia'}
            >
              <Bookmark className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* SE FOR GUIA CONTRAN DEDICADO: RENDERIZA A PÁGINA INTERATIVA DEDICADA */}
        {isContranGuide ? (
          <ContranGuideDedicatedView onCopyLink={handleCopyLink} copied={copied} />
        ) : currentArticle ? (
          <>
            {/* HERO HEADER - Estilo Editorial Alzta / TuaVia */}
            <header className="bg-surface border-2 border-ink rounded-3xl p-6 sm:p-10 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-6 relative overflow-hidden">
              <div className="flex flex-wrap items-center gap-2.5">
                <CategorySignBadge category={currentArticle.category} size="md" />

                <span className="text-xs font-mono font-bold bg-accent-charge text-ink border border-ink px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-ink shrink-0" />
                  <span>Auditado por Equipe Técnica TuaVia</span>
                </span>

                <div className="flex items-center gap-3 text-xs font-mono text-ink/70 ml-auto">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{formattedDate}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-accent-gold shrink-0" />
                    <span>{currentArticle.readingTimeMinutes} min de leitura</span>
                  </span>
                </div>
              </div>

              <h1 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-ink leading-[1.15] tracking-tight">
                {currentArticle.title}
              </h1>

              <p className="text-sm sm:text-lg text-ink/85 font-sans leading-relaxed border-l-4 border-primary pl-4 py-1.5 bg-primary/5 rounded-r-2xl font-medium">
                {currentArticle.excerpt}
              </p>

              {/* Selo Editorial / Metadados do Autor */}
              <div className="flex items-center justify-between border-t border-dashed border-ink/30 pt-4 mt-2 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary text-white border-2 border-ink flex items-center justify-center font-black font-display text-sm shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
                    TV
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-ink text-sm">Equipe Editorial TuaVia</span>
                    <span className="text-ink/60 text-[11px]">Análise técnica independente de e-bikes</span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShareTwitter}
                    className="p-2 bg-white border border-ink rounded-xl hover:bg-neutral-100 transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer"
                    title="Compartilhar no X/Twitter"
                  >
                    <Share2 className="w-4 h-4 text-primary" />
                  </button>
                </div>
              </div>
            </header>

            {/* HERO COVER IMAGE */}
            <div className="relative w-full h-64 sm:h-[420px] rounded-3xl overflow-hidden border-2 border-ink shadow-[4px_4px_0_0_rgba(46,43,39,1)] bg-neutral-200">
              <SafeImage
                src={currentArticle.coverImage}
                alt={currentArticle.title}
                variant="article"
                priority
                fallbackSrc="/images/articles/resolucao-contran-996-2023-bicicleta-eletrica-regras.webp"
                className="object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-surface/90 backdrop-blur-sm border border-ink px-3 py-1 rounded-xl text-[10px] font-mono font-bold text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                Foto e Dados Auditados TuaVia
              </div>
            </div>
          </>
        ) : null}

        {/* ESTRUTURA EDITORIAL EM 2 COLUNAS (Conteúdo Principal + Sidebar Técnica) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* COLUNA PRINCIPAL (8/12 - 68%) */}
          <main className="lg:col-span-8 flex flex-col gap-8">
            
            {/* BOX DE DESTAQUES RÁPIDOS (KEY TAKEAWAYS) */}
            <div className="bg-surface border-2 border-ink rounded-3xl p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b-2 border-ink pb-2">
                <Sparkles className="w-5 h-5 text-accent-gold shrink-0 fill-accent-gold/20" />
                <h3 className="font-display font-bold text-lg text-ink">
                  Em Síntese: Destaques do Guia
                </h3>
              </div>

              <ul className="grid grid-cols-1 gap-2.5 text-xs sm:text-sm font-sans text-ink/85 mt-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Autonomia Real:</strong> Desconto de 25% a 35% em relação às especificações teóricas de fábrica.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Motorização Ideal:</strong> Motores de 250W a 350W atendem trajetos urbanos; aclives acentuados exigem motores centrais ou 500W.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Regulamentação:</strong> Limite de 1000W e 32 km/h assistidos isenta de CNH e emplacamento no Brasil.</span>
                </li>
              </ul>
            </div>

            {/* ÍNDICE DE CONTEÚDO (TOC) INTERATIVO */}
            {headings.length > 0 && (
              <div className="bg-neutral-50 border-2 border-ink rounded-3xl p-6 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-ink">
                      Índice do Artigo
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-ink/60">{headings.length} tópicos</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs sm:text-sm font-sans pt-1">
                  {headings.map((h, idx) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="text-ink/80 hover:text-primary font-medium hover:underline flex items-center gap-2 py-1 transition-colors"
                    >
                      <span className="font-mono text-xs font-bold text-primary w-5 text-right">{idx + 1}.</span>
                      <span>{h.text}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* CORPO DO ARTIGO RENDERIZADO EM MARKDOWN */}
            <article className="bg-white border-2 border-ink rounded-3xl p-6 sm:p-10 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-6 text-ink font-sans">
              <div className="prose prose-neutral max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:text-ink prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:border-b-2 prose-h2:border-ink prose-h2:pb-2 prose-h2:mt-8 prose-h2:mb-4 prose-p:text-sm sm:prose-p:text-base prose-p:leading-relaxed prose-p:text-ink/85 prose-li:text-sm sm:prose-li:text-base prose-strong:text-ink prose-a:text-primary prose-a:font-bold prose-a:underline hover:prose-a:text-primary-dark">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '-');
                      return (
                        <h2 id={id} className="scroll-mt-20 font-display font-bold text-xl sm:text-2xl text-ink border-b-2 border-ink pb-2 mt-8 mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-primary shrink-0" />
                          <span>{children}</span>
                        </h2>
                      );
                    },
                    img: ({ src, alt }) => (
                      <figure className="my-6 rounded-2xl overflow-hidden border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] bg-neutral-100">
                        <div 
                          className="relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-[420px] cursor-zoom-in"
                          onClick={() => src && setActiveGalleryModalImage(String(src))}
                        >
                          <SafeImage
                            src={typeof src === 'string' ? src : undefined}
                            alt={alt || 'Imagem do Artigo TuaVia'}
                            variant="article"
                            className="object-cover"
                            fallbackSrc="/images/articles/resolucao-contran-996-2023-bicicleta-eletrica-regras.webp"
                          />
                        </div>
                        {alt && (
                          <figcaption className="p-2.5 bg-surface text-ink/75 text-[11px] font-mono border-t border-ink flex items-center justify-between">
                            <span>{alt}</span>
                            <span className="text-[10px] text-primary font-bold">Foto e Dados Auditados</span>
                          </figcaption>
                        )}
                      </figure>
                    ),
                    ul: ({ children }) => (
                      <ul className="flex flex-col gap-2 my-4 pl-0 list-none">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-xs sm:text-sm text-ink/85 bg-neutral-50 p-3 rounded-xl border border-line">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>{children}</div>
                      </li>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-display font-bold text-base sm:text-lg text-ink mt-6 mb-3 flex items-center gap-2 border-l-3 border-primary pl-3 bg-neutral-50/80 py-1 rounded-r-xl">
                        <span>{children}</span>
                      </h3>
                    ),
                    hr: () => (
                      <div className="my-8 flex items-center gap-4">
                        <div className="h-[2px] bg-ink/20 flex-1" />
                        <span className="p-1.5 bg-surface border border-ink/30 rounded-full text-ink/70 text-[10px] font-mono font-bold uppercase tracking-widest px-3 shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                          TuaVia • Seção
                        </span>
                        <div className="h-[2px] bg-ink/20 flex-1" />
                      </div>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-6 border-2 border-ink rounded-2xl shadow-[3px_3px_0_0_rgba(46,43,39,1)] bg-white">
                        <table className="w-full text-left text-xs text-ink border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-ink text-amber-300 font-mono font-bold uppercase text-[11px]">{children}</thead>,
                    th: ({ children }) => <th className="p-3 border-b border-ink/40">{children}</th>,
                    td: ({ children }) => <td className="p-3 border-b border-neutral-200 bg-neutral-50/50">{children}</td>,
                    p: ({ children }) => (
                      <p className="text-sm sm:text-base leading-relaxed text-ink/85 my-4">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => {
                      const str = typeof children === 'string' 
                        ? children 
                        : (Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '');
                      const isQuestion = str.trim().endsWith('?');
                      if (isQuestion) {
                        return (
                          <strong className="block font-display font-bold text-base sm:text-lg text-ink mt-7 mb-2.5 leading-snug">
                            {children}
                          </strong>
                        );
                      }
                      return <strong className="font-bold text-ink">{children}</strong>;
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="bg-amber-50/80 border-l-4 border-accent-gold border-y border-r border-ink/15 p-5 sm:p-6 rounded-r-2xl my-7 not-italic text-ink text-xs sm:text-sm shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
                        <div className="flex items-center gap-2 font-mono font-bold uppercase text-[11px] text-amber-900 mb-2 tracking-wider">
                          <Sparkles className="w-4 h-4 text-accent-gold shrink-0 fill-accent-gold/20" />
                          <span>Nota TuaVia</span>
                        </div>
                        <div className="text-ink/90 font-sans leading-relaxed">
                          {children}
                        </div>
                      </blockquote>
                    ),
                    a: ({ href, children }) => {
                      const isInternal = href && (href.startsWith('/') || href.startsWith('#') || href.includes('tuavia.com.br'));
                      const cleanHref = href?.replace(/^https?:\/\/(www\.)?tuavia\.com\.br/, '') || '#';
                      if (isInternal) {
                        return (
                          <Link href={cleanHref} className="text-primary font-bold underline hover:text-primary-dark transition-colors inline-flex items-center gap-0.5 cursor-pointer">
                            <span>{children}</span>
                          </Link>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary font-bold underline hover:text-primary-dark transition-colors inline-flex items-center gap-0.5 cursor-pointer">
                          <span>{children}</span>
                          <ExternalLink className="w-3.5 h-3.5 inline shrink-0" />
                        </a>
                      );
                    }
                  }}
                >
                  {formatMarkdownForDisplay(currentArticle?.body || '')}
                </ReactMarkdown>

                <AdSenseBanner
                  slotId={getAdSenseSlot('ARTICLE_END')}
                  slotName="ARTIGO_FIM"
                  format="horizontal"
                  minHeight={90}
                />
              </div>
            </article>

            {/* GALERIA TÉCNICA / FOTOS COMPLEMENTARES DO ARTIGO */}
            {(() => {
              const gallery = (currentArticle?.galleryImages || []).filter(Boolean);
              if (gallery.length === 0) return null;
              return (
                <section className="bg-surface border-2 border-ink rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b-2 border-ink pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/30">
                        <Images className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg sm:text-xl text-ink">
                          Galeria Técnica & Imagens Complementares
                        </h3>
                        <p className="text-xs text-ink/65 font-mono">
                          Fotos oficiais e detalhes adicionais deste guia
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white border border-ink px-2.5 py-1 rounded-xl text-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                      {gallery.length} {gallery.length === 1 ? 'Foto' : 'Fotos'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gallery.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveGalleryModalImage(imgUrl)}
                        className="group relative aspect-[16/10] rounded-2xl overflow-hidden border-2 border-ink bg-neutral-100 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:shadow-[4px_4px_0_0_rgba(46,43,39,1)] transition-all cursor-zoom-in"
                      >
                        <SafeImage
                          src={imgUrl}
                          alt={`Foto complementar ${idx + 1} do artigo ${currentArticle?.title || ''}`}
                          variant="compact"
                          fallbackSrc="/images/articles/resolucao-contran-996-2023-bicicleta-eletrica-regras.webp"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3 justify-between text-white font-mono text-xs">
                          <span className="font-bold flex items-center gap-1">
                            <Maximize2 className="w-3.5 h-3.5" /> Ampliar Foto {idx + 1}
                          </span>
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded backdrop-blur-sm">TuaVia</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* CHAMADA PARA AÇÃO (CTA) DE PRÓXIMO PASSO NO TUAVIA */}
            <div className="bg-primary text-white border-2 border-ink rounded-3xl p-7 sm:p-10 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col md:flex-row items-center justify-between gap-8 my-10 sm:my-12">
              <div className="flex flex-col gap-4 text-center md:text-left flex-1">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold bg-white text-ink border border-ink px-3 py-1 rounded-xl uppercase tracking-wider shadow-[1px_1px_0_0_rgba(46,43,39,1)]">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Catálogo Auditado</span>
                  </span>
                </div>
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-white leading-snug">
                  Pronto para comparar e-bikes reais com estas recomendações?
                </h3>
                <p className="text-sm sm:text-base text-white/95 leading-relaxed font-normal max-w-2xl">
                  Filtre por autonomia real, tipo de motor e faixa de preço no nosso comparador sem anúncios ou viés comercial.
                </p>
              </div>

              <Link
                href={`/ebike?uso=${encodeURIComponent(primaryCategory)}`}
                className="w-full sm:w-auto bg-white text-ink hover:bg-neutral-100 font-mono font-bold text-xs sm:text-sm py-4 px-7 rounded-2xl border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-2.5 shrink-0 cursor-pointer min-h-[48px] whitespace-nowrap"
              >
                <span>Ver Modelos {primaryCategory}</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </Link>
            </div>

            {/* BOX DE TRANSPARÊNCIA E ISENÇÃO PATROCINADA */}
            <div className="bg-surface border-2 border-ink rounded-3xl p-6 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-3 text-xs text-ink/75 font-sans">
              <div className="flex items-center gap-2 font-mono font-bold text-ink uppercase">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Compromisso Editorial TuaVia</span>
              </div>
              <p className="leading-relaxed">
                Nossas análises e guias de compra são desenvolvidos de forma totalmente independente por especialistas em mobilidade elétrica. Não aceitamos pagamentos de marcas para alterar classificações ou ocultar limitações técnicas. Todos os dados são auditados diretamente com os distribuidores oficiais no Brasil.
              </p>
            </div>

            {/* NAVEGAÇÃO DE ARTIGOS ANTERIOR / PRÓXIMO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t-2 border-ink pt-6">
              {prevArticle ? (
                <Link
                  href={`/artigos/${prevArticle.slug}`}
                  className="bg-surface border-2 border-ink rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:border-primary transition-all flex flex-col gap-1 group"
                >
                  <span className="text-[10px] font-mono font-bold text-ink/60 uppercase flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3 text-primary group-hover:-translate-x-1 transition-transform" />
                    <span>Artigo Anterior</span>
                  </span>
                  <span className="font-display font-bold text-sm text-ink group-hover:text-primary line-clamp-2">
                    {prevArticle.title}
                  </span>
                </Link>
              ) : <div />}

              {nextArticle ? (
                <Link
                  href={`/artigos/${nextArticle.slug}`}
                  className="bg-surface border-2 border-ink rounded-2xl p-4 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:border-primary transition-all flex flex-col gap-1 text-right group ml-auto w-full"
                >
                  <span className="text-[10px] font-mono font-bold text-ink/60 uppercase flex items-center justify-end gap-1">
                    <span>Próximo Artigo</span>
                    <ArrowRight className="w-3 h-3 text-primary group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="font-display font-bold text-sm text-ink group-hover:text-primary line-clamp-2">
                    {nextArticle.title}
                  </span>
                </Link>
              ) : <div />}
            </div>

            {/*
              Segundo anúncio: fica entre a galeria e a navegação
              anterior/próximo. Os dois pontos do artigo estão longe do topo e
              cercados de conteúdo, que é o que a política do AdSense pede.
            */}
            <AdSenseBanner
              slotId={getAdSenseSlot('ARTICLE_MIDDLE')}
              slotName="ARTIGO_MEIO"
              format="fluid"
              minHeight={120}
            />

          </main>

          {/* SIDEBAR TÉCNICA (4/12 - 32%) */}
          <aside className="lg:col-span-4 flex flex-col gap-6 sticky top-8">
            
            {/* CARD DE FICHA DO GUIA */}
            <div className="bg-surface border-2 border-ink rounded-3xl p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b-2 border-ink pb-2">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <h4 className="font-display font-bold text-base text-ink">Ficha do Guia</h4>
              </div>

              <div className="flex flex-col gap-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-dashed border-ink/20">
                  <span className="text-ink/60">Categoria:</span>
                  <span className="font-bold text-ink bg-bg-base px-2 py-0.5 rounded border border-ink">{currentArticle?.category || 'Geral'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-ink/20">
                  <span className="text-ink/60">Tempo de Leitura:</span>
                  <span className="font-bold text-ink">{currentArticle?.readingTimeMinutes || 5} min</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-ink/20">
                  <span className="text-ink/60">Publicação:</span>
                  <span className="font-bold text-ink">{formattedDate}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-dashed border-ink/20">
                  <span className="text-ink/60">Revisão Técnica:</span>
                  <span className="font-bold text-primary">Agosto / 2026</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-ink/60">Publico Alvo:</span>
                  <span className="font-bold text-ink">Iniciante a Intermediário</span>
                </div>
              </div>
            </div>

            {/* CARD DE BIKES RECOMENDADAS PARA ESTE GUIA - Somente no Desktop (no mobile já aparece no carrossel inferior dedicado) */}
            {relatedBikes.length > 0 && (
              <div className="hidden lg:flex bg-surface border-2 border-ink rounded-3xl p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex-col gap-4">
                <div className="flex items-center justify-between border-b-2 border-ink pb-2">
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-primary shrink-0" />
                    <h4 className="font-display font-bold text-base text-ink">Destaques do Catálogo</h4>
                  </div>
                  <span className="text-[10px] font-mono bg-accent-charge border border-ink px-2 py-0.5 rounded font-bold">
                    {primaryCategory}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {relatedBikes.slice(0, 3).map((bike) => (
                    <Link
                      key={bike.slug}
                      href={`/bike/${bike.slug}`}
                      className="group bg-white border-2 border-ink rounded-2xl p-3 shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:border-primary transition-all flex items-center gap-3"
                    >
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 border border-ink shrink-0 p-1">
                        <SafeImage
                          src={bike.imagemUrl || 'https://picsum.photos/seed/ebike/200/200'}
                          alt={bike.modelo}
                          variant="thumb"
                          className="object-contain p-1 group-hover:scale-105 transition-transform"
                        />
                      </div>

                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-ink/60 font-bold uppercase truncate">{bike.marca}</span>
                        <h5 className="font-display font-bold text-xs text-ink group-hover:text-primary transition-colors truncate">
                          {bike.modelo}
                        </h5>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono font-bold text-primary">
                          <span>A partir de R$ {bike.menorPreco.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <Link
                  href={`/ebike?uso=${encodeURIComponent(primaryCategory)}`}
                  className="bg-bg-base hover:bg-neutral-100 text-ink font-mono font-bold text-xs py-2.5 px-3 rounded-xl border border-ink text-center flex items-center justify-center gap-1.5 transition-all mt-1 shadow-xs hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)]"
                >
                  <span>Ver todas em {primaryCategory}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-primary" />
                </Link>
              </div>
            )}

            {/* CARD DE NEWSLETTER / GUIAS DE COMPRA */}
            <div className="bg-accent-gold/15 border-2 border-ink rounded-3xl p-5 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-accent-gold shrink-0" />
                <h4 className="font-display font-bold text-base text-ink">Alertas de Mobilidade</h4>
              </div>

              <p className="text-xs text-ink/80 leading-relaxed font-sans">
                Receba novos guias técnicos, comparativos de e-bikes e alertas de queda de preço diretamente no seu e-mail.
              </p>

              {newsletterSubscribed ? (
                <div className="bg-green-100 border border-green-500 text-green-800 p-3 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Inscrição confirmada com sucesso!</span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-2 mt-1">
                  <input
                    type="email"
                    required
                    placeholder="Seu melhor e-mail..."
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="w-full bg-white border-2 border-ink rounded-xl px-3 py-2 text-xs font-mono text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary shadow-[1px_1px_0_0_rgba(46,43,39,1)]"
                  />
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs py-2.5 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all cursor-pointer min-h-[38px]"
                  >
                    Quero Receber Guias
                  </button>
                </form>
              )}
            </div>

          </aside>

        </div>

        {/* SEÇÃO INFERIOR: MODELOS RECOMENDADOS EM GRID COMPLETO */}
        {relatedBikes.length > 0 && (
          <section className="mt-6">
            <ArticleRelatedBikes
              relatedBikes={relatedBikes}
              categoryName={primaryCategory}
            />
          </section>
        )}

        {/* OUTROS ARTIGOS RECOMENDADOS */}
        {otherArticles.length > 0 && (
          <section className="flex flex-col gap-4 sm:gap-6 pt-4">
            <div className="bg-surface border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-ink flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                </div>
                <div>
                  <h2 className="font-display font-black text-lg sm:text-xl text-ink leading-tight">
                    Outros Guias Recomendados
                  </h2>
                  <p className="text-[11px] sm:text-xs font-sans text-ink/65 hidden sm:block">
                    Leituras aprofundadas sobre mobilidade elétrica, normas e mercado.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                <span className="sm:hidden text-[11px] font-mono font-bold text-ink/60 flex items-center gap-1">
                  <span>Deslize para ver mais</span>
                  <ArrowRight className="w-3 h-3 text-primary animate-pulse" />
                </span>

                <Link
                  href="/artigos"
                  className="text-xs font-mono font-bold text-ink bg-white border border-ink px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-all flex items-center gap-1 shrink-0 shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]"
                >
                  <span>Ver hub completo</span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </Link>
              </div>
            </div>

            {/* Carrossel no Mobile / Grid a partir de Tablet */}
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-3 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 no-scrollbar">
              {otherArticles.map((art) => (
                <div key={art.slug} className="w-[82vw] xs:w-[310px] sm:w-auto shrink-0 snap-start h-full">
                  <ArticleCard article={art} compact />
                </div>
              ))}
            </div>
          </section>
        )}

        </div>
      </main>

      {/* Rodapé Padrão TuaVia */}
      <Footer />

      {/* MODAL DE ZOOM DE IMAGEM DA GALERIA DO ARTIGO */}
      {activeGalleryModalImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setActiveGalleryModalImage(null)}
        >
          <div className="relative w-full max-w-5xl h-[80vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setActiveGalleryModalImage(null)}
              className="absolute top-0 right-0 z-10 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full border border-white/30 backdrop-blur-md transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full h-full">
              <SafeImage
                src={activeGalleryModalImage}
                alt="Imagem Ampliada TuaVia"
                width={1200}
                height={800}
                className="object-contain p-4"
              />
            </div>
            <div className="text-white text-xs font-mono font-bold mt-4 bg-ink/60 px-4 py-2 rounded-full border border-white/20">
              {currentArticle?.title || 'TuaVia'} • TuaVia
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
