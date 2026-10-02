'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import SafeImage from '@/components/ui/SafeImage';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Star, 
  CheckCircle,
  Clock,
  Gauge,
  Zap,
  Scale,
  Layers,
  Search,
  X,
  Maximize2,
  ArrowRight,
  GitFork,
  ShoppingCart,
  ArrowDown,
  Award,
  Tag,
  UserCheck,
  Compass,
  TrendingDown
} from 'lucide-react';
import { EnrichedEBikeDetail, EBikeStoreOffer, EBikeGrouped, EBikeReview, EBikeSpecSection } from '@/types/ebike';
import { getGroupedEBikes, getEnrichedEBikeDetail, buildEnrichedDetailFromBike } from '@/lib/ebikes';

// Subcomponentes modulares
import OffersTable from '@/components/detail/OffersTable';
import SpecificationsAccordion from '@/components/detail/SpecificationsAccordion';
import PriceHistoryChart from '@/components/detail/PriceHistoryChart';
import ReviewsSection from '@/components/detail/ReviewsSection';
import CommunityCommentsSection from '@/components/detail/CommunityCommentsSection';
import BikeFAQSection from '@/components/detail/BikeFAQSection';
import RelatedSimilarBikes from '@/components/detail/RelatedSimilarBikes';

interface BikeDetailPageClientProps {
  initialDetail?: EnrichedEBikeDetail | null;
  slug?: string;
}

/**
 * Capacidade da bateria em Wh, lida das seções canônicas.
 *
 * A capacidade não mora em campo próprio da e-bike: `EBikeGrouped` não tem
 * `bateria`, e quem escreve o valor é o alocador, na seção 3 "Bateria &
 * Energia", campo "Capacidade Total" — no formato "499 Wh" ou "624 Wh".
 *
 * Antes o código lia `detail.especificacoes.bateria.capacidadeWh`, que não
 * existe em tipo nenhum: vinha `undefined` e o card de autonomia usava a
 * estimativa padrão. Retorna `undefined` quando a ficha não traz o campo, e o
 * `RealRangeComparisonCard` cai na própria estimativa.
 */
function capacidadeWhFicha(specSections: EBikeSpecSection[] | undefined): number | undefined {
  for (const section of specSections ?? []) {
    for (const item of section.items ?? []) {
      if (!/capacidade\s*total/i.test(item.label ?? '')) continue;
      const wh = Number(String(item.value ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
      if (Number.isFinite(wh) && wh > 0) return wh;
    }
  }
  return undefined;
}

export default function BikeDetailPageClient({ initialDetail, slug }: BikeDetailPageClientProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<EnrichedEBikeDetail | null>(initialDetail || null);
  const [allBikes, setAllBikes] = useState<EBikeGrouped[]>(() => getGroupedEBikes(false));
  const [loading, setLoading] = useState<boolean>(!initialDetail);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    setAllBikes(getGroupedEBikes(true));
  }, []);

  // Resolução resiliente para carregar e sincronizar detalhes da e-bike
  useEffect(() => {
    if (!slug) return;

    // 1. Se o servidor forneceu initialDetail (do Firestore Admin ou arquivo publicado do servidor), utiliza prioritariamente
    if (initialDetail && initialDetail.bike) {
      setDetail(initialDetail);
      setLoading(false);
      return;
    }

    // 2. Busca via API /api/bikes?slug=...
    fetch(`/api/bikes?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.bike) {
          setDetail(buildEnrichedDetailFromBike(data.bike));
          setLoading(false);
        } else {
          // Fallback no catálogo estático local se a API não encontrar
          const localDetail = getEnrichedEBikeDetail(slug, true);
          if (localDetail) {
            setDetail(localDetail);
          } else {
            setNotFound(true);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        const localDetail = getEnrichedEBikeDetail(slug, true);
        if (localDetail) {
          setDetail(localDetail);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [initialDetail, slug]);

  const bike = detail?.bike;
  const verdict = detail?.verdict || '';
  const reviews = useMemo(() => detail?.reviews || [], [detail?.reviews]);
  const rating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);
  const reviewCount = reviews.length;
  const pros = detail?.pros || [];
  const cons = detail?.cons || [];
  const idealFor = detail?.idealFor || '';
  const specSections = detail?.specSections || [];
  const priceHistory = detail?.priceHistory || [];
  const showPriceChart = detail?.showPriceChart ?? bike?.showPriceChart ?? true;
  const seoReport = detail?.seoReport || bike?.seoReport;
  // `EBikeSEOReport` não tem `badge` — o termo do meio era sempre `undefined`
  // e só poluía a cadeia de fallback.
  const badge = bike?.badge || detail?.badge;
  const tagOferta = bike?.tagOferta || detail?.bike?.tagOferta;
  const targetPersona = seoReport?.targetBuyerPersona;
  const secondaryKeywords = seoReport?.secondaryKeywords || [];

  const handleReviewAdded = (newReview: EBikeReview) => {
    setDetail((prev) => {
      if (!prev) return prev;
      const updatedReviews = [newReview, ...(prev.reviews || [])];
      const sum = updatedReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      const newRating = Math.round((sum / updatedReviews.length) * 10) / 10;
      return {
        ...prev,
        reviews: updatedReviews,
        rating: newRating,
        reviewCount: updatedReviews.length,
      };
    });
  };
  
  // Garante que a galeria priorize estritamente a imagem principal (index 0) e as adicionais do admin
  const galleryImages = useMemo(() => {
    if (!bike) return [];
    const list: string[] = [];
    if (bike.imagemUrl && typeof bike.imagemUrl === 'string' && bike.imagemUrl.trim().length > 0) {
      list.push(bike.imagemUrl.trim());
    }
    if (bike.galleryImages && Array.isArray(bike.galleryImages)) {
      bike.galleryImages.forEach((img) => {
        if (typeof img === 'string' && img.trim().length > 0) {
          const clean = img.trim();
          if (!list.includes(clean)) {
            list.push(clean);
          }
        }
      });
    }
    if (list.length === 0 && detail?.galleryImages && detail.galleryImages.length > 0) {
      return detail.galleryImages;
    }
    return list.length > 0 ? list : ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'];
  }, [bike, detail]);

  const [activeImage, setActiveImage] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareSearch, setCompareSearch] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>(bike?.slug ? [bike.slug] : []);

  const [expandedSpecs, setExpandedSpecs] = useState<Record<number, boolean>>({
    0: true, // Começa com o primeiro bloco (Motor) aberto
  });
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, number>>({});
  const [votedReviews, setVotedReviews] = useState<Record<string, boolean>>({});
  const [clickCount, setClickCount] = useState(0);
  const [lastClickedStore, setLastClickedStore] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const maxEconomy = bike ? bike.maiorPreco - bike.menorPreco : 0;

  // Toggle para abrir/fechar blocos de especificações técnicas
  const toggleSpecSection = (index: number) => {
    setExpandedSpecs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Voto de utilidade para comentários de usuários
  const handleHelpfulClick = (reviewId: string) => {
    if (votedReviews[reviewId]) return; // Evita voto duplo
    setVotedReviews(prev => ({ ...prev, [reviewId]: true }));
    setHelpfulVotes(prev => ({
      ...prev,
      [reviewId]: (prev[reviewId] || 0) + 1
    }));
  };

  // Adiciona/Remove bike no comparador do modal
  const handleToggleCompareBike = (targetSlug: string) => {
    if (selectedForCompare.includes(targetSlug)) {
      if (targetSlug === bike?.slug) return; // Não remove a própria bike da página
      setSelectedForCompare(prev => prev.filter(s => s !== targetSlug));
    } else {
      if (selectedForCompare.length >= 3) return;
      setSelectedForCompare(prev => [...prev, targetSlug]);
    }
  };

  // Redireciona para a matriz de comparação
  const handleGoToCompare = () => {
    router.push(`/comparar?slugs=${selectedForCompare.join(',')}`);
  };

  // Candidatas para o modal de comparação rápida
  const candidateBikes = useMemo(() => {
    if (!bike) return [];
    return allBikes.filter(b => 
      b.slug !== bike.slug && 
      (b.modelo.toLowerCase().includes(compareSearch.toLowerCase()) ||
       b.marca.toLowerCase().includes(compareSearch.toLowerCase()))
    );
  }, [allBikes, bike, compareSearch]);

  // Se a bike não foi encontrada e já terminou de carregar
  if (!loading && (!bike || notFound)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border-2 border-ink rounded-2xl p-8 shadow-[6px_6px_0_0_rgba(46,43,39,1)] text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto text-amber-700">
            <Search className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-ink">E-Bike Não Encontrada</h2>
          <p className="text-xs font-mono text-neutral-600">
            O modelo procurado ({slug || 'desconhecido'}) não foi localizado no catálogo ou foi despublicado.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="px-4 py-2.5 bg-primary hover:bg-emerald-700 text-white font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all"
            >
              Voltar ao Início
            </Link>
            <Link
              href="/catalogo"
              className="px-4 py-2.5 bg-surface hover:bg-neutral-100 text-ink font-mono font-bold text-xs rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] transition-all"
            >
              Explorar Todas as E-Bikes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Simula clique de conversão na oferta
  const handleStoreRedirect = (e: React.MouseEvent<HTMLAnchorElement>, offer: EBikeStoreOffer) => {
    e.preventDefault();
    setClickCount(prev => prev + 1);
    setLastClickedStore(offer.loja);
    
    // Dispara evento GA4 de conversão
    window.gtag?.('event', 'click_oferta', {
      marca: bike.marca,
      modelo: bike.modelo,
      loja: offer.loja,
      preco: offer.preco,
      oferta_id: offer.id,
    });

    setTimeout(() => {
      setLastClickedStore(null);
      window.open(offer.linkProduto, '_blank', 'noopener,noreferrer');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col text-ink font-sans" id={`detail-client-${bike.slug}`}>
      <main className="flex-grow py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* Breadcrumb e Retorno em Grid Branco de Alto Contraste */}
        <div className="bg-white border-2 border-ink rounded-xl p-3 shadow-[2px_2px_0_0_rgba(46,43,39,1)] flex flex-wrap items-center justify-between gap-3">
          <nav className="inline-flex items-center gap-2 text-xs font-mono font-bold text-ink flex-wrap">
            <Link 
              href="/" 
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-ink px-2.5 py-1 rounded-lg border border-ink transition-all shadow-[1px_1px_0_0_rgba(46,43,39,1)] cursor-pointer text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Voltar aos Modelos</span>
            </Link>
            <span className="text-ink/40">•</span>
            <Link href="/" className="hover:text-primary transition-colors text-ink">Home</Link>
            <span className="text-primary font-bold">→</span>
            <Link href={`/catalogo?uso=${encodeURIComponent(bike.usoPrincipal)}`} className="hover:text-primary transition-colors text-ink">{bike.usoPrincipal}</Link>
            <span className="text-primary font-bold">→</span>
            <span className="text-primary font-extrabold truncate max-w-[220px]">{bike.modelo}</span>
          </nav>
          <span className="text-[10px] font-mono font-bold text-accent-gold bg-accent-gold/15 px-2.5 py-1 rounded-lg uppercase tracking-wider border border-accent-gold/30">
            ★ Auditado &amp; Verificado Manualmente
          </span>
        </div>

        {/* SKELETON LOADER INTELIGENTE (Evita Cumulative Layout Shift) */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 w-full"
            >
              <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                {/* Esquerda Skeleton (70%) */}
                <div className="w-full lg:w-[70%] flex flex-col gap-6">
                  <div className="bg-white border-2 border-line rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                    <div className="w-48 h-6 bg-neutral-200 rounded animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="aspect-[4/3] bg-neutral-200 animate-pulse rounded-xl" />
                      <div className="flex flex-col gap-3">
                        <div className="w-32 h-8 bg-neutral-200 rounded animate-pulse" />
                        <div className="w-full h-12 bg-neutral-100 rounded-xl animate-pulse" />
                        <div className="w-full h-24 bg-neutral-100 rounded-xl animate-pulse" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border-2 border-line rounded-2xl p-5 shadow-sm h-48 animate-pulse" />
                  <div className="bg-white border-2 border-line rounded-2xl p-5 shadow-sm h-64 animate-pulse" />
                </div>

                {/* Direita Skeleton (30%) */}
                <div className="w-full lg:w-[30%] flex flex-col gap-4">
                  <div className="bg-white border-2 border-line rounded-2xl p-5 shadow-sm h-96 animate-pulse" />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6 w-full"
            >
              {/* CONTAINER PRINCIPAL DE 2 COLUNAS: ESQUERDA (70%) + DIREITA TRAVADA STICKY (30%) */}
              <div className="flex flex-col lg:flex-row gap-6 items-start w-full relative">
                
                {/* ========================================================================= */}
                {/* COLUNA ESQUERDA (70%): INFORMAÇÕES DA E-BIKE, FOTO, PREÇO, GRÁFICO, BOTÃO LOJAS, CONTRAN 996, VEREDITO E SPECS */}
                {/* ========================================================================= */}
                <div className="w-full lg:w-[70%] flex flex-col gap-6 min-w-0">
                  
                  {/* CARD DO TOPO: FOTO DA E-BIKE, MENOR PREÇO, GRÁFICO DE HISTÓRICO E BOTÃO PARA ROLAR ATÉ AS LOJAS */}
                  <div className="bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-5 animate-in fade-in duration-500">
                    
                    {/* Cabeçalho do Card: Marca, Badges de Verificação e Título */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                            Fabricante: {bike.marca}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-ink/75 uppercase tracking-wider bg-neutral-100 border border-line/70 px-2 py-0.5 rounded">
                            {bike.usoPrincipal}
                          </span>

                          {badge && (
                            <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-600/35 text-amber-900 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-lg shadow-2xs">
                              <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{badge}</span>
                            </div>
                          )}

                          {tagOferta && (
                            <div className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-800 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-lg shadow-2xs">
                              <Tag className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>{tagOferta}</span>
                            </div>
                          )}
                        </div>

                        <h1 className="font-display font-black text-ink tracking-tight mt-0.5 text-xl sm:text-2xl lg:text-3xl">
                          {bike.modelo}
                        </h1>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 bg-accent-verde/15 border border-accent-verde/30 rounded-lg px-2.5 py-1 text-accent-verde text-xs font-mono font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-accent-verde shrink-0" />
                          <span className="text-[11px]">Auditado &amp; Verificado</span>
                        </div>
                      </div>
                    </div>

                    {/* Grade Interna Superior: Galeria de Fotos (Esquerda) vs Preço, Botão Rolar Lojas e Métricas (Direita) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                      
                      {/* Galeria de Fotos da E-Bike */}
                      <div className="flex flex-col gap-3">
                        <div 
                          className="relative w-full h-[220px] sm:h-[260px] rounded-xl overflow-hidden bg-neutral-50 p-4 border-2 border-ink/80 flex items-center justify-center group"
                        >
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={activeImage}
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="relative w-full h-full cursor-zoom-in"
                              onClick={() => setIsZoomOpen(true)}
                            >
                              <SafeImage
                                src={galleryImages[activeImage]}
                                alt={`${bike.modelo} - Foto ${activeImage + 1}`}
                                variant="card"
                                priority
                                className="object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                              />
                            </motion.div>
                          </AnimatePresence>

                          <button
                            onClick={() => setIsZoomOpen(true)}
                            className="absolute bottom-2.5 right-2.5 bg-ink/85 hover:bg-ink text-white p-1.5 px-2.5 rounded-lg border border-white/20 backdrop-blur-md transition-all shadow-sm cursor-pointer flex items-center gap-1.5 font-mono font-bold text-xs"
                            title="Ampliar Imagem"
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-accent-charge" />
                            <span className="hidden sm:inline text-[11px]">Ampliar</span>
                          </button>
                        </div>

                        {/* Miniaturas de Fotos */}
                        <div className="grid grid-cols-4 gap-2">
                          {galleryImages.map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveImage(idx)}
                              className={`relative h-12 sm:h-14 rounded-lg overflow-hidden bg-neutral-50 p-1 border transition-all duration-200 cursor-pointer ${
                                activeImage === idx 
                                  ? 'border-primary ring-2 ring-primary/25 bg-white shadow-xs' 
                                  : 'border-line hover:border-primary/50 hover:bg-neutral-50'
                              }`}
                              aria-label={`Ver imagem ${idx + 1}`}
                            >
                              <SafeImage
                                src={img}
                                alt="Miniatura"
                                variant="thumb"
                                className="object-contain p-0.5"
                              />
                            </button>
                          ))}
                        </div>

                        {/* Botão de Comparação Rápida */}
                        <button
                          type="button"
                          onClick={() => setIsCompareModalOpen(true)}
                          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-neutral-100 text-ink border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:translate-x-[1px] hover:translate-y-[1px] py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer select-none mt-1"
                        >
                          <GitFork className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>Comparar este modelo com outros</span>
                        </button>
                      </div>

                      {/* Informações de Preço, Economia, Botão para Rolar até Lojas e Métricas */}
                      <div className="flex flex-col gap-3.5">
                        
                        {/* Menor Preço e Economia */}
                        <div className="bg-neutral-50 border-2 border-ink/40 rounded-xl p-3.5 flex flex-col gap-1.5 shadow-xs">
                          <span className="text-[10px] font-mono text-ink/60 uppercase font-bold">Ofertas a partir de</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono font-black text-ink tracking-tight text-2xl sm:text-3xl">
                              {formatCurrency(bike.menorPreco)}
                            </span>
                          </div>

                          {maxEconomy > 0 ? (
                            <div className="flex items-center gap-1.5 bg-accent-charge/20 border border-accent-charge/40 rounded-lg p-2 mt-0.5">
                              <TrendingDown className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-mono text-xs font-bold text-primary">
                                Economia de até {formatCurrency(maxEconomy)} entre lojas
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-white border border-line/70 rounded-lg p-2 mt-0.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-mono text-[11px] text-ink/75 font-semibold">
                                Cotação única com estoque verificado
                              </span>
                            </div>
                          )}
                        </div>

                        {/* BOTÃO PRINCIPAL DE CONVERSÃO: ROLAR ATÉ AS LOJAS (FULL WIDTH NA SEÇÃO DE PREÇO) */}
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById('tabela-ofertas')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="w-full h-12 bg-primary hover:bg-primary-dark text-white border-2 border-ink rounded-xl font-mono font-black text-xs sm:text-sm shadow-[3px_3px_0_0_rgba(46,43,39,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2.5 cursor-pointer relative overflow-hidden group select-none"
                        >
                          <ShoppingCart className="w-4 h-4 text-accent-charge shrink-0" />
                          <span>
                            Ver Ofertas ({bike.ofertas?.length || 1} {(bike.ofertas?.length || 1) === 1 ? 'loja encontrada' : 'lojas encontradas'})
                          </span>
                          <ArrowDown className="w-4 h-4 text-accent-charge shrink-0 group-hover:translate-y-0.5 transition-transform" />
                        </button>

                        {clickCount > 0 && (
                          <div className="flex items-center gap-2 bg-accent-verde/15 border border-accent-verde/30 rounded-lg px-3 py-1.5 text-xs font-mono text-accent-verde">
                            <CheckCircle className="w-3.5 h-3.5 text-accent-verde shrink-0" />
                            <span><strong>{clickCount}</strong> {clickCount === 1 ? 'redirecionamento com sucesso' : 'redirecionamentos com sucesso'}</span>
                          </div>
                        )}

                        {/* Métricas Rápidas de Engenharia */}
                        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                          <div className="bg-neutral-50 border border-line/80 rounded-lg p-1.5 flex flex-col items-center text-center">
                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-ink/60 uppercase">
                              <Gauge className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate">Auton.</span>
                            </div>
                            <span className="font-mono font-black text-ink text-xs mt-0.5">
                              {bike.autonomiaKm ? `${bike.autonomiaKm}km` : 'N/D'}
                            </span>
                          </div>
                          <div className="bg-neutral-50 border border-line/80 rounded-lg p-1.5 flex flex-col items-center text-center">
                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-ink/60 uppercase">
                              <Zap className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate">Potência</span>
                            </div>
                            <span className="font-mono font-black text-ink text-xs mt-0.5">
                              {bike.potenciaW ? `${bike.potenciaW}W` : 'N/D'}
                            </span>
                          </div>
                          <div className="bg-neutral-50 border border-line/80 rounded-lg p-1.5 flex flex-col items-center text-center">
                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-ink/60 uppercase">
                              <Scale className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">Peso</span>
                            </div>
                            <span className="font-mono font-black text-ink text-xs mt-0.5">
                              {bike.pesoKg ? `${bike.pesoKg}kg` : 'N/D'}
                            </span>
                          </div>
                          <div className="bg-neutral-50 border border-line/80 rounded-lg p-1.5 flex flex-col items-center text-center">
                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-ink/60 uppercase">
                              <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate">Carga</span>
                            </div>
                            <span className="font-mono font-black text-ink text-xs mt-0.5">
                              {bike.tempoCargaHoras ? `${bike.tempoCargaHoras}h` : 'N/D'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-neutral-50/80 border border-line/60 rounded-xl p-2.5 text-xs text-ink/75 leading-relaxed">
                          <ShieldCheck className="w-3.5 h-3.5 text-accent-verde shrink-0 mt-0.5" />
                          <div className="text-[10.5px]">
                            <strong>Garantia TuaVia:</strong> Cotações checadas e auditadas manualmente. Sem links quebrados ou promoções falsas.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Gráfico de Histórico de Preço (Caso Tenha) */}
                    {showPriceChart && (
                      <div className="w-full pt-3 border-t border-line">
                        <PriceHistoryChart priceHistory={priceHistory || []} />
                      </div>
                    )}
                  </div>

                  {/* SELO DE CONFORMIDADE REGULATÓRIA CONTRAN 996/2023 */}
                  <div className="bg-emerald-50 border-2 border-ink rounded-2xl p-4 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex items-start gap-3.5">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl border border-ink shadow-xs shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-emerald-950 uppercase tracking-wide">
                          Selo de Conformidade CONTRAN 996/2023
                        </span>
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-200 border border-emerald-400 px-2 py-0.5 rounded">
                          100% Isenta de CNH e IPVA
                        </span>
                      </div>
                      <p className="text-xs text-ink/85 mt-1 leading-relaxed">
                        Classificada legalmente como <strong>Bicicleta Elétrica Assistida</strong>. Isenta de emplacamento, taxa de licenciamento e CNH. 100% autorizada para circulação em ciclovias e ciclofaixas em todo território brasileiro.
                      </p>
                    </div>
                  </div>

                  {/* RESUMO EXECUTIVO DA ESCOLHA & VEREDITO EDITORIAL */}
                  <div className="w-full bg-white border-2 border-ink rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] flex flex-col gap-4 animate-in fade-in duration-500">
                    <div className="flex items-center gap-2.5 border-b border-line pb-3">
                      <div className="p-1.5 bg-accent-gold/20 rounded-lg border border-accent-gold/40 text-ink">
                        <Sparkles className="w-4 h-4 text-accent-gold" />
                      </div>
                      <div>
                        <h3 className="font-display font-black text-ink uppercase tracking-wider text-sm sm:text-base">
                          Resumo Executivo da Escolha
                        </h3>
                        <p className="text-[11px] text-ink/70 font-mono">
                          Análise editorial técnica independente elaborada por especialistas em mobilidade elétrica.
                        </p>
                      </div>
                    </div>

                    <div className="text-ink leading-relaxed bg-primary/8 border border-primary/20 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm">
                      <strong className="text-primary font-bold">Veredito TuaVia:</strong> {verdict}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Prós */}
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-2.5">
                        <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase flex items-center gap-1.5 bg-emerald-100/90 border border-emerald-300/70 px-2.5 py-0.5 rounded-md w-fit">
                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" /> Pontos Fortes (Prós)
                        </span>
                        <ul className="flex flex-col gap-1.5 text-ink/85 text-xs leading-normal font-sans">
                          {pros.map((pro, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold select-none shrink-0 text-xs">✓</span>
                              <span className="break-words">{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Contras */}
                      <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-3.5 flex flex-col gap-2.5">
                        <span className="text-[10px] font-mono font-bold text-rose-800 uppercase flex items-center gap-1.5 bg-rose-100/90 border border-rose-300/70 px-2.5 py-0.5 rounded-md w-fit">
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Pontos de Atenção (Contras)
                        </span>
                        <ul className="flex flex-col gap-1.5 text-ink/85 text-xs leading-normal font-sans">
                          {cons.map((con, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-rose-500 font-bold select-none shrink-0 text-xs">✕</span>
                              <span className="break-words">{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Perfil do Ciclista Indicado */}
                    {targetPersona && (
                      <div className="bg-amber-500/10 border border-amber-600/30 rounded-xl p-3 sm:p-3.5 flex items-start gap-2.5 text-xs text-ink/90">
                        <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-amber-950 uppercase text-[10px] tracking-wider block">
                            Perfil do Ciclista Indicado
                          </span>
                          <p className="font-sans leading-relaxed text-ink/85">
                            {targetPersona}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-line pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-ink/80">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="font-bold text-ink">Ideal para:</span>
                        <span>{idealFor}</span>
                      </div>

                      {secondaryKeywords.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
                          <span className="text-[10px] font-mono text-ink/50 uppercase">Termos Auditados:</span>
                          {secondaryKeywords.slice(0, 3).map((kw, kwIdx) => (
                            <span 
                              key={kwIdx}
                              className="bg-neutral-100 border border-line/60 rounded px-1.5 py-0.5 font-mono text-[9px] text-ink/70"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ESPECIFICAÇÕES TÉCNICAS COMPLETAS */}
                  <div className="w-full">
                    <SpecificationsAccordion 
                      specSections={specSections}
                      expandedSpecs={expandedSpecs}
                      toggleSpecSection={toggleSpecSection}
                      onExpandAll={() => {
                        const all: Record<number, boolean> = {};
                        specSections.forEach((_, i) => { all[i] = true; });
                        setExpandedSpecs(all);
                      }}
                      onCollapseAll={() => {
                        setExpandedSpecs({});
                      }}
                    />
                  </div>

                </div>

                {/* ========================================================================= */}
                {/* COLUNA DIREITA (30%): AVALIAÇÕES E AUTONOMIA NA PRÁTICA (TRAVADA SEM SCROLL - STICKY) */}
                {/* ========================================================================= */}
                <div className="w-full lg:w-[30%] lg:sticky lg:top-4 flex flex-col gap-4 self-start">
                  <ReviewsSection 
                    rating={rating}
                    reviewCount={reviewCount}
                    reviews={reviews || []}
                    helpfulVotes={helpfulVotes}
                    votedReviews={votedReviews}
                    handleHelpfulClick={handleHelpfulClick}
                    bikeSlug={bike.slug}
                    bikeModelo={`${bike.marca} ${bike.modelo}`}
                    advertisedRangeKm={bike.autonomiaKm}
                    batteryWh={capacidadeWhFicha(specSections)}
                    motorWatts={bike.potenciaW}
                    onReviewAdded={handleReviewAdded}
                    compact={true}
                  />
                </div>

              </div>

              {/* ========================================================================= */}
              {/* SEÇÕES EM LARGURA TOTAL (100% DA PÁGINA) ABAIXO DA GRADE 70/30 */}
              {/* ========================================================================= */}

              {/* 1. SEÇÃO DAS LOJAS / TABELA DE OFERTAS COBRINDO TODA A PÁGINA */}
              <div className="w-full">
                <OffersTable 
                  bike={bike}
                  lastClickedStore={lastClickedStore}
                  handleStoreRedirect={handleStoreRedirect}
                />
              </div>

              {/* 2. FAQ ESTRUTURADO & CONFORMIDADE */}
              <div className="w-full">
                <BikeFAQSection 
                  bike={bike}
                  seoReport={detail?.seoReport || bike.seoReport}
                />
              </div>

              {/* 3. SEÇÃO DE COMENTÁRIOS E RELATOS DOS CICLISTAS */}
              <div className="w-full" id="comentarios-comunidade">
                <CommunityCommentsSection
                  rating={rating}
                  reviewCount={reviewCount}
                  reviews={reviews || []}
                  helpfulVotes={helpfulVotes}
                  votedReviews={votedReviews}
                  handleHelpfulClick={handleHelpfulClick}
                  bikeSlug={bike.slug}
                  bikeModelo={`${bike.marca} ${bike.modelo}`}
                  advertisedRangeKm={bike.autonomiaKm}
                  onReviewAdded={handleReviewAdded}
                />
              </div>

              {/* 4. MODELOS SIMILARES E CONCORRENTES DIRETOS */}
              <div className="w-full">
                <RelatedSimilarBikes
                  currentBike={bike}
                  allBikes={allBikes}
                  formatCurrency={formatCurrency}
                />
              </div>

              {/* MODAL DE ZOOM DE FOTO EM TELA CHEIA */}
              {isZoomOpen && (
                <div 
                  className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                  onClick={() => setIsZoomOpen(false)}
                >
                  <div className="relative w-full max-w-4xl h-[75vh] flex flex-col items-center justify-center">
                    <button
                      onClick={() => setIsZoomOpen(false)}
                      className="absolute top-0 right-0 z-10 bg-white text-ink p-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] hover:bg-neutral-100 transition-all cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="relative w-full h-full bg-white/95 rounded-2xl border-2 border-ink p-4 shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex items-center justify-center overflow-hidden">
                      <SafeImage
                        src={galleryImages[activeImage]}
                        alt={`${bike.modelo} - Alta Definição`}
                        width={1200}
                        height={800}
                        className="object-contain p-2"
                      />
                    </div>
                    <div className="text-ink text-xs font-mono font-black mt-3 bg-accent-gold px-4 py-2 rounded-xl border-2 border-ink shadow-[2px_2px_0_0_rgba(46,43,39,1)] uppercase tracking-wider">
                      {bike.marca} {bike.modelo} • Imagem {activeImage + 1} de {galleryImages.length}
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL DE SELEÇÃO RÁPIDA DE COMPARAÇÃO (ATÉ 3 MODELOS) */}
              {isCompareModalOpen && (
                <div className="fixed inset-0 z-50 bg-ink/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-white border-2 border-ink rounded-2xl w-full max-w-2xl overflow-hidden shadow-[4px_4px_0_0_rgba(46,43,39,1)] flex flex-col max-h-[85vh]">
                    
                    {/* Header do Modal */}
                    <div className="p-4 sm:p-5 bg-neutral-50 border-b-2 border-ink flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-accent-gold rounded-xl border border-ink shadow-xs text-ink">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-display font-black text-ink uppercase tracking-wider text-sm sm:text-base">
                            Comparar {bike.modelo}
                          </h3>
                          <p className="text-ink/70 font-mono text-[11px] mt-0.5">
                            Selecione até 2 outros modelos (total: {selectedForCompare.length}/3)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsCompareModalOpen(false)}
                        className="p-2 rounded-xl bg-white border border-ink shadow-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4 text-ink" />
                      </button>
                    </div>

                    {/* Busca de e-Bikes */}
                    <div className="p-3 bg-neutral-50 border-b border-ink">
                      <div className="relative">
                        <Search className="w-4 h-4 text-ink/50 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={compareSearch}
                          onChange={(e) => setCompareSearch(e.target.value)}
                          placeholder="Buscar por marca ou modelo para comparar..."
                          className="w-full bg-white border border-ink rounded-lg pl-9 pr-3 py-2 font-mono text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                        />
                      </div>
                    </div>

                    {/* Modelos Selecionados Atualmente */}
                    <div className="p-3 bg-accent-gold/10 border-b border-ink flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-mono font-bold text-ink uppercase tracking-wider">
                        Na comparação:
                      </span>
                      {selectedForCompare.map((slug, idx) => {
                        const item = allBikes.find(b => b.slug === slug);
                        if (!item) return null;
                        const isMain = slug === bike.slug;
                        return (
                          <div 
                            key={`compare-selected-${slug}-${idx}`}
                            className="bg-white border border-ink text-ink font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs text-xs"
                          >
                            <span>{item.marca} {item.modelo}</span>
                            {!isMain && (
                              <button
                                onClick={() => handleToggleCompareBike(slug)}
                                className="text-red-500 hover:text-red-700 cursor-pointer ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Lista de e-Bikes para Selecionar */}
                    <div className="p-3 overflow-y-auto flex flex-col gap-2 flex-1 max-h-[300px]">
                      {candidateBikes.map((candidate, idx) => {
                        const isSelected = selectedForCompare.includes(candidate.slug);
                        return (
                          <div
                            key={`candidate-compare-${candidate.slug}-${idx}`}
                            onClick={() => handleToggleCompareBike(candidate.slug)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-accent-charge/20 border-primary shadow-xs'
                                : 'bg-white hover:bg-neutral-50 border-line shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="relative w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden border border-ink/40 shrink-0">
                                <SafeImage
                                  src={candidate.imagemUrl}
                                  alt={candidate.modelo}
                                  variant="avatar"
                                  className="object-contain p-0.5"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] font-mono font-bold text-accent-gold uppercase tracking-wider bg-accent-gold/15 px-1.5 py-0.5 rounded border border-accent-gold/30">
                                  {candidate.marca}
                                </span>
                                <h4 className="font-display font-bold text-ink text-xs mt-0.5">
                                  {candidate.modelo}
                                </h4>
                                <div className="flex items-center gap-2 font-mono text-ink/70 text-[10px] mt-0.5">
                                  <span>{candidate.autonomiaKm} km</span>
                                  <span>•</span>
                                  <span>{candidate.potenciaW}W</span>
                                  <span>•</span>
                                  <span className="font-bold text-primary">{formatCurrency(candidate.menorPreco)}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`px-3 py-1 rounded-lg font-mono font-bold border cursor-pointer text-xs ${
                                isSelected
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-ink border-ink hover:bg-neutral-100'
                              }`}
                            >
                              {isSelected ? '✓ Selecionado' : '+ Adicionar'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer do Modal */}
                    <div className="p-3 bg-neutral-50 border-t border-ink flex items-center justify-between gap-3">
                      <span className="text-xs font-mono font-bold text-ink/70">
                        {selectedForCompare.length} de 3 selecionados
                      </span>
                      <button
                        onClick={handleGoToCompare}
                        className="bg-primary hover:bg-primary-dark text-white border border-ink px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <span>Abrir Comparador</span>
                        <ArrowRight className="w-3.5 h-3.5 text-accent-charge" />
                      </button>
                    </div>

                  </div>
                </div>
              )}



            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
