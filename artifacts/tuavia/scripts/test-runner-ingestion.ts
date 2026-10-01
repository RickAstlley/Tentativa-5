import { parseEBikeDeterministic, extractMarkdownTablesAndSpecs } from '../lib/admin/fileIngestion';

const sampleMarkdown = `
# Ficha Técnica E-Bike Sousa Eco 350W

Especificações Oficiais:

| Item | Especificação |
|---|---|
| Marca | Sousa Motors |
| Modelo | Eco 350W |
| Motor | Motor elétrico Brushless 350W |
| Potência Nominal | 350W |
| Tensão | 48V |
| Capacidade da Bateria | 12 Ah |
| Autonomia | Até 40 km |
| Velocidade Máxima | 25 km/h |
| Peso Total | 27 kg |
| Capacidade de Carga | 120 kg |
| Câmbio | 48V |
| Marchas | 48V |
| Aro / Rodas | **14&quot;** |
| Pneu | 14 x 2.125 |
| Quadro dobrável | Aço carbono |
| Freios | Freio a Tambor Dianteiro e Traseiro |
| Preço | R$ 3.890,00 |
`;

console.log('=== INICIANDO TESTE DETERMINÍSTICO DE INGESTÃO E ALOCAÇÃO ===\n');

try {
  const table = extractMarkdownTablesAndSpecs(sampleMarkdown);
  console.log('Tabela extraída:', JSON.stringify(table, null, 2));

  const result = parseEBikeDeterministic(sampleMarkdown, undefined, 'sousa_eco_350w.md');

  console.log('--- 1. IDENTIDADE E ESCALARES EXTRAÍDOS ---');
  console.log('Marca:', result.identity.marca);
  console.log('Modelo:', result.identity.modelo);
  console.log('Potência:', result.identity.potenciaW, 'W');
  console.log('Autonomia:', result.identity.autonomiaKm, 'km');
  console.log('Peso:', result.identity.pesoKg, 'kg');

  console.log('\n--- 2. VERIFICAÇÃO DOS 4 CASOS CORRIGIDOS ---');

  // Encontra itens nas seções normalizadas
  let marchaItem: any;
  let cambioItem: any;
  let capMaxItem: any;
  let batCapItem: any;
  let aroItem: any;
  let dobravelItem: any;
  let matQuadroItem: any;

  result.specSections.forEach((sec: any) => {
    sec.items.forEach((it: any) => {
      if (it.label.includes('Quadro') || it.label.includes('Material') || it.label.includes('Dobrável')) {
        console.log(`[Item na Seção "${sec.title}"] ${it.label} -> "${it.value}"`);
      }
      if (it.label === 'Número de Marchas') marchaItem = it;
      if (it.label === 'Câmbio Traseiro') cambioItem = it;
      if (it.label === 'Capacidade Máxima') capMaxItem = it;
      if (it.label === 'Capacidade Total') batCapItem = it;
      if (it.label === 'Aro / Rodas') aroItem = it;
      if (it.label === 'Dobrável') dobravelItem = it;
      if (it.label === 'Material do Quadro') matQuadroItem = it;
    });
  });

  console.log('1. Marchas & Câmbio:');
  console.log('   - Número de Marchas:', marchaItem?.value, `[Status: ${marchaItem?.status}, Conf: ${marchaItem?.confidence}]`);
  console.log('   - Câmbio Traseiro:', cambioItem?.value);
  const test1Passed = !marchaItem?.value?.includes('48') && !cambioItem?.value?.includes('48');
  console.log('   -> Resultado Teste 1:', test1Passed ? 'APROVADO (Voltagem rejeitada com sucesso)' : 'FALHOU');

  console.log('\n2. Capacidade Máxima vs Bateria:');
  console.log('   - Capacidade Máxima (Carga/Peso):', capMaxItem?.value);
  console.log('   - Capacidade Total (Bateria):', batCapItem?.value);
  const test2Passed = capMaxItem?.value?.includes('kg') && !capMaxItem?.value?.includes('Ah') && batCapItem?.value?.includes('Ah');
  console.log('   -> Resultado Teste 2:', test2Passed ? 'APROVADO (Sem contaminação cruzada Ah vs kg)' : 'FALHOU');

  console.log('\n3. Aro / Rodas (Sanitização HTML/Markdown):');
  console.log('   - Aro / Rodas:', aroItem?.value);
  const test3Passed = aroItem?.value === 'Aro 14"' && !aroItem?.value?.includes('&quot;') && !aroItem?.value?.includes('**');
  console.log('   -> Resultado Teste 3:', test3Passed ? 'APROVADO (Formatado e sanitizado como Aro 14")' : 'FALHOU');

  console.log('\n4. Dobrável vs Material do Quadro:');
  console.log('   - Dobrável:', dobravelItem?.value);
  console.log('   - Material do Quadro:', matQuadroItem?.value);
  const test4Passed = dobravelItem?.value?.includes('Sim') && matQuadroItem?.value?.includes('Aço');
  console.log('   -> Resultado Teste 4:', test4Passed ? 'APROVADO (Material em Material do Quadro e Dobrável=Sim)' : 'FALHOU');

  console.log('\n--- 3. ESTRUTURA YAML GERADA ---');
  console.log(result.structuredYaml.slice(0, 450) + '...\n');

  console.log('=== TODOS OS TESTES FORAM EXECUTADOS COM SUCESSO ===');
} catch (err: any) {
  console.error('Erro na execução do teste:', err);
  process.exit(1);
}
