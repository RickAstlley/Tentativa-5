/**
 * lib/admin/ingestion/pdfUtils.ts
 * PDF utility functions for text extraction, decompression, and stream parsing.
 */

export const PDF_SCAN_LIMIT_BYTES = 64 * 1024 * 1024;
export const PDF_MAX_STREAMS = 400;
export const PDF_MIN_USEFUL_CHARS = 8;
export const PDF_CHUNK_SIZE = 32768;

/**
 * Decodifica string literal de PDF (`(...)`).
 */
export function decodePdfLiteral(raw: string): string {
  return raw
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\n/g, '')
    .replace(/\\([()\\])/g, '$1');
}

/**
 * Decodifica string hexadecimal de PDF (`<0044 006F>` → "DO").
 *
 * Suporta UTF-16BE (4 hex digits/char) e byte único (xx00).
 */
export function decodePdfHexString(hex: string): string {
  if (hex.length < 2 || hex.length % 2 !== 0) return '';

  const byteUnico = /^(?:[0-9A-Fa-f]{2}00){2,}$/.test(hex);

  if (byteUnico) {
    let s = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    return s;
  }

  const utf16 = (): string => {
    if (hex.length % 4 !== 0) return '';
    let s = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (Number.isNaN(code)) continue;
      if (code >= 0xd800 && code <= 0xdbff && i + 8 <= hex.length) {
        const low = parseInt(hex.slice(i + 4, i + 8), 16);
        if (low >= 0xdc00 && low <= 0xdfff) {
          s += String.fromCharCode(((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000);
          i += 3;
          continue;
        }
      }
      s += String.fromCharCode(code);
    }
    return s;
  };

  const como16 = utf16();
  if (como16) return como16;

  let out = '';
  for (let i = 0; i + 2 <= hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(code)) continue;
    out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Descobre o /Filter do objeto que contém o stream.
 */
export function pdfStreamFilter(objeto: string): string {
  const filtro = objeto.match(/\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/);
  if (!filtro) return 'FlateDecode';
  return filtro[1]
    .replace(/[[\]]/g, '')
    .split('/')
    .filter(Boolean)
    .map((n) => n.trim())
    .join(',');
}

/** Só interessa stream comprimido de texto; imagem e bitmap são descartados. */
export function pdfFilterIsText(filter: string): boolean {
  const f = filter.toLowerCase();
  if (!f) return false;
  if (f.includes('dct') || f.includes('jpx') || f.includes('ccitt') || f.includes('runlength')) return false;
  if (f.includes('asciihex') || f.includes('ascii85')) return false;
  return f.includes('flate');
}

/**
 * Extrai as linhas de texto de um content stream já descomprimido.
 */
export function extractLinesFromContentStream(content: string): string[] {
  const linhas: string[] = [];

  for (const segmento of content.split(/(?=\b(?:Td|TD|T\*|BT|ET|'|")\b)/)) {
    if (!segmento) continue;

    const partes: string[] = [];

    const lit = /\((.*?)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = lit.exec(segmento)) !== null) partes.push(decodePdfLiteral(m[1]));

    const arr = /\[(.*?)\]\s*TJ/g;
    while ((m = arr.exec(segmento)) !== null) {
      const inner = m[1];
      const subs = inner.match(/\((.*?)\)/g);
      if (subs) partes.push(subs.map((s) => decodePdfLiteral(s.slice(1, -1))).join(''));
      const hexes = inner.match(/<([0-9A-Fa-f\s]+)>/g);
      if (hexes) {
        for (const h of hexes) partes.push(decodePdfHexString(h.replace(/[<>]/g, '').replace(/\s+/g, '')));
      }
    }

    const hex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
    while ((m = hex.exec(segmento)) !== null) {
      partes.push(decodePdfHexString(m[1].replace(/\s+/g, '')));
    }

    const texto = partes.join('').replace(/\r/g, '');
    for (const parte of texto.split('\n')) {
      const limpa = parte.replace(/[ \t]{2,}/g, ' ').trim();
      if (limpa) linhas.push(limpa);
    }
  }

  return linhas;
}

/**
 * Junta as linhas extraídas na ordem em que o PDF as escreve.
 */
export function joinPdfTextPieces(pieces: string[]): string {
  return pieces
    .map((p) => p.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Descomprime um bloco de stream PDF /FlateDecode utilizando DecompressionStream nativo.
 */
export async function decompressPdfFlateStream(compressedBytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined' || compressedBytes.length < 4) return '';

  const tenta = async (formato: 'deflate' | 'deflate-raw', dados: Uint8Array): Promise<string | null> => {
    try {
      const ds = new DecompressionStream(formato);
      const writer = ds.writable.getWriter();
      await writer.write(dados as any);
      await writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      const bytes = new Uint8Array(buf);

      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return new TextDecoder('windows-1252').decode(bytes);
      }
    } catch {
      return null;
    }
  };

  const direto = await tenta('deflate', compressedBytes);
  if (direto !== null) return direto;

  const raw = compressedBytes.length > 6 ? compressedBytes.slice(2, -4) : compressedBytes;
  const semHeader = await tenta('deflate-raw', raw);
  return semHeader ?? '';
}
