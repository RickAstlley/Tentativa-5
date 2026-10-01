import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { ProviderHub } from '@/lib/ai/providers/hub';
import { AIRouter } from '@/lib/ai/router';
import { YAMLParser } from '@/lib/ai/validation/parser';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { getLastNMonths, sanitizePriceHistory } from '@/lib/priceHistory';
import { EBikePriceHistoryPoint } from '@/types/ebike';
import { auditEBikeSpecs, isUnconfirmedValue } from '@/lib/ai/deterministicAuditor';
import {
  decomposeBrandAndModel,
  extractMarkdownTablesAndSpecs,
  generateCanonicalEBikeYaml,
  parseEBikeDeterministic,
} from '@/lib/admin/fileIngestion';
import { cleanSpecValue, allocateFromTaggedSpecs } from '@/lib/specAllocations';
import { parseIngestFile, validateFiles, getMimeTypeFromExtension, type IngestFile } from '@/lib/ingest/parsers';
import { runIngestionPipeline, type LlmPolicy } from '@/lib/ingestion/pipeline';
import { createJob, triggerJobExecution } from '@/lib/ai/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Hostinger derruba bem antes disso. Tudo que passa de ~20s vai para a fila
// (/api/admin/llm/jobs), que é o que o jobStore foi feito para resolver.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado. Autenticação de administrador necessária.', errorCode: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const clientIp = getClientIp(req);
  const adminIdentifier = auth.email || clientIp;
  const rateResult = checkRateLimit(`ingest_${adminIdentifier}`, { windowMs: 60000, maxRequests: 35 });
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, error: 'Muitas requisições simultâneas. Aguarde alguns segundos.', errorCode: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 }
    );
  }

  try {
    // Suporta tanto JSON (modo texto) quanto multipart/form-data (modo arquivo)
    const contentType = req.headers.get('content-type') || '';
    let body: any;
    let uploadedFiles: IngestFile[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = {
        mode: formData.get('mode') || 'ebike',
        rawText: formData.get('rawText') || '',
        fileName: formData.get('fileName') || undefined,
        step: formData.get('step') ? Number(formData.get('step')) : undefined,
        engine: formData.get('engine') || undefined,
        action: formData.get('action') || undefined,
        ocr: formData.get('ocr') === 'true',
        stageData: formData.get('stageData') ? JSON.parse(String(formData.get('stageData'))) : undefined,
        parsedData: formData.get('parsedData') ? JSON.parse(String(formData.get('parsedData'))) : undefined,
      };

      // Converte os arquivos do FormData para IngestFile
      const formFiles = formData.getAll('files');
      for (const formFile of formFiles) {
        if (formFile instanceof File) {
          const arrayBuffer = await formFile.arrayBuffer();
          uploadedFiles.push({
            buffer: Buffer.from(arrayBuffer),
            fileName: formFile.name,
            mimeType: formFile.type || getMimeTypeFromExtension(formFile.name) || undefined,
          });
        }
      }
    } else {
      body = await req.json();
      // Suporta envio de arquivos como base64/buffer serializado (fallback)
      if (Array.isArray(body.files) && body.files[0]?.buffer) {
        uploadedFiles = body.files.map((f: any) => ({
          buffer: Buffer.from(f.buffer),
          fileName: f.fileName,
          mimeType: f.mimeType,
        }));
      }
    }

    const { mode, rawText, parsedData, fileName, step, stageData, engine } = body;

    if (!['ebike', 'article', 'ranking'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Modo de ingestão inválido. Use "ebike", "article" ou "ranking".', errorCode: 'INVALID_MODE' },
        { status: 400 }
      );
    }

    /**
     * O texto que alimenta o PARSER fica em bruto, com sanidade de tamanho.
     *
     * Antes passava por `sanitizeLLMPrompt`, que é filtro de prompt injection:
     * convertia `;` em `&#59;`, `'` em `&#39;` e apagava tags HTML. Isso
     *happened antes da varredura determinística, então um CSV ou uma tabela de
     * ficha técnica chegava ao alocador sem os delimitadores — e a extração
     * saía errada. A proteção de prompt fica onde ela pertence: dentro de
     * `fillGapsWithLlm`, via `redactPII`, só no texto enviado ao modelo.
     */
    const textToAnalyze = String(rawText || '')
      .slice(0, 200_000)
      .replace(/\0/g, '');
    const truncated = String(rawText || '').length > 200_000;

    if (!textToAnalyze.trim() && !parsedData && uploadedFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum conteúdo ou arquivo fornecido para ingestão.', errorCode: 'EMPTY_CONTENT' },
        { status: 400 }
      );
    }

    // 0. Nova Rota: Parser de Arquivos (PDF, DOCX, XLSX, CSV, JSON, Imagens) - available para todos os modos
    if (engine === 'parse_files') {
      console.log(`[LLM INGEST - File Parser] Processando ${uploadedFiles.length} arquivo(s) para mode="${mode}"`);
      
      const fileResults: any[] = [];
      
      if (uploadedFiles.length > 0) {
        const validation = validateFiles(uploadedFiles);
        if (!validation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Arquivos inválidos',
            errors: validation.errors,
            errorCode: 'INVALID_FILES',
          }, { status: 400 });
        }
        
        for (const file of uploadedFiles) {
          try {
            const result = await parseIngestFile(file, { ocr: body.ocr, maxChars: 200000 });
            fileResults.push({
              fileName: file.fileName,
              mimeType: result.metadata.mimeType,
              size: result.metadata.size,
              text: result.text,
              textLength: result.text.length,
              chunksCount: result.chunks?.length || 0,
              metadata: result.metadata,
              chunks: result.chunks,
            });
          } catch (err) {
            console.error(`[File Parser] Erro ao processar ${file.fileName}:`, err);
            fileResults.push({
              fileName: file.fileName,
              error: err instanceof Error ? err.message : 'Erro desconhecido',
            });
          }
        }
      } else if (textToAnalyze) {
        const result = await parseIngestFile({
          buffer: Buffer.from(textToAnalyze, 'utf-8'),
          fileName: fileName || 'texto.txt',
          mimeType: 'text/plain',
        }, {});
        fileResults.push({
          fileName: fileName || 'texto.txt',
          mimeType: 'text/plain',
          size: result.metadata.size,
          text: result.text,
          textLength: result.text.length,
          chunksCount: result.chunks?.length || 0,
          metadata: result.metadata,
          chunks: result.chunks,
        });
      }
      
      return NextResponse.json({
        success: true,
        mode,
        engine: 'parse_files',
        data: {
          files: fileResults,
          combinedText: fileResults.map(f => f.text || '').join('\n\n').trim(),
          totalFiles: fileResults.length,
          successfulFiles: fileResults.filter(f => !f.error).length,
          failedFiles: fileResults.filter(f => f.error).length,
        },
      });
    }

    if (mode === 'ebike') {
      // 0. Nova Rota: Pipeline Avançado com Chunking Semântico + Merge Paralelo
      // MOTOR ÚNICO: determinístico primeiro, IA só para fechar buraco.
      //
      // Este caminho NÃO roda a pipeline aqui dentro. A fila existe exatamente
      // para isso: a rota tem `maxDuration = 60` e a Hostinger derruba antes
      // disso, enquanto o pipeline com IA pode passar de um minuto. Rodar
      // inline fazia a extração determinística — que já tinha dado certo —
      // ser jogada fora junto com a resposta 504 do proxy.
      if (engine === 'unified_pipeline' || body.action === 'unified_pipeline') {
        const llmPolicy: LlmPolicy =
          body.llmPolicy === 'never' || body.llmPolicy === 'always' ? body.llmPolicy : 'gaps-only';

        // `false` aqui: o enfileiramento é o caminho principal, e o fallback
        // síncrono reintroduziria exatamente o timeout que a fila resolve.
        const job = await createJob(
          'ebike_ingest_step',
          {
            rawText: textToAnalyze,
            fileName: fileName || 'documento.txt',
            parsedData,
            llmPolicy,
          },
          auth.email || 'admin'
        );

        triggerJobExecution(job.id, { jobType: 'ebike_ingest_step' });

        console.log(
          `[LLM INGEST] Ingestão enfileirada como job ${job.id} (policy=${llmPolicy}${truncated ? ', texto truncado' : ''}).`
        );

        return NextResponse.json(
          {
            success: true,
            mode: 'ebike',
            engine: 'unified_pipeline',
            queued: true,
            jobId: job.id,
            job,
          },
          { status: 202 }
        );
      }

      // A e-bike tem UM caminho: o pipeline determinístico-primeiro acima.
      // A cascata de 5 etapas e o pipeline de 4 pings saíram daqui — o job
      // `ebike_ingest_step` também usa o pipeline, então nada mais os chamava.
      return NextResponse.json(
        {
          success: false,
          error: 'Informe engine "unified_pipeline" para e-bike.',
          errorCode: 'ENGINE_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (mode === 'article') {
      if (engine === 'llm') {
        console.log(`[LLM INGEST - GLM 5.3] Processando artigo com LLM: "${fileName || 'documento'}"`);
        const llmArticle = await processArticleIngestion(textToAnalyze, parsedData, fileName);
        return NextResponse.json({
          success: true,
          mode: 'article',
          engine: 'llm',
          data: llmArticle,
        });
      }

      // Extração 100% determinística de Artigo a partir do arquivo
      let title = parsedData?.title || parsedData?.titulo || '';
      if (!title) {
        const h1Match = textToAnalyze.match(/^#\s+(.+)$/m);
        if (h1Match) {
          title = h1Match[1].trim();
        } else {
          const firstLine = textToAnalyze.split('\n').find((l: string) => l.trim().length > 3 && !l.startsWith('---'));
          title = firstLine ? firstLine.replace(/^[#*`\s]+/, '').trim() : (fileName?.replace(/\.[^/.]+$/, '') || 'Artigo sem Título');
        }
      }

      const slug = (title || 'novo-artigo')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let excerpt = parsedData?.excerpt || parsedData?.resumo || '';
      if (!excerpt) {
        const paragraphs = textToAnalyze
          .split(/\n\s*\n/)
          .map((p: string) => p.replace(/^[#*`\-–—\s]+/, '').trim())
          .filter((p: string) => p.length > 20 && !p.startsWith('http') && !p.startsWith('!') && !p.startsWith('---'));
        excerpt = (paragraphs[0] || textToAnalyze).slice(0, 160).replace(/[#*`]/g, '').trim();
        if (excerpt.length > 157) excerpt = excerpt.slice(0, 157) + '...';
      }

      const category = parsedData?.category || parsedData?.categoria || (
        /bateria|l[íi]tio|recarga/i.test(textToAnalyze) ? 'Tecnologia & Baterias' :
        /legisla[çc][ãa]o|contran|multa/i.test(textToAnalyze) ? 'Legislação' :
        /manuten[çc][ãa]o|pneu|freio|revis/i.test(textToAnalyze) ? 'Manutenção' :
        /comparativo|vs|versus/i.test(textToAnalyze) ? 'Comparativo' :
        'Guia de Compra'
      );

      const words = textToAnalyze.trim().split(/\s+/).length;
      const readingTimeMinutes = Math.max(2, Math.min(25, Math.ceil(words / 200)));

      const tags = Array.isArray(parsedData?.tags) && parsedData.tags.length > 0
        ? parsedData.tags
        : ['E-Bikes', 'Mobilidade Urbana', 'Guia Técnico', category];

      const cleanBody = YAMLParser.cleanMarkdownArticleText(textToAnalyze);

      return NextResponse.json({
        success: true,
        mode: 'article',
        engine: 'deterministic',
        data: {
          title,
          slug,
          excerpt,
          category,
          readingTimeMinutes,
          body: cleanBody,
          tags,
          seoReport: {
            focusKeyword: title.toLowerCase(),
            serpTitlePreview: `${title} | TuaVia Mobilidade`,
            serpDescriptionPreview: excerpt,
            secondaryKeywords: tags,
            seoScore: 92,
          },
        },
      });
    }

    if (mode === 'ranking') {
      if (engine === 'llm') {
        console.log(`[LLM INGEST - GLM 5.3] Processando ranking com LLM: "${fileName || 'documento'}"`);
        const llmRanking = await processRankingIngestion(textToAnalyze, parsedData, fileName);
        return NextResponse.json({
          success: true,
          mode: 'ranking',
          engine: 'llm',
          data: llmRanking,
        });
      }

      // Extração 100% determinística de Ranking comparativo
      let titulo = parsedData?.titulo || parsedData?.title || '';
      if (!titulo) {
        const h1Match = textToAnalyze.match(/^#\s+(.+)$/m);
        titulo = h1Match ? h1Match[1].trim() : (fileName?.replace(/\.[^/.]+$/, '') || 'Ranking Comparativo de E-Bikes');
      }

      const itens: any[] = [];
      if (Array.isArray(parsedData)) {
        parsedData.forEach((row: any, idx: number) => {
          itens.push({
            posicao: idx + 1,
            tituloItem: row.modelo || row.titulo || row.name || `Item ${idx + 1}`,
            marca: row.marca || row.brand || 'Marca',
            categoriaItem: row.categoria || 'E-Bike Urbana',
            notaDestaque: idx === 0 ? 'Melhor Escolha' : idx === 1 ? 'Melhor Custo-Benefício' : 'Destaque Geral',
            pontosPositivos: [row.positivo || 'Excelente conjunto mecânico', 'Autonomia confiável'],
            pontosNegativos: [row.negativo || 'Verifique disponibilidade de estoque'],
            faixaPrecoEstimado: row.preco ? `R$ ${row.preco}` : 'Consulte',
          });
        });
      } else {
        const itemMatches = [...textToAnalyze.matchAll(/(?:^|\n)(?:(?:\d+\.|\-|\*)\s+)?([A-Za-z0-9\s\-]{3,40}?)(?:\s*[:–—\-]\s*|\s+R\$\s*)([^\n]+)/g)];
        let pos = 1;
        for (const match of itemMatches) {
          if (pos > 10) break;
          const itemName = match[1].trim();
          const itemDesc = match[2].trim();
          if (itemName.length > 2 && !itemName.toLowerCase().includes('categoria') && !itemName.toLowerCase().includes('sumário')) {
            itens.push({
              posicao: pos,
              tituloItem: itemName,
              marca: itemName.split(' ')[0] || 'Marca',
              categoriaItem: 'E-Bike Urbana',
              notaDestaque: pos === 1 ? 'Melhor Escolha Geral' : pos === 2 ? 'Melhor Custo-Benefício' : 'Destaque Técnico',
              pontosPositivos: [itemDesc || 'Conjunto equilibrado e eficiente'],
              pontosNegativos: ['Consulte disponibilidade regional'],
              faixaPrecoEstimado: itemDesc.includes('R$') ? itemDesc : 'Consulte',
            });
            pos++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'ranking',
        engine: 'deterministic',
        data: {
          titulo,
          subtitulo: parsedData?.subtitulo || 'Comparativo técnico estruturado com base nos dados do documento importado.',
          categoria: parsedData?.categoria || 'ebikes',
          criterioAvaliacao: 'Metodologia determinística: análise direta de ficha técnica, autonomia declarada e especificações do fabricante.',
          conclusaoGeral: 'Modelos classificados e organizados diretamente a partir dos dados do documento.',
          itens: itens.length > 0 ? itens : [
            {
              posicao: 1,
              tituloItem: 'Modelo Principal',
              marca: 'Marca Principal',
              categoriaItem: 'Urbana',
              notaDestaque: 'Melhor Escolha',
              pontosPositivos: ['Dados estruturados com precisão factual'],
              pontosNegativos: ['Consulte revendedor'],
              faixaPrecoEstimado: 'Sob consulta',
            },
          ],
          seoReport: {
            focusKeyword: titulo.toLowerCase(),
            serpTitlePreview: `${titulo} | Ranking TuaVia`,
            serpDescriptionPreview: `Confira o ranking técnico ${titulo} com dados factuais de autonomia, motor e custo-benefício.`,
          },
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Modo não suportado' }, { status: 400 });
  } catch (error: any) {
    console.error('[API ingest-file] Erro geral na ingestão:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao processar arquivo para ingestão', errorCode: 'INGEST_FAILED' },
      { status: 500 }
    );
  }
}

/**
 * Blueprint padronizado de especificações técnicas para E-Bikes nos 10 Blocos Canônicos.
 *//**
 * Valida se o valor de uma especificação é semanticamente coerente com o campo
 *//**
 * Normaliza e consolida as especificações técnicas nos 10 blocos oficiais.
 *//**
 * Extração Especializada com LLM: Extrai todas as informações factuais e adiciona
 * a respectiva TAG do lugar de especificação correspondente (1 a 10 + editorial + preços),
 * sem alocação forçada prévia nos formulários.
 */
/**
 * Alocador Determinístico Estrito: Mapeia as especificações etiquetadas para os 10 blocos canônicos
 */
/**
 * ETAPA 1: Estruturador em YAML Canônico & Identidade Base via LLM com Fallback Determinístico
 */
/**
 * Configuração Canônica Oficial dos 10 Blocos com Engenharia Detalhada e Prompts Expandidos
 */
const CANONICAL_BLOCK_CONFIGS = [
  {
    index: 1,
    title: '1. Resumo Rápido & Destaques',
    engineeringScope: 'Auditoria dos parâmetros executivos mais procurados por compradores e ciclistas urbanos: categoria de uso real, potência legal contínua do motor elétrico, alcance estimado por recarga, teto de velocidade assistida, peso do conjunto em ordem de marcha e limite estrutural de carga.',
    items: [
      { label: 'Uso Indicado', hint: 'Categoria de uso principal e perfil de trajeto ideal.', example: 'Urbana / Comutação Diária / Ciclovias' },
      { label: 'Potência Nominal', hint: 'Potência contínua regulamentar do motor elétrico expressa em Watts (W).', example: '350W ou 500W' },
      { label: 'Autonomia Estimada', hint: 'Alcance médio por recarga completa em ciclo misto (km).', example: 'Até 45 km ou 40 a 60 km' },
      { label: 'Velocidade Máxima', hint: 'Velocidade máxima assistida com corte de motor elétrico.', example: '25 km/h ou 32 km/h' },
      { label: 'Peso Total', hint: 'Peso total do veículo montado incluindo bateria.', example: '24.5 kg ou 27 kg' },
      { label: 'Capacidade Máxima', hint: 'Carga máxima suportada pelo conjunto chassi/rodas (ciclista + bagagem).', example: '120 kg ou 150 kg' },
    ],
    rules: `• Extraia os números reais do documento com as respectivas unidades (W, km, km/h, kg).
• Caso o documento traga uma faixa de autonomia (ex: "35 a 55 km"), declare a faixa completa para fidelidade ao consumidor.
• Nunca confunda peso da bicicleta com a capacidade máxima de carga do ciclista.`,
  },
  {
    index: 2,
    title: '2. Desempenho & Propulsão',
    engineeringScope: 'Mapeamento detalhado da planta propulsora elétrica: arquitetura e posição do motor (cubo traseiro/central/dianteiro), pico de potência transitória (Watts), torque máximo de tração em Newton-metro (Nm), número de curvas de assistência, tecnologia dos sensores de pedalada e interface do acelerador.',
    items: [
      { label: 'Tipo de Motor', hint: 'Posição no veículo, tecnologia e fabricante do motor elétrico.', example: 'Motor Brushless no Cubo Traseiro Bafang 350W' },
      { label: 'Potência de Pico', hint: 'Potência transitória de pico instantânea em Watts (W).', example: '540W ou 750W' },
      { label: 'Torque Máximo', hint: 'Força de tração mecânica do motor ESTRITAMENTE em Newton-metro (Nm). NUNCA COLOQUE WATTS AQUI!', example: '45 Nm ou 60 Nm' },
      { label: 'Níveis de Assistência', hint: 'Quantidade de níveis de assistência do pedal assistido (PAS).', example: '5 níveis de assistência (Eco, Tour, Sport, Turbo, Walk Assist)' },
      { label: 'Sensor de Pedalada', hint: 'Tecnologia do sensor de acionamento do motor ao pedalar.', example: 'Sensor de Cadência magnético 12 ímãs ou Sensor de Torque bilateral' },
      { label: 'Acelerador', hint: 'Presença, tipo e acionamento do acelerador de comando manual.', example: 'Acelerador no punho tipo gatilho/twist ou Sem acelerador (apenas pedal assistido Pedelec)' },
    ],
    rules: `• PROIBIÇÃO ABSOLUTA: NUNCA aloque o valor de potência (Watts) no campo "Torque Máximo"! Torque é exclusivamente medido em Newton-metro (Nm).
• Se o motor possuir acelerador independente de manopla ou gatilho, declare com clareza no campo "Acelerador".
• Especifique a tecnologia do sensor: Sensor de Cadência (liga ao girar o pedal) vs Sensor de Torque (responde à força aplicada no pedal).`,
  },
  {
    index: 3,
    title: '3. Bateria & Energia',
    engineeringScope: 'Auditoria do sistema de armazenamento eletroquímico: capacidade total em Watt-hora (Wh) e Ampere-hora (Ah), tensão nominal do barramento (Volts), química das células, mecanismo de remoção para recarga doméstica, tempo de abastecimento e especificações do carregador.',
    items: [
      { label: 'Capacidade Total', hint: 'Capacidade de energia total em Watt-hora (Wh). Se não constar, CALCULE: Tensão (V) * Amperagem (Ah).', example: '374 Wh ou 624 Wh' },
      { label: 'Tensão & Amperagem', hint: 'Tensão nominal do barramento e capacidade de corrente.', example: '36V 10.4Ah ou 48V 13Ah' },
      { label: 'Química da Bateria', hint: 'Composição química e tipo de células.', example: 'Íons de Lítio (Li-ion) células Samsung/LG 18650' },
      { label: 'Removível', hint: 'Possibilidade de extração da bateria para recarga fora da bicicleta.', example: 'Sim, bateria removível com trava de segurança e chave' },
      { label: 'Tempo de Recarga', hint: 'Duração estimada para carga completa de 0% a 100%.', example: '4 a 6 horas' },
      { label: 'Carregador', hint: 'Tensão de entrada, corrente de saída e padrão do carregador.', example: 'Carregador Bivolt automático 110V/220V 54.6V 2A' },
    ],
    rules: `• A Capacidade Total em Wh é calculada multiplicando a tensão nominal (V) pela capacidade em Ah (ex: 48V * 13Ah = 624 Wh).
• Especifique se a bateria possui chave para destravamento e alça para transporte até a tomada.
• Indique se o carregador aceita tomada padrão residencial bivolt brasileira.`,
  },
  {
    index: 4,
    title: '4. Conforto & Ergonomia',
    engineeringScope: 'Análise estrutural da geometria do quadro e absorção de vibrações: liga metálica empregada no chassi, dimensionamento para estatura do ciclista, garfo dianteiro com suspensão ou rígido, sistema de amortecimento traseiro, regulagens de guidão e conjunto de selim/canote.',
    items: [
      { label: 'Material do Quadro', hint: 'Liga estrutural do chassi da bicicleta.', example: 'Alumínio 6061 T6 com tratamento térmico ou Aço Carbono reforçado' },
      { label: 'Tamanho do Quadro', hint: 'Tamanho comercial do quadro e faixa de estatura recomendada.', example: 'Quadro 17" M (recomendado para 1,65m a 1,80m) ou Tamanho Único' },
      { label: 'Suspensão Dianteira', hint: 'Tipo de garfo dianteiro, curso de amortecimento e trava.', example: 'Garfo com suspensão Suntour 80mm com trava ou Garfo rígido em alumínio' },
      { label: 'Suspensão Traseira', hint: 'Presença e tipo de shock ou amortecedor traseiro.', example: 'Duplo amortecedor traseiro helicoidal com mola ou Rígida (Hardtail)' },
      { label: 'Ajuste de Guidão', hint: 'Possibilidade de ajuste de altura ou inclinação da mesa/guidão.', example: 'Mesa de guidão ajustável em ângulo de 0° a 60° sem chave ou Mesa fixa' },
      { label: 'Selim & Canote', hint: 'Modelo do selim ergonômico e tipo de canote.', example: 'Selim ergonômico em gel com elastômeros e canote com amortecimento 27.2mm' },
    ],
    rules: `• PROIBIÇÃO CRÍTICA: NUNCA coloque o material do quadro ("Aço", "Alumínio") nos campos "Ajuste de Guidão" ou "Selim & Canote".
• Se o documento citar suspensão dupla (dianteira e traseira), separe claramente o Garfo Dianteiro no campo dianteiro e o Shock/Amortecedor no campo traseiro.
• Especifique se há curso de amortecimento em milímetros (ex: 80mm, 100mm).`,
  },
  {
    index: 5,
    title: '5. Segurança & Frenagem',
    engineeringScope: 'Auditoria dos dispositivos de segurança ativa e desaceleração: tecnologia de freio dianteiro e traseiro (disco hidráulico vs mecânico a cabo), sensores eletrônicos de corte de motor nos manetes (e-brake cutoff), sistema de iluminação dianteira e traseira alimentada e sinalização sonora.',
    items: [
      { label: 'Freio Dianteiro', hint: 'Sistema de freio dianteiro, acionamento e diâmetro do rotor.', example: 'Freio a Disco Hidráulico Shimano MT200 com rotor de 160mm' },
      { label: 'Freio Traseiro', hint: 'Sistema de freio traseiro, acionamento e diâmetro do rotor.', example: 'Freio a Disco Hidráulico com rotor de 160mm' },
      { label: 'Corte de Motor nos Freios', hint: 'Presença de microswitches que desativam o motor ao puxar o manete.', example: 'Sim, manetes equipados com sensor de corte eletrônico do motor (e-brake cutoff)' },
      { label: 'Iluminação Dianteira', hint: 'Farol dianteiro e fonte de alimentação.', example: 'Farol dianteiro LED integrado alimentado pela bateria principal' },
      { label: 'Iluminação Traseira', hint: 'Lanterna traseira e funções de segurança.', example: 'Lanterna traseira LED com luz de freio integrada (brake light)' },
      { label: 'Refletores & Buzina', hint: 'Dispositivos de sinalização acústica e refletiva.', example: 'Buzina elétrica no guidão + refletores nas rodas e pedais' },
    ],
    rules: `• PROIBIÇÃO ABSOLUTA: NUNCA responda apenas "dianteiro" ou "traseiro" em iluminação! Especifique "Farol LED potente" ou "Lanterna LED integrada com luz de freio".
• Verifique se os manetes cortam eletricamente o motor ao serem acionados, recurso fundamental em e-bikes potentes.
• Diferencie freios hidráulicos (fluido de óleo mineral) de freios mecânicos acionados por cabo de aço.`,
  },
  {
    index: 6,
    title: '6. Transmissão & Ciclística',
    engineeringScope: 'Mapeamento do trem de transmissão mecânica analógica: modelo de câmbio traseiro, quantidade de velocidades da marcha mecânica, trocadores/alavancas de acionamento, pedivela, coroa de tração e tipo de pedais.',
    items: [
      { label: 'Câmbio Traseiro', hint: 'Fabricante e linha do câmbio mecânico traseiro.', example: 'Shimano Tourney TY300 7v ou Shimano Altus ou Single-Speed' },
      { label: 'Número de Marchas', hint: 'Quantidade total de marchas mecânicas acionadas pelo ciclista.', example: '7 marchas (1x7) ou 8 marchas ou 1 velocidade (Single-Speed)' },
      { label: 'Passadores / Trocadores', hint: 'Tipo de manete de troca de marcha no guidão.', example: 'Shimano Revoshift tipo twist ou Shimano RapidFire tipo gatilho' },
      { label: 'Corrente & Pedivela', hint: 'Conjunto de pedivela, coroa e proteção antiferrugem.', example: 'Pedivela em alumínio 48D com protetor duplo de corrente' },
      { label: 'Pedais', hint: 'Tipo de pedais e mecanismos de dobragem ou aderência.', example: 'Pedais plataforma em alumínio antiderrapantes com refletores ou Pedais dobráveis' },
    ],
    rules: `• Se a bicicleta não possuir câmbio mecânico de marchas, declare obrigatoriamente: "1 velocidade (Single-Speed / Relação Direta)".
• Identifique a marca e série do componente (ex: Shimano Tourney, Shimano Altus, Shimano Deore, SRAM, SunRace, Microshift).
• Verifique se os pedais são dobráveis em modelos compactos/dobráveis.`,
  },
  {
    index: 7,
    title: '7. Dimensões, Rodas & Pneus',
    engineeringScope: 'Dimensionamento do rodado e geometria de transporte: diâmetro do aro, largura e bitola nominal dos pneus em polegadas, perfil do desenho de rodagem, sistema de dobradiças para transporte e medidas externas da bicicleta em ordem de marcha e dobrada.',
    items: [
      { label: 'Aro / Rodas', hint: 'Diâmetro do aro, material da roda e raios.', example: 'Aro 20" em alumínio com parede dupla reforçada 36 furos ou Aro 29"' },
      { label: 'Medida dos Pneus', hint: 'Medida completa do pneu com largura em polegadas.', example: '20" x 3.0" ou 20" x 4.0" (Fat Tire) ou 29" x 2.10"' },
      { label: 'Tipo de Pneu', hint: 'Perfil, composto e tipo de banda de rodagem do pneu.', example: 'Pneu Urbano Balão de alto volume com proteção antifuro ou Fat Bike All-Terrain' },
      { label: 'Dobrável', hint: 'Presença e características do sistema de dobragem.', example: 'Sim, dobrável central no quadro e guidão retrátil; ou Não, quadro rígido convencional' },
      { label: 'Dimensões (CxLxA)', hint: 'Comprimento, largura e altura com a bicicleta montada.', example: '165 x 65 x 105 cm ou 178 x 68 x 110 cm' },
      { label: 'Dimensões Dobrada', hint: 'Medidas compactadas após fechamento das dobradiças.', example: '85 x 45 x 75 cm ou Não aplicável (Quadro rígido)' },
    ],
    rules: `• PROIBIÇÃO CRÍTICA: NUNCA responda apenas "Borracha" para o "Tipo de Pneu"! Descreva o perfil funcional (ex: Pneu Urbano Balão com proteção antifuro).
• Na "Medida dos Pneus", inclua obrigatoriamente a largura (ex: 20" x 3.0" ou 26" x 2.125"), nunca apenas "Aro 20".
• Se for um modelo não-dobrável de quadro rígido, preencha "Dimensões Dobrada" como "Não aplicável (Quadro rígido)".`,
  },
  {
    index: 8,
    title: '8. Equipamentos & Conectividade',
    engineeringScope: 'Auditoria de conveniência, telemetria e acessórios urbanos de fábrica: tipo de display/computador de bordo no guidão, portas USB para recarga de smartphone, conectividade Bluetooth e aplicativo dedicado, capacidade de carga do bagageiro e equipamentos de proteção viária.',
    items: [
      { label: 'Painel / Display', hint: 'Tipo de display, tamanho de tela e informações fornecidas.', example: 'Painel LCD digital multifunção com velocímetro, odômetro e nível de bateria' },
      { label: 'Entrada USB', hint: 'Presença de porta USB para carregamento de celular em trânsito.', example: 'Sim, porta USB 5V 1A integrada ao painel; ou Não possui entrada USB' },
      { label: 'Aplicativo / Bluetooth', hint: 'Conexão sem fio com smartphone e funções do app.', example: 'Conexão Bluetooth com aplicativo iOS/Android para controle e trava digital; ou Não possui' },
      { label: 'Bagageiro / Rack', hint: 'Presença, material e capacidade de carga útil do bagageiro traseiro.', example: 'Bagageiro traseiro integrado em alumínio com capacidade para até 25 kg' },
      { label: 'Paralamas & Cavalete', hint: 'Proteção contra poças e lama e tipo de apoio para estacionamento.', example: 'Paralamas dianteiro e traseiro envolventes + cavalete lateral reforçado' },
    ],
    rules: `• Audite a presença de porta USB no display, muito valorizada por ciclistas que utilizam GPS ou entregadores de aplicativo.
• Se o bagageiro vier instalado de fábrica, informe a capacidade de carga declarada em kg (ex: 25 kg).
• Verifique se os paralamas são integrais e se o descanso é lateral ou central.`,
  },
  {
    index: 9,
    title: '9. Compatibilidade & Manutenção',
    engineeringScope: 'Auditoria de sustentabilidade operacional no mercado brasileiro: facilidade de substituição do pack de bateria, padronização de peças com oficinas de bicicleta comuns, grau de proteção contra chuva (IP rating), prazos de garantia oficial e disponibilidade de manual em português e suporte local.',
    items: [
      { label: 'Bateria Reposição / Padrão', hint: 'Padrão de gabinete e disponibilidade de refil de bateria no Brasil.', example: 'Bateria em gabinete padrão com facilidade de reposição no mercado nacional' },
      { label: 'Padrão de Peças Ciclísticas', hint: 'Compatibilidade com peças universais em bicicletarias comuns.', example: 'Componentes mecânicos de padrão universal (freios, correntes, câmbios) compatíveis com oficinas em todo o Brasil' },
      { label: 'Resistência à Água', hint: 'Grau de proteção contra respingos, poeira e chuva forte.', example: 'Certificação IPX4 / IP54 (resistente a respingos e chuvas leves/moderadas)' },
      { label: 'Garantia de Fábrica', hint: 'Prazos de cobertura para quadro, motor e bateria no Brasil.', example: '12 meses para quadro e motor; 6 meses para bateria' },
      { label: 'Manual & Suporte Nacional', hint: 'Documentação oficial em língua portuguesa e rede de assistência.', example: 'Manual completo em português e rede de suporte técnico autorizada no Brasil' },
    ],
    rules: `• Se o documento citar prazo de garantia (ex: 1 ano para o chassi, 6 meses para bateria), registre expressamente.
• Indique o índice de proteção contra água (IPX4, IPX5, IP54 ou similar), alertando sobre cuidados com imersão.
• Confirme a compatibilidade com oficinas de bike locais.`,
  },
  {
    index: 10,
    title: '10. Auditoria de Fontes & Dados',
    engineeringScope: 'Conformidade regulatória e auditoria forense do registro: enquadramento formal perante a Resolução CONTRAN 996/2023 brasileira (Bicicleta Elétrica vs Autopropelido vs Ciclomotor Elétrico), documentação de origem, validação metrológica e data de revisão.',
    items: [
      { label: 'Enquadramento CONTRAN', hint: 'Classificação oficial estrita segundo a Resolução CONTRAN 996/2023.', example: 'Bicicleta Elétrica (isenta de CNH, placa e IPVA - até 32 km/h e 1000W com pedal assistido)' },
      { label: 'Fonte Oficial dos Dados', hint: 'Origem primária das informações técnicas analisadas.', example: 'Catálogo oficial de especificações técnicas do fabricante e manual do usuário' },
      { label: 'Status da Ficha Técnica', hint: 'Situação de auditoria da ficha cadastral.', example: 'Auditada e Padronizada pelo Sistema de Homologação TuaVia' },
      { label: 'Última Revisão Técnica', hint: 'Data da última auditoria e validação das especificações.', example: new Date().toLocaleDateString('pt-BR') },
    ],
    rules: `• REGRA DE ENQUADRAMENTO CONTRAN 996/2023:
  - Bicicleta Elétrica: até 1000W, velocidade máxima com motor até 32 km/h, sem acelerador manual (ou acelerador limitado a 32km/h sem ultrapassar pedal assistido), dispensando CNH/ACC e emplacamento.
  - Equipamento de Mobilidade Individual Autopropelido: até 1000W, velocidade até 32 km/h em ciclovias/ciclofaixas.
  - Ciclomotor Elétrico: potência acima de 1000W ou velocidade assistida até 50 km/h com acelerador puro, exigindo ACC ou CNH categoria A, emplacamento e capacete de motociclista.
• Sempre vincule a classificação com a legislação de trânsito em vigor no território nacional brasileiro.`,
  },
];

/**
 * Executa a chamada LLM focada em um único bloco de especificações com Prompt Expandido e Documento Completo
 */
async function callBlockLLMInternal(
  blockIndex: number,
  blockTitle: string,
  itemsToExtract: { label: string; hint: string; example?: string }[],
  rules: string,
  docFull: string,
  mergedIdentity: any,
  chain: any,
  deterministic: any
): Promise<{ title: string; items: any[] }> {
  const config = CANONICAL_BLOCK_CONFIGS.find((c) => c.index === blockIndex);
  const engineeringScope = config?.engineeringScope || 'Auditoria técnica e extração rigorosa de dados de componentes.';

  const prompt = `======================================================================
AUDITORIA TÉCNICA E HOMOLOGAÇÃO DE E-BIKES — PING EXCLUSIVO BLOCO ${blockIndex}
SEÇÃO TÉCNICA: "${blockTitle.toUpperCase()}"
======================================================================
Você é o Engenheiro Chefe de Homologação Veicular e Micromobilidade Elétrica do portal TuaVia Brasil.
Sua função exclusiva nesta chamada é auditar e extrair os dados técnicos do BLOCO ${blockIndex} ("${blockTitle}").
NENHUM OUTRO BLOCO DEVE SER PROCESSADO NESTE PING. DEDIQUE 100% DA SUA CAPACIDADE COGNITIVA E RIGOR METROLÓGICO A ESTES CAMPOS.

----------------------------------------------------------------------
1. IDENTIDADE CONFIRMADA DO VEÍCULO EM ANÁLISE:
----------------------------------------------------------------------
- Marca: ${mergedIdentity.marca || 'Não informada'}
- Modelo: ${mergedIdentity.modelo || 'Não informado'}
- Ano/Versão: ${mergedIdentity.anoModelo || '2026'}
- Categoria Operacional: ${mergedIdentity.usoPrincipal || 'Urbana'}
- Potência Nominal Base: ${mergedIdentity.potenciaW || 'Não informada'} W
- Tensão do Sistema: ${mergedIdentity.tensaoV || 'Não informada'} V
- Capacidade Energética Declarada: ${mergedIdentity.capacidadeBateriaWh || 'Não informada'} Wh (${mergedIdentity.amperagemAh || 'Não informada'} Ah)

----------------------------------------------------------------------
2. ESCOPO DE ENGENHARIA DESTE BLOCO:
----------------------------------------------------------------------
${engineeringScope}

----------------------------------------------------------------------
3. CAMPOS ESPECÍFICOS A EXTRAIR (CAMPOS CANÔNICOS OBRIGATÓRIOS):
----------------------------------------------------------------------
${itemsToExtract
  .map(
    (it, idx) => `[CAMPO ${idx + 1}] "${it.label}"
  • Diretriz Técnica: ${it.hint}
  • Padrão e Exemplo Esperado: ${it.example || 'Valor técnico preciso com respectiva unidade de medida'}`
  )
  .join('\n\n')}

----------------------------------------------------------------------
4. REGRAS TÉCNICAS E METODOLOGIA OPERACIONAL (LEI ABSOLUTA):
----------------------------------------------------------------------
${rules}
- REGRA DE OURO DA VERACIDADE: Leia minuciosamente cada linha da ficha técnica bruta integral fornecida abaixo. Se a especificação estiver presente (seja no texto corrido, tabelas, notas de rodapé ou descrições comerciais), capture-a com exatidão técnica e fidelidade aos componentes oficiais.
- REGRA DE NÃO-ALUCINAÇÃO E AUSÊNCIA DE DADOS: Se um campo realmente NÃO constar e não for dedutível de maneira matematicamente comprovada a partir dos dados do documento, responda OBRIGATORIAMENTE:
  "value": "Não informado pelo fabricante", "confidence": "NAO_CONFIRMADA", "status": "NAO_INFORMADO"
  NUNCA INVENTE MARCAS, MODELOS OU MEDIDAS.
- ISOLAMENTO SEMÂNTICO: Nunca vaze materiais de um campo para outro. Por exemplo, se o chassi for em aço ou alumínio, isso NÃO significa que a manopla ou o selim sejam de aço ou alumínio.
- PADRÃO BRASILEIRO: Utilize unidades do Sistema Internacional e convenções brasileiras (km, km/h, Watts, Nm, V, Ah, Wh, kg, mm, polegadas ").

----------------------------------------------------------------------
5. FICHA TÉCNICA BRUTA INTEGRAL DO FABRICANTE (TEXTO COMPLETO):
----------------------------------------------------------------------
"""
${docFull}
"""

----------------------------------------------------------------------
6. FORMATO DE SAÍDA EXCLUSIVO (JSON ARRAY PURO):
----------------------------------------------------------------------
Responda EXCLUSIVAMENTE com o array JSON a seguir, sem crases de markdown adicionais, sem texto antes ou depois:
[
${itemsToExtract.map((it) => `  { "label": "${it.label}", "value": "...", "confidence": "ALTA", "status": "CONFIRMADO" }`).join(',\n')}
]`;

  try {
    const res = await ProviderHub.executeWithFallback({
      taskName: `ebike_block_${blockIndex}`,
      primaryModel: chain.primary,
      fallbackModel: chain.fallback,
      tertiaryModel: chain.tertiary,
      messages: [
        {
          role: 'system',
          content: `Você é um engenheiro mecânico rigoroso e auditor metrológico. Responda exclusivamente com um JSON array de objetos contendo "label", "value", "confidence", "status".`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 2500,
      timeoutMs: 40000,
    });

    const parsed = YAMLParser.parse(res.text || '');
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleanItems = parsed.map((it: any) => ({
        label: String(it.label || '').trim(),
        value: cleanSpecValue(String(it.value || '').trim()),
        confidence: it.confidence || 'ALTA',
        status: it.status || 'CONFIRMADO',
        source: 'Ficha Técnica',
      }));
      return { title: blockTitle, items: cleanItems };
    }
  } catch (err) {
    console.warn(`[LLM INGEST] Ping do Bloco ${blockIndex} ("${blockTitle}") falhou, usando fallback:`, err);
  }

  // Fallback determinístico para este bloco
  const fallbackSection = deterministic?.specSections?.find((s: any) => s.title?.includes(String(blockIndex)));
  return {
    title: blockTitle,
    items: fallbackSection?.items || itemsToExtract.map((it) => ({
      label: it.label,
      value: 'Não informado pelo fabricante',
      confidence: 'NAO_CONFIRMADA',
      status: 'NAO_INFORMADO',
      source: '',
    })),
  };
}

/**
 * Extrator dedicado do Veredito Editorial com Prompt Expandido e Documento Completo
 */
async function extractEditorialLLMInternal(
  docFull: string,
  mergedIdentity: any,
  chain: any,
  deterministic: any
): Promise<any> {
  const editorialPrompt = `======================================================================
AVALIAÇÃO EDITORIAL CRÍTICA E ANÁLISE DE MERCADO — E-BIKES BRASIL 2026
PORTAL TUAVIA — PING EXCLUSIVO DE VEREDITO TÉCNICO
======================================================================
Você é o Editor Técnico Sênior e Diretor de Testes do portal TuaVia (jornalista automotivo com formação em engenharia mecânica e mais de 15 anos avaliando veículos elétricos leves nas cidades brasileiras).
Sua missão neste ping é produzir a ANÁLISE EDITORIAL COMPLETA, CRÍTICA, HONESTA E SEM VIÉS COMERCIAL da E-Bike avaliada.

----------------------------------------------------------------------
1. IDENTIDADE E DADOS TÉCNICOS VERIFICADOS DO VEÍCULO:
----------------------------------------------------------------------
- Marca: ${mergedIdentity.marca}
- Modelo: ${mergedIdentity.modelo}
- Categoria: ${mergedIdentity.usoPrincipal}
- Potência Nominal: ${mergedIdentity.potenciaW}W
- Autonomia Declarada: ${mergedIdentity.autonomiaKm} km
- Peso Total: ${mergedIdentity.pesoKg} kg
- Bateria: ${mergedIdentity.capacidadeBateriaWh || 'Não informada'} Wh (${mergedIdentity.tensaoV || 36}V ${mergedIdentity.amperagemAh || 10.4}Ah)
- Tempo de Recarga: ${mergedIdentity.tempoCargaHoras || 5} horas

----------------------------------------------------------------------
2. RUBRICA EDITORIAL E CRITÉRIOS DE AVALIAÇÃO OBRIGATÓRIOS:
----------------------------------------------------------------------
Sua análise deve avaliar de forma aprofundada:
1. COMPORTAMENTO EM SUBIDAS E ACLIVES: Avalie se a potência (${mergedIdentity.potenciaW}W) e o torque são suficientes para encarar as ladeiras comuns das cidades brasileiras ou se exigirá esforço vigoroso do ciclista.
2. AUTONOMIA NA VIDA REAL: Confronte a autonomia declarada de catálogo com a realidade de tráfego pesado brasileiro (ciclista com peso real, paradas e arrancadas constantes em semáforos, asfalto irregular).
3. CONFORTO, CICLÍSTICA E SEGURANÇA: Analise a absorção de impactos (suspensão e pneus), ergonomia do guidão e eficiência do sistema de freios para paradas seguras no trânsito.
4. CUSTO-BENEFÍCIO E MANUTENÇÃO: Avalie a disponibilidade de peças no Brasil (Shimano vs genéricos, células da bateria, suporte nacional).
5. PONTOS FORTES (PRÓS) E PONTOS FRACOS (CONTRAS): Liste 3 a 4 vantagens técnicas legítimas e 2 a 3 pontos de atenção ou desvantagens reais (como peso elevado, ausência de suspensão ou trocador simples). Seja 100% sincero e útil para o consumidor.
6. PERFIL DE USO RECOMENDADO: Defina com precisão quem deve comprar este modelo e para quem ele NÃO é recomendado.

----------------------------------------------------------------------
3. DOCUMENTO ORIGINAL COMPLETO DA FICHA TÉCNICA:
----------------------------------------------------------------------
"""
${docFull}
"""

----------------------------------------------------------------------
4. FORMATO DE SAÍDA EXCLUSIVO (JSON PURO):
----------------------------------------------------------------------
Gere EXCLUSIVAMENTE o JSON a seguir, sem crases de markdown ou qualquer outro texto:
{
  "resumoExecutivo": "Parágrafo jornalístico denso (4 a 6 linhas) com veredito técnico completo sobre a proposta do veículo no mercado nacional...",
  "idealFor": "Descrição detalhada do ciclista e das rotas ideais para este modelo...",
  "badge": "${mergedIdentity.usoPrincipal === 'Dobrável' ? '🌟 Destaque Dobrável 2026' : mergedIdentity.potenciaW >= 1000 ? '⚡ Alta Potência Urbana 2026' : '🏆 Custo-Benefício 2026'}",
  "pros": [
    "Pró técnico real 1 baseado nos componentes verificados",
    "Pró técnico real 2",
    "Pró técnico real 3",
    "Pró técnico real 4"
  ],
  "cons": [
    "Contra ou ponto de atenção técnico honesto 1",
    "Contra ou ponto de atenção técnico honesto 2",
    "Contra ou ponto de atenção técnico honesto 3"
  ]
}`;

  try {
    const res = await ProviderHub.executeWithFallback({
      taskName: 'ebike_editorial_verdict',
      primaryModel: chain.primary,
      fallbackModel: chain.fallback,
      tertiaryModel: chain.tertiary,
      messages: [
        { role: 'system', content: 'Você é um jornalista automotivo e ciclista especialista. Responda exclusivamente com JSON puro válido.' },
        { role: 'user', content: editorialPrompt },
      ],
      temperature: 0.2,
      maxTokens: 2000,
      timeoutMs: 40000,
    });

    const parsed = YAMLParser.parse(res.text || '');
    const editorial = parsed as { resumoExecutivo?: unknown; pros?: unknown } | null;
    if (editorial && (editorial.resumoExecutivo || editorial.pros)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[LLM INGEST] Ping do Veredito Editorial falhou, usando fallback:', err);
  }
  return deterministic?.editorial || null;
}

/**
 * Executa o Ping Exclusivo de um Único Bloco ou Editorial (Para Feedback Visual em Tempo Real)
 */
/**
 * ETAPA 2: Distribuição nos 10 Blocos Canônicos com Pings ESTRITAMENTE SEQUENCIAIS & Veredito Editorial
 * Nenhum bloco roda simultaneamente: cada um executa isolado, de forma única e sequencial.
 */
/**
 * ETAPA 3: Gráfico de Histórico de Preços (CONDICIONAL) via LLM com Fallback Determinístico
 * Se no arquivo houver dados/histórico de preços antigos (3 a 6 meses), extrai o gráfico.
 * Se NÃO houver dados de histórico no arquivo, o bloco de gráfico NÃO É CRIADO (retorna vazio).
 */
/**
 * PING DA LLM: SEO Perfeito Google Brasil 2026
 * Utiliza todo o contexto do arquivo e das etapas anteriores para montar o SEO definitivo.
 */
/**
 * Executa o pipeline de 4 pings sequencialmente para E-Bikes
 */
/**
 * Ingestão inteligente para Artigos
 */
async function processArticleIngestion(rawText: string, parsedData: any, fileName?: string) {
  const prompt = `Você é o Editor Chefe de Conteúdo do portal TuaVia.
Sua missão é analisar o documento (${fileName || 'documento'}), extrair o conteúdo completo e estruturar um Artigo profissional em Markdown com SEO 2026 de alto impacto.

CONTEÚDO DO ARQUIVO:
"""
${rawText.slice(0, 20000)}
"""

${parsedData ? `METADADOS PRÉ-EXTRAÍDOS:\n${JSON.stringify(parsedData, null, 2).slice(0, 3000)}` : ''}

REGRAS:
1. "title": Título persuasivo com até 75 caracteres.
2. "slug": Slug em kebab-case.
3. "excerpt": Resumo de 2 a 3 linhas (140-160 caracteres).
4. "category": "Guia de Compra", "Manutenção", "Legislação", "Notícias", "Comparativo", "Economia & Mobilidade", "Tecnologia & Baterias".
5. "readingTimeMinutes": Número inteiro (3-15).
6. "body": Markdown completo bem formatado com seções (## e ###).
7. "relatedBikeCategories": Array (ex: ["Urbana"]).
8. "tags": Array com 4 a 8 tags.
9. "seoReport": { focusKeyword, serpTitlePreview, serpDescriptionPreview, secondaryKeywords }.

GERE EXCLUSIVAMENTE UM JSON VÁLIDO:
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "category": "Guia de Compra",
  "readingTimeMinutes": 6,
  "body": "## Introdução\\n\\nTexto completo...",
  "relatedBikeCategories": ["Urbana"],
  "tags": ["Guia", "E-Bikes"],
  "seoReport": {
    "focusKeyword": "...",
    "serpTitlePreview": "...",
    "serpDescriptionPreview": "...",
    "secondaryKeywords": ["..."]
  }
}`;

  let parsed: any = {};
  const chainArticle = AIRouter.getModelChain('article_file_ingest');
  try {
    const aiRes = await ProviderHub.executeWithFallback({
      taskName: 'article_file_ingest',
      primaryModel: chainArticle.primary,
      fallbackModel: chainArticle.fallback,
      tertiaryModel: chainArticle.tertiary,
      messages: [
        {
          role: 'system',
          content: 'Você é um editor de conteúdo experiente. Responda exclusivamente com JSON puro válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 3000,
      timeoutMs: 30000,
    });

    parsed = YAMLParser.parse(aiRes.text || '') || {};
  } catch (err) {
    console.warn('[API ingest-file] LLM falhou no artigo, usando fallback heurístico:', err);
    parsed = {
      title: parsedData?.title || parsedData?.titulo || fileName?.replace(/\.[^/.]+$/, '') || 'Novo Artigo',
      slug: (parsedData?.title || fileName || 'novo-artigo')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      excerpt: parsedData?.excerpt || parsedData?.resumo || rawText.slice(0, 160).replace(/[#*`]/g, '').trim(),
      category: parsedData?.category || parsedData?.categoria || 'Guia de Compra',
      readingTimeMinutes: Math.max(3, Math.min(15, Math.ceil(rawText.split(/\s+/).length / 200))),
      body: rawText,
      tags: Array.isArray(parsedData?.tags) ? parsedData.tags : ['E-Bikes', 'Guia', 'Mobilidade'],
    };
  }

  if (parsed.body) {
    parsed.body = YAMLParser.cleanMarkdownArticleText(parsed.body);
  } else if (rawText) {
    parsed.body = YAMLParser.cleanMarkdownArticleText(rawText);
  }

  return parsed;
}

/**
 * Ingestão inteligente para Top Rankings
 */
async function processRankingIngestion(rawText: string, parsedData: any, fileName?: string) {
  const prompt = `Você é o Coordenador Técnico de Testes e Rankings do TuaVia.
Sua missão é analisar o arquivo (${fileName || 'documento'}), extrair a lista comparativa e estruturar a ficha de TOP RANKING.

CONTEÚDO:
"""
${rawText.slice(0, 20000)}
"""

GERE EXCLUSIVAMENTE UM JSON VÁLIDO:
{
  "titulo": "Top 5 Melhores E-Bikes Urbanas de 2026",
  "subtitulo": "Comparativo técnico estruturado.",
  "categoria": "ebikes",
  "criterioAvaliacao": "Metodologia...",
  "conclusaoGeral": "Conclusão...",
  "itens": [
    {
      "posicao": 1,
      "tituloItem": "Modelo 1",
      "marca": "Marca",
      "categoriaItem": "E-Bike Urbana",
      "notaDestaque": "Melhor Escolha 2026",
      "pontosPositivos": ["Autonomia comprovada"],
      "pontosNegativos": ["Tempo de recarga 6h"],
      "especificacoes": { "Motor": "350W", "Autonomia": "45km" },
      "faixaPrecoEstimado": "R$ 4.200",
      "lojas": [{ "nomeLoja": "Mercado Livre", "preco": 4200, "url": "", "destaque": true }]
    }
  ],
  "seoReport": {
    "focusKeyword": "melhores ebikes urbanas 2026",
    "serpTitlePreview": "Top 5 Melhores E-Bikes Urbanas de 2026",
    "serpDescriptionPreview": "Confira nosso comparativo..."
  }
}`;

  let parsed: any = {};
  const chainRanking = AIRouter.getModelChain('ranking_generation');
  try {
    const aiRes = await ProviderHub.executeWithFallback({
      taskName: 'ranking_file_ingest',
      primaryModel: chainRanking.primary,
      fallbackModel: chainRanking.fallback,
      tertiaryModel: chainRanking.tertiary,
      messages: [
        {
          role: 'system',
          content: 'Você é um avaliador de rankings. Responda exclusivamente com JSON puro válido.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 3500,
      timeoutMs: 30000,
    });

    parsed = YAMLParser.parse(aiRes.text || '') || {};
  } catch (err) {
    console.warn('[API ingest-file] LLM falhou no ranking, usando fallback:', err);
    parsed = {
      titulo: parsedData?.titulo || fileName?.replace(/\.[^/.]+$/, '') || 'Ranking Especial',
      subtitulo: parsedData?.subtitulo || 'Comparativo técnico estruturado.',
      categoria: parsedData?.categoria || 'ebikes',
      criterioAvaliacao: 'Avaliação técnica baseada nos dados importados.',
      itens: Array.isArray(parsedData)
        ? parsedData.map((row: any, idx: number) => ({
            posicao: idx + 1,
            tituloItem: row.modelo || row.titulo || `Item ${idx + 1}`,
            marca: row.marca || 'Marca',
            categoriaItem: row.categoria || 'E-Bike Urbana',
            notaDestaque: idx === 0 ? 'Melhor Escolha' : 'Destaque Custo-Benefício',
            pontosPositivos: ['Boa autonomia'],
            pontosNegativos: ['Consulte revendedor'],
            faixaPrecoEstimado: row.preco ? `R$ ${row.preco}` : 'Consulte',
          }))
        : [],
    };
  }

  return parsed;
}
