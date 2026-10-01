/**
 * lib/ai/agents/imageResearch.ts
 *
 * Pesquisa, filtra e audita imagens para artigos. Substitui
 * `@/src/ai/agents/ImageResearchAgent`, que não existia.
 *
 * O agente é deliberadamente cético: uma imagem só é aprovada se for grande
 * o bastante, tiver domínio conhecido e for pertinente ao tema. As reprovadas
 * vão para `discarded_candidates` com o motivo — o painel mostra o descarte
 * para o editor decidir, não para esconder.
 */

import { WebSearchTool } from '@/lib/ai/tools/webSearch';
import { AIRouter } from '@/lib/ai/router';
import { getModelForRole } from '@/lib/ai/nvidiaModelCatalog';
import type { ImageCandidate, VerifiedImageItem } from '@/lib/ai/types';

const MIN_WIDTH = 640;
const MIN_HEIGHT = 360;
const MIN_SCORE = 55;

const BLOCKED_DOMAINS = new Set([
  'pinterest.com',
  'pinimg.com',
  'tumblr.com',
  'reddit.com',
  'imgur.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
]);

const TRUSTED_DOMAINS = new Set([
  'wikipedia.org',
  'commons.wikimedia.org',
  'unsplash.com',
  'pexels.com',
  'shutterstock.com',
  'gettyimages.com',
  'canaltech.com.br',
  'techtudo.com.br',
  'bikevolution.net',
  'electrek.co',
  'insideevs.com',
  'cnbc.com',
  'reuters.com',
]);

interface ImageResearchInput {
  articleTopic: string;
  articleContext?: string;
  articleCategory?: string;
  bikeModel?: string;
  desiredCount?: number;
}

export interface ImageResearchResult {
  article_images: VerifiedImageItem[];
  discarded_candidates: Array<ImageCandidate & { score: number; rejectedReason: string }>;
  telemetry: {
    queriesRun: number;
    candidatesFound: number;
    candidatesVerified: number;
    candidatesDiscarded: number;
    durationMs: number;
    llmCalls: number;
  };
  audit: {
    rules: string[];
    blockedDomains: string[];
    trustedDomains: number;
  };
}

function scoreCandidate(
  candidate: ImageCandidate,
  topic: string
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];
  const domain = candidate.domain || '';

  if (BLOCKED_DOMAINS.has(domain)) {
    return { score: 0, reasons: [`domínio bloqueado (${domain})`] };
  }
  if (TRUSTED_DOMAINS.has(domain)) {
    score += 20;
    reasons.push('domínio de confiança');
  }

  if (typeof candidate.width === 'number' && typeof candidate.height === 'number') {
    if (candidate.width < MIN_WIDTH || candidate.height < MIN_HEIGHT) {
      return {
        score: 0,
        reasons: [`resolução insuficiente (${candidate.width}x${candidate.height})`],
      };
    }
    const megapixels = (candidate.width * candidate.height) / 1_000_000;
    if (megapixels >= 2) {
      score += 15;
      reasons.push('alta resolução');
    } else {
      score += 5;
    }
  } else {
    // Sem dimensões conhecidas, o agente baixa a confiança em vez de assumir.
    score -= 10;
    reasons.push('dimensões desconhecidas');
  }

  const topicWords = topic
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  const haystack = candidate.sourceName.toLowerCase();
  const hits = topicWords.filter((word) => haystack.includes(word)).length;
  if (hits > 0) {
    score += Math.min(20, hits * 8);
    reasons.push(`${hits} termo(s) do tema presente(s)`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

class ImageResearchAgentClass {
  /** Pipeline completo: busca -> score determinístico -> validação de URL. */
  static async executePipeline(input: ImageResearchInput): Promise<ImageResearchResult> {
    const startedAt = Date.now();
    const topic = (input.articleTopic || 'Bicicletas Elétricas').trim();
    const desired = Math.min(Math.max(input.desiredCount ?? 4, 1), 10);

    const queries = [
      `${topic} bicicleta elétrica`,
      `${topic} e-bike motor bateria`,
      input.bikeModel ? `${input.bikeModel} bicicleta elétrica ficha técnica` : '',
      'e-bike technology diagram',
    ].filter(Boolean);

    const responses = await Promise.all(
      queries.map((query) => WebSearchTool.search({ query, limit: 8 }))
    );

    const seen = new Set<string>();
    const candidates: ImageCandidate[] = [];
    let queriesRun = 0;

    for (const response of responses) {
      if (!response.success) continue;
      queriesRun += 1;
      for (const result of response.organic) {
        if (seen.has(result.link)) continue;
        seen.add(result.link);
        candidates.push({
          url: result.link,
          sourceName: result.title,
          sourceUrl: result.link,
          domain: result.domain,
        });
      }
    }

    const verified: VerifiedImageItem[] = [];
    const discarded: Array<ImageCandidate & { score: number; rejectedReason: string }> = [];

    for (const candidate of candidates) {
      const { score, reasons } = scoreCandidate(candidate, topic);

      if (score < MIN_SCORE) {
        discarded.push({ ...candidate, score, rejectedReason: reasons.join('; ') || 'abaixo do corte' });
        continue;
      }

      if (!(await ImageResearchAgentClass.checkImageReachable(candidate.url))) {
        discarded.push({ ...candidate, score, rejectedReason: 'URL inacessível ou não é imagem' });
        continue;
      }

      verified.push({
        url: candidate.url,
        sourceName: candidate.sourceName,
        sourceUrl: candidate.sourceUrl,
        score,
        verified: true,
        evidence: reasons.join('; '),
        articleRelevant: reasons.some((reason) => reason.includes('termo')),
      });
    }

    verified.sort((a, b) => b.score - a.score);

    return {
      article_images: verified.slice(0, desired),
      discarded_candidates: discarded.slice(0, 20),
      telemetry: {
        queriesRun,
        candidatesFound: candidates.length,
        candidatesVerified: verified.length,
        candidatesDiscarded: discarded.length,
        durationMs: Date.now() - startedAt,
        llmCalls: 0,
      },
      audit: {
        rules: [
          `resolução mínima ${MIN_WIDTH}x${MIN_HEIGHT}`,
          'domínio de bloqueio (redes sociais e pinterest)',
          'bônus para domínios de confiança',
          'dimensões desconhecidas reduzem a pontuação',
          `corte de score em ${MIN_SCORE}`,
        ],
        blockedDomains: [...BLOCKED_DOMAINS],
        trustedDomains: TRUSTED_DOMAINS.size,
      },
    };
  }

  /**
   * Busca imagens para um alvo e devolve as verificadas.
   *
   * Contrato alinhado ao que `lib/ai/jobStore.ts` já consome (`results` +
   * `telemetry`), em vez de um terceiro formato.
   */
  static async searchAndValidateTarget(options: {
    query: string;
    /** Contexto do artigo, usado para pontuar pertinência. */
    contextHint?: string;
    category?: string;
    count?: number;
  }): Promise<{
    results: VerifiedImageItem[];
    telemetry: {
      queriesRun: number;
      candidatesFound: number;
      candidatesVerified: number;
      durationMs: number;
      llmCalls: number;
    };
  }> {
    const startedAt = Date.now();
    const topic = options.contextHint || options.query;
    const count = Math.min(Math.max(options.count ?? 6, 1), 20);

    const queries = [
      options.query,
      options.category ? `${options.query} ${options.category}` : '',
      options.contextHint ? `${options.query} ${options.contextHint.slice(0, 120)}` : '',
    ].filter(Boolean);

    const responses = await Promise.all(queries.map((query) => WebSearchTool.search({ query, limit: count })));
    const successful = responses.filter((response) => response.success);

    const seen = new Set<string>();
    const results: VerifiedImageItem[] = [];

    for (const response of successful) {
      for (const item of response.organic) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);

        const candidate: ImageCandidate = {
          url: item.link,
          sourceName: item.title,
          sourceUrl: item.link,
          domain: item.domain,
        };
        const { score, reasons } = scoreCandidate(candidate, topic);
        if (score < MIN_SCORE) continue;

        results.push({
          url: item.link,
          sourceName: item.title,
          sourceUrl: item.link,
          score,
          verified: true,
          evidence: reasons.join('; '),
          articleRelevant: reasons.some((reason) => reason.includes('termo')),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return {
      results: results.slice(0, count),
      telemetry: {
        queriesRun: successful.length,
        candidatesFound: seen.size,
        candidatesVerified: results.length,
        durationMs: Date.now() - startedAt,
        llmCalls: 0,
      },
    };
  }

  /** Reavalia uma imagem já escolhida e devolve o veredito de auditoria. */
  static async auditExistingImage(options: {
    imageUrl: string;
    articleTopic?: string;
    /** Nome do bloco/target, usado como fallback de contexto. */
    targetName?: string;
    /** Contexto do artigo. */
    contextHint?: string;
  }): Promise<VerifiedImageItem> {
    const topic = options.articleTopic || options.contextHint || options.targetName || '';
    const domain = (() => {
      try {
        return new URL(options.imageUrl).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    })();

    const candidate: ImageCandidate = {
      url: options.imageUrl,
      sourceName: options.imageUrl,
      sourceUrl: options.imageUrl,
      domain,
    };
    const { score, reasons } = scoreCandidate(candidate, topic);
    const alive = await ImageResearchAgentClass.checkImageReachable(options.imageUrl);

    const verdict: VerifiedImageItem = {
      url: options.imageUrl,
      sourceName: options.imageUrl,
      sourceUrl: options.imageUrl,
      score,
      verified: alive && score >= MIN_SCORE,
      evidence: reasons.join('; '),
    };
    if (!verdict.verified) {
      verdict.rejectedReason = !alive ? 'URL inacessível' : reasons.join('; ') || 'abaixo do corte';
    }
    return verdict;
  }

  /** HEAD request com timeout curto. */
  private static async checkImageReachable(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
      return response.ok && (response.headers.get('content-type') ?? '').startsWith('image/');
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Usa a IA só para julgar pertinência (barato, 1 chamada). */
  static async judgeRelevance(imageUrl: string, articleTopic: string): Promise<boolean> {
    // Julgar pertinência de imagem é a tarefa de visão mais barata que existe
    // (1 token de saída, temperatura 0), então vai para o modelo de visão
    // explícito em vez do roteador: a tarefa cai no mesmo Gemma, mas dizer com
    // o papel deixa a intenção legível e sobrevive a uma reordenação da tabela.
    const result = await AIRouter.dispatch({
      task: 'image_relevance',
      overrideModel: getModelForRole('vision'),
      rawPrompt:
        `A imagem abaixo é pertinente ao tema "${articleTopic}"?\n` +
        `URL: ${imageUrl}\n` +
        'Responda exatamente "SIM" ou "NAO", sem explicação.',
      temperature: 0,
      maxTokens: 8,
      parse: false,
      priority: 'low',
    });
    return /^\s*SIM/i.test(result.text);
  }
}

export const ImageResearchAgent = ImageResearchAgentClass;
