# TuaVia — Design Tokens e Identidade Visual

## 1. Filosofia Estética: Menos Startup Neon, Mais Marca Consolidada

A direção visual da TuaVia afasta-se de interfaces excessivamente coloridas e típicas de protótipos de inteligência artificial. Inspirada na solidez de marcas de alta precisão (como Apple, Linear e Patagonia), a identidade visual transmite confiança, sustentabilidade, engenharia e elegância natural.

---

## 2. Paleta de Cores e Tokens Semânticos

A paleta oficial substitui fundos puramente brancos e pretos por tons orgânicos e quentes, garantindo leitura confortável e diferenciação no mercado brasileiro.

### Cores de Fundo e Superfície
- **Background Base (`--color-bg-base`):** `#F7F3E8` (Creme Vintage leve / Areia suave).
- **Surface Card (`--color-surface`):** `#FFFDF9` (Branco Quente de Superfície).
- **Bordas e Linhas (`--color-line`):** `#DDD5C5` (Cinza Areia Neutro).

### Cores Tipográficas e Institucionais
- **Texto Principal (`--color-ink`):** `#2E2B27` (Grafite Quente Profundo).
- **Texto Secundário (`--color-muted`):** `#6F6B63` (Marrom Acinzentado Médio).
- **Verde Oliva Principal (`--color-primary`):** `#5F6F52` (Verde Oliva Institucional).
- **Verde Oliva Escuro (`--color-primary-dark`):** `#46523D` (Verde Oliva de Hover e Destaque).
- **Dourado de Destaque (`--color-accent-gold`):** `#B38A3C` (Utilizado em selos, badges e destaques de qualidade).
- **Acento de Carga (`--color-accent-charge`):** `#D6FF3F` (Verde Limão elétrico reservado exclusivamente para indicadores de bateria e alertas ativos).

---

## 3. Tipografia

O projeto utiliza fontes geométricas modernas para títulos e excelente legibilidade em corpos de texto.

- **Família de Títulos e Display (`--font-display`):** `Plus Jakarta Sans`, com fallbacks para `Inter`, `sans-serif`. Pesos principais: 700 (Bold) e 800 (ExtraBold).
- **Família de Texto e UI (`--font-sans`):** `Plus Jakarta Sans` ou `Inter`, pesos 400 (Regular), 500 (Medium) e 600 (SemiBold).
- **Família Monospaced (`--font-mono`):** `IBM Plex Mono`, utilizada estritamente em preços, especificações técnicas, selos de auditoria e rótulos de bateria.

### Escala Tipográfica
- **Hero Title:** 48px / 56px line-height (Mobile: 36px)
- **H1 (Título de Página):** 36px / 44px line-height (Mobile: 28px)
- **H2 (Seções):** 28px / 36px line-height (Mobile: 22px)
- **H3 (Cards / Subseções):** 20px / 28px line-height
- **Body Regular:** 16px / 24px line-height
- **Caption / Meta:** 13px / 18px line-height (Mono)

---

## 4. Grid, Espaçamentos e Border Radius

### Sistema de Espaçamento (Base 8)
Todos os layouts seguem um grid rigoroso baseado em múltiplos de 8px:
- `8px` (compacto, gaps entre ícones e textos)
- `16px` (padding padrão de cards e botões)
- `24px` (espaçamento entre blocos de conteúdo)
- `32px` (separação de seções em mobile)
- `48px` / `64px` (espaçamento de seções em desktop)

### Arredondamento (Border Radius)
- **Cards Principais:** `24px` (cantos generosos e suaves)
- **Botões e Inputs:** `18px` (toque moderno e ergonômico)
- **Badges e Chips:** `999px` (pílulas totalmente arredondadas)
- **Modais e Containers Flutuantes:** `20px`

---

## 5. Sombras e Profundidade

Evita-se o uso de sombras pesadas ou padrões "Bootstrap". A profundidade é obtida através de contraste de superfícies quentes e sombras extremamente suaves e difusas:
- `box-shadow: 0 10.5px 30px -5px rgba(46, 43, 39, 0.06);`
- `border: 1px solid var(--color-line);`
