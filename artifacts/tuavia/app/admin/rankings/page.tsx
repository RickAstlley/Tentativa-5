'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { TopRanking, RANKING_STORAGE_KEY } from '@/types/ranking';
import { fetchAdminJson } from '@/lib/apiResponse';
import AdminHeader from '@/components/admin/AdminHeader';
import {
  Trophy,
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  Award,
  Search,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function RankingsAdminPage() {
  const [rankings, setRankings] = useState<TopRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const map = new Map<string, TopRanking>();

      // 1. Tentar ler da API Backend (/api/rankings com Firestore Admin)
      try {
        const res = await fetch('/api/rankings');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.rankings)) {
            data.rankings.forEach((r: TopRanking) => map.set(r.slug, r));
          }
        }
      } catch (apiErr) {
        console.warn('API de rankings offline ou falhou, tentando fallback:', apiErr);
      }

      // 2. Tentar ler do Firestore Client SDK
      try {
        const snap = await getDocs(collection(db, 'rankings'));
        snap.docs.forEach((d) => {
          const r = d.data() as TopRanking;
          if (r?.slug) map.set(r.slug, r);
        });
      } catch (fErr) {
        console.warn('Firestore client offline, tentando ler do localStorage:', fErr);
      }

      // 3. Mesclar com cache local
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(RANKING_STORAGE_KEY);
          if (raw) {
            const localItems: TopRanking[] = JSON.parse(raw);
            localItems.forEach((r) => {
              if (r?.slug) map.set(r.slug, r);
            });
          }
        } catch (lErr) {
          console.warn('Erro ao ler cache local de rankings:', lErr);
        }
      }

      setRankings(Array.from(map.values()));
    } catch (err) {
      console.error('Erro ao carregar rankings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  const handleDelete = async (slug: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja excluir o ranking "${titulo}"?`)) {
      return;
    }

    try {
      // 1. Remover via API Backend (Autoritativo e Seguro com headers de Admin)
      const apiResult = await fetchAdminJson(`/api/rankings?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });

      if (!apiResult.ok) {
        throw new Error(apiResult.error || 'Erro na resposta do servidor ao excluir ranking.');
      }

      // 2. Remover do cache local (Cache Local de Contingência)
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(RANKING_STORAGE_KEY);
          if (raw) {
            const list: TopRanking[] = JSON.parse(raw);
            const filtered = list.filter((r) => r.slug !== slug);
            localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(filtered));
          }
        } catch (localErr) {
          console.warn('Erro ao deletar ranking do localStorage:', localErr);
        }
      }

      // Atualiza o estado visual instantaneamente
      setRankings((prev) => prev.filter((r) => r.slug !== slug));
    } catch (err: any) {
      console.error('Erro ao excluir ranking via API:', err);

      // Fallback amigável: se a API falhar mas o usuário quiser forçar a remoção visual no cache do navegador
      const confirmForce = confirm(
        `Erro ao deletar do servidor: ${err.message || 'Conexão rejeitada'}.\n\nDeseja forçar a remoção visual no seu navegador?`
      );
      if (confirmForce) {
        setRankings((prev) => prev.filter((r) => r.slug !== slug));
      }
    }
  };

  const filteredRankings = rankings.filter((r) => {
    const matchesSearch =
      r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subtitulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'todos' || r.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Banner Superior com Ações */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-400 text-stone-900 border border-stone-900 font-black text-xs uppercase rounded-full shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" />
                Módulo Comparativo
              </span>
              <span className="text-xs font-mono font-bold text-stone-500">Top 3 até Top 10</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Rankings & Guias Comparativos
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 font-medium">
              Crie listas ranqueadas de e-bikes, baterias de lítio, peças e acessórios com preenchimento automático por IA.
            </p>
          </div>

          <Link
            href="/admin/rankings/novo"
            className="px-6 py-3.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-black rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2 cursor-pointer text-sm shrink-0 w-fit"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Criar Novo Top Ranking</span>
          </Link>
        </div>

        {/* Barra de Filtro e Busca */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar rankings por título ou tema..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-bold text-stone-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['todos', 'ebikes', 'baterias', 'pecas', 'acessorios', 'seguranca'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white border-stone-900 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-900'
                }`}
              >
                {cat === 'todos'
                  ? 'Todos'
                  : cat === 'ebikes'
                  ? 'E-Bikes'
                  : cat === 'baterias'
                  ? 'Baterias'
                  : cat === 'pecas'
                  ? 'Peças'
                  : cat === 'acessorios'
                  ? 'Acessórios'
                  : 'Segurança'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Rankings */}
        {loading ? (
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-12 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)]">
            <div className="w-8 h-8 border-3 border-stone-900 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold text-stone-600 uppercase">Carregando rankings...</p>
          </div>
        ) : filteredRankings.length === 0 ? (
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-12 text-center shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] space-y-4">
            <div className="w-14 h-14 bg-amber-100 text-amber-900 border-2 border-stone-900 rounded-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_rgba(28,25,23,1)]">
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-stone-900">Nenhum Top Ranking Cadastrado</h3>
              <p className="text-xs text-stone-600 max-w-md mx-auto mt-1">
                Gere guias comparativos do Top 3 ao Top 10 com auxílio da IA para atrair tráfego orgânico e guiar seus leitores.
              </p>
            </div>
            <Link
              href="/admin/rankings/novo"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-amber-300 font-bold rounded-xl text-xs border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeiro Ranking</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRankings.map((rank) => (
              <div
                key={rank.slug || rank.id}
                className="bg-white border-2 border-stone-900 rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(28,25,23,1)] flex flex-col justify-between space-y-4 hover:translate-y-[-2px] transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-amber-400 text-stone-900 border border-stone-900 font-black text-[10px] uppercase rounded-full">
                      {rank.tipoRanking?.toUpperCase() || 'TOP'} • {rank.quantidadeItens || rank.itens.length} ITENS
                    </span>
                    <span className="text-[10px] font-mono font-bold text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {rank.dataAtualizacao}
                    </span>
                  </div>

                  <h3 className="font-black text-base text-stone-900 line-clamp-2 leading-snug">
                    {rank.titulo}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {rank.subtitulo || rank.criterioAvaliacao}
                  </p>

                  {/* Prévia dos Primeiros Itens */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-1.5">
                    {rank.itens.slice(0, 3).map((it, idx) => (
                      <div key={it.id || idx} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-800 truncate pr-2">
                          <strong className="text-amber-600 font-mono mr-1">#{idx + 1}</strong>
                          {it.tituloItem}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-stone-500 shrink-0">
                          {it.marca}
                        </span>
                      </div>
                    ))}
                    {rank.itens.length > 3 && (
                      <span className="text-[10px] font-bold text-stone-400 block text-right pt-1">
                        + {rank.itens.length - 3} outros itens...
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                  <Link
                    href={`/admin/rankings/editar/${rank.slug}`}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-900 rounded-lg text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-stone-700" />
                    <span>Editar</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(rank.slug, rank.titulo)}
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                    title="Excluir Ranking"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
