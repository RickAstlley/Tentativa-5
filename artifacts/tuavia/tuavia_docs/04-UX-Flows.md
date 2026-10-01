# TuaVia — Fluxos de UX e Jornadas do Usuário

## 1. Princípios de Experiência (UX)

A experiência do usuário na TuaVia é guiada por três pilares inegociáveis: **Rapidez na Decisão**, **Clareza de Informação** e **Confiança Absoluta**. O usuário nunca deve se sentir perdido em um fluxo de e-commerce complexo, pois o objetivo primário é informativo e comparativo.

---

## 2. Jornadas Principais

### A. Jornada de Descoberta e Busca Rápida (Home & Catálogo)
1. **Entrada:** O usuário chega à página inicial e visualiza o Hero com a busca protagonista em destaque ("Encontre a bicicleta elétrica ideal").
2. **Filtragem:** O usuário pode digitar diretamente a marca (ex: *Caloi*) ou clicar nos chips de categoria (*Urbana*, *Trilha/MTB*, *Dobrável*, *Cargo*, *Speed*).
3. **Refinamento:** No painel lateral de filtros avançados, o usuário ajusta o teto de preço (R$ 4.000 a R$ 25.000), autonomia mínima e potência desejada.
4. **Resultado:** Os cards são reordenados instantaneamente sem recarregar a página, exibindo o menor preço encontrado no mercado.

### B. Jornada de Comparação Lado a Lado (O Diferencial Core)
1. **Seleção:** Em qualquer card de e-bike ou na página de produto, o usuário clica no botão "Comparar".
2. **Feedback Visual:** A e-bike é adicionada à bandeja de comparação flutuante ou o usuário navega diretamente para `/comparar?slugs=bike-1,bike-2`.
3. **Análise Crítica:** Na página do comparador, o sistema destaca automaticamente com troféus (🏆) qual modelo vence em preço, autonomia, potência, peso e tempo de carga.
4. **Conversão:** O usuário clica na oferta vencedora para ser redirecionado ao site do lojista parceiro.

### C. Jornada de Avaliação de Produto e Escolha de Oferta
1. **Entrada:** O usuário clica em "Ver Ofertas" em um card e acessa `/bike/[slug]`.
2. **Inspeção Técnica:** O usuário visualiza o resumo executivo, prós e contras, galeria de imagens oficiais e o gráfico de histórico de preços dos últimos 6 meses.
3. **Seleção da Loja:** Na tabela de ofertas auditadas, o usuário compara o preço à vista, o índice de confiabilidade do lojista e a disponibilidade no estoque.
4. **Saída Segura:** Ao clicar no botão de redirecionamento, um aviso informa que ele está indo para o site oficial do parceiro.

---

## 3. Tratamento de Estados Críticos

- **Estado Vazio (Empty State):** Quando nenhum modelo atende aos filtros aplicados, a interface exibe um ícone explicativo, um texto amigável ("Nenhuma bicicleta encontrada com esses critérios") e um botão claro de "Limpar todos os filtros".
- **Estado de Carregamento (Loading Skeleton):** Durante a busca ou mudança de rota, blocos cinzas com animação de pulso simulam a estrutura dos cards, evitando saltos visuais na tela.
- **Limite do Comparador:** Se o usuário tentar adicionar mais de 3 bicicletas ao comparador, um Toast flutuante exibe o alerta de limite máximo de forma não obstrutiva.
