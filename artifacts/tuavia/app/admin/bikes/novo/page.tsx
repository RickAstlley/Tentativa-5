'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AdminHeader from '@/components/admin/AdminHeader';
import BikeForm from '@/components/admin/BikeForm';
import { ArrowLeft, Bike, RefreshCw, PlusCircle } from 'lucide-react';

export default function AdminNewBikePage() {
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
              Nova E-Bike
            </span>
          </div>

          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <PlusCircle className="w-7 h-7 text-emerald-600" />
            Cadastrar Nova E-Bike
          </h1>
          <p className="text-stone-600 text-xs font-medium mt-1">
            Preencha os dados técnicos, imagem e ofertas das lojas parceiras para publicar o modelo no catálogo.
          </p>
        </div>

        {/* Formulário Compartilhado */}
        <BikeForm isEditing={false} />
      </main>
    </div>
  );
}
