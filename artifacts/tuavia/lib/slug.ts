/**
 * lib/slug.ts
 *
 * Geração de slug — implementação única do projeto.
 *
 * Antes existiam três cópias byte a byte de `generateSlugFromTitle` (no
 * `ArticleForm`, no `RankingForm` e na página de auditoria), mais um
 * `slugify` em `lib/articles.ts` com comportamento DIFERENTE.
 *
 * A diferença importa e por isso ela é nomeada, não acidental:
 *
 *   `slugify` (canônica, aqui) troca qualquer separador por hífen:
 *     "Lei 996/2023 — atualizações"  ->  "lei-996-2023-atualizacoes"
 *
 *   `normalizeSlugForMatch` (em `lib/articles.ts`) REMOVE a pontuação:
 *     "Lei 996/2023"  ->  "lei-9962023"
 *
 * A primeira gera URL; a segunda só compara título já publicado com o slug
 * pedido, e precisa continuar casando com o conteúdo que já está no disco.
 * Trocá-la agora quebraria a busca de artigos existentes.
 */

/** Gera slug a partir de texto livre. Hífen onde havia separador ou pontuação. */
export function slugify(text: string, fallback?: string): string {
  const base = String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return base || fallback || `item-${Date.now().toString(36)}`;
}

/** Slug a partir de marca e modelo, com o separador mais legível. */
export function slugFromParts(...parts: Array<string | number | null | undefined>): string {
  return slugify(parts.filter(Boolean).join(' '));
}
