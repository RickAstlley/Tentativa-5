/**
 * Teste funcional do pipeline unificado de ingestao.
 *
 * Roda com politica `never`: prova que a extracao e a alocacao deterministicas
 * funcionam sozinhas, sem nenhuma chamada de LLM. E o que garante que o
 * pipeline novo nao esconde um LLM atras de um fallback.
 *
 *   npx tsx scripts/test-ingestion-pipeline.ts
 */

import { runIngestionPipeline, findSpecGaps } from '../lib/ingestion/pipeline';

const FIXTURE = `
Ficha Técnica — Monark M1 Pro

Marca: Monark
Modelo: M1 Pro
Categoria: Urbana
Potência do motor: 500W
Bateria: 48V 13Ah
Autonomia: até 80 km
Peso: 27 kg
Quadro: alumínio 6061
Freios: disco hidráulico
Marchas: 7
Velocidade máxima: 25 km/h
Tempo de carga: 6 horas
Garantia: 2 anos
`.trim();

async function main() {
  console.log('=== Pipeline determinístico (política: never, zero LLM) ===\n');

  const started = Date.now();
  const result = await runIngestionPipeline({
    rawText: FIXTURE,
    fileName: 'monark-m1-pro.txt',
    policy: { llm: 'never' },
  });

  console.log(`marca detectada:      ${result.identity.marca}`);
  console.log(`modelo detectado:     ${result.identity.modelo}`);
  console.log(`categoria:            ${result.identity.categoria}`);
  console.log(`potencia:             ${result.identity.potenciaW}`);
  console.log(`bateria/autonomia:    ${result.identity.autonomiaKm} km`);
  console.log(`secoes canonicas:     ${result.specSections.length}`);
  console.log(`itens preenchidos:    ${result.stats.filledItems}/${result.stats.totalCanonicalItems}`);
  console.log(`buracos restantes:    ${result.stats.gapCount}`);
  console.log(`chamadas de LLM:      ${result.stats.llmUsed ? 'SIM' : 'NAO'}`);
  console.log(`score de integridade: ${result.audit.integrityScore}/100`);
  console.log(`duracao:              ${Date.now() - started}ms\n`);

  console.log('--- distribuição por seção ---');
  for (const section of result.specSections) {
    const filled = section.items.filter(
      (item) => item.value && item.value !== 'Não informado pelo fabricante'
    ).length;
    const total = section.items.length;
    const bar = total === 0 ? '' : `${'█'.repeat(Math.round((filled / total) * 20)).padEnd(20, '·')}`;
    console.log(`  ${bar} ${filled}/${total}  ${section.title}`);
  }

  console.log('\n--- valores efetivamente extraídos ---');
  for (const section of result.specSections) {
    for (const item of section.items) {
      if (item.value && item.value !== 'Não informado pelo fabricante') {
        console.log(`  ${item.label}: ${item.value}`);
      }
    }
  }

  // Verificações que importam
  const failures: string[] = [];

  if (result.specSections.length !== 10) {
    failures.push(`esperava 10 seções canônicas, veio ${result.specSections.length}`);
  }
  if (result.stats.llmUsed) {
    failures.push('política "never" não deveria chamar a IA');
  }
  if (result.stats.filledItems < 6) {
    failures.push(`só ${result.stats.filledItems} campos preenchidos de um texto com 13 linhas`);
  }
  if (String(result.identity.marca ?? '').toLowerCase() !== 'monark') {
    failures.push(`marca não detectada: ${result.identity.marca}`);
  }
  if (result.gaps.length !== findSpecGaps(result.specSections).length) {
    failures.push('gaps reportados não batem com findSpecGaps()');
  }
  if (result.audit.integrityScore <= 0) {
    failures.push('auditoria não calculou score');
  }

  console.log('');
  if (failures.length > 0) {
    console.error('FALHOU:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(
    `OK — ${result.stats.filledItems} campos preenchidos deterministicamente, ` +
      `0 tokens de IA, ${result.stats.gapCount} buraco(s) reportado(s) para revisão.`
  );
}

main().catch((error) => {
  console.error('Erro no teste:', error);
  process.exit(1);
});
