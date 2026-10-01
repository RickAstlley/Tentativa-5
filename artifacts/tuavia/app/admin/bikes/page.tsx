'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import { EBikeGrouped } from '@/types/ebike';
import { fetchEBikesFromFirestore } from '@/lib/ebikes';
import { fetchAdminJson } from '@/lib/ai/clientResponse';
import {
  Bike,
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
  CheckCircle2
} from 'lucide-react';

export default function AdminBikesListPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [bikes, setBikes] = useState<EBikeGrouped[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal de confirmação de exclusão
  const [bikeToDelete, setBikeToDelete] = useState<EBikeGrouped | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchBikes = async () => {
    setLoading(true);
    try {
      const list = await fetchEBikesFromFirestore();
      // Ordena por modelo
      list.sort((a, b) => a.modelo.localeCompare(b.modelo));
      setBikes(list);
    } catch (error) {
      console.warn('Erro ao buscar e-bikes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCheckingAuth(false);
    fetchBikes();
  }, []);

  const handleDeleteBike = async () => {
    if (!bikeToDelete) return;
    setIsDeleting(true);

    try {
      // 1. Remover do servidor via API (Autoritativo e Seguro com headers de Admin)
      const apiResult = await fetchAdminJson(`/api/bikes?slug=${encodeURIComponent(bikeToDelete.slug)}`, {
        method: 'DELETE',
      });

      if (!apiResult.ok) {
        throw new Error(apiResult.error || 'Erro na resposta do servidor ao deletar e-bike.');
      }

      // 2. Remover do localStorage (Cache Local de Contingência)
      try {
        const rawLocal = localStorage.getItem('tuavia_published_bikes_v1');
        if (rawLocal) {
          const list = JSON.parse(rawLocal);
          const filtered = list.filter((b: any) => b.slug !== bikeToDelete.slug);
          localStorage.setItem('tuavia_published_bikes_v1', JSON.stringify(filtered));
        }
      } catch (localErr) {
        console.warn('Erro ao deletar bike do localStorage:', localErr);
      }

      // Atualiza o estado visual instantaneamente e fecha o modal de forma limpa
      setBikes((prev) => prev.filter((b) => b.slug !== bikeToDelete.slug));
      showToast(`Bike "${bikeToDelete.marca} ${bikeToDelete.modelo}" removida com sucesso!`);
      setBikeToDelete(null);
    } catch (error: any) {
      console.error('Erro ao apagar e-bike via API:', error);

      // Fallback amigável: se a API falhar mas o usuário quiser forçar a remoção visual no cache do navegador
      const confirmForce = confirm(
        `Erro ao deletar do servidor: ${error.message || 'Conexão rejeitada'}.\n\nDeseja forçar a remoção visual no seu navegador?`
      );
      if (confirmForce) {
        setBikes((prev) => prev.filter((b) => b.slug !== bikeToDelete.slug));
        setBikeToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredBikes = bikes.filter((b) => {
    const query = searchQuery.toLowerCase();
    return (
      b.modelo.toLowerCase().includes(query) ||
      b.marca.toLowerCase().includes(query) ||
      b.usoPrincipal.toLowerCase().includes(query)
    );
  });

  const formatPrice = (val?: number) => {
    if (!val) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
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
              <span className="text-emerald-800 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                Catálogo de E-Bikes
              </span>
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
              <Bike className="w-7 h-7 text-emerald-600" />
              Gerenciamento de E-Bikes
            </h1>
            <p className="text-stone-600 text-xs font-medium">
              Listagem de todos os modelos de bicicletas elétricas gravados no Firestore.
            </p>
          </div>

          <Link
            href="/admin/bikes/novo"
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nova Bike</span>
          </Link>
        </div>

        {/* Barra de Filtro e Busca */}
        <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo ou uso..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-stone-600 self-end sm:self-auto">
            <span>Total:</span>
            <span className="bg-stone-900 text-emerald-400 px-2.5 py-1 rounded-lg font-mono">
              {filteredBikes.length} {filteredBikes.length === 1 ? 'modelo' : 'modelos'}
            </span>
          </div>
        </div>

        {/* Tabela de Listagem */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-stone-600 text-xs font-bold">Carregando catálogo de e-bikes do Firestore...</p>
            </div>
          ) : filteredBikes.length === 0 ? (
            <div className="py-16 text-center space-y-4 px-4">
              <div className="w-12 h-12 bg-amber-100 border-2 border-stone-900 rounded-xl flex items-center justify-center text-amber-800 mx-auto">
                <Bike className="w-6 h-6" />
              </div>
              <h3 className="font-black text-stone-900 text-base">Nenhuma e-bike encontrada</h3>
              <p className="text-stone-600 text-xs font-medium max-w-sm mx-auto">
                {searchQuery
                  ? 'Nenhuma bike corresponde aos termos pesquisados.'
                  : 'Ainda não há e-bikes cadastradas no banco de dados. Clique em "+ Nova Bike" para começar.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg"
                >
                  Limpar busca
                </button>
              ) : (
                <Link
                  href="/admin/bikes/novo"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-stone-900 font-bold text-xs rounded-lg border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Primeira Bike
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-900 text-white text-[11px] uppercase tracking-wider font-mono border-b-2 border-stone-900">
                    <th className="py-3.5 px-4 font-bold">Modelo & Marca</th>
                    <th className="py-3.5 px-4 font-bold">Uso / Categoria</th>
                    <th className="py-3.5 px-4 font-bold">Menor Preço</th>
                    <th className="py-3.5 px-4 font-bold">Ofertas</th>
                    <th className="py-3.5 px-4 font-bold">Especificações</th>
                    <th className="py-3.5 px-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-xs font-medium text-stone-900">
                  {filteredBikes.map((bike) => (
                    <tr
                      key={bike.slug}
                      className="hover:bg-stone-50/80 transition-colors group"
                    >
                      {/* Modelo e Imagem */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-300 relative overflow-hidden shrink-0 flex items-center justify-center">
                            {bike.imagemUrl ? (
                              <SafeImage
                                src={bike.imagemUrl}
                                alt={bike.modelo}
                                fill
                                className="object-cover"
                                fallbackSrc="https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80"
                              />
                            ) : (
                              <Bike className="w-6 h-6 text-stone-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-black text-stone-900 text-sm group-hover:text-emerald-700 transition-colors">
                              {bike.modelo}
                            </div>
                            <div className="text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                              {bike.marca}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 border border-stone-300 px-2.5 py-1 rounded-full font-bold text-[11px]">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          {bike.usoPrincipal || 'Urbana'}
                        </span>
                      </td>

                      {/* Menor Preço */}
                      <td className="py-3.5 px-4">
                        <span className="font-black text-stone-900 text-sm font-mono">
                          {formatPrice(bike.menorPreco)}
                        </span>
                      </td>

                      {/* Ofertas */}
                      <td className="py-3.5 px-4">
                        <span className="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-lg border border-emerald-300 text-[11px]">
                          {bike.ofertas?.length || 0} {bike.ofertas?.length === 1 ? 'loja' : 'lojas'}
                        </span>
                      </td>

                      {/* Specs */}
                      <td className="py-3.5 px-4 text-stone-600 font-mono text-[11px]">
                        <div>{bike.potenciaW ? `${bike.potenciaW}W` : 'N/A'} • {bike.autonomiaKm ? `${bike.autonomiaKm} km` : 'N/A'}</div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/bike/${bike.slug}`}
                            target="_blank"
                            title="Ver no site público"
                            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg border border-stone-300 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          <Link
                            href={`/admin/bikes/${bike.slug}/editar`}
                            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-lg border border-stone-900 flex items-center gap-1.5 transition-colors shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Editar</span>
                          </Link>

                          <button
                            onClick={() => setBikeToDelete(bike)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Apagar bike"
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
      {bikeToDelete && (
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
              Tem certeza que deseja apagar a e-bike <strong className="text-stone-900 font-black">{bikeToDelete.marca} {bikeToDelete.modelo}</strong>? Esta ação removerá o registro do Firestore e não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setBikeToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-900 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteBike}
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
