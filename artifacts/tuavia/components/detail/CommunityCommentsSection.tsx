'use client';

import React, { useState, useMemo } from 'react';
import { 
  Star, 
  ShieldCheck, 
  ThumbsUp, 
  BatteryCharging, 
  User, 
  MapPin, 
  Plus,
  SlidersHorizontal,
  ArrowUpDown,
  MessageSquarePlus,
  MessageSquare
} from 'lucide-react';
import { EBikeReview } from '@/types/ebike';
import AddReviewModal from './AddReviewModal';

interface CommunityCommentsSectionProps {
  rating: number;
  reviewCount: number;
  reviews: EBikeReview[];
  helpfulVotes?: Record<string, number>;
  votedReviews?: Record<string, boolean>;
  handleHelpfulClick?: (reviewId: string) => void;
  bikeSlug?: string;
  bikeModelo?: string;
  advertisedRangeKm?: number;
  onReviewAdded?: (newReview: EBikeReview) => void;
}

export default function CommunityCommentsSection({
  rating: initialRating,
  reviewCount: initialReviewCount,
  reviews: initialReviews,
  helpfulVotes: initialHelpfulVotes = {},
  votedReviews: initialVotedReviews = {},
  handleHelpfulClick: externalHandleHelpfulClick,
  bikeSlug = '',
  bikeModelo = 'E-Bike',
  advertisedRangeKm = 45,
  onReviewAdded,
}: CommunityCommentsSectionProps) {
  const [reviewsList, setReviewsList] = useState<EBikeReview[]>(initialReviews || []);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>(initialHelpfulVotes);
  const [votedReviews, setVotedReviews] = useState<Record<string, boolean>>(initialVotedReviews);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtros e ordenação da lista
  const [filterTerrain, setFilterTerrain] = useState<'todos' | 'plano' | 'misto' | 'íngreme'>('todos');
  const [sortBy, setSortBy] = useState<'recentes' | 'uteis' | 'autonomia'>('recentes');

  // Sincroniza se as props mudarem
  React.useEffect(() => {
    if (initialReviews) {
      setReviewsList(initialReviews);
    }
  }, [initialReviews]);

  // Média de nota geral dinâmica: padrão 0/5 quando não há avaliações, subindo conforme novos relatos chegam
  const averageRating = useMemo(() => {
    if (!reviewsList || reviewsList.length === 0) return 0;
    const sum = reviewsList.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return Math.round((sum / reviewsList.length) * 10) / 10;
  }, [reviewsList]);

  // Lista filtrada e ordenada
  const filteredReviews = useMemo(() => {
    let result = [...(reviewsList || [])];

    if (filterTerrain !== 'todos') {
      result = result.filter(r => r.terrain === filterTerrain);
    }

    if (sortBy === 'recentes') {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'uteis') {
      result.sort((a, b) => {
        const votesA = (a.helpfulCount || 0) + (helpfulVotes[a.id] || 0);
        const votesB = (b.helpfulCount || 0) + (helpfulVotes[b.id] || 0);
        return votesB - votesA;
      });
    } else if (sortBy === 'autonomia') {
      result.sort((a, b) => (b.realRangeKm || 0) - (a.realRangeKm || 0));
    }

    return result;
  }, [reviewsList, filterTerrain, sortBy, helpfulVotes]);

  const handleHelpful = async (reviewId: string) => {
    if (votedReviews[reviewId]) return;

    if (externalHandleHelpfulClick) {
      externalHandleHelpfulClick(reviewId);
    }

    setVotedReviews((prev) => ({ ...prev, [reviewId]: true }));
    setHelpfulVotes((prev) => ({ ...prev, [reviewId]: (prev[reviewId] || 0) + 1 }));

    try {
      await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'helpful', reviewId }),
      });
    } catch {
      // Falha silenciosa aceitável para voto local
    }
  };

  const handleNewReviewAdded = (newReview: EBikeReview) => {
    setReviewsList((prev) => [newReview, ...prev]);
    if (onReviewAdded) {
      onReviewAdded(newReview);
    }
  };

  return (
    <section 
      id="comentarios-comunidade" 
      aria-label="Comentários e Relatos dos Ciclistas"
      className="bg-white border-2 border-stone-900 rounded-3xl p-5 sm:p-8 shadow-[4px_4px_0_0_rgba(28,25,23,1)] flex flex-col gap-6 mt-10"
    >
      {/* Cabeçalho da Seção de Comentários */}
      <div className="border-b-2 border-stone-100 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-400 border-2 border-stone-900 rounded-lg text-stone-900 shadow-[1.5px_1.5px_0px_0px_rgba(28,25,23,1)]">
              <MessageSquare className="w-4 h-4" />
            </span>
            <h3 className="font-black text-stone-900 uppercase tracking-tight text-xl sm:text-2xl">
              Comentários e Relatos da Comunidade
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-medium max-w-2xl">
            Experiências reais, opiniões de proprietários e testes de autonomia na rotina diária da {bikeModelo}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 bg-amber-400 hover:bg-amber-300 border-2 border-stone-900 text-stone-900 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all self-start sm:self-auto shrink-0 select-none"
        >
          <Plus className="w-4 h-4" />
          <span>Avaliar E-bike</span>
        </button>
      </div>

      {/* BANNER DE RESUMO DE NOTA (MANTIDO NOS COMENTÁRIOS) */}
      <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="bg-amber-400 border-2 border-stone-900 rounded-2xl px-4 py-2 text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] shrink-0">
            <span className="text-3xl font-mono font-black">
              {averageRating > 0 ? averageRating.toFixed(1) : '0'}
            </span>
            <span className="text-xs font-bold font-mono text-stone-800"> / 5</span>
          </div>
          <div>
            <div className="flex gap-1.5 justify-center sm:justify-start mb-1 items-center">
              {[1, 2, 3, 4, 5].map((s) => {
                const isFilled = averageRating >= s;
                const isHalf = !isFilled && averageRating >= s - 0.5;
                return (
                  <div key={s} className="relative w-4 h-4 flex items-center justify-center">
                    <Star className="w-4 h-4 text-stone-300 transition-colors" />
                    {isFilled && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500 absolute inset-0 transition-colors" />
                    )}
                    {isHalf && (
                      <div className="absolute inset-0 overflow-hidden w-[50%]">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs font-mono font-black text-stone-900 uppercase tracking-wide">
              {reviewsList.length === 0
                ? '0 Avaliações Registradas'
                : `${reviewsList.length} ${reviewsList.length === 1 ? 'Avaliação Auditada' : 'Avaliações Auditadas'} no Total`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="text-xs font-bold text-stone-900 bg-white border-2 border-stone-900 px-4 py-2 rounded-xl hover:bg-stone-100 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer select-none"
        >
          Escrever Novo Comentário
        </button>
      </div>

      {/* Barra de Filtros e Ordenação */}
      <div className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black uppercase text-stone-600 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Relevo:
          </span>
          <button
            type="button"
            onClick={() => setFilterTerrain('todos')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              filterTerrain === 'todos'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-900'
            }`}
          >
            Todos ({reviewsList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTerrain('plano')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              filterTerrain === 'plano'
                ? 'bg-emerald-600 text-white border-emerald-900'
                : 'bg-white text-stone-700 border-stone-300 hover:border-emerald-600'
            }`}
          >
            Plano
          </button>
          <button
            type="button"
            onClick={() => setFilterTerrain('misto')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              filterTerrain === 'misto'
                ? 'bg-amber-400 text-stone-900 border-stone-900 font-black'
                : 'bg-white text-stone-700 border-stone-300 hover:border-amber-500'
            }`}
          >
            Misto
          </button>
          <button
            type="button"
            onClick={() => setFilterTerrain('íngreme')}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
              filterTerrain === 'íngreme'
                ? 'bg-rose-600 text-white border-rose-900'
                : 'bg-white text-stone-700 border-stone-300 hover:border-rose-600'
            }`}
          >
            Ladeiras
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" /> Ordenar:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border-2 border-stone-900 rounded-lg px-2 py-1 text-[11px] font-bold text-stone-900 focus:outline-hidden"
          >
            <option value="recentes">Mais recentes</option>
            <option value="uteis">Mais úteis</option>
            <option value="autonomia">Maior autonomia</option>
          </select>
        </div>
      </div>

      {/* Lista de Comentários */}
      <div className="flex flex-col gap-4">
        {reviewsList.length === 0 ? (
          <div className="bg-stone-50 border-2 border-stone-900 border-dashed rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center gap-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
            <div className="p-4 bg-amber-100 border-2 border-stone-900 rounded-2xl text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h4 className="font-black text-stone-900 text-base sm:text-lg uppercase tracking-tight">
                Seja o Primeiro a Avaliar a {bikeModelo}!
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 font-medium">
                Ainda não há relatos cadastrados para este modelo. Já pedalou ou possui esta e-bike? Compartilhe sua experiência real e ajude a comunidade de ciclistas do Brasil.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 bg-amber-400 hover:bg-amber-300 border-2 border-stone-900 text-stone-900 font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all select-none mt-1"
            >
              <Plus className="w-4 h-4" />
              <span>Enviar Avaliação</span>
            </button>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-stone-50 border-2 border-stone-300 rounded-2xl p-8 text-center text-stone-600 space-y-2">
            <p className="text-sm font-bold">Nenhum relato encontrado para o filtro de relevo selecionado.</p>
            <button
              type="button"
              onClick={() => setFilterTerrain('todos')}
              className="text-xs font-bold text-emerald-700 underline cursor-pointer"
            >
              Ver todos os relatos ({reviewsList.length})
            </button>
          </div>
        ) : (
          filteredReviews.map((rev) => {
            const votes = (rev.helpfulCount || 0) + (helpfulVotes[rev.id] || 0);
            const isVoted = votedReviews[rev.id];

            return (
              <article
                key={rev.id}
                className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-5 sm:p-6 flex flex-col gap-3.5 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] text-xs"
              >
                {/* Linha 1: Autor, Cidade e Selo de Proprietário */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-stone-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-stone-500" />
                      {rev.author}
                    </span>

                    {rev.city && (
                      <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        {rev.city}
                      </span>
                    )}

                    {rev.verified && (
                      <span className="bg-emerald-100 text-emerald-900 text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-300">
                        <ShieldCheck className="w-3 h-3" /> Proprietário Verificado
                      </span>
                    )}

                    {rev.timeUsing && (
                      <span className="bg-stone-200 text-stone-700 text-[9px] font-bold px-2 py-0.5 rounded-md">
                        {rev.timeUsing}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-stone-500 font-bold" suppressHydrationWarning>
                    {new Date(rev.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>

                {/* Linha 2: Destaque da Autonomia Real Medida */}
                {rev.realRangeKm ? (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                        <BatteryCharging className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-emerald-950">
                          Autonomia Real: {rev.realRangeKm} km por carga
                        </span>
                        {rev.advertisedRangeKm && (
                          <span className="text-[10px] text-emerald-800 block">
                            (Catálogo de fábrica: {rev.advertisedRangeKm} km • rendimento de {Math.round((rev.realRangeKm / rev.advertisedRangeKm) * 100)}%)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                      {rev.terrain && (
                        <span className="bg-white border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded-md">
                          Relevo: {rev.terrain === 'plano' ? '100% Plano' : rev.terrain === 'misto' ? 'Misto' : 'Muitas Ladeiras'}
                        </span>
                      )}
                      {rev.userWeightKg && (
                        <span className="bg-white border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded-md">
                          Ciclista: {rev.userWeightKg} kg
                        </span>
                      )}
                      {rev.assistanceModeUsed && (
                        <span className="bg-white border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded-md">
                          Modo: {rev.assistanceModeUsed}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Estrelas */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < rev.rating
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-stone-300'
                      }`}
                    />
                  ))}
                </div>

                {/* Título e Relato */}
                <div>
                  <h4 className="font-black text-sm text-stone-900 mb-1">{rev.title}</h4>
                  <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-normal whitespace-pre-line">
                    {rev.comment}
                  </p>
                </div>

                {/* Subcritérios do Relato */}
                {rev.criteria && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-medium text-stone-600 bg-white/70 p-2.5 rounded-xl border border-stone-200">
                    <div>🔋 Bateria: <strong>{rev.criteria.batteryAutonomy}/5</strong></div>
                    <div>⚡ Motor: <strong>{rev.criteria.motorPower}/5</strong></div>
                    <div>🛋️ Conforto: <strong>{rev.criteria.comfort}/5</strong></div>
                    <div>🔧 Confiabilidade: <strong>{rev.criteria.reliability}/5</strong></div>
                  </div>
                )}

                {/* Botão de Avaliação Útil */}
                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => handleHelpful(rev.id)}
                    disabled={isVoted}
                    className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isVoted
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-stone-900 border-stone-900 hover:bg-stone-100 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px]'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{isVoted ? '✓ Marcado como Útil' : `Útil (${votes})`}</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Modal de Avaliação */}
      <AddReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bikeSlug={bikeSlug}
        bikeModelo={bikeModelo}
        advertisedRangeKm={advertisedRangeKm}
        onReviewAdded={handleNewReviewAdded}
      />
    </section>
  );
}
