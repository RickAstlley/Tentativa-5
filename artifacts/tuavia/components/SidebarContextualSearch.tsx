'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X, Bike, FileText, Trophy, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

export type SearchScope = 'all' | 'articles' | 'ebikes' | 'rankings';

interface SearchResultItem {
  id: string;
  type: 'ebike' | 'article' | 'ranking';
  title: string;
  subtitle: string;
  url: string;
  imageUrl?: string;
  badge?: string;
  price?: number;
  highlight?: string;
}

interface UniversalSearchResults {
  ebikes: SearchResultItem[];
  articles: SearchResultItem[];
  rankings: SearchResultItem[];
  total: number;
}

export default function SidebarContextualSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  // Determinar o escopo ativo com base na rota atual
  const scopeInfo = useMemo<{
    scope: SearchScope;
    name: string;
    placeholder: string;
    badgeColor: string;
    badgeText: string;
    destinationBase: string;
  }>(() => {
    if (pathname.startsWith('/artigos')) {
      return {
        scope: 'articles',
        name: 'Artigos & Dossiês',
        placeholder: 'Buscar artigos e guias...',
        badgeColor: 'bg-accent-gold text-ink border-ink',
        badgeText: 'Artigos',
        destinationBase: '/artigos',
      };
    }
    if (pathname.startsWith('/rankings')) {
      return {
        scope: 'rankings',
        name: 'Top Rankings',
        placeholder: 'Buscar pódios e rankings...',
        badgeColor: 'bg-amber-300 text-ink border-ink',
        badgeText: 'Rankings',
        destinationBase: '/rankings',
      };
    }
    if (pathname.startsWith('/ebike') || pathname.startsWith('/pesquisa') || pathname.startsWith('/bike') || pathname.startsWith('/comparar')) {
      return {
        scope: 'ebikes',
        name: 'E-Bikes',
        placeholder: 'Buscar modelo, marca...',
        badgeColor: 'bg-emerald-200 text-emerald-950 border-emerald-900',
        badgeText: 'E-Bikes',
        destinationBase: '/ebike',
      };
    }
    // Caso padrão: Início ou páginas institucionais -> Busca Universal
    return {
      scope: 'all',
      name: 'Universal (Tudo)',
      placeholder: 'Buscar tudo: bikes, artigos...',
      badgeColor: 'bg-ink text-accent-gold border-ink',
      badgeText: 'Universal',
      destinationBase: '/ebike',
    };
  }, [pathname]);

  const currentQuery = searchParams?.get('q') || '';
  const [query, setQuery] = useState(currentQuery);
  const [prevQueryFromUrl, setPrevQueryFromUrl] = useState(currentQuery);

  // Sincroniza estado se a query da URL mudar externamente
  if (currentQuery !== prevQueryFromUrl) {
    setPrevQueryFromUrl(currentQuery);
    setQuery(currentQuery);
  }

  // Estado do dropdown de sugestões rápidas
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<UniversalSearchResults>({
    ebikes: [],
    articles: [],
    rankings: [],
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca rápida com debounce no dropdown interativo
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults({ ebikes: [], articles: [], rankings: [], total: 0 });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/universal?q=${encodeURIComponent(trimmed)}&scope=${scopeInfo.scope}&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.results) {
            setResults(data.results);
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar sugestões:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, scopeInfo.scope]);

  // Submissão do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFocused(false);

    const trimmed = query.trim();

    if (scopeInfo.scope === 'articles') {
      const target = trimmed ? `/artigos?q=${encodeURIComponent(trimmed)}` : '/artigos';
      router.push(target);
      return;
    }

    if (scopeInfo.scope === 'rankings') {
      const target = trimmed ? `/rankings?q=${encodeURIComponent(trimmed)}` : '/rankings';
      router.push(target);
      return;
    }

    if (scopeInfo.scope === 'ebikes') {
      const target = trimmed ? `/ebike?q=${encodeURIComponent(trimmed)}` : '/ebike';
      router.push(target);
      return;
    }

    // Busca Universal na Home
    if (trimmed) {
      // Se tiver termo, vai para pesquisa geral com o termo
      router.push(`/ebike?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/ebike');
    }
  };

  const hasResults = results.total > 0;
  const showDropdown = isFocused && query.trim().length >= 2;

  return (
    <div className="relative w-full flex flex-col gap-1.5" ref={dropdownRef} id="sidebar-contextual-search">
      {/* Indicador de Escopo Contextual Atual */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-ink/75 uppercase tracking-wider">
            Busca {scopeInfo.badgeText}
          </span>
        </div>
        <span
          className={`text-[8.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded border shadow-2xs ${scopeInfo.badgeColor}`}
        >
          {scopeInfo.badgeText}
        </span>
      </div>

      {/* Barra de Busca com Design Idêntico ao Mobile */}
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="relative flex items-center w-full group">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scopeInfo.placeholder}
            className="w-full h-10 pl-8 pr-16 text-xs font-sans font-semibold text-ink bg-white/95 border-2 border-ink rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-ink transition-all placeholder:text-ink/40 shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[0.5px] hover:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]"
          />
          <Search className="w-3.5 h-3.5 text-ink/60 absolute left-2.5 top-3 pointer-events-none group-focus-within:text-ink transition-colors" />

          {/* Botão de Limpar */}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults({ ebikes: [], articles: [], rankings: [], total: 0 });
                inputRef.current?.focus();
              }}
              aria-label="Limpar busca"
              className="absolute right-12 top-2.5 h-5 w-5 rounded-full bg-neutral-200 text-ink hover:bg-neutral-300 flex items-center justify-center text-[10px] cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Botão de Ação / Enviar Busca Rápida */}
          <button
            type="submit"
            aria-label="Executar busca"
            className="absolute right-1.5 top-1.5 h-7 px-2.5 bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-[9px] uppercase tracking-wider rounded-lg border border-ink shadow-[1px_1px_0_0_rgba(46,43,39,1)] flex items-center justify-center cursor-pointer active:scale-95 transition-all"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buscar'}
          </button>
        </div>
      </form>

      {/* DROPDOWN DE RESULTADOS INSTANTÂNEOS NO DESKTOP */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white border-2 border-ink rounded-2xl shadow-[6px_6px_0_0_rgba(46,43,39,1)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[380px] overflow-y-auto flex flex-col">
          {isLoading && !hasResults ? (
            <div className="p-4 text-center text-xs font-mono text-ink/60 flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span>Buscando em {scopeInfo.name}...</span>
            </div>
          ) : !hasResults ? (
            <div className="p-4 text-center">
              <p className="text-xs font-mono font-bold text-ink">Nenhum resultado em {scopeInfo.name}</p>
              <p className="text-[10px] font-sans text-ink/60 mt-1">
                Pressione Enter para ver todas as opções disponíveis.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-ink/10">
              {/* E-Bikes */}
              {results.ebikes.length > 0 && (
                <div className="p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-ink/60 flex items-center gap-1">
                      <Bike className="w-3 h-3 text-emerald-700" />
                      E-Bikes ({results.ebikes.length})
                    </span>
                  </div>
                  {results.ebikes.map((item, idx) => (
                    <Link
                      key={`ebike-${item.id}-${idx}`}
                      href={item.url}
                      onClick={() => setIsFocused(false)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50 text-left transition-colors group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-sans font-bold text-ink truncate group-hover:text-emerald-800">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-ink/60 truncate">
                          {item.subtitle}
                        </span>
                      </div>
                      {item.price ? (
                        <span className="text-[10px] font-mono font-black text-ink whitespace-nowrap bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                          R$ {item.price.toLocaleString('pt-BR')}
                        </span>
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-ink/40 group-hover:text-ink shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* Artigos */}
              {results.articles.length > 0 && (
                <div className="p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-ink/60 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-amber-700" />
                      Artigos ({results.articles.length})
                    </span>
                  </div>
                  {results.articles.map((item, idx) => (
                    <Link
                      key={`article-${item.id}-${idx}`}
                      href={item.url}
                      onClick={() => setIsFocused(false)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-amber-50 text-left transition-colors group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-sans font-bold text-ink line-clamp-1 group-hover:text-amber-900">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-ink/60 truncate">
                          {item.subtitle}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink/40 group-hover:text-ink shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              )}

              {/* Rankings */}
              {results.rankings.length > 0 && (
                <div className="p-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-ink/60 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-600" />
                      Top Rankings ({results.rankings.length})
                    </span>
                  </div>
                  {results.rankings.map((item, idx) => (
                    <Link
                      key={`ranking-${item.id}-${idx}`}
                      href={item.url}
                      onClick={() => setIsFocused(false)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-yellow-50 text-left transition-colors group"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-sans font-bold text-ink line-clamp-1 group-hover:text-amber-900">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-ink/60 truncate">
                          {item.subtitle}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink/40 group-hover:text-ink shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              )}

              {/* Botão de Ver todos */}
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full p-2.5 bg-neutral-100 hover:bg-accent-gold text-ink font-mono font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors border-t border-ink/10"
              >
                <span>Ver todos os resultados para &quot;{query}&quot;</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
