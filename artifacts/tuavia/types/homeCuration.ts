// Tipos de curadoria da Home (substitui o que vinha de homeCurationService)
// Definidos localmente para evitar dependência do módulo de IA removido

export interface CuratedBikeDeal {
  slug: string;
  modelo: string;
  marca: string;
  menorPreco: number;
  maiorPreco: number;
  economiaBrl: number;
  discountPct: number;
  badge: string;
  headline: string;
  aiVerdict: string;
  autonomiaKm?: number;
  potenciaW?: number;
  pesoKg?: number;
  imagemUrl?: string;
}

export interface CuratedArticleHighlight {
  slug: string;
  title: string;
  summary: string;
  category: string;
  badge: string;
  editorialHook: string;
  readTimeMinutes: number;
  imageUrl?: string;
  publishedAt: string;
}

export interface CuratedTopic {
  id: string;
  title: string;
  icon: string;
  description: string;
  badge: string;
  articleSlugs: string[];
  relevance: 'semana' | 'mes' | 'essencial';
}

export interface HomeCurationData {
  bikes: {
    dealOfWeek: CuratedBikeDeal;
    dealOfMonth: CuratedBikeDeal;
    bestValuePick: CuratedBikeDeal;
    topUrbanRange: CuratedBikeDeal;
    hotPriceDrops: CuratedBikeDeal[];
    weeklyDuel: {
      bike1Slug: string;
      bike2Slug: string;
      title: string;
      category: string;
      aiVerdictPreview: string;
    };
    podiums?: {
      custoBeneficioSlugs: string[];
      subidasSlugs: string[];
      dobraveisSlugs: string[];
      urbanasSlugs: string[];
    };
    duels?: Array<{
      id: string;
      tag: string;
      bikeASlug: string;
      bikeBSlug: string;
      destaque: string;
    }>;
    catalogPrioritySlugs?: string[];
  };
  articles: {
    highRelevanceWeek: CuratedArticleHighlight;
    highRelevanceMonth: CuratedArticleHighlight;
    topics: CuratedTopic[];
    radarTrendSummary: string;
  };
}

// Alias para compatibilidade com código existente
export type HomeAICurationData = HomeCurationData;