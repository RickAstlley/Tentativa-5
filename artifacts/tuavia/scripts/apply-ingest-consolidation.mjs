#!/usr/bin/env node
/**
 * scripts/apply-ingest-consolidation.mjs
 *
 * Patch cirúrgico do `FileIngestionDropzone.tsx`.
 *
 * O arquivo tem ~1800 linhas de JSX com fragmentos aninhados; editar por
 * substituição de texto quebra o balanceamento. Este script faz as três
 * mudanças de forma determinística e verificável:
 *
 *   1. remove o IngestorV2 (módulo que nunca existiu) e o bridge dele;
 *   2. troca as 757 linhas da extração via LLM pelo pipeline unificado;
 *   3. adiciona o toggle de política de IA como bloco IRMÃO — nunca dentro da
 *      expressão `{mode === 'ebike' && ( ... )}`, que aceita um único filho.
 *
 * Cada passo é idempotente: rodar duas vezes não muda nada.
 */

import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'components', 'admin', 'FileIngestionDropzone.tsx');

const read = () => fs.readFileSync(FILE, 'utf-8');
const write = (content) => fs.writeFileSync(FILE, content);

/* ─────────────────── passo 1: fora o IngestorV2 ─────────────────── */

function removeIngestorV2(content) {
  if (!content.includes('IngestorV2')) return content;

  let lines = content.split('\n');

  // 1a. import
  lines = lines.filter((line) => !line.includes("from '@/components/admin/create/v2/IngestorV2'"));

  // 1b. bloco de render + comentário de cabeçalho
  const renderStart = lines.findIndex((line) => line.includes('<IngestorV2'));
  if (renderStart !== -1) {
    let renderEnd = renderStart;
    while (renderEnd < lines.length && lines[renderEnd].trim() !== '/>') renderEnd += 1;

    let from = renderStart;
    for (let i = renderStart; i > 0; i -= 1) {
      if (lines[i].includes('INGESTOR V2')) {
        from = i;
        break;
      }
    }
    if (from > 0 && lines[from - 1].includes('{/* ===')) from -= 1;

    let to = renderEnd;
    if (to + 1 < lines.length && lines[to + 1].trim() === '') to += 1;
    lines.splice(from, to - from + 1);
  }

  // 1c. bridge handleParsedText (useCallback) — morre sem o IngestorV2
  const bridgeStart = lines.findIndex((line) => line.includes('Bridge do IngestorV2'));
  if (bridgeStart !== -1) {
    const declStart = lines.findIndex(
      (line, i) => i > bridgeStart && line.includes('const handleParsedText = useCallback(')
    );
    if (declStart !== -1) {
      // Âncora estrutural: o fim é a linha `  );`cuja próxima linha não-vazia
      // começa uma nova declaração de topo (`  const ...`). Balanceamento de
      // parênteses e busca textual falham aqui — o corpo tem `  );` de
      // desestruturação e `useCallback(` aninhado.
      let declEnd = -1;
      for (let i = declStart + 1; i < lines.length; i += 1) {
        if (lines[i] !== '  );') continue;
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j += 1;
        if (j < lines.length && /^  (const|let|function|\/\*)/.test(lines[j])) {
          declEnd = i;
          break;
        }
      }
      if (declEnd === -1) throw new Error('fechamento de handleParsedText não encontrado');

      // Remove o docblock acima, tolerando linha em branco entre o '*/' e a
      // declaração. Sem isso o '/**' fica órfão e engole o resto do arquivo.
      let from = declStart;
      let probe = declStart - 1;
      while (probe >= 0 && lines[probe].trim() === '') probe -= 1;
      if (probe >= 0 && lines[probe].trim() === '*/') {
        // O '*/' fecha um docblock de N linhas: sobe até o '/**' de verdade.
        from = probe;
        while (from > 0 && !lines[from].trim().startsWith('/**')) from -= 1;
      }
      while (from > 0 && lines[from - 1].trim().startsWith('//')) from -= 1;

      let to = declEnd;
      if (to + 1 < lines.length && lines[to + 1].trim() === '') to += 1;
      lines.splice(from, to - from + 1);
    }
  }

  return lines.join('\n');
}

/* ───────────── passo 2: extração via LLM → pipeline ───────────── */

const UNIFIED_HANDLER = `  /**
   * Extração de e-bike: pipeline determinístico primeiro, IA só para fechar
   * buraco.
   *
   * Substitui as 4 etapas em cascata (tags -> identidade -> 10 blocos em
   * paralelo -> veredito -> SEO), que faziam 10 chamadas de IA por arquivo e
   * distribuíam mal o resultado entre as seções.
   *
   * O progresso dos 10 blocos canônicos vem do resultado real do pipeline,
   * não de animação.
   */
  const handleRunUnifiedExtraction = async (cacheData?: ExtractionCacheData) => {
    const targetCache = cacheData || currentCache;
    const rawText = targetCache?.rawText || ingestedPayload?.rawText || '';
    const fileName = targetCache?.fileName || ingestedPayload?.fileName || 'documento.txt';

    if (!rawText || rawText.trim().length === 0) {
      setErrorMessage('Nenhum arquivo anexado. Arraste ou selecione um arquivo antes de extrair as informações.');
      return null;
    }

    setRunningStep('deterministic');
    startTimer();
    setErrorMessage(null);
    setCurrentActiveBlock(null);

    try {
      const response = await fetchAdminJson<any>('/api/admin/llm/ingest', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'ebike',
          engine: 'unified_pipeline',
          rawText,
          fileName,
          parsedData: ingestedPayload?.parsedYamlOrJson ?? targetCache?.structuredYaml,
          llmPolicy: useLlmToFillGaps ? 'gaps-only' : 'never',
        }),
        timeoutMs: 110000,
      });

      const payload = extractApiData<any>(response);
      if (!payload?.specSections?.length) {
        throw new Error('O pipeline não retornou seções canônicas.');
      }

      setModularBlocks(
        CANONICAL_SPEC_SECTIONS.map((section, index) => {
          const found = payload.specSections[index];
          const items = found?.items ?? [];
          const filled = items.filter(
            (item: any) => item.value && item.value !== UNCONFIRMED_LABEL
          );
          return {
            index: index + 1,
            title: section.title,
            shortName: section.title.replace(/^\\d+\\.\\s*/, ''),
            description: \`\${items.length} campo(s) canônico(s)\`,
            status: filled.length > 0 ? ('completed' as const) : ('idle' as const),
            summary: \`\${filled.length}/\${items.length} campo(s)\`,
            itemCount: items.length,
            highlight: filled[0]
              ? \`\${filled[0].label}: \${filled[0].value}\`
              : 'Sem dado verificável',
            items,
          };
        })
      );

      setCurrentActiveBlock('editorial');
      const editorial = payload.editorial ?? {};
      setModularBlocks((prev) =>
        prev.map((item) =>
          item.index === 'editorial'
            ? {
                ...item,
                status: 'completed' as const,
                summary: 'Veredito e prós/contras',
                highlight: editorial.badge || 'Ficha Validada',
              }
            : item
        )
      );

      const mergedCache: ExtractionCacheData = {
        ...(targetCache as ExtractionCacheData),
        updatedAt: new Date().toISOString(),
        specSections: payload.specSections,
        editorial: { ...(targetCache?.editorial ?? {}), ...editorial },
        completedSteps: Array.from(new Set([...(targetCache?.completedSteps || []), 1, 2, 3])),
      };
      setCurrentCache(mergedCache);
      emitConsolidatedData(mergedCache);
      refreshCachesList();

      const stats = payload.stats ?? {};
      const gapNote = stats.gapCount
        ? \` \${stats.gapCount} campo(s) ficaram sem fonte.\`
        : ' Ficha completa.';
      const llmNote = stats.llmUsed
        ? \` IA chamada 1x para fechar \${stats.llmFieldsFilled} buraco(s).\`
        : ' Nenhum token de IA foi gasto.';
      setSuccessMessage(
        \`✓ \${stats.filledItems ?? 0}/\${stats.totalCanonicalItems ?? 0} campos preenchidos.\${gapNote}\${llmNote}\`
      );
      return payload;
    } catch (err: any) {
      console.error('[Dropzone] Falha no pipeline unificado:', err);
      setErrorMessage(err.message || 'Erro durante a extração.');
      return null;
    } finally {
      stopTimer();
      setRunningStep(null);
      setActiveSubStep(null);
    }
  };`;

function replaceLlmExtraction(content) {
  if (content.includes('handleRunUnifiedExtraction')) return content;

  const lines = content.split('\n');
  const start = lines.findIndex((line) =>
    line.includes('const handleRunLLMExtractionOnly = async')
  );
  if (start === -1) throw new Error('handleRunLLMExtractionOnly não encontrada');

  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trimEnd() === '  };') {
      const next = lines[i + 2] ?? '';
      if (next.includes('Handlers para os modos Artigo e Ranking')) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error('fechamento de handleRunLLMExtractionOnly não encontrado');

  lines.splice(start, end - start + 1, UNIFIED_HANDLER);
  return lines.join('\n');
}

/* ─────────── passo 3: estado, wiring e toggle de política ─────────── */

function addPolicyState(content) {
  if (content.includes('const [useLlmToFillGaps')) return content;

  const match = content.match(/const \[runningStep, setRunningStep\] = useState<[^;]*;\n/);
  if (!match) throw new Error('estado runningStep não encontrado');

  const state =
    '\n' +
    '  // Política de IA. A extração e a alocação são sempre determinísticas e\n' +
    '  // não gastam token; a IA só entra se sobrar buraco e o editor permitir.\n' +
    '  const [useLlmToFillGaps, setUseLlmToFillGaps] = useState(true);\n';

  return content.replace(match[0], match[0] + state);
}

function rewireCalls(content) {
  return content
    .replace(/handleRunLLMExtractionOnly\(/g, 'handleRunUnifiedExtraction(')
    .replace(/handleRunDeterministicAllocationFromTags\(\)/g, 'handleRunUnifiedExtraction()')
    .replace(
      /handleRunDeterministicExtraction\(\)/g,
      'handleRunUnifiedExtraction()'
    )
    .replace(
      /\/\/ Disparo Imediato e Exclusivo da Extração via LLM \(NUNCA determinístico no upload\)/,
      '// Pipeline determinístico primeiro. A IA só é chamada depois, e só se sobrar buraco.'
    )
    .replace(
      'A IA está analisando o documento e rotulando cada especificação com sua tag de localização...',
      'Extraindo e alocando nas 10 seções canônicas...'
    )
    // o passo 'llm_extract_tags' não existe mais: o pipeline roda em 'deterministic'
    .replace(/runningStep === 'llm_extract_tags' \|\| runningStep === 'all'/g,
             "runningStep === 'deterministic' || runningStep === 'all'")
    .replace(/runningStep === 'llm_extract_tags'/g, "runningStep === 'deterministic'");
}

function addImports(content) {
  let next = content;
  if (!next.includes("from '@/lib/ingestion/pipeline'")) {
    next = next.replace(
      "import { fetchAdminJson, ApiResponseResult } from '@/lib/ai/clientResponse';",
      "import { fetchAdminJson, ApiResponseResult } from '@/lib/ai/clientResponse';\n" +
        "import { UNCONFIRMED_LABEL } from '@/lib/ingestion/pipeline';\n" +
        "import { CANONICAL_SPEC_SECTIONS } from '@/lib/specAllocations';"
    );
  }
  return next;
}

function insertToggle(content) {
  if (content.includes('Permitir 1 chamada de IA para fechar buracos')) return content;

  const lines = content.split('\n');
  // Bloco IRMÃO, logo antes das opções de Artigo: entrar dentro da expressão
  // `{mode === 'ebike' && ( ... )}` quebraria o JSX (ela aceita um só filho).
  const anchor = lines.findIndex((line) => line.includes('OPÇÕES PARA MODO ARTIGO'));
  if (anchor === -1) throw new Error('âncora de opções de Artigo não encontrada');

  const toggle = [
    "              {/* Política de IA: desligar por completo zera o custo da extração. */}",
    "              {mode === 'ebike' && (",
    '                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">',
    '                  <input',
    '                    type="checkbox"',
    '                    checked={useLlmToFillGaps}',
    '                    onChange={(event) => setUseLlmToFillGaps(event.target.checked)}',
    '                    className="mt-0.5 h-4 w-4 accent-amber-500"',
    '                  />',
    '                  <span className="min-w-0">',
    '                    <span className="block text-xs font-bold text-neutral-200">',
    '                      Permitir 1 chamada de IA para fechar buracos',
    '                    </span>',
    '                    <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-400">',
    '                      A extração e a alocação são sempre determinísticas e não gastam token. Com esta',
    '                      opção ligada, a IA é chamada uma única vez, só para os campos que ficaram sem',
    '                      fonte verificável. Desligada, o custo é zero e o editor preenche o que faltar.',
    '                    </span>',
    '                  </span>',
    '                </label>',
    '              )}',
    '',
    '',
  ];

  lines.splice(anchor, 0, ...toggle);
  return lines.join('\n');
}

/* ──────────────────────────── execução ──────────────────────────── */

let content = read();
content = removeIngestorV2(content);
content = replaceLlmExtraction(content);
content = addPolicyState(content);
content = addImports(content);
content = rewireCalls(content);
content = insertToggle(content);

// Guarda-corpo, ANTES de escrever.
//
// Contar `/*` e `*/` por texto não serve: um `*/` dentro de uma regex (ex.
// `/^\d+\.\s*/`) contaria como fechamento e acusaria um imbalance que não
// existe. O parser do TypeScript é a verificação confiável — e é ele que
// detectaria o problema real: um docblock sem fechamento engole todo o código
// seguinte sem gerar erro de sintaxe.
{
  const { createSourceFile, ScriptTarget, ScriptKind } = await import('typescript');
  const parsed = createSourceFile(
    'FileIngestionDropzone.tsx',
    content,
    ScriptTarget.Latest,
    true,
    ScriptKind.TSX
  );
  const diagnostics = parsed.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics.slice(0, 5)) {
      const { line } = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      console.error(
        `[apply-ingest-consolidation] ABORTADO: erro de sintaxe na linha ${line + 1}: ` +
          `${diagnostic.messageText}`
      );
    }
    console.error('[apply-ingest-consolidation] Nada foi escrito.');
    process.exit(1);
  }
  if (content.includes('IngestorV2') || content.includes('handleParsedText')) {
    console.error('[apply-ingest-consolidation] ABORTADO: restou referencia ao IngestorV2.');
    process.exit(1);
  }
}

write(content);
console.log('[apply-ingest-consolidation] FileIngestionDropzone.tsx atualizado.');
