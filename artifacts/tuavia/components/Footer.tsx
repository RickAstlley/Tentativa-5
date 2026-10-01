'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, ArrowUpRight, Lock } from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { DEFAULT_SITE_SETTINGS } from '@/lib/settings';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSiteSettings();

  const footerConfianca = settings?.footerConfianca?.trim() || DEFAULT_SITE_SETTINGS.footerConfianca;

  return (
    <footer className="relative z-20 bg-primary text-white border-t-2 border-ink/20 mt-auto pb-32 sm:pb-36 md:pb-12" id="app-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Bloco 1: Identidade & Selo de Confiança Auditada (5 colunas no desktop) */}
          <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-4">
            <Link href="/" className="font-display font-black text-2xl sm:text-2xl tracking-tight text-white hover:opacity-95 transition-opacity w-fit flex items-center gap-2">
              <span className="leading-none text-[22px] sm:text-2xl">Tua<span className="text-accent-charge">Via</span></span>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold leading-none bg-white/10 text-accent-charge px-2 sm:px-2.5 py-1 rounded-full border border-white/20 uppercase tracking-wider flex items-center justify-center translate-y-[0.5px]">
                Comparador
              </span>
            </Link>
            
            <p className="text-sm text-white/75 leading-relaxed">
              O primeiro comparador brasileiro independente e focado exclusivamente em bicicletas elétricas. Encontramos ofertas reais, catalogamos fichas técnicas e auditamos preços sem scraping quebrado.
            </p>

            <div className="flex items-start gap-3 mt-1 bg-white/5 hover:bg-white/10 transition-colors border border-white/15 rounded-xl p-3 sm:p-3.5">
              <div className="w-8 h-8 rounded-lg bg-accent-warm/20 border border-accent-warm/40 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-accent-warm" />
              </div>
              <div className="flex flex-col text-xs text-white/85 leading-snug">
                {footerConfianca.includes(':') ? (
                  <>
                    <strong className="text-white font-mono font-bold text-[11px] uppercase tracking-wide">
                      {footerConfianca.split(':')[0]}
                    </strong>
                    <span className="text-white/70 mt-0.5">
                      {footerConfianca.substring(footerConfianca.indexOf(':') + 1)}
                    </span>
                  </>
                ) : (
                  <span>{footerConfianca}</span>
                )}
              </div>
            </div>
          </div>

          {/* Bloco 2: Navegação Direta & Diretrizes Claras (4 colunas no desktop) */}
          <div className="lg:col-span-4 flex flex-col justify-between h-full gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-charge shrink-0" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
                  Navegação do Portal
                </h4>
              </div>

              <nav className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm font-medium text-white/75">
                <Link href="/" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Início
                </Link>
                <Link href="/ebike" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Catálogo E-Bikes
                </Link>
                <Link href="/comparar" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Comparador
                </Link>
                <Link href="/rankings" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Melhores do Ano
                </Link>
                <Link href="/artigos" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Guias &amp; Dossiês
                </Link>
                <Link href="/artigos/guia-normas-resolucao-contran-996-2023-ebike" className="hover:text-white hover:translate-x-0.5 transition-all flex items-center gap-1.5">
                  <span className="text-white/40 font-mono text-xs">/</span> Lei CONTRAN 996
                </Link>
              </nav>
            </div>

            {/* Aviso de Transparência e Independência */}
            <div className="pt-4 border-t border-white/10 text-xs text-white/65 leading-relaxed">
              <strong className="text-white/90 font-mono uppercase text-[10px] tracking-wider block mb-1">
                Transparência &amp; Afiliados
              </strong>
              O TuaVia é um portal informativo independente. Não vendemos produtos diretamente nem cobramos taxas do ciclista. Ao acessar ofertas verificadas, podemos receber comissão de lojistas sem alterar o preço final.
            </div>
          </div>

          {/* Bloco 3: Placa de Rodovia Oficial "SAÍDAS DESTA VIA" (4 colunas no desktop) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-accent-verde border-2 border-white rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.45)] relative overflow-hidden">
              {/* Parafuso decorativo nos cantos da placa estilo rodovia */}
              <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-white/40" />
              <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-white/40" />

              {/* Cabeçalho da Placa */}
              <div className="flex items-center justify-between border-b-2 border-white/30 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-gold shadow-xs" />
                  <span className="text-xs font-mono font-black uppercase tracking-widest text-white">
                    SAÍDAS DESTA VIA
                  </span>
                </div>
                <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider font-bold bg-black/20 px-2 py-0.5 rounded">
                  Legal &amp; Suporte
                </span>
              </div>

              {/* Links em formato de placas de saída */}
              <div className="flex flex-col gap-2">
                <Link 
                  href="/artigos" 
                  className="group flex items-center justify-between bg-black/30 hover:bg-white hover:text-accent-verde text-white border border-white/40 hover:border-white px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-xs min-h-[44px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-accent-gold text-ink font-mono font-black px-2 py-0.5 rounded shadow-xs shrink-0">
                      SAÍDA 01
                    </span>
                    <span className="truncate">Artigos &amp; Dossiês</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 text-accent-gold group-hover:text-accent-verde" />
                </Link>

                <Link 
                  href="/termos" 
                  className="group flex items-center justify-between bg-black/30 hover:bg-white hover:text-accent-verde text-white border border-white/40 hover:border-white px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-xs min-h-[44px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-white/20 group-hover:bg-accent-verde group-hover:text-white text-white border border-white/40 px-2 py-0.5 rounded font-mono font-black shrink-0">
                      SAÍDA 02
                    </span>
                    <span className="truncate">Termos de Uso</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                </Link>

                <Link 
                  href="/privacidade" 
                  className="group flex items-center justify-between bg-black/30 hover:bg-white hover:text-accent-verde text-white border border-white/40 hover:border-white px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-xs min-h-[44px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-white/20 group-hover:bg-accent-verde group-hover:text-white text-white border border-white/40 px-2 py-0.5 rounded font-mono font-black shrink-0">
                      SAÍDA 03
                    </span>
                    <span className="truncate">Privacidade &amp; Dados</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                </Link>

                <Link 
                  href="/contato" 
                  className="group flex items-center justify-between bg-black/30 hover:bg-white hover:text-accent-verde text-white border border-white/40 hover:border-white px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-xs min-h-[44px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-white/20 group-hover:bg-accent-verde group-hover:text-white text-white border border-white/40 px-2 py-0.5 rounded font-mono font-black shrink-0">
                      SAÍDA 04
                    </span>
                    <span className="truncate">Contato &amp; Suporte</span>
                  </div>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
                </Link>
              </div>
            </div>
          </div>

        </div>

        {/* Divisor */}
        <div className="h-[1px] bg-white/10 my-8" />

        {/* Assinatura inferior com texto limpo e sem quebras indesejadas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60 font-mono">
          <p className="text-center sm:text-left">
            © {currentYear} TuaVia. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="text-white/40 hover:text-accent-charge transition-colors flex items-center gap-1 text-[11px]"
              title="Acesso Administrativo"
            >
              <Lock className="w-3 h-3" />
              <span>Painel Admin</span>
            </Link>
            <p className="flex items-center gap-1.5 whitespace-nowrap text-white/80 font-bold">
              Feito para todos os ciclistas ⚡
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
