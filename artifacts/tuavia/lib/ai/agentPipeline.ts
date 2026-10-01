import { createAndPollLLMJob } from './llmJobClient';
import type { NVIDIAModel, PipelineContext, AgentStep } from '@/types/pipeline';

export class AgentPipeline {
  private context: PipelineContext;
  private steps: AgentStep[];
  private onProgress?: (step: AgentStep, progress: number, output: any) => void;
  private onStepComplete?: (step: AgentStep, output: any) => void;
  private abortController: AbortController;

  constructor(
    initialContext: Partial<PipelineContext>,
    steps: AgentStep[],
    callbacks?: {
      onProgress?: (step: AgentStep, progress: number, output: any) => void;
      onStepComplete?: (step: AgentStep, output: any) => void;
    }
  ) {
    this.context = {
      userPrompt: '',
      targetType: 'article',
      tokensUsed: 0,
      costEstimate: 0,
      modelsUsed: [],
      durationMs: 0,
      errors: [],
      ...initialContext,
    };
    this.steps = steps;
    this.onProgress = callbacks?.onProgress;
    this.onStepComplete = callbacks?.onStepComplete;
    this.abortController = new AbortController();
  }

  async execute(): Promise<PipelineContext> {
    const startTime = Date.now();
    
    for (const step of this.steps) {
      if (this.abortController.signal.aborted) {
        throw new Error('Pipeline abortado pelo usuário');
      }

      const prompt = typeof step.prompt === 'function' 
        ? step.prompt(this.context) 
        : step.prompt;

      const inputData = step.input ? this.context[step.input] : undefined;
      const fullPrompt = inputData ? `${prompt}\n\nINPUT ANTERIOR:\n${JSON.stringify(inputData, null, 2)}` : prompt;

      let attempt = 0;
      const maxRetries = step.retryOnFail || 0;
      let lastError: Error | null = null;

      while (attempt <= maxRetries) {
        try {
          this.onProgress?.(step, 0, null);
          
          const jobResult = await createAndPollLLMJob({
            type: 'content_generation',
            input: {
              task: step.id,
              prompt: fullPrompt,
              model: step.model,
              temperature: step.temperature || 0.3,
              maxTokens: step.maxTokens || 4000,
            },
            allowSyncFallback: true,
            onProgress: (job) => {
              this.onProgress?.(step, job.progress || 0, job.stage);
            },
            signal: this.abortController.signal,
          });

          const output = this.extractOutput(jobResult.result, step.output);
          
          if (step.validation && !step.validation(output)) {
            throw new Error(`Validação falhou para step ${step.id}`);
          }

          (this.context as any)[step.output] = output;
          this.context.tokensUsed = (this.context.tokensUsed ?? 0) + (jobResult.usage?.total_tokens ?? 0);
          this.context.costEstimate = (this.context.costEstimate ?? 0) + this.estimateCost(step.model, jobResult.usage);
          (this.context.modelsUsed ??= []).push(step.model ?? 'default');
          
          this.onStepComplete?.(step, output);
          this.onProgress?.(step, 100, output);
          
          break;
        } catch (err: any) {
          lastError = err;
          attempt++;
          if (attempt <= maxRetries) {
            await this.delay(1000 * attempt);
          }
        }
      }

      if (lastError) {
        (this.context.errors ??= []).push({
          step: step.id,
          message: lastError.message,
          timestamp: Date.now(),
          recovered: false,
        });
        throw new Error(`Falha no step ${step.name}: ${lastError.message}`);
      }
    }

    this.context.durationMs = Date.now() - startTime;
    return this.context;
  }

  abort() {
    this.abortController.abort();
  }

  private extractOutput(result: any, outputKey: string): any {
    if (result?.data?.[outputKey]) return result.data[outputKey];
    if (result?.data?.markdownContent && outputKey === 'markdownDraft') return result.data.markdownContent;
    if (result?.data?.body && outputKey === 'markdownDraft') return result.data.body;
    if (result?.text) return result.text;
    if (typeof result === 'string') return result;
    return result;
  }

  private estimateCost(model: NVIDIAModel | string | undefined, usage: any): number {
    // USD por 1k tokens, relativo ao Nemotron Ultra como referência 1.0.
    // A tabela cobre só os 6 modelos do catálogo; o resto cai no default.
    const rates: Record<string, number> = {
      'nvidia/nemotron-3-ultra-550b-a55b': 0.01,
      'moonshotai/kimi-k3': 0.008,
      'nvidia/nemotron-3-super-120b-a12b': 0.003,
      'z-ai/glm-5.3': 0.002,
      'openai/gpt-oss-20b': 0.001,
      'google/gemma-4-31b-it': 0.001,
    };
    const tokens = usage?.total_tokens || 0;
    return (tokens / 1000) * (rates[model as string] ?? 0.005);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const PipelineFactory = {
  article: (context: Partial<PipelineContext>) => new AgentPipeline(context, [
    {
      id: 'plan',
      name: 'Planejamento Editorial + SEO',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      output: 'outline',
      prompt: `Você é Editor-Chefe do TuaVia. Crie outline estruturado para artigo sobre: "${context.userPrompt}".
      
      RETORNE JSON:
      {
        "title": "Título magnético SEO ≤60c",
        "slug": "slug-limpo",
        "excerpt": "Resumo 120-160c com CTA",
        "category": "Guia de Compra|Manutenção|Legislação|Notícias|Comparativo",
        "targetKeywords": ["kw1", "kw2", "kw3"],
        "searchIntent": "Informacional|Transacional|Navegacional",
        "outline": [
          {"heading": "H2 Título", "points": ["ponto1", "ponto2"], "wordCount": 300}
        ],
        "faqSchema": [{"question": "...", "answer": "..."}],
        "llmGeoSummary": "Síntese 200c para IA Overviews",
        "buyerPersona": "Perfil do leitor brasileiro"
      }`,
      validation: (o: any) => Boolean(o?.title) && (o?.outline?.length ?? 0) > 0,
    },
    {
      id: 'research',
      name: 'Pesquisa Factual & Dados Técnicos',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      input: 'outline',
      output: 'researchNotes',
      prompt: `Pesquise e valide dados para o artigo. Outline: {{outline}}.
      
      Foque em: especificações técnicas verificáveis, preços BR atuais, normas CONTRAN 996/2023,
      dados de fabricantes oficiais, fontes primárias. Cite URLs.
      
      RETORNE JSON: { "verifiedFacts": [], "sources": [], "technicalSpecs": {}, "priceData": [] }`,
    },
    {
      id: 'write',
      name: 'Redação Markdown Completa',
      model: 'z-ai/glm-5.3',
      input: 'researchNotes',
      output: 'markdownDraft',
      prompt: `Escreva artigo COMPLETO em Markdown para TuaVia.
      
      CONTEXTO: Outline={{outline}}, Pesquisa={{researchNotes}}
      
      REGRAS:
      - Tom: Técnico acessível, autoritário, honesto (sem hype)
      - Estrutura: H1 → H2/H3 → listas → tabelas → FAQ → Conclusão
      - Dados: Use números exatos da pesquisa, cite fontes [¹]
      - Links: Use placeholders {{bike:slug}}, {{ranking:slug}}
      - SEO: Integre keywords naturalmente, meta title/desc no frontmatter
      - CONTRAN: Se mencionar e-bike, inclua conformidade 996/2023`,
      maxTokens: 6000,
    },
    {
      id: 'refine',
      name: 'Refinamento Editorial',
      // Era `google/gemma-4-31b-it`, que tem janela de 8192. Um rascunho de
      // artigo passa de 8k com facilidade, então a etapa truncava a entrada.
      // Refinar texto longo é papel do GLM (131k de contexto).
      model: 'z-ai/glm-5.3',
      input: 'markdownDraft',
      output: 'refinedDraft',
      prompt: `Refine o texto mantendo TODOS os dados técnicos.
      
      REGRAS:
      - Remova: fluff, repetições, alucinações, saudações
      - Melhore: flow, transições, clareza, tom TuaVia
      - Formate: Markdown limpo, tabelas alinhadas, código fenced
      - Preserve: specs, preços, URLs, números exatos`,
      maxTokens: 6000,
    },
    {
      id: 'seo-final',
      name: 'SEO Final & Schema',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      input: 'refinedDraft',
      output: 'finalOutput',
      prompt: `Gere pacote SEO final para: {{refinedDraft}}
      
      RETORNE JSON:
      {
        "metaTitle": "≤60c",
        "metaDescription": "≤155c engajador",
        "focusKeyword": "principal",
        "secondaryKeywords": [],
        "faqSchema": [{"question": "", "answer": ""}],
        "articleSchema": {...},
        "llmGeoSummary": "200c para AI Overviews",
        "socialPreview": { "og:title": "", "og:description": "", "og:image": "" }
      }`,
    },
  ], {
    onProgress: (step, progress) => console.log(`[Article] ${step.name}: ${progress}%`),
  }),

  ebike: (context: Partial<PipelineContext>) => new AgentPipeline(context, [
    {
      id: 'classify',
      name: 'Classificação & CONTRAN',
      model: 'z-ai/glm-5.3',
      output: 'classification',
      prompt: `Classifique a e-bike: "${context.userPrompt}".
      
      RETORNE JSON:
      {
        "category": "Urbana|Trilha/MTB|Dobrável|Cargo|Speed",
        "contranStatus": "CONFORME_PEDELEC|AUTOPROPELIDO|CICLOMOTOR|ALERTA_IRREGULAR",
        "contranNotes": "Justificativa técnica",
        "powerClass": "250W|350W|500W|750W|1000W+",
        "speedClass": "25km/h|32km/h|45km/h",
        "requiresRegistration": boolean
      }`,
    },
    {
      id: 'specs',
      name: 'Extração Especs Técnicas (10 Seções)',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      input: 'classification',
      output: 'technicalSpecs',
      prompt: `Extraia/Calcule 10 seções canônicas de specs para e-bike.
      
      INPUT: Classificação={{classification}}, Prompt={{userPrompt}}
      
      CALCULE OBRIGATORIAMENTE:
      - batteryWh = voltage * ah
      - whPerKm = batteryWh / autonomiaKm
      - wPerKg = potenciaW / pesoKg
      - torqueEstimate (se motor central)
      
      RETORNE: Array[10] de { title, items: [{label, value, confidence, source}] }
      
      SEÇÕES: 1.Motor 2.Bateria 3.Quadro 4.Freios 5.Transmissão 6.Rodas 7.Conforto 8.Conectividade 9.Manutenção 10.Auditoria`,
      maxTokens: 5000,
    },
    {
      id: 'market',
      name: 'Análise Mercado & Posicionamento',
      model: 'moonshotai/kimi-k3',
      input: 'technicalSpecs',
      output: 'marketAnalysis',
      prompt: `Analise posicionamento de mercado para: {{technicalSpecs}}
      
      RETORNE JSON:
      {
        "competitors": [{"model": "", "price": 0, "pros": [], "cons": []}],
        "priceRange": { "min": 0, "max": 0, "sweetSpot": 0 },
        "positioning": "Melhor custo-benefício|Premium|Entrada|Nicho",
        "targetAudience": "Perfil detalhado",
        "sellingPoints": ["USP1", "USP2", "USP3"],
        "storeSuggestions": [{"store": "", "estimatedPrice": 0, "affiliateUrl": ""}]
      }`,
    },
    {
      id: 'verdict',
      name: 'Veredito Editorial & Resumo',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      input: 'marketAnalysis',
      output: 'verdictPackage',
      prompt: `Gere veredito final TuaVia para e-bike.
      
      CONTEXTO: Specs={{technicalSpecs}}, Mercado={{marketAnalysis}}
      
      RETORNE JSON:
      {
        "badge": "Selo curto (ex: Melhor Urbana <10k)",
        "resumoExecutivo": "2-3 parágrafos decisivos",
        "idealFor": "Perfil ideal do comprador",
        "pros": ["5 pontos fortes reais"],
        "cons": ["3-5 pontos de atenção honestos"],
        "score": { "urban": 0, "range": 0, "power": 0, "comfort": 0, "value": 0 }
      }`,
    },
    {
      id: 'seo',
      name: 'SEO & Rich Snippets E-Bike',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      input: 'verdictPackage',
      output: 'finalOutput',
      prompt: `Gere SEO completo para ficha de e-bike.
      
      RETORNE JSON:
      {
        "focusKeyword": "marca modelo 2026",
        "serpTitle": "Título Google ≤60c",
        "serpDescription": "Meta desc ≤155c com preço/autonomia",
        "faqSchema": [{"q": "Autonomia?", "a": "..."}, {"q": "CONTRAN?", "a": "..."}],
        "richSnippets": { "price": 0, "rating": 4.8, "availability": "InStock" },
        "llmGeoSummary": "Síntese para Perplexity/Gemini"
      }`,
    },
  ]),

  ranking: (context: Partial<PipelineContext>) => new AgentPipeline(context, [
    {
      id: 'strategy',
      name: 'Estratégia do Ranking',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      output: 'rankingStrategy',
      prompt: `Defina estratégia para Top Ranking: "${context.userPrompt}".
      
      RETORNE JSON:
      {
        "title": "Top X Melhores [Categoria] [Ano]",
        "category": "ebikes|baterias|pecas|acessorios|seguranca",
        "quantity": 5,
        "criteria": ["Autonomia", "Custo-benefício", "Confiabilidade", "Assistência"],
        "weights": [0.3, 0.3, 0.2, 0.2],
        "targetAudience": "Perfil",
        "criterioAvaliacao": "Texto explicativo do critério"
      }`,
    },
    {
      id: 'items',
      name: 'Geração Itens Ranqueados',
      model: 'z-ai/glm-5.3',
      input: 'rankingStrategy',
      output: 'rankingItems',
      prompt: `Gere ${(context.rankingStrategy as { quantity?: number })?.quantity || 5} itens ranqueados para: {{rankingStrategy}}.
      
      CADA ITEM DEVE TER:
      - posicao, tituloItem, marca, categoriaItem, notaDestaque
      - pontosPositivos[3], pontosNegativos[3]
      - especificacoes: {Potência, Autonomia, Peso, Preço, etc}
      - faixaPrecoEstimado, imagemUrl (placeholder)
      - lojas[2-3]: {nomeLoja, preco, url, cupom, destaque}
      - bikeSlug (se existir no catálogo)
      
      RETORNE: Array de itens completos.`,
      maxTokens: 8000,
    },
    {
      id: 'comparison',
      name: 'Tabela Comparativa & Conclusão',
      model: 'moonshotai/kimi-k3',
      input: 'rankingItems',
      output: 'comparison',
      prompt: `Crie tabela comparativa markdown + conclusão geral para: {{rankingItems}}.
      
      INCLUA:
      - Tabela markdown alinhada (Pos | Modelo | Motor | Bateria | Autonomia | Preço | Nota)
      - Análise por critério
      - Veredito final: "Melhor Geral", "Melhor Custo-Benefício", "Premium"
      - FAQ 3-5 perguntas`,
      maxTokens: 4000,
    },
    {
      id: 'format',
      name: 'Formatação Final & Schema',
      // Formatação de schema.org não tem imagem nenhuma: o modelo multimodal de
      // janela curta só trazia um teto de saída menor sem ganho.
      model: 'z-ai/glm-5.3',
      input: 'comparison',
      output: 'finalOutput',
      prompt: `Formate ranking final com schema.org ItemList.
      
      RETORNE JSON completo TopRanking pronto para salvar.`,
    },
  ]),
};