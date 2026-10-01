import React, { Suspense } from 'react';
import ArenaClient from '@/components/arena/ArenaClient';
import Footer from '@/components/Footer';
import TrafficLightLoader from '@/components/TrafficLightLoader';
import { getPublishedBikesServer } from '@/lib/ebikes.server';

export const metadata = {
  title: 'Arena de Duelo 1v1 de E-Bikes | Confronto Técnico Round a Round | TuaVia',
  description: 'Confronte duas bicicletas elétricas na Arena 1v1 TuaVia: motor e subidas, bateria, peso real, freios e menor preço auditado com veredito técnico dos especialistas.',
};

// ISR: revalidação incremental estática em background a cada 60 segundos
export const revalidate = 60;

export default async function ArenaPage() {
  const initialBikes = await getPublishedBikesServer();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col text-ink justify-between">
          <div className="flex-grow flex items-center justify-center py-24">
            <TrafficLightLoader label="Preparando Arena de Duelo 1v1 de E-Bikes..." />
          </div>
          <Footer />
        </div>
      }
    >
      <ArenaClient initialBikes={initialBikes} />
    </Suspense>
  );
}
