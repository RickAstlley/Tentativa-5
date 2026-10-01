'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Layers, Search, Info, Sparkles, FileText, ShieldCheck, Bike, Swords } from 'lucide-react';
import { motion } from 'motion/react';

export default function MobileBottomNav() {
  const [manualTab, setManualTab] = useState<number | null>(null);
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname || '';

  const publicTabs = [
    { id: 0, label: 'Início', icon: Home, href: '/' },
    { id: 1, label: 'Comparar', icon: Layers, href: '/comparar' },
    { id: 2, label: 'E-Bike', icon: Bike, href: '/ebike' },
    { id: 3, label: 'Artigos', icon: FileText, href: '/artigos' },
    { id: 4, label: 'Sobre', icon: Info, href: '#' },
  ];

  const tabs = publicTabs;
  const is1v1Active = pathname.startsWith('/arena') || pathname.startsWith('/versus');

  // Determina a aba ativa derivada da rota atual e interação do usuário
  const activeTab = React.useMemo(() => {
    if (pathname.startsWith('/arena') || pathname.startsWith('/versus')) {
      return manualTab !== null ? manualTab : -1;
    }
    if (pathname.startsWith('/comparar')) return 1;
    if (pathname === '/ebike' || pathname === '/pesquisa' || pathname.startsWith('/bike/')) return 2;
    if (pathname.startsWith('/artigos')) return 3;
    if (pathname === '/') return manualTab !== null ? manualTab : 0;
    return manualTab !== null ? manualTab : 0;
  }, [pathname, manualTab]);

  // Gera o caminho da onda suave sobreposta
  const getWavePath = (activeIndex: number) => {
    let d = 'M 0 16';
    const step = 400 / tabs.length;
    const curveOffset = step * 0.22;
    for (let i = 0; i < tabs.length; i++) {
      const startX = i * step;
      const midX = startX + step / 2;
      const endX = startX + step;
      const isActive = i === activeIndex;
      const valleyY = isActive ? 22 : 38;

      d += ` C ${startX + curveOffset} 16, ${midX - curveOffset} ${valleyY}, ${midX} ${valleyY}`;
      d += ` C ${midX + curveOffset} ${valleyY}, ${endX - curveOffset} 16, ${endX} 16`;
    }
    d += ' L 400 110 L 0 110 Z';
    return d;
  };

  const getBorderPath = (activeIndex: number) => {
    let d = 'M 0 16';
    const step = 400 / tabs.length;
    const curveOffset = step * 0.22;
    for (let i = 0; i < tabs.length; i++) {
      const startX = i * step;
      const midX = startX + step / 2;
      const endX = startX + step;
      const isActive = i === activeIndex;
      const valleyY = isActive ? 22 : 38;

      d += ` C ${startX + curveOffset} 16, ${midX - curveOffset} ${valleyY}, ${midX} ${valleyY}`;
      d += ` C ${midX + curveOffset} ${valleyY}, ${endX - curveOffset} 16, ${endX} 16`;
    }
    return d;
  };

  const currentWavePath = getWavePath(activeTab);
  const currentBorderPath = getBorderPath(activeTab);

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Navegação inferior mobile"
      className="fixed bottom-0 left-0 right-0 w-full z-[60] md:hidden pointer-events-auto select-none h-[82px] sm:h-[88px] pb-[env(safe-area-inset-bottom,0px)]"
    >
      {/* Botão 1v1 com o mesmo tamanho, largura, estilo e cor do botão de Filtro no canto inferior direito */}
      <div 
        className="fixed right-4 pointer-events-auto z-40"
        style={{ bottom: '96px' }}
      >
        <Link
          id="mobile-nav-1v1-btn"
          href="/arena"
          aria-label="Ir para a Arena de Duelo 1v1"
          className={`group relative flex items-center justify-center gap-1.5 font-mono font-black text-xs w-[110px] h-[38px] rounded-full border-2 border-ink shadow-[3px_3px_0_0_rgba(46,43,39,1)] active:scale-95 transition-all select-none touch-manipulation cursor-pointer ${
            is1v1Active 
              ? 'bg-accent-gold text-ink ring-2 ring-primary/50' 
              : 'bg-accent-gold hover:bg-accent-gold-dark text-ink'
          }`}
        >
          <Swords className="w-4 h-4 text-ink shrink-0" />
          <span className="tracking-wide">1v1</span>

          {/* Indicador de aba ativa */}
          {is1v1Active && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-charge border border-ink shadow-xs animate-pulse" />
          )}
        </Link>
      </div>

      <div className="relative w-full h-full pointer-events-auto overflow-hidden">
        
        {/* Fundo Ondulado em SVG cobrindo 100% da tela de ponta a ponta */}
        <svg 
          viewBox="0 0 400 110" 
          preserveAspectRatio="none" 
          className="absolute inset-0 w-full h-full filter drop-shadow-[0_-4px_12px_rgba(46,43,39,0.12)] pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="navWaveBgGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#F9F8F6" stopOpacity="1" />
            </linearGradient>
          </defs>
          
          {/* Preenchimento com initial={false} para renderização sem pulo lateral */}
          <motion.path
            initial={false}
            animate={{ d: currentWavePath }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            fill="url(#navWaveBgGradient)"
          />

          {/* Linha de borda superior ondulada cobrindo toda a largura horizontal */}
          <motion.path
            initial={false}
            animate={{ d: currentBorderPath }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            fill="none"
            stroke="#2E2B27"
            strokeWidth="2"
            strokeOpacity="0.85"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Preenchimento contínuo de safe-area na borda inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#F9F8F6] -z-10" />

        {/* Botões interativos posicionados sobre a onda de forma responsiva distribuída em 100% da largura */}
        <div className="absolute inset-0 w-full h-full flex items-start justify-between pointer-events-auto z-10" role="tablist">
          {tabs.map((tab, i) => {
            const isActive = activeTab === i;
            const Icon = tab.icon;

            const handleTabClick = (e?: React.MouseEvent) => {
              setManualTab(tab.id);
              const scrollContainer = document.getElementById('main-scrollable-content');

              if (tab.id === 0) {
                if (typeof window !== 'undefined' && window.location.hash) {
                  window.history.replaceState(null, '', '/');
                }
                if (pathname === '/') {
                  if (e) e.preventDefault();
                  if (scrollContainer) {
                    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              } else if (tab.id === 1) {
                if (pathname === '/comparar' && scrollContainer) {
                  if (e) e.preventDefault();
                  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }
              } else if (tab.id === 2) {
                if ((pathname === '/ebike' || pathname === '/pesquisa') && scrollContainer) {
                  if (e) e.preventDefault();
                  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }
              } else if (tab.id === 3) {
                if (pathname === '/artigos' && scrollContainer) {
                  if (e) e.preventDefault();
                  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }
              } else if (tab.id === 4) {
                if (e) e.preventDefault();
                window.dispatchEvent(new CustomEvent('open-about-drawer'));
              }
            };

            const content = (
              <>
                {/* Círculo do Ícone */}
                <motion.div
                  initial={false}
                  animate={{ 
                    y: isActive ? 4 : 14,
                    scale: isActive ? 1.08 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className={`relative flex items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                    isActive 
                      ? 'bg-primary text-accent-charge border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)]' 
                      : 'bg-white text-ink border-ink/80 shadow-xs hover:border-ink hover:bg-stone-50'
                  }`}
                  style={{ 
                    width: 'clamp(36px, 10vw, 44px)', 
                    height: 'clamp(36px, 10vw, 44px)' 
                  }}
                >
                  <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />

                  {/* Ponto indicador no botão ativo */}
                  {isActive && (
                    <motion.span 
                      layoutId="activeDot"
                      initial={false}
                      className="absolute -bottom-1 w-2 h-2 rounded-full bg-accent-charge border border-ink shadow-xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.div>

                {/* Texto do Botão */}
                <motion.span
                  initial={false}
                  animate={{ 
                    y: isActive ? 4 : 14,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className={`font-mono text-center tracking-tight transition-colors mt-0.5 whitespace-nowrap overflow-hidden ${
                    isActive ? 'text-ink font-black' : 'text-ink font-bold'
                  }`}
                  style={{ fontSize: 'clamp(9px, 2.5vw, 11px)' }}
                >
                  {tab.label}
                </motion.span>
              </>
            );

            const commonProps = {
              role: 'tab',
              'aria-selected': isActive,
              'aria-label': tab.label,
              className: 'absolute flex flex-col items-center justify-start pt-1 outline-none group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl min-w-[48px] min-h-[48px] touch-manipulation pointer-events-auto active:scale-95 transition-transform select-none',
              style: { 
                left: `${((i + 0.5) / tabs.length) * 100}%`, 
                transform: 'translateX(-50%)',
                width: 'clamp(48px, 18vw, 72px)',
                height: '100%'
              }
            };

            if (tab.href && tab.href !== '#') {
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  onClick={handleTabClick}
                  {...commonProps}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                type="button"
                key={tab.id}
                onClick={handleTabClick}
                {...commonProps}
              >
                {content}
              </button>
            );
          })}
        </div>

      </div>
    </nav>
  );
}


