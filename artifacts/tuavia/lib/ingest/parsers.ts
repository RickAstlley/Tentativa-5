/**
 * lib/ingest/parsers.ts
 *
 * Adaptador server-side para leitura de arquivos.
 *
 * A implementação real e única vive em `lib/admin/fileIngestion.ts`
 * (`parseUploadedFile`), que já trata PDF, DOCX, XLSX, CSV, JSON, ZIP,
 * Markdown, texto e imagens por assinatura de magic bytes.
 *
 * Este módulo existe só porque a rota de ingestão trabalha com `Buffer` (Node),
 * enquanto `parseUploadedFile` recebe `File` (web). Converter não é uma segunda
 * implementação de parsing.
 */

import { parseUploadedFile, type IngestedFilePayload } from '@/lib/admin/fileIngestion';

export interface IngestFile {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
}

export interface IngestParseResult extends IngestedFilePayload {
  text: string;
  metadata: {
    fileName: string;
    mimeType: string;
    size: number;
    wordCount: number;
    detectedKind?: string;
  };
  chunks?: string[];
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  json: 'application/json',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const MAX_ALLOWED_BYTES = 25 * 1024 * 1024;

export function getMimeTypeFromExtension(fileName: string): string | undefined {
  const extension = (fileName || '').split('.').pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] : undefined;
}

/** Valida tamanho, presença de conteúdo e formato suportado. */
export function validateFiles(files: IngestFile[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(files) || files.length === 0) {
    return { valid: false, errors: ['Nenhum arquivo enviado.'] };
  }

  for (const file of files) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      errors.push(`"${file?.fileName ?? 'arquivo'}" está vazio.`);
      continue;
    }
    if (file.buffer.length > MAX_ALLOWED_BYTES) {
      errors.push(
        `"${file.fileName}" excede o limite de 25 MB (${Math.round(file.buffer.length / 1024 / 1024)} MB).`
      );
    }
    if (!getMimeTypeFromExtension(file.fileName)) {
      errors.push(`Formato não suportado: "${file.fileName}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Lê um arquivo e devolve o texto extraído + metadados.
 * `ocr` e `maxChars` existem para compatibilidade de assinatura; a política de
 * extração real é a do parser único.
 */
export async function parseIngestFile(
  file: IngestFile,
  options: { ocr?: boolean; maxChars?: number } = {}
): Promise<IngestParseResult> {
  const maxChars = options.maxChars ?? 2_000_000;

  const blob = new File([new Uint8Array(file.buffer)], file.fileName, {
    type: file.mimeType || getMimeTypeFromExtension(file.fileName) || 'application/octet-stream',
  });

  const payload = await parseUploadedFile(blob);
  const text = (payload.rawText ?? '').slice(0, maxChars);

  return {
    ...payload,
    rawText: text,
    text,
    metadata: {
      fileName: file.fileName,
      mimeType: file.mimeType || getMimeTypeFromExtension(file.fileName) || 'application/octet-stream',
      size: file.buffer.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      detectedKind: payload.detectedKind,
    },
  };
}

/** Divide o texto em pedaços de ~12k caracteres, respeitando parágrafos. */
export function chunkText(text: string, size = 12_000): string[] {
  if (!text || text.length <= size) return [text ?? ''];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    if (cursor + size >= text.length) {
      chunks.push(text.slice(cursor));
      break;
    }
    const window = text.slice(cursor, cursor + size);
    const boundary = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'));
    const cut = boundary > size * 0.5 ? boundary + 1 : size;
    chunks.push(text.slice(cursor, cursor + cut));
    cursor += cut;
  }
  return chunks;
}
