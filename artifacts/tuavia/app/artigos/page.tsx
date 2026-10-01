import React, { Suspense } from 'react';
import ArticlesCatalog from '@/components/artigos/ArticlesCatalog';
import Footer from '@/components/Footer';
import TrafficLightLoader from '@/components/TrafficLightLoader';
import { getPublishedArticlesServer } from '@/lib/articles.server';
import { getPublishedRankingsServer } from '@/lib/rankings.server';

// ISR: revalidação incremental estática em background
export const revalidate = 60;

export const metadata = {
  title: 'Artigos, Dossiês e Top Rankings | TuaVia',
  description: 'Matérias sobre bicicletas elétricas, autonomia de baterias, testes de motores, regulamentação do CONTRAN e Top Rankings comparativos.',
};

export default async function ArticlesPage() {
  const [initialArticles, initialRankings] = await Promise.all([
    getPublishedArticlesServer(),
    getPublishedRankingsServer(),
  ]);

  return (
    <div className="min-h-screen flex flex-col justify-between text-ink relative" id="articles-page-root">
      <main className="flex-grow relative z-10">
        <Suspense fallback={
          <div className="flex items-center justify-center py-24">
            <TrafficLightLoader label="Carregando artigos e top rankings..." />
          </div>
        }>
          <ArticlesCatalog initialArticles={initialArticles} initialRankings={initialRankings} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
