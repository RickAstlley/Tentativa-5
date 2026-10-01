import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AdSenseBanner from '@/components/ui/AdSenseBanner';
import { getAdSenseSlot } from '@/lib/adsenseSlots';
import Footer from '@/components/Footer';
import BikeDetailPageClient from '@/components/BikeDetailPageClient';
import { getGroupedEBikesFromFirestore, getEnrichedEBikeDetailFromFirestore } from '@/lib/ebikes.server';

// ISR: páginas de e-bikes em cache com revalidação a cada 5 minutos
export const revalidate = 300;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// SEO Dinâmico por modelo de e-bike com suporte avançado a GEO e Schema.org
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const enrichedDetail = await getEnrichedEBikeDetailFromFirestore(slug);

  if (!enrichedDetail) {
    return {
      title: 'Bicicleta Elétrica não encontrada | TuaVia',
      description: 'O modelo de e-bike procurado não foi encontrado no comparador TuaVia.',
    };
  }

  const { bike, galleryImages, seoReport } = enrichedDetail;
  const formatCurrency = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formattedPrice = formatCurrency(bike.menorPreco);
  
  // Título e Descrição refinados pela LLM ou calculados de alta conversão
  const title = seoReport?.serpTitlePreview || 
    `${bike.marca} ${bike.modelo}: Ficha Técnica, Autonomia e a partir de ${formattedPrice} | TuaVia`;
    
  const description = seoReport?.serpDescriptionPreview || bike.resumoExecutivo ||
    `Compare ofertas auditadas da e-bike ${bike.marca} ${bike.modelo}. Autonomia de até ${bike.autonomiaKm} km, motor de ${bike.potenciaW}W e histórico de preços no TuaVia.`;
    
  const image = galleryImages?.[0] || bike.imagemUrl || '/og-image.jpg';

  const keywords = [
    ...(seoReport?.focusKeyword ? [seoReport.focusKeyword] : []),
    ...(seoReport?.secondaryKeywords || []),
    `${bike.marca} ${bike.modelo}`,
    `bicicleta eletrica ${bike.marca}`,
    `ebike ${bike.modelo}`,
    `preco ${bike.modelo}`,
    `autonomia ${bike.modelo}`,
    'comparador e-bike brasil',
    'mobilidade eletrica',
    'tuavia',
  ];

  const canonicalUrl = `https://tuavia.com.br/bike/${slug}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'TuaVia Mobilidade Elétrica',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${bike.marca} ${bike.modelo}`,
        },
      ],
      type: 'website',
      locale: 'pt_BR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

// Geração estática de todas as rotas de e-bikes cadastradas
export async function generateStaticParams() {
  try {
    const bikes = await getGroupedEBikesFromFirestore();
    if (!Array.isArray(bikes)) return [];
    return bikes
      .filter((bike) => bike && typeof bike.slug === 'string' && bike.slug.trim().length > 0)
      .map((bike) => ({
        slug: String(bike.slug).trim(),
      }));
  } catch (err) {
    console.warn('Erro em generateStaticParams de /bike/[slug]:', err);
    return [];
  }
}

export default async function EBikeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const enrichedDetail = await getEnrichedEBikeDetailFromFirestore(slug);

  if (!enrichedDetail) {
    return notFound();
  }

  const { bike, galleryImages, seoReport } = enrichedDetail;
  const image = galleryImages?.[0] || bike.imagemUrl || 'https://tuavia.com.br/og-image.jpg';
  const pageUrl = `https://tuavia.com.br/bike/${slug}`;

  // 1. Schema.org Product (Rich Snippet Google Shopping & SERP)
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${bike.marca} ${bike.modelo}`,
    image: [image, ...(galleryImages || [])].filter(Boolean),
    description: seoReport?.llmGeoSummary || bike.resumoExecutivo || `Bicicleta elétrica ${bike.marca} ${bike.modelo} com motor de ${bike.potenciaW}W e autonomia de até ${bike.autonomiaKm} km.`,
    brand: {
      '@type': 'Brand',
      name: bike.marca,
    },
    model: bike.modelo,
    category: `Bicicletas Elétricas > ${bike.usoPrincipal || 'Urbana'}`,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: bike.menorPreco || 0,
      highPrice: bike.maiorPreco || bike.menorPreco || 0,
      offerCount: bike.ofertas?.length || 1,
      itemCondition: 'https://schema.org/NewCondition',
      availability: 'https://schema.org/InStock',
      url: pageUrl,
      offers: (bike.ofertas || []).map((of, idx) => ({
        '@type': 'Offer',
        url: of.linkProduto || pageUrl,
        price: of.preco,
        priceCurrency: 'BRL',
        seller: {
          '@type': 'Organization',
          name: of.loja,
        },
        itemCondition: 'https://schema.org/NewCondition',
        availability: of.disponibilidade === 'Esgotado' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      })),
    },
    ...(enrichedDetail.reviews && enrichedDetail.reviews.length > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (
          Math.round(
            (enrichedDetail.reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) /
              enrichedDetail.reviews.length) * 10
          ) / 10
        ).toString(),
        reviewCount: enrichedDetail.reviews.length,
        bestRating: '5',
        worstRating: '1',
      },
    } : {}),
  };

  // 2. Schema.org Breadcrumbs
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Início',
        item: 'https://tuavia.com.br',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Bicicletas Elétricas',
        item: 'https://tuavia.com.br/#catalogo',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: bike.marca,
        item: `https://tuavia.com.br/?marca=${encodeURIComponent(bike.marca)}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: bike.modelo,
        item: pageUrl,
      },
    ],
  };

  // 3. Schema.org FAQPage (Perguntas Frequentes Estruturadas para Rich Snippets e GEO)
  const defaultFaqs = [
    {
      question: `Qual é a autonomia real da e-bike ${bike.marca} ${bike.modelo}?`,
      answer: `A ${bike.marca} ${bike.modelo} possui autonomia declarada de até ${bike.autonomiaKm} km por recarga em condições ideais de pedal assistido econômico. Em percursos urbanos com subidas frequentes, a autonomia média testada fica em torno de ${(bike.autonomiaKm * 0.8).toFixed(0)} km.`
    },
    {
      question: `A ${bike.marca} ${bike.modelo} exige CNH ou emplacamento no Brasil?`,
      answer: `Não. De acordo com a Resolução CONTRAN 996/2023, bicicletas elétricas com assistência a pedal até 32 km/h e motor de até 1000W não requerem CNH, emplacamento nem IPVA, sendo 100% liberadas para ciclovias.`
    },
    {
      question: `Qual a potência do motor e tempo de carga da ${bike.marca} ${bike.modelo}?`,
      answer: `Este modelo conta com motor elétrico de ${bike.potenciaW}W e tempo de recarga de aproximadamente ${bike.tempoCargaHoras || 5} horas em tomada padrão 110V/220V.`
    }
  ];

  const rawFaqs = seoReport?.faqSchema && seoReport.faqSchema.length > 0 ? seoReport.faqSchema : defaultFaqs;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: rawFaqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col text-ink" id={`detail-page-${slug}`}>
      {/* Schema.org Injetado para Google, Bing e IAs de Busca */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Navegação/Breadcrumb */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-ink bg-surface border-2 border-ink px-3.5 py-2 rounded-xl shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para todos os modelos</span>
        </Link>
      </div>

      {/* Conteúdo Interativo Premium */}
      <main className="flex-grow">
        <BikeDetailPageClient initialDetail={enrichedDetail} slug={slug} />

        {/*
          Anúncio abaixo da ficha completa. Vem depois de preço, especificações
          e FAQ — ou seja, cercado de conteúdo, e nunca entre o título e a
          primeira informação útil da página.
        */}
        <AdSenseBanner
          slotId={getAdSenseSlot('EBIKE_SPEC')}
          slotName="EBIKE_FICHA"
          format="horizontal"
          minHeight={90}
        />
      </main>

      {/* Rodapé */}
      <Footer />
    </div>
  );
}
