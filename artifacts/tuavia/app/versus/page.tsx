import React, { Suspense } from 'react';
import ArenaClient from '@/components/arena/ArenaClient';
import Footer from '@/components/Footer';
import TrafficLightLoader from '@/components/TrafficLightLoader';
import { getPublishedBikesServer } from '@/lib/ebikes.server';

export const metadata = {
  title: 'Duelo Versus 1v1 de E-Bikes | Arena TuaVia',
  description: 'Confronte duas bicicletas elétricas frente a frente: especificações de motor, bateria, peso e menores preços com veredito técnico.',
};

export const revalidate = 60;

export default async function VersusPage() {
  const initialBikes = await getPublishedBikesServer();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col text-ink justify-between">
          <div className="flex-grow flex items-center justify-center py-24">
            <TrafficLightLoader label="Carregando confronto na Arena..." />
          </div>
          <Footer />
        </div>
      }
    >
      <ArenaClient initialBikes={initialBikes} />
    </Suspense>
  );
}
