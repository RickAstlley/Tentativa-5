'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { TopRanking, RankingCategory } from '@/types/ranking';
import {
  Trophy,
  Award,
  Star,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Layers,
  CheckCircle2,
  Filter,
  Search,
  RotateCcw,
  Zap,
  Flame,
  ShieldCheck,
  Medal,
  SlidersHorizontal,
} from 'lucide-react';

interface TopRankingsThemeSectionProps {
  rankings: TopRanking[];
  isStandaloneTopic?: boolean;
  onViewAllRankings?: () => void;
  title?: string;
  subtitle?: string;
}

export type RankingSizeFilter = 'todos' | 'top3' | 'top5' | 'top7' | 'top10';

const SIZE_TABS: { id: RankingSizeFilter; label: string; shortLabel: string; icon: any; countMatch: (r: TopRanking) => boolean; desc: string; badgeColor: string }[] = [
  {
    id: 'todos',
    label: 'Todos os Rankings',
    shortLabel: 'Todos',
    icon: Layers,
    countMatch: () => true,
    desc: 'Todos os pódios e comparativos auditados pelo TuaVia.',
    badgeColor: 'bg-ink text-white border-ink',
  },
  {
    id: 'top3',
    label: 'Top 3 (Pódios Rápidos)',
    shortLabel: 'Top 3',
    icon: Medal,
    countMatch: (r) => {
      const c = r.quantidadeItens || r.itens?.length || 0;
      return c === 3 || r.tipoRanking === 'top3';
    },
    desc: 'Seleções diretas e pódios de 3 modelos para decisão rápida de compra.',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-400',
  },
  {
    id: 'top5',
    label: 'Top 5 (Mais Populares)',
    shortLabel: 'Top 5',
    icon: Star,
    countMatch: (r) => {
      const c = r.quantidadeItens || r.itens?.length || 0;
      return (c > 3 && c <= 5) || r.tipoRanking === 'top5';
    },
    desc: 'O equilíbrio ideal entre autonomia, motor, assistência e custo-benefício.',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  },
  {
    id: 'top7',
    label: 'Top 7 (Comparações Avançadas)',
    shortLabel: 'Top 7',
    icon: Flame,
    countMatch: (r) => {
      const c = r.quantidadeItens || r.itens?.length || 0;
      return c > 5 && c <= 7;
    },
    desc: 'Análises detalhadas por segmento específico com comparativo de bancada.',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-400',
  },
  {
    id: 'top10',
    label: 'Top 10 (Guias Definitivos)',
    shortLabel: 'Top 10',
    icon: Trophy,
    countMatch: (r) => {
      const c = r.quantidadeItens || r.itens?.length || 0;
      return c > 7 || r.tipoRanking === 'top10';
    },
    desc: 'Panoramas completos do mercado brasileiro com fichas técnicas e preços.',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-400',
  },
];

const CATEGORY_STYLES: Record<
  RankingCategory,
  { label: string; badgeBg: string; border: string; text: string }
> = {
  ebikes: {
    label: 'E-Bikes Completas',
    badgeBg: 'bg-emerald-100',
    border: 'border-emerald-500',
    text: 'text-emerald-900',
  },
  baterias: {
    label: 'Baterias & Células',
    badgeBg: 'bg-amber-100',
    border: 'border-amber-500',
    text: 'text-amber-900',
  },
  pecas: {
    label: 'Motores & Peças',
    badgeBg: 'bg-blue-100',
    border: 'border-blue-500',
    text: 'text-blue-900',
  },
  acessorios: {
    label: 'Acessórios & Bagageiros',
    badgeBg: 'bg-purple-100',
    border: 'border-purple-500',
    text: 'text-purple-900',
  },
  seguranca: {
    label: 'Segurança & Travas',
    badgeBg: 'bg-red-100',
    border: 'border-red-500',
    text: 'text-red-900',
  },
  'custo-beneficio': {
    label: 'Melhor Custo-Benefício',
    badgeBg: 'bg-accent-gold/20',
    border: 'border-accent-gold-dark',
    text: 'text-ink',
  },
};

export default function TopRankingsThemeSection({
  rankings = [],
  isStandaloneTopic = false,
  onViewAllRankings,
  title = 'Top Rankings & Pódios Comparativos',
  subtitle = 'Guias de escolha técnica organizados por categorias de Top 3, Top 5, Top 7 e Top 10.',
}: TopRankingsThemeSectionProps) {
  const [selectedSize, setSelectedSize] = useState<RankingSizeFilter>('todos');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [rankingSearch, setRankingSearch] = useState<string>('');

  // Contagem de rankings por tamanho
  const sizeCounts = useMemo(() => {
    const counts: Record<RankingSizeFilter, number> = {
      todos: rankings.length,
      top3: 0,
      top5: 0,
      top7: 0,
      top10: 0,
    };

    rankings.forEach((r) => {
      const c = r.quantidadeItens || r.itens?.length || 0;
      if (c === 3 || r.tipoRanking === 'top3') counts.top3++;
      else if (c > 3 && c <= 5) counts.top5++;
      else if (c > 5 && c <= 7) counts.top7++;
      else if (c > 7 || r.tipoRanking === 'top10') counts.top10++;
    });

    return counts;
  }, [rankings]);

  // Filtro ativo de rankings
  const filteredRankings = useMemo(() => {
    return rankings.filter((r) => {
      if (!r) return false;

      // Filtro de tamanho
      const activeSizeTab = SIZE_TABS.find((tab) => tab.id === selectedSize);
      const matchesSize = activeSizeTab ? activeSizeTab.countMatch(r) : true;

      // Filtro de categoria de produto
      const matchesCategory = selectedCategory === 'todas' || r.categoria === selectedCategory;

      // Filtro de busca de texto
      const q = rankingSearch.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        (r.titulo && r.titulo.toLowerCase().includes(q)) ||
        (r.subtitulo && r.subtitulo.toLowerCase().includes(q)) ||
        (r.categoria && r.categoria.toLowerCase().includes(q)) ||
        (Array.isArray(r.itens) && r.itens.some((it) => it.tituloItem?.toLowerCase().includes(q) || it.marca?.toLowerCase().includes(q)));

      return matchesSize && matchesCategory && matchesSearch;
    });
  }, [rankings, selectedSize, selectedCategory, rankingSearch]);

  const activeTabConfig = SIZE_TABS.find((t) => t.id === selectedSize) || SIZE_TABS[0];

  return (
    <section
      className="w-full flex flex-col gap-5 sm:gap-6 bg-surface border-2 border-ink rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-[4px_4px_0_0_rgba(46,43,39,1)] relative overflow-hidden"
      id="top-rankings-theme-section"
    >
      {/* Faixa decorativa superior ciclovia */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-accent-gold via-primary to-emerald-400" />

      {/* CABEÇALHO DO TEMA DE RANKINGS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink/15 pb-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] sm:text-xs font-mono font-black uppercase bg-accent-gold text-ink px-3 py-1 rounded-xl border border-ink flex items-center gap-1.5 shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)] shrink-0">
              <Trophy className="w-3.5 h-3.5 text-ink shrink-0" />
              <span>Tema Editorial: Top Rankings</span>
            </span>

            <span className="text-[10px] sm:text-xs font-mono font-bold bg-white text-ink/80 px-2.5 py-1 rounded-xl border border-ink/40 shrink-0">
              {rankings.length} Guias Publicados
            </span>
          </div>

          <h2 className="font-display font-black text-xl sm:text-2xl md:text-3xl text-ink tracking-tight">
            {title}
          </h2>

          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Link
            href="/rankings"
            className="inline-flex items-center gap-2 text-xs font-mono font-black uppercase bg-ink text-accent-gold hover:bg-ink/90 px-4 py-2.5 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-accent-gold" />
            <span>Página Central de Rankings</span>
            <ArrowRight className="w-3.5 h-3.5 text-accent-gold" />
          </Link>
        </div>
      </div>

      {/* NAVEGAÇÃO POR TAMANHO: TOP 3 / TOP 5 / TOP 7 / TOP 10 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] sm:text-xs font-black uppercase text-ink/70 tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span>Formato do Ranking:</span>
          </span>

          <span className="text-[11px] font-mono text-ink/60 hidden sm:inline-block">
            {activeTabConfig.desc}
          </span>
        </div>

        {/* BOTOES DAS CATEGORIAS DE TOP 3, TOP 5, TOP 7 E TOP 10 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
          {SIZE_TABS.map((tab) => {
            const isActive = selectedSize === tab.id;
            const count = sizeCounts[tab.id];
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedSize(tab.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 sm:py-2.5 rounded-xl border-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-ink text-white border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] scale-[1.02]'
                    : 'bg-white text-ink border-ink/60 hover:border-ink hover:bg-neutral-50 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent-gold' : 'text-primary'}`} />
                  <span className="truncate">{tab.shortLabel}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                    isActive ? 'bg-white/20 text-white' : 'bg-ink/10 text-ink/70 font-bold'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-FILTROS POR CATEGORIA DE PRODUTO E BUSCA RÁPIDA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-ink/10">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[9.5px] font-mono uppercase font-bold text-ink/60 shrink-0 mr-1">
            Segmento:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('todas')}
            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold border transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'todas'
                ? 'bg-primary text-white border-ink shadow-xs'
                : 'bg-white text-ink/80 border-ink/30 hover:border-ink'
            }`}
          >
            Todos os Segmentos
          </button>
          {Object.entries(CATEGORY_STYLES).map(([catKey, catStyle]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold border transition-all shrink-0 cursor-pointer ${
                selectedCategory === catKey
                  ? `${catStyle.badgeBg} ${catStyle.text} ${catStyle.border} border-2 shadow-xs`
                  : 'bg-white text-ink/80 border-ink/30 hover:border-ink'
              }`}
            >
              {catStyle.label}
            </button>
          ))}
        </div>

        {/* Input de busca rápida nos rankings */}
        <div className="relative min-w-[200px] sm:max-w-xs shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/40" />
          <input
            type="text"
            value={rankingSearch}
            onChange={(e) => setRankingSearch(e.target.value)}
            placeholder="Buscar por tema ou bike..."
            className="w-full bg-white border border-ink/40 focus:border-ink rounded-lg pl-8 pr-7 py-1 text-xs font-mono text-ink placeholder:text-ink/40 focus:outline-none shadow-2xs"
          />
          {rankingSearch && (
            <button
              type="button"
              onClick={() => setRankingSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* GRADE DE CARDS DOS RANKINGS */}
      {filteredRankings.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-ink/40 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-ink/30" />
          <div className="flex flex-col gap-1 max-w-md">
            <h4 className="font-display font-black text-base text-ink">Nenhum ranking encontrado para este filtro</h4>
            <p className="text-xs font-sans text-ink/70">
              Não há guias cadastrados no formato <strong className="font-mono">{selectedSize.toUpperCase()}</strong> com os critérios selecionados.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedSize('todos');
              setSelectedCategory('todas');
              setRankingSearch('');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-ink font-mono font-bold text-xs rounded-xl border border-ink shadow-xs cursor-pointer mt-1"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ink" />
            <span>Exibir Todos os Rankings</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredRankings.map((ranking, idx) => {
            const categoryConfig =
              (ranking.categoria && CATEGORY_STYLES[ranking.categoria]) || CATEGORY_STYLES.ebikes;
            const champItem = ranking.itens?.[0];
            const runnerUp1 = ranking.itens?.[1];
            const runnerUp2 = ranking.itens?.[2];
            const totalItens = ranking.itens?.length || ranking.quantidadeItens || 5;

            // Define cor do badge do Top N
            let sizeBadgeClass = 'bg-amber-100 text-amber-950 border-amber-400';
            if (totalItens <= 3) sizeBadgeClass = 'bg-amber-100 text-amber-950 border-amber-400';
            else if (totalItens <= 5) sizeBadgeClass = 'bg-emerald-100 text-emerald-950 border-emerald-400';
            else if (totalItens <= 7) sizeBadgeClass = 'bg-blue-100 text-blue-950 border-blue-400';
            else sizeBadgeClass = 'bg-purple-100 text-purple-950 border-purple-400';

            return (
              <article
                key={ranking.id || ranking.slug || `ranking-${idx}`}
                className="group flex flex-col justify-between bg-white border-2 border-ink rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] hover:shadow-[5px_5px_0_0_rgba(46,43,39,1)] hover:-translate-y-0.5 transition-all"
              >
                <div className="flex flex-col gap-3">
                  {/* TOPO DO CARD: Categoria + Formato Top N */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-lg border ${categoryConfig.border} ${categoryConfig.badgeBg} ${categoryConfig.text}`}
                    >
                      {categoryConfig.label}
                    </span>

                    <span
                      className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-lg border flex items-center gap-1 shadow-xs ${sizeBadgeClass}`}
                    >
                      <Trophy className="w-3 h-3 shrink-0" />
                      <span>Top {totalItens}</span>
                    </span>
                  </div>

                  {/* TÍTULO E SUBTÍTULO */}
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/rankings/${ranking.slug}`}
                      className="group-hover:text-primary transition-colors cursor-pointer"
                    >
                      <h3 className="font-display font-black text-base sm:text-lg text-ink leading-snug line-clamp-2">
                        {ranking.titulo}
                      </h3>
                    </Link>

                    {ranking.subtitulo && (
                      <p className="text-xs text-ink/70 font-sans line-clamp-2 leading-relaxed">
                        {ranking.subtitulo}
                      </p>
                    )}
                  </div>

                  {/* DESTAQUE DO 1º LUGAR (CAMPEÃO GERAL) */}
                  {champItem && (
                    <div className="bg-[#FAF8F5] border-2 border-ink rounded-xl p-3 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1.5">
                        <span className="text-[10px] font-mono font-black uppercase text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-400 flex items-center gap-1">
                          🥇 1º Lugar (Campeã Geral)
                        </span>
                        {champItem.notaDestaque && (
                          <span className="text-[9.5px] font-mono font-bold text-ink/80 truncate max-w-[140px]">
                            {champItem.notaDestaque}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        {champItem.imagemUrl ? (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border border-ink/20 overflow-hidden bg-white shrink-0 relative">
                            <SafeImage
                              src={champItem.imagemUrl}
                              alt={champItem.tituloItem}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg border border-ink/20 bg-accent-gold/20 flex items-center justify-center shrink-0">
                            <Trophy className="w-5 h-5 text-ink/60" />
                          </div>
                        )}

                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[9.5px] font-mono uppercase text-ink/60 font-bold">
                            {champItem.marca || 'Destaque'}
                          </span>
                          <h4 className="font-display font-black text-xs sm:text-sm text-ink truncate">
                            {champItem.tituloItem}
                          </h4>
                          {champItem.faixaPrecoEstimado && (
                            <span className="text-[11px] font-mono font-bold text-emerald-800">
                              {champItem.faixaPrecoEstimado}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Primeiro Ponto Positivo */}
                      {champItem.pontosPositivos?.[0] && (
                        <div className="flex items-center gap-1.5 text-[10px] font-sans text-ink/80 pt-1 border-t border-ink/5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{champItem.pontosPositivos[0]}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PRÉVIA DOS DEMAIS COLOCADOS (2º e 3º) */}
                  {(runnerUp1 || runnerUp2) && (
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-[9.5px] font-mono uppercase font-bold text-ink/60">
                        Outras Posições do Pódio:
                      </span>
                      <div className="flex flex-col gap-1 text-[11px] font-sans text-ink/90">
                        {runnerUp1 && (
                          <div className="flex items-center justify-between gap-2 py-0.5 px-2 bg-neutral-50 rounded border border-ink/10">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-stone-600 font-mono font-bold text-[10px]">🥈 2º</span>
                              <span className="font-bold truncate text-[11px]">{runnerUp1.tituloItem}</span>
                            </div>
                            {runnerUp1.notaDestaque && (
                              <span className="text-[9px] font-mono text-ink/60 shrink-0 truncate max-w-[90px]">
                                {runnerUp1.notaDestaque}
                              </span>
                            )}
                          </div>
                        )}
                        {runnerUp2 && (
                          <div className="flex items-center justify-between gap-2 py-0.5 px-2 bg-neutral-50 rounded border border-ink/10">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-amber-800 font-mono font-bold text-[10px]">🥉 3º</span>
                              <span className="font-bold truncate text-[11px]">{runnerUp2.tituloItem}</span>
                            </div>
                            {runnerUp2.notaDestaque && (
                              <span className="text-[9px] font-mono text-ink/60 shrink-0 truncate max-w-[90px]">
                                {runnerUp2.notaDestaque}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* BOTÃO DE ACESSO AO RANKING COMPLETO */}
                <div className="pt-3 mt-3 border-t border-ink/15">
                  <Link
                    href={`/rankings/${ranking.slug}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-accent-gold hover:bg-accent-gold-dark text-ink font-mono font-black text-xs uppercase rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <span>Ver Top {totalItens} Completo</span>
                    <ChevronRight className="w-3.5 h-3.5 text-ink shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
