/**
 * lib/security.ts
 * 
 * Camada de Segurança, Sanitização Defensiva e Margens Rígidas de Input
 * Desenvolvido para proteção contra:
 * - XSS e Injection de scripts/HTML
 * - DoS por payloads massivos (Buffer/Memory exhaustion)
 * - Prompt Injection e abusos de contexto em chamadas LLM
 * - Força bruta e spam de automações (Rate Limiting em memória)
 * - Valores numéricos anômalos ou irreais no banco de dados e UI
 */

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

// Armazenamento em memória para Rate Limiting (Sliding Window / Fixed Window)
const rateLimitMap = new Map<string, RateLimitRecord>();

// Limpeza periódica do mapa de rate limiting a cada 5 minutos para evitar vazamento de memória
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      // Se o registro tiver mais de 10 minutos de inatividade, descarta
      if (now - record.firstRequestTime > 600000) {
        rateLimitMap.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitOptions {
  windowMs: number; // Janela de tempo em ms (ex: 60_000 para 1 min)
  maxRequests: number; // Máximo de requisições permitidas na janela
}

/**
 * Valida o limite de requisições por identificador (IP ou token de sessão)
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60000, maxRequests: 20 }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    rateLimitMap.set(identifier, { count: 1, firstRequestTime: now });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime: now + options.windowMs,
    };
  }

  // Se a janela expirou, reseta o contador
  if (now - record.firstRequestTime > options.windowMs) {
    record.count = 1;
    record.firstRequestTime = now;
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetTime: now + options.windowMs,
    };
  }

  // Se dentro da janela, incrementa
  record.count += 1;
  const remaining = Math.max(0, options.maxRequests - record.count);
  const allowed = record.count <= options.maxRequests;
  const resetTime = record.firstRequestTime + options.windowMs;

  return { allowed, remaining, resetTime };
}

/**
 * Sanitiza e valida strings prevenindo XSS, tags HTML não autorizadas e caracteres de controle
 */
export function sanitizeInputString(
  input: unknown,
  maxLength: number = 255,
  allowLineBreaks: boolean = false
): string {
  if (input === null || input === undefined) return '';

  let str = String(input);

  // Normaliza Unicode
  str = str.normalize('NFKC');

  // Remove caracteres nulos e de controle perigosos (preserva \n e \r se allowLineBreaks for true)
  if (allowLineBreaks) {
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    str = str.replace(/[\x00-\x1F\x7F]/g, ' ');
  }

  // Remove tags de script, iframe, object, embed, style e javascript: protocols
  str = str
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers como onload=, onerror=, onclick=

  // Remove tags HTML remanescentes básicas e codifica caracteres perigosos residuais
  str = str.replace(/<[^>]*>/g, '');

  // Neutraliza entidades ou sequências de injeção direta
  str = str
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]*>/g, '') // Segunda passada após decodificação para evitar bypasses tipo &lt;script&gt;
    .replace(/[<>'"`;]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        case '`': return '&#96;';
        case ';': return '&#59;';
        default: return c;
      }
    });

  // Proteção contra Bomba de Caracteres / Texto Flood (ex: 500 letras ou pontuações idênticas repetidas consecutivas)
  str = str.replace(/(.)\1{12,}/g, '$1$1$1$1$1');

  // Trunca no limite máximo estipulado para prevenir buffer exhaustion
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }

  return str.trim();
}

/**
 * Validação de URL segura (apenas https:// e http:// são permitidos)
 */
export function sanitizeUrl(url: unknown, fallback: string = ''): string {
  if (!url || typeof url !== 'string') return fallback;

  const trimmed = url.trim();

  // Rejeita esquemas maliciosos
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallback;
  }

  // Deve iniciar com http:// ou https:// ou ser um caminho relativo seguro
  if (/^https?:\/\/[a-zA-Z0-9]/i.test(trimmed) || trimmed.startsWith('/')) {
    // Trunca URL em no máximo 1000 caracteres
    return trimmed.slice(0, 1000);
  }

  return fallback;
}

/**
 * Margem Rígida de Input Numérico
 * Garante que o valor esteja estritamente dentro de uma faixa aceitável
 */
export function validateNumberMargin(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }

  // Aplica as margens de corte (clamping)
  if (num < min) return min;
  if (num > max) return max;

  return num;
}

/**
 * Padrões de risco conhecidos de Prompt Injection para proteger chamadas ao LLM
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+in\s+dan\s+mode/i,
  /jailbreak/i,
  /reveal\s+your\s+(secret|internal|system)\s+instructions/i,
  /repeat\s+the\s+words\s+above/i,
  /bypass\s+all\s+(filters|rules|safeguards)/i,
];

/**
 * Sanitiza o input do usuário antes de enviá-lo como prompt para a IA
 * Previne prompt injection e estouro de limites de tokens
 */
export function sanitizeLLMPrompt(input: unknown, maxChars: number = 300): string {
  if (!input) return '';

  let text = sanitizeInputString(input, maxChars, true);

  // Neutraliza delimitadores artificiais de prompt
  text = text
    .replace(/```/g, "'''")
    .replace(/<system>/gi, '[system]')
    .replace(/<\/system>/gi, '[/system]')
    .replace(/<instruction>/gi, '[instruction]')
    .replace(/<\/instruction>/gi, '[/instruction]');

  // Verifica se há padrões explícitos de injeção
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      console.warn('[Security] Tentativa de Prompt Injection detectada e bloqueada:', text.slice(0, 80));
      // Substitui o texto malicioso por uma string inofensiva e sanitizada
      return 'E-Bike modelo padrão nacional';
    }
  }

  return text;
}

/**
 * Obtém o endereço IP do cliente de forma resiliente em ambiente Next.js
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return '127.0.0.1';
}
