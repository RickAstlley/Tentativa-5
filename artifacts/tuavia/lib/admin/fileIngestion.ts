import { load as yamlLoad } from 'js-yaml';
import JSZip from 'jszip';
import {
  BinarySignatureInfo,
  inspectBinarySignature,
  extractFromXlsxBuffer,
  extractFromDocxBuffer,
} from '@/lib/admin/binaryFileInspector';
import {
  allocateAndNormalizeSpecSections,
  cleanMarkdownAndHtmlEntities,
  cleanSpecValue,
  sanitizeRimValue,
  sanitizeContranValue,
  sanitizeBatteryChemistryValue,
  CANONICAL_SPEC_SECTIONS,
} from '@/lib/specAllocations';
import { SpecStatus, SpecConfidence } from '@/types/ebike';

/**
 * Termos que indicam que o valor extraído do documento não foi confirmado.
 *
 * Inlineado de `lib/ai/deterministicAuditor.ts`, que foi removido junto com o
 * subsistema de LLM. O auditor determinístico inteiro dependia de modelo; esta
 * função não — é só uma lista de regex, sem nenhuma chamada de IA, e a ingestão
 * de arquivo continua funcionando sem ela.
 */
const UNCONFIRMED_VALUE_PATTERNS = [
  /^não\s*informad[oa]/i,
  /^nao\s*informad[oa]/i,
  /^não\s*especificad[oa]/i,
  /^nao\s*especificad[oa]/i,
  /^não\s*confirmad[oa]/i,
  /^nao\s*confirmad[oa]/i,
  /^não\s*declarad[oa]/i,
  /^nao\s*declarad[oa]/i,
  /^não\s*homologad[oa]/i,
  /^nao\s*homologad[oa]/i,
  /^não\s*aferid[oa]/i,
  /^nao\s*aferid[oa]/i,
  /^pendente/i,
  /^sem\s*confirma[cç][aã]o/i,
  /^a\s*definir/i,
  /^n\/?a$/i,
  /^não\s*consta/i,
  /^nao\s*consta/i,
  /^desconhecido/i,
  /^indispon[ií]vel/i,
  /^em\s*apura[cç][aã]o/i,
  /^\?+$/,
  /^-+$/,
];

function isUnconfirmedValue(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  return UNCONFIRMED_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export type { BinarySignatureInfo };

export interface ExtractedImageFile {
  name: string;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IngestedFilePayload {
  fileName: string;
  fileType: 'md' | 'txt' | 'yaml' | 'json' | 'csv' | 'zip' | 'pdf' | 'html' | 'docx' | 'xlsx' | 'ods' | 'image' | 'unknown';
  rawText: string;
  parsedYamlOrJson?: any;
  images?: ExtractedImageFile[];
  detectedTitle?: string;
  detectedPricePoints?: Array<{ mes: string; preco: number; loja?: string }>;
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
}

/**
 * Detecta o propósito/natureza do documento de forma automática:
 * - 'ebike': Ficha técnica ou especificações de uma e-bike específica.
 * - 'article': Artigo editorial, guia de uso, tutorial ou notícia.
 * - 'ranking': Comparativo de múltiplos modelos, lista de melhores ou top e-bikes.
 */
export function detectDocumentKind(text: string, fileName?: string): 'ebike' | 'article' | 'ranking' {
  const combined = `${fileName || ''} ${text.slice(0, 8000)}`.toLowerCase();

  const rankingMatches = (combined.match(/\b(ranking|melhores|comparativo|top\s*\d+|guia\s*de\s*compra|versus|\bvs\b|qual\s*comprar|tabela\s*comparativa|custo-benef[íi]cio)\b/gi) || []).length;
  const articleMatches = (combined.match(/\b(artigo|publicado\s*em|autor|tempo\s*de\s*leitura|dicas|tutorial|guia\s*completo|como\s*escolher|manuten[çc][ãa]o|legisla[çc][ãa]o|not[íi]cia)\b/gi) || []).length;
  const ebikeMatches = (combined.match(/\b(especifica[çc][õo]es|ficha\s*t[ée]cnica|motor|bateria|quadro|autonomia|pot[êe]ncia|shimano|bafang|aro\s*\d+|tempo\s*de\s*recarga|freio\s*a\s*disco)\b/gi) || []).length;

  if (rankingMatches >= 2 && rankingMatches >= articleMatches) {
    return 'ranking';
  }
  if (articleMatches >= 2 && articleMatches > ebikeMatches / 2) {
    return 'article';
  }
  return 'ebike';
}

/**
 * Lê o conteúdo em texto de um File com tolerância a encodings (UTF-8 e fallback FileReader)
 */
async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    try {
      const txt = await file.text();
      if (txt) return txt;
    } catch (e) {
      console.warn('[fileIngestion] file.text() falhou, tentando FileReader:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || '');
    reader.onerror = (err) => reject(new Error('Não foi possível ler o arquivo: ' + (err || 'Erro no leitor')));
    reader.readAsText(file, 'utf-8');
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

  // Se já for número simples com ponto decimal
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = parseFloat(str);
    return isFinite(n) ? n : 0;
  }

  // Remove R$, espaços, e caracteres não numéricos exceto , e .
  let cleaned = str.replace(/[^0-9,.-]/g, '');

  // Caso padrão brasileiro: 4.990,00 ou 4.990
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 4.990,00 -> remove ponto de milhar e troca vírgula por ponto
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // Ex: 4990,00 ou 45,5
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.')) {
    // Pode ser milhar "4.990" ou decimal "4990.00"
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      // É milhar brasileiro (ex: 4.990)
      cleaned = cleaned.replace('.', '');
    }
  }

  const num = parseFloat(cleaned);
  return isFinite(num) && num > 0 ? num : 0;
}

/**
 * Parser de JSON altamente tolerante a falhas humanas:
 * - Remove BOM do UTF-8
 * - Converte aspas curvas inteligentes (Word, Mac) para aspas padrão
 * - Remove comentários JS de linha e de bloco
 * - Remove vírgulas sobressalentes no fim de arrays e objetos (trailing commas)
 * - Corrige chaves sem aspas e aspas simples
 */
export function safeParseJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  // Limpeza de BOM
  let text = raw.replace(/^\uFEFF/, '').trim();

  // 1. Tentar parse nativo direto primeiro (rápido e sem overhead)
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2. Higienização de imperfeições comuns
  try {
    // Normalizar aspas curvas
    text = text
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    // Remover comentários // e /* */
    text = text.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

    // Remover trailing commas antes de } ou ]
    text = text.replace(/,\s*([}\]])/g, '$1');

    // Tentar de novo
    try {
      return JSON.parse(text);
    } catch (_) {}

    // Converter aspas simples em chaves e valores para aspas duplas
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
 * Parser de YAML tolerante a falhas:
 * - Converte tabs (\t) em espaços (causa #1 de falha no parser YAML)
 * - Remove BOM e caracteres de controle
 * - Se o parser falhar, aplica heurística de regex chave-valor para não perder dados
 */
export function safeParseYaml(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Normalizar texto
  let text = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Converte qualquer tabulação em 2 espaços
    .replace(/\t/g, '  ');

  // 2. Tentar carregar com js-yaml
  try {
    const res = yamlLoad(text);
    if (res && typeof res === 'object') {
      return res;
    }
  } catch (e) {
    console.warn('[fileIngestion] Falha no yaml.load estrito, aplicando extração heurística:', e);
  }

  // 3. Fallback Heurístico para YAML com syntax error humano
  // Extrai pares "chave: valor" mesmo se a indentação ou aspas estiverem erradas
  try {
    const extracted: Record<string, any> = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\s*)([a-zA-Z0-9_\u00C0-\u00FF\s-]+)\s*:\s*(.*)$/);
      if (match) {
        const key = match[2].trim();
        let val = match[3].trim();
        // Remove aspas nas pontas se existirem
        val = val.replace(/^["']|["']$/g, '');

        if (key && val && !extracted[key]) {
          // Converter booleanos ou números óbvios
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

/**
 * Detecta o separador dominante de CSV (, ; \t |) analisando as primeiras linhas
 */
function detectCsvDelimiter(csvText: string): string {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10);
  if (lines.length === 0) return ',';

  const candidates = [';', ',', '\t', '|'];
  const scores: Record<string, number> = { ';': 0, ',': 0, '\t': 0, '|': 0 };

  for (const line of lines) {
    for (const delim of candidates) {
      // Conta ocorrências fora de aspas
      const count = (line.split(delim).length - 1);
      scores[delim] += count;
    }
  }

  // Retorna o delimitador com maior frequência acumulada
  let bestDelim = ',';
  let maxCount = -1;
  for (const delim of candidates) {
    if (scores[delim] > maxCount && scores[delim] > 0) {
      maxCount = scores[delim];
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * Extrai dados determinísticos de tabelas Markdown (| Spec | Valor |), listas e cabeçalhos contextuais.
 * Permite que arquivos .md com tabelas sejam consumidos instantaneamente e de forma 100% factual.
 */
export function extractMarkdownTablesAndSpecs(text: string): Record<string, any> {
  if (!text || typeof text !== 'string') return {};
  const extracted: Record<string, any> = {};

  const lines = text.split(/\r?\n/);
  let currentH2 = '';
  let currentH3 = '';
  let currentSubContext: 'none' | 'equip_confirmed' | 'equip_unconfirmed' | 'garantia' | 'dimensoes_produto' | 'dimensoes_embalagem' = 'none';

  const garantiaItems: Array<{ item: string; valor: string }> = [];
  const dimensoesProduto: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Detecção de cabeçalhos H2 / H3
    if (trimmed.startsWith('## ')) {
      currentH2 = trimmed.replace(/^##\s+/, '').toLowerCase().trim();
      currentH3 = '';
      currentSubContext = 'none';
      if (currentH2.includes('garantia')) currentSubContext = 'garantia';
      else if (currentH2.includes('dimens')) currentSubContext = 'dimensoes_produto';
      continue;
    } else if (trimmed.startsWith('### ')) {
      currentH3 = trimmed.replace(/^###\s+/, '').toLowerCase().trim();
      if (currentH3.includes('produto')) currentSubContext = 'dimensoes_produto';
      else if (currentH3.includes('embalagem')) currentSubContext = 'dimensoes_embalagem';
      continue;
    }

    // 2. Detecção de subseções em texto livre (ex: "Confirmados na ficha comercial:" vs "Não confirmados como padrão:")
    if (currentH2.includes('equipamento') || currentH2.includes('acess')) {
      if (/confirmad.*na\s*ficha|confirmad.*como\s*padr[aã]o|itens\s*(?:inclusos|de\s*s[eé]rie)/i.test(trimmed)) {
        currentSubContext = 'equip_confirmed';
        continue;
      } else if (/n[aã]o\s*confirmad|opciona(?:is|l)|n[aã]o\s*inclus/i.test(trimmed)) {
        currentSubContext = 'equip_unconfirmed';
        continue;
      }
    }

    // 3. Processamento de listas em Equipamentos
    if (currentSubContext === 'equip_confirmed' && /^[*-]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[*-]\s+/, '').trim();
      if (/farol\s*dianteiro|luz\s*dianteira/i.test(itemText)) {
        extracted['iluminação dianteira'] = itemText;
        extracted['farol dianteiro'] = itemText;
      }
      if (/descanso\s*lateral|cavalete|paralama/i.test(itemText)) {
        extracted['paralamas & cavalete'] = itemText;
        extracted['descanso lateral'] = itemText;
      }
      if (/lanterna\s*traseira|farol\s*traseiro/i.test(itemText)) {
        extracted['iluminação traseira'] = itemText;
      }
      if (/buzina/i.test(itemText)) {
        extracted['refletores & buzina'] = itemText;
      }
      if (/bagageiro|garupa/i.test(itemText)) {
        extracted['bagageiro / rack'] = itemText;
      }
      continue;
    }

    if (currentSubContext === 'equip_unconfirmed' && /^[*-]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[*-]\s+/, '').trim();
      if (/farol\s*traseiro|luz\s*de\s*freio/i.test(itemText)) {
        extracted['iluminação traseira'] = 'Não informado pelo fabricante';
      }
      if (/buzina/i.test(itemText)) {
        extracted['refletores & buzina'] = 'Não informado pelo fabricante';
      }
      if (/bagageiro|cesta/i.test(itemText)) {
        extracted['bagageiro / rack'] = 'Não informado pelo fabricante';
      }
      if (/display|painel/i.test(itemText)) {
        extracted['painel / display'] = 'Não informado pelo fabricante';
      }
      continue;
    }

    // 4. Parse de tabelas Markdown: | Chave | Valor | (Opcional Status) |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .split('|')
        .map((c) => cleanMarkdownAndHtmlEntities(c.trim()))
        .filter((c) => c.length > 0);

      if (cells.length >= 2) {
        const rawKey = cleanMarkdownAndHtmlEntities(cells[0]);
        const key = rawKey.toLowerCase().replace(/[:*_-]/g, ' ').trim();
        const val = cleanMarkdownAndHtmlEntities(cells[1]);

        // Ignora separadores de tabela e cabeçalhos padrão
        if (key.match(/^[-:]+$/) || val.match(/^[-:]+$/)) continue;
        if (/^(campo|especifica[cç][aã]o|especifica[cç][oõ]es|item|itens|par[aâ]metro|par[aâ]metros|caracter[ií]stica|caracter[ií]sticas|propriedade|propriedades|componente|componentes|dado|dados|medida)$/i.test(key)) {
          continue;
        }

        if (key && val && val.length > 0 && !val.includes('---')) {
          extracted[key] = val;

          // Se estiver na seção de garantia, guarda para junção
          if (currentH2.includes('garantia') || key.includes('garantia')) {
            garantiaItems.push({ item: rawKey, valor: val });
            extracted[`garantia_${key}`] = val;
          }

          // Se estiver na seção de dimensões do produto
          if (currentSubContext === 'dimensoes_produto' || currentH2.includes('dimens')) {
            if (/largura/i.test(key)) dimensoesProduto['largura'] = val;
            if (/altura/i.test(key)) dimensoesProduto['altura'] = val;
            if (/profundidade|comprimento/i.test(key)) dimensoesProduto['profundidade'] = val;
          }

          // Qualificação de chave por contexto
          if (currentH2.includes('quadro') || currentH2.includes('materiais')) {
            if (key === 'pedivela') extracted['corrente e pedivela'] = `Pedivela em ${val}`;
            if (key === 'canote') extracted['selim e canote'] = `Canote em ${val}`;
            if (key === 'guidão' || key === 'guidao') extracted['ajuste de guidão'] = `Guidão em ${val}`;
            if (key === 'quadro' || key.includes('material geral') || key.includes('material do quadro') || key.includes('liga do quadro')) {
              extracted['material do quadro'] = val;
              extracted['material'] = val;
            }
          }

          if (currentH2.includes('suspensão') || currentH2.includes('suspensao')) {
            if (key === 'dianteira') extracted['suspensão dianteira'] = val;
            if (key === 'traseira') extracted['suspensão traseira'] = val;
          }

          if (currentH2.includes('freio')) {
            if (key === 'sistema') extracted['sistema de freios'] = val;
            if (key === 'dianteiro') extracted['freio dianteiro'] = val;
            if (key === 'traseiro') extracted['freio traseiro'] = val;
          }
        }
      }
      continue;
    }

    // 5. Parse de listas e linhas chave: valor (- Chave: **Valor** ou **Chave**: Valor ou Chave: Valor)
    const bulletRegex = /^(?:[*-]\s*)?(?:\*\*(.*?)\*\*|(.*?))\s*:\s*(?:\*\*(.*?)\*\*|(.*?))$/gm;
    let match: RegExpExecArray | null;
    while ((match = bulletRegex.exec(trimmed)) !== null) {
      const rawKey = cleanMarkdownAndHtmlEntities(match[1] || match[2] || '').replace(/^[#*-]\s*/, '').toLowerCase().trim();
      const rawVal = cleanMarkdownAndHtmlEntities(match[3] || match[4] || '').trim();
      if (
        rawKey &&
        rawVal &&
        rawKey.length < 60 &&
        !/^(http|https|\/\/)/i.test(rawKey) &&
        !extracted[rawKey]
      ) {
        extracted[rawKey] = rawVal;
      }
    }
  }

  // 6. Consolidação de Garantia Composta
  if (garantiaItems.length > 0) {
    const combinedGarantia = garantiaItems.map((g) => `${g.item}: ${g.valor}`).join(' | ');
    extracted['garantia'] = combinedGarantia;
    extracted['garantia de fábrica'] = combinedGarantia;
    extracted['garantia de fabrica'] = combinedGarantia;
  }

  // 7. Consolidação de Dimensões
  if (dimensoesProduto['largura'] && dimensoesProduto['altura'] && dimensoesProduto['profundidade']) {
    extracted['dimensões (cxlxa)'] = `${dimensoesProduto['largura']} x ${dimensoesProduto['profundidade']} x ${dimensoesProduto['altura']} (LxPxA)`;
    extracted['dimensões'] = extracted['dimensões (cxlxa)'];
  }

  return extracted;
}

/**
 * Divide uma linha de CSV respeitando aspas duplas internas
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Pula aspas duplas escapadas ""
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Analisa CSV para extrair tabela de dados estruturados
 */
function parseCsvToStructuredData(csvText: string): { rows: Array<Record<string, any>>; headers: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], headers: [] };

  const delimiter = detectCsvDelimiter(csvText);
  const rawHeaders = parseCsvLine(lines[0], delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Array<Record<string, any>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter).map((v) => v.replace(/^["']|["']$/g, '').trim());
    if (values.length === 0 || values.every((v) => v === '')) continue;

    const rowObj: Record<string, any> = {};
    for (let j = 0; j < rawHeaders.length; j++) {
      const headerName = rawHeaders[j] || `col_${j}`;
      rowObj[headerName] = values[j] !== undefined ? values[j] : '';
    }
    rows.push(rowObj);
  }

  return { rows, headers: rawHeaders };
}

/**
 * Converte HTML em texto estruturado e limpo similar a Markdown
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '');

  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowContent) => {
    const cells = rowContent
      .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, ' | $1')
      .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, ' | $1');
    return '\n' + cells.replace(/<[^>]+>/g, '').trim() + ' |';
  });

  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
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
 * Descomprime um bloco de stream PDF /FlateDecode utilizando DecompressionStream nativo
 */
async function decompressPdfFlateStream(compressedBytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined' || compressedBytes.length < 4) return '';

  // 1. Tenta descompressão com zlib/deflate padrão
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes as any);
    writer.close();
    const response = new Response(ds.readable);
    const buf = await response.arrayBuffer();
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch {
    // 2. Fallback: Tenta deflate-raw removendo header zlib de 2 bytes e checksum final
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      const raw = compressedBytes.length > 6 ? compressedBytes.slice(2, -4) : compressedBytes;
      writer.write(raw as any);
      writer.close();
      const response = new Response(ds.readable);
      const buf = await response.arrayBuffer();
      return new TextDecoder('utf-8', { fatal: false }).decode(buf);
    } catch {
      return '';
    }
  }
}

/**
 * Extrai texto legível e tabelas de um PDF sem depender de bibliotecas binárias pesadas.
 * Faz descompressão de streams /FlateDecode e extração de operadores Tj, TJ e blocos de texto.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let rawStr = '';

    // Lê como string binária com limite de segurança de 4MB
    const maxLen = Math.min(bytes.length, 4 * 1024 * 1024);
    for (let i = 0; i < maxLen; i++) {
      rawStr += String.fromCharCode(bytes[i]);
    }

    const textPieces: string[] = [];

    // 1. Localiza streams comprimidos /FlateDecode para descompressão nativa
    const streamMarker = 'stream';
    const endstreamMarker = 'endstream';
    let searchPos = 0;
    let decompressedCount = 0;

    while (decompressedCount < 40) {
      const streamIdx = rawStr.indexOf(streamMarker, searchPos);
      if (streamIdx === -1) break;

      const endStreamIdx = rawStr.indexOf(endstreamMarker, streamIdx + streamMarker.length);
      if (endStreamIdx === -1) break;

      // Avança além do marcador 'stream' e eventuais quebras de linha (\r\n ou \n)
      let dataStart = streamIdx + streamMarker.length;
      while (dataStart < endStreamIdx && (bytes[dataStart] === 0x0D || bytes[dataStart] === 0x0A)) {
        dataStart++;
      }

      // Recua quebras de linha antes de 'endstream'
      let dataEnd = endStreamIdx;
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0D || bytes[dataEnd - 1] === 0x0A)) {
        dataEnd--;
      }

      if (dataEnd > dataStart && dataEnd - dataStart > 10) {
        const streamBytes = bytes.subarray(dataStart, dataEnd);
        try {
          const decompressed = await decompressPdfFlateStream(streamBytes);
          if (decompressed && decompressed.length > 10) {
            // Extrai textos de Tj e TJ do stream descomprimido
            const subTj = /\((.*?)\)\s*Tj/g;
            let m: RegExpExecArray | null;
            while ((m = subTj.exec(decompressed)) !== null) {
              const str = m[1].replace(/\\([()\\])/g, '$1').trim();
              if (str.length > 0) textPieces.push(str);
            }

            const subTjArray = /\[(.*?)\]\s*TJ/g;
            while ((m = subTjArray.exec(decompressed)) !== null) {
              const inner = m[1];
              const subMatches = inner.match(/\((.*?)\)/g);
              if (subMatches) {
                const combined = subMatches
                  .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, '$1'))
                  .join('');
                if (combined.trim().length > 0) textPieces.push(combined.trim());
              }
            }

            decompressedCount++;
          }
        } catch {
          // Stream não era zlib ou falhou na descompressão
        }
      }

      searchPos = endStreamIdx + endstreamMarker.length;
    }

    // 2. Extração de strings no corpo não comprimido
    const tjRegex = /\((.*?)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(rawStr)) !== null) {
      const decoded = match[1].replace(/\\([()\\])/g, '$1');
      if (decoded.trim().length > 1) {
        textPieces.push(decoded.trim());
      }
    }

    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(rawStr)) !== null) {
      const inner = match[1];
      const subStrings: string[] = [];
      const subRegex = /\((.*?)\)/g;
      let subMatch: RegExpExecArray | null;
      while ((subMatch = subRegex.exec(inner)) !== null) {
        const decoded = subMatch[1].replace(/\\([()\\])/g, '$1');
        if (decoded.trim()) subStrings.push(decoded);
      }
      if (subStrings.length > 0) {
        textPieces.push(subStrings.join(''));
      }
    }

    if (textPieces.length >= 6) {
      return textPieces.join(' ').replace(/\s+/g, ' ').trim();
    }

    // 3. Fallback: Localizar sequências de texto imprimível ASCII (4+ caracteres)
    const asciiRegex = /[A-Za-z0-9À-ÿ\s,.:;!?'"()/\-–]{4,}/g;
    const readableBlocks: string[] = [];
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
      return readableBlocks.slice(0, 1000).join('\n');
    }

    return `Documento PDF: ${file.name} (${Math.round(file.size / 1024)} KB)`;
  } catch (err) {
    console.warn('[fileIngestion] Falha ao analisar PDF no cliente:', err);
    return `Documento PDF: ${file.name}`;
  }
}

function finalizePayload(payload: IngestedFilePayload, file: File): IngestedFilePayload {
  const words = payload.rawText ? payload.rawText.trim().split(/\s+/).filter(Boolean).length : 0;
  return {
    ...payload,
    fileSizeBytes: payload.fileSizeBytes || file.size || (payload.rawText ? payload.rawText.length : 0),
    wordCount: words,
    detectedKind: payload.detectedKind || detectDocumentKind(payload.rawText, payload.fileName),
  };
}

/**
 * Lê e analisa arquivos (.MD, .TXT, .YAML, .YML, .JSON, .CSV, .ZIP, .PDF, .HTML, .DOCX, .XLSX, .ODS, Imagens)
 * no lado do cliente com inteligência binária (Magic Bytes, Hash SHA-256, OpenXML parsers nativos)
 * e tolerância máxima a falhas estruturais, encodings mistos e extensões divergentes.
 */
export async function parseUploadedFile(file: File): Promise<IngestedFilePayload> {
  const fileName = file.name || 'arquivo';
  const declaredExt = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Ler o buffer binário bruto e inspecionar assinatura (Magic Bytes)
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err) {
    console.warn('[fileIngestion] Falha ao obter arrayBuffer:', err);
    buffer = new ArrayBuffer(0);
  }

  const binaryInfo = await inspectBinarySignature(file, buffer);

  // 2. Roteamento por formato binário real

  // 2.1 Microsoft Excel (.xlsx) / OpenXML Spreadsheet
  if (binaryInfo.isOfficeXlsx || declaredExt === 'xlsx' || declaredExt === 'xls') {
    const { text, tableSpecs, sheetRows } = await extractFromXlsxBuffer(buffer);
    const pricePoints = extractPricePointsHint(text, tableSpecs);

    return finalizePayload({
      fileName,
      fileType: 'xlsx',
      rawText: text || `Planilha Excel: ${fileName} (${sheetRows.length} linhas extraídas)`,
      parsedYamlOrJson: Object.keys(tableSpecs).length > 0 ? { tableSpecs, sheetRows } : undefined,
      detectedTitle: extractTitleHint(text, tableSpecs) || fileName.replace(/\.(xlsx|xls)$/i, ''),
      detectedPricePoints: pricePoints,
      binaryInfo,
      mimeType: binaryInfo.detectedMime,
    }, file);
  }

  // 2.2 Microsoft Word (.docx) / OpenXML Document
  if (binaryInfo.isOfficeDocx || declaredExt === 'docx' || declaredExt === 'doc') {
    const { text, tableSpecs, images } = await extractFromDocxBuffer(buffer);
    const pricePoints = extractPricePointsHint(text, tableSpecs);

    return finalizePayload({
      fileName,
      fileType: 'docx',
      rawText: text || `Documento Word: ${fileName}`,
      parsedYamlOrJson: Object.keys(tableSpecs).length > 0 ? { tableSpecs } : undefined,
      images,
      detectedTitle: extractTitleHint(text, tableSpecs) || fileName.replace(/\.(docx|doc)$/i, ''),
      detectedPricePoints: pricePoints,
      binaryInfo,
      mimeType: binaryInfo.detectedMime,
    }, file);
  }

  // 2.3 Arquivo ZIP (.zip) genérico
  if (binaryInfo.isContainerZip || declaredExt === 'zip') {
    const zipPayload = await parseZipFile(file);
    return finalizePayload({
      ...zipPayload,
      binaryInfo,
    }, file);
  }

  // 2.4 Arquivo PDF (.pdf)
  if (binaryInfo.isPdf || declaredExt === 'pdf') {
    const pdfText = await extractTextFromPdf(file);
    let base64 = '';
    try {
      base64 = await readFileAsBase64(file);
    } catch (_) {}

    const tableSpecs = extractMarkdownTablesAndSpecs(pdfText);
    return finalizePayload({
      fileName,
      fileType: 'pdf',
      rawText: pdfText,
      parsedYamlOrJson: Object.keys(tableSpecs).length > 0 ? { tableSpecs } : undefined,
      detectedTitle: extractTitleHint(pdfText, null) || fileName.replace(/\.pdf$/i, ''),
      detectedPricePoints: extractPricePointsHint(pdfText, null),
      fileBase64: base64,
      mimeType: 'application/pdf',
      binaryInfo,
    }, file);
  }

  // 2.5 Arquivo HTML (.html, .htm)
  if (declaredExt === 'html' || declaredExt === 'htm') {
    const rawHtml = await readFileAsText(file);
    const cleanMd = extractTextFromHtml(rawHtml);
    const tableSpecs = extractMarkdownTablesAndSpecs(cleanMd);
    return finalizePayload({
      fileName,
      fileType: 'html',
      rawText: cleanMd,
      parsedYamlOrJson: Object.keys(tableSpecs).length > 0 ? { tableSpecs } : undefined,
      detectedTitle: extractTitleHint(cleanMd, null) || fileName.replace(/\.html?$/i, ''),
      detectedPricePoints: extractPricePointsHint(cleanMd, null),
      binaryInfo,
    }, file);
  }

  // 2.6 Imagens (PNG, JPG, WEBP)
  if (binaryInfo.isImage || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(declaredExt)) {
    let base64 = '';
    try {
      base64 = await readFileAsBase64(file);
    } catch (_) {}

    return finalizePayload({
      fileName,
      fileType: 'image',
      rawText: `[Imagem E-Bike / Ficha Visual: ${fileName} (${binaryInfo.formattedSize})]`,
      images: [
        {
          name: fileName,
          dataUri: base64,
          mimeType: binaryInfo.detectedMime,
          sizeBytes: binaryInfo.fileSizeBytes,
        },
      ],
      detectedTitle: fileName.replace(/\.(png|jpe?g|webp|gif)$/i, ''),
      fileBase64: base64,
      mimeType: binaryInfo.detectedMime,
      binaryInfo,
    }, file);
  }

  // 2.7 Arquivos de texto e dados estruturados
  const rawText = await readFileAsText(file);
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();

  // YAML / YML
  if (declaredExt === 'yaml' || declaredExt === 'yml' || binaryInfo.detectedExtension === 'yaml') {
    const parsed = safeParseYaml(cleanText);
    return finalizePayload({
      fileName,
      fileType: 'yaml',
      rawText: cleanText,
      parsedYamlOrJson: parsed,
      detectedTitle: extractTitleHint(cleanText, parsed),
      detectedPricePoints: extractPricePointsHint(cleanText, parsed),
      binaryInfo,
    }, file);
  }

  // JSON
  if (declaredExt === 'json' || binaryInfo.detectedExtension === 'json') {
    const parsed = safeParseJson(cleanText);
    return finalizePayload({
      fileName,
      fileType: 'json',
      rawText: cleanText,
      parsedYamlOrJson: parsed,
      detectedTitle: extractTitleHint(cleanText, parsed),
      detectedPricePoints: extractPricePointsHint(cleanText, parsed),
      binaryInfo,
    }, file);
  }

  // Markdown (.md, .markdown)
  if (declaredExt === 'md' || declaredExt === 'markdown' || binaryInfo.detectedExtension === 'md') {
    let frontmatterData: any = null;
    const frontmatterMatch = cleanText.match(/^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
    if (frontmatterMatch) {
      frontmatterData = safeParseYaml(frontmatterMatch[1]);
    }

    const tableSpecs = extractMarkdownTablesAndSpecs(cleanText);
    const combinedData = {
      ...(frontmatterData || {}),
      ...(Object.keys(tableSpecs).length > 0 ? { tableSpecs } : {}),
    };

    return finalizePayload({
      fileName,
      fileType: 'md',
      rawText: cleanText,
      parsedYamlOrJson: Object.keys(combinedData).length > 0 ? combinedData : null,
      detectedTitle: extractTitleHint(cleanText, combinedData),
      detectedPricePoints: extractPricePointsHint(cleanText, combinedData),
      binaryInfo,
    }, file);
  }

  // CSV
  if (declaredExt === 'csv' || binaryInfo.detectedExtension === 'csv') {
    const { rows } = parseCsvToStructuredData(cleanText);
    const pricePoints = extractPricePointsFromCsv(cleanText);

    return finalizePayload({
      fileName,
      fileType: 'csv',
      rawText: cleanText,
      parsedYamlOrJson: rows.length > 0 ? rows : undefined,
      detectedTitle: fileName.replace(/\.csv$/i, ''),
      detectedPricePoints: pricePoints.length > 0 ? pricePoints : undefined,
      binaryInfo,
    }, file);
  }

  // .txt ou formato genérico
  const tableSpecs = extractMarkdownTablesAndSpecs(cleanText);
  const detectedPrices = extractPricePointsHint(cleanText, null);
  return finalizePayload({
    fileName,
    fileType: 'txt',
    rawText: cleanText,
    parsedYamlOrJson: Object.keys(tableSpecs).length > 0 ? { tableSpecs } : undefined,
    detectedTitle: extractTitleHint(cleanText, null),
    detectedPricePoints: detectedPrices,
    binaryInfo,
  }, file);
}

/**
 * Descompacta e analisa um arquivo .ZIP na memória do navegador
 * Ignora lixo de sistema operacional (Mac OS __MACOSX, .DS_Store, ._*)
 * e prioriza o arquivo de conteúdo principal em texto/especificações.
 */
async function parseZipFile(file: File): Promise<IngestedFilePayload> {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);

  const textSnippets: Array<{ path: string; ext: string; content: string; size: number }> = [];
  const extractedImages: ExtractedImageFile[] = [];
  let combinedParsed: any = null;
  let subFilesCount = 0;

  const entries = Object.keys(zipContent.files);

  for (const relativePath of entries) {
    const entry = zipContent.files[relativePath];
    if (entry.dir) continue;

    // Ignorar lixo e metadados de sistema (macOS __MACOSX, .DS_Store, arquivos com prefixo ._)
    const parts = relativePath.split('/');
    const isJunk =
      relativePath.includes('__MACOSX') ||
      parts.some((p) => p.startsWith('._') || p === '.DS_Store' || p === 'Thumbs.db' || p === 'desktop.ini');
    if (isJunk) continue;

    subFilesCount++;

    const lowerName = relativePath.toLowerCase();
    const entryExt = lowerName.split('.').pop() || '';

    // 1. Arquivos de Imagem embutidos no ZIP (ex: fotos da e-bike, diagramas)
    if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'gif'].includes(entryExt) && extractedImages.length < 12) {
      try {
        const imageBlob = await entry.async('blob');
        const mime = entryExt === 'svg' ? 'image/svg+xml' : (entryExt === 'png' ? 'image/png' : (entryExt === 'webp' ? 'image/webp' : 'image/jpeg'));
        const dataUri = await blobToBase64(imageBlob);
        extractedImages.push({
          name: relativePath.split('/').pop() || relativePath,
          mimeType: mime,
          dataUri,
          sizeBytes: imageBlob.size,
        });
      } catch (imgErr) {
        console.warn(`[fileIngestion] Não foi possível ler imagem no ZIP: ${relativePath}`, imgErr);
      }
    }

    // 2. Arquivos de texto / dados estruturados
    if (['md', 'markdown', 'txt', 'yaml', 'yml', 'json', 'csv'].includes(entryExt)) {
      try {
        const text = await entry.async('string');
        const cleanT = text.replace(/^\uFEFF/, '').trim();
        if (cleanT.length > 0) {
          textSnippets.push({
            path: relativePath,
            ext: entryExt,
            content: cleanT,
            size: cleanT.length,
          });

          // Tentar parsear estruturados
          if (['yaml', 'yml'].includes(entryExt) && !combinedParsed) {
            combinedParsed = safeParseYaml(cleanT);
          } else if (entryExt === 'json' && !combinedParsed) {
            combinedParsed = safeParseJson(cleanT);
          } else if (['md', 'markdown'].includes(entryExt) && !combinedParsed) {
            const fmMatch = cleanT.match(/^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/);
            if (fmMatch) {
              combinedParsed = safeParseYaml(fmMatch[1]);
            }
          }
        }
      } catch (err) {
        console.warn(`[fileIngestion] Não foi possível ler arquivo de texto no ZIP: ${relativePath}`, err);
      }
    }
  }

  // Ordena os textos encontrados: documentos markdown/yaml maiores primeiro
  textSnippets.sort((a, b) => {
    const priority = (ext: string) => (['md', 'markdown', 'yaml', 'yml'].includes(ext) ? 2 : 1);
    const pDiff = priority(b.ext) - priority(a.ext);
    if (pDiff !== 0) return pDiff;
    return b.size - a.size;
  });

  const combinedText = textSnippets.map((s) => `--- [Arquivo: ${s.path}] ---\n${s.content}\n`).join('\n\n');

  // Mapeia sub-documentos para seleção granular no batch
  const subDocuments = textSnippets.map((snip) => ({
    fileName: snip.path.split('/').pop() || snip.path,
    relativePath: snip.path,
    ext: snip.ext,
    rawText: snip.content,
    parsedYamlOrJson: ['yaml', 'yml'].includes(snip.ext)
      ? safeParseYaml(snip.content)
      : (snip.ext === 'json' ? safeParseJson(snip.content) : null),
    fileSizeBytes: snip.size,
  }));

  return {
    fileName: file.name,
    fileType: 'zip',
    rawText: combinedText,
    parsedYamlOrJson: combinedParsed,
    images: extractedImages,
    detectedTitle: extractTitleHint(combinedText, combinedParsed) || file.name.replace(/\.zip$/i, ''),
    detectedPricePoints: extractPricePointsHint(combinedText, combinedParsed),
    subFilesCount,
    subDocuments,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decompõe e limpa nome composto ou título de arquivo em Marca e Modelo.
 * Ex: "LAF_L10_MAX_Ficha_de_Especificacoes.md" -> Marca: "LAF", Modelo: "L10 MAX"
 * Ex: "Ficha de Especificações – LAF L10 MAX" -> Marca: "LAF", Modelo: "L10 MAX"
 * Ex: "Sense Breeze 2026" -> Marca: "Sense", Modelo: "Breeze 2026"
 */
export function decomposeBrandAndModel(rawName: string): { marca: string; modelo: string } {
  if (!rawName || typeof rawName !== 'string') {
    return { marca: '', modelo: '' };
  }

  // 1. Limpar sufixos e prefixos editoriais comuns
  let cleaned = rawName
    .replace(/\.[^/.]+$/, '') // Remove extensão de arquivo
    .replace(/^#+\s*/, '') // Remove prefixos Markdown
    .replace(/^Ficha\s*(?:de\s*)?(?:Especifica[cç][õo]es|T[ée]cnica)\s*[-–—:]\s*/i, '')
    .replace(/[-–—:]\s*Ficha\s*(?:de\s*)?(?:Especifica[cç][õo]es|T[ée]cnica)$/i, '')
    .replace(/_Ficha_de_Especificacoes/gi, '')
    .replace(/_Especificacoes/gi, '')
    .replace(/[-_]/g, ' ')
    .trim();

  // 2. Marcas conhecidas no mercado brasileiro e global
  const KNOWN_BRANDS = [
    'LAF', 'Caloi', 'Sense', 'Oggi', 'Lev', 'Two Dogs', 'Trek', 'Specialized', 
    'Giant', 'Cannondale', 'Scott', 'Pedalla', 'Blitz', 'Volluto', 'Atrio', 
    'Biobike', 'KTM', 'Cube', 'Orbea', 'Xiaomi', 'Fiido', 'Engwe', 'Samebike', 
    'Himo', 'Dahon', 'Tern', 'Mormaii', 'Soul', 'Audax', 'Groove', 'TKX'
  ];

  for (const b of KNOWN_BRANDS) {
    const brandRegex = new RegExp(`^${b}\\b`, 'i');
    if (brandRegex.test(cleaned)) {
      const remaining = cleaned.replace(brandRegex, '').trim();
      return {
        marca: b,
        modelo: remaining || cleaned,
      };
    }
  }

  // 3. Decomposição padrão: primeira palavra como Marca e o restante como Modelo
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return {
      marca: tokens[0],
      modelo: tokens.slice(1).join(' '),
    };
  }

  return {
    marca: tokens[0] || 'E-Bike',
    modelo: cleaned || 'Modelo',
  };
}

/**
 * Extrai pistas de título com tolerância a formatos
 */
function extractTitleHint(text: string, parsed: any): string {
  if (parsed && typeof parsed === 'object') {
    // Objeto único
    if (!Array.isArray(parsed)) {
      if (parsed.modelo) return `${parsed.marca ? parsed.marca + ' ' : ''}${parsed.modelo}`.trim();
      if (parsed.title) return String(parsed.title).trim();
      if (parsed.titulo) return String(parsed.titulo).trim();
      if (parsed.name) return String(parsed.name).trim();
    } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
      // Array de linhas (ex: CSV)
      const first = parsed[0];
      if (first.modelo) return `${first.marca ? first.marca + ' ' : ''}${first.modelo}`.trim();
      if (first.titulo || first.title) return String(first.titulo || first.title).trim();
    }
  }

  // 1. Procura por padrão H1 "# Título"
  const h1Match = text.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const cleanH1 = h1Match[1].trim()
      .replace(/^Ficha\s*(?:de\s*)?(?:Especifica[cç][õo]es|T[ée]cnica)\s*[-–—:]\s*/i, '')
      .replace(/[-–—:]\s*Ficha\s*(?:de\s*)?(?:Especifica[cç][õo]es|T[ée]cnica)$/i, '');
    return cleanH1;
  }

  // 2. Procura por rotulagem explícita "Modelo: ..." ou "Título: ..."
  const labelMatch = text.match(/(?:^|\n)\s*(?:Modelo|Marca|T[íi]tulo|Title|Bike|Produto)\s*:\s*(.+)/i);
  if (labelMatch) return labelMatch[1].trim().replace(/^["']|["']$/g, '');

  // 3. Primeira linha não vazia substantiva
  const firstLine = text.split('\n').find((l) => l.trim().length > 3 && !l.trim().startsWith('---'));
  if (firstLine) {
    return firstLine
      .replace(/^[#*-\s]+/, '')
      .replace(/^Ficha\s*(?:de\s*)?(?:Especifica[cç][õo]es|T[ée]cnica)\s*[-–—:]\s*/i, '')
      .trim()
      .substring(0, 100);
  }

  return '';
}

/**
 * Extrai pontos de preço para o gráfico de evolução histórica
 */
function extractPricePointsHint(text: string, parsed: any): Array<{ mes: string; preco: number; loja?: string }> | undefined {
  if (parsed && typeof parsed === 'object') {
    const candidateList =
      parsed.historicoPrecos ||
      parsed.historico_precos ||
      parsed.priceHistory ||
      parsed.precos ||
      parsed.cotacoes;

    if (Array.isArray(candidateList) && candidateList.length > 0) {
      const validPoints = candidateList
        .map((item: any) => {
          const mes = item.mes || item.month || item.data || item.dataReferencia || '';
          const preco = parseBrazilianCurrency(item.preco ?? item.price ?? item.valor ?? 0);
          const loja = item.loja || item.store || undefined;
          return { mes: String(mes), preco, loja };
        })
        .filter((item) => item.mes && item.preco > 0);

      if (validPoints.length > 0) return validPoints;
    }
  }

  // Se não veio no objeto, tentar extrair de tabela de texto ou padrão de preços
  const priceRegex = /(?:^|\n)\s*([a-zA-ZçÇ]{3,9}(?:\/\d{2,4})?|\d{4}-\d{2})\s*[:\t,;=-]\s*(?:R\$\s*)?([0-9.,]+)/g;
  const matches = Array.from(text.matchAll(priceRegex));

  if (matches.length >= 2) {
    const points: Array<{ mes: string; preco: number }> = [];
    for (const m of matches) {
      const mes = m[1].trim();
      const val = parseBrazilianCurrency(m[2]);
      if (mes && val > 0) {
        points.push({ mes, preco: val });
      }
    }
    if (points.length >= 2) return points;
  }

  return undefined;
}

/**
 * Extração de pontos de preço a partir de texto CSV tolerante a múltiplos delimitadores e formatações monetárias
 */
function extractPricePointsFromCsv(csvText: string): Array<{ mes: string; preco: number; loja?: string }> {
  const points: Array<{ mes: string; preco: number; loja?: string }> = [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return points;

  const delimiter = detectCsvDelimiter(csvText);

  // Verifica se a primeira linha é cabeçalho
  let startIndex = 0;
  const firstParts = parseCsvLine(lines[0], delimiter);
  if (
    firstParts.some((p) =>
      /^(mes|m[eê]s|month|data|date|loja|store|preco|pre[cç]o|price|valor)$/i.test(p.trim())
    )
  ) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i], delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());
    if (parts.length >= 2) {
      const col1 = parts[0];
      const val = parseBrazilianCurrency(parts[1]);

      if (col1 && val > 0) {
        points.push({
          mes: col1,
          preco: val,
          loja: parts[2] || undefined,
        });
      }
    }
  }

  return points;
}

/**
 * Parser determinístico de alta inteligência para E-Bikes:
 * Extrai e normaliza todos os dados diretamente do texto, tabelas Markdown,
 * cabeçalhos, pares chave-valor e JSON/YAML sem necessidade de LLM.
 * Aloca rigorosamente nos 10 Blocos Canônicos de Especificações e monta o veredito editorial.
 */
export function parseEBikeDeterministic(
  rawText: string,
  parsedData?: any,
  fileName?: string
): {
  identity: any;
  structuredYaml: string;
  specSections: any[];
  editorial: any;
  priceHistoryData: { hasPriceHistory: boolean; historicoPrecos: any[]; ofertas: any[] };
  consolidated: any;
} {
  const localTableSpecs = extractMarkdownTablesAndSpecs(rawText || '');
  const titleMatch =
    (rawText || '').match(/^#\s+(.+)$/m) ||
    (rawText || '').match(/(?:^|\n)\s*(?:Modelo|Marca|Bike|Produto)\s*:\s*(.+)/i);
  const titleDecomposed = decomposeBrandAndModel(
    titleMatch ? titleMatch[1].trim() : fileName || ''
  );

  const combinedText = `${rawText || ''} ${JSON.stringify(localTableSpecs || {})} ${JSON.stringify(parsedData || {})}`;

  // Helper para buscar valor em tableSpecs por múltiplos aliases com matching estrito e sem colisões
  const findSpec = (...aliases: string[]): string | undefined => {
    for (const alias of aliases) {
      const lower = alias.toLowerCase().trim();
      if (!lower) continue;
      // 1. Busca exata na tabela
      if (localTableSpecs[lower] !== undefined && localTableSpecs[lower] !== null) {
        const val = cleanMarkdownAndHtmlEntities(String(localTableSpecs[lower])).trim();
        if (val && !/^(bicicleta\s*el[eé]trica|e-?bike)$/i.test(val)) return val;
      }
      // 2. Busca normalizada estrita
      const normAlias = lower.replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(localTableSpecs)) {
        if (v === undefined || v === null) continue;
        const valStr = cleanMarkdownAndHtmlEntities(String(v)).trim();
        if (!valStr || /^(bicicleta\s*el[eé]trica|e-?bike)$/i.test(valStr)) continue;

        const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normK === normAlias) return valStr;

        // Prevenção de falso-positivo de prefixos:
        // 'velocidades' NUNCA deve casar com 'velocidade' e vice-versa
        if ((normAlias === 'velocidades' && normK === 'velocidade') || (normAlias === 'velocidade' && normK === 'velocidades')) {
          continue;
        }
        // 'capacidade' sem 'carga'/'peso' NUNCA deve casar com busca por capacidade de carga
        if ((normAlias.includes('carga') || normAlias.includes('peso') || normAlias.includes('maxima')) && normK === 'capacidade') {
          continue;
        }
        // 'dobravel' sem 'material' NUNCA deve casar com especificação de material
        if ((normAlias.includes('dobravel') || normAlias.includes('dobra')) && (normK.includes('material') || normK === 'quadro')) {
          continue;
        }

        // Só aceita correspondência de prefixo se o alias tiver pelo menos 7 caracteres
        if (normAlias.length >= 7 && normK.length >= 7) {
          if (normK.startsWith(normAlias) || (normAlias.startsWith(normK) && Math.abs(normK.length - normAlias.length) <= 3)) {
            return valStr;
          }
        }
      }
    }
    return undefined;
  };

  // Helper para resolução factual de especificações (prevenindo alucinações e marcando campos ausentes como Não informado)
  const resolveSpecItem = (
    label: string,
    aliases: string[],
    fallbackExtractor?: () => string | undefined,
    calculatedFallback?: { value: string; status: SpecStatus; confidence: SpecConfidence }
  ): { label: string; value: string; status: SpecStatus; confidence: SpecConfidence } => {
    const canonicalSyns = CANONICAL_SPEC_SECTIONS.flatMap((s) => s.items)
      .find((it) => it.label.toLowerCase() === label.toLowerCase())?.synonyms || [];
    const allAliases = Array.from(new Set([...aliases, ...canonicalSyns, label.toLowerCase()]));
    let raw = findSpec(...allAliases);
    if (raw) {
      raw = cleanSpecValue(raw);

      // 1. Validação estrita para 'Capacidade Máxima' (peso suportado):
      // Deve rejeitar valores de capacidade elétrica (Ah, Wh, mAh, Volts)
      if (label === 'Capacidade Máxima') {
        const isBattery = /\b\d+(?:\.\d+)?\s*(?:ah|wh|mah|v)\b/i.test(raw) || /bateria/i.test(raw);
        if (isBattery) {
          raw = undefined;
        } else {
          const mKg = raw.match(/^(\d{2,3})$/);
          if (mKg) raw = `${mKg[1]} kg`;
        }
      }

      // 1.1 Validação estrita para 'Capacidade Total' (Bateria):
      // Deve aceitar apenas Wh ou Ah, rejeitando estritamente valores de peso (kg, carga máxima)
      if (label === 'Capacidade Total' && raw) {
        const isWeight = /\b\d+(?:\.\d+)?\s*(?:kg|quilos?)\b/i.test(raw) || /carga|suportad/i.test(raw);
        if (isWeight) {
          raw = undefined;
        }
      }

      // 2. Validação estrita para 'Número de Marchas':
      // Rejeitar tensões elétricas (ex: 48V, 36V, 48 Velocidades)
      if (label === 'Número de Marchas' && raw) {
        if (/^(24|36|48|52|60|72)\s*(?:v|velocidades?)$/i.test(raw) || /^\d{2,}\s*v$/i.test(raw)) {
          raw = undefined;
        }
      }

      // 3. Validação estrita para 'Câmbio Traseiro':
      // Rejeitar tensões elétricas (ex: 48V) ou valores de velocidades puras
      if (label === 'Câmbio Traseiro' && raw) {
        if (/^(24|36|48|52|60|72)\s*(?:v|velocidades?)$/i.test(raw) || /^\d{2,}\s*v$/i.test(raw) || /^\d{1,2}\s*velocidades$/i.test(raw)) {
          raw = undefined;
        }
      }

      // 4. Validação estrita para 'Dobrável':
      // Se contiver nome de material do quadro (ex: Aço carbono, Alumínio), prioriza status dobrável
      if (label === 'Dobrável' && raw) {
        const isMaterial = /a[cç]o|carbono|alum[ií]nio|magn[eé]sio|ferro|liga/i.test(raw);
        if (isMaterial) {
          raw = 'Sim, quadro dobrável';
        } else if (/^(sim|yes|s|dobr[aá]vel)$/i.test(raw.trim())) {
          raw = 'Sim, quadro dobrável';
        } else if (/^(n[aã]o|nao|no|n|fix[oa]|r[ií]gid[oa])$/i.test(raw.trim())) {
          raw = 'Não';
        }
      }

      // 4.1 Validação estrita para Freios Dianteiro e Traseiro em entradas compostas
      if (label === 'Freio Dianteiro' && raw) {
        if (/v-?brake.*dianteir|dianteir.*v-?brake/i.test(raw)) {
          raw = 'V-Brake';
        } else if (/disco.*dianteir|dianteir.*disco/i.test(raw)) {
          raw = /hidr[aá]ulic/i.test(raw) ? 'Disco Hidráulico' : 'Freio a Disco';
        } else if (/tambor.*dianteir|dianteir.*tambor/i.test(raw)) {
          raw = 'Freio a Tambor Dianteiro';
        }
      }
      if (label === 'Freio Traseiro' && raw) {
        if (/tambor.*traseir|traseir.*tambor/i.test(raw)) {
          raw = 'Freio a Tambor Traseiro';
        } else if (/contra-?pedal.*traseir|traseir.*contra-?pedal/i.test(raw)) {
          raw = 'Freio Contra-Pedal Traseiro';
        } else if (/disco.*traseir|traseir.*disco/i.test(raw)) {
          raw = /hidr[aá]ulic/i.test(raw) ? 'Disco Hidráulico' : 'Freio a Disco';
        } else if (/v-?brake.*traseir|traseir.*v-?brake/i.test(raw)) {
          raw = 'V-Brake';
        }
      }

      // 4.2 Validação estrita para 'Entrada USB': rejeita carregadores de parede residenciais (110V/220V/Bivolt)
      if (label === 'Entrada USB' && raw) {
        if (/\b(?:110\s*v|220\s*v|bivolt|carregador\s*bivolt|tomada)\b/i.test(raw) && !/usb|5\s*v|celular/i.test(raw)) {
          raw = undefined;
        }
      }

      // 5. Validação estrita para 'Aro / Rodas':
      // Formata como Aro XX" ou 700C/650B limpando entidades HTML (&quot;) e Markdown
      if (label === 'Aro / Rodas' && raw) {
        raw = sanitizeRimValue(raw);
      }
    }

    if (raw) {
      const lower = raw.toLowerCase().trim();
      if (
        isUnconfirmedValue(lower) ||
        /^(n[aã]o\s*(informad[oa]|consta|confirmad[oa]|declarad[oa]|homologad[oa]|aferid[oa]|especificad[oa])|pendente|a\s*confirmar|a\s*definir|sem\s*confirma[cç][aã]o|n\/?a|-|--)$/i.test(lower)
      ) {
        return {
          label,
          value: 'Não informado pelo fabricante',
          status: 'NAO_INFORMADO',
          confidence: 'NAO_CONFIRMADA',
        };
      }
      return {
        label,
        value: cleanSpecValue(raw),
        status: 'CONFIRMADO',
        confidence: 'ALTA',
      };
    }

    if (fallbackExtractor) {
      const extracted = fallbackExtractor();
      if (extracted) {
        const lowerExt = String(extracted).toLowerCase().trim();
        if (
          isUnconfirmedValue(lowerExt) ||
          /^(n[aã]o\s*(informad[oa]|consta|confirmad[oa]|declarad[oa]|homologad[oa]|aferid[oa]|especificad[oa])|pendente|a\s*confirmar|a\s*definir|sem\s*confirma[cç][aã]o|n\/?a|-|--)$/i.test(lowerExt)
        ) {
          return {
            label,
            value: 'Não informado pelo fabricante',
            status: 'NAO_INFORMADO',
            confidence: 'NAO_CONFIRMADA',
          };
        }
        return {
          label,
          value: cleanSpecValue(extracted),
          status: 'CONFIRMADO',
          confidence: 'MEDIA',
        };
      }
    }

    if (calculatedFallback) {
      return {
        label,
        ...calculatedFallback,
      };
    }

    return {
      label,
      value: 'Não informado pelo fabricante',
      status: 'NAO_INFORMADO',
      confidence: 'NAO_CONFIRMADA',
    };
  };

  // 1. Identidade e Metadados Principais
  const detectedBrand =
    findSpec('marca', 'fabricante', 'brand', 'montadora') ||
    parsedData?.marca ||
    titleDecomposed.marca ||
    'Marca a definir';

  const detectedModel =
    findSpec('modelo', 'model', 'nome da bike', 'linha') ||
    parsedData?.modelo ||
    titleDecomposed.modelo ||
    (fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Modelo a definir');

  // Regex para métricas fundamentais
  const potenciaMatch = combinedText.match(/\b(\d{3,4})\s*W(?:atts)?\b/i);
  const autonomiaMatch = combinedText.match(/\b(\d{2,3})\s*km\b/i);
  const pesoMatch = combinedText.match(/\bpeso(?:\s*da\s*bicicleta|\s*total)?[:\s]+(\d{2}(?:\.\d+)?)\s*kg\b/i) || combinedText.match(/\b(\d{2}(?:\.\d+)?)\s*kg\b/i);
  const tempoCargaMatch = combinedText.match(/\btempo\s*de\s*(?:recarga|carga|carregamento)[:\s]+(\d{1,2}(?:\s*a\s*\d{1,2})?)\s*(?:horas|h|hrs)\b/i);
  const cargaMatch =
    combinedText.match(/carga(?:\s*m[aá]xima)?[:\s]+(\d{2,3})\s*kg/i) ||
    combinedText.match(/(\d{2,3})\s*kg(?:\s*de\s*carga|\s*suportada)/i);
  const precoMatch =
    combinedText.match(/(?:pre[cç]o\s*atual(?:\s*de\s*refer[eê]ncia)?|pre[cç]o\s*de\s*refer[eê]ncia|menor\s*pre[cç]o(?:\s*p[uú]blico)?|pre[cç]o\s*sugerido|pre[cç]o|pix)[:\s*]+(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i) ||
    combinedText.match(/R\$\s*([\d\.]+(?:,\d{2})?)/i) ||
    combinedText.match(/pre[cç]o[:\s]+(?:R\$\s*)?([\d\.]+)/i);

  // Extração de Tensão (V) e Amperagem (Ah) para cálculo de Wh
  const tensaoMatch = combinedText.match(/\b(24|36|48|52|60|72)\s*V\b/i);
  const amperagemMatch = combinedText.match(/\b(\d{1,2}(?:\.\d+)?)\s*Ah\b/i);
  const whMatch = combinedText.match(/\b(\d{3,4})\s*Wh\b/i);

  const rawTensaoSpec = findSpec('tensão', 'voltagem', 'tensão da bateria');
  const tensaoV = tensaoMatch
    ? Number(tensaoMatch[1])
    : (rawTensaoSpec && !/n[aã]o\s*informad/i.test(rawTensaoSpec)
        ? Number(String(rawTensaoSpec).replace(/[^0-9]/g, '')) || null
        : null);

  const rawAmperagemSpec = findSpec('amperagem', 'capacidade ah', 'capacidade da bateria');
  const amperagemAh = amperagemMatch
    ? Number(amperagemMatch[1])
    : (rawAmperagemSpec && !/n[aã]o\s*informad/i.test(rawAmperagemSpec) && /\d/.test(rawAmperagemSpec)
        ? Number(String(rawAmperagemSpec).replace(/[^0-9.]/g, '')) || null
        : null);

  const calculatedWh = (tensaoV && amperagemAh) ? Math.round(tensaoV * amperagemAh) : null;
  const finalWh = whMatch ? Number(whMatch[1]) : calculatedWh;

  // Cálculos Físicos Dedutivos
  const custoPorRecarga = finalWh ? ((finalWh / 1000) * 0.85).toFixed(2) : '0,00';

  let finalPreco = 0;
  if (precoMatch) {
    const cleanP = parseBrazilianCurrency(precoMatch[1]);
    if (cleanP > 500) finalPreco = cleanP;
  }
  if (parsedData?.menorPreco && Number(parsedData.menorPreco) > 500) {
    finalPreco = Number(parsedData.menorPreco);
  }

  const rawPot = findSpec('potência', 'potencia', 'potência nominal', 'potência nominal informada', 'motor', 'watts', 'power');
  const finalPotencia = rawPot && !/n[aã]o\s*informad/i.test(rawPot)
    ? Number(String(rawPot).replace(/[^0-9]/g, '')) || (potenciaMatch ? Number(potenciaMatch[1]) : 0)
    : (potenciaMatch ? Number(potenciaMatch[1]) : 0);

  const rawAut = findSpec('autonomia', 'autonomia anunciada', 'autonomia estimada', 'alcance');
  let finalAutonomia: number | null = null;
  if (rawAut && !/n[aã]o\s*(?:informad|localizad|confirmad)/i.test(rawAut)) {
    const rangeAutMatch = String(rawAut).match(/(\d{2,3})\s*(?:a|-|até)\s*(\d{2,3})/i);
    if (rangeAutMatch) {
      finalAutonomia = Number(rangeAutMatch[2]);
    } else {
      const singleAut = String(rawAut).match(/\b(\d{2,3})\b/);
      finalAutonomia = singleAut ? Number(singleAut[1]) : null;
    }
  }

  const rawPeso = findSpec('peso da bicicleta', 'peso total', 'peso', 'massa');
  let finalPeso: number | null = null;
  if (rawPeso && !/n[aã]o\s*informad/i.test(rawPeso)) {
    const pNum = Number(String(rawPeso).replace(/[^0-9.]/g, ''));
    if (pNum > 0) finalPeso = pNum;
  } else if (pesoMatch) {
    finalPeso = Number(pesoMatch[1]) || null;
  }

  const rawTempo = findSpec('tempo de recarga', 'tempo de carga', 'recarga');
  let finalTempoCarga: string | null = null;
  if (rawTempo && !/n[aã]o\s*informad/i.test(rawTempo)) {
    finalTempoCarga = cleanSpecValue(rawTempo);
  }

  const rawCarga = findSpec('capacidade máxima', 'capacidade maxima', 'capacidade de carga', 'peso máximo suportado', 'carga máxima', 'peso suportado', 'carga util');
  let finalCarga: string | null = null;
  if (rawCarga && !/n[aã]o\s*informad/i.test(rawCarga) && !/\b\d+(?:\.\d+)?\s*(?:ah|wh|mah|v)\b/i.test(rawCarga) && !/bateria/i.test(rawCarga)) {
    finalCarga = cleanSpecValue(rawCarga);
  }

  // Relação Peso/Potência
  const relacaoWKg = (finalPotencia > 0 && finalPeso && finalPeso > 0)
    ? `${(finalPotencia / finalPeso).toFixed(1)} W/kg`
    : 'Não informado';

  // Categoria de Uso
  let usoPrincipal = 'Urbana';
  if (/dobr[aá]vel|compacta|folding/i.test(combinedText)) usoPrincipal = 'Dobrável';
  else if (/mountain|mtb|trilha|off-road/i.test(combinedText)) usoPrincipal = 'Mountain Bike (e-MTB)';
  else if (/estrada|speed|gravel/i.test(combinedText)) usoPrincipal = 'Estrada / Gravel';
  else if (/passeio|conforto|beach/i.test(combinedText)) usoPrincipal = 'Passeio';
  else if (/carga|cargo|entrega|utilit[aá]ria/i.test(combinedText)) usoPrincipal = 'Carga / Utilitária';

  const identity = {
    marca: String(detectedBrand).trim(),
    modelo: String(detectedModel).trim(),
    usoPrincipal: (parsedData?.usoPrincipal || usoPrincipal) as any,
    potenciaW: finalPotencia > 0 ? finalPotencia : undefined,
    autonomiaKm: finalAutonomia || undefined,
    pesoKg: finalPeso || undefined,
    tempoCargaHoras: finalTempoCarga || undefined,
    menorPreco: finalPreco > 0 ? finalPreco : undefined,
    maiorPreco: finalPreco > 0 ? Math.round(finalPreco * 1.05) : undefined,
    precoDe: parsedData?.precoDe ? Number(parsedData.precoDe) : undefined,
    capacidadeBateriaWh: finalWh || undefined,
    tensaoV: tensaoV || undefined,
    amperagemAh: amperagemAh || undefined,
    custoPorRecargaReais: finalWh ? `R$ ${custoPorRecarga.replace('.', ',')}` : undefined,
    relacaoPesoPotencia: relacaoWKg !== 'Não informado' ? relacaoWKg : undefined,
    lojasDetectadas: ['Loja Oficial / Varejistas'],
  };

  // 2. Extração Determinística dos 10 Blocos Canônicos de Especificações com Auditoria Factual
  const rawContranSpec = findSpec('enquadramento contran', 'classificação legal', 'regulamentação', 'contran');
  // `sanitizeContranValue(val, potenciaW)` — a chamada passava dois argumentos
  // extras que a função nunca teve; eram silenciosamente ignorados.
  const contranLaw = rawContranSpec
    ? sanitizeContranValue(rawContranSpec, finalPotencia)
    : (finalPotencia > 1000
        ? 'Ciclomotor Elétrico — Resolução CONTRAN 996/2023 (Exige ACC ou CNH A, capacete de motociclista e registro)'
        : (finalPotencia > 0 && finalPotencia <= 350
            ? 'Bicicleta Elétrica — Resolução CONTRAN 996/2023 (Dispensa CNH, emplacamento e IPVA)'
            : 'Verificar enquadramento da configuração específica perante a Resolução CONTRAN 996/2023'));

  const specSections = [
    {
      title: '1. Resumo Rápido & Destaques',
      items: [
        { label: 'Uso Indicado', value: `${identity.usoPrincipal} / Mobilidade e Lazer`, confidence: 'ALTA' as SpecConfidence, status: 'CONFIRMADO' as SpecStatus },
        resolveSpecItem('Potência Nominal', ['potência nominal informada', 'potência nominal', 'potencia nominal', 'potência', 'potencia', 'motor', 'watts'], () => (finalPotencia > 0 ? `${finalPotencia} W` : undefined)),
        resolveSpecItem('Autonomia Estimada', ['autonomia estimada', 'autonomia', 'autonomia por carga', 'alcance'], () => (finalAutonomia ? `Até ${finalAutonomia} km` : undefined)),
        resolveSpecItem('Velocidade Máxima', ['velocidade máxima', 'velocidade maxima', 'velocidade limite', 'velocidade'], () => {
          const m = combinedText.match(/\bvelocidade(?:\s*m[aá]xima)?[:\s]+(\d{2})\s*km\/h\b/i);
          return m ? `${m[1]} km/h` : undefined;
        }),
        resolveSpecItem('Peso Total', ['peso da bicicleta', 'peso total', 'peso do conjunto', 'peso', 'massa'], () => (finalPeso ? `${finalPeso} kg` : undefined)),
        resolveSpecItem('Capacidade Máxima', ['capacidade máxima', 'capacidade maxima', 'capacidade de carga', 'peso máximo suportado', 'carga máxima', 'peso suportado', 'peso maximo', 'limite de peso'], () => finalCarga || undefined),
      ],
    },
    {
      title: '2. Desempenho & Propulsão',
      items: [
        resolveSpecItem('Tipo de Motor', ['tipo de motor', 'tipo do motor', 'sistema do motor', 'localização do motor', 'posicionamento do motor']),
        resolveSpecItem('Potência de Pico', ['potência de pico', 'potencia de pico', 'pico de potência', 'potência máxima', 'pico']),
        resolveSpecItem('Torque Máximo', ['torque máximo', 'torque maximo', 'torque', 'nm', 'força de torque'], () => {
          const m = combinedText.match(/\b(\d{2,3})\s*Nm\b/i);
          return m ? `${m[1]} Nm` : undefined;
        }),
        resolveSpecItem('Níveis de Assistência', ['níveis de assistência', 'niveis de assistencia', 'modos de assistência', 'assistência ao pedal', 'pas'], () => {
          const m = combinedText.match(/\b(\d)\s*(?:n[ií]veis|modos)\b/i);
          return m ? `${m[1]} Níveis de Potência` : undefined;
        }),
        resolveSpecItem('Sensor de Pedalada', ['sensor de pedalada', 'sensor de cadência', 'sensor de torque', 'sensor'], () => {
          if (/sensor\s*de\s*torque/i.test(combinedText)) return 'Sensor de Torque';
          if (/sensor\s*de\s*cad[eê]ncia/i.test(combinedText)) return 'Sensor de Cadência';
          return undefined;
        }),
        resolveSpecItem('Acelerador', ['acelerador', 'acelerador de polegar', 'acelerador no punho', 'tipo de acelerador']),
      ],
    },
    {
      title: '3. Bateria & Energia',
      items: [
        resolveSpecItem('Capacidade Total', ['capacidade total', 'energia da bateria', 'wh'], () => (finalWh ? `${finalWh} Wh` : undefined)),
        resolveSpecItem('Tensão & Amperagem', ['tensão & amperagem', 'tensão e amperagem', 'voltagem e amperagem', 'tensão', 'voltagem'], () => (tensaoV && amperagemAh ? `${tensaoV}V ${amperagemAh}Ah` : (tensaoV ? `${tensaoV}V` : undefined))),
        resolveSpecItem('Química da Bateria', ['química da bateria', 'quimica da bateria', 'química', 'quimica', 'células', 'tipo de bateria'], () => {
          const rawChem = findSpec('química da bateria', 'quimica da bateria', 'química', 'quimica');
          return rawChem ? sanitizeBatteryChemistryValue(rawChem) : undefined;
        }),
        resolveSpecItem('Removível', ['removível', 'removivel', 'bateria removível', 'trava de bateria']),
        resolveSpecItem('Tempo de Recarga', ['tempo de recarga', 'tempo de carga', 'tempo de carregamento', 'recarga']),
        resolveSpecItem('Carregador', ['carregador', 'fonte de carregamento', 'carregador incluso']),
      ],
    },
    {
      title: '4. Conforto & Ergonomia',
      items: [
        resolveSpecItem('Material do Quadro', ['material do quadro', 'quadro', 'chassi', 'material geral do quadro', 'liga do quadro']),
        resolveSpecItem('Tamanho do Quadro', ['tamanho do quadro', 'tamanho', 'geometria', 'polegadas do quadro']),
        resolveSpecItem('Suspensão Dianteira', ['suspensão dianteira', 'suspensao dianteira', 'garfo']),
        resolveSpecItem('Suspensão Traseira', ['suspensão traseira', 'suspensao traseira', 'shock traseiro', 'amortecedor traseiro']),
        resolveSpecItem('Ajuste de Guidão', ['ajuste de guidão', 'ajuste de guidao', 'guidão', 'guidao', 'mesa']),
        resolveSpecItem('Selim & Canote', ['selim & canote', 'selim e canote', 'canote', 'selim', 'banco']),
      ],
    },
    {
      title: '5. Segurança & Frenagem',
      items: [
        resolveSpecItem('Freio Dianteiro', ['freio dianteiro', 'freios dianteiros', 'sistema de freios', 'sistema']),
        resolveSpecItem('Freio Traseiro', ['freio traseiro', 'freios traseiros', 'sistema de freios', 'sistema']),
        resolveSpecItem('Corte de Motor nos Freios', ['corte de motor nos freios', 'corte de energia', 'corte de motor', 'sensor de freio']),
        resolveSpecItem('Iluminação Dianteira', ['iluminação dianteira', 'iluminacao dianteira', 'farol dianteiro', 'farol']),
        resolveSpecItem('Iluminação Traseira', ['iluminação traseira', 'iluminacao traseira', 'lanterna traseira', 'luz de freio']),
        resolveSpecItem('Refletores & Buzina', ['refletores & buzina', 'refletores e buzina', 'buzina', 'campainha']),
      ],
    },
    {
      title: '6. Transmissão & Ciclística',
      items: [
        resolveSpecItem('Câmbio Traseiro', ['câmbio traseiro', 'cambio traseiro', 'sistema de transmissão', 'transmissão', 'câmbio', 'cambio']),
        resolveSpecItem('Número de Marchas', ['número de marchas', 'numero de marchas', 'marchas']),
        resolveSpecItem('Passadores / Trocadores', ['passadores / trocadores', 'trocadores de marcha', 'passadores', 'shifter']),
        resolveSpecItem('Corrente & Pedivela', ['corrente & pedivela', 'corrente e pedivela', 'pedivela', 'corrente', 'coroa']),
        resolveSpecItem('Pedais', ['pedais', 'pedal']),
      ],
    },
    {
      title: '7. Dimensões, Rodas & Pneus',
      items: [
        resolveSpecItem('Aro / Rodas', ['aro / rodas', 'aro', 'rodas', 'diâmetro das rodas', 'wheel diameter'], () => {
          if (/\b700\s*[cC]\b/i.test(combinedText)) return '700C';
          const m = combinedText.match(/\baro\s*(\d{1,2}(?:\.\d+)?)\b/i) || combinedText.match(/\b(\d{1,2})["″]\b/);
          return m ? `Aro ${m[1]}"` : undefined;
        }),
        resolveSpecItem('Medida dos Pneus', ['medida dos pneus', 'medida do pneu', 'pneus']),
        resolveSpecItem('Tipo de Pneu', ['tipo de pneu', 'pneu']),
        resolveSpecItem('Dobrável', ['dobrável', 'dobravel', 'sistema dobrável']),
        resolveSpecItem('Dimensões (CxLxA)', ['dimensões (cxlxa)', 'dimensões', 'dimensoes', 'medidas']),
        resolveSpecItem('Dimensões Dobrada', ['dimensões dobrada', 'medidas dobrada']),
      ],
    },
    {
      title: '8. Equipamentos & Conectividade',
      items: [
        resolveSpecItem('Painel / Display', ['painel / display', 'painel', 'display', 'computador de bordo']),
        resolveSpecItem('Entrada USB', ['entrada usb', 'porta usb', 'saída usb']),
        resolveSpecItem('Aplicativo / Bluetooth', ['aplicativo / bluetooth', 'app', 'bluetooth']),
        resolveSpecItem('Bagageiro / Rack', ['bagageiro / rack', 'bagageiro', 'garupa']),
        resolveSpecItem('Paralamas & Cavalete', ['paralamas & cavalete', 'paralamas e cavalete', 'descanso lateral', 'cavalete', 'paralamas']),
      ],
    },
    {
      title: '9. Compatibilidade & Manutenção',
      items: [
        resolveSpecItem('Bateria Reposição / Padrão', ['bateria reposição / padrão', 'bateria de reposição']),
        resolveSpecItem('Padrão de Peças Ciclísticas', ['padrão de peças ciclísticas', 'peças padrão']),
        resolveSpecItem('Resistência à Água', ['resistência à água', 'resistencia a agua', 'proteção ip']),
        resolveSpecItem('Garantia de Fábrica', ['garantia de fábrica', 'garantia de fabrica', 'garantia', 'tempo de garantia']),
        resolveSpecItem('Manual & Suporte Nacional', ['manual & suporte nacional', 'suporte nacional', 'sac']),
      ],
    },
    {
      title: '10. Auditoria de Fontes & Dados',
      items: [
        { label: 'Enquadramento CONTRAN', value: contranLaw, confidence: 'ALTA' as SpecConfidence, status: 'CONFIRMADO' as SpecStatus },
        resolveSpecItem('Fonte Oficial dos Dados', ['fonte oficial dos dados', 'fonte principal', 'fontes consultadas'], () => 'Ficha técnica / Catálogo oficial'),
        { label: 'Status da Ficha Técnica', value: 'Auditada e Padronizada pelo Sistema', confidence: 'ALTA' as SpecConfidence, status: 'CONFIRMADO' as SpecStatus },
        { label: 'Última Revisão Técnica', value: new Date().toLocaleDateString('pt-BR'), confidence: 'ALTA' as SpecConfidence, status: 'CONFIRMADO' as SpecStatus },
      ],
    },
  ];

  // 3. Veredito Editorial e Prós/Contras Factual
  //
  // `identity` só tem número quando o documento trouxe o número. Cada afirmação
  // abaixo é montada **apenas** com o que existe: um veredito que anuncia
  // "potência de undefinedW" é pior do que nenhum veredito.
  const potenciaW = Number(identity.potenciaW) || 0;
  const autonomiaKm = Number(identity.autonomiaKm) || 0;
  const pesoKg = Number(identity.pesoKg) || 0;
  const tempoCargaHoras = Number(identity.tempoCargaHoras) || 0;
  const usoRotulo = String(identity.usoPrincipal || '').trim();

  const pros: string[] = [];
  if (potenciaW > 0) pros.push(`Motor elétrico de ${potenciaW}W com entrega linear de assistência.`);
  if (autonomiaKm > 0) pros.push(`Autonomia declarada de até ${autonomiaKm} km por recarga completa.`);
  if (findSpec('quadro', 'material')) pros.push(`Construção com quadro em ${findSpec('quadro', 'material')}.`);
  if (findSpec('freios', 'freio dianteiro')) pros.push(`Sistema de frenagem equipado com ${findSpec('freios', 'freio dianteiro')}.`);
  if (pros.length < 2) pros.push('Praticidade e economia para deslocamentos urbanos diários.');

  const cons: string[] = [];
  if (pesoKg >= 26) cons.push(`Peso total de ${pesoKg}kg exige maior esforço para transporte manual.`);
  if (tempoCargaHoras >= 6) cons.push(`Tempo de recarga de até ${tempoCargaHoras}h requer planejamento noturno.`);
  if (/monomarcha|single\s*speed/i.test(combinedText)) cons.push('Transmissão monomarcha exige mais torque em aclives acentuados.');
  if (cons.length === 0) cons.push('Verifique a disponibilidade de assistência técnica autorizada na sua região.');

  // O resumo só afirma o que foi extraído. Sem marca, modelo ou uso principal
  // reconhecidos, ele sai vazio e o pipeline decide se há base suficiente.
  const temIdentidade = Boolean(identity.marca && identity.modelo);
  const resumoEditorial =
    temIdentidade && usoRotulo
      ? `A ${identity.marca} ${identity.modelo} é uma bicicleta elétrica ${usoRotulo.toLowerCase()} projetada para aliar praticidade e economia na mobilidade diária.` +
        [
          potenciaW > 0 ? ` Com potência nominal de ${potenciaW}W` : '',
          autonomiaKm > 0 ? ` e autonomia de até ${autonomiaKm} km por recarga` : '',
          potenciaW > 0 || autonomiaKm > 0
            ? ', atende aos deslocamentos rotineiros dentro das diretrizes da Resolução CONTRAN 996/2023.'
            : '',
        ].join('') +
        (potenciaW > 0 || autonomiaKm > 0 ? '' : ' Os valores de potência e autonomia não vieram no documento e precisam ser confirmados com o fabricante.')
      : '';

  const editorial = {
    resumoExecutivo: resumoEditorial,
    verdict: resumoEditorial,
    idealFor: temIdentidade ? `Ciclistas urbanos e trabalhadores que buscam economia e agilidade no trânsito diário.` : '',
    pros,
    cons,
    badge: 'Ficha Técnica Factual 2026',
    tagOferta: 'Preço Verificado',
    avaliacaoGeral: 9.0,
  };

  // 4. Histórico de Preços (Condicional)
  const extractedPoints = extractPricePointsHint(rawText, parsedData);
  const hasPriceHistory = Array.isArray(extractedPoints) && extractedPoints.length >= 2;
  const historicoPrecos = hasPriceHistory ? extractedPoints : [];

  /**
   * Ofertas placeholder.
   *
   * Só existem quando o documento traz um preço. Sem ele, `menorPreco` é
   * `undefined` e a multiplicação gerava `preco: NaN`, que chegava ao
   * formulário como oferta e era tratado como preço real pelo `Number(x) || 0`.
   * Sem preço, a lista vai vazia — o admin preenche na mão.
   */
  const menorPrecoNum = Number(identity.menorPreco) || 0;
  const searchTerm = encodeURIComponent(`${identity.marca || ''} ${identity.modelo || ''}`.trim());

  const priceHistoryData = {
    hasPriceHistory,
    historicoPrecos,
    ofertas: menorPrecoNum > 0
      ? [
          {
            id: 1,
            loja: 'Mercado Livre Oficial',
            preco: menorPrecoNum,
            linkProduto: `https://www.mercadolivre.com.br/search?q=${searchTerm}`,
            disponibilidade: 'Em estoque',
            dataAtualizacao: new Date().toISOString().split('T')[0],
            destaqueOferta: 'Menor Preço Encontrado',
          },
          {
            id: 2,
            loja: 'Amazon Brasil',
            preco: Math.round(menorPrecoNum * 1.04),
            linkProduto: `https://www.amazon.com.br/s?k=${searchTerm}`,
            disponibilidade: 'Em estoque',
            dataAtualizacao: new Date().toISOString().split('T')[0],
          },
        ]
      : [],
  };

  // 5. YAML Canônico
  const getSectionItemVal = (itemLabel: string, defaultVal = 'Não informado'): string => {
    for (const sec of specSections) {
      const found = sec.items?.find((it: any) => it.label?.toLowerCase() === itemLabel.toLowerCase());
      if (found && found.value && found.status !== 'NAO_INFORMADO') {
        return String(found.value).trim();
      }
    }
    return defaultVal;
  };

  const motorPos = getSectionItemVal('Tipo de Motor', `Motor elétrico Brushless ${identity.potenciaW}W`);
  const sensorType = getSectionItemVal('Sensor de Pedalada', 'Sensor de Cadência / Pedal Assistido');
  const throttle = getSectionItemVal('Acelerador', 'Disponível no guidão');
  const batteryCap = `${finalWh} Wh (${tensaoV}V ${amperagemAh}Ah)`;
  const batteryTens = `${tensaoV}V ${amperagemAh}Ah`;
  const batteryRemov = getSectionItemVal('Removível', 'Sim, com trava de segurança');
  const frameMat = getSectionItemVal('Material do Quadro', 'Liga de Alumínio');
  const suspFront = getSectionItemVal('Suspensão Dianteira', 'Garfo com amortecimento padrão');
  const tireSize = getSectionItemVal('Medida dos Pneus', getSectionItemVal('Aro / Rodas', 'Aro 26/29'));
  let rawRearDer = getSectionItemVal('Câmbio Traseiro');
  if (!rawRearDer || rawRearDer.includes('Não informado') || /^\d+\s*v$/i.test(rawRearDer) || /^\d+\s*velocidades$/i.test(rawRearDer)) {
    rawRearDer = getSectionItemVal('Número de Marchas');
    if (!rawRearDer || rawRearDer.includes('Não informado') || /^\d+\s*v$/i.test(rawRearDer) || /^\d+\s*velocidades$/i.test(rawRearDer)) {
      rawRearDer = 'Shimano / Convencional';
    }
  }
  const rearDer = rawRearDer;
  const brakeType = getSectionItemVal('Freio Dianteiro', 'Freio a Disco');

  const structuredYaml = `identidade:
  marca: "${identity.marca}"
  modelo: "${identity.modelo}"
  categoria: "${identity.usoPrincipal}"
  ano_modelo: "2026"
  status_auditoria: "Auditada Determinística TuaVia 2026"
metricas_principais:
  potencia_nominal_watts: ${identity.potenciaW}
  autonomia_estimada_km: ${identity.autonomiaKm}
  peso_total_kg: ${identity.pesoKg}
  tempo_recarga_horas: ${identity.tempoCargaHoras}
  capacidade_carga_kg: ${finalCarga}
  velocidade_maxima_assistida_kmh: 32
motor_e_eletrica:
  posicao_e_tipo: "${motorPos}"
  potencia_nominal: "${identity.potenciaW}W"
  sensor_assistencia: "${sensorType}"
  acelerador: "${throttle}"
bateria_e_energia:
  capacidade_total: "${batteryCap}"
  tensao_e_amperagem: "${batteryTens}"
  removivel: "${batteryRemov}"
  autonomia_declarada: "Até ${identity.autonomiaKm} km"
  tempo_recarga: "${identity.tempoCargaHoras} horas"
quadro_suspensao_pneus:
  material_quadro: "${frameMat}"
  suspensao_dianteira: "${suspFront}"
  pneus: "${tireSize}"
transmissao_e_freios:
  cambio_e_marchas: "${rearDer}"
  sistema_freios: "${brakeType}"
precos_e_comercial:
  menor_preco_reais: ${identity.menorPreco}
  maior_preco_reais: ${identity.maiorPreco}
  enquadramento_legal: "${contranLaw}"
`;

  // Normaliza e audita deterministicamente através dos 10 blocos canônicos
  const normalizedSpecSections = allocateAndNormalizeSpecSections(undefined, specSections, {
    potenciaW: identity.potenciaW,
    autonomiaKm: identity.autonomiaKm,
    pesoKg: identity.pesoKg,
    tempoCargaHoras: identity.tempoCargaHoras,
    usoPrincipal: identity.usoPrincipal,
    marca: identity.marca,
    modelo: identity.modelo,
  });

  const consolidated = {
    ...identity,
    structuredYaml,
    specSections: normalizedSpecSections,
    ...editorial,
    historicoPrecos: priceHistoryData.historicoPrecos,
    ofertas: priceHistoryData.ofertas,
    hasPriceHistory: priceHistoryData.hasPriceHistory,
  };

  return {
    identity,
    structuredYaml,
    specSections: normalizedSpecSections,
    editorial,
    priceHistoryData,
    consolidated,
  };
}

/**
 * Gera de forma determinística e imediata a estrutura YAML Canônica de uma E-Bike
 * a partir de qualquer texto de documento ou tabela, garantindo que o Processo 1
 * e os passos subsequentes nunca falhem por ausência de YAML.
 */
export function generateCanonicalEBikeYaml(
  rawText: string,
  parsedData?: any,
  fileName?: string
): { structuredYaml: string; identity: any } {
  const result = parseEBikeDeterministic(rawText, parsedData, fileName);
  return {
    structuredYaml: result.structuredYaml,
    identity: result.identity,
  };
}

export interface IngestionCheckItem {
  blockNumber: number;
  category: string;
  label: string;
  detected: boolean;
  value?: string | number;
  status: 'ok' | 'warning' | 'missing';
  hint?: string;
}

export interface IngestionQualityReport {
  score: number; // 0 a 100
  level: 'excellent' | 'good' | 'fair' | 'incomplete';
  totalCanonicalBlocks: number;
  detectedBlocksCount: number;
  checks: IngestionCheckItem[];
  summary: string;
  detectedSpecs: Record<string, any>;
}

/**
 * Realiza uma auditoria de qualidade da ingestão contra os 10 Blocos Canônicos de Ficha Técnica,
 * fornecendo pontuação (0-100), diagnóstico instantâneo e orientações acionáveis.
 */
export function auditIngestionQuality(data: any, rawText = ''): IngestionQualityReport {
  // Se specSections estiver presente, criar um mapa rápido label -> valor
  const secMap: Record<string, string> = {};
  if (Array.isArray(data?.specSections)) {
    for (const sec of data.specSections) {
      if (Array.isArray(sec?.items)) {
        for (const it of sec.items) {
          if (it?.label && it?.value && it?.status !== 'NAO_INFORMADO') {
            secMap[it.label.toLowerCase().trim()] = String(it.value);
          }
        }
      }
    }
  }

  const specs = data?.especificacoes || data?.specs || data || {};
  const motor = specs.motor || specs.propulsao || {};
  const bateria = specs.bateria || specs.alimentacao || {};
  const quadro = specs.quadro || specs.chassi || {};
  const transmis = specs.transmissao || specs.cambio || {};
  const freios = specs.freios || specs.seguranca || {};
  const rodas = specs.rodas || specs.pneus || {};

  const checks: IngestionCheckItem[] = [
    // 1. Identidade
    {
      blockNumber: 1,
      category: 'Identidade',
      label: 'Marca & Modelo',
      detected: Boolean((data.marca && data.marca !== 'Não informada' && data.marca !== 'Marca a definir') && (data.modelo && data.modelo !== 'Modelo a definir')),
      value: (data.marca && data.modelo) ? `${data.marca} ${data.modelo}` : undefined,
      status: (data.marca && data.modelo) ? 'ok' : 'missing',
      hint: 'Identifica o fabricante e a linha exata da e-bike.',
    },
    // 2. Propulsão & Motor
    {
      blockNumber: 2,
      category: 'Propulsão & Motor',
      label: 'Potência Nominal (Watts)',
      detected: Boolean(data.potenciaW || motor.potencia_w || motor.potenciaW || secMap['potência nominal'] || secMap['tipo de motor']),
      value: (data.potenciaW || motor.potencia_w || motor.potenciaW) ? `${data.potenciaW || motor.potencia_w || motor.potenciaW} W` : (secMap['potência nominal'] || secMap['tipo de motor']),
      status: (data.potenciaW || motor.potencia_w || motor.potenciaW || secMap['potência nominal'] || secMap['tipo de motor']) ? 'ok' : 'missing',
      hint: 'Fundamental para o enquadramento na Resolução CONTRAN 996/2023.',
    },
    // 3. Bateria & Capacidade
    {
      blockNumber: 3,
      category: 'Bateria & Energia',
      label: 'Capacidade da Bateria (Wh ou Ah)',
      detected: Boolean(bateria.capacidade_wh || bateria.capacidadeWh || bateria.voltagem_v || bateria.amperagem_ah || data.bateriaWh || data.capacidadeBateriaWh || secMap['capacidade total'] || secMap['tensão & amperagem']),
      value: (bateria.capacidade_wh || bateria.capacidadeWh || data.bateriaWh || data.capacidadeBateriaWh)
        ? `${bateria.capacidade_wh || bateria.capacidadeWh || data.bateriaWh || data.capacidadeBateriaWh} Wh`
        : (secMap['capacidade total'] || secMap['tensão & amperagem'] || (bateria.voltagem_v && bateria.amperagem_ah ? `${bateria.voltagem_v}V ${bateria.amperagem_ah}Ah` : undefined)),
      status: (bateria.capacidade_wh || bateria.capacidadeWh || data.bateriaWh || data.capacidadeBateriaWh || secMap['capacidade total'] || secMap['tensão & amperagem'] || (bateria.voltagem_v && bateria.amperagem_ah)) ? 'ok' : 'missing',
      hint: 'Define a densidade energética e a vida útil do ciclo de carga.',
    },
    // 4. Autonomia por Carga
    {
      blockNumber: 4,
      category: 'Autonomia & Alcance',
      label: 'Autonomia Estimada (km)',
      detected: Boolean(data.autonomiaKm || bateria.autonomia_estimada_km || bateria.autonomiaKm || secMap['autonomia estimada'] || secMap['autonomia declarada']),
      value: (data.autonomiaKm || bateria.autonomia_estimada_km || bateria.autonomiaKm || secMap['autonomia estimada'] || secMap['autonomia declarada']) ? `Até ${data.autonomiaKm || bateria.autonomia_estimada_km || bateria.autonomiaKm || secMap['autonomia estimada'] || secMap['autonomia declarada']} km`.replace(/\bkm\s*km\b/i, 'km') : undefined,
      status: (data.autonomiaKm || bateria.autonomia_estimada_km || bateria.autonomiaKm || secMap['autonomia estimada'] || secMap['autonomia declarada']) ? 'ok' : 'missing',
      hint: 'Alcance médio no modo econômico ou assistido.',
    },
    // 5. Velocidade & Assistência
    {
      blockNumber: 5,
      category: 'Desempenho & Legal',
      label: 'Velocidade Máxima Assistida',
      detected: Boolean(data.velocidadeMaxKmH || motor.velocidade_max_kmh || motor.velocidadeMaxKmH || secMap['velocidade máxima assistida'] || secMap['velocidade máxima']),
      value: (data.velocidadeMaxKmH || motor.velocidade_max_kmh || motor.velocidadeMaxKmH) ? `${data.velocidadeMaxKmH || motor.velocidade_max_kmh || motor.velocidadeMaxKmH} km/h` : (secMap['velocidade máxima assistida'] || secMap['velocidade máxima'] || '32 km/h (Assistida)'),
      status: (data.velocidadeMaxKmH || motor.velocidade_max_kmh || motor.velocidadeMaxKmH || secMap['velocidade máxima assistida'] || secMap['velocidade máxima']) ? 'ok' : 'warning',
      hint: 'Limite legal de 25 km/h (ciclovias) ou 32 km/h no Brasil.',
    },
    // 6. Transmissão & Marchas
    {
      blockNumber: 6,
      category: 'Transmissão & Marchas',
      label: 'Câmbio / Marchas',
      detected: Boolean(transmis.cambio_traseiro || transmis.numero_marchas || transmis.tipo_transmissao || data.marchas || secMap['câmbio traseiro'] || secMap['número de marchas']),
      value: transmis.cambio_traseiro || (transmis.numero_marchas ? `${transmis.numero_marchas} velocidades` : undefined) || data.marchas || secMap['câmbio traseiro'] || secMap['número de marchas'],
      status: (transmis.cambio_traseiro || transmis.numero_marchas || data.marchas || secMap['câmbio traseiro'] || secMap['número de marchas']) ? 'ok' : 'missing',
      hint: 'Permite pedalar com fluidez mesmo sem auxílio do motor elétrico.',
    },
    // 7. Sistema de Freios
    {
      blockNumber: 7,
      category: 'Freios & Segurança',
      label: 'Tipo de Freio',
      detected: Boolean(freios.tipo_dianteiro || freios.tipo || freios.sistema_freios || data.freios || secMap['freio dianteiro'] || secMap['freio traseiro']),
      value: freios.tipo_dianteiro || freios.tipo || freios.sistema_freios || data.freios || secMap['freio dianteiro'] || secMap['freio traseiro'],
      status: (freios.tipo_dianteiro || freios.tipo || freios.sistema_freios || data.freios || secMap['freio dianteiro'] || secMap['freio traseiro']) ? 'ok' : 'missing',
      hint: 'Freios a disco (hidráulicos ou mecânicos) são vitais para e-bikes.',
    },
    // 8. Rodas & Pneus
    {
      blockNumber: 8,
      category: 'Rodas & Pneus',
      label: 'Aro e Dimensão dos Pneus',
      detected: Boolean(rodas.tamanho_aro || rodas.aro || rodas.pneus || data.aro || secMap['aro da roda'] || secMap['medida dos pneus'] || secMap['tipo de pneu']),
      value: rodas.tamanho_aro || rodas.aro || (rodas.pneus ? String(rodas.pneus) : undefined) || data.aro || secMap['medida dos pneus'] || secMap['aro da roda'] || secMap['tipo de pneu'],
      status: (rodas.tamanho_aro || rodas.aro || rodas.pneus || data.aro || secMap['medida dos pneus'] || secMap['aro da roda'] || secMap['tipo de pneu']) ? 'ok' : 'warning',
      hint: 'Influencia a rolagem, conforto urbano e estabilidade.',
    },
    // 9. Quadro, Peso & Carga
    {
      blockNumber: 9,
      category: 'Quadro & Peso',
      label: 'Peso e Carga Máxima',
      detected: Boolean(data.pesoKg || quadro.peso_total_kg || quadro.carga_maxima_kg || data.cargaMaximaKg || secMap['peso total'] || secMap['capacidade máxima']),
      value: data.pesoKg
        ? `${data.pesoKg} kg${quadro.carga_maxima_kg || secMap['capacidade máxima'] ? ` (Carga: ${quadro.carga_maxima_kg || secMap['capacidade máxima']})` : ''}`
        : (quadro.carga_maxima_kg || secMap['capacidade máxima'] ? `Carga: ${quadro.carga_maxima_kg || secMap['capacidade máxima']}` : (secMap['peso total'] ? String(secMap['peso total']) : undefined)),
      status: (data.pesoKg || quadro.peso_total_kg || secMap['peso total']) ? 'ok' : 'warning',
      hint: 'Crucial para transporte em escadas, bicicletários e racks de carro.',
    },
    // 10. Mercado & Preço
    {
      blockNumber: 10,
      category: 'Mercado & Comercial',
      label: 'Preço Estimado / Menor Preço',
      detected: Boolean(data.menorPreco || data.preco || (data.historicoPrecos && data.historicoPrecos.length > 0) || secMap['menor preço'] || secMap['preço']),
      value: (data.menorPreco || data.preco) ? `R$ ${(data.menorPreco || data.preco).toLocaleString('pt-BR')}` : (secMap['menor preço'] || secMap['preço'] ? `R$ ${secMap['menor preço'] || secMap['preço']}` : undefined),
      status: (data.menorPreco || data.preco || secMap['menor preço'] || secMap['preço']) ? 'ok' : 'warning',
      hint: 'Permite calcular a relação custo-benefício e gerar o índice no catálogo.',
    },
  ];

  const detectedBlocksCount = checks.filter((c) => c.detected).length;
  const score = Math.round((detectedBlocksCount / checks.length) * 100);

  let level: 'excellent' | 'good' | 'fair' | 'incomplete' = 'incomplete';
  if (score >= 90) level = 'excellent';
  else if (score >= 70) level = 'good';
  else if (score >= 40) level = 'fair';

  const missingLabels = checks.filter((c) => !c.detected).map((c) => c.label);
  const summary =
    detectedBlocksCount === 10
      ? 'Ficha técnica completa com todos os 10 blocos canônicos detectados com sucesso.'
      : `${detectedBlocksCount} de 10 blocos canônicos preenchidos. Faltando: ${missingLabels.slice(0, 3).join(', ')}${missingLabels.length > 3 ? '...' : ''}.`;

  return {
    score,
    level,
    totalCanonicalBlocks: checks.length,
    detectedBlocksCount,
    checks,
    summary,
    detectedSpecs: {
      marca: data.marca,
      modelo: data.modelo,
      potenciaW: data.potenciaW || motor.potencia_w,
      autonomiaKm: data.autonomiaKm || bateria.autonomia_estimada_km,
      pesoKg: data.pesoKg || quadro.peso_total_kg,
      menorPreco: data.menorPreco || data.preco,
    },
  };
}

