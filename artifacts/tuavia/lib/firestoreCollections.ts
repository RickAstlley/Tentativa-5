/**
 * lib/firestoreCollections.ts
 *
 * Coleções canônicas do Firestore — uma por entidade.
 *
 * Antes, cada entidade era procurada em 3 ou 4 coleções diferentes, declaradas
 * de forma duplicada em cinco arquivos:
 *
 *   artigos  ->  ['artigos', 'articles', 'publicacoes', 'posts']
 *   e-bikes  ->  ['bikes', 'bicicletas', 'ebikes']
 *   rankings ->  ['rankings', 'top_rankings']
 *
 * E as escritas não concordavam com as leituras: `/api/bikes` gravava em
 * `bikes`, enquanto o `aiDraftCache` gravava em `ebikes`. Uma e-bike publicada
 * pelo rascunho não aparecia no detalhe, que lia só `bikes`.
 *
 * Isso custava ~3 leituras Firestore por request, em paralelo, só para
 * descobrir que a coleção não existe.
 *
 * A migração das apelidas para a canônica é feita uma vez por
 * `scripts/migrate-collections.mjs`; depois disso os aliases legados só são
 * lidos quando `FIRESTORE_LEGACY_COLLECTIONS=true`, para rollback.
 */

export const COLLECTIONS = {
  bikes: 'bikes',
  articles: 'artigos',
  rankings: 'rankings',
  reviews: 'reviews',
  settings: 'settings',
  extractionStaging: 'extraction_staging',
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;
export type CollectionName = (typeof COLLECTIONS)[CollectionKey];

/**
 * Coleções legadas por entidade. Só consultadas em modo de compatibilidade.
 */
export const LEGACY_COLLECTIONS: Record<string, string[]> = {
  bikes: ['bicicletas', 'ebikes'],
  articles: ['articles', 'publicacoes', 'posts'],
  rankings: ['top_rankings'],
};

/** Quando `true`, as leituras também tentam as coleções legadas. */
function legacyEnabled(): boolean {
  return process.env.FIRESTORE_LEGACY_COLLECTIONS === 'true';
}

/**
 * Coleções a consultar, na ordem de preferência: primeiro a canônica, depois
 * as legadas apenas se a compatibilidade estiver ligada.
 */
export function collectionsFor(key: CollectionKey): string[] {
  const canonical = COLLECTIONS[key];
  return legacyEnabled() ? [canonical, ...(LEGACY_COLLECTIONS[key] ?? [])] : [canonical];
}

/** Coleção de escrita. Sempre a canônica — nunca grava em apelida. */
export function writeCollection(key: CollectionKey): string {
  return COLLECTIONS[key];
}

/** Documento da coleção canônica. */
export function docRef(db: any, key: CollectionKey, id: string) {
  return db.collection(COLLECTIONS[key]).doc(id);
}
