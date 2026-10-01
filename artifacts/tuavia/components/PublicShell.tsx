'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';
import GlobalModals from '@/components/GlobalModals';
import SectionErrorBoundary from '@/components/ui/SectionErrorBoundary';
import { BG_CICLOVIA_DATA_URI } from '@/lib/bgCicloviaDataUri';

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname();
  const pathname = rawPathname || '';
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <main id="admin-root-content" className="min-h-screen w-full relative z-10">
        <SectionErrorBoundary sectionName="Painel Administrativo">
          {children}
        </SectionErrorBoundary>
      </main>
    );
  }

  return (
    <>
      {/* Background ciclovia FIXO centralizado apenas na coluna da direita no Desktop e em tela cheia no Mobile */}
      <div
        className="fixed inset-0 md:left-[210px] lg:left-[230px] xl:left-[245px] -z-10 pointer-events-none select-none overflow-hidden h-[100dvh] w-auto transform-gpu will-change-transform"
        aria-hidden="true"
      >
        <Image
          src={BG_CICLOVIA_DATA_URI}
          alt=""
          fill
          priority
          className="object-cover object-center w-full h-full select-none pointer-events-none"
          sizes="(min-width: 1280px) calc(100vw - 245px), (min-width: 1024px) calc(100vw - 230px), (min-width: 768px) calc(100vw - 210px), 100vw"
        />
      </div>

      {/* Layout principal do site público */}
      <div className="relative z-10 min-h-screen flex">
        {/* Sidebar esquerda (apenas telas grandes desktop) */}
        <SectionErrorBoundary sectionName="Sidebar">
          <React.Suspense fallback={<div className="hidden md:block md:w-[210px] lg:w-[230px] xl:w-[245px] bg-[#FAFAF7] h-screen border-r-2 border-[#2E2B27]/10 shrink-0 fixed top-0 left-0 z-30" />}>
            <Sidebar />
          </React.Suspense>
        </SectionErrorBoundary>

        {/* Coluna de conteúdo à direita */}
        <main
          id="main-scrollable-content"
          className="flex-1 min-w-0 md:ml-[210px] lg:ml-[230px] xl:ml-[245px] max-w-full relative z-10"
        >
          <div className="min-h-full flex flex-col">
            <SectionErrorBoundary sectionName="Conteúdo Principal">
              {children}
            </SectionErrorBoundary>
          </div>
        </main>
      </div>

      {/* Navegação móvel pública */}
      <SectionErrorBoundary sectionName="Navegação Móvel">
        <React.Suspense fallback={null}>
          <MobileBottomNav />
        </React.Suspense>
      </SectionErrorBoundary>

      {/* Modais Globais */}
      <SectionErrorBoundary sectionName="Modais Globais">
        <GlobalModals />
      </SectionErrorBoundary>
    </>
  );
}
