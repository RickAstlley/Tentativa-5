# TuaVia — Biblioteca de Componentes UI

## 1. Diretrizes Gerais de Componentes

Todos os componentes da TuaVia devem ser construídos em React com TypeScript e estilizados utilizando classes utilitárias do Tailwind CSS, respeitando estritamente os design tokens definidos no módulo `02`. É proibido o uso de estilos inline arbitrários ou cores fora da paleta oficial.

---

## 2. Componentes Principais

### A. Botões (Button)
- **Variantes:**
  - `Primary`: Fundo Oliva (`--color-primary`), texto claro, hover em Oliva Escuro (`--color-primary-dark`). Utilizado em CTAs principais e ações de redirecionamento.
  - `Secondary`: Fundo Creme/Superfície com borda Oliva e texto Oliva. Utilizado em ações secundárias de comparação.
  - `Ghost`: Sem fundo, texto escuro com hover translúcido. Utilizado em navegação e ações de fechar/limpar.
- **Estados:** `Default`, `Hover`, `Active`, `Loading` (com ícone de spinner e texto "Carregando..."), `Disabled` (opacidade de 50% e cursor not-allowed).
- **Radius:** `rounded-[18px]` para botões de largura total; `rounded-full` para botões de ícone ou pílulas.

### B. Cards de Bicicleta (EBikeCard)
O card exibe o resumo executivo de um modelo no catálogo.
- **Anatomia:**
  - Imagem oficial da e-bike em proporção 4:3 com fundo neutro.
  - Badge de destaque no canto superior esquerdo (ex: *Melhor Custo-Benefício*, *Escolha Premium*).
  - Marca em letras maiúsculas (ex: SENSE) e Nome Comercial em negrito.
  - Nota TuaVia (ex: `9.0 / 10`) com estrelas de avaliação.
  - Microficha técnica em grade compacta (Autonomia em km, Potência em W, Peso em kg, Tempo de carga).
  - Preço atual de menor oferta destacado em Reais (BRL).
  - Rodapé do card com dois botões de ação: **Comparar** (checkbox interativo) e **Ver Ofertas** (link direto para a página de detalhes).

### C. Inputs e Campos de Busca (Input & Search)
- **Search Protagonista:** Input de largura expandida com ícone de lupa à esquerda, placeholder descritivo ("Pesquise por marca ou modelo..."), borda sutil e efeito de foco em Oliva.
- **Range Slider:** Controle deslizante de preço máximo e autonomia mínima com trilho personalizado em Oliva e indicador numérico em fonte monospaced.

### D. Badges e Pills
- Pílulas arredondadas (`rounded-full`) utilizadas para categorias (Urbana, Trilha, Dobrável, Cargo, Speed) e status de estoque (*Em estoque*, *Sob encomenda*).
- Estados ativo e inativo com contraste claro entre fundo e texto.

### E. Tabela de Ofertas e Comparador (Table)
- **Tabela de Ofertas:** Listagem auditada de lojistas com colunas para Parceiro Oficial, Preço à Vista, Índice de Carga (Selo A/B/C), Disponibilidade e Botão de Redirecionamento com ícone de seta externa.
- **Matriz Lado a Lado:** Tabela comparativa de até 3 e-bikes, com destaque automático (🏆) para o menor preço, maior autonomia, menor peso e maior potência entre os modelos selecionados.

### F. Toasts e Avisos Temporários
- Notificações flutuantes no topo central da tela (`z-50`) com fundo escuro (`#2E2B27`), texto claro e ícone em destaque para avisos como "Você pode comparar no máximo 3 e-bikes simultaneamente".
