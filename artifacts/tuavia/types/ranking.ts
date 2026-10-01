export type RankingCategory = 
  | 'ebikes'
  | 'baterias'
  | 'pecas'
  | 'acessorios'
  | 'seguranca'
  | 'custo-beneficio';

export interface RankingStoreOffer {
  id: string;
  nomeLoja: string; // Ex: Mercado Livre, Amazon Brasil, Loja Oficial, Decathlon, AliExpress
  preco: number;
  url: string;
  cupom?: string; // Ex: PROMO10, FRETEGRATIS (opcional)
  destaque?: boolean; // Ex: "Melhor Preço", "Entrega Rápida"
}

export interface RankingItem {
  id: string;
  posicao: number; // 1, 2, 3... até 10
  tituloItem: string; // Ex: Caloi E-Vibe City Tour / Bateria Lítio 48V 15Ah Hailong
  marca: string;
  categoriaItem: string; // Ex: E-Bike Urbana, Bateria de Lítio, Câmbio Traseiro, Freio Hidráulico
  notaDestaque: string; // Ex: "Melhor Custo-Benefício", "Maior Autonomia", "Mais Potente"
  pontosPositivos: string[];
  pontosNegativos: string[];
  especificacoes: Record<string, string>; // Ex: { "Potência": "350W", "Autonomia": "50km", "Células": "Samsung" }
  faixaPrecoEstimado: string; // Ex: "R$ 4.200 - R$ 4.800"
  imagemUrl: string;
  lojas: RankingStoreOffer[]; // Suporte a N lojas e links de compra
  linkLoja1?: {
    nomeLoja: string;
    preco: number;
    url: string;
  };
  linkLoja2?: {
    nomeLoja: string;
    preco?: number;
    url?: string;
  };
  observacoes?: string;
  // Campos de integração direta com o catálogo individual de E-Bikes
  bikeSlug?: string; // Slug associado no catálogo /bike/[slug]
  priceHistory?: Array<{ month: string; price: number; lowestPrice?: number }>;
  potenciaW?: number;
  autonomiaKm?: number;
  pesoKg?: number;
  tempoCargaHoras?: number;
  menorPreco?: number;
  maiorPreco?: number;
}

export interface RankingComment {
  id: string;
  rankingSlug: string;
  autor: string;
  cidade?: string;
  texto: string;
  data: string;
  likes: number;
  parentCommentId?: string; // Para respostas
}

export interface TopRanking {
  id: string;
  slug: string;
  titulo: string; // Ex: "Top 5 Melhores E-Bikes Urbanas até R$ 6.000 em 2026"
  subtitulo: string; // Ex: "Avaliamos autonomia, durabilidade da bateria e disponibilidade de peças no Brasil"
  tipoRanking: 'top3' | 'top5' | 'top10' | 'custom';
  categoria: RankingCategory;
  quantidadeItens: number; // 3 a 10
  criterioAvaliacao: string; // Resumo do que foi levado em conta
  itens: RankingItem[];
  conclusaoGeral: string;
  dataAtualizacao: string;
  autor: string;
  publicado: boolean;
}

export const RANKING_STORAGE_KEY = 'tuavia_published_rankings_v1';
