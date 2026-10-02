/**
 * lib/admin/ingestion/types.ts
 * Shared types for the ingestion module
 */

import type { SpecStatus, SpecConfidence } from '@/types/ebike';

/**
 * Informações de assinatura binária de um arquivo
 */
export interface BinarySignatureInfo {
  type: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Arquivo de imagem extraído de documentos (DOCX, XLSX, ZIP, etc.)
 */
export interface ExtractedImageFile {
  name: string;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Payload completo do arquivo processado
 */
export interface IngestedFilePayload {
  fileName: string;
  fileType:
    | 'md'
    | 'txt'
    | 'yaml'
    | 'json'
    | 'csv'
    | 'zip'
    | 'pdf'
    | 'html'
    | 'docx'
    | 'xlsx'
    | 'ods'
    | 'image'
    | 'unknown';
  rawText: string;
  parsedYamlOrJson?: any;
  images?: ExtractedImageFile[];
  detectedTitle?: string;
  detectedPricePoints?: Array<{
    mes: string;
    preco: number;
    loja?: string;
  }>;
  subFilesCount?: number;
  subDocuments?: Array<{
    fileName: string;
    relativePath: string;
    ext: string;
    rawText: string;
    parsedYamlOrJson?: any;
    fileSizeBytes: number;
  }>;
  fileBase64?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  wordCount?: number;
  detectedKind?: 'ebike' | 'article' | 'ranking';
  binaryInfo?: BinarySignatureInfo;
  /**
   * Problemas que impedem a leitura de confiar no texto extraído.
   *
   * O caso que importa é o PDF truncado: quando o arquivo não foi lido por
   * inteiro, campo ausente NÃO significa "o fabricante não informou", e o
   * ingestor precisa recusar essa afirmação.
   */
  extractionWarnings?: string[];
}

/**
 * Resultado da extração de texto de PDF
 */
export interface PdfExtractionResult {
  text: string;
  truncated: boolean;
  scannedBytes: number;
  totalBytes: number;
}

/**
 * Opções para o pipeline de ingestão determinística de e-bike
 */
export interface IngestOptions {
  payload?: IngestedFilePayload;
  rawText?: string;
  fileName?: string;
  parsedData?: unknown;
  truncated?: boolean;
}

/**
 * Resultado completo da extração determinística
 */
export interface IngestionResult {
  identity: Record<string, unknown>;
  specSections: import('@/types/ebike').EBikeSpecSection[];
  audit: import('@/lib/admin/specAuditor').EBikeAuditSummary;
  gaps: SpecGap[];
  rawText: string;
  structuredYaml: string;
  editorial: Record<string, unknown>;
  priceHistoryData: {
    hasPriceHistory: boolean;
    historicoPrecos: any[];
    ofertas: any[];
  };
  consolidated: Record<string, unknown>;
  stats: {
    deterministicSections: number;
    deterministicItems: number;
    totalCanonicalItems: number;
    filledItems: number;
    gapCount: number;
    integrityScore: number;
    durationMs: number;
    truncated: boolean;
  };
}

/**
 * Campo do template que ficou sem valor
 */
export interface SpecGap {
  /** Índice da seção canônica, 0 a 9. */
  sectionIndex: number;
  sectionTitle: string;
  label: string;
  /** Rótulos alternativos do mesmo campo, para deixar claro o que se procura. */
  synonyms: string[];
  /**
   * O que a ausência significa.
   * `naoDeclarado`: o fabricante não diz isso.
   * `naoLido`:       o documento não foi lido inteiro, então não sabemos.
   */
  reason?: string;
  truncated?: boolean;
}

export type { SpecStatus, SpecConfidence };

/**
 * Resultado do auditor de qualidade
 */
export interface IngestionQualityReport {
  totalSpecs: number;
  confirmedCount: number;
  calculatedCount: number;
  commercialCount: number;
  unconfirmedCount: number;
  suspectCount: number;
  genericSourcesCleaned: number;
  confidenceDowngraded: number;
  integrityScore: number;
  verificationBreakdown: {
    alta: number;
    media: number;
    baixa: number;
    nao_confirmada: number;
  };
  corrections: Array<{
    campo: string;
    de: string;
    para: string;
    motivo?: string;
  }>;
}

/**
 * Item individual do relatório de qualidade
 */
export interface IngestionCheckItem {
  campo: string;
  valor: string;
  status: 'CONFIRMADO' | 'CALCULADO' | 'FONTE_COMERCIAL' | 'CONFLITANTE' | 'NAO_CONFIRMADO' | 'NAO_INFORMADO' | 'SUSPEITO';
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA' | 'SUSPEITA' | 'NAO_CONFIRMADA';
  detalhe?: string;
}

/**
 * Resultado de item de auditoria
 */
export interface IngestionAuditCorrection {
  campo: string;
  de: string;
  para: string;
  motivo: string;
}
