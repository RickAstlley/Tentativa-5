'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Search, 
  Scale, 
  Store, 
  ShieldCheck, 
  ExternalLink, 
  Info, 
  ArrowRight, 
  HelpCircle,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';

export default function AboutDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-about-drawer', handleOpen);
    return () => window.removeEventListener('open-about-drawer', handleOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex justify-end animate-fade-in"
      id="about-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div 
        className="w-full max-w-sm sm:max-w-md bg-surface h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-200 overflow-y-auto border-l border-line pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-drawer-title"
      >
        {/* Cabeçalho do Drawer */}
        <div className="sticky top-0 bg-surface z-10 p-5 sm:p-6 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold text-accent-gold uppercase tracking-wider bg-accent-gold/10 px-2.5 py-1 rounded-md">
              Guia Rápido TuaVia
            </span>
            <h2 id="about-drawer-title" className="font-display font-bold text-xl text-ink tracking-tight mt-1.5">
              Como Funciona o TuaVia
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full border border-line hover:bg-bg-base transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Fechar guia sobre o TuaVia"
          >
            <X className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* Conteúdo Principal do Drawer */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col gap-6">
          
          <p className="text-xs sm:text-sm text-ink/80 leading-relaxed font-sans">
            O <strong>TuaVia</strong> é um comparador independente e especializado em bicicletas elétricas no Brasil. Ajudamos você a encontrar o modelo ideal pelo menor preço com dados 100% conferidos.
          </p>

          {/* Selo Curadoria Humana */}
          <div className="bg-accent-gold/15 border-2 border-accent-gold/30 p-4 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-accent-gold shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block text-ink font-mono font-bold uppercase tracking-wider text-[11px]">
                100% Curadoria Humana
              </strong>
              <p className="text-ink/80 text-[11px] leading-snug mt-0.5">
                Sem robôs de scraping falhos. Nossos preços, lojas oficiais e especificações técnicas são auditados manualmente por especialistas.
              </p>
            </div>
          </div>

          {/* 4 Passos/Funcionalidades Chave */}
          <div className="flex flex-col gap-3.5">
            <span className="text-[10px] font-mono font-bold text-ink/60 uppercase tracking-widest">
              Nossos Recursos
            </span>

            {/* Passo 1 */}
            <div className="bg-bg-base/60 border border-line/70 p-3.5 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 text-xs font-mono font-bold">
                <Search className="w-4 h-4 text-accent-charge" />
              </div>
              <div>
                <h3 className="text-xs font-display font-bold text-ink flex items-center gap-1.5">
                  1. Busque e Filtre com Precisão
                </h3>
                <p className="text-[11px] text-ink/75 leading-relaxed mt-0.5">
                  Filtre por autonomia real da bateria, potência do motor (250W a 750W+), uso principal (Urbana, Dobrável, Cargo, Trilha) e orçamento.
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="bg-bg-base/60 border border-line/70 p-3.5 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 text-xs font-mono font-bold">
                <Scale className="w-4 h-4 text-accent-charge" />
              </div>
              <div>
                <h3 className="text-xs font-display font-bold text-ink flex items-center gap-1.5">
                  2. Compare Lado a Lado
                </h3>
                <p className="text-[11px] text-ink/75 leading-relaxed mt-0.5">
                  Adicione até 3 e-bikes ao comparador simultâneo para analisar peso, tempo de recarga, bateria, velocidade e ofertas de cada loja.
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="bg-bg-base/60 border border-line/70 p-3.5 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 text-xs font-mono font-bold">
                <Store className="w-4 h-4 text-accent-charge" />
              </div>
              <div>
                <h3 className="text-xs font-display font-bold text-ink flex items-center gap-1.5">
                  3. Ofertas de Lojas Oficiais
                </h3>
                <p className="text-[11px] text-ink/75 leading-relaxed mt-0.5">
                  Mostramos onde encontrar o menor preço entre fabricantes oficiais e varejistas parceiros, com parcelamento e garantia nacional.
                </p>
              </div>
            </div>

            {/* Passo 4 */}
            <div className="bg-bg-base/60 border border-line/70 p-3.5 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 text-xs font-mono font-bold">
                <ExternalLink className="w-4 h-4 text-accent-charge" />
              </div>
              <div>
                <h3 className="text-xs font-display font-bold text-ink flex items-center gap-1.5">
                  4. Redirecionamento Seguro
                </h3>
                <p className="text-[11px] text-ink/75 leading-relaxed mt-0.5">
                  Ao escolher uma oferta, te direcionamos diretamente ao site oficial da loja para você finalizar sua compra sem intermediários.
                </p>
              </div>
            </div>
          </div>

          {/* Seção de Links Institucionais no Drawer */}
          <div className="pt-4 border-t border-line/60 flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold text-ink/60 uppercase tracking-widest">
              Links Úteis
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/contato');
                }}
                className="flex items-center gap-1.5 p-2.5 bg-bg-base border border-line rounded-xl hover:border-primary text-ink hover:text-primary transition-all text-left min-h-[44px] cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Fale Conosco</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/#como-funciona');
                }}
                className="flex items-center gap-1.5 p-2.5 bg-bg-base border border-line rounded-xl hover:border-primary text-ink hover:text-primary transition-all text-left min-h-[44px] cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-accent-gold shrink-0" />
                <span>Guia Completo</span>
              </button>
            </div>
          </div>

        </div>

        {/* Rodapé Fixo do Drawer */}
        <div className="sticky bottom-0 bg-white border-t border-line p-4 sm:p-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push('/');
            }}
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-mono font-bold text-xs py-3.5 px-4 rounded-[18px] transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Ir para o catálogo de e-bikes"
          >
            <span>Explorar E-Bikes</span>
            <ArrowRight className="w-4 h-4 shrink-0 text-accent-charge" />
          </button>
        </div>

      </div>
    </div>
  );
}
