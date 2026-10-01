import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { ProviderHub } from '@/lib/ai/providers/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
  }

  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'O texto para classificação é obrigatório' }, { status: 400 });
    }

    const systemPrompt = `Você é um robô de IA de elite e especialista principal em classificação semântica de SEO e curadoria de conteúdo para o portal TuaVia (autoridade máxima em bicicletas elétricas e mobilidade urbana no Brasil).
Analise o texto fornecido pelo editor e classifique-o precisamente em uma das quatro categorias exclusivas do portal:
1. "e-bike" -> Se for uma análise técnica, lançamento de modelo, ficha de especificações ou review de uma e-bike específica.
2. "e-bike promoção" -> Se for uma oferta de e-bike, desconto ativo, cupom de loja, preço baixo histórico ou liquidação de modelo.
3. "artigo" -> Se for um guia de compra educativo, tutorial de manutenção, legislação de e-bikes (CONTRAN) ou dicas de condução.
4. "artigo notícias" -> Se for uma notícia de mercado quente, atualização tecnológica, novo motor, fábricas ou mercado.

Além da categoria, extraia e organize as informações para preenchimento de formulário no formato JSON exato.

Retorne ESTRITAMENTE um objeto JSON válido (sem tags markdown de código \`\`\`json, sem explicações fora do JSON e sem textos extras) com este formato exato:
{
  "category": "e-bike" | "e-bike promoção" | "artigo" | "artigo notícias",
  "reason": "Justificativa clara de SEO em uma frase explicando o porquê desta classificação",
  "title": "Sugestão de título magnético e profissional (otimizado para SEO no Brasil 2026)",
  "excerpt": "Meta description persuasiva para o Google, contendo palavras-chave (entre 120 e 160 caracteres)",
  "keywords": ["palavra-chave1", "palavra-chave2", "palavra-chave3"],
  "highImpact": true/false, // Defina como true se for uma pauta de grande interesse / tendência forte
  "prefillData": {
    "marca": "Marca identificada (ex: Caloi, Oggi, Sense, Specialized, Lev, Duos, Trek, etc) ou 'TuaVia Radar'",
    "modelo": "Modelo identificado ou nome limpo da bike",
    "motorPowerW": "Ex: 250, 350, 500 ou 'Não informado'",
    "batteryDetails": "Ex: 36V 10.4Ah (374Wh), 504Wh ou 'Não informado'",
    "priceEstimated": "Preço estimado em número sem pontos (ex: 6490)",
    "usoPrincipal": "Urbana" | "Trilha/MTB" | "Dobrável" | "Cargo" | "Speed",
    "resumoExecutivo": "Uma introdução ou análise preliminar do modelo baseada no texto",
    "destaques": ["destaque ou ponto forte 1", "destaque ou ponto forte 2"],
    "badge": "Ex: '⚡ Oferta Ativa' ou '🔥 Preço Baixo' (se categoria for e-bike promoção) ou 'Destaque Técnico'",
    "ofertaLoja": "Nome da loja se identificada, ex: Caloi Oficial, Decathlon, Mercado Livre, etc"
  }
}`;

    const llmResult = await ProviderHub.executeWithFallback({
      taskName: 'pauta_classification',
      primaryModel: ProviderHub.DEFAULT_MODELS.orchestrator,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `TEXTO DO EDITOR PARA ANALISAR:\n\n${text}` }
      ],
      temperature: 0.1, // temperatura baixa para maior conformidade com o formato JSON
      maxTokens: 1500,
    });

    const resultText = llmResult.text || '';
    if (!resultText.trim()) {
      throw new Error('A LLM retornou um texto vazio para classificação.');
    }

    // Limpeza de tags markdown de código e parsing seguro do JSON
    let cleanText = resultText.trim();
    if (cleanText.includes('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    const parsedData = JSON.parse(cleanText);

    return NextResponse.json({
      success: true,
      classification: parsedData,
      providerUsed: (llmResult as any).providerUsed || (llmResult as any).provider || 'gemini',
      latencyMs: llmResult.latencyMs,
    });

  } catch (error: any) {
    console.error('Erro na rota /api/admin/llm/radar/classify:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Erro interno ao classificar pauta.',
    }, { status: 500 });
  }
}
