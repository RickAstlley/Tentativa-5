import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { NvidiaProvider, ChatMessagePayload, MultimodalContentPart } from '@/lib/ai/providers/nvidia';
import { VISION_MODEL_IDS } from '@/lib/ai/nvidiaModelCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const {
      model = 'z-ai/glm-5.3',
      prompt = 'Explique brevemente como funciona uma bicicleta elétrica com motor central.',
      imageUrl,
      temperature,
      topP,
      maxTokens,
      enableThinking = true,
      reasoningEffort,
      seed,
      apiFormat = 'chat_completions',
      baseURL,
      apiKey,
    } = body;

    const normalizedModel = NvidiaProvider.normalizeModel(model);

    let messages: ChatMessagePayload[] = [];
    // Antes a checagem era uma comparação literal com dois IDs. Com o catálogo
    // virando fonte única de verdade, um terceiro modelo de visão adicionado
    // depois seria aceito no seletor e aqui cairia no ramo de texto — a imagem
    // seria silenciosamente ignorada e o teste "passaria" sem ver a imagem.
    if (imageUrl && VISION_MODEL_IDS.includes(normalizedModel)) {
      const parts: MultimodalContentPart[] = [
        { type: 'text', text: prompt || 'What is in this image?' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ];
      messages = [{ role: 'user', content: parts }];
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    if (apiFormat === 'responses_api') {
      // Assinatura posicional: `executeResponsesApi(model, prompt, systemPrompt?, options?)`.
      // A chamada anterior passava um objeto único, então `model` chegava
      // como `{...}` e o provider normalizeva um modelo inexistente — este
      // endpoint era o botão "testar conexão" do painel de IA.
      const respResult = await NvidiaProvider.executeResponsesApi(
        normalizedModel,
        prompt,
        undefined,
        {
          maxTokens,
          temperature,
          topP,
          baseURL,
          apiKey,
        }
      );

      return NextResponse.json({
        success: true,
        apiFormat: 'responses_api',
        modelUsed: normalizedModel,
        result: {
          text: respResult.text,
          reasoningContent: respResult.reasoningContent,
          usage: respResult.usage,
        },
      });
    }

    // Idem: `chatCompletion(model, messages, options)` é posicional.
    const result = await NvidiaProvider.chatCompletion(normalizedModel, messages, {
      temperature,
      topP,
      maxTokens,
      enableThinking,
      reasoningEffort,
      seed,
      baseURL,
      apiKey,
    });

    return NextResponse.json({
      success: true,
      apiFormat: 'chat_completions',
      modelUsed: normalizedModel,
      result: {
        text: result.text,
        reasoningContent: result.reasoningContent,
        usage: result.usage,
      },
    });
  } catch (err: any) {
    console.error('[NvidiaTestRoute] Erro na execução:', err);
    // Preserva o `errorCode` de origem. Um modelo fora do catálogo e uma chave
    // ausente dão ações opostas para quem opera: o primeiro é bug de código,
    // o segundo é configuração. Colapsar os dois em `NVIDIA_EXECUTION_ERROR`
    // apagava essa distinção.
    const errorCode = err?.errorCode || 'NVIDIA_EXECUTION_ERROR';
    const isClientFault = errorCode === 'INVALID_MODEL' || errorCode === 'API_KEY_MISSING';
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Erro ao processar chamada com o modelo NVIDIA.',
        errorCode,
      },
      { status: isClientFault ? 400 : 500 }
    );
  }
}
