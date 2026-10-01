'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  BookOpen, 
  ShieldCheck, 
  Flame, 
  Scale, 
  Wrench, 
  Compass, 
  Layers, 
  RotateCcw,
  FileText,
  Sparkles,
  DollarSign,
  Cpu,
  Trophy,
  Tag as TagIcon
} from 'lucide-react';
import { getStaticArticles, fetchArticlesFromFirestore, getAllArticleTags, isArticleFreshUnder6Hours } from '@/lib/articles';
import { Article } from '@/types/article';
import { TopRanking } from '@/types/ranking';
import ArticleCard from '@/components/ArticleCard';
import AlztaTopicSection from './AlztaTopicSection';
import TopRankingsThemeSection from './TopRankingsThemeSection';

interface ArticlesCatalogProps {
  initialArticles?: Article[];
  initialRankings?: TopRanking[];
}

export default function ArticlesCatalog({ initialArticles = [], initialRankings = [] }: ArticlesCatalogProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryFromUrl = searchParams?.get('q') || '';
  const topicFromUrl = searchParams?.get('topico') || '';

  const [allArticles, setAllArticles] = useState<Article[]>(() => {
    if (initialArticles && initialArticles.length > 0) return initialArticles;
    return getStaticArticles();
  });

  const [allRankings, setAllRankings] = useState<TopRanking[]>(() => {
    if (initialRankings && initialRankings.length > 0) return initialRankings;
    return [];
  });

  const [selectedTopic, setSelectedTopic] = useState<string>(() => {
    if (topicFromUrl === 'Rankings' || topicFromUrl === 'rankings') return 'Rankings';
    return 'Todos';
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(queryFromUrl);

  // Sincroniza query com a URL quando muda
  useEffect(() => {
    setSearchQuery(queryFromUrl);
  }, [queryFromUrl]);

  useEffect(() => {
    if (topicFromUrl === 'Rankings' || topicFromUrl === 'rankings') {
      setSelectedTopic('Rankings');
    }
  }, [topicFromUrl]);

  const loadLiveArticles = async () => {
    try {
      const res = await fetchArticlesFromFirestore();
      if (res && res.length > 0) {
        setAllArticles(res);
      }
    } catch (err) {
      console.warn('[ArticlesCatalog] Falha ao recarregar artigos:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Sincroniza artigos atualizados da API no cliente
    fetchArticlesFromFirestore().then((res) => {
      if (isMounted && Array.isArray(res) && res.length > 0) {
        setAllArticles(res);
      }
    });

    // Sincroniza rankings atualizados da API no cliente
    fetch('/api/rankings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.success && Array.isArray(data.rankings)) {
          setAllRankings(data.rankings.filter((r: TopRanking) => r && r.publicado !== false));
        }
      })
      .catch((err) => console.warn('[ArticlesCatalog] Falha ao buscar rankings live:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Tópicos disponíveis para navegação
  const topics = [
    { id: 'Todos', label: 'Todos os Artigos', icon: Layers },
    { id: 'Rankings', label: 'Top Rankings (3, 5, 7, 10)', icon: Trophy },
    { id: 'Ultimas', label: 'Últimas Publicações', icon: Flame },
    { id: 'Legislação', label: 'Legislação & CONTRAN', icon: Scale },
    { id: 'Guia de Compra', label: 'Guias de Compra', icon: Compass },
    { id: 'Manutenção', label: 'Manutenção & Bateria', icon: Wrench },
    { id: 'Comparativo', label: 'Comparativos Técnicos', icon: Layers },
    { id: 'Notícias', label: 'Notícias & Mercado', icon: Sparkles },
    { id: 'Economia & Mobilidade', label: 'Economia & Mobilidade', icon: DollarSign },
    { id: 'Tecnologia & Baterias', label: 'Tecnologia & Baterias', icon: Cpu },
  ];

  // Considera apenas os artigos elegíveis para feeds/catálogos públicos
  const feedArticles = useMemo(() => {
    return allArticles.filter((art) => !art.hideFromFeed);
  }, [allArticles]);

  // Extrai todas as tags presentes nos artigos públicos
  const availableTags = useMemo(() => {
    return getAllArticleTags(feedArticles);
  }, [feedArticles]);

  // Filtro dinâmico quando o usuário digita na busca ou clica em uma tag específica
  const filteredArticles = useMemo(() => {
    return feedArticles.filter((art) => {
      let matchesTopic = true;
      if (selectedTopic === 'Rankings') {
        matchesTopic = false; // Rankings são renderizados na sua própria seção
      } else if (selectedTopic === 'Ultimas') {
        const latestSlugs = feedArticles.slice(0, 4).map((a) => a.slug);
        matchesTopic = latestSlugs.includes(art.slug);
      } else if (selectedTopic !== 'Todos') {
        // Artigo publicado há menos de 6h só aparece em "Últimas Publicações" ou "Todos"
        if (isArticleFreshUnder6Hours(art.publishedAt)) {
          matchesTopic = false;
        } else {
          matchesTopic = art.category === selectedTopic;
        }
      }

      let matchesTag = true;
      if (selectedTag) {
        matchesTag = Boolean(
          art.category.toLowerCase() === selectedTag.toLowerCase() ||
          (Array.isArray(art.tags) && art.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()))
        );
      }

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        art.title.toLowerCase().includes(query) ||
        art.excerpt.toLowerCase().includes(query) ||
        art.category.toLowerCase().includes(query) ||
        (Array.isArray(art.tags) && art.tags.some((t) => t.toLowerCase() === query)) ||
        (art.body && art.body.toLowerCase().includes(query));

      return matchesTopic && matchesTag && matchesSearch;
    });
  }, [feedArticles, selectedTopic, selectedTag, searchQuery]);

  // Separação estrita dos artigos por categoria para as grades Alzta (sem sobreposição)
  // Artigos em "Últimas Publicações" exibem todos os mais recentes (incluindo < 6h)
  const latestArticles = useMemo(() => feedArticles.slice(0, 8), [feedArticles]);

  // Artigos elegíveis para tópicos específicos (exclui matérias publicadas há menos de 6 horas)
  const topicEligibleArticles = useMemo(() => {
    return feedArticles.filter((a) => !isArticleFreshUnder6Hours(a.publishedAt));
  }, [feedArticles]);

  const legislacaoArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Legislação'), [topicEligibleArticles]);
  const guiasArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Guia de Compra'), [topicEligibleArticles]);
  const manutencaoArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Manutenção'), [topicEligibleArticles]);
  const comparativoArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Comparativo'), [topicEligibleArticles]);
  const noticiasArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Notícias'), [topicEligibleArticles]);
  const economiaArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Economia & Mobilidade'), [topicEligibleArticles]);
  const tecnologiaArticles = useMemo(() => topicEligibleArticles.filter((a) => a.category === 'Tecnologia & Baterias'), [topicEligibleArticles]);

  const isFiltering = searchQuery.trim() !== '' || selectedTopic !== 'Todos' || selectedTag !== null;

  return (
    <div className="w-full min-h-screen py-4 sm:py-8 md:py-10 px-3 sm:px-6 md:px-8 text-ink" id="articles-catalog-root">
      <div className="max-w-7xl mx-auto flex flex-col gap-8 sm:gap-12">
        
        {/* ── CABEÇALHO EDITORIAL MODELO ALZTA COM ÍCONES E DIMENSÕES ROBUSTAS ── */}
        <header className="bg-surface border-2 border-ink rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 shadow-[3px_3px_0_0_rgba(46,43,39,1)] sm:shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
          {/* Faixa decorativa ciclovia no topo */}
          <div className="absolute top-0 left-0 right-0 h-1.5 sm:h-2 bg-gradient-to-r from-primary via-accent-gold to-accent-charge" />

          <div className="flex flex-col gap-2.5 sm:gap-3.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs font-mono font-bold bg-accent-gold text-ink border border-ink px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-ink shrink-0" />
                <span>Central de Artigos, Dossiês &amp; Rankings</span>
              </span>

              <span className="text-[10px] sm:text-xs font-mono font-bold bg-accent-charge text-ink border border-ink px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl uppercase tracking-wider hidden xs:flex items-center gap-1 shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-ink shrink-0" />
                <span>Curadoria 100% Isenta</span>
              </span>

              <span className="text-[10px] sm:text-xs font-mono font-bold bg-white text-ink/70 border border-ink px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] shrink-0">
                {allArticles.length} Dossiês Técnicos
              </span>

              {allRankings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTopic('Rankings')}
                  className="text-[10px] sm:text-xs font-mono font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-800" />
                  <span>{allRankings.length} Top Rankings</span>
                </button>
              )}
            </div>

            <h1 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-ink tracking-tight leading-tight">
              Artigos, Dossiês e Top Rankings
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-ink/80 font-sans leading-relaxed max-w-3xl">
              Navegue pelos tópicos especializados no padrão editorial TuaVia: análises completas, pódios comparativos (Top 3, Top 5, Top 7 e Top 10) e carrosséis de matérias técnicas.
            </p>
          </div>

          {/* FILTROS POR TÓPICO E TAGS */}
          <div className="flex flex-col gap-3.5 pt-3.5 border-t-2 border-dashed border-ink/20">
            
            {/* BARRA DE PESQUISA EXCLUSIVA MOBILE - STICKY AO ROLAR */}
            <div className="block md:hidden sticky top-2 z-30 bg-surface/95 backdrop-blur-md border-2 border-ink rounded-2xl p-2.5 sm:p-3 shadow-[4px_4px_0_0_rgba(46,43,39,1)] transition-all">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    router.push(`/artigos?q=${encodeURIComponent(searchQuery.trim())}`);
                  } else {
                    router.push('/artigos');
                  }
                }}
                className="relative flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar artigo, ranking ou guia..."
                    className="w-full bg-white border-2 border-ink rounded-xl pl-10 pr-9 py-2 text-xs font-mono font-bold text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    aria-label="Buscar artigo ou ranking"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        router.push('/artigos');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/60 hover:text-ink cursor-pointer"
                      aria-label="Limpar busca de artigos"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="bg-primary text-white font-mono font-bold text-xs px-3.5 py-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all shrink-0 cursor-pointer min-h-[38px]"
                >
                  Buscar
                </button>
              </form>
            </div>

            {/* Aviso de busca ativa via Sidebar ou formulário */}
            {searchQuery && (
              <div className="flex items-center justify-between bg-accent-gold/20 border border-accent-gold-dark rounded-xl px-3.5 py-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-ink">
                  <Search className="w-3.5 h-3.5 text-ink/70" />
                  <span>Resultados para o termo: <span className="bg-white px-2 py-0.5 rounded border border-ink/40">&ldquo;{searchQuery}&rdquo;</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    router.push('/artigos');
                  }}
                  className="text-[11px] font-mono font-bold text-ink/70 hover:text-ink underline flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar filtro</span>
                </button>
              </div>
            )}

            {/* Selector de Tópicos Rápido com Destaque para Rankings */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none w-full">
              <span className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-ink/60 tracking-wider shrink-0 mr-1">
                Tópicos:
              </span>
              {topics.map((t) => {
                const isActive = selectedTopic === t.id && !selectedTag;
                const isRanking = t.id === 'Rankings';
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTopic(t.id);
                      setSelectedTag(null);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wide border-2 transition-all cursor-pointer whitespace-nowrap shrink-0 min-h-[34px] sm:min-h-[36px] ${
                      isActive
                        ? 'bg-ink text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                        : isRanking
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-500 shadow-sm'
                        : 'bg-white text-ink border-ink/70 hover:border-ink hover:bg-neutral-50 shadow-sm'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? (isRanking ? 'text-accent-gold' : 'text-accent-charge') : (isRanking ? 'text-amber-800' : 'text-primary')}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Nuvem de Tags Especializadas */}
            {availableTags.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none w-full pt-1 border-t border-ink/10">
                <span className="font-mono text-[9px] sm:text-[10px] font-black uppercase text-ink/60 tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <TagIcon className="w-3 h-3 text-primary" />
                  <span>Tags:</span>
                </span>
                {availableTags.map(({ tag, count }) => {
                  const isTagActive = selectedTag === tag;
                  const isLegis = ['Legislação', 'CONTRAN 996', 'Regras de Trânsito', 'Normas'].includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isTagActive) {
                          setSelectedTag(null);
                        } else {
                          setSelectedTag(tag);
                          setSelectedTopic('Todos');
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isTagActive
                          ? 'bg-primary text-white border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] scale-105'
                          : isLegis
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-ink hover:bg-emerald-100'
                          : 'bg-neutral-100 text-ink/80 border-ink/30 hover:border-ink hover:bg-white'
                      }`}
                    >
                      <span>#{tag}</span>
                      <span className={`text-[8.5px] px-1 py-0.2 rounded font-mono ${isTagActive ? 'bg-white/20 text-white' : 'bg-ink/10 text-ink/70'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* ── MODO 1: VISUALIZAÇÃO DEDICADA DO TEMA DE RANKINGS (TOP 3, TOP 5, TOP 7, TOP 10) ── */}
        {selectedTopic === 'Rankings' ? (
          <section className="flex flex-col gap-6">
            <div className="bg-surface border-2 border-ink rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Trophy className="w-5 h-5 text-accent-gold-dark shrink-0" />
                <h2 className="font-display font-black text-lg sm:text-xl text-ink">
                  Tema: Top Rankings &amp; Pódios de Avaliação
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTopic('Todos')}
                  className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Voltar a Todos os Artigos</span>
                </button>
              </div>
            </div>

            <TopRankingsThemeSection
              rankings={allRankings}
              isStandaloneTopic={true}
              title="Central de Top Rankings & Guias de Escolha"
              subtitle="Pódios auditados de 3, 5, 7 ou 10 modelos para facilitar a sua decisão com dados de autonomia, bateria e melhor preço verificado."
            />
          </section>
        ) : allArticles.length === 0 ? (
          <div className="bg-white border-2 border-ink rounded-3xl p-8 sm:p-12 text-center shadow-[4px_4px_0_0_rgba(46,43,39,1)] space-y-5 my-4">
            <BookOpen className="w-12 h-12 text-primary mx-auto" />
            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-xl font-black text-ink">Nenhum dossiê disponível no momento</h2>
              <p className="text-xs sm:text-sm text-ink/70 font-sans leading-relaxed">
                Nossa equipe editorial está atualizando as análises e matérias técnicas. Você pode recarregar ou navegar pelo nosso catálogo e comparador.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={loadLiveArticles}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-ink font-black rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all text-xs cursor-pointer"
              >
                Recarregar Dossiês
              </button>
              <Link
                href="/#catalogo"
                className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-ink font-black rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all text-xs"
              >
                Ver Catálogo de E-Bikes
              </Link>
            </div>
          </div>
        ) : isFiltering ? (
          <section className="flex flex-col gap-6">
            <div className="bg-surface border-2 border-ink rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <h2 className="font-display font-black text-base sm:text-xl text-ink truncate">
                  {selectedTag ? (
                    <span>Filtrando por Tag: <strong className="text-primary">#{selectedTag}</strong></span>
                  ) : selectedTopic !== 'Todos' ? (
                    `Tópico: ${topics.find((t) => t.id === selectedTopic)?.label}`
                  ) : (
                    'Resultados da Busca'
                  )}
                  {searchQuery && <span className="text-primary font-normal"> &ldquo;{searchQuery}&rdquo;</span>}
                </h2>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] sm:text-xs font-mono font-bold text-ink/70 bg-white border border-ink px-2.5 sm:px-3 py-1 rounded-lg">
                  {filteredArticles.length} matéria(s) encontrada(s)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic('Todos');
                    setSelectedTag(null);
                    setSearchQuery('');
                  }}
                  className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Limpar Filtros</span>
                </button>
              </div>
            </div>

            {filteredArticles.length > 0 ? (
              <AlztaTopicSection
                topicNumber="F"
                topicTitle={selectedTag ? `Matérias com a Tag #${selectedTag}` : selectedTopic !== 'Todos' ? topics.find((t) => t.id === selectedTopic)?.label || selectedTopic : 'Resultados Filtrados'}
                topicSubtitle="Seleção organizada na grade editorial: 1 Dossiê em Destaque (Grande), Destaques Secundários (Médios) e Galeria de Matérias (Pequenas)."
                categoryName={selectedTopic !== 'Todos' && selectedTopic !== 'Ultimas' ? selectedTopic : 'Filtro'}
                articles={filteredArticles}
                accentColor="primary"
              />
            ) : (
              <div className="bg-surface border-2 border-ink rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center flex flex-col items-center justify-center gap-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)]">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 border-2 border-ink flex items-center justify-center text-ink/60 shrink-0">
                  <Search className="w-6 h-6 shrink-0" />
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                  <h3 className="font-display font-black text-base sm:text-lg text-ink">Nenhum artigo encontrado</h3>
                  <p className="text-xs font-mono text-ink/70">
                    Não encontramos matérias com o filtro digitado. Tente termos como &ldquo;bateria&rdquo;, &ldquo;contran&rdquo;, &ldquo;economia&rdquo; ou &ldquo;motor&rdquo;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopic('Todos');
                    setSelectedTag(null);
                    setSearchQuery('');
                  }}
                  className="bg-primary text-white font-mono font-bold text-xs px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] cursor-pointer hover:bg-primary-dark transition-all mt-1 shrink-0 min-h-[40px]"
                >
                  Ver Todas as Matérias
                </button>
              </div>
            )}
          </section>
        ) : (
          /* ── MODO COMPLETO: GRADES ALZTA EM CADA TÓPICO + TEMA TOP RANKINGS (TOP 3, 5, 7, 10) ── */
          <div className="flex flex-col gap-12 sm:gap-16">
            
            {/* TÓPICO 1: 🕒 ÚLTIMAS PUBLICAÇÕES */}
            <AlztaTopicSection
              topicNumber="01"
              topicTitle="1. Últimas Publicações"
              topicSubtitle="As matérias, testes de laboratório e análises mais recentes do portal"
              categoryName="Todos"
              articles={latestArticles}
              onSelectTopic={() => setSelectedTopic('Ultimas')}
              accentColor="gold"
            />

            {/* TÓPICO 2: 🏆 TOP RANKINGS & PÓDIOS COMPARATIVOS (SEÇÃO COM CATEGORIAS TOP 3, TOP 5, TOP 7 E TOP 10) */}
            {allRankings.length > 0 && (
              <TopRankingsThemeSection
                rankings={allRankings}
                title="Top Rankings & Pódios de Avaliação"
                subtitle="Navegue pelas seleções de Top 3, Top 5, Top 7 e Top 10 modelos auditados pela equipe técnica do TuaVia."
                onViewAllRankings={() => setSelectedTopic('Rankings')}
              />
            )}

            {/* TÓPICO 3: ⚖️ LEGISLAÇÃO & CONTRAN */}
            {legislacaoArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="02"
                topicTitle="2. Legislação & Normas CONTRAN"
                topicSubtitle="Resolução 996, regras para ciclovias, habilitação CNH e itens obrigatórios"
                categoryName="Legislação"
                articles={legislacaoArticles}
                onSelectTopic={() => setSelectedTopic('Legislação')}
                accentColor="green"
              />
            )}

            {/* TÓPICO 4: 🛒 GUIAS DE COMPRA */}
            {guiasArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="03"
                topicTitle="3. Guias de Compra & Investimento"
                topicSubtitle="Como escolher seu modelo ideal, autonomia real, custo anual e economia"
                categoryName="Guia de Compra"
                articles={guiasArticles}
                onSelectTopic={() => setSelectedTopic('Guia de Compra')}
                accentColor="primary"
              />
            )}

            {/* TÓPICO 5: 💵 ECONOMIA & MOBILIDADE */}
            {economiaArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="04"
                topicTitle="4. Economia & Mobilidade Urbana"
                topicSubtitle="Calculadoras de payback, economia de combustível, simulação de IPVA e substituição do segundo carro"
                categoryName="Economia & Mobilidade"
                articles={economiaArticles}
                onSelectTopic={() => setSelectedTopic('Economia & Mobilidade')}
                accentColor="gold"
              />
            )}

            {/* TÓPICO 6: ⚡ TECNOLOGIA & BATERIAS */}
            {tecnologiaArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="05"
                topicTitle="5. Tecnologia, Motores & Baterias"
                topicSubtitle="Química LFP vs NMC, motores de 750W de alto torque e rastreamento anti-furto via app"
                categoryName="Tecnologia & Baterias"
                articles={tecnologiaArticles}
                onSelectTopic={() => setSelectedTopic('Tecnologia & Baterias')}
                accentColor="charge"
              />
            )}

            {/* TÓPICO 7: 🛠️ MANUTENÇÃO & BATERIA */}
            {manutencaoArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="06"
                topicTitle="6. Manutenção & Cuidados com Baterias"
                topicSubtitle="Preservação do pack de lítio, recargas seguras, freios e conservação do motor"
                categoryName="Manutenção"
                articles={manutencaoArticles}
                onSelectTopic={() => setSelectedTopic('Manutenção')}
                accentColor="charge"
              />
            )}

            {/* TÓPICO 8: ⚡ COMPARATIVOS TÉCNICOS */}
            {comparativoArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="07"
                topicTitle="7. Comparativos Técnicos & Arquitetura"
                topicSubtitle="Motor de cubo traseiro vs. central, sensores de rotação vs. torque dinâmico"
                categoryName="Comparativo"
                articles={comparativoArticles}
                onSelectTopic={() => setSelectedTopic('Comparativo')}
                accentColor="dark"
              />
            )}

            {/* TÓPICO 9: 📰 NOTÍCIAS & MERCADO */}
            {noticiasArticles.length > 0 && (
              <AlztaTopicSection
                topicNumber="08"
                topicTitle="8. Notícias & Tendências de Mercado"
                topicSubtitle="Lançamentos mundiais, evolução das e-bikes, dados do setor e infraestrutura urbana"
                categoryName="Notícias"
                articles={noticiasArticles}
                onSelectTopic={() => setSelectedTopic('Notícias')}
                accentColor="gold"
              />
            )}

          </div>
        )}

      </div>
    </div>
  );
}
