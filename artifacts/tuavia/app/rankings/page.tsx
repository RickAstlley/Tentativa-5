'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { TopRanking, RankingCategory, RANKING_STORAGE_KEY } from '@/types/ranking';
import {
  Trophy,
  Award,
  Star,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Filter,
  X,
} from 'lucide-react';
import Footer from '@/components/Footer';
import { BG_CICLOVIA_DATA_URI } from '@/lib/bgCicloviaDataUri';

const CATEGORIAS_TAB: { label: string; value: string }[] = [
  { label: 'Todos os Rankings', value: 'todos' },
  { label: 'E-Bikes Completas', value: 'ebikes' },
  { label: 'Baterias & Carregadores', value: 'baterias' },
  { label: 'Peças & Motores', value: 'pecas' },
  { label: 'Acessórios & Bagageiros', value: 'acessorios' },
  { label: 'Segurança & Cadeados', value: 'seguranca' },
  { label: 'Custo-Benefício', value: 'custo-beneficio' },
];

function RankingsContent() {
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams?.get('q') || '';

  const [rankings, setRankings] = useState<TopRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState(queryFromUrl);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setSearchTerm(queryFromUrl);
  }, [queryFromUrl]);

  const loadRankings = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const map = new Map<string, TopRanking>();
      let loadedFromApi = false;

      // 1. Tentar ler da API Backend autoritativa
      try {
        const res = await fetch('/api/rankings', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rankings)) {
            data.rankings.forEach((r: TopRanking) => {
              if (r && r.slug) map.set(r.slug, r);
            });
            loadedFromApi = true;
          }
        }
      } catch (apiErr) {
        console.warn('API de rankings offline:', apiErr);
      }

      // 2. Se a API falhou, tentar Firestore Client SDK
      if (!loadedFromApi) {
        try {
          const snap = await getDocs(collection(db, 'rankings'));
          snap.docs.forEach((d) => {
            const r = d.data() as TopRanking;
            if (r && r.slug) map.set(r.slug, r);
          });
        } catch (fErr) {
          console.warn('Firestore offline:', fErr);
        }
      }

      const list = Array.from(map.values());
      setRankings(list.filter((r) => Boolean(r && r.publicado !== false)));
    } catch (err) {
      console.error('Erro ao carregar lista de rankings:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRankings();
  }, []);

  const filtered = (rankings || []).filter((r) => {
    if (!r) return false;
    const matchesCat = selectedCategory === 'todos' || r.categoria === selectedCategory;
    const matchesSearch =
      (r.titulo && r.titulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.subtitulo && r.subtitulo.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div 
      className="min-h-screen flex flex-col justify-between text-ink bg-transparent relative" 
      id="rankings-index-page"
      style={{
        backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top center',
        backgroundSize: '100% auto',
      }}
    >
      <div className="flex-grow flex flex-col">
        {/* HEADER */}
        <div className="border-b-2 border-ink bg-white sticky top-0 z-30 shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase text-ink hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4 text-primary" />
              <span>Voltar ao Início</span>
            </Link>

            <span className="text-xs font-mono font-black uppercase bg-accent-gold text-ink px-3 py-1 rounded-xl border border-ink flex items-center gap-1.5 shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]">
              <Trophy className="w-3.5 h-3.5 text-ink" />
              Guias &amp; Top Rankings
            </span>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 flex flex-col gap-8 sm:gap-10">
        {/* HERO */}
        <div className="bg-white border-2 border-ink rounded-3xl p-6 sm:p-10 shadow-[4px_4px_0_0_rgba(46,43,39,1)] sm:shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-accent-gold to-accent-charge" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-ink text-accent-gold rounded-full text-xs font-mono font-black uppercase self-start shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Curadoria Técnica &amp; Análise Comparativa
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-black text-ink tracking-tight">
            Top Rankings &amp; Comparativos de E-Bikes e Peças
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-ink/80 font-sans leading-relaxed max-w-3xl">
            Testes técnicos, especificações reais, comparativo de lojas e links de compra para você escolher os melhores modelos com segurança e economia.
          </p>

          {/* AVISO DE BUSCA ATIVA VIA SIDEBAR */}
          {searchTerm && (
            <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-300 rounded-xl px-3.5 py-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-ink">
                <Search className="w-3.5 h-3.5 text-amber-700" />
                <span>Resultados para: <span className="bg-white px-2 py-0.5 rounded border border-ink/40">&ldquo;{searchTerm}&rdquo;</span></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  window.history.pushState({}, '', '/rankings');
                }}
                className="text-[11px] font-mono font-bold text-ink/70 hover:text-ink underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            </div>
          )}

          {/* CATEGORIAS EM CHIPS */}
          <div className="flex flex-wrap gap-2 pt-1">
            {CATEGORIAS_TAB.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-black uppercase transition-all cursor-pointer border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:scale-95 ${
                  selectedCategory === tab.value
                    ? 'bg-primary text-white'
                    : 'bg-white hover:bg-neutral-100 text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* LISTAGEM DE RANKINGS */}
        {loading ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-ink border-t-primary rounded-full animate-spin" />
            <p className="text-xs font-mono font-bold text-ink">Carregando rankings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-ink rounded-3xl p-10 text-center shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col items-center gap-4">
            <Trophy className="w-12 h-12 text-ink/30" />
            <h3 className="text-base font-display font-black text-ink">Nenhum ranking localizado</h3>
            <p className="text-xs font-mono text-ink/70 max-w-sm">
              Tente buscar com outros termos, escolha outra categoria acima ou recarregue a lista.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={loadRankings}
                className="px-4 py-2 bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-bold rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] text-xs transition-all cursor-pointer"
              >
                Tentar Novamente
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('todos');
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-ink font-mono font-bold rounded-xl border-2 border-ink text-xs transition-all cursor-pointer"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => (
              <Link
                key={item.id || item.slug}
                href={`/rankings/${item.slug}`}
                className="bg-white border-2 border-ink rounded-3xl p-6 shadow-[4px_4px_0_0_rgba(46,43,39,1)] hover:shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-black uppercase bg-accent-gold text-ink px-2.5 py-0.5 rounded-lg border border-ink shadow-xs">
                      Top {item.quantidadeItens} {item.categoria.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-ink/60" suppressHydrationWarning>
                      {new Date(item.dataAtualizacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-display font-black text-ink group-hover:text-primary transition-colors leading-snug">
                    {item.titulo}
                  </h2>

                  {item.subtitulo && (
                    <p className="text-xs text-ink/80 line-clamp-2 leading-relaxed font-sans font-medium">
                      {item.subtitulo}
                    </p>
                  )}
                </div>

                {/* Prévia do Pódio (Top 3) */}
                <div className="pt-3 border-t-2 border-dashed border-ink/15 flex flex-col gap-2">
                  <span className="text-[10px] font-mono font-black uppercase text-ink/50 block">
                    Destaques no Pódio:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {item.itens.slice(0, 3).map((subItem) => (
                      <div
                        key={subItem.id}
                        className="flex items-center justify-between text-xs font-mono font-bold text-ink bg-neutral-50 border border-ink/15 px-3 py-1.5 rounded-xl"
                      >
                        <span className="truncate pr-2">
                          #{subItem.posicao} {subItem.tituloItem}
                        </span>
                        <span className="text-[10px] text-primary uppercase shrink-0 font-black">
                          {subItem.notaDestaque}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs font-mono font-bold text-ink border-t border-ink/10">
                  <span className="text-ink/60 text-[11px]">
                    {item.itens.length} Modelos Analisados
                  </span>
                  <span className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform font-black">
                    Acessar Guia <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      </div>

      <Footer />
    </div>
  );
}

export default function PublicRankingsIndexPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-ink">
          <div className="w-10 h-10 border-4 border-ink border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <RankingsContent />
    </React.Suspense>
  );
}

