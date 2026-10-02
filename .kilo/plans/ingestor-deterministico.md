# Ingestor determinístico de ficha de e-bike

**Status:** plano pronto, aguardando comando para aplicar. Nada foi alterado no código.

---

## 1. O que já existe (não vamos reconstruir)

O motor determinístico **continua no projeto**. A remoção de LLM levou junto dois arquivos, mas o restante da máquina está intacta e é o suficiente:

| Peça | Onde | Tamanho |
|---|---|---|
| Parser de arquivo (PDF/DOCX/XLSX/CSV/JSON/ZIP/imagens) | `lib/admin/fileIngestion.ts:786` `parseUploadedFile` | — |
| Extração de texto de PDF | `lib/admin/fileIngestion.ts:640` | — |
| Scanner determinístico de e-bike | `lib/admin/fileIngestion.ts:1314` `parseEBikeDeterministic` | ~700 linhas |
| Tabelas markdown → pares rótulo/valor | `lib/admin/fileIngestion.ts:323` `extractMarkdownTablesAndSpecs` | — |
| Estruturador YAML canônico | `lib/admin/fileIngestion.ts:2007` `generateCanonicalEBikeYaml` | — |
| **Auditoria de qualidade (score 0-100, 10 blocos)** | `lib/admin/fileIngestion.ts:2043` `auditIngestionQuality` | — |
| **Alocador nas 10 seções canônicas** | `lib/specAllocations.ts:1293` `allocateAndNormalizeSpecSections` | ~400 linhas |
| Template das 10 seções | `lib/specAllocations.ts:13` `CANONICAL_SPEC_SECTIONS` | — |
| Descomposição de campo composto | `lib/specAllocations.ts:791` `decomposeCompoundSpec` | — |
| Normalizadores (Nm, Wh, V, aro, CONTRAN) | `lib/specAllocations.ts:558-657` | 6 funções |
| Tipos `SpecStatus` / `SpecConfidence` / `EBikeSpecItem` / `EBikeSpecSection` | `types/ebike.ts:97-124` | — |
| Cache de extração | `lib/admin/extractionCache.ts` | — |
| UI de relatório "X% preenchido (N/10 blocos)" | `FileIngestionDropzone.tsx:1287` | — |

---

## 2. O que falta (recuperável do histórico)

Dois arquivos foram apagados na remoção de LLM. **Ambos estão íntegros no histórico** (`git show HEAD~1:...`) e podem ser restaurados quase linha a linha, tirando só as partes de IA.

### 2.1 `lib/ai/deterministicAuditor.ts` → `lib/admin/specAuditor.ts`

**100% determinístico — nenhuma chamada de modelo em lugar nenhum.** É o que produz o rótulo que você citou.

Funções a restaurar:
- `auditEBikeSpecs(specSections, fallbackDomain)` → `{ specSections, auditSummary }` — score de integridade 0-100
- `auditSpecSection` / `auditSpecItem` / `sanitizeSpecItems`
- `isUnconfirmedValue` — 23 regex que reconhecem "não informado", "pendente", "a definir", "n/a", "-", "?"…
- `isGenericSource` + `GENERIC_SOURCE_LABELS` (27 rótulos genéricos: "ficha técnica oficial", "manual do fabricante"…)
- `cleanSourceString` — remove `[resultado 1]` e descarta fonte autoreferencial `tuavia.com.br`
- Tipos `EBikeAuditSummary`, `EBikeAuditCorrection`

Invariante central que vale preservar intacta: **confiança ALTA ou MEDIA exige fonte externa verificável**; sem fonte, a confiança cai para `NAO_CONFIRMADA`. Foi o que fez toda ficha extraída de PDF auditar com score 0 antes.

### 2.2 `lib/ingestion/pipeline.ts` → `lib/admin/ebikeIngestor.ts`

O arquivo tinha duas metades. Ficamos só com a determinística:

**Fica:**
- `UNCONFIRMED_LABEL = 'Não informado pelo fabricante'`
- `runDeterministicExtraction(options)` — **síncrono, puro, sem `await`, sem rede**
- `findSpecGaps(specSections)` — a lista de campos que sobraram sem valor (é o seu requisito)
- `buildIdentity`, `scalarsFrom`
- `stampDocumentSource` — carimba o nome do arquivo como fonte rastreável
- `stampEditorialSources` — se nenhum campo de identidade sobreviveu, **o veredito sai vazio** em vez de afirmar o que não foi confirmado (guarda anti-alucinação determinística)
- Tipos `IngestionResult`, `SpecGap`, `IngestOptions`

**Sai (IA):** `runIngestionPipeline`, `fillGapsWithLlm`, `attachHints`, `GAP_FILL_SCHEMA`, `mergeSections`, e os imports de `AIRouter`, `redactPII`, `YAMLParser`, `allocateFromTaggedSpecs`, `ProviderHub`.

---

## 3. Decisão de arquitetura — DEFINIDA

**Roda no navegador, sem rota nova.** O `FileIngestionDropzone` já roda `parseUploadedFile` e `generateCanonicalEBikeYaml` client-side hoje (`FileIngestionDropzone.tsx:293` e `:297`). A alocação é trabalho de string — rápido. A rota antiga existia por causa da etapa de LLM, que era a única parte lenta; sem ela não há `maxDuration`, nem upload, nem auth, nem custo de servidor.

Consequências aceitas: o trabalho de CPU cai na máquina de quem preenche, e não há endpoint novo para manter.

---

## 4. O pipeline, passo a passo

```
arquivo (PDF/DOCX/XLSX/CSV/JSON/ZIP/imagem)
  │
  ├─ 1. parseUploadedFile            [existe]  → texto bruto + YAML/JSON parseado
  ├─ 2. extractMarkdownTablesAndSpecs [existe]  → pares rótulo/valor
  ├─ 3. parseEBikeDeterministic       [existe]  → identidade, editorial, histórico de preços
  │
  ├─ 4. allocateAndNormalizeSpecSections  [existe]
  │      → 10 seções canônicas, sempre as 10, sempre na ordem oficial
  │      → campo composto ("36V 10.4Ah") vira 2 campos nos lugares certos
  │      → normaliza Nm/Wh/aro/CONTRAN
  │      → campo sem dato real recebe status NAO_INFORMADO
  │
  ├─ 5. stampDocumentSource          [novo]  → fonte = nome do arquivo (rastreável)
  ├─ 6. auditEBikeSpecs              [novo]  → score 0-100 + correções + breakdown
  ├─ 7. findSpecGaps                 [novo]  → o que o fabricante NÃO informou
  └─ 8. stampEditorialSources        [novo]  → veredito só se a ficha sustenta
  │
  └─→ onDataExtracted({ identity, specSections, audit, gaps, stats, … })
       → BikeForm.handleFileIngestionExtracted  [existe, linha 775]
```

---

## 5. O contrato do "fabricante não informou"

Este é o ponto que você pediu. Três camadas, todas determinísticas:

**a) No valor** — `auditSpecItem` normaliza qualquer texto de placeholder para exatamente `'Não informado pelo fabricante'`, com `status: 'NAO_INFORMADO'` e `confidence: 'NAO_CONFIRMADA'`, e **zera a fonte** (fonte genérica não é fonte).

**b) Na lista de buracos** — `findSpecGaps` varre as 10 seções e devolve, para cada campo que ficou no placeholder:

```ts
{ sectionIndex: 3, sectionTitle: '3. Bateria & Energia',
  label: 'Química da Bateria',
  synonyms: ['chemistry', 'célula', 'íon de lítio', 'lithium'] }
```

Só conta buraco campo que **existe no template** e veio vazio — item extra que o documento trouxer é bônus, não obrigação.

**c) Na tela — decisão tomada: lista completa.** O relatório que já existe (`auditIngestionQuality`, `FileIngestionDropzone.tsx:1287`) mostra o score e, no "Ver Todos os 10 Blocos", cada campo com `ok` / `warning` / `missing` e um `hint`. Vou acrescentar abaixo dele a **lista inteira de buracos** — seção, campo, e a marca de que o fabricante não informou — para o editor ver o que precisa preencher à mão, e não só a porcentagem.

A lista vem de `result.gaps` (o retorno de `findSpecGaps`), não do `qualityReport`, porque `gaps` distingue "campo do template que veio vazio" de "item extra que o documento trouxe".

---

## 6. Arquivos

**Criar**
- `lib/admin/specAuditor.ts` — restaurado do histórico, sem IA (~330 linhas)
- `lib/admin/ebikeIngestor.ts` — o orquestrador determinístico (~260 linhas)

**Editar**
- `lib/admin/fileIngestion.ts` — remover o `isUnconfirmedValue` inlineado e importar do auditor (hoje está duplicado)
- `components/admin/FileIngestionDropzone.tsx` — criar `handleRunEBikeDeterministic`, no mesmo formato de `handleRunArticleDirect` (`:426`) e `handleRunRankingDirect` (`:443`); ligar o botão; acrescentar a lista de buracos ao relatório de qualidade

**Não tocar** — `BikeForm.tsx`, `lib/specAllocations.ts`, `types/ebike.ts`, rotas de API, `package.json`

---

## 7. Verificação

1. `tsc --noEmit` — não pode surgir erro novo (hoje há 8 pré-existentes, todos fora de admin)
2. `npm run build` e `npm run check:dead`
3. **Teste com arquivo real**: subir um PDF de ficha técnica de e-bike e conferir, campo a campo, se o que está no documento cai na seção certa
4. Testar o caso "não informado": um documento que não traz a química da bateria precisa结果显示 `Não informado pelo fabricante` naquela posição
5. `POST /api/bikes` com o resultado e confirmar que grava

---

## 8. Ressalva honesta antes de eu começar

O `runDeterministicExtraction` original tem `auditEBikeSpecs(specSections as never)` — o `as never` indica que os tipos não encaixavam perfeitamente ali. Vou verificar isso na implementação; pode exigir um ajuste de tipo em vez do cast.

Também há dupla alocação hoje: o ingestor aloca, e o `BikeForm` realoca em `:882`. É idempotente (o segundo passo normaliza o que o primeiro produziu), mas vou confirmar que não duplica itens.

---

## 9. Depois: ingestor de artigo

O caminho do artigo está mais simples — o trecho determinístico do `route.ts` deletado já existia e é autossuficiente (título por `# H1`, slug, excerto do primeiro parágrafo, categoria por regex, tempo de leitura por contagem de palavras, tags). Não depende de auditor nem de alocação. Reaproveito o mesmo padrão `handleRunArticleDirect`, que já está pronto, e adiciono o relatório de buracos. Fica para depois do de e-bike, como você pediu.
