'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import ArticleForm from '@/components/admin/ArticleForm';
import { Article } from '@/types/article';
import { fetchArticleBySlugFromFirestore, getArticleBySlug } from '@/lib/articles';
import { RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

export default function AdminEditArticlePage() {
  const router = useRouter();
  const routeParams = useParams();
  const rawSlug = (routeParams?.slug as string) || '';
  const slug = decodeURIComponent(rawSlug).trim();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadArticle = useCallback(async () => {
    setLoadingArticle(true);
    setNotFound(false);
    try {
      // Tenta buscar usando a função resiliente que consulta API/Firestore/local com fallbacks e tratamento de erros
      const found = await fetchArticleBySlugFromFirestore(slug);
      if (found) {
        setArticle(found);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      console.warn('Erro ao carregar artigo para edição:', e);
      const local = getArticleBySlug(slug);
      if (local) {
        setArticle(local);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoadingArticle(false);
    }
  }, [slug]);

  useEffect(() => {
    setCheckingAuth(false);
    loadArticle();
  }, [loadArticle]);

  if (checkingAuth || loadingArticle) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="font-bold text-stone-900 text-sm">Carregando dados do artigo...</span>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
        <AdminHeader />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-100 border-2 border-stone-900 rounded-2xl flex items-center justify-center text-rose-600 mx-auto shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-stone-900">Artigo não encontrado</h1>
          <p className="text-stone-600 text-xs font-medium max-w-md mx-auto">
            Não encontramos nenhum artigo com o slug <code className="bg-stone-200 px-1 py-0.5 rounded">{slug}</code> no banco de dados.
          </p>
          <Link
            href="/admin/artigos"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            Voltar para lista de artigos
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <AdminHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ArticleForm initialData={article} isEditing />
      </main>
    </div>
  );
}
