import React, { Suspense } from 'react';
import SearchCatalog from '@/components/catalog/SearchCatalog';
import Footer from '@/components/Footer';
import TrafficLightLoader from '@/components/TrafficLightLoader';
import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import { getPublishedBikesServer } from '@/lib/ebikes.server';
import { getGroupedEBikes } from '@/lib/ebikes';

export const metadata = {
  title: 'Catálogo de E-Bikes e Filtros Inteligentes | TuaVia',
  description: 'Explore, filtre e compare bicicletas elétricas por preço, autonomia, marca, uso e potência com ofertas verificadas no Brasil.',
  alternates: {
    canonical: '/ebike',
  },
};

// ISR: revalidação incremental estática em background a cada 60 segundos
export const revalidate = 60;

export default async function EBikePage() {
  let initialBikes = [];
  try {
    initialBikes = await getPublishedBikesServer();
  } catch (err) {
    console.warn('[EBikePage] Falha ao carregar bikes no servidor, utilizando fallback local:', err);
    initialBikes = getGroupedEBikes(true);
  }

  if (!Array.isArray(initialBikes) || initialBikes.length === 0) {
    initialBikes = getGroupedEBikes(true);
  }

  return (
    <div className="min-h-screen flex flex-col justify-between text-ink relative" id="ebike-page-root">
      <main className="flex-grow relative z-10">
        <Suspense fallback={
          <div className="flex items-center justify-center py-24">
            <TrafficLightLoader label="Carregando catálogo de e-bikes..." />
          </div>
        }>
          <SearchCatalog initialBikes={initialBikes} />
        </Suspense>
        {/*
          Anúncio no fim da listagem, abaixo de todo o grid e antes do rodapé.
          Fora da barra de filtros e dos pills de categoria: anúncio perto de
          navegação é uma das causas mais comuns de reprovação no AdSense.
        */}
        <AdSenseBanner
          slotId={getAdSenseSlot('CATALOG_FOOTER')}
          slotName="CATALOGO_RODAPE"
          format="horizontal"
          minHeight={90}
        />
      </main>

      <Footer />
    </div>
  );
}
