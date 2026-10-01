# TuaVia — Instruções Exclusivas para AI Studio / Vibecoding

## 1. Diretrizes para Geração de Código

Este documento serve como manual interno para a Inteligência Artificial ao desenvolver, refatorar ou expandir o código da plataforma **TuaVia**. A obediência a estas regras garante consistência arquitetural, manutenibilidade e alta performance.

---

## 2. Convenções de Arquitetura e Organização de Pastas

O projeto utiliza **Next.js (App Router)** com **TypeScript** e **Tailwind CSS**. A estrutura de diretórios deve respeitar estritamente o padrão abaixo:

- `/app/` — Páginas e rotas da aplicação (ex: `page.tsx`, `comparar/page.tsx`, `bike/[slug]/page.tsx`).
- `/components/` — Componentes de UI reutilizáveis e modulares (ex: `Header.tsx`, `EBikeCard.tsx`, `Catalog.tsx`).
- `/lib/` — Funções utilitárias, regras de negócio e adaptadores de dados (ex: `ebikes.ts`).
- `/types/` — Definições de tipos e interfaces TypeScript (ex: `ebike.ts`).
- `/data/` — Fontes de dados estruturados em JSON ou adaptadores de API.

---

## 3. Regras Obrigatórias de Desenvolvimento

1. **Modularização de Componentes:** Nunca crie componentes monolíticos com mais de 300 linhas de código. Se um arquivo como `Catalog.tsx` ou `BikeDetailPageClient.tsx` crescer demais, divida-o em subcomponentes atômicos dentro de `/components/`.
2. **Tipagem Estrita (TypeScript):** Evite o uso de `any`. Todas as funções, props de componentes e entidades de dados devem possuir interfaces ou tipos explícitos declarados em `/types/`.
3. **Consistência de Design Tokens:** Utilize sempre as variáveis CSS e classes utilitárias definidas no Tailwind (`bg-bg-base`, `text-ink`, `bg-primary`, `text-accent-gold`, etc.). É terminantemente proibido inserir códigos de cor arbitrários (ex: `#333333` ou `bg-blue-600`).
4. **Tratamento de Imagens:** Sempre utilize o componente `<Image>` do Next.js com largura, altura e propriedades adequadas para evitar layout shift e garantir pontuação máxima em performance.
5. **Acessibilidade (a11y):** Todos os botões interativos devem possuir atributos `aria-label` quando não contiverem texto visível. Elementos clicáveis devem ser `<button>` ou `<Link>`, nunca `<div>` com manipulador de clique sem tratamento de teclado.

---

## 4. Como Evoluir o Design System com IA

Quando solicitado a criar um novo componente ou tela:
1. Consulte primeiro este conjunto de documentos (`00` a `05`) para verificar se o padrão já existe.
2. Utilize os tokens de cor, tipografia e espaçamento especificados no módulo `02`.
3. Garanta que o componente seja responsivo (**Mobile First**), testando mentalmente ou via código os breakpoints para dispositivos móveis (`sm`, `md`, `lg`).
4. Execute validações de lint e build antes de concluir qualquer entrega para evitar quebras em produção.
