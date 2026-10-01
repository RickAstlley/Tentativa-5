'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RankingComment } from '@/types/ranking';
import { MessageSquare, Send, Heart, User, MapPin, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface RankingCommentsSectionProps {
  rankingSlug: string;
  rankingTitle: string;
}

export default function RankingCommentsSection({
  rankingSlug,
  rankingTitle,
}: RankingCommentsSectionProps) {
  const [comments, setComments] = useState<RankingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autor, setAutor] = useState('');
  const [cidade, setCidade] = useState('');
  const [texto, setTexto] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const fetchComments = useCallback(async () => {
    if (!rankingSlug) return;
    try {
      const res = await fetch(`/api/rankings/comments?slug=${encodeURIComponent(rankingSlug)}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          setComments(data.comments);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar comentários:', err);
    } finally {
      setLoading(false);
    }
  }, [rankingSlug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!autor.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, digite seu nome.' });
      return;
    }
    if (!texto.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, escreva seu comentário ou dúvida.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rankings/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankingSlug,
          autor: autor.trim(),
          cidade: cidade.trim() || undefined,
          texto: texto.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao enviar comentário.');
      }

      setFeedback({ type: 'success', message: 'Comentário publicado com sucesso!' });
      setTexto('');
      setAutor('');
      setCidade('');
      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
      } else {
        fetchComments();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao enviar comentário.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (likedMap[commentId]) return;

    setLikedMap((prev) => ({ ...prev, [commentId]: true }));
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c))
    );

    try {
      await fetch('/api/rankings/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, rankingSlug }),
      });
    } catch (err) {
      console.warn('Erro ao curtir comentário:', err);
    }
  };

  return (
    <section
      id="ranking-comments-section"
      className="bg-white border-2 border-stone-900 rounded-3xl p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] space-y-8"
    >
      {/* Cabeçalho da Seção de Comentários */}
      <div className="border-b-2 border-stone-100 pb-6 space-y-2">
        <div className="flex items-center gap-2 text-xs font-black text-amber-600 uppercase tracking-widest">
          <MessageSquare className="w-4 h-4" />
          <span>Comunidade & Perguntas</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-black text-stone-900">
          Comentários e Dúvidas ({comments.length})
        </h3>
        <p className="text-xs sm:text-sm text-stone-600 font-medium">
          Dúvidas técnicas ou experiências reais com as e-bikes deste ranking? Compartilhe com a nossa comunidade de mobilidade elétrica.
        </p>
      </div>

      {/* Formulário para Novo Comentário */}
      <form onSubmit={handleSubmit} className="bg-stone-50 border-2 border-stone-900 rounded-2xl p-5 sm:p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
        <h4 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
          <span>Deixe seu comentário ou dúvida</span>
        </h4>

        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
              Seu Nome *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Ex: Carlos Mendes"
                required
                maxLength={60}
                className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-stone-300 focus:border-stone-900 rounded-xl text-xs font-medium text-stone-900 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
              Cidade / Estado (Opcional)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: Curitiba / PR"
                maxLength={40}
                className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-stone-300 focus:border-stone-900 rounded-xl text-xs font-medium text-stone-900 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
            Comentário ou Dúvida Técnica *
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qual modelo você achou mais interessante? Quer saber sobre subidas, manutenção ou bateria de algum deles?"
            rows={3}
            required
            maxLength={1000}
            className="w-full p-3 bg-white border-2 border-stone-300 focus:border-stone-900 rounded-xl text-xs font-medium text-stone-900 outline-none transition-colors resize-y"
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-stone-900 font-black rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] transition-all text-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Enviando...' : 'Publicar Comentário'}</span>
          </button>
        </div>
      </form>

      {/* Lista de Comentários */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-stone-500">
            Carregando comentários da comunidade...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-8 bg-stone-50 border-2 border-dashed border-stone-300 rounded-2xl text-center space-y-2">
            <MessageSquare className="w-8 h-8 text-stone-400 mx-auto" />
            <p className="text-xs font-black text-stone-800 uppercase tracking-wider">
              Nenhum comentário ainda
            </p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Seja o primeiro a enviar uma dúvida ou sugestão sobre os modelos avaliados neste ranking!
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isLiked = likedMap[comment.id];
            const dateFormatted = new Date(comment.data).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={comment.id}
                className="p-5 bg-stone-50 border border-stone-200 hover:border-stone-400 rounded-2xl space-y-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-200 border-2 border-stone-900 flex items-center justify-center font-black text-xs text-stone-900 shrink-0">
                      {comment.autor.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-stone-900 leading-none">
                        {comment.autor}
                      </h5>
                      {comment.cidade && (
                        <span className="text-[10px] font-bold text-stone-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          {comment.cidade}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400">
                    <Calendar className="w-3 h-3" />
                    <span>{dateFormatted}</span>
                  </div>
                </div>

                <p className="text-xs text-stone-700 font-medium leading-relaxed whitespace-pre-wrap pl-12">
                  {comment.texto}
                </p>

                <div className="flex items-center justify-end pt-1 border-t border-stone-200/60">
                  <button
                    type="button"
                    onClick={() => handleLike(comment.id)}
                    disabled={isLiked}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-white hover:bg-rose-50 text-stone-600 hover:text-rose-600 border border-stone-200'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{comment.likes || 0}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
