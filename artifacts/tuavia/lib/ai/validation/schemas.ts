/**
 * lib/ai/validation/schemas.ts
 *
 * Schemas Zod das saídas estruturadas de LLM. Substitui
 * `@/src/ai/validation/schemas` e `@/src/ai/schemas`, que não existiam.
 *
 * Todos são permissivos de propósito: validam a FORMA do retorno (para o job
 * conseguir trabalhar) e deixam a AUDITORIA de conteúdo para
 * `lib/ai/deterministicAuditor.ts`, que é quem decide se um dado é confiável.
 */

import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

export const specItemSchema = z.object({
  label: z.string().min(1).optional(),
  campo: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  value: z.union([z.string(), z.number()]).optional(),
  valor: z.union([z.string(), z.number()]).optional(),
  content: z.union([z.string(), z.number()]).optional(),
  confidence: z
    .enum(['ALTA', 'MEDIA', 'BAIXA', 'CALCULADA', 'NAO_CONFIRMADA'])
    .optional(),
  status: z
    .enum(['CONFIRMADO', 'CALCULADO', 'FONTE_COMERCIAL', 'NAO_INFORMADO', 'CONFLITANTE', 'SUSPEITO'])
    .optional(),
  source: z.preprocess(emptyToUndefined, z.string().optional()),
  sourceUrl: z.preprocess(emptyToUndefined, z.string().optional()),
  evidence: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const specSectionSchema = z.object({
  title: z.string().min(1),
  items: z.array(specItemSchema).default([]),
  sectionSummary: z.preprocess(emptyToUndefined, z.string().optional()),
});

/** Qualquer formato em que o LLM possa devolver as especificações. */
export const BikeSpecsSchema = z.union([
  z.array(specSectionSchema),
  z.array(specItemSchema),
  z.record(z.unknown()),
]);

export const BikeSpecSectionSchema = z.array(specSectionSchema);

export const BikeSeoSchema = z.object({
  focusKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).default([]),
  serpTitle: z.string().optional(),
  serpDescription: z.string().optional(),
  llmGeoSummary: z.string().optional(),
  faqSchema: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  richSnippets: z.record(z.unknown()).optional(),
});

export const BikePriceDataSchema = z.object({
  priceHistory: z
    .array(
      z.object({
        month: z.union([z.string(), z.number()]),
        price: z.union([z.string(), z.number()]),
        lowestPrice: z.union([z.string(), z.number()]).optional(),
        store: z.string().optional(),
        source: z.string().optional(),
        verified: z.boolean().optional(),
        url: z.string().optional(),
      })
    )
    .default([]),
  offers: z
    .array(
      z.object({
        loja: z.string(),
        preco: z.union([z.string(), z.number()]),
        precoDe: z.union([z.string(), z.number()]).optional(),
        linkProduto: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .default([]),
});

export const BikeManualSearchSchema = z.object({
  identity: z
    .object({
      marca: z.string().optional(),
      modelo: z.string().optional(),
      categoria: z.string().optional(),
      potenciaW: z.union([z.string(), z.number()]).optional(),
      autonomiaKm: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  specSections: z.array(specSectionSchema).default([]),
  editorial: z.record(z.unknown()).optional(),
  priceHistoryData: z.record(z.unknown()).optional(),
});

export const RankingStage1Schema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  category: z.string().optional(),
  criteria: z.array(z.string()).default([]),
  weights: z.record(z.number()).optional(),
  targetAudience: z.string().optional(),
  criterioAvaliacao: z.string().optional(),
  conclusion: z.string().optional(),
});

export const RankingStage2ModelsSchema = z.object({
  models: z
    .array(
      z.object({
        tituloItem: z.string().min(1),
        marca: z.string().optional(),
        categoriaItem: z.string().optional(),
        notaDestaque: z.string().optional(),
        pontosPositivos: z.array(z.string()).default([]),
        pontosNegativos: z.array(z.string()).default([]),
        especificacoes: z.record(z.string()).optional(),
        faixaPrecoEstimado: z.string().optional(),
      })
    )
    .min(1),
});

export const ArticleMetaSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  focusKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).default([]),
  readingTimeMinutes: z.number().optional(),
  relatedBikeCategories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  faqSchema: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  llmGeoSummary: z.string().optional(),
});

export const ContentGenerationOutputSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  category: z.string().optional(),
  body: z.string().optional(),
  markdownContent: z.string().optional(),
  readingTimeMinutes: z.number().optional(),
  relatedBikeCategories: z.array(z.string()).default([]),
  seoKeywords: z.array(z.string()).default([]),
  targetKeywords: z.array(z.string()).default([]),
  outline: z.array(z.unknown()).default([]),
  faqSchema: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
  llmGeoSummary: z.string().optional(),
  buyerPersona: z.string().optional(),
});

/** Schema genérico, usado quando a chamada não tem contrato específico. */
export const AIExecutionSchema = z.record(z.unknown());

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  href?: string;
  /** Prompt pré-preenchido disparado ao clicar. */
  prompt?: string;
  task?: string;
  /**
   * Confiança declarada pelo modelo, 0-1. Puramente informativa: a UI mostra,
   * mas nada no pipeline confia nela. Só a auditoria determinística decide o
   * que entra na ficha.
   */
  confidence?: number;
  /** Modelo que gerou a sugestão, para o admin saber com quem está falando. */
  sourceModel?: string;
  tags?: string[];
}
