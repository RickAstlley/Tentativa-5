'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { EBikeReview, RealRangeCommunityStats } from '@/types/ebike';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import {
  MessageSquare,
  Trash2,
  Star,
  BatteryCharging,
  Gauge,
  User,
  MapPin,
  Calendar,
  ThumbsUp,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface BikeReviewsManagerProps {
  bikeSlug: string;
  bikeName?: string;
  autonomiaKm?: number;
  potenciaW?: number;
}

export default function BikeReviewsManager({
  bikeSlug,
  bikeName,
  autonomiaKm = 45,
  potenciaW = 350,
}: BikeReviewsManagerProps) {
  const [reviews, setReviews] = useState<EBikeReview[]>([]);
  const [stats, setStats] = useState<RealRangeCommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal de confirmação de exclusão
  const [reviewToDelete, setReviewToDelete] = useState<EBikeReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!bikeSlug) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = `/api/reviews?slug=${encodeURIComponent(bikeSlug)}&autonomiaKm=${autonomiaKm}&potenciaW=${potenciaW}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setReviews(data.reviews || []);
        setStats(data.stats || null);
      } else {
        setErrorMsg(data.error || 'Erro ao carregar avaliações.');
      }
    } catch (err: any) {
      console.error('Erro ao carregar comentários da bike:', err);
      setErrorMsg('Falha de comunicação com o servidor ao carregar avaliações.');
    } finally {
      setLoading(false);
    }
  }, [bikeSlug, autonomiaKm, potenciaW]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  const handleConfirmDelete = async () => {
    if (!reviewToDelete) return;
    setIsDeleting(true);

    try {
      // Chama a rota de exclusão com autenticação segura de administrador
      const result = await fetchAdminJson<{ success: boolean; error?: string }>(
        `/api/reviews?reviewId=${encodeURIComponent(reviewToDelete.id)}`,
        {
          method: 'DELETE',
        }
      );

      if (!result.ok) {
        throw new Error(result.error || 'Falha ao excluir o comentário.');
      }

      // Remove instantaneamente da interface
      setReviews((prev) => prev.filter((r) => r.id !== reviewToDelete.id));

      // Limpa também do storage de reviews da comunidade no cliente se presente
      try {
        const localKey = 'tuavia_community_reviews_v1';
        const rawLocal = localStorage.getItem(localKey);
        if (rawLocal) {
          const list = JSON.parse(rawLocal);
          const filtered = list.filter((r: any) => r.id !== reviewToDelete.id);
          localStorage.setItem(localKey, JSON.stringify(filtered));
        }
      } catch (lErr) {
        console.warn('Erro ao atualizar cache local do browser:', lErr);
      }

      showToast(`Comentário de "${reviewToDelete.author}" apagado com sucesso!`);
      setReviewToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir avaliação:', err);
      alert(err.message || 'Erro ao tentar apagar o comentário.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="bike-reviews-manager-section" className="space-y-6 pt-4">
      {/* Toast Informativo */}
      {toastMsg && (
        <div
          id="reviews-toast-notification"
          className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex items-center gap-2 animate-bounce"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header da Seção */}
      <div className="bg-stone-900 text-white border-2 border-stone-900 rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-400 text-stone-900 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </span>
            <span className="text-amber-400 font-mono text-[11px] font-bold uppercase tracking-wider">
              Moderação & Gerenciamento
            </span>
          </div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            Comentários e Avaliações da Comunidade
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Visualize relatos reais deixados por ciclistas sobre{' '}
            <strong className="text-stone-200">{bikeName || bikeSlug}</strong> e exclua spam, ofensas ou relatos inválidos.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadReviews()}
            disabled={loading}
            className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-stone-700 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            title="Atualizar lista de comentários"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Atualizar</span>
          </button>
          <span className="text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1.5 rounded-xl">
            {reviews.length} {reviews.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>
      </div>

      {/* Mini-dashboard de estatísticas da comunidade */}
      {stats && reviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border-2 border-stone-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
            <span className="text-[10px] font-black uppercase text-stone-500 block">Total de Relatos</span>
            <div className="text-xl font-black text-stone-900 mt-0.5">{reviews.length}</div>
            <span className="text-[10px] text-stone-500">publicados</span>
          </div>

          <div className="bg-white border-2 border-stone-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
            <span className="text-[10px] font-black uppercase text-stone-500 block">Autonomia Média Real</span>
            <div className="text-xl font-black text-emerald-600 mt-0.5 flex items-center gap-1">
              <BatteryCharging className="w-4 h-4 text-emerald-600" />
              <span>{stats.averageRealKm} km</span>
            </div>
            <span className="text-[10px] text-stone-500">anunciada: {stats.advertisedKm} km</span>
          </div>

          <div className="bg-white border-2 border-stone-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
            <span className="text-[10px] font-black uppercase text-stone-500 block">Precisão Relatada</span>
            <div className="text-xl font-black text-amber-600 mt-0.5 flex items-center gap-1">
              <Gauge className="w-4 h-4 text-amber-600" />
              <span>{stats.accuracyPercent}%</span>
            </div>
            <span className="text-[10px] text-stone-500">da promessa de fábrica</span>
          </div>

          <div className="bg-white border-2 border-stone-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
            <span className="text-[10px] font-black uppercase text-stone-500 block">Nota Média</span>
            <div className="text-xl font-black text-stone-900 mt-0.5 flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>
                {reviews.length > 0
                  ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1)
                  : '—'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500">escala de 1 a 5</span>
          </div>
        </div>
      )}

      {/* Feedback de Carregamento */}
      {loading && (
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-8 text-center shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
            <p className="text-xs font-bold text-stone-700">Carregando comentários da e-bike...</p>
          </div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {!loading && errorMsg && (
        <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lista Vazia */}
      {!loading && !errorMsg && reviews.length === 0 && (
        <div className="bg-white border-2 border-dashed border-stone-300 rounded-2xl p-10 text-center space-y-2">
          <div className="w-12 h-12 bg-stone-100 rounded-2xl border-2 border-stone-200 flex items-center justify-center text-stone-400 mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-stone-900">Nenhum comentário enviado para esta e-bike</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Esta e-bike ainda não recebeu relatos ou comentários da comunidade na página pública de detalhes.
            Novos envios de ciclistas aparecerão listados aqui automaticamente.
          </p>
        </div>
      )}

      {/* Lista de Comentários */}
      {!loading && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              id={`admin-review-card-${rev.id}`}
              className="bg-white border-2 border-stone-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] hover:border-stone-800 transition-all space-y-3 relative group"
            >
              {/* Barra Superior do Card */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-stone-900 text-white font-black text-xs flex items-center justify-center border border-stone-900 uppercase">
                    {rev.author?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-stone-900">{rev.author}</span>
                      {rev.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Verificado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 font-medium mt-0.5">
                      {rev.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          {rev.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        {rev.date}
                      </span>
                      {rev.timeUsing && (
                        <span className="bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded text-[10px]">
                          Uso: {rev.timeUsing}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Estrelas e Botão de Excluir */}
                <div className="flex items-center gap-3">
                  {/* Estrelas */}
                  <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= (rev.rating || 5)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-xs font-black text-amber-950">{rev.rating || 5}.0</span>
                  </div>

                  {/* Botão de Excluir */}
                  <button
                    type="button"
                    onClick={() => setReviewToDelete(rev)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border-2 border-rose-300 hover:border-rose-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:translate-y-0.5"
                    title="Apagar este comentário"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Apagar</span>
                  </button>
                </div>
              </div>

              {/* Título e Texto do Comentário */}
              <div className="space-y-1">
                {rev.title && (
                  <h4 className="text-sm font-black text-stone-900 leading-snug">
                    {rev.title}
                  </h4>
                )}
                <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
                  {rev.comment}
                </p>
              </div>

              {/* Tags de Telemetria e Relevo */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {rev.realRangeKm !== undefined && rev.realRangeKm !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                    Autonomia real: <span className="font-black text-emerald-950">{rev.realRangeKm} km</span>
                  </span>
                )}

                {rev.terrain && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-[11px] font-medium border border-stone-200">
                    Relevo: <strong className="capitalize">{rev.terrain}</strong>
                  </span>
                )}

                {rev.userWeightKg && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-[11px] font-medium border border-stone-200">
                    Peso: <strong>{rev.userWeightKg} kg</strong>
                  </span>
                )}

                {rev.assistanceModeUsed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md text-[11px] font-medium border border-stone-200">
                    Assistência: <strong>{rev.assistanceModeUsed}</strong>
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2 text-[11px] text-stone-500 font-mono">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-stone-400" />
                    {rev.helpfulCount || 0} votos úteis
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-[10px] text-stone-400">ID: {rev.id}</span>
                </div>
              </div>

              {/* Critérios Específicos se existirem */}
              {rev.criteria && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-stone-100 text-[11px]">
                  {rev.criteria.batteryAutonomy && (
                    <div className="text-stone-600">
                      Bateria: <strong className="text-stone-900">{rev.criteria.batteryAutonomy}/5</strong>
                    </div>
                  )}
                  {rev.criteria.motorPower && (
                    <div className="text-stone-600">
                      Motor: <strong className="text-stone-900">{rev.criteria.motorPower}/5</strong>
                    </div>
                  )}
                  {rev.criteria.comfort && (
                    <div className="text-stone-600">
                      Conforto: <strong className="text-stone-900">{rev.criteria.comfort}/5</strong>
                    </div>
                  )}
                  {rev.criteria.reliability && (
                    <div className="text-stone-600">
                      Construção: <strong className="text-stone-900">{rev.criteria.reliability}/5</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {reviewToDelete && (
        <div
          id="confirm-delete-review-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border-3 border-stone-900 rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
                <div className="p-2 bg-rose-100 rounded-xl border border-rose-300">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <span>Confirmar Exclusão</span>
              </div>
              <button
                type="button"
                onClick={() => !isDeleting && setReviewToDelete(null)}
                className="text-stone-400 hover:text-stone-900 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-stone-700 leading-relaxed font-medium">
                Tem certeza que deseja apagar permanentemente este comentário de{' '}
                <strong className="text-stone-900">&ldquo;{reviewToDelete.author}&rdquo;</strong>?
              </p>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 italic">
                &ldquo;{reviewToDelete.comment.slice(0, 160)}
                {reviewToDelete.comment.length > 160 ? '...' : ''}&rdquo;
              </div>
              <p className="text-[11px] text-rose-700 font-bold">
                ⚠️ Esta ação não pode ser desfeita. O comentário será removido do banco de dados e as métricas da e-bike serão recalculadas.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setReviewToDelete(null)}
                className="px-4 py-2.5 bg-white border-2 border-stone-900 rounded-xl font-bold text-xs text-stone-800 hover:bg-stone-50 cursor-pointer shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex items-center gap-2 cursor-pointer disabled:opacity-60 active:translate-y-0.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Apagando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Apagar Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
