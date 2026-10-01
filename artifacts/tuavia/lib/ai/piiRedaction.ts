/**
 * PII Redaction Utility for TuaVia AI Admin
 * Detecta e mascara dados sensíveis (CPF, CNPJ, email, telefone, RG, CNH, CEP, cartão de crédito, etc.)
 */

export interface PIIMatch {
  type: string;
  value: string;
  start: number;
  end: number;
  masked: string;
}

export interface RedactionResult {
  original: string;
  redacted: string;
  matches: PIIMatch[];
  hasPII: boolean;
}

// Padrões regex para PII brasileiro
const PII_PATTERNS: Array<{ type: string; regex: RegExp; maskFn: (match: string) => string }> = [
  // CPF: 000.000.000-00 ou 00000000000
  {
    type: 'CPF',
    regex: /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
    },
  },
  // CNPJ: 00.000.000/0000-00 ou 00000000000000
  {
    type: 'CNPJ',
    regex: /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
    },
  },
  // Email
  {
    type: 'EMAIL',
    regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    maskFn: (match) => {
      const [local, domain] = match.split('@');
      const maskedLocal = local.length > 2 ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] : '***';
      return `${maskedLocal}@${domain}`;
    },
  },
  // Telefone brasileiro: (XX) XXXXX-XXXX, (XX) XXXX-XXXX, +55 XX XXXXX-XXXX
  {
    type: 'PHONE',
    regex: /\b(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10) {
        return `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
      }
      return '(**) ****-****';
    },
  },
  // RG: XX.XXX.XXX-X ou XXXXXXX-X (varia por estado)
  {
    type: 'RG',
    regex: /\b(\d{1,2}\.?\d{3}\.?\d{3}-?\d{1})\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 7) {
        return `${digits.slice(0, 2)}.***.***-${digits.slice(-1)}`;
      }
      return '***.***-*';
    },
  },
  // CNH: 11 dígitos
  {
    type: 'CNH',
    regex: /\b(\d{11})\b/g,
    maskFn: (match) => {
      return `${match.slice(0, 3)}*******${match.slice(-1)}`;
    },
  },
  // CEP: 00000-000 ou 00000000
  {
    type: 'CEP',
    regex: /\b(\d{5}-?\d{3})\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      return `${digits.slice(0, 5)}-***`;
    },
  },
  // Cartão de crédito: 16 dígitos (com ou sem espaços/hífens)
  {
    type: 'CREDIT_CARD',
    regex: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g,
    maskFn: (match) => {
      const digits = match.replace(/\D/g, '');
      return `**** **** **** ${digits.slice(-4)}`;
    },
  },
  // IP Address (v4)
  {
    type: 'IP_ADDRESS',
    regex: /\b((?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?))\b/g,
    maskFn: (match) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.*.*`;
    },
  },
  // Placa de veículo (Mercosul: AAA0A00 ou antigo: AAA-0000)
  {
    type: 'LICENSE_PLATE',
    regex: /\b([A-Z]{3}[0-9][A-Z0-9][0-9]{2}|[A-Z]{3}-?[0-9]{4})\b/g,
    maskFn: (match) => {
      return match.replace(/[A-Z]/g, '*').replace(/[0-9]/g, '#');
    },
  },
  // Chave PIX (email, telefone, CPF, CNPJ, aleatória)
  {
    type: 'PIX_KEY',
    regex: /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/gi,
    maskFn: (match) => {
      return `${match.slice(0, 8)}-****-****-****-${match.slice(-12)}`;
    },
  },
];

/**
 * Redage PII de um texto
 */
export function redactPII(text: string, options?: { customPatterns?: typeof PII_PATTERNS; preserveLength?: boolean }): RedactionResult {
  const patterns = options?.customPatterns || PII_PATTERNS;
  const matches: PIIMatch[] = [];
  let redacted = text;
  let offset = 0;

  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const originalValue = match[1] || match[0];
      const start = match.index + offset;
      const masked = pattern.maskFn(originalValue);
      const end = start + originalValue.length;
      
      matches.push({
        type: pattern.type,
        value: originalValue,
        start: match.index,
        end: match.index + originalValue.length,
        masked,
      });
      
      // Substitui no texto redacted ajustando offsets
      const before = redacted.slice(0, start);
      const after = redacted.slice(end);
      redacted = before + masked + after;
      offset += masked.length - originalValue.length;
      
      // Evita loop infinito em regex global
      if (!regex.global) break;
    }
  }

  // Ordena matches por posição
  matches.sort((a, b) => a.start - b.start);

  return {
    original: text,
    redacted,
    matches,
    hasPII: matches.length > 0,
  };
}

/**
 * Redage PII de um objeto JSON recursivamente
 */
export function redactPIIFromObject(obj: any, options?: { customPatterns?: typeof PII_PATTERNS }): any {
  if (typeof obj === 'string') {
    return redactPII(obj, options).redacted;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIFromObject(item, options));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactPIIFromObject(value, options);
    }
    return result;
  }
  
  return obj;
}

/**
 * Verifica se texto contém PII sem redigir
 */
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  
  for (const pattern of PII_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const originalValue = match[1] || match[0];
      matches.push({
        type: pattern.type,
        value: originalValue,
        start: match.index,
        end: match.index + originalValue.length,
        masked: pattern.maskFn(originalValue),
      });
      
      if (!regex.global) break;
    }
  }
  
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Sanitiza logs para armazenamento seguro
 */
export function sanitizeForLogging(data: any): any {
  const sensitiveKeys = [
    'password', 'senha', 'secret', 'segredo', 'token', 'api_key', 'apikey',
    'apiKey', 'access_token', 'refresh_token', 'authorization', 'auth',
    'cpf', 'cnpj', 'rg', 'cnh', 'cep', 'phone', 'telefone', 'email',
    'credit_card', 'cartao', 'card_number', 'numero_cartao', 'pix',
    'private_key', 'privateKey', 'ssh_key', 'aws_secret', 'aws_key',
  ];

  if (typeof data === 'string') {
    return redactPII(data).redacted;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item));
  }

  if (data !== null && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(s => lowerKey.includes(s));
      
      if (isSensitive && typeof value === 'string') {
        result[key] = redactPII(value).redacted;
      } else {
        result[key] = sanitizeForLogging(value);
      }
    }
    return result;
  }

  return data;
}

/**
 * Middleware para sanitizar requests/responses antes de log
 */
export function createSanitizedLogger() {
  return {
    log: (level: string, message: string, meta?: any) => {
      const sanitizedMeta = meta ? sanitizeForLogging(meta) : undefined;
      // `level` vem do próprio chamador; a lista impede que um nível inválido
      // vire `console[level]` e quebre o log redigido inteiro.
      const method: 'log' | 'info' | 'warn' | 'error' | 'debug' =
        level === 'info' || level === 'warn' || level === 'error' || level === 'debug'
          ? level
          : 'log';
      console[method](message, sanitizedMeta);
    },
    info: (message: string, meta?: any) => createSanitizedLogger().log('info', message, meta),
    warn: (message: string, meta?: any) => createSanitizedLogger().log('warn', message, meta),
    error: (message: string, meta?: any) => createSanitizedLogger().log('error', message, meta),
    debug: (message: string, meta?: any) => createSanitizedLogger().log('debug', message, meta),
  };
}

export const PII_TYPES = PII_PATTERNS.map(p => p.type);
export default { redactPII, redactPIIFromObject, detectPII, sanitizeForLogging, createSanitizedLogger, PII_TYPES };