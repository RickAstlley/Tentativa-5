import React, { Suspense } from 'react';
import CompararClient from '@/components/comparar/CompararClient';
import Footer from '@/components/Footer';
import TrafficLightLoader from '@/components/TrafficLightLoader';
import { getPublishedBikesServer } from '@/lib/ebikes.server';

export const metadata = {
  title: 'Comparador de E-Bikes e Fichas Técnicas Lado a Lado | TuaVia',
  description: 'Compare potência, autonomia de bateria, tempo de recarga, peso e preços das principais bicicletas elétricas do Brasil.',
};

// ISR: revalidação incremental estática em background
export const revalidate = 60;

export default async function CompararPage() {
  const initialBikes = await getPublishedBikesServer();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col text-ink justify-between">
          <div className="flex-grow flex items-center justify-center py-24">
            <TrafficLightLoader label="Preparando comparador de e-bikes..." />
          </div>
          <Footer />
        </div>
      }
    >
      <CompararClient initialBikes={initialBikes} />
    </Suspense>
  );
}

