/**
 * lib/admin/ingestion/fileReaders.ts
 * File reading and text decoding utilities.
 */

import { load as yamlLoad } from 'js-yaml';

export const MAX_TEXT_BYTES = 20 * 1024 * 1024;

/**
 * Descobre a codificação do buffer e decodifica.
 *
 * O caminho antigo usava `readAsText(file, 'utf-8')` fixo. Ficha técnica
 * exportada de Excel ou Word no Brasil é Latin-1 / Windows-1252, não UTF-8, e
 * virava mojibake: "Disco Hidráulico" saía "Disco Hidr\ufffdulico". O matcher
 * de especificações normaliza acento e ainda encontra o campo certo, então o
 * bug passava despercebido no score — mas o VALOR gravado na ficha ia
 * corrompido para o site.
 *
 * A ordem de tentativa: BOM manda; depois UTF-8 estrito, que só passa se o
 * arquivo for de fato UTF-8; e na falha, Windows-1252, que é o superconjunto
 * do Latin-1 e o que o Office brasileiro grava.
 */
export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Lê o conteúdo em texto de um File com tolerância a encodings (UTF-8 e fallback FileReader)
 */
export async function readFileAsText(file: File): Promise<string> {
  if (file.size > MAX_TEXT_BYTES) {
    throw new Error(
      `Arquivo de texto grande demais (${(file.size / 1024 / 1024).toFixed(1)} MB, ` +
        `limite ${MAX_TEXT_BYTES / 1024 / 1024} MB). Se for uma ficha com muitas páginas, envie como PDF.`
    );
  }

  try {
    return decodeTextBuffer(await file.arrayBuffer());
  } catch (e) {
    console.warn('[fileIngestion] arrayBuffer falhou, tentando FileReader:', e);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(decodeTextBuffer((reader.result as ArrayBuffer) ?? new ArrayBuffer(0)));
    reader.onerror = (err) => reject(new Error('Não foi possível ler o arquivo: ' + (err || 'Erro no leitor')));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Lê arquivo como Base64 (DataURL)
 */
export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Converte qualquer representação de valor monetário (BR ou US) para número float seguro.
 * Ex: "R$ 4.990,00" -> 4990 | "4.500,50" -> 4500.5 | "4200.00" -> 4200
 */
export function parseBrazilianCurrency(val: unknown): number {
  if (typeof val === 'number') {
    return isFinite(val) && val > 0 ? val : 0;
  }
  if (!val || typeof val !== 'string') return 0;

  const str = val.trim();
  if (!str) return 0;

  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = parseFloat(str);
    return isFinite(n) ? n : 0;
  }

  let cleaned = str.replace(/[^0-9,.-]/g, '');

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      cleaned = cleaned.replace('.', '');
    }
  }

  const num = parseFloat(cleaned);
  return isFinite(num) && num > 0 ? num : 0;
}

/**
 * Parser de JSON altamente tolerante a falhas humanas.
 */
export function safeParseJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw.replace(/^\uFEFF/, '').trim();

  try {
    return JSON.parse(text);
  } catch (_) {}

  try {
    text = text
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    text = text.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    text = text.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(text);
    } catch (_) {}

    const singleToDouble = text
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    return JSON.parse(singleToDouble);
  } catch (err) {
    console.warn('[fileIngestion] safeParseJson não conseguiu restaurar JSON:', err);
    return null;
  }
}

/**
 * Parser de YAML tolerante a falhas.
 */
export function safeParseYaml(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  let text = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ');

  try {
    const res = yamlLoad(text);
    if (res && typeof res === 'object') {
      return res;
    }
  } catch (e) {
    console.warn('[fileIngestion] Falha no yaml.load estrito, aplicando extração heurística:', e);
  }

  try {
    const extracted: Record<string, any> = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\s*)([a-zA-Z0-9_\u00C0-\u00FF\s-]+)\s*:\s*(.*)$/);
      if (match) {
        const key = match[2].trim();
        let val = match[3].trim();
        val = val.replace(/^["']|["']$/g, '');

        if (key && val && !extracted[key]) {
          if (val.toLowerCase() === 'true') extracted[key] = true;
          else if (val.toLowerCase() === 'false') extracted[key] = false;
          else if (/^-?\d+(\.\d+)?$/.test(val)) extracted[key] = Number(val);
          else extracted[key] = val;
        }
      }
    }

    if (Object.keys(extracted).length > 0) {
      return extracted;
    }
  } catch (_) {}

  return null;
}
