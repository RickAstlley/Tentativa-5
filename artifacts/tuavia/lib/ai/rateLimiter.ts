import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

export type ModelTier = 'primary' | 'fallback' | 'tertiary';
export type Priority = 'high' | 'normal' | 'low';

export interface RateLimitBucketConfig {
  model: string;
  keyIndex: number;
  capacity: number;
  refillRate: number;
  tier: ModelTier;
}

export interface BucketState {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
  consecutiveFailures: number;
  circuitOpenUntil: number;
  lastSuccess: number;
}

export interface RateLimitHeaders {
  remaining?: number;
  reset?: number;
  limit?: number;
  retryAfter?: number;
}

/**
 * Limites por modelo. IDs validados contra GET /v1/models da NVIDIA.
 * Modelos maiores -> burst menor (menos concorrência por chave).
 */
/**
 * Limites por modelo, para os 6 modelos do catálogo NVIDIA NIM.
 *
 * A tabela ficou fechada de propósito: os ~25 IDs que existiam antes eram de
 * modelos fora do catálogo e nunca eram atingidos depois da normalização, então
 * as linhas eram letras mortas — um `Record<string, …>` não reclamava de
 * chave errada, e o modelo real caía no `DEFAULT_LIMITS` sem ninguém perceber.
 *
 * A ordem de burst segue o custo: o Nemotron Ultra é o mais caro e raro, e o
 * Super é o tier de triagem, que precisa aguentar rajada.
 */
const MODEL_LIMITS: Record<string, { rpm: number; burst: number }> = {
  // Raciocínio pesado: o mais lento e o mais caro do conjunto.
  'nvidia/nemotron-3-ultra-550b-a55b': { rpm: 20, burst: 3 },
  // Tier rápido: classificação e triagem, onde a rajada é o padrão.
  'nvidia/nemotron-3-super-120b-a12b': { rpm: 60, burst: 12 },
  // Texto padrão do site.
  'z-ai/glm-5.3': { rpm: 30, burst: 5 },
  // Auditoria e síntese, teto de saída curto.
  'openai/gpt-oss-20b': { rpm: 30, burst: 5 },
  // Multimodal: a carga de imagem é maior, então o burst é menor.
  'moonshotai/kimi-k3': { rpm: 20, burst: 3 },
  'google/gemma-4-31b-it': { rpm: 40, burst: 6 },
};

const DEFAULT_LIMITS = { rpm: 30, burst: 5 };
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_DURATION_MS = 60000;
// Hostinger: 1 vCPU efetiva. Chamadas concorrentes estouram o timeout do proxy.
const GLOBAL_MAX_CONCURRENT = 1;

class Semaphore {
  private permits: number;
  private waitQueue: Array<{ resolve: () => void; priority: Priority }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(priority: Priority = 'normal'): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push({ resolve, priority });
      this.waitQueue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    });
  }

  release(): void {
    this.permits++;
    const next = this.waitQueue.shift();
    if (next) {
      this.permits--;
      next.resolve();
    }
  }

  getAvailable(): number {
    return this.permits;
  }

  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

export class AdaptiveRateLimiter {
  private buckets = new Map<string, BucketState>();
  private globalSemaphore = new Semaphore(GLOBAL_MAX_CONCURRENT);
  private keyRotations = new Map<string, number>();

  private getBucketKey(model: string, keyIndex: number): string {
    return `${model}:${keyIndex}`;
  }

  private getLimits(model: string): { rpm: number; burst: number } {
    return MODEL_LIMITS[model] || DEFAULT_LIMITS;
  }

  private initBucket(model: string, keyIndex: number, tier: ModelTier): BucketState {
    const limits = this.getLimits(model);
    const key = this.getBucketKey(model, keyIndex);
    
    return {
      tokens: limits.burst,
      lastRefill: Date.now(),
      capacity: limits.burst,
      refillRate: limits.rpm / 60000,
      consecutiveFailures: 0,
      circuitOpenUntil: 0,
      lastSuccess: 0,
    };
  }

  private refillBucket(bucket: BucketState): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const newTokens = Math.min(
      bucket.capacity,
      bucket.tokens + elapsed * bucket.refillRate
    );
    bucket.tokens = newTokens;
    bucket.lastRefill = now;
  }

  private isCircuitOpen(bucket: BucketState): boolean {
    return bucket.circuitOpenUntil > Date.now();
  }

  async acquire(model: string, keyIndex: number, tier: ModelTier, priority: Priority = 'normal'): Promise<void> {
    const key = this.getBucketKey(model, keyIndex);
    
    if (!this.buckets.has(key)) {
      this.buckets.set(key, this.initBucket(model, keyIndex, tier));
    }

    const bucket = this.buckets.get(key)!;
    
    if (this.isCircuitOpen(bucket)) {
      const waitMs = bucket.circuitOpenUntil - Date.now();
      throw new Error(`CIRCUIT_OPEN:${waitMs}`);
    }

    await this.globalSemaphore.acquire(priority);
    
    this.refillBucket(bucket);
    
    if (bucket.tokens < 1) {
      const waitMs = Math.ceil((1 - bucket.tokens) / bucket.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.refillBucket(bucket);
    }
    
    bucket.tokens -= 1;
  }

  /**
   * Libera o semáforo e devolve o token ao balde.
   *
   * Antes disso, `release` ignorava os argumentos: o token gasto em `acquire`
   * nunca voltava, e uma chamada que falhava queimava cota permanente.
   */
  release(model: string, keyIndex: number): void {
    const bucket = this.buckets.get(this.getBucketKey(model, keyIndex));
    if (bucket) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + 1);
    }
    this.globalSemaphore.release();
  }

  onSuccess(model: string, keyIndex: number): void {
    const key = this.getBucketKey(model, keyIndex);
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.consecutiveFailures = 0;
      bucket.lastSuccess = Date.now();
    }
  }

  onFailure(model: string, keyIndex: number, status?: number, headers?: RateLimitHeaders): void {
    const key = this.getBucketKey(model, keyIndex);
    const bucket = this.buckets.get(key);
    if (!bucket) return;

    bucket.consecutiveFailures++;

    if (status === 429 || status === 503 || status === 502 || status === 504) {
      if (headers?.retryAfter) {
        bucket.circuitOpenUntil = Date.now() + headers.retryAfter * 1000;
      } else if (headers?.reset) {
        bucket.circuitOpenUntil = headers.reset * 1000;
      } else {
        const backoffMs = Math.min(
          1000 * Math.pow(2, bucket.consecutiveFailures - 1) + Math.random() * 500,
          30000
        );
        bucket.circuitOpenUntil = Date.now() + backoffMs;
      }
    }

    if (bucket.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      bucket.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_DURATION_MS;
      console.warn(`[RateLimiter] Circuit breaker OPEN for ${key} for ${CIRCUIT_BREAKER_DURATION_MS}ms`);
    }

    if (headers?.remaining !== undefined) {
      bucket.tokens = Math.max(0, headers.remaining);
    }
    if (headers?.limit !== undefined) {
      bucket.capacity = headers.limit;
      bucket.refillRate = headers.limit / 60000;
    }
  }

  onResponseHeaders(model: string, keyIndex: number, headers: RateLimitHeaders): void {
    const key = this.getBucketKey(model, keyIndex);
    const bucket = this.buckets.get(key);
    if (!bucket) return;

    if (headers.remaining !== undefined) {
      bucket.tokens = Math.max(0, headers.remaining);
    }
    if (headers.limit !== undefined) {
      bucket.capacity = headers.limit;
      bucket.refillRate = headers.limit / 60000;
    }
    if (headers.reset !== undefined) {
      const resetMs = headers.reset * 1000 - Date.now();
      if (resetMs > 0 && resetMs < 60000) {
        bucket.refillRate = bucket.capacity / resetMs * 1000;
      }
    }
  }

  getBucketState(model: string, keyIndex: number): BucketState | null {
    return this.buckets.get(this.getBucketKey(model, keyIndex)) || null;
  }

  getAllBucketStates(): Map<string, BucketState> {
    return new Map(this.buckets);
  }

  getGlobalStats(): { available: number; queued: number } {
    return {
      available: this.globalSemaphore.getAvailable(),
      queued: this.globalSemaphore.getQueueLength(),
    };
  }

  rotateKey(model: string, maxKeys: number): number {
    const current = this.keyRotations.get(model) || 0;
    const next = (current + 1) % maxKeys;
    this.keyRotations.set(model, next);
    return next;
  }

  resetCircuit(model: string, keyIndex: number): void {
    const key = this.getBucketKey(model, keyIndex);
    const bucket = this.buckets.get(key);
    if (bucket) {
      bucket.circuitOpenUntil = 0;
      bucket.consecutiveFailures = 0;
    }
  }
}

export const rateLimiter = new AdaptiveRateLimiter();

export function extractRateLimitHeaders(response: Response): RateLimitHeaders {
  return {
    remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '', 10) || undefined,
    reset: parseInt(response.headers.get('x-ratelimit-reset') || '', 10) || undefined,
    limit: parseInt(response.headers.get('x-ratelimit-limit') || '', 10) || undefined,
    retryAfter: parseInt(response.headers.get('retry-after') || '', 10) || undefined,
  };
}