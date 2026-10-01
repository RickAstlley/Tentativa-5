'use client';

import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { TopRanking, RankingItem, RankingStoreOffer, RANKING_STORAGE_KEY } from '@/types/ranking';
import PriceHistoryChart from '@/components/detail/PriceHistoryChart';
import RankingCommentsSection from '@/components/ranking/RankingCommentsSection';
import {
  Trophy,
  Award,
  Star,
  CheckCircle2,
  XCircle,
  Store,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Share2,
  Tag,
  Sparkles,
  Zap,
  Info,
  TrendingDown,
} from 'lucide-react';
import Footer from '@/components/Footer';
import { BG_CICLOVIA_DATA_URI } from '@/lib/bgCicloviaDataUri';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicRankingDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [ranking, setRanking] = useState<TopRanking | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRanking = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      let found: TopRanking | null = null;

      // 1. Tentar ler da API Backend
      try {
        const res = await fetch(`/api/rankings?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.ranking) {
            found = data.ranking as TopRanking;
          }
        }
      } catch (apiErr) {
        console.warn('API de ranking offline:', apiErr);
      }

      // 2. Tentar ler do Firestore Client SDK
      if (!found) {
        try {
          const snap = await getDoc(doc(db, 'rankings', slug));
          if (snap.exists()) {
            found = snap.data() as TopRanking;
          }
        } catch (fErr) {
          console.warn('Firestore offline ou ranking não encontrado no banco:', fErr);
        }
      }

      // 3. Fallback para LocalStorage
      if (!found && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(RANKING_STORAGE_KEY);
          if (raw) {
            const list: TopRanking[] = JSON.parse(raw);
            if (Array.isArray(list)) {
              found = list.find((r) => r.slug === slug) || null;
            }
          }
        } catch (lErr) {
          console.warn('Erro ao ler cache local de ranking:', lErr);
        }
      }

      setRanking(found);
    } catch (err) {
      console.error('Erro ao carregar ranking público:', err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6 bg-transparent"
        style={{
          backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top center',
          backgroundSize: '100% auto',
        }}
      >
        <div className="text-center space-y-3 bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <div className="w-12 h-12 border-4 border-stone-900 border-t-amber-400 rounded-full animate-spin mx-auto" />
          <p className="font-black text-stone-800 text-sm">Carregando guia comparativo...</p>
        </div>
      </div>
    );
  }

  if (!ranking) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6 bg-transparent"
        style={{
          backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top center',
          backgroundSize: '100% auto',
        }}
      >
        <div className="max-w-md bg-white border-2 border-stone-900 rounded-2xl p-8 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
          <Trophy className="w-12 h-12 text-stone-400 mx-auto" />
          <h2 className="text-xl font-black text-stone-900">Ranking não encontrado</h2>
          <p className="text-xs text-stone-600 font-medium">
            O guia comparativo solicitado não foi localizado ou ainda não foi publicado.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={loadRanking}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-stone-900 font-black rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all text-xs cursor-pointer"
            >
              Tentar Novamente
            </button>
            <Link
              href="/rankings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 font-black rounded-xl border-2 border-stone-900 transition-all text-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ver todos os Rankings</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col justify-between bg-transparent text-ink relative" 
      id="ranking-detail-page"
      style={{
        backgroundImage: `url("${BG_CICLOVIA_DATA_URI}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top center',
        backgroundSize: '100% auto',
      }}
    >
      <main className="flex-grow pt-8 sm:pt-10 pb-12 sm:pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb & Botão Voltar */}
        <div className="flex items-center justify-between bg-white border-2 border-stone-900 rounded-2xl px-4 py-3 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
          <Link
            href="/rankings"
            className="inline-flex items-center gap-2 text-xs font-black text-stone-700 hover:text-stone-900 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-primary" />
            <span>Voltar para Top Rankings</span>
          </Link>

          <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-black uppercase tracking-wider">
            {ranking.categoria}
          </span>
        </div>

        {/* Hero do Ranking */}
        <div className="bg-white border-2 border-stone-900 rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest">
              <Trophy className="w-4 h-4" />
              <span>Guia Comparativo Oficial</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-stone-900 leading-tight">
              {ranking.titulo}
            </h1>
            <p className="text-sm sm:text-base text-stone-700 font-medium leading-relaxed">
              {ranking.subtitulo || ranking.criterioAvaliacao}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-stone-500 border-t border-stone-100 pt-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stone-400" />
              <span suppressHydrationWarning>Atualizado em {new Date(ranking.dataAtualizacao || Date.now()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{ranking.itens?.length || 0} modelos testados e ranqueados</span>
            </div>
          </div>
        </div>

        {/* Lista de Modelos Ranqueados */}
        <div className="space-y-6">
          {ranking.itens && ranking.itens.length > 0 ? (
            ranking.itens.map((item: RankingItem, index: number) => {
              const isTop1 = item.posicao === 1 || index === 0;
              const isTop2 = item.posicao === 2 || index === 1;
              const isTop3 = item.posicao === 3 || index === 2;

              const itemImage = item.imagemUrl;
              const itemName = item.tituloItem || `${item.marca || ''} Model`;
              const itemPros = item.pontosPositivos || [];
              const itemCons = item.pontosNegativos || [];

              return (
                <div
                  key={item.id || index}
                  className={`bg-white border-2 border-stone-900 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-6 relative overflow-hidden ${
                    isTop1 ? 'ring-4 ring-amber-400/50' : ''
                  }`}
                >
                  {/* Badge de Posição */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-stone-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl border-2 border-stone-900 flex items-center justify-center font-black text-xl shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] ${
                          isTop1
                            ? 'bg-amber-400 text-stone-900'
                            : isTop2
                            ? 'bg-stone-200 text-stone-800'
                            : isTop3
                            ? 'bg-amber-700 text-white'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        #{item.posicao || index + 1}
                      </div>

                      <div>
                        {item.notaDestaque && (
                          <span className="inline-block px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-md text-[10px] font-black uppercase tracking-wider mb-1">
                            {item.notaDestaque}
                          </span>
                        )}
                        <h2 className="text-xl sm:text-2xl font-black text-stone-900">
                          {itemName}
                        </h2>
                      </div>
                    </div>

                    {item.faixaPrecoEstimado && (
                      <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 text-amber-300 rounded-xl font-black text-xs self-start sm:self-auto shadow-sm">
                        <Tag className="w-4 h-4 text-amber-300" />
                        <span>{item.faixaPrecoEstimado}</span>
                      </div>
                    )}
                  </div>

                  {/* Imagem + Resumo */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {itemImage && (
                      <div className="md:col-span-4 relative aspect-video md:aspect-square w-full rounded-2xl overflow-hidden border-2 border-stone-900 bg-stone-100 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
                        <SafeImage
                          src={itemImage}
                          alt={itemName}
                          fill
                          className="object-cover"
                          fallbackSrc="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className={itemImage ? 'md:col-span-8 space-y-4' : 'md:col-span-12 space-y-4'}>
                      {item.observacoes && (
                        <p className="text-sm text-stone-700 font-medium leading-relaxed">
                          {item.observacoes}
                        </p>
                      )}

                      {/* Especificações Rápidas */}
                      {item.especificacoes && Object.keys(item.especificacoes).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                          {Object.entries(item.especificacoes).map(([key, value]) => (
                            <div
                              key={key}
                              className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                            >
                              <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider truncate">
                                {key}
                              </div>
                              <div className="font-black text-stone-900 truncate">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prós e Contras */}
                  {(itemPros.length > 0 || itemCons.length > 0) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                      {itemPros.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Pontos Fortes
                          </h4>
                          <ul className="space-y-1.5">
                            {itemPros.map((pro, pIdx) => (
                              <li
                                key={pIdx}
                                className="text-xs font-bold text-stone-700 flex items-start gap-2"
                              >
                                <span className="text-emerald-500 font-black">+</span>
                                <span>{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {itemCons.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            Pontos de Atenção
                          </h4>
                          <ul className="space-y-1.5">
                            {itemCons.map((contra, cIdx) => (
                              <li
                                key={cIdx}
                                className="text-xs font-bold text-stone-700 flex items-start gap-2"
                              >
                                <span className="text-rose-500 font-black">-</span>
                                <span>{contra}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Onde Comprar (Ofertas de Lojas) */}
                  {item.lojas && item.lojas.length > 0 && (
                    <div className="border-t-2 border-stone-100 pt-4 space-y-3">
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-amber-500" />
                        Onde Comprar com Melhor Preço
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {item.lojas.map((loja: RankingStoreOffer, lIdx: number) => (
                          <a
                            key={lIdx}
                            href={loja.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="p-3.5 bg-stone-50 hover:bg-amber-50/60 border-2 border-stone-900 hover:border-amber-500 rounded-2xl flex items-center justify-between gap-3 transition-all shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] group"
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-black text-stone-900 group-hover:text-amber-950 flex items-center gap-1">
                                {loja.nomeLoja}
                                {loja.cupom && (
                                  <span className="px-1.5 py-0.2 bg-amber-200 text-stone-900 rounded text-[9px] font-black">
                                    {loja.cupom}
                                  </span>
                                )}
                              </div>
                              {loja.preco ? (
                                <div className="text-sm font-black text-emerald-700">
                                  R$ {Number(loja.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                              ) : (
                                <div className="text-[11px] font-bold text-stone-500">Ver preço atual</div>
                              )}
                            </div>

                            <div className="p-2 bg-stone-900 group-hover:bg-amber-500 text-white group-hover:text-stone-900 rounded-xl transition-colors shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gráfico de Preço da E-Bike (Últimos 6 Meses) */}
                  <div className="border-t border-stone-100 pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                        Histórico de Preço deste Modelo (6 Meses)
                      </h4>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-2 sm:p-4">
                      {item.priceHistory && item.priceHistory.length >= 2 ? (
                        <PriceHistoryChart priceHistory={item.priceHistory} />
                      ) : (
                        <div className="py-6 px-4 text-center text-xs font-medium text-stone-500">
                          Histórico oficial de preços ainda em monitoramento para este modelo no mercado nacional.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Redirecionamento Direto para Ficha Completa e Avaliação Individual (Sem avaliação no ranking) */}
                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-stone-500 font-medium">
                      Deseja ver teste em subidas, autonomia medida na prática e ficha técnica completa?
                    </p>
                    <Link
                      href={
                        item.bikeSlug
                          ? `/ebikes/${item.bikeSlug}`
                          : `/ebikes?search=${encodeURIComponent(itemName)}`
                      }
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-black rounded-xl border border-stone-900 transition-all shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:translate-x-0.5"
                    >
                      <span>Ver Ficha Completa & Avaliação da E-Bike</span>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-white border-2 border-stone-900 rounded-3xl text-center text-sm font-bold text-stone-600">
              Nenhum item ranqueado neste comparativo ainda.
            </div>
          )}
        </div>

        {/*
          Anúncio entre a lista de modelos e a conclusão. Fica no meio da
          página, com o ranking inteiro acima e a recomendação abaixo — nunca
          encostado nos pódios, que é onde o clique no conteúdo vale mais.
        */}
        <AdSenseBanner
          slotId={getAdSenseSlot('RANKING_ITEM')}
          slotName="RANKING_ITEM"
          format="fluid"
          minHeight={120}
        />

        {/* Conclusão Geral do Ranking */}
        {ranking.conclusaoGeral && (
          <div className="bg-white border-2 border-stone-900 rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest">
              <Sparkles className="w-4 h-4" />
              <span>Veredito da Curadoria Técnica</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-stone-900">
              Conclusão & Recomendação Geral
            </h3>
            <p className="text-sm sm:text-base text-stone-700 font-medium leading-relaxed whitespace-pre-wrap">
              {ranking.conclusaoGeral}
            </p>
          </div>
        )}

        {/* Seção de Comentários */}
        <RankingCommentsSection
          rankingSlug={ranking.slug}
          rankingTitle={ranking.titulo}
        />
        </div>
      </main>

      <Footer />
    </div>
  );
}
