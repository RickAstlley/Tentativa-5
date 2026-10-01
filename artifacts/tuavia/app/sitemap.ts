import { MetadataRoute } from 'next';
import { getGroupedEBikes } from '@/lib/ebikes';
import { getAllArticles } from '@/lib/articles';
import { getPublishedRankingsServer } from '@/lib/rankings.server';

// Assíncrono: as páginas dinâmicas (e-bikes, artigos, rankings) já usavam
// acesso a dados, e o Next aceita uma função async para a rota de sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rawBaseUrl = process.env.APP_URL || 'https://tuavia.com.br';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/ebike`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rankings`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/versus`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/comparar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/artigos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/termos`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacidade`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contato`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // Rankings publicados entram no sitemap. `/rankings` é uma página de
  // entrada de alto valor e estava de fora do sitemap inteiro.
  let rankingRoutes: MetadataRoute.Sitemap = [];
  try {
    const rankings = await getPublishedRankingsServer();
    rankingRoutes = rankings.map((ranking) => ({
      url: `${baseUrl}/rankings/${ranking.slug}`,
      lastModified: ranking.dataAtualizacao ? new Date(ranking.dataAtualizacao) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    rankingRoutes = [];
  }

  const bikes = getGroupedEBikes();
  const bikeRoutes: MetadataRoute.Sitemap = bikes.map((bike) => ({
    url: `${baseUrl}/bike/${bike.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const articles = getAllArticles();
  const articleRoutes: MetadataRoute.Sitemap = articles.map((article) => {
    const publishedDate = article.publishedAt.includes('T')
      ? new Date(article.publishedAt)
      : new Date(`${article.publishedAt}T00:00:00Z`);

    return {
      url: `${baseUrl}/artigos/${article.slug}`,
      lastModified: isNaN(publishedDate.getTime()) ? new Date() : publishedDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    };
  });

  return [...staticRoutes, ...rankingRoutes, ...bikeRoutes, ...articleRoutes];
}
