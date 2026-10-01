'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AdminHeader from '@/components/admin/AdminHeader';
import BikeForm from '@/components/admin/BikeForm';
import BikeReviewsManager from '@/components/admin/BikeReviewsManager';
import { EBikeGrouped } from '@/types/ebike';
import { fetchEBikeBySlugFromFirestore } from '@/lib/ebikes';
import { ArrowLeft, Bike, RefreshCw, Edit2, AlertCircle, MessageSquare, Sliders } from 'lucide-react';

export default function AdminEditBikePage() {
  const router = useRouter();
  const params = useParams();
  const bikeSlug = (params?.id as string) || '';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingBike, setLoadingBike] = useState(true);
  const [bikeData, setBikeData] = useState<EBikeGrouped | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'reviews'>('form');

  const fetchBikeDetails = async (slug: string) => {
    setLoadingBike(true);
    setErrorMsg(null);
    try {
      const found = await fetchEBikeBySlugFromFirestore(slug);
      if (found) {
        setBikeData(found);
      } else {
        setErrorMsg(`E-bike com ID "${slug}" não foi encontrada no banco de dados.`);
      }
    } catch (err) {
      console.warn('Erro ao buscar bike no banco de dados:', err);
      setErrorMsg('Falha de comunicação ao carregar os dados da e-bike.');
    } finally {
      setLoadingBike(false);
    }
  };

  useEffect(() => {
    setCheckingAuth(false);
    if (bikeSlug) {
      fetchBikeDetails(bikeSlug);
    }
  }, [bikeSlug]);

  if (checkingAuth || loadingBike) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">
          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
          <span className="font-bold text-stone-900 text-sm">Carregando dados da e-bike...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 pb-16">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header com Breadcrumb */}
        <div className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)]">
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/admin/bikes"
              className="text-stone-500 hover:text-stone-900 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              E-Bikes
            </Link>
            <span className="text-stone-300">/</span>
            <span className="text-emerald-800 font-bold text-xs bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              Editar E-Bike
            </span>
          </div>

          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <Edit2 className="w-7 h-7 text-emerald-600" />
            Editar E-Bike: {bikeData?.marca} {bikeData?.modelo}
          </h1>
          <p className="text-stone-600 text-xs font-medium mt-1 font-mono">
            Documento ID: <code className="bg-stone-100 px-1 py-0.5 rounded">{bikeSlug}</code>
          </p>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer border-2 ${
                activeTab === 'form'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
                  : 'bg-stone-50 text-stone-600 hover:text-stone-900 border-stone-300 hover:border-stone-400'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Ficha Técnica & Ofertas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer border-2 ${
                activeTab === 'reviews'
                  ? 'bg-stone-900 text-white border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
                  : 'bg-stone-50 text-stone-600 hover:text-stone-900 border-stone-300 hover:border-stone-400'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Comentários da Comunidade</span>
            </button>
          </div>
        </div>

        {errorMsg ? (
          <div className="bg-white border-2 border-stone-900 rounded-2xl p-8 shadow-[6px_6px_0px_0px_rgba(225,29,72,1)] text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 border-2 border-stone-900 rounded-xl flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-stone-900">Atenção</h2>
            <p className="text-stone-600 text-xs font-medium max-w-md mx-auto">{errorMsg}</p>
            <Link
              href="/admin/bikes"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white font-bold text-xs rounded-xl"
            >
              Voltar para Lista de Bikes
            </Link>
          </div>
        ) : (
          bikeData && (
            <>
              {activeTab === 'form' ? (
                <BikeForm initialData={bikeData} isEditing={true} />
              ) : (
                <BikeReviewsManager
                  bikeSlug={bikeData.slug}
                  bikeName={`${bikeData.marca} ${bikeData.modelo}`}
                  autonomiaKm={bikeData.autonomiaKm}
                  potenciaW={bikeData.potenciaW}
                />
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}
