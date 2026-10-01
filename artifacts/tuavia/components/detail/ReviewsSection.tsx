'use client';

import React, { useState, useMemo } from 'react';
import { 
  Star, 
  ShieldCheck, 
  Plus,
  MessageSquare,
  ArrowDown
} from 'lucide-react';
import { EBikeReview } from '@/types/ebike';
import { calculateRealRangeStats } from '@/lib/reviews';
import RealRangeComparisonCard from './RealRangeComparisonCard';
import AddReviewModal from './AddReviewModal';

interface ReviewsSectionProps {
  rating: number;
  reviewCount: number;
  reviews: EBikeReview[];
  helpfulVotes?: Record<string, number>;
  votedReviews?: Record<string, boolean>;
  handleHelpfulClick?: (reviewId: string) => void;
  bikeSlug?: string;
  bikeModelo?: string;
  advertisedRangeKm?: number;
  batteryWh?: number;
  motorWatts?: number;
  onReviewAdded?: (newReview: EBikeReview) => void;
  compact?: boolean;
}

export default function ReviewsSection({
  rating: initialRating,
  reviewCount: initialReviewCount,
  reviews: initialReviews,
  bikeSlug = '',
  bikeModelo = 'E-Bike',
  advertisedRangeKm = 45,
  batteryWh,
  motorWatts,
  onReviewAdded,
  compact = false,
}: ReviewsSectionProps) {
  const [reviewsList, setReviewsList] = useState<EBikeReview[]>(initialReviews || []);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sincroniza se a prop mudar
  React.useEffect(() => {
    if (initialReviews) {
      setReviewsList(initialReviews);
    }
  }, [initialReviews]);

  // Estatísticas de autonomia calculadas a partir das avaliações
  const stats = useMemo(() => {
    return calculateRealRangeStats(reviewsList, advertisedRangeKm);
  }, [reviewsList, advertisedRangeKm]);

  // Média de nota geral dinâmica: padrão 0/5 quando não há avaliações, subindo conforme novos relatos chegam
  const averageRating = useMemo(() => {
    if (!reviewsList || reviewsList.length === 0) return 0;
    const sum = reviewsList.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return Math.round((sum / reviewsList.length) * 10) / 10;
  }, [reviewsList]);

  // Médias por subcritérios (iniciam em 0 quando não há avaliações cadastradas)
  const criteriaAverages = useMemo(() => {
    const listWithCriteria = reviewsList.filter((r) => r.criteria);
    if (listWithCriteria.length === 0) {
      return {
        battery: 0,
        motor: 0,
        comfort: 0,
        reliability: 0,
      };
    }
    const sum = listWithCriteria.reduce(
      (acc, r) => {
        acc.battery += r.criteria?.batteryAutonomy || 0;
        acc.motor += r.criteria?.motorPower || 0;
        acc.comfort += r.criteria?.comfort || 0;
        acc.reliability += r.criteria?.reliability || 0;
        return acc;
      },
      { battery: 0, motor: 0, comfort: 0, reliability: 0 }
    );
    const count = listWithCriteria.length;
    return {
      battery: Math.round((sum.battery / count) * 10) / 10,
      motor: Math.round((sum.motor / count) * 10) / 10,
      comfort: Math.round((sum.comfort / count) * 10) / 10,
      reliability: Math.round((sum.reliability / count) * 10) / 10,
    };
  }, [reviewsList]);

  const scrollToComments = () => {
    const el = document.getElementById('comentarios-comunidade');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
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
      id="secao-avaliacoes-comunidade" 
      aria-label="Avaliações e Autonomia na Vida Real"
      className={`bg-white border-2 border-stone-900 ${
        compact 
          ? 'rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(28,25,23,1)] gap-5 mt-0' 
          : 'rounded-3xl p-5 sm:p-8 shadow-[4px_4px_0_0_rgba(28,25,23,1)] gap-8 mt-6'
      } flex flex-col`}
    >
      {/* Cabeçalho da Seção */}
      <div className={`border-b-2 border-stone-100 pb-4 flex flex-col ${compact ? 'gap-3' : 'sm:flex-row sm:items-center justify-between gap-4'}`}>
        <div>
          <h3 className={`font-black text-stone-900 uppercase tracking-tight ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            Avaliações e Autonomia na Prática
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 font-medium max-w-2xl leading-relaxed">
            Relatos auditados de quem pedala diariamente com este modelo, medindo a vida útil real da carga em condições autênticas do trânsito brasileiro.
          </p>
        </div>

        <div className={`flex flex-wrap items-center gap-2 ${compact ? 'w-full' : 'self-start sm:self-auto shrink-0'}`}>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-amber-400 hover:bg-amber-300 border-2 border-stone-900 text-stone-900 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
          >
            <Plus className="w-4 h-4" />
            <span>Avaliar E-bike</span>
          </button>

          {/* BOTÃO ESTILO FILTRO DA HOME PARA NAVEGAÇÃO RÁPIDA DE SCROLL ATÉ OS COMENTÁRIOS */}
          <button
            type="button"
            onClick={scrollToComments}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white border-2 border-stone-900 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Comentários ({reviewsList.length})</span>
            <ArrowDown className="w-3 h-3 text-amber-400" />
          </button>
        </div>
      </div>

      {/* PAINEL COMPARATIVO 1: Autonomia Anunciada de Fábrica vs. Vida Real */}
      <RealRangeComparisonCard
        stats={stats}
        bikeModelo={bikeModelo}
        onOpenReviewModal={() => setIsModalOpen(true)}
        batteryWh={batteryWh}
        motorWatts={motorWatts}
        compact={compact}
      />

      {/* Grid: Resumo das Notas & Botão de Rolagem Rápida */}
      <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-12 gap-6'} items-stretch`}>
        {/* Painel: Resumo Estatístico das Notas */}
        <div className={`${compact ? 'w-full' : 'md:col-span-5'} bg-stone-50 border-2 border-stone-900 rounded-2xl p-4 sm:p-5 flex flex-col items-center text-center shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]`}>
          <span className="text-4xl sm:text-5xl font-mono font-black text-stone-900">
            {averageRating > 0 ? averageRating.toFixed(1) : '0'} <span className="text-2xl text-stone-400 font-semibold">/ 5</span>
          </span>
          
          <div className="flex gap-1.5 my-2.5 items-center justify-center">
            {[1, 2, 3, 4, 5].map((s) => {
              const isFilled = averageRating >= s;
              const isHalf = !isFilled && averageRating >= s - 0.5;
              return (
                <div key={s} className="relative w-5 h-5 flex items-center justify-center">
                  <Star className="w-5 h-5 text-stone-300 transition-colors" />
                  {isFilled && (
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500 absolute inset-0 transition-colors" />
                  )}
                  {isHalf && (
                    <div className="absolute inset-0 overflow-hidden w-[50%]">
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <span className="text-xs text-stone-700 font-bold uppercase font-mono tracking-wider">
            {reviewsList.length === 0
              ? '0 Avaliações Registradas'
              : `${reviewsList.length} ${reviewsList.length === 1 ? 'Avaliação Auditada' : 'Avaliações Auditadas'}`}
          </span>

          {/* Médias por Subcritérios */}
          <div className="w-full flex flex-col gap-2.5 mt-5 border-t-2 border-stone-200 pt-3.5 text-left">
            {/* Autonomia */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between font-bold text-stone-800">
                <span>🔋 Autonomia</span>
                <span className="font-mono font-black">{criteriaAverages.battery > 0 ? `${criteriaAverages.battery}/5` : '0/5'}</span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(criteriaAverages.battery / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Potência */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between font-bold text-stone-800">
                <span>⚡ Força Subidas</span>
                <span className="font-mono font-black">{criteriaAverages.motor > 0 ? `${criteriaAverages.motor}/5` : '0/5'}</span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(criteriaAverages.motor / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Conforto */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between font-bold text-stone-800">
                <span>🛋️ Conforto</span>
                <span className="font-mono font-black">{criteriaAverages.comfort > 0 ? `${criteriaAverages.comfort}/5` : '0/5'}</span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="bg-stone-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(criteriaAverages.comfort / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Confiabilidade */}
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex justify-between font-bold text-stone-800">
                <span>🔧 Confiabilidade</span>
                <span className="font-mono font-black">{criteriaAverages.reliability > 0 ? `${criteriaAverages.reliability}/5` : '0/5'}</span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="bg-stone-700 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(criteriaAverages.reliability / 5) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Painel: Card Chamada para Ler os Comentários */}
        <div className={`${compact ? 'w-full' : 'md:col-span-7'} bg-amber-50 border-2 border-stone-900 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]`}>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-400 border-2 border-stone-900 px-2.5 py-0.5 rounded-lg text-xs font-mono font-black text-stone-900 uppercase tracking-wide">
              <MessageSquare className="w-3.5 h-3.5" /> Relatos em Detalhes
            </div>

            <h4 className="font-black text-stone-900 text-base sm:text-lg uppercase tracking-tight">
              O que outros ciclistas dizem sobre a {bikeModelo}?
            </h4>

            <p className="text-xs text-stone-700 leading-relaxed font-medium">
              Confira a lista completa com relatos individuais de proprietários, dados de terreno e utilidade dos relatos cadastrados.
            </p>
          </div>

          <div className="pt-1">
            {/* BOTÃO ESTILO FILTRO DA HOME */}
            <button
              type="button"
              onClick={scrollToComments}
              className={`w-full ${compact ? 'py-3 px-4 text-xs' : 'py-4 px-6 text-sm'} bg-amber-400 hover:bg-amber-300 text-stone-900 border-2 border-stone-900 font-mono font-black rounded-xl shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ver {reviewsList.length} {reviewsList.length === 1 ? 'Comentário' : 'Comentários'}</span>
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>
        </div>
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

