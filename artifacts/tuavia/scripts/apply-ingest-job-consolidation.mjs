#!/usr/bin/env node
/**
 * scripts/apply-ingest-job-consolidation.mjs
 *
 * Troca o job `ebike_ingest_step` — que Today roda a cascata de 5 etapas
 * (step 0 a 4), cada uma uma chamada de IA — pela chamada única do pipeline
 * determinístico-primeiro.
 *
 * Depois disso, `runEBikeStep0..4` e `processEBikeIngestion` ficam sem
 * chamador e podem sair da rota de ingestão.
 *
 * Idempotente e validado com o parser do TypeScript antes de escrever.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FILE = path.join(process.cwd(), 'lib', 'ai', 'jobStore.ts');
const MARKER = 'ETAPAS DE INGESTÃO (STEP 0 a 4 OU FULL)';

const source = fs.readFileSync(FILE, 'utf-8');
if (!source.includes(MARKER)) {
  console.log('[apply-ingest-job-consolidation] Já aplicado.');
  process.exit(0);
}

const lines = source.split('\n');

const start = lines.findIndex((line) =>
  line.trimStart().startsWith("} else if (job.type === 'ebike_ingest_step')")
);
if (start === -1) throw new Error("bloco 'ebike_ingest_step' não encontrado");
if (lines.slice(start, start + 12).join('\n').indexOf(MARKER) === -1) {
  throw new Error(`bloco encontrado na linha ${start + 1}, mas sem o comentário esperado`);
}

// Fecha no primeiro `} else if (job.type ===` posterior (o próximo tipo de job).
let end = -1;
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].trimStart().startsWith("} else if (job.type ===")) {
    end = i;
    break;
  }
}
if (end === -1) throw new Error('fim do bloco não encontrado');

const replacement = `    } else if (job.type === 'ebike_ingest_step') {
      // =========================================================================
      // INGESTÃO DE E-BIKE — PIPELINE ÚNICO
      //
      // Antes este job rodava uma cascata de 5 etapas, cada uma uma chamada de
      // IA, com o resultado de uma virando entrada da seguinte. Isso custava
      // 10 chamadas por documento e distribuía mal os valores entre as seções.
      //
      // A etapa por etapa continua disponível para depuração via campo
      // \`stageSnapshot\`, mas o caminho padrão é o pipeline determinístico
      // primeiro, que só chama a IA para fechar buraco.
      // =========================================================================
      const { rawText, parsedData, fileName, llmPolicy } = job.input || {};
      const safeFileName = (fileName || 'documento').trim();

      if (typeof rawText !== 'string' || rawText.trim().length === 0) {
        await updateJob(jobId, {
          progress: 100,
          status: 'failed',
          stage: 'Nenhum texto extraído do arquivo.',
          error: 'O job não recebeu rawText.',
          errorCode: 'EMPTY_INPUT',
          retryable: false,
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
        });
      } else {
        await updateJob(jobId, {
          progress: 20,
          stage: \`Extraindo e alocando nas seções canônicas: "\${safeFileName}"\`,
        });

        const ingested = await runIngestionPipeline({
          rawText,
          fileName: safeFileName,
          parsedData,
          policy: {
            llm: llmPolicy === 'never' || llmPolicy === 'always' ? llmPolicy : 'gaps-only',
          },
        });

        await updateJob(jobId, {
          progress: 100,
          status: 'completed',
          stage: \`\${ingested.stats.filledItems}/\${ingested.stats.totalCanonicalItems} campos preenchidos · \${ingested.stats.gapCount} sem fonte · score \${ingested.audit.integrityScore}\`,
          completedAt: new Date().toISOString(),
          lockedBy: undefined,
          lockedUntil: undefined,
          result: {
            success: true,
            mode: 'ebike',
            engine: 'unified_pipeline',
            data: ingested,
            text: JSON.stringify(ingested.specSections, null, 2),
          },
        });
      }`;

const next = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end)];
const content = next.join('\n');

/* ── validação ── */

const ts = require('typescript');
const parsed = ts.createSourceFile(
  'jobStore.ts',
  content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);
const diagnostics = parsed.parseDiagnostics ?? [];
if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics.slice(0, 5)) {
    const { line } = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(`[apply-ingest-job-consolidation] ABORTADO linha ${line + 1}: ${diagnostic.messageText}`);
  }
  process.exit(1);
}

if (content.includes('runEBikeStep0_RawExtraction(') || content.includes('processEBikeIngestion(')) {
  console.error('[apply-ingest-job-consolidation] ABORTADO: sobrou chamada à cascata antiga.');
  process.exit(1);
}

fs.writeFileSync(FILE, content);
console.log('[apply-ingest-job-consolidation] jobStore.ts atualizado.');
