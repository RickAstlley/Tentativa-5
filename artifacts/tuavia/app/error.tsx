'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Footer from '@/components/Footer';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro de renderização na rota:', error);
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      reset();
    }
  };

  const handleClearCacheAndReset = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // storage sandbox protection
      }
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between text-ink" id="error-page">
      <div className="flex-grow flex items-center justify-center p-4 sm:p-8 my-8">
        <div className="max-w-lg w-full bg-white border-2 border-ink p-6 sm:p-8 rounded-3xl shadow-[6px_6px_0_0_rgba(46,43,39,1)] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 border-2 border-ink text-amber-700 font-mono text-2xl font-black mb-4">
            !
          </div>
          <h1 className="text-xl sm:text-2xl font-mono font-black text-ink uppercase tracking-tight mb-2">
            Ops! Algo deu errado
          </h1>
          <p className="text-sm text-ink/80 mb-6 leading-relaxed">
            Ocorreu uma falha temporária ao carregar este conteúdo. Tente novamente ou volte para a página inicial.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <button
              onClick={handleHardReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white font-mono font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-primary/90 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar Página</span>
            </button>
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-ink font-mono font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Página Inicial</span>
            </Link>
          </div>
          <button
            onClick={handleClearCacheAndReset}
            className="text-xs font-mono text-stone-500 hover:text-ink underline cursor-pointer"
          >
            Limpar cache e reiniciar
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
