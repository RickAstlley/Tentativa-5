'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import FirebaseStatusWidget from '@/components/admin/FirebaseStatusWidget';
import { Article } from '@/types/article';
import { formatArticleDate, fetchArticlesFromFirestore, getAllArticles } from '@/lib/articles';
import { fetchAdminJson } from '@/lib/apiResponse';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Tag,
  ArrowLeft,
  X,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function AdminArticlesListPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de confirmação de exclusão
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchArticles = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchArticlesFromFirestore();
      setArticles(list);
    } catch (error) {
      console.error('Erro ao buscar artigos:', error);
      setArticles(getAllArticles());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCheckingAuth(false);
    fetchArticles();
  }, [fetchArticles]);

  const handleDeleteArticle = async () => {
    if (!articleToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Remover do servidor via API (Autoritativo e Seguro com headers de Admin)
      const apiResult = await fetchAdminJson(`/api/articles?slug=${encodeURIComponent(articleToDelete.slug)}`, {
        method: 'DELETE',
      });
      
      if (!apiResult.ok) {
        throw new Error(apiResult.error || 'Erro na resposta do servidor ao deletar artigo.');
      }

      // 2. Remover do localStorage (Cache Local de Contingência)
      try {
        const rawLocal = localStorage.getItem('tuavia_published_articles_v1');
        if (rawLocal) {
          const list = JSON.parse(rawLocal);
          const filtered = list.filter((a: any) => a.slug !== articleToDelete.slug);
          localStorage.setItem('tuavia_published_articles_v1', JSON.stringify(filtered));
        }
      } catch (localErr) {
        console.warn('Erro ao deletar do localStorage:', localErr);
      }

      // Atualiza o estado visual instantaneamente e fecha o modal de forma limpa
      setArticles((prev) => prev.filter((a) => a.slug !== articleToDelete.slug));
      showToast(`Artigo "${articleToDelete.title}" removido com sucesso!`);
      setArticleToDelete(null);
    } catch (error: any) {
      console.error('Erro ao apagar artigo via API:', error);
      
      // Fallback amigável: se a API falhar mas o usuário quiser forçar a remoção visual no cache do navegador
      const confirmForce = confirm(
        `Erro ao deletar do servidor: ${error.message || 'Conexão rejeitada'}.\n\nDeseja forçar a remoção visual no seu navegador?`
      );
      if (confirmForce) {
        setArticles((prev) => prev.filter((a) => a.slug !== articleToDelete.slug));
        setArticleToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredArticles = articles.filter((art) => {
    const query = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(query) ||
      art.category.toLowerCase().includes(query) ||
      art.excerpt.toLowerCase().includes(query) ||
      art.slug.toLowerCase().includes(query)
    );
  });

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="font-bold text-stone-900 text-sm">Verificando autenticação...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 sm:pb-36 space-y-6">
        {/* Toast Notificação */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-5 py-3.5 rounded-xl border-2 border-emerald-500 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] flex items-center gap-3 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </div>
        )}

        {/* Header da Seção */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="text-stone-500 hover:text-stone-900 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Painel
              </Link>
              <span className="text-stone-300">/</span>
              <span className="text-indigo-800 font-bold text-xs bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                Hub de Artigos
              </span>
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-indigo-600" />
              Gerenciamento de Artigos
            </h1>
            <p className="text-stone-600 text-xs font-medium">
              Listagem e publicação de guias de compra, análises técnicas e dicas de legislação no portal TuaVia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/artigos/novo"
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Novo Artigo</span>
            </Link>
          </div>
        </div>


        {/* Widget de Status de Conexão Firebase */}
        <FirebaseStatusWidget onSyncComplete={fetchArticles} />

        {/* Barra de Filtro e Busca */}
        <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por título, categoria ou palavra-chave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-stone-600 self-end sm:self-auto">
            <span>Total:</span>
            <span className="bg-stone-900 text-indigo-400 px-2.5 py-1 rounded-lg font-mono">
              {filteredArticles.length} {filteredArticles.length === 1 ? 'artigo' : 'artigos'}
            </span>
          </div>
        </div>

        {/* Tabela de Listagem */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-stone-600 text-xs font-bold">Carregando artigos do Firestore...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="py-16 text-center space-y-4 px-4">
              <div className="w-12 h-12 bg-indigo-100 border-2 border-stone-900 rounded-xl flex items-center justify-center text-indigo-800 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-black text-stone-900 text-base">Nenhum artigo encontrado</h3>
              <p className="text-stone-600 text-xs font-medium max-w-sm mx-auto">
                {searchQuery
                  ? 'Nenhum artigo corresponde aos termos pesquisados.'
                  : 'Ainda não há artigos cadastrados no Firestore. Clique em "+ Novo Artigo" para publicar o primeiro.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Limpar busca
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/admin/artigos/novo"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-lg border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Artigo
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-900 text-white text-[11px] uppercase tracking-wider font-mono border-b-2 border-stone-900">
                    <th className="py-3.5 px-4 font-bold">Título & Capa</th>
                    <th className="py-3.5 px-4 font-bold">Categoria</th>
                    <th className="py-3.5 px-4 font-bold">Publicação</th>
                    <th className="py-3.5 px-4 font-bold">Tempo Leitura</th>
                    <th className="py-3.5 px-4 font-bold">Bikes Relacionadas</th>
                    <th className="py-3.5 px-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-xs font-medium text-stone-900">
                  {filteredArticles.map((art) => (
                    <tr
                      key={art.slug}
                      className="hover:bg-stone-50/80 transition-colors group"
                    >
                      {/* Título, Capa e Excerpt */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-lg bg-stone-100 border border-stone-300 relative overflow-hidden shrink-0 flex items-center justify-center">
                            {art.coverImage ? (
                              <SafeImage
                                src={art.coverImage}
                                alt={art.title}
                                fill
                                className="object-cover"
                                fallbackSrc="https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80"
                              />
                            ) : (
                              <FileText className="w-6 h-6 text-stone-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-stone-900 text-sm group-hover:text-indigo-600 transition-colors truncate">
                              {art.title}
                            </div>
                            <div className="text-stone-500 text-[11px] font-mono truncate">
                              /artigos/{art.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-300 px-2.5 py-1 rounded-full font-bold text-[11px]">
                          <Tag className="w-3 h-3 text-indigo-600" />
                          {art.category}
                        </span>
                      </td>

                      {/* Data de Publicação */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1 text-stone-800 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatArticleDate(art.publishedAt, 'short')}</span>
                        </div>
                      </td>

                      {/* Tempo de Leitura */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1 text-stone-700">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>{art.readingTimeMinutes} min</span>
                        </div>
                      </td>

                      {/* Categorias de Bike Relacionadas */}
                      <td className="py-3.5 px-4">
                        {art.relatedBikeCategories && art.relatedBikeCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {art.relatedBikeCategories.map((c) => (
                              <span
                                key={c}
                                className="bg-stone-100 text-stone-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-stone-300"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] font-mono">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/artigos/${art.slug}`}
                            target="_blank"
                            title="Ver no site público"
                            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-300 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          <Link
                            href={`/admin/artigos/${art.slug}/editar`}
                            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-lg border border-stone-900 flex items-center gap-1.5 transition-colors shadow-[2px_2px_0px_0px_rgba(99,102,241,1)]"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Editar</span>
                          </Link>

                          <button
                            onClick={() => setArticleToDelete(art)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Apagar artigo"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span className="hidden sm:inline">Apagar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Confirmação de Exclusão */}
      {articleToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-stone-900 rounded-2xl max-w-md w-full p-6 shadow-[8px_8px_0px_0px_rgba(225,29,72,1)] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 bg-rose-100 border-2 border-rose-600 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-stone-900 leading-tight">Confirmar Exclusão</h3>
                <p className="text-stone-500 text-xs font-bold uppercase tracking-wider">Ação Irreversível</p>
              </div>
            </div>

            <p className="text-stone-700 text-xs font-medium leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200">
              Tem certeza que deseja apagar o artigo <strong className="text-stone-900 font-black">&quot;{articleToDelete.title}&quot;</strong>? Esta ação removerá o documento do Firestore e o artigo deixará de ser exibido no site público.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setArticleToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteArticle}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Apagando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Sim, Apagar
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
