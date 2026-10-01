import { RadarPauta, CopilotMode, RadarClassificationResult } from '@/types/globalRadar';

export type { CopilotMode, RadarClassificationResult };

export function classifyRadarPauta(pauta: Partial<RadarPauta>): RadarClassificationResult {
  const category = String(pauta.category || '').toLowerCase();
  const text = `${pauta.title || ''} ${pauta.summary || ''} ${(pauta.keyPoints || []).join(' ')} ${pauta.whyRelevant || ''}`.toLowerCase();

  // 1. Top Ranking / Comparativo
  const isExplicitRankingCat = category.includes('comparativo') || category.includes('ranking') || category.includes('top');
  const isRankingKeywords = /top\s*\d+|comparativo|ranking|melhores|versus|\bvs\b|qual escolher|guia de escolha|melhor custo/i.test(text);

  if (isExplicitRankingCat || isRankingKeywords) {
    return {
      target: 'top_ranking',
      label: 'Top Ranking / Comparativo',
      icon: '🏆',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      badgeText: '🏆 Top Ranking',
      buttonLabel: '🏆 Redigir Top Ranking com 1 Clique',
      reason: 'Pauta com comparativo, lista Top N ou seleção de produtos',
    };
  }

  // 2. Ficha E-Bike / Modelo Único
  const isBikeCat = category.includes('ficha') || category.includes('e-bike') || category.includes('ebike') || category.includes('modelo');
  const hasBikeKeywords = /lançamento|análise|review|teste|especificações|ficha técnica|modelo|motor central|bateria de lítio|autonomia|quadro/i.test(text);
  const mentionsBrand = /caloi|sense|oggi|specialized|lev|duos|trek|giant|cannondale|scott|ktm|pedelec|dji avinox|bosch|shimano ep/i.test(text);

  if (isBikeCat || (hasBikeKeywords && mentionsBrand && !text.includes('top 5') && !text.includes('top 3'))) {
    return {
      target: 'ebike_analysis',
      label: 'Ficha Técnica E-Bike',
      icon: '⚡',
      badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300',
      badgeText: '⚡ Ficha E-Bike',
      buttonLabel: '⚡ Redigir Ficha E-Bike com 1 Clique',
      reason: 'Pauta focada em especificações e análise técnica de E-Bike',
    };
  }

  // 3. Artigo Editorial / Promoção / Notícias / Guia
  if (category.includes('promo')) {
    return {
      target: 'article_writer',
      label: 'Promoção & Oferta',
      icon: '🏷️',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      badgeText: '🏷️ Promoção / Oferta',
      buttonLabel: '🏷️ Redigir Oferta / Promoção com 1 Clique',
      reason: 'Pauta focada em promoções e ofertas no mercado',
    };
  }

  return {
    target: 'article_writer',
    label: 'Artigo Editorial',
    icon: '📝',
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    badgeText: '📝 Artigo Editorial',
    buttonLabel: '📝 Redigir Artigo com 1 Clique',
    reason: 'Artigo de guia de compra, notícias, manutenção ou legislação',
  };
}

// Extrai dados e especificações detalhadas para preencher os campos do Copiloto
export function extractSpecsFromPauta(pauta: RadarPauta) {
  const text = `${pauta.title} ${pauta.summary} ${pauta.keyPoints.join(' ')} ${pauta.whyRelevant}`;

  // Tenta identificar a Marca
  const brands = ['Caloi', 'Sense', 'Oggi', 'Specialized', 'Lev', 'Duos', 'Trek', 'Giant', 'Cannondale', 'Scott', 'KTM'];
  const foundBrand = brands.find((b) => new RegExp(`\\b${b}\\b`, 'i').test(text)) || '';

  // Tenta extrair potência de motor (ex: 350W, 250W, 500W, 85Nm, 110Nm)
  const powerMatch = text.match(/(\d{3,4})\s*W/i);
  const motorPowerW = powerMatch ? powerMatch[1] : '';

  const torqueMatch = text.match(/(\d{2,3})\s*Nm/i);
  const torqueStr = torqueMatch ? `${torqueMatch[1]}Nm` : '';

  // Bateria (ex: 36V 10.4Ah, 504Wh, 630Wh)
  const batteryMatch = text.match(/(\d{2}V\s*[\d.]+Ah)|(\d{3,4}\s*Wh)/i);
  const batteryDetails = batteryMatch ? batteryMatch[0] : '';

  // Preço estimado (ex: R$ 6.499, R$ 12.900)
  const priceMatch = text.match(/R\$\s*([\d.]+)/);
  const priceEstimated = priceMatch ? priceMatch[1].replace(/\./g, '') : '';

  // Uso principal
  let usoPrincipal = 'Urbana';
  if (/mtb|trilha|montanha|off-road/i.test(text)) usoPrincipal = 'Trilha/MTB';
  else if (/dobrável|compacta/i.test(text)) usoPrincipal = 'Dobrável';
  else if (/cargo|carga/i.test(text)) usoPrincipal = 'Cargo';

  // Extrai nome limpo do modelo
  const cleanModelName = pauta.title
    .replace(/^(Análise|Review|Lançamento|Ficha Técnica|Conheça a|Testamos a|Novo|Nova)\s*(de|da|do)?\s*/i, '')
    .trim();

  return {
    marca: foundBrand,
    modelo: cleanModelName || pauta.title,
    motorPowerW,
    torqueStr,
    batteryDetails,
    priceEstimated,
    usoPrincipal,
  };
}

export function dispatchRadarPauta(
  pauta: RadarPauta,
  onSelectMode?: (mode: CopilotMode) => void,
  router?: { push: (url: string) => void },
  forcedTarget?: 'article_writer' | 'ebike_analysis' | 'top_ranking'
) {
  const classification = classifyRadarPauta(pauta);
  const target = forcedTarget || classification.target;

  // Verificação de legitimidade da fonte antes de permitir autoGenerate
  const rawUrl = (pauta.sourceUrl || '').trim();
  const rawName = (pauta.sourceName || '').trim();
  const isExternalUrl = /^https?:\/\//i.test(rawUrl) && !rawUrl.toLowerCase().includes('tuavia.com');
  const isExternalName = rawName.length > 0 && !rawName.toLowerCase().includes('tuavia');
  const isGenuineSource = isExternalUrl && isExternalName;

  const cleanSourceUrl = isGenuineSource ? rawUrl : '';
  const cleanSourceName = isGenuineSource ? rawName : '';
  const canAutoGenerate = isGenuineSource;

  if (typeof window !== 'undefined') {
    if (target === 'article_writer') {
      const sourceLine = cleanSourceUrl
        ? `Fonte: ${cleanSourceName || 'Fonte Externa'} (${cleanSourceUrl})`
        : 'Fonte: Informação da pauta (buscar e validar fontes adicionais na web)';

      const prefillArticle = {
        title: pauta.title,
        excerpt: pauta.summary,
        category: pauta.category === 'Promoções' ? 'Promoções' : (pauta.category || 'Guia de Compra'),
        keywords: (pauta.suggestedKeywords || []).join(', '),
        targetAudience: 'Ciclistas urbanos, compradores e leitores do TuaVia',
        prompt: `Escreva um artigo completo, otimizado para SEO e altamente engajante sobre: "${pauta.title}".
Contexto/Resumo: ${pauta.summary}
Por que é Relevante: ${pauta.whyRelevant}
Pontos Principais:
- ${pauta.keyPoints.join('\n- ')}
${sourceLine}`,
        suggestedKeywords: pauta.suggestedKeywords,
        autoGenerateOnLoad: canAutoGenerate,
        autoGenerate: canAutoGenerate,
      };

      sessionStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
      localStorage.setItem('tuavia_prefill_article', JSON.stringify(prefillArticle));
    } else if (target === 'ebike_analysis') {
      const specs = extractSpecsFromPauta(pauta);
      const isPromo = pauta.category === 'E-Bike Promoção' || pauta.category === 'Promoções' || pauta.title.toLowerCase().includes('oferta') || pauta.title.toLowerCase().includes('promo');
      
      const motorDesc = specs.motorPowerW ? `${specs.motorPowerW}W ${specs.torqueStr}`.trim() : '';
      const bikePromptSpecs = [
        specs.motorPowerW ? `Motor: ${specs.motorPowerW}W ${specs.torqueStr}`.trim() : 'Motor: não identificado na pauta (deve ser buscado na ficha oficial)',
        specs.batteryDetails ? `Bateria: ${specs.batteryDetails}` : 'Bateria: não identificada na pauta (deve ser buscada na ficha oficial)',
        specs.priceEstimated ? `Preço: R$ ${specs.priceEstimated}` : 'Preço: não identificado na pauta (deve ser buscado no mercado)',
        `Uso: ${specs.usoPrincipal}`,
      ].join(', ');

      const prefillBike = {
        nome: specs.modelo,
        modelo: specs.modelo,
        marca: specs.marca,
        motorPowerW: specs.motorPowerW,
        motor: motorDesc,
        batteryDetails: specs.batteryDetails,
        bateria: specs.batteryDetails,
        priceEstimated: specs.priceEstimated,
        preco: specs.priceEstimated,
        usoPrincipal: specs.usoPrincipal,
        uso: specs.usoPrincipal,
        resumoExecutivo: `${pauta.summary}\n\n💡 Relevância: ${pauta.whyRelevant}`,
        destaques: pauta.keyPoints,
        sourceUrl: cleanSourceUrl,
        sourceName: cleanSourceName,
        badge: isPromo ? '⚡ Oferta Ativa' : 'Destaque Técnico',
        ofertasSugestoes: (isPromo && cleanSourceUrl) ? [
          {
            loja: cleanSourceName || 'Loja Externa',
            preco: Number(specs.priceEstimated) || 0,
            url: cleanSourceUrl
          }
        ] : [],
        prompt: `Analise detalhadamente a E-Bike "${specs.modelo}"${specs.marca ? ` da marca "${specs.marca}"` : ''}.
Especificações preliminares: ${bikePromptSpecs}.
Pontos chave da pauta: ${pauta.keyPoints.join(', ')}.${isPromo ? '\nEsta bike está em promoção, preencha as ofertas se confirmadas.' : ''}`,
        autoGenerate: canAutoGenerate,
      };

      sessionStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
      localStorage.setItem('tuavia_prefill_bike', JSON.stringify(prefillBike));
    } else if (target === 'top_ranking') {
      const qtdMatch = pauta.title.match(/top\s*(\d+)/i);
      const quantidade = qtdMatch ? parseInt(qtdMatch[1], 10) : 5;
      const finalQtd = Math.min(Math.max(quantidade, 3), 10);

      // Inteligência de categorização para Top Rankings do TuaVia
      const titleLower = pauta.title.toLowerCase();
      const summaryLower = (pauta.summary || '').toLowerCase();
      const textToAnalyze = `${titleLower} ${summaryLower} ${(pauta.keyPoints || []).join(' ')}`.toLowerCase();

      let rankingCategory = 'ebikes';
      if (/bateria|battery|célula|amper|carregador|48v|36v|52v|wh\b/i.test(textToAnalyze)) {
        rankingCategory = 'baterias';
      } else if (/motor|bafang|bosch|shimano|câmbio|freio|suspens|peça|pneu|quadro/i.test(textToAnalyze)) {
        rankingCategory = 'pecas';
      } else if (/cadeado|trava|rastreador|alarme|segurança/i.test(textToAnalyze)) {
        rankingCategory = 'seguranca';
      } else if (/capacete|bagageiro|alforge|farol|lanterna|acessório/i.test(textToAnalyze)) {
        rankingCategory = 'acessorios';
      } else if (/custo.benef|barata|barato|promoção|oferta|econômica|preço baixo/i.test(textToAnalyze)) {
        rankingCategory = 'custo-beneficio';
      }

      // Título do ranking profissional e limpo
      let rankingTitle = pauta.title;
      if (!/top\s*\d+/i.test(rankingTitle)) {
        rankingTitle = `Top ${finalQtd} Melhores: ${pauta.title.replace(/^(Lançamento|Novo|Nova|Review|Análise|Dossiê)\s*/i, '')}`;
      }

      const focoEspecifico = `Origem do Radar IA (${cleanSourceName || 'Tendência de Mercado'}):
${pauta.summary}

Relevância para o Mercado Brasileiro:
${pauta.whyRelevant}

Pontos Chave e Destaques Técnicos:
${(pauta.keyPoints || []).map(kp => `- ${kp}`).join('\n')}

Diretriz Técnica para LLM: Redija um ranking comparativo técnico, rigoroso e imparcial com produtos comercializados ou equivalentes no Brasil, destacando especificações auditadas, vantagens e pontos de atenção honestos.`;

      const prefillRanking = {
        titulo: rankingTitle,
        tema: rankingTitle,
        categoria: rankingCategory,
        quantidade: finalQtd,
        focoEspecifico: focoEspecifico,
        resumo: pauta.summary,
        criterioAvaliacao: `Relação custo-benefício, confiabilidade dos componentes, assistência técnica e autonomia real no cenário urbano brasileiro.`,
        autoGenerate: canAutoGenerate,
      };

      sessionStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
      localStorage.setItem('tuavia_prefill_ranking', JSON.stringify(prefillRanking));
    }

    sessionStorage.setItem('tuavia_copilot_active_mode', target);
  }

  let redirectUrl = '/admin';
  if (target === 'ebike_analysis') {
    redirectUrl = '/admin/bikes/novo?radar=1';
  } else if (target === 'article_writer') {
    // Se a categoria original do radar indicar notícias, força a categoria Notícias no formulário
    if (pauta.category === 'Artigo Notícias' || pauta.category === 'Notícias') {
      try {
        const storedStr = localStorage.getItem('tuavia_prefill_article') || sessionStorage.getItem('tuavia_prefill_article');
        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          parsed.category = 'Notícias';
          localStorage.setItem('tuavia_prefill_article', JSON.stringify(parsed));
          sessionStorage.setItem('tuavia_prefill_article', JSON.stringify(parsed));
        }
      } catch (err) {
        console.error('Erro ao ajustar categoria de notícias:', err);
      }
    }
    redirectUrl = '/admin/artigos/novo?radar=1';
  } else if (target === 'top_ranking') {
    redirectUrl = '/admin/rankings/novo?radar=1';
  }

  if (router) {
    router.push(redirectUrl);
  } else if (typeof window !== 'undefined') {
    window.location.href = redirectUrl;
  }
}
