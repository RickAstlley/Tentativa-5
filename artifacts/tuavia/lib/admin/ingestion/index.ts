/**
 * lib/admin/ingestion/index.ts
 * Barrel file - re-exports all ingestion modules
 */

// Types
export type {
  BinarySignatureInfo,
  ExtractedImageFile,
  IngestedFilePayload,
  PdfExtractionResult,
  IngestOptions,
  IngestionResult,
  SpecGap,
  IngestionQualityReport,
  IngestionCheckItem,
  IngestionAuditCorrection,
} from './types';
export type { SpecStatus, SpecConfidence } from './types';

// PDF Utils
export {
  PDF_SCAN_LIMIT_BYTES,
  PDF_MAX_STREAMS,
  PDF_MIN_USEFUL_CHARS,
  PDF_CHUNK_SIZE,
  decompressPdfFlateStream,
  pdfStreamFilter,
  pdfFilterIsText,
  decodePdfLiteral,
  decodePdfHexString,
  extractLinesFromContentStream,
  joinPdfTextPieces,
} from './pdfUtils';

// File Readers
export {
  MAX_TEXT_BYTES,
  decodeTextBuffer,
  readFileAsText,
  readFileAsBase64,
  parseBrazilianCurrency,
  safeParseJson,
  safeParseYaml,
} from './fileReaders';

// Parsers
export { extractTextFromPdf } from './parsers';
