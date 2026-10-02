/**
 * lib/admin/ingestion/parsers.ts
 * Parsers for various file formats: PDF, DOCX, XLSX, CSV, text, etc.
 */

import { PdfExtractionResult } from './types';
import {
  decompressPdfFlateStream,
  pdfFilterIsText,
  pdfStreamFilter,
  extractLinesFromContentStream,
  joinPdfTextPieces,
  decodePdfLiteral,
  decodePdfHexString,
  PDF_SCAN_LIMIT_BYTES,
  PDF_MAX_STREAMS,
  PDF_MIN_USEFUL_CHARS,
  PDF_CHUNK_SIZE,
} from './pdfUtils';

/**
 * Extrai texto de PDF usando o parser nativo (sem pdf-parse).
 * Retorna objeto com texto extraído, flag de truncamento, bytes escaneados e total.
 */
export async function extractTextFromPdf(file: File): Promise<PdfExtractionResult> {
  const empty: PdfExtractionResult = {
    text: '',
    truncated: false,
    scannedBytes: 0,
    totalBytes: 0,
  };

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const totalBytes = bytes.length;

    const scanLen = Math.min(totalBytes, PDF_SCAN_LIMIT_BYTES);
    const truncated = scanLen < totalBytes;

    let rawStr = '';
    for (let i = 0; i < scanLen; i += PDF_CHUNK_SIZE) {
      rawStr += String.fromCharCode(...bytes.subarray(i, Math.min(i + PDF_CHUNK_SIZE, scanLen)));
    }

    const textPieces: string[] = [];

    const streamMarker = 'stream';
    const endstreamMarker = 'endstream';
    let searchPos = 0;
    let decompressedCount = 0;

    while (decompressedCount < PDF_MAX_STREAMS) {
      const streamIdx = rawStr.indexOf(streamMarker, searchPos);
      if (streamIdx === -1) break;

      const endStreamIdx = rawStr.indexOf(endstreamMarker, streamIdx + streamMarker.length);
      if (endStreamIdx === -1) break;

      const objStart = rawStr.lastIndexOf('obj', streamIdx);
      const dict = rawStr.slice(objStart === -1 ? Math.max(0, streamIdx - 400) : objStart, streamIdx);
      if (!pdfFilterIsText(pdfStreamFilter(dict))) {
        searchPos = endStreamIdx + endstreamMarker.length;
        continue;
      }

      let dataStart = streamIdx + streamMarker.length;
      while (dataStart < endStreamIdx && (bytes[dataStart] === 0x0d || bytes[dataStart] === 0x0a)) {
        dataStart++;
      }

      let dataEnd = endStreamIdx;
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0d || bytes[dataEnd - 1] === 0x0a)) {
        dataEnd--;
      }

      if (dataEnd > dataStart && dataEnd - dataStart > 10) {
        const streamBytes = bytes.subarray(dataStart, dataEnd);
        try {
          const decompressed = await decompressPdfFlateStream(streamBytes);
          if (decompressed && decompressed.length > 10) {
            const subTj = /\((.*?)\)\s*Tj/g;
            let m: RegExpExecArray | null;
            while ((m = subTj.exec(decompressed)) !== null) {
              const str = decodePdfLiteral(m[1]).trim();
              if (str.length > 0) textPieces.push(str);
            }

            const subTjArray = /\[(.*?)\]\s*TJ/g;
            while ((m = subTjArray.exec(decompressed)) !== null) {
              const inner = m[1];
              const subMatches = inner.match(/\((.*?)\)/g);
              if (subMatches) {
                const combined = subMatches
                  .map((s) => decodePdfLiteral(s.slice(1, -1)))
                  .join('');
                if (combined.trim().length > 0) textPieces.push(combined.trim());
              }
            }

            const subHex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
            while ((m = subHex.exec(decompressed)) !== null) {
              const hex = m[1].replace(/\s+/g, '');
              const out = decodePdfHexString(hex);
              if (out.trim().length > 0) textPieces.push(out.trim());
            }

            decompressedCount++;
          }
        } catch {}
      }

      searchPos = endStreamIdx + endstreamMarker.length;
    }

    for (const linha of extractLinesFromContentStream(rawStr)) {
      textPieces.push(linha);
    }

    const hexRegex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = hexRegex.exec(rawStr)) !== null) {
      const out = decodePdfHexString(match[1].replace(/\s+/g, ''));
      if (out.trim().length > 0) textPieces.push(out.trim());
    }

    if (textPieces.length === 0) {
      const asciiRegex = /[A-Za-z0-9À-ÿ\s,.:;!?'"()/\-–]{4,}/g;
      const readableBlocks: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = asciiRegex.exec(rawStr)) !== null) {
        const block = match[0].trim();
        if (
          !block.startsWith('Filter') &&
          !block.startsWith('FlateDecode') &&
          !block.startsWith('Length') &&
          !block.startsWith('Root') &&
          !block.startsWith('Page') &&
          block.length > 3
        ) {
          readableBlocks.push(block);
        }
      }

      if (readableBlocks.length > 0) {
        return {
          text: readableBlocks.slice(0, 1000).join('\n'),
          truncated,
          scannedBytes: scanLen,
          totalBytes,
        };
      }

      return {
        text: `Documento PDF: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        truncated,
        scannedBytes: scanLen,
        totalBytes,
      };
    }

    const joined = joinPdfTextPieces(textPieces);
    if (joined.length >= PDF_MIN_USEFUL_CHARS) {
      return { text: joined, truncated, scannedBytes: scanLen, totalBytes };
    }

    return { ...empty, text: joined };
  } catch (err) {
    console.warn('[fileIngestion] Falha ao analisar PDF no cliente:', err);
    return { text: `Documento PDF: ${file.name}`, truncated: false, scannedBytes: 0, totalBytes: 0 };
  }
}
