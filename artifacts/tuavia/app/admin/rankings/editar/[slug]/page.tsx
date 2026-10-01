'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { TopRanking, RANKING_STORAGE_KEY } from '@/types/ranking';
import AdminHeader from '@/components/admin/AdminHeader';
import RankingForm from '@/components/admin/RankingForm';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function EditarRankingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [ranking, setRanking] = useState<TopRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchRanking = async () => {
      setLoading(true);
      try {
        let item: TopRanking | null = null;

        // 1. Tentar ler da API Backend
        try {
          const res = await fetch(`/api/rankings?slug=${encodeURIComponent(slug)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.ranking) {
              item = data.ranking as TopRanking;
            }
          }
        } catch (apiErr) {
          console.warn('API offline, tentando Firestore client:', apiErr);
        }

        // 2. Tentar ler do Firestore Client SDK
        if (!item) {
          try {
            const snap = await getDoc(doc(db, 'rankings', slug));
            if (snap.exists()) {
              item = snap.data() as TopRanking;
            }
          } catch (fErr) {
            console.warn('Firestore offline, tentando ler do cache local:', fErr);
          }
        }

        // 3. Se não encontrou, buscar no cache local
        if (!item && typeof window !== 'undefined') {
          const raw = localStorage.getItem(RANKING_STORAGE_KEY);
          if (raw) {
            const list: TopRanking[] = JSON.parse(raw);
            const found = list.find((r) => r.slug === slug);
            if (found) item = found;
          }
        }

        if (item) {
          setRanking(item);
        } else {
          setError('Ranking não encontrado.');
        }
      } catch (err: any) {
        console.error('Erro ao buscar ranking:', err);
        setError('Erro ao carregar os dados do ranking.');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 pb-20">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {loading ? (
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-12 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)]">
            <RefreshCw className="w-8 h-8 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-stone-600 uppercase">Carregando dados do ranking...</p>
          </div>
        ) : error || !ranking ? (
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-8 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
            <h2 className="text-lg font-black text-stone-900">{error || 'Ranking não encontrado'}</h2>
            <button
              type="button"
              onClick={() => router.push('/admin/rankings')}
              className="px-5 py-2.5 bg-stone-900 text-amber-300 font-bold rounded-xl text-xs"
            >
              Voltar para Lista
            </button>
          </div>
        ) : (
          <RankingForm initialData={ranking} isEditing={true} />
        )}
      </main>
    </div>
  );
}
