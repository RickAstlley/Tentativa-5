'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, Sparkles, Trash2 } from 'lucide-react';

export default function AdminRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminRouteError] Client-side exception in admin layout:', error);
  }, [error]);

  const handleClearCacheAndReset = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('tuavia_prefill_article');
        sessionStorage.removeItem('tuavia_prefill_bike');
        sessionStorage.removeItem('tuavia_prefill_ranking');
        localStorage.removeItem('tuavia_prefill_article');
        localStorage.removeItem('tuavia_prefill_bike');
        localStorage.removeItem('tuavia_prefill_ranking');
      } catch (_) {}
    }
    reset();
  };

  return (
    <div className="min-h-[80vh] bg-[#FDFBF7] flex items-center justify-center p-4 text-stone-900">
      <div className="max-w-lg w-full bg-white border-2 border-stone-900 rounded-2xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 border-2 border-stone-900 rounded-xl flex items-center justify-center text-amber-900 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-900">Recuperação de Interface Admin</h1>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">TuaVia Painel de Controle</p>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 mb-6 font-mono break-all max-h-32 overflow-y-auto">
          {error?.message || 'Exceção não tratada na renderização do componente.'}
        </div>

        <p className="text-stone-600 text-xs sm:text-sm font-medium mb-6">
          A interface interceptou uma falha de carregamento. Você pode tentar novamente ou limpar rascunhos temporários do navegador para restabelecer a estabilidade sem afetar o banco de dados.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>Tentar Novamente</span>
          </button>

          <button
            type="button"
            onClick={handleClearCacheAndReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border-2 border-stone-900 transition-all cursor-pointer"
            title="Limpa rascunhos temporários do formulário para evitar loops"
          >
            <Trash2 className="w-4 h-4 text-amber-700" />
            <span>Limpar Temporários</span>
          </button>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-900 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Início Admin</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
