export type EBikeCategory = 'Urbana' | 'Trilha/MTB' | 'Dobrável' | 'Cargo' | 'Speed';

export interface EBikeOfferFlat {
  id: number;
  modelo: string;
  marca: string;
  loja: string;
  preco: number;
  precoDe?: number;
  emOferta?: boolean;
  cupomDesconto?: string;
  destaqueOferta?: string;
  linkProduto: string;
  autonomiaKm: number;
  potenciaW: number;
  usoPrincipal: EBikeCategory | string;
  disponibilidade: string;
  imagemUrl: string;
  galleryImages?: string[];
  dataAtualizacao: string;
  observacoes: string;
  pesoKg?: number;
  tempoCargaHoras?: number;
}

export interface EBikeStoreOffer {
  id: number;
  loja: string;
  preco: number;
  precoDe?: number; // Preço original "De R$"
  emOferta?: boolean; // Flag indicando que a loja está em oferta ativa
  cupomDesconto?: string; // Cupom opcional (ex: "TUAVIA100")
  destaqueOferta?: string; // Selo/badge da oferta (ex: "🔥 25% OFF", "⚡ Menor preço")
  linkProduto: string;
  disponibilidade: string;
  dataAtualizacao: string;
  observacoes: string;
  imagemUrl?: string;
}

export interface EBikeFAQItem {
  question: string;
  answer: string;
}

export interface EBikeSEOReport {
  focusKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  seoScore: number;
  serpTitlePreview: string;
  serpDescriptionPreview: string;
  llmGeoSummary?: string; // Síntese otimizada para IAs (Google AI Overviews / Perplexity / Gemini / ChatGPT)
  faqSchema?: EBikeFAQItem[]; // Perguntas e respostas estruturadas para Rich Snippets FAQ
  contranCategory?: string; // Classificação regulatória técnica (Resolução CONTRAN 996/2023)
  targetBuyerPersona?: string;
  optimizationTips?: string[];
}

export interface EBikeGrouped {
  slug: string; // Identificador único para a rota estática (ex: 'sense-easy-one')
  modelo: string;
  marca: string;
  autonomiaKm: number;
  potenciaW: number;
  usoPrincipal: EBikeCategory | string;
  imagemUrl: string;
  galleryImages?: string[]; // Até 4 imagens complementares de alta resolução da oferta/produto
  menorPreco: number;
  maiorPreco: number;
  precoDe?: number; // Maior Preço Original "De R$" para comparação
  precoOriginal?: number; // Alias para precoDe
  emOfertaEspecial?: boolean; // Flag destacando a e-bike inteira em seção especial de ofertas
  tagOferta?: string; // Tag/Selo da oferta especial (ex: "⚡ Oferta Relâmpago 2026")
  ofertas: EBikeStoreOffer[];
  pesoKg?: number;
  tempoCargaHoras?: number;
  // Campos de Especificação Técnica Customizada (Gerados no /admin via LLM ou Manual):
  specSections?: EBikeSpecSection[];
  pros?: string[];
  cons?: string[];
  idealFor?: string;
  resumoExecutivo?: string;
  verdict?: string;
  badge?: string;
  destaque?: string;
  seoReport?: EBikeSEOReport;
  priceHistory?: EBikePriceHistoryPoint[];
  showPriceChart?: boolean;
  reviews?: EBikeReview[];
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}


export type SpecStatus = 'CONFIRMADO' | 'CALCULADO' | 'FONTE_COMERCIAL' | 'CONFLITANTE' | 'NAO_CONFIRMADO' | 'NAO_INFORMADO' | 'SUSPEITO';
export type SpecConfidence = 'ALTA' | 'MEDIA' | 'BAIXA' | 'SUSPEITA' | 'NAO_CONFIRMADA';

export interface EBikeSpecItem {
  label: string;
  value: string;
  status?: SpecStatus;
  confidence?: SpecConfidence;
  source?: string;
  sourceUrl?: string;
  verificationDate?: string;
  notes?: string;
}

export interface EBikeSpecSection {
  title: string;
  items: EBikeSpecItem[];
  sectionSummary?: string;
  auditReport?: {
    confirmados?: number;
    calculados?: number;
    comerciais?: number;
    conflitantes?: number;
    naoInformados?: number;
    suspeitos?: number;
    corrigidos?: { campo: string; de: string; para: string; motivo?: string }[];
  };
}

export interface EBikeReviewCriteria {
  batteryAutonomy?: number; // 1 a 5
  motorPower?: number; // 1 a 5
  comfort?: number; // 1 a 5
  reliability?: number; // 1 a 5
}

export interface EBikeReview {
  id: string;
  bikeSlug?: string;
  author: string;
  city?: string;
  userWeightKg?: number;
  usageProfile?: string;
  terrain?: 'plano' | 'misto' | 'íngreme';
  assistanceModeUsed?: string;
  realRangeKm?: number;
  advertisedRangeKm?: number;
  rating: number;
  criteria?: EBikeReviewCriteria;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
  status?: 'approved' | 'pending' | 'rejected';
  timeUsing?: string;
  helpfulCount: number;
}

export interface RealRangeCommunityStats {
  advertisedKm: number;
  averageRealKm: number;
  minReportedKm: number;
  maxReportedKm: number;
  accuracyPercent: number; // Porcentagem de cumprimento da autonomia anunciada (ex: 78%)
  sampleCount: number;
  terrainBreakdown?: {
    plano: number;
    misto: number;
    íngreme: number;
  };
}

export interface EBikePriceHistoryPoint {
  month: string;
  price: number;
  store?: string;
  lowestPrice?: number;
  source?: string;
  url?: string;
  date?: string;
  verified?: boolean;
  condition?: string;
}

export interface EBikeOfferSuggestion {
  loja: string;
  preco: number;
  linkProduto: string;
  observacoes?: string;
}

export interface BikeAutofillResult {
  marca: string;
  modelo: string;
  usoPrincipal: EBikeCategory | string;
  autonomiaKm: number;
  potenciaW: number;
  pesoKg: number;
  tempoCargaHoras: number;
  battery_wh: number;
  consumption_wh_per_km: number;
  power_weight_ratio: number;
  contran_status: 'CONFORME_PEDELEC' | 'AUTOPROPELIDO' | 'CICLOMOTOR' | 'ALERTA_IRREGULAR';
  contran_notes: string;
  badge: string;
  resumoExecutivo: string;
  idealFor: string;
  pros: string[];
  cons: string[];
  specSections: EBikeSpecSection[];
  ofertasSugestoes: EBikeOfferSuggestion[];
  priceHistory?: EBikePriceHistoryPoint[];
  historicoInsuficiente?: boolean;
  scores?: {
    urbanAptitude: number;
    rangeEfficiency: number;
    powerTorque: number;
    comfortErgonomics: number;
    costBenefit: number;
  };
}

export interface EnrichedEBikeDetail {
  bike: EBikeGrouped;
  verdict: string;
  badge: string;
  rating?: number;
  reviewCount?: number;
  pros: string[];
  cons: string[];
  idealFor: string;
  specSections: EBikeSpecSection[];
  reviews?: EBikeReview[];
  priceHistory?: EBikePriceHistoryPoint[];
  showPriceChart?: boolean;
  galleryImages: string[];
  seoReport?: EBikeSEOReport;
}
