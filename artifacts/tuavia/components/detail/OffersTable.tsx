'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Store, 
  ShieldCheck, 
  RefreshCw, 
  ExternalLink, 
  Sparkles, 
  CheckCircle, 
  LayoutGrid, 
  TableIcon, 
  ArrowUpRight,
  TrendingDown,
  Truck,
  CreditCard
} from 'lucide-react';
import { EBikeGrouped, EBikeStoreOffer } from '@/types/ebike';
import BatteryChargeIndicator from '../BatteryChargeIndicator';

interface OffersTableProps {
  bike: EBikeGrouped;
  lastClickedStore: string | null;
  handleStoreRedirect: (e: React.MouseEvent<HTMLAnchorElement>, offer: EBikeStoreOffer) => void;
}

export default function OffersTable({
  bike,
  lastClickedStore,
  handleStoreRedirect,
}: OffersTableProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const bestOffer = bike.ofertas.reduce((prev, curr) => (prev.preco < curr.preco ? prev : curr), bike.ofertas[0]);
  const highestOffer = bike.ofertas.reduce((prev, curr) => (prev.preco > curr.preco ? prev : curr), bike.ofertas[0]);
  const maxSavings = highestOffer.preco - bestOffer.preco;

  return (
    <div 
      id="tabela-ofertas" 
      className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 scroll-mt-6 animate-in fade-in duration-500"
    >
      {/* CABEÇALHO COM MODO DE VISUALIZAÇÃO */}
      <div className="border-b border-line pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-black text-ink uppercase tracking-wider text-sm sm:text-base">
            Ofertas &amp; Lojas Oficiais
          </h2>
          <p className="text-[11px] text-ink/75 mt-0.5">
            Compare condições atualizadas nas lojas e distribuidores credenciados.
          </p>
        </div>

        {/* SELECTOR DE MODO DE VISUALIZAÇÃO */}
        <div className="inline-flex items-center bg-neutral-100 p-1 rounded-xl border border-ink shadow-xs self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none ${
              viewMode === 'cards'
                ? 'bg-primary text-white border border-primary shadow-xs'
                : 'text-ink/70 hover:text-ink hover:bg-white/60'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cartões</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none ${
              viewMode === 'table'
                ? 'bg-primary text-white border border-primary shadow-xs'
                : 'text-ink/70 hover:text-ink hover:bg-white/60'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tabela</span>
          </button>
        </div>
      </div>

      {/* BANNER DE DESTAQUE DA MELHOR OFERTA DO DIA */}
      {bestOffer && (
        <div className="bg-gradient-to-r from-accent-charge/20 via-white to-accent-verde/10 border-2 border-primary rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0_0_rgba(46,43,39,1)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary text-accent-charge rounded-lg border border-ink shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">
                ★ Recomendação Menor Preço TuaVia
              </span>
              <span className="font-display font-black text-ink text-sm sm:text-base">
                {bestOffer.loja} — {formatCurrency(bestOffer.preco)}
              </span>
              {maxSavings > 0 && (
                <span className="text-[11px] text-accent-verde font-mono font-bold flex items-center gap-1 mt-0.5">
                  <TrendingDown className="w-3 h-3" />
                  Economia de {formatCurrency(maxSavings)} vs. maior cotação
                </span>
              )}
            </div>
          </div>

          <a
            href={bestOffer.linkProduto}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={(e) => handleStoreRedirect(e, bestOffer)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs px-4 py-2.5 rounded-lg border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all cursor-pointer shrink-0"
          >
            <span>Ver na {bestOffer.loja}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* MODO 1: CARTÕES DE LOJAS (RECOMENDADO) */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {bike.ofertas.map((offer, idx) => {
            const isBestPrice = offer.preco === bike.menorPreco;
            const isClickingThis = lastClickedStore === offer.loja;
            const savingsFromHighest = highestOffer.preco - offer.preco;

            return (
              <div 
                key={offer.id ? `${offer.id}-${idx}` : `offer-card-${idx}`} 
                className={`border-2 border-ink rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-3.5 transition-all duration-200 relative overflow-hidden ${
                  isBestPrice 
                    ? 'bg-accent-charge/15 border-primary shadow-[2px_2px_0_0_rgba(46,43,39,1)] ring-1 ring-primary/30' 
                    : 'bg-white hover:bg-neutral-50 shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                }`}
              >
                {/* SELO DE MELHOR PREÇO SE APLICÁVEL */}
                {isBestPrice && (
                  <div className="absolute top-0 right-0 bg-primary text-accent-charge text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-bl-lg border-l border-b border-ink tracking-wider">
                    ★ Menor Preço
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {/* CABEÇALHO DA LOJA */}
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg shrink-0 border border-ink shadow-2xs ${
                      isBestPrice ? 'bg-primary text-accent-charge' : 'bg-neutral-100 text-ink'
                    }`}>
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-display font-black text-ink text-sm sm:text-base leading-tight">
                        {offer.loja}
                      </h3>
                      <span className="text-[9px] font-mono text-ink/70 flex items-center gap-1 mt-0.5">
                        <CheckCircle className="w-2.5 h-2.5 text-accent-verde shrink-0" />
                        <span>Auditado em {offer.dataAtualizacao}</span>
                      </span>
                    </div>
                  </div>

                  {/* BLOCO DE PREÇO */}
                  <div className="bg-white/80 border border-ink/40 rounded-lg p-3 flex flex-col gap-0.5">
                    <span className="text-[9px] font-mono text-ink/60 uppercase">Preço à Vista</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono font-black text-xl sm:text-2xl tracking-tight ${
                        isBestPrice ? 'text-primary' : 'text-ink'
                      }`}>
                        {formatCurrency(offer.preco)}
                      </span>
                    </div>

                    {savingsFromHighest > 0 && !isBestPrice && (
                      <span className="text-[9px] font-mono text-accent-verde font-bold mt-0.5">
                        Economia de {formatCurrency(savingsFromHighest)} vs. maior cotação
                      </span>
                    )}

                    {isBestPrice && (
                      <span className="text-[9px] font-mono text-primary font-bold mt-0.5 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-accent-gold" /> Menor preço verificado
                      </span>
                    )}
                  </div>

                  {/* VANTAGEM / ÍNDICE DE OFERTA */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono font-bold text-ink/70 uppercase">Índice de Vantagem</span>
                    <BatteryChargeIndicator 
                      price={offer.preco} 
                      minPrice={bike.menorPreco} 
                      maxPrice={bike.maiorPreco} 
                      showLabel={true}
                    />
                  </div>

                  {/* OBSERVAÇÕES E ESTOQUE */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-line/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border ${
                        offer.disponibilidade === 'Em estoque' 
                          ? 'bg-accent-verde/15 text-accent-verde border-accent-verde/30' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        <Truck className="w-2.5 h-2.5" />
                        {offer.disponibilidade === 'Esgotado' ? 'Fora de Estoque' : offer.disponibilidade}
                      </span>

                      <span className="text-[9px] font-mono text-ink/60 flex items-center gap-1">
                        <CreditCard className="w-2.5 h-2.5" /> Parcelamento disponível
                      </span>
                    </div>

                    {offer.observacoes && (
                      <p className="text-[10px] text-ink/75 leading-relaxed bg-neutral-50 p-2 rounded-lg border border-line/50">
                        {offer.observacoes}
                      </p>
                    )}
                  </div>
                </div>

                {/* BOTÃO DE REDIRECIONAMENTO */}
                <a
                  href={offer.linkProduto}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={(e) => handleStoreRedirect(e, offer)}
                  className={`group h-11 w-full inline-flex items-center justify-center gap-1.5 text-xs font-mono font-bold px-4 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden select-none border-2 border-ink ${
                    isClickingThis
                      ? 'bg-accent-verde text-white shadow-sm'
                      : isBestPrice
                      ? 'bg-primary hover:bg-primary-dark text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                      : 'bg-white hover:bg-neutral-100 text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px]'
                  }`}
                  aria-label={`Acessar oferta na loja ${offer.loja}`}
                >
                  {isClickingThis ? (
                    <div className="flex flex-col items-center justify-center w-full h-full relative">
                      <div className="flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Redirecionando...</span>
                      </div>
                      <motion.div 
                        className="absolute bottom-0 left-0 h-[3px] bg-white"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "linear" }}
                      />
                    </div>
                  ) : (
                    <>
                      <span>Acessar {offer.loja}</span>
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* MODO 2: TABELA DE DADOS COMPLETA */}
      {viewMode === 'table' && (
        <div className="bg-white border-2 border-ink rounded-2xl shadow-xs overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b-2 border-ink text-[10px] font-mono font-bold text-ink uppercase tracking-wider">
                  <th className="py-4 px-6">Parceiro Oficial</th>
                  <th className="py-4 px-6">Preço à Vista</th>
                  <th className="py-4 px-6">Índice de Vantagem</th>
                  <th className="py-4 px-6">Disponibilidade &amp; Notas</th>
                  <th className="py-4 px-6 text-right">Redirecionamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-xs">
                {bike.ofertas.map((offer, idx) => {
                  const isBestPrice = offer.preco === bike.menorPreco;
                  const isClickingThis = lastClickedStore === offer.loja;

                  return (
                    <tr 
                      key={offer.id ? `${offer.id}-${idx}` : `offer-table-${idx}`} 
                      className={`transition-all duration-300 ${
                        isBestPrice 
                          ? 'bg-accent-charge/15 hover:bg-accent-charge/25 font-medium' 
                          : 'bg-white hover:bg-neutral-50'
                      }`}
                    >
                      {/* Nome da Loja */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 border border-ink shadow-2xs ${
                            isBestPrice 
                              ? 'bg-primary text-accent-charge' 
                              : 'bg-neutral-100 text-ink'
                          }`}>
                            <Store className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-display font-bold text-ink text-sm">
                              {offer.loja}
                            </span>
                            <span className="text-[9px] font-mono text-ink/60 flex items-center gap-1 mt-0.5">
                              <ShieldCheck className="w-3 h-3 text-accent-verde shrink-0" />
                              <span>Auditado {offer.dataAtualizacao}</span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Preço */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-mono font-black text-base ${
                            isBestPrice ? 'text-primary' : 'text-ink'
                          }`}>
                            {formatCurrency(offer.preco)}
                          </span>
                          {isBestPrice && (
                            <span className="inline-flex items-center justify-center gap-1 text-[8px] font-mono font-extrabold text-primary bg-accent-charge/80 border border-primary/20 px-1.5 py-0.5 rounded-md uppercase leading-none w-fit">
                              ★ Melhor Preço
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Indicador de Bateria */}
                      <td className="py-3.5 px-4">
                        <div className="w-28">
                          <BatteryChargeIndicator 
                            price={offer.preco} 
                            minPrice={bike.menorPreco} 
                            maxPrice={bike.maiorPreco} 
                            showLabel={true}
                          />
                        </div>
                      </td>

                      {/* Observações / Disponibilidade */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase w-fit px-2 py-0.5 rounded-md border ${
                            offer.disponibilidade === 'Em estoque' 
                              ? 'bg-accent-verde/15 text-accent-verde border-accent-verde/30' 
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {offer.disponibilidade === 'Esgotado' ? 'Fora de Estoque' : offer.disponibilidade}
                          </span>
                          {offer.observacoes && (
                            <p className="text-[10px] text-ink/70 leading-normal font-sans max-w-xs">
                              {offer.observacoes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* BOTÃO */}
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={offer.linkProduto}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          onClick={(e) => handleStoreRedirect(e, offer)}
                          className={`group h-10 inline-flex items-center justify-center gap-1.5 text-xs font-mono font-bold px-3.5 rounded-xl transition-all duration-200 cursor-pointer relative overflow-hidden select-none border-2 border-ink ${
                            isClickingThis
                              ? 'bg-accent-verde text-white shadow-xs'
                              : isBestPrice
                              ? 'bg-primary hover:bg-primary-dark text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                              : 'bg-white hover:bg-neutral-100 text-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]'
                          }`}
                          aria-label={`Acessar oferta de ${bike.modelo} na loja ${offer.loja}`}
                        >
                          {isClickingThis ? (
                            <div className="flex flex-col items-center justify-center w-full h-full relative">
                              <div className="flex items-center gap-1.5 animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[10px] tracking-tight">Redirecionando...</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span>Ir para {offer.loja}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </>
                          )}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
