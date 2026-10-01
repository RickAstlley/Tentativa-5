/**
 * lib/adsenseSlots.ts
 *
 * Slots do AdSense por posição, vindos do ambiente.
 *
 * Os IDs de slot não são segredo — são públicos, aparecem no HTML de qualquer
 * página que tenha anúncio. Mas também não fazem sentido no código: são
 * configuração do painel do AdSense, e trocar de conta ou de slot não deve
 * exigir deploy.
 *
 * Sem a variável, o banner não renderiza. É deliberado: um slot vazio ocupa
 * espaço, derruba o CLS e mostra um retângulo cinza com "Publicidade" e nada
 * dentro, o que é pior que não ter nada.
 *
 * Nomes sugeridos ao criar os slots no painel do AdSense:
 *   ARTIGO_MEIO     — artigo, após o primeiro terço do texto
 *   ARTIGO_FIM      — artigo, antes do CTA final
 *   EBIKE_SPEC      — detalhe da e-bike, entre a ficha e as especificações
 *   RANKING_ITEM    — ranking, entre os blocos de itens
 *   HOME_FUNDO      — home, abaixo da seção CONTRAN
 *   CATALOGO_RODAPE — listagem de e-bikes, no rodapé
 */

const slots = {
  ARTICLE_MIDDLE: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_MIDDLE,
  ARTICLE_END: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END,
  EBIKE_SPEC: process.env.NEXT_PUBLIC_ADSENSE_SLOT_EBIKE_SPEC,
  RANKING_ITEM: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RANKING_ITEM,
  HOME_BOTTOM: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BOTTOM,
  CATALOG_FOOTER: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATALOG_FOOTER,
} as const;

export type AdSenseSlotName = keyof typeof slots;

export function getAdSenseSlot(name: AdSenseSlotName): string | undefined {
  return slots[name];
}

/** `true` quando nenhum slot foi configurado — útil para diagnóstico. */
export function isAdSenseConfigured(): boolean {
  return Object.values(slots).some(Boolean);
}
