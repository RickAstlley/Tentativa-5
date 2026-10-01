'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  Home, 
  Layers, 
  Bike,
  Swords,
  Search, 
  FileText, 
  Info, 
  ShieldCheck, 
  HelpCircle, 
  ChevronRight 
} from 'lucide-react';
import { useSiteSettings } from '@/context/SiteSettingsContext';
import { DEFAULT_SITE_SETTINGS } from '@/lib/settings';
import { LOGO_TUAVIA_DATA_URI } from '@/logoTuaViaDataUri';
import SidebarContextualSearch from './SidebarContextualSearch';

export default function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const { settings } = useSiteSettings();

  const sidebarConfianca = settings?.sidebarConfianca?.trim() || DEFAULT_SITE_SETTINGS.sidebarConfianca;

  const [showAffiliateModal, setShowAffiliateModal] = useState(false);

  // Itens do rodapé de navegação do mobile (até o botão de Início / Home)
  const isHomeActive = pathname === '/' && (!searchParams || !searchParams.get('q'));
  const isCompararActive = pathname.startsWith('/comparar');
  const isArenaActive = pathname.startsWith('/arena') || pathname.startsWith('/versus');
  const isEbikeActive = pathname.startsWith('/ebike') || pathname.startsWith('/pesquisa') || pathname.startsWith('/bike/');
  const isArtigosActive = pathname.startsWith('/artigos');

  const navItems = [
    {
      id: 'home',
      label: 'Início',
      icon: Home,
      isActive: isHomeActive,
      onClick: () => {
        if (pathname === '/' && (!searchParams || !searchParams.toString())) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          router.push('/');
        }
      },
    },
    {
      id: 'comparar',
      label: 'Comparar',
      icon: Layers,
      isActive: isCompararActive,
      onClick: () => router.push('/comparar'),
    },
    {
      id: 'arena',
      label: 'Arena 1v1',
      icon: Swords,
      isActive: isArenaActive,
      onClick: () => router.push('/arena'),
    },
    {
      id: 'ebikes',
      label: 'E-Bike',
      icon: Bike,
      isActive: isEbikeActive,
      onClick: () => router.push('/ebike'),
    },
    {
      id: 'artigos',
      label: 'Artigos',
      icon: FileText,
      isActive: isArtigosActive,
      onClick: () => router.push('/artigos'),
    },
    {
      id: 'sobre',
      label: 'Sobre',
      icon: Info,
      isActive: false,
      onClick: () => {
        window.dispatchEvent(new CustomEvent('open-about-drawer'));
      },
    },
  ];

  return (
    <>
      <aside 
        className="hidden md:flex md:w-[210px] lg:w-[230px] xl:w-[245px] fixed top-0 bottom-0 left-0 h-screen border-r-2 border-line/80 bg-bg-base flex-col justify-between shrink-0 z-30 p-3 lg:p-4 select-none overflow-y-auto no-scrollbar shadow-[2px_0_8px_rgba(46,43,39,0.05)]" 
        id="editorial-desktop-sidebar"
      >
        
        {/* Superior Section: Brand & Search */}
        <div className="flex flex-col gap-3.5">
          
          {/* Nova Logo Oficial TuaVia & Identidade com Design Superior */}
          <div className="flex flex-col items-center">
            <button 
              type="button"
              onClick={() => {
                const scrollContainer = document.getElementById('main-scrollable-content');
                if (scrollContainer) {
                  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (pathname !== '/') {
                  router.push('/');
                }
              }}
              className="w-full group cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl text-left"
              aria-label="TuaVia - Ir para Início"
            >
              <div className="w-full bg-white border-2 border-ink rounded-xl p-2.5 shadow-[2.5px_2.5px_0_0_rgba(46,43,39,1)] group-hover:shadow-[1px_1px_0_0_rgba(46,43,39,1)] group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-all duration-200 flex flex-col items-center justify-center gap-1 relative overflow-hidden">
                {/* Faixa superior de acabamento dourada */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-gold via-primary to-accent-gold" />
                
                {/* Imagem Oficial da Logo */}
                <div className="h-8 sm:h-9 w-auto max-w-[135px] flex items-center justify-center pt-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={LOGO_TUAVIA_DATA_URI}
                    alt="TuaVia"
                    width={135}
                    height={36}
                    className="h-full w-auto object-contain select-none pointer-events-none group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>

                {/* Tagline com Indicador de Curadoria */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9.5px] font-mono font-bold tracking-tight text-ink/75 uppercase">
                    Curadoria de E-bikes
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Barra de Busca Inteligente Contextual (Mesmo modelo do Mobile + Adaptação por Rota) */}
          <SidebarContextualSearch />

          {/* Navegação Principal (Itens do Rodapé Mobile até Início) */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <span className="font-mono text-[9px] font-black uppercase tracking-widest text-ink/70 px-1">
              Navegação
            </span>
            <nav className="flex flex-col gap-1" aria-label="Navegação principal">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.isActive;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={item.onClick}
                    className={`min-h-[38px] w-full text-left font-display text-xs tracking-tight py-1.5 px-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? 'bg-ink text-white shadow-[2px_2px_0_0_rgba(46,43,39,1)] font-black'
                        : 'text-ink/80 hover:text-ink hover:bg-black/5 hover:translate-x-0.5 border border-transparent hover:border-ink/15 font-semibold'
                    }`}
                    aria-label={`Ir para ${item.label}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                        isActive 
                          ? 'bg-accent-gold text-ink border-ink shadow-xs' 
                          : 'bg-white text-ink/70 border-ink/20'
                      }`}>
                        <Icon className="w-3.5 h-3.5 stroke-[2.2]" />
                      </div>
                      <span className="text-xs">{item.label}</span>
                    </div>

                    {isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-ink/30" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

        </div>

        {/* Lower Section: Verification and Transparency Links */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-dashed border-line/60">
          
          {/* Audit Badge */}
          <div className="flex items-center gap-2 bg-accent-gold/10 border border-accent-gold/20 p-2.5 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-gold shrink-0" />
            <span className="text-[9.5px] font-mono text-ink/85 leading-snug">
              {sidebarConfianca.includes(':') ? (
                <>
                  <strong className="text-accent-gold font-bold">{sidebarConfianca.split(':')[0]}:</strong>
                  {sidebarConfianca.substring(sidebarConfianca.indexOf(':') + 1)}
                </>
              ) : (
                sidebarConfianca
              )}
            </span>
          </div>

          {/* Institutional Links */}
          <div className="flex flex-col gap-1 text-[10px] font-mono text-ink/75">
            <button
              type="button"
              onClick={() => {
                if (pathname !== '/') {
                  router.push('/#como-funciona');
                } else {
                  const el = document.getElementById('como-funciona');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="min-h-[32px] text-left hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg px-1.5 hover:bg-black/5"
              aria-label="Ir para seção Como funciona"
            >
              <HelpCircle className="w-3 h-3 text-ink/70 shrink-0" />
              <span>Como funciona</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAffiliateModal(true)}
              className="min-h-[32px] text-left hover:text-accent-gold transition-colors cursor-pointer flex items-center gap-1.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg px-1.5 hover:bg-black/5"
              aria-label="Abrir modal de transparência Como Ganhamos Dinheiro"
            >
              <Info className="w-3 h-3 text-accent-gold shrink-0" />
              <span>Como Ganhamos Dinheiro</span>
            </button>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-ink/75 mt-0.5 border-t border-line/30 pt-1.5 font-sans font-medium">
              <Link 
                href="/contato"
                className="hover:text-primary transition-colors cursor-pointer py-0.5 min-h-[26px] flex items-center"
              >
                Contato
              </Link>
              <span className="py-0.5 text-ink/40">•</span>
              <Link 
                href="/termos"
                className="hover:text-primary transition-colors cursor-pointer py-0.5 min-h-[26px] flex items-center"
              >
                Termos
              </Link>
              <span className="py-0.5 text-ink/40">•</span>
              <Link 
                href="/privacidade"
                className="hover:text-primary transition-colors cursor-pointer py-0.5 min-h-[26px] flex items-center"
              >
                Privacidade
              </Link>
              <span className="py-0.5 text-ink/40">•</span>
              <Link 
                href="/admin/login"
                className="hover:text-primary transition-colors cursor-pointer py-0.5 min-h-[26px] flex items-center text-ink/60 hover:text-ink"
                title="Painel Administrativo"
              >
                Admin
              </Link>
            </div>

            <p className="text-[8.5px] text-ink/65 font-mono mt-0.5 leading-tight">
              © {new Date().getFullYear()} TuaVia.<br />Curadoria manual de e-bikes.
            </p>
          </div>

        </div>

      </aside>

      {/* Affiliate Transparency Modal */}
      {showAffiliateModal && (
        <div className="fixed inset-0 z-55 bg-ink/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border-2 border-ink p-6 rounded-[24px] max-w-md w-full shadow-[8px_8px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-2 border-b border-dashed border-line pb-3">
              <h3 className="font-serif font-black text-xl text-ink uppercase tracking-wide flex items-center gap-2">
                🤝 Transparência TuaVia
              </h3>
              <button
                onClick={() => setShowAffiliateModal(false)}
                className="text-ink hover:text-accent-gold text-sm font-mono font-bold border border-ink/20 px-2 py-1 rounded-lg hover:bg-neutral-50"
              >
                [Fechar]
              </button>
            </div>
            
            <p className="text-xs text-ink/85 leading-relaxed font-sans">
              No <strong>TuaVia</strong>, acreditamos na verdade integral. Nós não somos uma loja, não faturamos produtos e não cobramos taxas adicionais dos nossos leitores.
            </p>
            
            <p className="text-xs text-ink/85 leading-relaxed font-sans">
              Nossa operação de verificação manual de ofertas é financiada através de <strong>links de afiliados</strong>. Quando você clica em <span className="font-semibold text-primary">&quot;Ver Oferta&quot;</span> e conclui sua compra no site parceiro, nós podemos receber uma pequena comissão do lojista.
            </p>

            <div className="bg-primary/5 border border-primary/15 p-3 rounded-xl text-[11px] text-ink/75 font-mono">
              <strong className="text-primary uppercase tracking-wider block mb-1">Para você: Zero Custo</strong>
              O preço final da bicicleta é exatamente o mesmo (ou menor) do que se você entrasse na loja diretamente. A comissão sai da margem de marketing do lojista, nunca do seu bolso.
            </div>

            <p className="text-[11px] text-ink/50 italic leading-snug">
              Esse modelo nos permite manter um trabalho independente, conferindo preços manualmente todos os dias sem usar robôs que extraem dados desatualizados. Obrigado por apoiar nossa curadoria!
            </p>

            <button
              onClick={() => setShowAffiliateModal(false)}
              className="mt-2 w-full bg-ink hover:bg-ink/90 text-white font-mono text-xs py-3 rounded-xl transition-all font-bold cursor-pointer"
            >
              Entendido, Continuar Navegando
            </button>
          </div>
        </div>
      )}
    </>
  );
}
