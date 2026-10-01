import { EBikeGrouped, EBikeStoreOffer } from '@/types/ebike';

export interface EBikePricingInfo {
  menorPreco: number;
  precoOriginal: number; // Preço original de referência "De R$"
  hasDiscount: boolean;
  economia: number;
  percentualDesconto: number; // Percentual arredondado (ex: 25)
  melhorLoja?: string;
  lojasCount: number;
  parcelas12x: number;
  tagOferta?: string;
  isAuditado: boolean;
}

/**
 * Formata um valor numérico para o padrão de moeda brasileiro (BRL).
 * Ex: 4645 -> "R$ 4.645"
 */
export function formatBrl(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * Calcula de forma unificada e consistente o menor preço, preço original ("De"),
 * valor de economia real e porcentagem de desconto para qualquer e-bike.
 * Examina tanto as propriedades diretas (precoDe, maiorPreco, menorPreco)
 * quanto o array de ofertas individuais das lojas monitoradas.
 */
export function getEBikePricingDetails(bike: Partial<EBikeGrouped> | null | undefined): EBikePricingInfo {
  if (!bike) {
    return {
      menorPreco: 0,
      precoOriginal: 0,
      hasDiscount: false,
      economia: 0,
      percentualDesconto: 0,
      lojasCount: 0,
      parcelas12x: 0,
      isAuditado: false,
    };
  }

  const ofertas = Array.isArray(bike.ofertas) ? bike.ofertas : [];
  const lojasCount = ofertas.length > 0 ? ofertas.length : 1;

  // 1. Determina o menor preço real
  let menorPreco = typeof bike.menorPreco === 'number' && bike.menorPreco > 0 ? bike.menorPreco : 0;
  let melhorOferta: EBikeStoreOffer | undefined = undefined;

  if (ofertas.length > 0) {
    const validOfferPrices = ofertas.filter((o) => typeof o.preco === 'number' && o.preco > 0);
    if (validOfferPrices.length > 0) {
      validOfferPrices.sort((a, b) => a.preco - b.preco);
      menorPreco = validOfferPrices[0].preco;
      melhorOferta = validOfferPrices[0];
    }
  }

  // 2. Determina o maior preço original de referência ("De R$")
  let maxRefPrice = menorPreco;

  if (typeof bike.precoDe === 'number' && bike.precoDe > maxRefPrice) {
    maxRefPrice = bike.precoDe;
  }
  if (typeof bike.maiorPreco === 'number' && bike.maiorPreco > maxRefPrice) {
    maxRefPrice = bike.maiorPreco;
  }

  ofertas.forEach((o) => {
    if (typeof o.precoDe === 'number' && o.precoDe > maxRefPrice) {
      maxRefPrice = o.precoDe;
    }
    if (typeof o.preco === 'number' && o.preco > maxRefPrice) {
      maxRefPrice = o.preco;
    }
  });

  const economia = maxRefPrice > menorPreco ? maxRefPrice - menorPreco : 0;
  const hasDiscount = economia > 0 && maxRefPrice > 0;
  const percentualDesconto = hasDiscount ? Math.round((economia / maxRefPrice) * 100) : 0;
  const parcelas12x = menorPreco > 0 ? Math.ceil(menorPreco / 12) : 0;

  // Determina selo/tag de oferta
  let tagOferta = bike.tagOferta || melhorOferta?.destaqueOferta;
  if (!tagOferta && hasDiscount && percentualDesconto > 0) {
    tagOferta = `-${percentualDesconto}% OFF`;
  }

  return {
    menorPreco,
    precoOriginal: maxRefPrice,
    hasDiscount,
    economia,
    percentualDesconto,
    melhorLoja: melhorOferta?.loja,
    lojasCount,
    parcelas12x,
    tagOferta,
    isAuditado: true,
  };
}
