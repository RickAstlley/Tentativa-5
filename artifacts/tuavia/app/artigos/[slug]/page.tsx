import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllArticles } from '@/lib/articles';
import { getArticleBySlugFromFirestore, getAllArticlesFromFirestore } from '@/lib/articles.server';
import { getGroupedEBikesFromFirestore } from '@/lib/ebikes.server';
import ArticleClientContent from './ArticleClientContent';

// ISR: páginas de artigos geradas e armazenadas em cache, revalidando a cada 5 minutos
export const revalidate = 300;

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlugFromFirestore(slug);

  if (!article) {
    return {
      title: 'Artigo | TuaVia',
    };
  }

  return {
    title: `${article.title} | TuaVia`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.coverImage],
      type: 'article',
      publishedTime: article.publishedAt,
    },
  };
}

export default async function ArticleDetailPage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const [article, allArticles, allBikes] = await Promise.all([
    getArticleBySlugFromFirestore(slug),
    getAllArticlesFromFirestore(),
    getGroupedEBikesFromFirestore(),
  ]);

  const currentIndex = article ? allArticles.findIndex((a) => a.slug === article.slug) : -1;
  const prevArticle = currentIndex > 0 ? allArticles[currentIndex - 1] : undefined;
  const nextArticle = currentIndex >= 0 && currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : undefined;

  // E-bikes relacionadas por categoria do artigo
  const relatedCategories = article?.relatedBikeCategories || [];
  const relatedBikes = allBikes.filter((bike) => 
    relatedCategories.includes(bike.usoPrincipal)
  ).slice(0, 3);

  // Outros artigos sugeridos ao final
  const otherArticles = allArticles
    .filter((a) => !article || a.slug !== article.slug)
    .slice(0, 3);

  return (
    <ArticleClientContent
      article={article}
      slug={slug}
      relatedBikes={relatedBikes}
      otherArticles={otherArticles}
      prevArticle={prevArticle}
      nextArticle={nextArticle}
    />
  );
}
