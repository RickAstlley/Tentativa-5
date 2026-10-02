# Plano de Conteúdo TuaVia — Meta: 30 E-bikes + 30 Artigos

> Documento de negócio — não requer alteração de código. O objetivo é guiar a produção editorial para ranquear no Google (SEO) e monetizar com AdSense antes de investir em mais features técnicas.

---

## 1. Critérios de Seleção de E-bikes (30 modelos)

| Prioridade | Critério | Justificativa |
|------------|----------|---------------|
| **P0** | Top 10 mais buscadas no Brasil (Google Trends + Semrush/Ubersuggest) | Volume de busca real = tráfego orgânico imediato |
| **P1** | Modelos com ficha técnica pública no site do fabricante | Garante fonte primária → confiança ALTA no ingestor |
| **P2** | Cobertura de faixas de preço: < R$ 5.000 | Entrada (maior volume de buscas "e-bike barata") |
| **P2** | Cobertura de faixas de preço: R$ 5.000–10.000 | Intermediário (melhor CPC AdSense) |
| **P2** | Cobertura de faixas de preço: > R$ 10.000 | Premium (menor volume, maior ticket) |
| **P3** | Tipos de uso: Urbana, MTB, Cargo, Dobrável, Speed/Urban | Cada tipo atrai intenção de compra diferente |
| **P4** | Marcas com distribuição nacional (assistência técnica) | Credibilidade + possibilidade de afiliados futuros |

### Lista candidata (exemplos — validar disponibilidade atual)

| Modelo | Faixa | Uso | Fonte primária | Status |
|--------|-------|-----|----------------|--------|
| Caloi Mobylette Elétrica | <5k | Urbana | caloi.com.br | A verificar |
| Two Dogs Pliage 48V | <5k | Dobrável/urbana | twodogs.com.br | A verificar |
| MyMax MyWay 4.0 | 5–10k | Urbana | mymax.com.br | A verificar |
| Inow Brasil V8 Pro | 5–10k | MTB leve | inowbrasil.com.br | A verificar |
| TSW Trail 29" | 5–10k | MTB | tswbikes.com.br | A verificar |
| Sense Impact E | 10k+ | MTB full-susp | sensebike.com.br | A verificar |
| Cannondale Tesoro Neo | 10k+ | Urbana premium | cannondale.com | A verificar |
| Specialized Turbo Vado | 10k+ | Urbana/Cargo | specialized.com | A verificar |
| Trek Allant+ | 10k+ | Trekking | trekbikes.com | A verificar |
| Giant Explore E+ | 10k+ | Trekking | giant-bicycles.com | A verificar |

> **Regra de ouro**: não inventar especificações. Se a ficha do fabricante não trouxer torque, autonomia real ou peso, marcar o campo como **"A verificar"** no painel admin — o auditor determinístico vai baixar a confiança para `NAO_CONFIRMADA` automaticamente.

---

## 2. Pautas de Artigos (20 títulos + 10 reserva)

| # | Título Provisório | Palavra-chave Alvo | Intenção | Formato |
|---|-------------------|---------------------|----------|---------|
| 1 | **O que diz a Resolução CONTRAN 996/2023 sobre e-bikes** | contran 996 e-bike | Informacional → Autoridade | Guia definitivo |
| 2 | **Precisa de CNH para pilotar e-bike no Brasil?** | cnh e-bike | Informacional (dúvida jurídica) | FAQ curto |
| 3 | **E-bike até R$ 5.000: 5 modelos que valem a pena em 2025** | e-bike barata | Transacional (comparativo) | Ranking |
| 4 | **Autonomia real vs declarada: como calcular o alcance da sua e-bike** | autonomia e-bike | Educacional | Tutorial |
| 5 | **Motor central vs cubo: qual escolher para seu uso?** | motor central e-bike | Decisão de compra | Comparativo |
| 6 | **Bateria de lítio vs chumbo-ácido: diferenças, vida útil e segurança** | bateria lítio e-bike | Educacional | Guia técnico |
| 7 | **Manutenção de e-bike: o que fazer a cada 500 km** | manutenção e-bike | Pós-venda | Checklist |
| 8 | **Como transportar e-bike no carro / ônibus / metrô** | transportar e-bike | Prático | Tutorial |
| 9 | **E-bike cargo: vale a pena para entregas e família?** | e-bike cargo | Nicho crescente | Análise |
| 10 | **Seguro para e-bike: opções, coberturas e quanto custa** | seguro e-bike | Decisão financeira | Guia |
| 11 | **E-bike dobrável: prós, contras e 3 modelos testados** | e-bike dobrável | Transacional | Review |
| 12 | **Pneus para e-bike: pressão ideal, durabilidade e furos** | pneu e-bike | Técnico/prático | Tutorial |
| 13 | **Upgrade de bateria: quando vale a pena e riscos** | upgrade bateria e-bike | Avançado | Análise |
| 14 | **E-bike na chuva: classificação IP, cuidados e mitos** | e-bike chuva | Prático | FAQ |
| 15 | **Como escolher o tamanho do quadro (aro) na e-bike** | tamanho quadro e-bike | Decisão de compra | Guia |
| 16 | **E-bike para idosos: modelos, benefícios e segurança** | e-bike idoso | Nicho demográfico | Guia |
| 17 | **Conversão de bike comum para elétrica: kit vale a pena?** | kit conversão e-bike | DIY / Custo-benefício | Análise |
| 18 | **Carregador portátil / power bank para e-bike: funciona?** | carregador portátil e-bike | Acessório | Teste |
| 19 | **Legislação municipal: cidades que proíbem/regulam e-bikes** | lei e-bike cidade | Jurídico/local | Mapeamento |
| 20 | **Revenda de e-bike: depreciação, onde anunciar, documentos** | vender e-bike usada | Pós-venda | Guia |

**Reserva (sazonal / tendência):**
- Black Friday e-bike 2025
- Dia dos Pais / Mães: e-bike de presente
- Verão: e-bike praia / fat bike
- Inverno: cuidados com bateria no frio

---

## 3. Ordem de Publicação (Sugestão de 12 semanas)

| Semana | E-bikes (Ingestor) | Artigos (Editorial) | Foco SEO |
|--------|---------------------|---------------------|----------|
| 1 | 3 urbanas < 5k | #1 CONTRAN 996 + #2 CNH | Autoridade jurídica |
| 2 | 2 dobráveis < 5k | #3 E-bike até R$ 5k | Transacional |
| 3 | 2 MTB 5–10k | #4 Autonomia real | Educacional |
| 4 | 1 cargo + 1 urbana 5–10k | #5 Motor central vs cubo | Decisão |
| 5 | 2 premium > 10k | #6 Bateria lítio vs chumbo | Técnico |
| 6 | 2 urbanas premium | #7 Manutenção 500 km | Retenção |
| 7 | 1 MTB full-susp + 1 trekking | #8 Transporte | Prático |
| 8 | 1 cargo premium | #9 E-bike cargo | Nicho |
| 9 | 2 dobráveis premium | #10 Seguro | Financeiro |
| 10 | 2 speed/urban | #11 Dobrível review | Transacional |
| 11 | Completar gaps de specs | #12 Pneus + #13 Upgrade | Técnico |
| 12 | Revisão + publicar pendentes | #14 Chuva + #15 Tamanho | Prático |

> **Ritmo**: 2–3 fichas/semana + 1–2 artigos/semana. Use o ingestor determinístico para fichas; artigos são escritos por humano (ou IA supervisionada) e publicados via painel admin.

---

## 4. Checklist de Qualidade por Ficha (antes de publicar)

- [ ] Fonte primária (site do fabricante / manual PDF) anexada no `sourceUrl`
- [ ] Todos os 10 blocos canônicos preenchidos ou marcados **"A verificar"**
- [ ] CONTRAN 996/2023 preenchido conforme potência nominal
- [ ] Imagem principal otimizada (WebP, < 100 KB, alt descritivo)
- [ ] `meta title` ≤ 60 chars com palavra-chave + marca + modelo
- [ ] `meta description` ≤ 155 chars com benefício + CTA suave
- [ ] Schema `Product` + `BreadcrumbList` validado no Rich Results Test

---

## 5. Métricas de Sucesso (KPIs mensais)

| Métrica | Meta Mês 1 | Meta Mês 3 | Meta Mês 6 |
|---------|------------|------------|------------|
| Fichas publicadas | 12 | 30 | 45 |
| Artigos publicados | 8 | 20 | 35 |
| Sessões orgânicas/mês | 2.000 | 10.000 | 30.000 |
| CTR médio (GSC) | > 2% | > 3.5% | > 4% |
| RPM AdSense | R$ 3–5 | R$ 6–10 | R$ 12+ |
| Leads (formulário contato/ newsletter) | 50 | 300 | 1.000 |

---

## 6. Próximos Passos Imediatos

1. **Validar lista de 30 modelos** com URLs de fichas técnicas oficiais
2. **Criar planilha de controle** (modelo, faixa, uso, URL fonte, status ingestão)
3. **Agendar 1 ficha/dia** no ingestor determinístico + revisão humana 5 min
4. **Definir redator(es)** para artigos (pode ser IA + edição humana)
5. **Configurar Search Console + GA4** se ainda não feito
6. **Submeter sitemap.xml** após cada lote de 5 fichas

---

> **Nota**: Este plano é vivo. Ajuste conforme dados reais de busca (GSC, Ahrefs/SEMrush) e performance de AdSense. O foco técnico já está pronto (ingestor, auditor, painel admin) — agora é executar conteúdo.