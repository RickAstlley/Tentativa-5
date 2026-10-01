import JSZip from 'jszip';

export interface BinaryHexRow {
  offset: string;
  hex: string;
  ascii: string;
}

export interface BinarySignatureInfo {
  magicBytesHex: string;
  magicBytesAscii: string;
  detectedMime: string;
  detectedFormatName: string;
  detectedExtension: string;
  isExtensionMismatch: boolean;
  sha256: string;
  fileSizeBytes: number;
  formattedSize: string;
  encoding: string;
  isContainerZip: boolean;
  isOfficeDocx: boolean;
  isOfficeXlsx: boolean;
  isOdsSpreadsheet: boolean;
  isPdf: boolean;
  isImage: boolean;
  isPlainText: boolean;
  hexDump: BinaryHexRow[];
  extractedDetails?: {
    tablesCount?: number;
    specsFoundCount?: number;
    imagesFoundCount?: number;
    sheetsCount?: number;
    subFilesCount?: number;
    documentType?: string;
  };
}

export interface ExtractedBinaryResult {
  text: string;
  parsedData?: any;
  images?: Array<{ name: string; dataUri: string; mimeType: string; sizeBytes: number }>;
  signature: BinarySignatureInfo;
}

/**
 * Formata tamanho em bytes para leitura humana
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calcula Hash SHA-256 via Web Crypto API nativo
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('[binaryFileInspector] Falha no crypto.subtle:', err);
  }
  return 'sha256-indisponivel';
}

/**
 * Gera um Hex Dump estruturado (16 bytes por linha) dos primeiros bytes do arquivo
 */
export function generateHexDump(bytes: Uint8Array, maxBytes = 256): BinaryHexRow[] {
  const rows: BinaryHexRow[] = [];
  const limit = Math.min(bytes.length, maxBytes);

  for (let i = 0; i < limit; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(8, '0').toUpperCase();

    // Hex bytes
    const hexParts: string[] = [];
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        hexParts.push(chunk[j].toString(16).padStart(2, '0').toUpperCase());
      } else {
        hexParts.push('  ');
      }
    }

    // Dividir em 2 grupos de 8 para legibilidade
    const hex = `${hexParts.slice(0, 8).join(' ')}  ${hexParts.slice(8).join(' ')}`;

    // ASCII representation
    let ascii = '';
    for (let j = 0; j < chunk.length; j++) {
      const b = chunk[j];
      if (b >= 32 && b <= 126) {
        ascii += String.fromCharCode(b);
      } else {
        ascii += '·';
      }
    }

    rows.push({ offset, hex, ascii });
  }

  return rows;
}

/**
 * Inspeciona os Magic Bytes e determina a assinatura binária real do arquivo
 */
export async function inspectBinarySignature(file: File, buffer?: ArrayBuffer): Promise<BinarySignatureInfo> {
  const buf = buffer || (await file.arrayBuffer());
  const bytes = new Uint8Array(buf);
  const fileSizeBytes = buf.byteLength;
  const formattedSize = formatBytes(fileSizeBytes);
  const declaredExt = (file.name.split('.').pop() || '').toLowerCase();

  const sha256 = await computeSha256(buf);
  const hexDump = generateHexDump(bytes, 256);

  // Extrair primeiros 16 bytes em Hex e ASCII
  const first16 = bytes.slice(0, 16);
  const magicBytesHex = Array.from(first16.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  let magicBytesAscii = '';
  for (let i = 0; i < Math.min(first16.length, 8); i++) {
    const b = first16[i];
    magicBytesAscii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
  }

  let detectedMime = 'application/octet-stream';
  let detectedFormatName = 'Arquivo Binário Genérico';
  let detectedExtension = declaredExt || 'bin';
  let isContainerZip = false;
  let isOfficeDocx = false;
  let isOfficeXlsx = false;
  let isOdsSpreadsheet = false;
  let isPdf = false;
  let isImage = false;
  let isPlainText = false;
  let encoding = 'Binário';

  // 1. Assinatura ZIP / OpenXML: PK\x03\x04 ou PK\x05\x06 (50 4B 03 04 / 50 4B 05 06)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    isContainerZip = true;
    detectedMime = 'application/zip';
    detectedFormatName = 'Arquivo Compactado ZIP';
    detectedExtension = 'zip';

    // Inspecionar internamente o ZIP para detectar se é DOCX, XLSX ou ODS
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(buf);
      const entryNames = Object.keys(zipContent.files);

      if (entryNames.includes('word/document.xml')) {
        isOfficeDocx = true;
        detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        detectedFormatName = 'Microsoft Word (.docx) / OpenXML Document';
        detectedExtension = 'docx';
      } else if (entryNames.some((e) => e.startsWith('xl/worksheets/') || e === 'xl/workbook.xml')) {
        isOfficeXlsx = true;
        detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        detectedFormatName = 'Microsoft Excel (.xlsx) / OpenXML Spreadsheet';
        detectedExtension = 'xlsx';
      } else if (entryNames.includes('content.xml') && entryNames.includes('META-INF/manifest.xml')) {
        isOdsSpreadsheet = true;
        detectedMime = 'application/vnd.oasis.opendocument.spreadsheet';
        detectedFormatName = 'OpenDocument Spreadsheet (.ods)';
        detectedExtension = 'ods';
      }
    } catch (_) {
      // É um zip padrão ou protegido
    }
  }
  // 2. Assinatura PDF: %PDF- (25 50 44 46)
  else if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    isPdf = true;
    detectedMime = 'application/pdf';
    detectedFormatName = 'Documento PDF (Adobe Portable Document)';
    detectedExtension = 'pdf';
  }
  // 3. Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    isImage = true;
    detectedMime = 'image/png';
    detectedFormatName = 'Imagem PNG (Portable Network Graphics)';
    detectedExtension = 'png';
  }
  // 4. Assinatura JPEG: FF D8 FF
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    isImage = true;
    detectedMime = 'image/jpeg';
    detectedFormatName = 'Imagem JPEG / Foto de Ficha';
    detectedExtension = 'jpg';
  }
  // 5. Assinatura WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    isImage = true;
    detectedMime = 'image/webp';
    detectedFormatName = 'Imagem WebP Otimizada';
    detectedExtension = 'webp';
  }
  // 6. UTF-8 BOM: EF BB BF
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    isPlainText = true;
    encoding = 'UTF-8 (com BOM)';
    detectedMime = 'text/plain; charset=utf-8';
    detectedFormatName = 'Texto UTF-8 com Marca de Ordem de Byte (BOM)';
    detectedExtension = declaredExt || 'txt';
  }
  // 7. UTF-16 LE/BE: FF FE ou FE FF
  else if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    isPlainText = true;
    encoding = bytes[0] === 0xff ? 'UTF-16 Little Endian' : 'UTF-16 Big Endian';
    detectedMime = 'text/plain; charset=utf-16';
    detectedFormatName = 'Documento de Texto UTF-16';
    detectedExtension = declaredExt || 'txt';
  }
  // 8. Arquivos de Texto Legível / Estruturado (ASCII / UTF-8)
  else {
    // Analisar os primeiros 1024 bytes para verificar se a maioria são caracteres imprimíveis
    const sampleLimit = Math.min(bytes.length, 1024);
    let printableCount = 0;
    let nullByteCount = 0;

    for (let i = 0; i < sampleLimit; i++) {
      const b = bytes[i];
      if (b === 0) nullByteCount++;
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 160) {
        printableCount++;
      }
    }

    const printableRatio = sampleLimit > 0 ? printableCount / sampleLimit : 0;

    if (nullByteCount === 0 && printableRatio > 0.85) {
      isPlainText = true;
      encoding = 'UTF-8 / ASCII';

      // Decodificar amostra para detectar formato semântico
      const decoder = new TextDecoder('utf-8');
      const sampleText = decoder.decode(bytes.slice(0, Math.min(bytes.length, 4096))).trim();

      if (sampleText.startsWith('{') || sampleText.startsWith('[')) {
        detectedMime = 'application/json';
        detectedFormatName = 'Arquivo Estruturado JSON';
        detectedExtension = 'json';
      } else if (sampleText.startsWith('---') || sampleText.includes('especificacoes:') || sampleText.includes('motor:')) {
        detectedMime = 'text/yaml';
        detectedFormatName = 'Ficha Técnica YAML / Frontmatter';
        detectedExtension = 'yaml';
      } else if (sampleText.includes('#') || sampleText.includes('|') || sampleText.includes('**')) {
        detectedMime = 'text/markdown';
        detectedFormatName = 'Documento Markdown (.md)';
        detectedExtension = 'md';
      } else if (sampleText.includes(',') || sampleText.includes(';') || sampleText.includes('\t')) {
        const lines = sampleText.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          detectedMime = 'text/csv';
          detectedFormatName = 'Planilha Delimitada CSV / Tabela';
          detectedExtension = 'csv';
        } else {
          detectedMime = 'text/plain';
          detectedFormatName = 'Documento de Texto Puro (.txt)';
          detectedExtension = 'txt';
        }
      } else {
        detectedMime = 'text/plain';
        detectedFormatName = 'Documento de Texto Puro (.txt)';
        detectedExtension = 'txt';
      }
    }
  }

  const isExtensionMismatch =
    declaredExt !== '' &&
    declaredExt !== detectedExtension &&
    !(declaredExt === 'yml' && detectedExtension === 'yaml') &&
    !(declaredExt === 'markdown' && detectedExtension === 'md') &&
    !(declaredExt === 'jpeg' && detectedExtension === 'jpg') &&
    !(declaredExt === 'htm' && detectedExtension === 'html');

  return {
    magicBytesHex,
    magicBytesAscii,
    detectedMime,
    detectedFormatName,
    detectedExtension,
    isExtensionMismatch,
    sha256,
    fileSizeBytes,
    formattedSize,
    encoding,
    isContainerZip,
    isOfficeDocx,
    isOfficeXlsx,
    isOdsSpreadsheet,
    isPdf,
    isImage,
    isPlainText,
    hexDump,
  };
}

/**
 * Extrai texto e tabelas estruturadas de uma planilha XLSX diretamente da representação binária OpenXML
 */
export async function extractFromXlsxBuffer(buffer: ArrayBuffer): Promise<{ text: string; tableSpecs: Record<string, string>; sheetRows: string[][] }> {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(buffer);

    // 1. Ler pool de strings compartilhadas (xl/sharedStrings.xml)
    const sharedStrings: string[] = [];
    if (zipContent.files['xl/sharedStrings.xml']) {
      const xmlText = await zipContent.files['xl/sharedStrings.xml'].async('string');
      // Regex para extrair todo texto dentro de <t>...</t> ou <t xml:space="preserve">...</t>
      const stringMatches = xmlText.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g) || [];
      for (const m of stringMatches) {
        const cleaned = m.replace(/<t(?:\s+[^>]*)?>/i, '').replace(/<\/t>/i, '').trim();
        sharedStrings.push(cleaned);
      }
    }

    // 2. Ler as planilhas (xl/worksheets/sheet1.xml, sheet2.xml, etc.)
    const sheetFiles = Object.keys(zipContent.files).filter((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'));
    sheetFiles.sort();

    const allSheetRows: string[][] = [];
    const tableSpecs: Record<string, string> = {};
    const markdownTables: string[] = [];

    for (const sheetPath of sheetFiles) {
      const sheetXml = await zipContent.files[sheetPath].async('string');
      const rowMatches = sheetXml.match(/<row\b[^>]*>([\s\S]*?)<\/row>/g) || [];

      const currentRows: string[][] = [];

      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<c\b[^>]*>([\s\S]*?)<\/c>/g) || [];
        const rowCells: string[] = [];

        for (const cellXml of cellMatches) {
          const isSharedString = cellXml.includes('t="s"');
          const isInlineString = cellXml.includes('t="inlineStr"');

          let cellVal = '';

          if (isSharedString) {
            const vMatch = cellXml.match(/<v>(\d+)<\/v>/);
            if (vMatch) {
              const idx = parseInt(vMatch[1], 10);
              cellVal = sharedStrings[idx] || '';
            }
          } else if (isInlineString) {
            const tMatch = cellXml.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/);
            if (tMatch) cellVal = tMatch[1];
          } else {
            const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
            if (vMatch) cellVal = vMatch[1];
          }

          rowCells.push(cellVal.trim());
        }

        if (rowCells.some((c) => c.length > 0)) {
          currentRows.push(rowCells);
          allSheetRows.push(rowCells);

          // Se tiver 2 colunas com formato Chave: Valor
          if (rowCells.length >= 2 && rowCells[0] && rowCells[1]) {
            const key = rowCells[0].replace(/[:：]/g, '').trim();
            const val = rowCells.slice(1).filter(Boolean).join(' - ').trim();
            if (key.length > 1 && val.length > 0) {
              tableSpecs[key] = val;
            }
          }
        }
      }

      // Converter em tabela Markdown
      if (currentRows.length > 0) {
        const header = currentRows[0];
        const rows = currentRows.slice(1);

        let tableMd = `\n| ${header.join(' | ')} |\n`;
        tableMd += `| ${header.map(() => '---').join(' | ')} |\n`;
        for (const r of rows) {
          tableMd += `| ${r.join(' | ')} |\n`;
        }
        markdownTables.push(tableMd);
      }
    }

    const combinedText = markdownTables.join('\n\n');
    return { text: combinedText, tableSpecs, sheetRows: allSheetRows };
  } catch (err) {
    console.warn('[binaryFileInspector] Erro ao extrair XLSX:', err);
    return { text: '', tableSpecs: {}, sheetRows: [] };
  }
}

/**
 * Extrai texto e tabelas de um documento DOCX diretamente do pacote binário
 */
export async function extractFromDocxBuffer(
  buffer: ArrayBuffer
): Promise<{ text: string; tableSpecs: Record<string, string>; images: Array<{ name: string; dataUri: string; mimeType: string; sizeBytes: number }> }> {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(buffer);
    const tableSpecs: Record<string, string> = {};
    const textBlocks: string[] = [];
    const images: Array<{ name: string; dataUri: string; mimeType: string; sizeBytes: number }> = [];

    // 1. Extrair imagens de word/media/*
    const mediaFiles = Object.keys(zipContent.files).filter((k) => k.startsWith('word/media/'));
    for (const mediaPath of mediaFiles) {
      const entry = zipContent.files[mediaPath];
      if (entry.dir) continue;
      const ext = mediaPath.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64 = await entry.async('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      const sizeBytes = Math.round(base64.length * 0.75);
      images.push({
        name: mediaPath.split('/').pop() || 'imagem',
        dataUri,
        mimeType: mime,
        sizeBytes,
      });
    }

    // 2. Extrair texto e tabelas de word/document.xml
    if (zipContent.files['word/document.xml']) {
      const docXml = await zipContent.files['word/document.xml'].async('string');

      // Extrair tabelas <w:tbl>
      const tableMatches = docXml.match(/<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g) || [];
      for (const tblXml of tableMatches) {
        const trMatches = tblXml.match(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g) || [];
        const tableRows: string[][] = [];

        for (const trXml of trMatches) {
          const tcMatches = trXml.match(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g) || [];
          const rowCells: string[] = [];

          for (const tcXml of tcMatches) {
            const tMatches = tcXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
            const cellText = tMatches
              .map((m) => m.replace(/<w:t(?:\s+[^>]*)?>/i, '').replace(/<\/w:t>/i, ''))
              .join('')
              .trim();
            rowCells.push(cellText);
          }

          if (rowCells.some((c) => c.length > 0)) {
            tableRows.push(rowCells);
            if (rowCells.length >= 2 && rowCells[0] && rowCells[1]) {
              const k = rowCells[0].replace(/[:：]/g, '').trim();
              const v = rowCells.slice(1).filter(Boolean).join(' - ').trim();
              if (k.length > 1 && v.length > 0) {
                tableSpecs[k] = v;
              }
            }
          }
        }

        if (tableRows.length > 0) {
          const header = tableRows[0];
          let tblMd = `\n| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n`;
          for (const r of tableRows.slice(1)) {
            tblMd += `| ${r.join(' | ')} |\n`;
          }
          textBlocks.push(tblMd);
        }
      }

      // Extrair parágrafos normais <w:p>
      const pMatches = docXml.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g) || [];
      for (const pXml of pMatches) {
        // Se estiver dentro de tabela, pode já ter sido processado, mas parágrafos isolados trazem títulos e descrições
        const tMatches = pXml.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
        const pText = tMatches
          .map((m) => m.replace(/<w:t(?:\s+[^>]*)?>/i, '').replace(/<\/w:t>/i, ''))
          .join('')
          .trim();

        if (pText.length > 0) {
          // Detectar negrito
          const isBold = pXml.includes('<w:b/>') || pXml.includes('<w:b ');
          if (isBold && pText.length < 80) {
            textBlocks.push(`\n**${pText}**\n`);
          } else {
            textBlocks.push(pText);
          }

          // Checar parágrafo no formato Chave: Valor
          const colonMatch = pText.match(/^([A-Za-zÀ-ÿ\s/()]{3,35})\s*:\s*(.+)$/);
          if (colonMatch) {
            tableSpecs[colonMatch[1].trim()] = colonMatch[2].trim();
          }
        }
      }
    }

    const cleanText = textBlocks.join('\n\n');
    return { text: cleanText, tableSpecs, images };
  } catch (err) {
    console.warn('[binaryFileInspector] Erro ao extrair DOCX:', err);
    return { text: '', tableSpecs: {}, images: [] };
  }
}
