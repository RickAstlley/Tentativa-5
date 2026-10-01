import React from 'react';
import Link from 'next/link';
import { Signpost, ArrowLeft, Search, Bike, MapPinOff } from 'lucide-react';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-between text-ink relative">
      {/* Container Central da Rota Perdida */}
      <div className="flex-grow flex items-center justify-center p-4 sm:p-8 my-8 sm:my-12">
        <div className="max-w-xl w-full bg-white/95 border-2 border-ink p-6 sm:p-10 rounded-3xl shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Decoração: Faixas Amarelas Tracejadas de Pista ao Fundo */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-amber-400 border-b-2 border-ink flex items-center justify-around px-2 overflow-hidden">
            <div className="w-full h-0.5 border-b-2 border-dashed border-ink/40" />
          </div>

          {/* Tag de Desvio no Topo */}
          <div className="mt-2 mb-6 bg-red-600 text-white border-2 border-ink px-3.5 py-1 rounded-full text-xs font-mono font-black uppercase tracking-widest shadow-[2px_2px_0_0_rgba(46,43,39,1)] inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>404 · Rota Interrompida</span>
          </div>

          {/* Ícone Grande de Placa / Desvio (80-120px) */}
          <div className="relative my-2 group">
            {/* Placa Amarela de Advertência Neo-Brutalista */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 bg-amber-400 border-3 border-ink rounded-2xl rotate-45 flex items-center justify-center shadow-[4px_4px_0_0_rgba(46,43,39,1)] transition-transform duration-300 hover:rotate-0">
              <div className="w-[88%] h-[88%] border-2 border-ink/40 rounded-xl flex items-center justify-center bg-amber-300/60">
                <Signpost className="w-12 h-12 sm:w-14 sm:h-14 -rotate-45 text-ink stroke-[2.5] transition-transform duration-300 group-hover:rotate-0" />
              </div>
            </div>

            {/* Ícone Auxiliar de Pin Perdido */}
            <div className="absolute -bottom-2 -right-2 bg-red-500 text-white border-2 border-ink p-1.5 rounded-full shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
              <MapPinOff className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Título Principal */}
          <h1 className="text-2xl sm:text-3xl font-mono font-black text-ink uppercase tracking-tight mt-8 mb-3">
            Você saiu da via!
          </h1>

          {/* Descrição Curta com Tom Amigável */}
          <p className="text-sm sm:text-base text-ink/80 leading-relaxed max-w-md mb-8">
            A página que você procurava não foi encontrada — mas o caminho de volta para as melhores ofertas e e-bikes é reto e bem sinalizado.
          </p>

          {/* Ações de Redirecionamento */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
            {/* Botão Principal: Voltar pra pista */}
            <Link 
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-mono font-black text-sm uppercase tracking-wider px-5 py-3.5 rounded-xl border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-all min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
              <span>Voltar pra pista</span>
            </Link>

            {/* Botão Secundário: Ver todos os modelos */}
            <Link 
              href="/ebike"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-neutral-100 text-ink font-mono font-bold text-sm uppercase tracking-wider px-5 py-3.5 rounded-xl border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_rgba(46,43,39,1)] transition-all min-h-[48px]"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>Ver todos os modelos</span>
            </Link>
          </div>

          {/* Faixa Rodapé Decorativa com Ícone da Bike */}
          <div className="mt-8 pt-4 border-t border-ink/20 w-full flex items-center justify-center gap-2 text-[11px] font-mono text-ink/60 font-bold uppercase">
            <Bike className="w-4 h-4 text-emerald-600" />
            <span>TuaVia · Guia de Mobilidade Elétrica Neutro</span>
          </div>

        </div>
      </div>

      {/* Footer da Aplicação */}
      <Footer />
    </div>
  );
}
