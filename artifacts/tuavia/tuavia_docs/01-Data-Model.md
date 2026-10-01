# TuaVia — Modelo de Dados e Confiabilidade

## 1. Princípios de Governança de Dados

A credibilidade da TuaVia depende diretamente da integridade das informações exibidas. Diferente de plataformas genéricas que exibem dados gerados por IA ou extraídos automaticamente por robôs, a TuaVia adota o princípio da **Verdade Verificável por Humanos**.

Cada entidade do sistema deve possuir metadados claros sobre sua origem, data de atualização, nível de confiança e status de auditoria. Nenhum preço ou especificação crítica pode ser exibido sem uma referência rastreável ao fabricante ou ao lojista parceiro oficial.

---

## 2. Entidades Principais

### A. E-Bike (Modelo Agrupado)
Representa um modelo unificado de bicicleta elétrica (ex: *Caloi E-Vibe Easy Rider*), independentemente de quantas lojas o comercializem.
- `slug` (string, único): Identificador URL-friendly gerado a partir de `marca-modelo`.
- `marca` (string): Fabricante oficial (ex: *Caloi*, *Sense*, *Oggi*, *Lev*, *Specialized*).
- `modelo` (string): Nome comercial do modelo.
- `usoPrincipal` (enum): Categoria estrutural (`Urbana`, `Trilha/MTB`, `Dobrável`, `Cargo`, `Speed`).
- `autonomiaKm` (number): Autonomia máxima testada em condições padrão (km).
- `potenciaW` (number): Potência nominal contínua do motor em Watts (W).
- `pesoKg` (number): Peso total do conjunto com bateria instalada.
- `tempoCargaHoras` (number): Tempo estimado de recarga de 0% a 100%.
- `imagemUrl` (string): URL da fotografia oficial em fundo limpo.
- `menorPreco` (number): Menor preço atual entre todas as ofertas ativas (calculado).
- `maiorPreco` (number): Maior preço atual entre as ofertas ativas (calculado).
- `ofertas` (Array<StoreOffer>): Lista de ofertas associadas.

### B. Oferta de Loja (StoreOffer)
Representa o preço, o estoque e o link de um lojista específico para determinado modelo.
- `id` (string, único): Identificador único da oferta.
- `loja` (string): Nome comercial do parceiro (ex: *Bike Point*, *Futura Bike*, *Netshoes*, *Lev Store*).
- `preco` (number): Preço atual à vista em Reais (BRL).
- `linkProduto` (string): URL de redirecionamento para o site oficial do lojista.
- `disponibilidade` (enum): Status do estoque (`Em estoque`, `Sob encomenda`, `Esgotado`).
- `dataAtualizacao` (string, ISO 8601): Data e hora da última conferência humana.
- `indiceCarga` (object): Avaliação de condições de frete e parcelamento (ex: `{ selo: "A+", confianca: 100 }`).

### C. Ficha Técnica Detalhada (SpecSections)
Agrupamento de especificações em quatro blocos normativos para exibição na página de produto:
1. **Motor & Sistema Elétrico:** Tipo de motor, potência nominal, velocidade máxima, modos de assistência, sensor de pedalada.
2. **Bateria & Energia:** Composição química, capacidade (Ah/Wh), autonomia por carga, tempo de recarga, removibilidade.
3. **Quadro, Suspensão & Pneus:** Material do liga do quadro, garfo dianteiro, medida dos pneus, peso, capacidade máxima de carga.
4. **Transmissão & Freios:** Sistema de marchas (ex: Shimano), trocadores, freios (disco mecânico ou hidráulico), sistema de corte de energia.

### D. Histórico de Preços (PriceHistoryPoint)
Pontos temporais mensais para exibição do gráfico de variação de preço nos últimos 6 meses.
- `month` (string): Rótulo temporal (ex: "Março", "Abril", "Agosto (Hoje)").
- `price` (number): Menor preço registrado naquele período.

---

## 3. Diretrizes para Substituição de Dados Fictícios

Para garantir que a plataforma transicione de um protótipo com dados sintéticos para um serviço real de produção:
1. **Imagens:** Devem ser substituídas exclusivamente por fotografias oficiais fornecidas pelos fabricantes ou capturadas em estúdios parceiros. Imagens genéricas de bancos de imagem (`picsum.photos`) são estritamente proibidas em produção.
2. **Reviews:** Avaliações de usuários exibidas publicamente devem corresponder a compras verificadas com CPF/pedido validado, eliminando textos gerados por algoritmos.
3. **Auditoria de Preços:** Robôs de varredura (web scrapers) podem ser utilizados para alerta prévio, mas a publicação oficial do preço requer validação humana ou checagem via API oficial do lojista parceiro.
