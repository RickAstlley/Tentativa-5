'use client';

import React from 'react';
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
  Store,
  CheckCircle2,
  Tag,
  ShieldCheck,
} from 'lucide-react';

interface HomeTopRankingsSectionProps {
  rankings: TopRanking[];
  title?: string;
  subtitle?: string;
  isMobileCompact?: boolean;
}

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

export default function HomeTopRankingsSection({
  rankings,
  title = 'Top Rankings & Guias de Escolha',
  subtitle = 'Análises técnicas imparciais, comparativos de bancada e links auditados nas melhores lojas.',
  isMobileCompact = false,
}: HomeTopRankingsSectionProps) {
  if (!rankings || rankings.length === 0) {
    return null;
  }

  // Exibe até 3 rankings em destaque na Home
  const displayedRankings = rankings.slice(0, 3);

  return (
    <section
      className="w-full flex flex-col gap-4 sm:gap-5 bg-white border-2 border-ink rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-[3.5px_3.5px_0_0_rgba(46,43,39,1)] relative overflow-hidden"
      id="home-top-rankings-section"
    >
      {/* Faixa decorativa superior neo-brutalista */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-accent-gold via-primary to-emerald-400" />

      {/* CABEÇALHO DA SEÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b-2 border-ink/15 pb-3.5 sm:pb-4">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-accent-gold border border-ink text-ink rounded-full text-[10px] sm:text-xs font-mono font-black uppercase self-start shadow-[1.5px_1.5px_0_0_rgba(46,43,39,1)]">
            <Trophy className="w-3.5 h-3.5 text-ink shrink-0" />
            <span>Curadoria Editorial &amp; Pódios Oficiais</span>
          </div>

          <h2 className="font-display font-black text-lg sm:text-xl md:text-2xl text-ink tracking-tight flex items-center gap-2">
            <span>{title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>

        <Link
          href="/rankings"
          className="inline-flex items-center justify-center gap-2 text-xs font-mono font-black uppercase bg-ink text-accent-gold hover:bg-ink/90 px-3.5 py-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <span>Ver Todos os Rankings</span>
          <ArrowRight className="w-3.5 h-3.5 text-accent-gold shrink-0" />
        </Link>
      </div>

      {/* GRADE DE CARDS DOS TOP RANKINGS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {displayedRankings.map((ranking, idx) => {
          if (!ranking) return null;
          const categoryConfig =
            (ranking.categoria && CATEGORY_STYLES[ranking.categoria]) || CATEGORY_STYLES.ebikes;
          const champItem = ranking.itens?.[0];
          const runnerUp1 = ranking.itens?.[1];
          const runnerUp2 = ranking.itens?.[2];
          const totalItens = ranking.itens?.length || ranking.quantidadeItens || 5;

          return (
            <article
              key={`top-ranking-${ranking.id || ranking.slug || 'item'}-${idx}`}
              className="group flex flex-col justify-between bg-[#FBF9F5] border-2 border-ink rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] hover:shadow-[3.5px_3.5px_0_0_rgba(46,43,39,1)] transition-all hover:-translate-y-0.5"
            >
              <div className="flex flex-col gap-3">
                {/* TOPO DO CARD: Categoria + Badge de Posições */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-[9.5px] sm:text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-lg border ${categoryConfig.border} ${categoryConfig.badgeBg} ${categoryConfig.text}`}
                  >
                    {categoryConfig.label}
                  </span>

                  <span className="text-[9.5px] sm:text-[10px] font-mono font-black uppercase bg-accent-gold text-ink px-2 py-0.5 rounded-lg border border-ink flex items-center gap-1 shadow-xs">
                    <Trophy className="w-3 h-3 text-ink shrink-0" />
                    <span>Top {totalItens}</span>
                  </span>
                </div>

                {/* TÍTULO E SUBTÍTULO */}
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/rankings/${ranking.slug}`}
                    className="group-hover:text-primary transition-colors cursor-pointer"
                  >
                    <h3 className="font-display font-black text-sm sm:text-base text-ink leading-snug line-clamp-2">
                      {ranking.titulo}
                    </h3>
                  </Link>

                  {ranking.subtitulo && (
                    <p className="text-[11px] text-ink/70 font-sans line-clamp-2 leading-relaxed">
                      {ranking.subtitulo}
                    </p>
                  )}
                </div>

                {/* DESTAQUE DO 1º LUGAR (CAMPEÃO GERAL) */}
                {champItem && (
                  <div className="bg-white border-2 border-ink rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 border-b border-ink/10 pb-1.5">
                      <span className="text-[9.5px] font-mono font-black uppercase text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                        🥇 1º Lugar Geral
                      </span>
                      {champItem.notaDestaque && (
                        <span className="text-[9px] font-mono font-bold text-ink/80 truncate max-w-[140px]">
                          {champItem.notaDestaque}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      {champItem.imagemUrl ? (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-ink/20 overflow-hidden bg-gradient-to-br from-white to-neutral-100 shrink-0 relative p-1">
                          <SafeImage
                            src={champItem.imagemUrl}
                            fallbackSrc="/placeholder-bike.png"
                            alt={champItem.tituloItem}
                            fill
                            className="object-contain group-hover:scale-105 transition-transform duration-300 p-0.5"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-ink/20 bg-accent-gold/20 flex items-center justify-center shrink-0">
                          <Trophy className="w-5 h-5 text-ink/60" />
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[9px] font-mono uppercase text-ink/60 font-bold">
                          {champItem.marca || 'Destaque'}
                        </span>
                        <h4 className="font-display font-black text-xs sm:text-sm text-ink truncate">
                          {champItem.tituloItem}
                        </h4>
                        {champItem.faixaPrecoEstimado && (
                          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-emerald-800">
                            {champItem.faixaPrecoEstimado}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Vantagem Principal */}
                    {champItem.pontosPositivos?.[0] && (
                      <div className="flex items-center gap-1.5 text-[9.5px] font-sans text-ink/80 pt-1 border-t border-ink/5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{champItem.pontosPositivos[0]}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PRÉVIA DOS DEMAIS COLOCADOS (2º e 3º) */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[9px] font-mono uppercase font-bold text-ink/60">
                    Pódio Completo &amp; Alternativas:
                  </span>
                  <div className="flex flex-col gap-1 text-[11px] font-sans text-ink/90">
                    {runnerUp1 && (
                      <div className="flex items-center justify-between gap-2 py-0.5 px-2 bg-white/70 rounded border border-ink/10">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-stone-600 font-mono font-bold text-[10px]">🥈 2º</span>
                          <span className="font-bold truncate text-[10.5px]">{runnerUp1.tituloItem}</span>
                        </div>
                        {runnerUp1.notaDestaque && (
                          <span className="text-[8.5px] font-mono text-ink/60 shrink-0 truncate max-w-[85px]">
                            {runnerUp1.notaDestaque}
                          </span>
                        )}
                      </div>
                    )}
                    {runnerUp2 && (
                      <div className="flex items-center justify-between gap-2 py-0.5 px-2 bg-white/70 rounded border border-ink/10">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-amber-800 font-mono font-bold text-[10px]">🥉 3º</span>
                          <span className="font-bold truncate text-[10.5px]">{runnerUp2.tituloItem}</span>
                        </div>
                        {runnerUp2.notaDestaque && (
                          <span className="text-[8.5px] font-mono text-ink/60 shrink-0 truncate max-w-[85px]">
                            {runnerUp2.notaDestaque}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RODAPÉ DO CARD: Botão de Acesso ao Ranking Completo */}
              <div className="pt-3 mt-2 border-t border-ink/15">
                <Link
                  href={`/rankings/${ranking.slug}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 bg-white hover:bg-accent-gold text-ink font-mono font-black text-[11px] sm:text-xs uppercase rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <span>Ver Comparativo Completo</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
