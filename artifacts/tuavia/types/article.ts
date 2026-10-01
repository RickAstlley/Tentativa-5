export type ArticleCategory = 
  | 'Guia de Compra' 
  | 'Manutenção' 
  | 'Legislação' 
  | 'Notícias' 
  | 'Comparativo' 
  | 'Economia & Mobilidade'
  | 'Tecnologia & Baterias'
  | 'Promoções';

/**
 * Categorias válidas, na ordem do seletor.
 *
 * O `ArticleForm` importa este array para validar e listar `category`. Ele não
 * existia: a importação resolvia para `undefined` e
 * `ARTICLE_CATEGORIES.includes(...)` derrubava o formulário na montagem.
 */
export const ARTICLE_CATEGORIES: readonly ArticleCategory[] = [
  'Guia de Compra',
  'Comparativo',
  'Tecnologia & Baterias',
  'Legislação',
  'Economia & Mobilidade',
  'Manutenção',
  'Notícias',
  'Promoções',
] as const;

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  galleryImages?: string[]; // Fotos complementares, infográficos e detalhes do artigo
  category: ArticleCategory;
  publishedAt: string; // ISO date string, e.g. "2026-08-08"
  updatedAt?: string; // Optional ISO date string for last update
  readingTimeMinutes: number;
  body: string; // markdown text
  relatedBikeCategories?: string[]; // e.g. ['Urbana', 'Trilha/MTB']
  tags?: string[]; // Tags e etiquetas temáticas geradas ou definidas (ex: 'Legislação', 'CONTRAN 996', 'Ciclovia', 'Bateria')
  isLegislationFeatured?: boolean; // Se o artigo deve ser ancorado com destaque na Zona de Legislação
  hideFromFeed?: boolean; // Se o artigo deve ser ocultado de feeds e catálogos gerais de artigos
}

