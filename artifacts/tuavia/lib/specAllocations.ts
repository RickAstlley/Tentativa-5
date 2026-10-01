import { EBikeSpecSection, EBikeSpecItem, SpecConfidence, SpecStatus } from '@/types/ebike';

export interface CanonicalSpecTemplate {
  title: string;
  items: { label: string; defaultValue?: string; synonyms: string[] }[];
}

/**
 * 10 BLOCOS CANÔNICOS PADRÃO TUAVIA
 * Cobertura completa de especificações de e-bikes com sinônimos expandidos
 * para correspondência exata e semântica com fichas técnicas de fabricantes.
 */
export const CANONICAL_SPEC_SECTIONS: CanonicalSpecTemplate[] = [
  {
    title: '1. Resumo Rápido & Destaques',
    items: [
      {
        label: 'Uso Indicado',
        synonyms: [
          'uso indicado', 'categoria', 'uso principal', 'perfil de uso', 'finalidade',
          'proposta', 'tipo de uso', 'segmento', 'estilo', 'destinacao', 'indicacao de uso',
          'aplicacao', 'terreno', 'classificacao de uso'
        ],
      },
      {
        label: 'Potência Nominal',
        synonyms: [
          'potência nominal', 'potencia nominal', 'potência', 'potencia', 'motor',
          'watts', 'potencia w', 'potência w', 'potencia continua', 'potencia declarada',
          'potencia do motor', 'potencia eletrica', 'potencia legal'
        ],
      },
      {
        label: 'Autonomia Estimada',
        synonyms: [
          'autonomia estimada', 'autonomia', 'autonomia por carga', 'alcance',
          'autonomia declarada', 'autonomia km', 'distancia por carga', 'raio de acao',
          'alcance maximo', 'quilometragem por recarga'
        ],
      },
      {
        label: 'Velocidade Máxima',
        synonyms: [
          'velocidade máxima', 'velocidade maxima', 'velocidade limite', 'velocidade assistida',
          'velocidade', 'vel max', 'corte de assistencia', 'velocidade final', 'max speed'
        ],
      },
      {
        label: 'Peso Total',
        synonyms: [
          'peso total', 'peso do conjunto', 'peso', 'peso da bike', 'peso kg',
          'massa', 'peso líquido', 'peso liquido', 'peso com bateria', 'total weight'
        ],
      },
      {
        label: 'Capacidade Máxima',
        synonyms: [
          'capacidade máxima', 'capacidade maxima', 'capacidade de carga', 'peso máximo suportado',
          'carga máxima', 'peso maximo', 'limite de peso', 'capacidade de peso',
          'peso suportado', 'carga util', 'peso maximo do ciclista'
        ],
      },
    ],
  },
  {
    title: '2. Desempenho & Propulsão',
    items: [
      {
        label: 'Tipo de Motor',
        synonyms: [
          'tipo de motor', 'tipo do motor', 'sistema do motor', 'localização do motor',
          'posicionamento do motor', 'arquitetura do motor', 'localizacao', 'posicao do motor',
          'tecnologia do motor', 'motor brushless', 'motor no cubo', 'motor central'
        ],
      },
      {
        label: 'Potência de Pico',
        synonyms: [
          'potência de pico', 'potencia de pico', 'pico de potência', 'potência máxima',
          'pico', 'potencia pico', 'potencia instantanea', 'pico w', 'potencia de saida maxima'
        ],
      },
      {
        label: 'Torque Máximo',
        synonyms: [
          'torque máximo', 'torque maximo', 'torque', 'nm', 'força de torque',
          'torque nm', 'forca do motor', 'newton metro', 'torque de saida'
        ],
      },
      {
        label: 'Níveis de Assistência',
        synonyms: [
          'níveis de assistência', 'niveis de assistencia', 'modos de assistência',
          'modos de assistencia', 'assistência ao pedal', 'pas', 'modos de condução',
          'estagios de potencia', 'niveis de potencia', 'modos de pedalada', 'niveis do pedal assistido'
        ],
      },
      {
        label: 'Sensor de Pedalada',
        synonyms: [
          'sensor de pedalada', 'sensor de cadência', 'sensor de cadencia', 'sensor de torque',
          'tipo de sensor', 'sensor', 'sensor de rotacao', 'tecnologia de deteccao', 'sistema do sensor'
        ],
      },
      {
        label: 'Acelerador',
        synonyms: [
          'acelerador', 'acelerador de polegar', 'acelerador no punho', 'acelerador manual',
          'tipo de acelerador', 'presença de acelerador', 'gatilho', 'thumb throttle', 'twist throttle'
        ],
      },
    ],
  },
  {
    title: '3. Bateria & Energia',
    items: [
      {
        label: 'Capacidade Total',
        synonyms: [
          'capacidade total', 'capacidade da bateria', 'capacidade bateria', 'capacidade', 'wh', 'capacidade wh', 'watts hora',
          'energia total', 'bateria wh', 'capacidade de energia', 'wh da bateria', 'watt-hora'
        ],
      },
      {
        label: 'Tensão & Amperagem',
        synonyms: [
          'tensão & amperagem', 'tensão e amperagem', 'voltagem e amperagem', 'tensão',
          'voltagem', 'volts', 'amperagem', 'ah', 'composicao', 'voltagem e capacidade',
          'tensao nominal', 'especificacao eletrica', 'volts e amperes'
        ],
      },
      {
        label: 'Química da Bateria',
        synonyms: [
          'química da bateria', 'quimica da bateria', 'células', 'tipo de bateria',
          'íons de lítio', 'li-ion', 'química', 'tipo de celula', 'quimica', 'litio',
          'marca das celulas', 'fabricante das celulas', 'tecnologia da bateria'
        ],
      },
      {
        label: 'Removível',
        synonyms: [
          'removível', 'removivel', 'bateria removível', 'trava de bateria',
          'chave de segurança', 'removível com chave', 'sistema de remoção',
          'extracao da bateria', 'bateria integrada ou removivel'
        ],
      },
      {
        label: 'Tempo de Recarga',
        synonyms: [
          'tempo de recarga', 'tempo de carga', 'tempo de carregamento', 'recarga',
          'horas de carga', 'tempo de recarregamento', 'duracao da recarga', 'charging time'
        ],
      },
      {
        label: 'Carregador',
        synonyms: [
          'carregador', 'fonte de carregamento', 'bivolt', 'carregador incluso',
          'amperagem do carregador', 'especificação do carregador', 'fonte de alimentacao',
          'saida do carregador', 'voltagem do carregador'
        ],
      },
    ],
  },
  {
    title: '4. Conforto & Ergonomia',
    items: [
      {
        label: 'Material do Quadro',
        synonyms: [
          'material do quadro', 'material', 'quadro', 'liga do quadro', 'tipo de quadro',
          'chassi', 'liga de alumínio', 'aluminio', 'aco carbono', 'fibra de carbono', 'frame'
        ],
      },
      {
        label: 'Tamanho do Quadro',
        synonyms: [
          'tamanho do quadro', 'tamanho', 'geometria', 'polegadas do quadro', 'tamanho m',
          'tamanho l', 'altura recomendada', 'estatura recomendada', 'medida do quadro'
        ],
      },
      {
        label: 'Suspensão Dianteira',
        synonyms: [
          'suspensão dianteira', 'suspensao dianteira', 'suspensão', 'suspensao', 'garfo dianteiro', 'garfo com suspensão',
          'curso da suspensão', 'garfo', 'curso garfo', 'amortecedor dianteiro', 'curso em mm',
          'garfo de suspensao', 'trava de suspensao'
        ],
      },
      {
        label: 'Suspensão Traseira',
        synonyms: [
          'suspensão traseira', 'suspensao traseira', 'shock traseiro', 'full suspension',
          'amortecedor traseiro', 'shock', 'sistema full', 'suspensao central'
        ],
      },
      {
        label: 'Ajuste de Guidão',
        synonyms: [
          'ajuste de guidão', 'ajuste de guidao', 'mesa ajustável', 'guidão', 'guidao',
          'altura do guidão', 'mesa', 'avanço', 'stem', 'mesa regulavel'
        ],
      },
      {
        label: 'Selim & Canote',
        synonyms: [
          'selim & canote', 'selim e canote', 'selim', 'banco', 'canote com suspensão',
          'canote', 'selim ergonomico', 'assento', 'canote do selim', 'tipo de selim'
        ],
      },
    ],
  },
  {
    title: '5. Segurança & Frenagem',
    items: [
      {
        label: 'Freio Dianteiro',
        synonyms: [
          'freio dianteiro', 'freio a disco dianteiro', 'freios dianteiros', 'disco dianteiro',
          'tipo de freio dianteiro', 'freio frontal', 'frenagem dianteira'
        ],
      },
      {
        label: 'Freio Traseiro',
        synonyms: [
          'freio traseiro', 'freio a disco traseiro', 'freios traseiros', 'disco traseiro',
          'tipo de freio traseiro', 'frenagem traseira'
        ],
      },
      {
        label: 'Corte de Motor nos Freios',
        synonyms: [
          'corte de motor nos freios', 'corte de energia', 'corte de motor', 'sensor de freio',
          'e-brake', 'manetes com corte', 'sensor de frenagem', 'sistema de corte', 'corte eletrico'
        ],
      },
      {
        label: 'Iluminação Dianteira',
        synonyms: [
          'iluminação dianteira', 'iluminacao dianteira', 'farol dianteiro', 'farol led',
          'luz dianteira', 'farol', 'farol frontal', 'led dianteiro', 'sistema de iluminacao'
        ],
      },
      {
        label: 'Iluminação Traseira',
        synonyms: [
          'iluminação traseira', 'iluminacao traseira', 'luz de freio', 'lanterna traseira',
          'luz traseira led', 'lanterna', 'luz de posicao', 'led traseiro'
        ],
      },
      {
        label: 'Refletores & Buzina',
        synonyms: [
          'refletores & buzina', 'refletores e buzina', 'buzina', 'campainha', 'refletores nas rodas',
          'sinalização sonora', 'campainha sonora', 'sinalizador', 'olho de gato', 'sino'
        ],
      },
    ],
  },
  {
    title: '6. Transmissão & Ciclística',
    items: [
      {
        label: 'Câmbio Traseiro',
        synonyms: [
          'câmbio traseiro', 'cambio traseiro', 'sistema de transmissão', 'transmissão',
          'câmbio', 'cambio', 'desviador traseiro', 'cambio de marchas', 'derailleur', 'sistema de cambio'
        ],
      },
      {
        label: 'Número de Marchas',
        synonyms: [
          'número de marchas', 'numero de marchas', 'marchas',
          'quantas marchas', 'sistema de marchas', 'qtd marchas', 'qtd de marchas', 'velocidades de marcha', 'total de marchas'
        ],
      },
      {
        label: 'Passadores / Trocadores',
        synonyms: [
          'passadores / trocadores', 'trocadores de marcha', 'passadores', 'trocadores',
          'alavanca de câmbio', 'shifter', 'manetes de troca', 'gatilho de marcha', 'revoshift'
        ],
      },
      {
        label: 'Corrente & Pedivela',
        synonyms: [
          'corrente & pedivela', 'corrente e pedivela', 'pedivela', 'corrente',
          'coroa', 'braço do pedivela', 'cassete', 'catraca', 'relacao'
        ],
      },
      {
        label: 'Pedais',
        synonyms: [
          'pedais', 'pedal', 'pedais dobráveis', 'tipo de pedal', 'pedais em alumínio',
          'pedal plataforma', 'material do pedal'
        ],
      },
    ],
  },
  {
    title: '7. Dimensões, Rodas & Pneus',
    items: [
      {
        label: 'Aro / Rodas',
        synonyms: [
          'aro / rodas', 'diâmetro das rodas', 'diametro das rodas', 'diâmetro da roda', 'diametro da roda',
          'tamanho das rodas', 'tamanho da roda', 'aro', 'rodas', 'aro da bicicleta',
          'diâmetro do aro', 'tamanho do aro', 'aros', 'medida da roda', 'wheel diameter'
        ],
      },
      {
        label: 'Medida dos Pneus',
        synonyms: [
          'medida dos pneus', 'pneus', 'pneu', 'medida do pneu', 'dimensões dos pneus',
          'largura do pneu', 'fat tire', 'pneus fat', 'tamanho do pneu', 'especificacao do pneu'
        ],
      },
      {
        label: 'Tipo de Pneu',
        synonyms: [
          'tipo de pneu', 'pneu urbano', 'pneu cravudo', 'pneu misto', 'proteção antifuro',
          'tubeless', 'perfil do pneu', 'marca do pneu', 'pneu slick'
        ],
      },
      {
        label: 'Dobrável',
        synonyms: [
          'dobrável', 'dobravel', 'mecanismo de dobra', 'sistema dobrável',
          'dobra do quadro', 'tipo dobravel', 'facilidade de dobra', 'bicicleta dobrável'
        ],
      },
      {
        label: 'Dimensões (CxLxA)',
        synonyms: [
          'dimensões (cxlxa)', 'dimensões', 'dimensoes', 'medidas', 'comprimento x largura x altura',
          'tamanho montada', 'dimensões totais', 'tamanho da bike', 'dimensoes montada'
        ],
      },
      {
        label: 'Dimensões Dobrada',
        synonyms: [
          'dimensões dobrada', 'tamanho dobrada', 'medidas dobrada', 'dimensões quando dobrada',
          'dimensoes fechada', 'tamanho compactada', 'medidas apos dobra'
        ],
      },
    ],
  },
  {
    title: '8. Equipamentos & Conectividade',
    items: [
      {
        label: 'Painel / Display',
        synonyms: [
          'painel / display', 'painel', 'display', 'computador de bordo', 'tela lcd',
          'display led', 'ciclocomputador', 'visor', 'display digital', 'mostrador'
        ],
      },
      {
        label: 'Entrada USB',
        synonyms: [
          'entrada usb', 'porta usb', 'carregador usb', 'saída usb', 'saída para celular',
          'usb para recarga', 'porta de carregamento usb'
        ],
      },
      {
        label: 'Aplicativo / Bluetooth',
        synonyms: [
          'aplicativo / bluetooth', 'app', 'aplicativo', 'conectividade bluetooth',
          'bluetooth', 'integração com app', 'app compativel', 'conexao com smartphone'
        ],
      },
      {
        label: 'Bagageiro / Rack',
        synonyms: [
          'bagageiro / rack', 'bagageiro', 'rack traseiro', 'rack dianteiro',
          'garupa', 'suporte traseiro', 'capacidade do bagageiro'
        ],
      },
      {
        label: 'Paralamas & Cavalete',
        synonyms: [
          'paralamas & cavalete', 'paralamas e cavalete', 'paralamas', 'cavalete',
          'descanso lateral', 'pé de apoio', 'descanso central', 'para-lamas', 'pe de apoio'
        ],
      },
    ],
  },
  {
    title: '9. Compatibilidade & Manutenção',
    items: [
      {
        label: 'Bateria Reposição / Padrão',
        synonyms: [
          'bateria reposição / padrão', 'bateria de reposição', 'bateria avulsa',
          'padrão da bateria', 'disponibilidade de bateria', 'reposicao de bateria'
        ],
      },
      {
        label: 'Padrão de Peças Ciclísticas',
        synonyms: [
          'padrão de peças ciclísticas', 'peças padrão', 'peças universais',
          'compatibilidade de componentes', 'peças de reposição', 'padrao de pecas'
        ],
      },
      {
        label: 'Resistência à Água',
        synonyms: [
          'resistência à água', 'resistencia a agua', 'proteção ip', 'certificação ip',
          'ipx5', 'ipx4', 'ip65', 'grau de proteção', 'a prova d agua', 'resistencia a chuva'
        ],
      },
      {
        label: 'Garantia de Fábrica',
        synonyms: [
          'garantia de fábrica', 'garantia de fabrica', 'garantia', 'tempo de garantia',
          'garantia do quadro', 'garantia do motor', 'prazo de garantia', 'garantia legal'
        ],
      },
      {
        label: 'Manual & Suporte Nacional',
        synonyms: [
          'manual & suporte nacional', 'manual em português', 'suporte nacional',
          'assistência técnica', 'rede de autorizadas', 'suporte no brasil', 'atendimento brasil'
        ],
      },
    ],
  },
  {
    title: '10. Auditoria de Fontes & Dados',
    items: [
      {
        label: 'Enquadramento CONTRAN',
        synonyms: [
          'enquadramento contran', 'resolução contran', 'contran 996/2023',
          'legislação', 'dispensa cnh', 'classificação legal', 'categoria contran',
          'exigencia de cnh', 'emplacamento'
        ],
      },
      {
        label: 'Fonte Oficial dos Dados',
        synonyms: [
          'fonte oficial dos dados', 'fonte principal', 'documento de origem',
          'manual do fabricante', 'link da fonte', 'origem da informacao', 'url da fonte'
        ],
      },
      {
        label: 'Status da Ficha Técnica',
        synonyms: [
          'status da ficha técnica', 'status da auditoria', 'nível de verificação',
          'confiança global', 'score de integridade', 'conformidade tecnica'
        ],
      },
      {
        label: 'Última Revisão Técnica',
        synonyms: [
          'última revisão técnica', 'data de revisão', 'data de auditoria',
          'data de verificação', 'revisado em', 'data da ficha'
        ],
      },
    ],
  },
];

/**
 * Remove entidades HTML e artefatos de markdown (**, __, etc.) de textos e especificações.
 */
export function cleanMarkdownAndHtmlEntities(val: string): string {
  if (!val || typeof val !== 'string') return '';
  let str = val;

  // 1. Decodifica entidades HTML comuns
  str = str
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/');

  // 2. Remove markdown de formatação
  str = str
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/~~/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*([^*]+)\*(\s|$)/g, '$1$2$3')
    .replace(/(^|\s)_([^_]+)_(\s|$)/g, '$1$2$3');

  // 3. Limpa aspas desbalanceadas nas bordas se resultantes de parse
  str = str.trim();
  if ((str.startsWith('"') && !str.endsWith('"')) || (str.endsWith('"') && !str.startsWith('"') && !/\d+"/.test(str))) {
    if (!/\d+"$/.test(str)) {
      str = str.replace(/^"+|"+$/g, '').trim();
    }
  }

  return str;
}

/**
 * Limpa nomenclaturas de marketing, nomes de loja/versão de terceiros (ex: "Bike do Bem", "na Bike do Bem", "Comfort", "Street"),
 * sufixos de versão comercial e ruídos comparativos dos valores técnicos das especificações.
 */
export function cleanSpecValue(val: string | null | undefined): string {
  if (!val || typeof val !== 'string') return '';
  let str = cleanMarkdownAndHtmlEntities(val);

  // 1. Remove menções explícitas a "Bike do Bem" em qualquer combinação com preposições, conjunções ou parênteses
  str = str
    .replace(/(?:\s*[-–—/|]\s*|\s+)?(?:\(?\s*(?:segundo|conforme|fonte|pela|pelo|na|no|da|do|de|com|e|ou)?\s*(?:vers[aã]o|loja|portal|site|canal)?\s*bike\s*do\s*bem\s*\)?)/gi, '')
    .replace(/\b(?:na|no|da|do|de|pela|pelo|com)?\s*bikedobem\b/gi, '')
    .replace(/\bbike\s+do\s+bem\b/gi, '');

  // 2. Remove especificações atreladas a nomes de versão comercial ou registros históricos (ex: "na Comfort histórica", "versão Comfort", "na Comfort", "na Street", "modelo Sport")
  str = str
    .replace(/(?:\s*[-–—/|]\s*|\s+)?(?:\(?\s*(?:segundo|conforme|fonte|registro|hist[oó]ric[oa]|na|no|da|do|de|pela|pelo)?\s*(?:vers[aã]o|modelo|edi[cç][aã]o|linha|s[eé]rie)?\s*(?:comfort|street|sport|pro|plus|touring|cargo|cross|lite|eco|urban)\s*(?:hist[oó]ric[oa]|antig[oa]|atual|original)?\s*\)?)/gi, '')
    .replace(/\b(?:na|no|da|do|de|pela|pelo)\s+(?:comfort|street|sport|pro|plus|touring|cargo|cross|lite|eco|urban)\b/gi, '')
    .replace(/\b(?:vers[aã]o|modelo)\s+(?:comfort|street|sport|pro|plus|touring|cargo|cross|lite|eco|urban)\b/gi, '')
    .replace(/\b(?:registro\s+t[eé]cnico\s+hist[oó]rico|registro\s+hist[oó]rico|hist[oó]ric[oa])\b/gi, '');

  // 3. Remove frases de proveniência de fonte de terceiros (ex: "segundo Aliança Bike", "conforme Semexe", "segundo manual")
  str = str
    .replace(/(?:\s*[-–—/|]\s*|\s+)?(?:\(?\s*(?:segundo|conforme|de acordo com|fonte|portal|canal)\s+[a-z0-9à-ÿ\s.-]+(?:\.com|\.br|\.org)?\s*\)?)/gi, '')
    .replace(/(?:\s*[-–—/|]\s*|\s+)?(?:\(?\s*(?:alian[cç]a\s*bike|semexe|mercado\s*livre|amazon|shopee|webmotors|olx)\s*\)?)/gi, '');

  // 4. Remove pontuação solta nas extremidades (ex: "5 níveis -" -> "5 níveis")
  str = str
    .replace(/^[\s\-–—/|:,;.]+/, '')
    .replace(/[\s\-–—/|:,;.]+$/, '')
    .trim();

  // 5. Normaliza espaços múltiplos
  str = str.replace(/\s{2,}/g, ' ');

  return str;
}

/**
 * Normaliza um texto para busca e correspondência fonética sem acentos ou caracteres especiais
 */
export function normalizeLabelKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Sanitiza e padroniza a descrição do motor
 */
export function sanitizeMotorTypeValue(val: string): string {
  if (!val) return 'Motor elétrico Brushless';
  const lower = val.toLowerCase();
  if (lower.includes('central') || lower.includes('mid-drive') || lower.includes('mid drive')) {
    return 'Motor Central (Mid-Drive)';
  }
  if (lower.includes('cubo dianteiro') || (lower.includes('dianteiro') && lower.includes('cubo'))) {
    return 'Motor no Cubo Dianteiro Brushless';
  }
  if (lower.includes('traseiro') || lower.includes('cubo')) {
    return 'Motor no Cubo Traseiro Brushless';
  }
  return val.trim();
}

/**
 * Sanitiza e padroniza a capacidade da bateria em Wh
 */
export function sanitizeBatteryCapacityValue(val: string): string {
  if (!val) return '';
  // Rejeita valores de peso (kg, quilos) que colidiram com o rótulo genérico 'capacidade'
  if (/\b\d+(?:\.\d+)?\s*(?:kg|quilos?)\b/i.test(val) || /carga|suportad/i.test(val)) {
    return '';
  }
  const mWh = val.match(/(\d+(?:\.\d+)?)\s*wh\b/i);
  if (mWh) {
    return `${mWh[1]} Wh`;
  }
  const mV = val.match(/(\d{2})\s*v\b/i);
  const mAh = val.match(/(\d+(?:\.\d+)?)\s*ah\b/i);
  if (mV && mAh) {
    const wh = Math.round(Number(mV[1]) * Number(mAh[1]) * 10) / 10;
    return `${wh} Wh (${mV[1]}V ${mAh[1]}Ah)`;
  }
  // Se não contiver Wh, Ah ou V, descarta para evitar valores espúrios
  if (!/\b(?:wh|ah|v)\b/i.test(val)) {
    return '';
  }
  return val.trim();
}

/**
 * Sanitiza e padroniza o torque
 */
export function sanitizeTorqueValue(val: string): string {
  if (!val) return '';
  const mNm = val.match(/(\d{2,3})\s*nm\b/i);
  if (mNm) return `${mNm[1]} Nm`;
  const mNum = val.match(/\b(\d{2,3})\b/);
  if (mNum && Number(mNum[1]) >= 20 && Number(mNum[1]) <= 160) {
    return `${mNum[1]} Nm`;
  }
  return val.trim();
}

/**
 * Sanitiza e padroniza a química da bateria
 */
export function sanitizeBatteryChemistryValue(val: string): string {
  if (!val) return 'Íons de Lítio (Li-ion)';
  const lower = val.toLowerCase();
  if (lower.includes('chumbo') || lower.includes('sla') || lower.includes('gel')) {
    return 'Chumbo-Ácido (SLA)';
  }
  if (lower.includes('litio') || lower.includes('lítio') || lower.includes('li-ion') || lower.includes('lifepo4')) {
    if (lower.includes('lifepo4')) return 'Fosfato de Ferro-Lítio (LiFePO4)';
    return 'Íons de Lítio (Li-ion)';
  }
  return val.trim();
}

/**
 * Sanitiza e padroniza a medida do Aro / Rodas (inclui suporte nativo a 700C, 650B, 29", 27.5", etc.)
 */
export function sanitizeRimValue(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim();

  // 1. Suporte a formatos franceses / métricos tradicionais (700C, 650B, 700x42c, etc.)
  const m700 = cleaned.match(/\b(700\s*[cC]|650\s*[bB])\b/i);
  if (m700) {
    return m700[1].toUpperCase().replace(/\s+/g, '');
  }
  const m700x = cleaned.match(/\b(700\s*x\s*\d{1,2}[a-zA-Z]?)\b/i);
  if (m700x) {
    return '700C';
  }

  // 2. Medidas em polegadas: 29", 27.5", 26", 20", 16", etc.
  const rimMatch = cleaned.match(/(?:aro\s*)?(\d{1,2}(?:\.\d+)?)\s*(?:["″]|polegadas?|pol\b)?/i);
  if (rimMatch) {
    return `Aro ${rimMatch[1]}"`;
  }
  return cleaned;
}

/**
 * Sanitiza e valida o enquadramento CONTRAN 996/2023
 */
export function sanitizeContranValue(val: string, potenciaW?: number | string): string {
  const pot = Number(potenciaW || 0);
  if (pot > 0 && pot <= 350) {
    return 'Bicicleta Elétrica — Resolução CONTRAN 996/2023 (Dispensa CNH, emplacamento e IPVA)';
  }
  if (pot > 350 && pot <= 1000) {
    return 'Bicicleta Elétrica / Autopropelido — CONTRAN 996/2023 (Dispensa emplacamento com pedal assistido)';
  }
  if (val && val.toLowerCase().includes('contran')) {
    return val.trim();
  }
  return 'Bicicleta Elétrica — Resolução CONTRAN 996/2023 (Dispensa CNH, emplacamento e IPVA)';
}

/**
 * Encontra o índice da seção canônica correspondente a um título
 */
export function findCanonicalSectionIndex(sectionTitle: string): number {
  const normTitle = normalizeLabelKey(sectionTitle);
  if (!normTitle) return -1;
  
  // 1. Resumo Rápido
  if (normTitle.includes('resumorapido') || normTitle.includes('destaque') || normTitle.includes('visaogeral') || normTitle.includes('resumo')) return 0;
  
  // 2. Desempenho & Propulsão
  if (normTitle.includes('desempenho') || normTitle.includes('propuls') || normTitle.includes('motor') || normTitle.includes('potencia') || normTitle.includes('torque')) return 1;
  
  // 3. Bateria & Energia
  if (normTitle.includes('bateria') || normTitle.includes('energia') || normTitle.includes('carregador') || normTitle.includes('recarga')) return 2;
  
  // 4. Conforto & Ergonomia
  if (normTitle.includes('conforto') || normTitle.includes('ergonomia') || normTitle.includes('quadro') || normTitle.includes('suspens') || normTitle.includes('selim') || normTitle.includes('guidao')) return 3;
  
  // 5. Segurança & Frenagem
  if (normTitle.includes('seguranca') || normTitle.includes('frenagem') || normTitle.includes('freio') || normTitle.includes('iluminacao') || normTitle.includes('luz') || normTitle.includes('farol')) return 4;
  
  // 6. Transmissão & Ciclística
  if (normTitle.includes('transmissao') || normTitle.includes('ciclistica') || normTitle.includes('cambio') || normTitle.includes('marcha') || normTitle.includes('pedal') || normTitle.includes('corrente')) return 5;
  
  // 7. Dimensões, Rodas & Pneus
  if (normTitle.includes('dimens') || normTitle.includes('roda') || normTitle.includes('pneu') || normTitle.includes('aro') || normTitle.includes('dobra') || normTitle.includes('peso')) return 6;
  
  // 8. Equipamentos & Conectividade
  if (normTitle.includes('equipamento') || normTitle.includes('conectividade') || normTitle.includes('display') || normTitle.includes('painel') || normTitle.includes('bagageiro') || normTitle.includes('app') || normTitle.includes('bluetooth') || normTitle.includes('acessorio')) return 7;
  
  // 9. Compatibilidade & Manutenção
  if (normTitle.includes('compatibilidade') || normTitle.includes('manutencao') || normTitle.includes('garantia') || normTitle.includes('suporte') || normTitle.includes('resistenciaagua') || normTitle.includes('ipx') || normTitle.includes('posvenda')) return 8;
  
  // 10. Auditoria de Fontes & Dados
  if (normTitle.includes('auditoria') || normTitle.includes('fonte') || normTitle.includes('contran') || normTitle.includes('revisao') || normTitle.includes('legislacao')) return 9;

  return -1;
}

/**
 * Busca o melhor bloco canônico e item correspondente para um determinado rótulo (label).
 * Procura primeiro na seção preferencial (se fornecida); se não encontrar,
 * varre TODOS os 10 blocos canônicos.
 */
export function findCanonicalMatch(
  label: string,
  preferredSectionIdx?: number
): { sectionIndex: number; canonicalLabel: string } | null {
  const normLabel = normalizeLabelKey(label);
  if (!normLabel) return null;

  // 1. Testa correspondência exata na seção preferencial
  if (preferredSectionIdx !== undefined && preferredSectionIdx >= 0 && preferredSectionIdx < CANONICAL_SPEC_SECTIONS.length) {
    const prefSec = CANONICAL_SPEC_SECTIONS[preferredSectionIdx];
    for (const itemDef of prefSec.items) {
      if (normLabel === normalizeLabelKey(itemDef.label)) {
        return { sectionIndex: preferredSectionIdx, canonicalLabel: itemDef.label };
      }
      for (const syn of itemDef.synonyms) {
        if (normLabel === normalizeLabelKey(syn)) {
          return { sectionIndex: preferredSectionIdx, canonicalLabel: itemDef.label };
        }
      }
    }
  }

  // 2. Busca exata ou por correspondência direta em todos os 10 blocos canônicos
  for (let secIdx = 0; secIdx < CANONICAL_SPEC_SECTIONS.length; secIdx++) {
    const sec = CANONICAL_SPEC_SECTIONS[secIdx];
    for (const itemDef of sec.items) {
      // Correspondência exata com o rótulo oficial
      if (normLabel === normalizeLabelKey(itemDef.label)) {
        return { sectionIndex: secIdx, canonicalLabel: itemDef.label };
      }
      // Correspondência exata com sinônimos
      for (const syn of itemDef.synonyms) {
        if (normLabel === normalizeLabelKey(syn)) {
          return { sectionIndex: secIdx, canonicalLabel: itemDef.label };
        }
      }
    }
  }

  // 3. Busca por inclusão (substring) com prevenção de colisões cross-category
  for (let secIdx = 0; secIdx < CANONICAL_SPEC_SECTIONS.length; secIdx++) {
    const sec = CANONICAL_SPEC_SECTIONS[secIdx];
    for (const itemDef of sec.items) {
      for (const syn of itemDef.synonyms) {
        const normSyn = normalizeLabelKey(syn);
        if (normSyn.length >= 4) {
          // Prevenção de falso positivo: 'velocidade' não deve casar com 'Número de Marchas'
          if ((normLabel.includes('velocidade') && !normLabel.includes('marcha')) && itemDef.label === 'Número de Marchas') {
            continue;
          }
          // Prevenção de falso positivo: 'capacidade' isolada não deve casar com 'Capacidade Máxima' (peso de carga)
          if (normLabel === 'capacidade' && itemDef.label === 'Capacidade Máxima') {
            continue;
          }
          // Prevenção de falso positivo: rótulos com 'quadro' pertencem ao Material do Quadro
          if ((normLabel === 'quadrodobravel' || normLabel === 'quadro') && itemDef.label === 'Dobrável') {
            continue;
          }

          if (normLabel.includes(normSyn) || (normSyn.includes(normLabel) && Math.abs(normSyn.length - normLabel.length) <= 3)) {
            return { sectionIndex: secIdx, canonicalLabel: itemDef.label };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Decompõe especificações compostas encontradas em arquivos de fabricantes
 * (ex: 'Freios: A disco mecânico 160mm dianteiro e traseiro com corte elétrico')
 * gerando itens canônicos precisos e distribuídos.
 */
export function decomposeCompoundSpec(
  label: string,
  value: string
): Array<{ sectionIndex: number; label: string; value: string; confidence?: SpecConfidence }> {
  const normLabel = normalizeLabelKey(label);
  const normVal = cleanMarkdownAndHtmlEntities(String(value || '')).trim();
  const lowerVal = normVal.toLowerCase();
  const results: Array<{ sectionIndex: number; label: string; value: string; confidence?: SpecConfidence }> = [];

  // Se o valor for nulo, vazio ou explicitamente "não informado", não decompõe
  if (!normVal || /^(n[aã]o\s*informad[oa]|n[aã]o\s*consta|n\/?a|pendente|a\s*confirmar|a\s*definir|-|--)$/i.test(normVal)) {
    return [];
  }

  // A. FREIOS COMPOSTOS (Dianteiro + Traseiro + Corte de motor)
  // Só decompõe se o rótulo for genérico (ex: 'freios', 'sistema de freios') OU se o valor especificar dianteiro E traseiro juntos
  const isGenericBrakeLabel = /^(freios?|sistemadefreios?|tipo[s]?defreios?|frenagem|brakes?)$/i.test(normLabel);
  const isCompositeBrakeVal = /dianteir.*traseir|traseir.*dianteir|ambos|nas duas rodas/i.test(lowerVal);

  if (
    (isGenericBrakeLabel || isCompositeBrakeVal) &&
    (normLabel.includes('freio') || normLabel.includes('frenagem') || normLabel.includes('brakes'))
  ) {
    const isHydraulic = /hidr[aá]ulic/i.test(lowerVal);
    const isMechanical = /mec[aâ]nic/i.test(lowerVal);
    const isDisc = /disco|disc/i.test(lowerVal);
    const isVbrake = /v-?brake/i.test(lowerVal);
    const isDrum = /tambor|drum/i.test(lowerVal);
    const isCoaster = /contra-?pedal|coaster/i.test(lowerVal);
    const hasCutOff = /corte|sensor|e-?brake|desliga/i.test(lowerVal);
    const rotorMatch = normVal.match(/(\d{3})\s*mm/i);
    const rotorSize = rotorMatch ? ` ${rotorMatch[1]}mm` : '';

    let defaultBrakeDesc = '';
    if (isHydraulic) defaultBrakeDesc = `Disco Hidráulico${rotorSize}`;
    else if (isMechanical) defaultBrakeDesc = `Disco Mecânico${rotorSize}`;
    else if (isDisc) defaultBrakeDesc = `Freio a Disco${rotorSize}`;
    else if (isVbrake) defaultBrakeDesc = 'V-Brake';
    else if (isDrum) defaultBrakeDesc = 'Freio a Tambor';
    else if (isCoaster) defaultBrakeDesc = 'Freio Contra-Pedal';
    else defaultBrakeDesc = normVal;

    let frontBrake = defaultBrakeDesc;
    let rearBrake = defaultBrakeDesc;

    // Se especifica dianteiro e traseiro distintos (ex: disco dianteiro e tambor traseiro)
    if (/dianteir.*traseir|traseir.*dianteir/i.test(lowerVal)) {
      if (/disco.*dianteir|dianteir.*disco/i.test(lowerVal)) {
        frontBrake = isHydraulic ? `Disco Hidráulico${rotorSize}` : 'Freio a Disco';
      } else if (/v-?brake.*dianteir|dianteir.*v-?brake/i.test(lowerVal)) {
        frontBrake = 'V-Brake';
      } else if (/tambor.*dianteir|dianteir.*tambor/i.test(lowerVal)) {
        frontBrake = 'Freio a Tambor Dianteiro';
      }

      if (/tambor.*traseir|traseir.*tambor/i.test(lowerVal)) {
        rearBrake = 'Freio a Tambor Traseiro';
      } else if (/contra-?pedal.*traseir|traseir.*contra-?pedal/i.test(lowerVal)) {
        rearBrake = 'Freio Contra-Pedal Traseiro';
      } else if (/disco.*traseir|traseir.*disco/i.test(lowerVal)) {
        rearBrake = isHydraulic ? `Disco Hidráulico${rotorSize}` : 'Freio a Disco';
      } else if (/v-?brake.*traseir|traseir.*v-?brake/i.test(lowerVal)) {
        rearBrake = 'V-Brake';
      }
    }

    // Se o valor menciona dianteiro e traseiro juntos ou apenas 'freios'
    if (
      lowerVal.includes('dianteiro e traseiro') ||
      lowerVal.includes('dianteiro') ||
      lowerVal.includes('traseiro') ||
      lowerVal.includes('ambos') ||
      lowerVal.includes('nas duas rodas') ||
      normLabel === 'freios' ||
      normLabel === 'sistemadefreios'
    ) {
      results.push({ sectionIndex: 4, label: 'Freio Dianteiro', value: frontBrake, confidence: 'ALTA' });
      results.push({ sectionIndex: 4, label: 'Freio Traseiro', value: rearBrake, confidence: 'ALTA' });
      if (hasCutOff) {
        results.push({
          sectionIndex: 4,
          label: 'Corte de Motor nos Freios',
          value: 'Sim, manetes com corte elétrico do motor',
          confidence: 'ALTA',
        });
      }
      return results;
    }
  }

  // B. TRANSMISSÃO / CÂMBIO COMPOSTO (Marca + Marchas + Trocador)
  if (
    normLabel.includes('transmissao') ||
    normLabel.includes('cambio') ||
    normLabel.includes('marchas') ||
    normLabel.includes('drivetrain')
  ) {
    // Se o valor for puramente uma voltagem elétrica (ex: 48V, 36V, 24V), não é câmbio/marchas
    if (/^\s*(24|36|48|52|60|72)\s*v\s*$/i.test(normVal)) {
      return results;
    }

    const isSingleSpeed = /monomarcha|single\s*speed|sem\s*marchas?|sem\s*c[aâ]mbio/i.test(lowerVal);
    // Buscar explicitamente número de marchas (1 a 30) descartando voltagens elétricas
    let speedMatch: RegExpMatchArray | null = null;
    if (!isSingleSpeed) {
      const candidateMatch = normVal.match(/\b([1-9]|[12]\d|30)\s*(?:marchas?|velocidades?|speed)\b/i) ||
                             normVal.match(/\b([1-9]|[12]\d)\s*v\b(?!\s*(?:ah|wh|bateria|motor|tens[aã]o|volts?))/i);
      if (candidateMatch) {
        const num = Number(candidateMatch[1]);
        if (![24, 36, 48, 52, 60].includes(num) || /marchas?/i.test(candidateMatch[0])) {
          speedMatch = candidateMatch;
        }
      }
    }

    const hasShimano = /shimano/i.test(lowerVal);
    const hasTourney = /tourney/i.test(lowerVal);
    const hasAltus = /altus/i.test(lowerVal);
    const hasRevoshift = /revoshift/i.test(lowerVal);
    const hasRapidfire = /rapidfire|gatilho/i.test(lowerVal);

    let cambioDesc = normVal;
    if (isSingleSpeed) {
      cambioDesc = 'Monomarcha (Single Speed / Sem Câmbio)';
    } else if (hasShimano) {
      cambioDesc = hasTourney ? 'Shimano Tourney' : hasAltus ? 'Shimano Altus' : 'Shimano';
    }

    // Não adiciona Câmbio Traseiro se for apenas uma voltagem ou apenas número de velocidades
    if (!/^\s*\d{2}\s*v\s*$/i.test(cambioDesc) && !/^\s*\d{1,2}\s*velocidades\s*$/i.test(cambioDesc)) {
      results.push({ sectionIndex: 5, label: 'Câmbio Traseiro', value: cambioDesc, confidence: 'ALTA' });
    } else if (isSingleSpeed) {
      results.push({ sectionIndex: 5, label: 'Câmbio Traseiro', value: 'Monomarcha (Single Speed / Sem Câmbio)', confidence: 'ALTA' });
    }

    if (isSingleSpeed) {
      results.push({
        sectionIndex: 5,
        label: 'Número de Marchas',
        value: '1 Velocidade (Monomarcha)',
        confidence: 'ALTA',
      });
    } else if (speedMatch) {
      const sNum = Number(speedMatch[1]);
      results.push({
        sectionIndex: 5,
        label: 'Número de Marchas',
        value: sNum === 1 ? '1 Velocidade (Monomarcha)' : `${sNum} Velocidades`,
        confidence: 'ALTA',
      });
    }

    if (hasRevoshift) {
      results.push({
        sectionIndex: 5,
        label: 'Passadores / Trocadores',
        value: 'Shimano Revoshift (Punho Giratório)',
        confidence: 'ALTA',
      });
    } else if (hasRapidfire) {
      results.push({
        sectionIndex: 5,
        label: 'Passadores / Trocadores',
        value: 'Gatilho Rapidfire',
        confidence: 'ALTA',
      });
    }

    if (results.length > 0) return results;
  }

  // C. BATERIA COMPOSTA (Tensão + Amperagem + Química + Wh + Removível)
  if (
    normLabel.includes('bateria') ||
    normLabel.includes('battery') ||
    (normLabel.includes('capacidade') && !normLabel.includes('carga') && !normLabel.includes('peso') && (/\d+(?:\.\d+)?\s*ah\b/i.test(normVal) || /\d+(?:\.\d+)?\s*wh\b/i.test(normVal)))
  ) {
    const mV = normVal.match(/(\d{2})\s*v\b/i);
    const mAh = normVal.match(/(\d+(?:\.\d+)?)\s*ah\b/i);
    const mWh = normVal.match(/(\d+(?:\.\d+)?)\s*wh\b/i);
    const isLithium = /l[ií]tio|li-ion|ions/i.test(lowerVal);
    const isRemovable = /remov[ií]vel|chave|trava/i.test(lowerVal);

    if (mV && mAh) {
      results.push({
        sectionIndex: 2,
        label: 'Tensão & Amperagem',
        value: `${mV[1]}V ${mAh[1]}Ah`,
        confidence: 'ALTA',
      });
      const whCalc = Math.round(Number(mV[1]) * Number(mAh[1]) * 10) / 10;
      results.push({
        sectionIndex: 2,
        label: 'Capacidade Total',
        value: `${mWh ? mWh[1] : whCalc} Wh (${mV[1]}V ${mAh[1]}Ah)`,
        confidence: 'ALTA',
      });
    } else if (mAh) {
      results.push({
        sectionIndex: 2,
        label: 'Tensão & Amperagem',
        value: `${mAh[1]}Ah`,
        confidence: 'ALTA',
      });
      results.push({
        sectionIndex: 2,
        label: 'Capacidade Total',
        value: mWh ? `${mWh[1]} Wh` : `${mAh[1]} Ah`,
        confidence: 'ALTA',
      });
    } else if (mWh) {
      results.push({
        sectionIndex: 2,
        label: 'Capacidade Total',
        value: `${mWh[1]} Wh`,
        confidence: 'ALTA',
      });
    }

    if (isLithium) {
      results.push({
        sectionIndex: 2,
        label: 'Química da Bateria',
        value: 'Íons de Lítio (Li-ion)',
        confidence: 'ALTA',
      });
    }

    if (isRemovable) {
      results.push({
        sectionIndex: 2,
        label: 'Removível',
        value: 'Sim, com chave de segurança',
        confidence: 'ALTA',
      });
    }

    if (results.length > 0) return results;
  }

  // D. DIMENSÕES E DOBRA (Montada + Dobrada)
  if (
    normLabel.includes('dimens') ||
    normLabel.includes('medidas') ||
    normLabel.includes('tamanho')
  ) {
    const isFoldable = /dobr[aá]|fechada/i.test(lowerVal);
    const openMatch = normVal.match(/(?:montada|aberta|tamanho|total)[:\s]*([0-9xX\s\.,cmCM]+)/i);
    const foldedMatch = normVal.match(/(?:dobrada|fechada)[:\s]*([0-9xX\s\.,cmCM]+)/i);

    if (openMatch) {
      results.push({ sectionIndex: 6, label: 'Dimensões (CxLxA)', value: openMatch[1].trim(), confidence: 'ALTA' });
    }
    if (foldedMatch) {
      results.push({ sectionIndex: 6, label: 'Dimensões Dobrada', value: foldedMatch[1].trim(), confidence: 'ALTA' });
    }
    if (isFoldable) {
      results.push({ sectionIndex: 6, label: 'Dobrável', value: 'Sim, quadro dobrável', confidence: 'ALTA' });
    }

    if (results.length > 0) return results;
  }

  // E. RODAS E PNEUS (Aro + Medida + Marca + Fat Tire)
  if (
    normLabel.includes('roda') ||
    normLabel.includes('aro') ||
    normLabel.includes('pneu')
  ) {
    const is700c = /\b700\s*[cC]\b/i.test(normVal) || /\b700\s*x\b/i.test(normVal);
    const is650b = /\b650\s*[bB]\b/i.test(normVal);
    const rimMatch = normVal.match(/(?:aro|tamanho|wheel)[:\s]*(\d{1,2}(?:\.\d+)?)|(\d{1,2}(?:\.\d+)?)\s*["″]|(\d{1,2}(?:\.\d+)?)\s*(?:polegadas|pol)\b/i);
    const tireMatch = normVal.match(/(\d{1,2}(?:\.\d+)?)\s*x\s*([\d\.\/]+)|\b(\d{3}\s*x\s*\d{2}[a-zA-Z]?)\b/i);
    const hasKenda = /kenda/i.test(lowerVal);
    const hasCST = /cst/i.test(lowerVal);
    const tireWidthNum = tireMatch && tireMatch[2] ? parseFloat(tireMatch[2]) : 0;
    const isFatTire = /fat\s*tire|fat\s*bike|pneu\s*largo/i.test(lowerVal) || tireWidthNum >= 3.0;

    if (is700c) {
      results.push({ sectionIndex: 6, label: 'Aro / Rodas', value: '700C', confidence: 'ALTA' });
    } else if (is650b) {
      results.push({ sectionIndex: 6, label: 'Aro / Rodas', value: '650B', confidence: 'ALTA' });
    } else {
      const rimVal = rimMatch ? (rimMatch[1] || rimMatch[2] || rimMatch[3]) : undefined;
      if (rimVal) {
        const rimStr = isFatTire ? `Aro ${rimVal}" (Fat Tire)` : `Aro ${rimVal}"`;
        results.push({ sectionIndex: 6, label: 'Aro / Rodas', value: rimStr, confidence: 'ALTA' });
      } else if (/^\s*(\d{1,2})\s*["″]?\s*$/.test(normVal)) {
        const mSingle = normVal.match(/(\d{1,2})/);
        if (mSingle) {
          const rimStr = isFatTire ? `Aro ${mSingle[1]}" (Fat Tire)` : `Aro ${mSingle[1]}"`;
          results.push({ sectionIndex: 6, label: 'Aro / Rodas', value: rimStr, confidence: 'ALTA' });
        }
      }
    }

    if (tireMatch) {
      const brandSuffix = hasKenda ? ' (Kenda)' : hasCST ? ' (CST)' : '';
      const formattedTire = tireMatch[2] ? `${tireMatch[1]}" x ${tireMatch[2]}"${brandSuffix}` : `${tireMatch[0]}${brandSuffix}`;
      results.push({ sectionIndex: 6, label: 'Medida dos Pneus', value: formattedTire, confidence: 'ALTA' });
      results.push({
        sectionIndex: 6,
        label: 'Tipo de Pneu',
        value: isFatTire ? 'Fat Tire / Todo Terreno (Largo)' : (/misto/i.test(lowerVal) ? 'Misto / Asfalto e Terra' : 'Urbano / Asfalto'),
        confidence: 'ALTA',
      });
    }

    if (results.length > 0) return results;
  }

  // F. QUADRO E MATERIAL (Quadro dobrável + Material do Quadro)
  if (
    !normLabel.includes('tamanho') &&
    !normLabel.includes('size') &&
    (normLabel.includes('quadro') ||
    normLabel.includes('chassi') ||
    normLabel.includes('frame') ||
    (normLabel.includes('material') && !normLabel.includes('pedal') && !normLabel.includes('selim')))
  ) {
    const isFoldable = /dobr[aá]vel|dobra|folding/i.test(lowerVal) || /dobr[aá]vel|folding/i.test(normLabel);
    const isCarbonSteel = /a[cç]o\s*carbono|carbon\s*steel/i.test(lowerVal);
    const isAluminum = /alum[ií]nio|aluminum|alloy/i.test(lowerVal);
    const isCarbonFiber = /fibra\s*de\s*carbono|carbon\s*fiber/i.test(lowerVal);
    const isMagnesium = /magn[eé]sio|magnesium/i.test(lowerVal);
    const isSteel = /a[cç]o|steel/i.test(lowerVal);

    let frameMaterial = '';
    if (isCarbonSteel) frameMaterial = 'Aço Carbono de Alta Resistência';
    else if (isAluminum) {
      frameMaterial = /6061|t6|7005|hidroformad/i.test(lowerVal)
        ? (lowerVal.includes('6061') ? 'Liga de Alumínio 6061' : 'Alumínio Hidroformado')
        : 'Alumínio';
    }
    else if (isCarbonFiber) frameMaterial = 'Fibra de Carbono';
    else if (isMagnesium) frameMaterial = 'Liga de Magnésio';
    else if (isSteel) frameMaterial = 'Aço Carbono';
    else if (!isFoldable && normVal.length > 2 && !/^(sim|n[aã]o|yes|no)$/i.test(normVal) && !/n[aã]o\s*informad/i.test(normVal)) {
      frameMaterial = normVal;
    }

    if (frameMaterial) {
      results.push({ sectionIndex: 3, label: 'Material do Quadro', value: frameMaterial, confidence: 'ALTA' });
    }
    if (isFoldable) {
      results.push({ sectionIndex: 6, label: 'Dobrável', value: 'Sim, quadro dobrável', confidence: 'ALTA' });
    }

    if (results.length > 0) return results;
  }

  // G. SUSPENSÃO COMPOSTA (Dianteira + Traseira / Hardtail / Full Suspension)
  if (
    normLabel.includes('suspens') ||
    normLabel.includes('amortecedor') ||
    normLabel.includes('shock') ||
    normLabel.includes('garfo')
  ) {
    const isFullSuspension = /full\s*suspension|dupla|dianteira\s*e\s*traseira|ambas/i.test(lowerVal);
    const isHardtail = /hardtail|apenas\s*dianteira|somente\s*dianteira/i.test(lowerVal);
    const isRigid = /r[ií]gid[oa]|sem\s*suspens[aã]o/i.test(lowerVal);
    const isRearOnlyLabel = normLabel.includes('traseir') || normLabel.includes('shock');
    const isFrontOnlyLabel = normLabel.includes('dianteir') || normLabel.includes('garfo');

    if (isFullSuspension) {
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Dianteira',
        value: 'Garfo dianteiro com amortecedor telescópico',
        confidence: 'ALTA',
      });
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Traseira',
        value: 'Amortecedor Traseiro Duplo / Mola Helicoidal',
        confidence: 'ALTA',
      });
      return results;
    } else if (isHardtail) {
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Dianteira',
        value: normVal,
        confidence: 'ALTA',
      });
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Traseira',
        value: 'Rígida (Hardtail)',
        confidence: 'ALTA',
      });
      return results;
    } else if (isRigid) {
      // Se o rótulo for especificamente traseiro (ex: 'Suspensão Traseira: Não possui (Rígida)'),
      // deve aplicar apenas à Suspensão Traseira, sem sobrescrever a dianteira com Garfo Rígido!
      if (isRearOnlyLabel) {
        results.push({
          sectionIndex: 3,
          label: 'Suspensão Traseira',
          value: 'Rígida (Sem suspensão)',
          confidence: 'ALTA',
        });
        return results;
      }
      if (isFrontOnlyLabel) {
        results.push({
          sectionIndex: 3,
          label: 'Suspensão Dianteira',
          value: 'Garfo Rígido',
          confidence: 'ALTA',
        });
        return results;
      }
      // Rótulo genérico (ex: "Suspensão: Rígida" ou "Sem suspensão")
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Dianteira',
        value: 'Garfo Rígido',
        confidence: 'ALTA',
      });
      results.push({
        sectionIndex: 3,
        label: 'Suspensão Traseira',
        value: 'Rígida (Sem suspensão)',
        confidence: 'ALTA',
      });
      return results;
    }
  }

  // H. TEMPO DE RECARGA (Intervalo ou Horas)
  if (
    normLabel.includes('recarga') ||
    normLabel.includes('carregamento') ||
    normLabel.includes('tempodecarga')
  ) {
    const rangeMatch = normVal.match(/(\d{1,2})\s*(?:a|-|até)\s*(\d{1,2})\s*(?:horas|h|hrs)?/i);
    const singleMatch = normVal.match(/(\d{1,2})\s*(?:horas|h|hrs)?/i);
    if (rangeMatch) {
      results.push({
        sectionIndex: 2,
        label: 'Tempo de Recarga',
        value: `${rangeMatch[1]} a ${rangeMatch[2]} horas`,
        confidence: 'ALTA',
      });
      return results;
    } else if (singleMatch) {
      results.push({
        sectionIndex: 2,
        label: 'Tempo de Recarga',
        value: `${singleMatch[1]} horas`,
        confidence: 'ALTA',
      });
      return results;
    }
  }

  // I. ACESSÓRIOS E ITENS INCLUSOS (Farol + Buzina + Bagageiro + Paralamas)
  if (
    normLabel.includes('acessorio') ||
    normLabel.includes('equipamento') ||
    normLabel.includes('itensincluso') ||
    normLabel.includes('itensdeserie')
  ) {
    if (/farol|luz\s*dianteira|iluminacao/i.test(lowerVal)) {
      results.push({ sectionIndex: 4, label: 'Iluminação Dianteira', value: 'Farol LED integrado', confidence: 'ALTA' });
    }
    if (/lanterna|luz\s*traseira/i.test(lowerVal)) {
      results.push({ sectionIndex: 4, label: 'Iluminação Traseira', value: 'Lanterna LED traseira', confidence: 'ALTA' });
    }
    if (/buzina|campainha/i.test(lowerVal)) {
      results.push({ sectionIndex: 4, label: 'Refletores & Buzina', value: 'Buzina inclusa', confidence: 'ALTA' });
    }
    if (/bagageiro|garupa|rack/i.test(lowerVal)) {
      results.push({ sectionIndex: 7, label: 'Bagageiro / Rack', value: 'Bagageiro traseiro incluso', confidence: 'ALTA' });
    }
    if (/paralama|cavalete|descanso/i.test(lowerVal)) {
      results.push({ sectionIndex: 7, label: 'Paralamas & Cavalete', value: 'Paralamas e descanso lateral inclusos', confidence: 'ALTA' });
    }
    if (/display|painel/i.test(lowerVal)) {
      results.push({ sectionIndex: 7, label: 'Painel / Display', value: 'Painel digital com indicador de bateria', confidence: 'ALTA' });
    }

    if (results.length > 0) return results;
  }

  return results;
}

/**
 * Aloca e normaliza especificações técnicas de forma 100% determinística,
 * canônica e auditável.
 * 
 * Garante que:
 * 1. Todos os 10 blocos canônicos existam e mantenham a ordem oficial do TuaVia.
 * 2. Nenhuma especificação de arquivos externos seja perdida por estar em seções genéricas.
 * 3. Especificações compostas sejam inteligentemente distribuídas entre seus campos constituintes.
 * 4. Métricas escalares sejam sincronizadas bidirecionalmente.
 * 5. Campos sem dados reais recebam status 'NAO_INFORMADO' e confiança 'NAO_CONFIRMADA'.
 * 6. Todas as regras da Resolução CONTRAN 996/2023 sejam auditadas.
 */
export function allocateAndNormalizeSpecSections(
  existingSections: EBikeSpecSection[] | undefined,
  incomingSections: any | undefined,
  scalars?: {
    potenciaW?: number | string;
    autonomiaKm?: number | string;
    pesoKg?: number | string;
    tempoCargaHoras?: number | string;
    usoPrincipal?: string;
    marca?: string;
    modelo?: string;
  }
): EBikeSpecSection[] {
  // 1. Inicializa o template com as 10 seções canônicas oficiais
  const result: EBikeSpecSection[] = CANONICAL_SPEC_SECTIONS.map((canonicalSec, secIdx) => {
    const existing = existingSections && existingSections[secIdx]?.title === canonicalSec.title
      ? existingSections[secIdx]
      : null;

    const items: EBikeSpecItem[] = canonicalSec.items.map((canonicalItem) => {
      const existingItem = existing?.items?.find(
        (it) => normalizeLabelKey(it.label) === normalizeLabelKey(canonicalItem.label)
      );

      const hasValue = existingItem?.value &&
        existingItem.value !== 'Não informado pelo fabricante' &&
        existingItem.value !== 'Não informado';

      return {
        label: canonicalItem.label,
        value: hasValue ? existingItem!.value : canonicalItem.defaultValue || 'Não informado pelo fabricante',
        confidence: (existingItem?.confidence as SpecConfidence) || (hasValue ? 'ALTA' : 'NAO_CONFIRMADA'),
        status: (existingItem?.status as SpecStatus) || (hasValue ? 'CONFIRMADO' : 'NAO_INFORMADO'),
        source: existingItem?.source || '',
        sourceUrl: existingItem?.sourceUrl || '',
        verificationDate: existingItem?.verificationDate || '',
        notes: existingItem?.notes || '',
      };
    });

    return {
      title: canonicalSec.title,
      items,
    };
  });

  // 2. Normaliza o formato do parâmetro incomingSections (pode ser array de seções, array plano de itens ou objeto chave-valor)
  interface NormalizedInputItem {
    preferredSectionIdx?: number;
    label: string;
    value: string;
    confidence?: SpecConfidence;
    status?: SpecStatus;
    source?: string;
    sourceUrl?: string;
    notes?: string;
  }

  const rawInputItems: NormalizedInputItem[] = [];

  if (Array.isArray(incomingSections)) {
    incomingSections.forEach((secOrItem, idx) => {
      if (!secOrItem) return;

      // Se for uma seção com array de itens (ex: { title, items })
      if (typeof secOrItem === 'object' && (secOrItem.items || secOrItem.itens || secOrItem.especificacoes)) {
        const secTitle = String(secOrItem.title || secOrItem.titulo || secOrItem.name || '').trim();
        const preferredIdx = findCanonicalSectionIndex(secTitle);
        const subItems: any[] = Array.isArray(secOrItem.items)
          ? secOrItem.items
          : Array.isArray(secOrItem.itens)
          ? secOrItem.itens
          : Array.isArray(secOrItem.especificacoes)
          ? secOrItem.especificacoes
          : [];

        subItems.forEach((sub) => {
          if (!sub) return;
          if (typeof sub === 'string') {
            const parts = sub.split(/:\s*/);
            if (parts.length >= 2) {
              rawInputItems.push({
                preferredSectionIdx: preferredIdx >= 0 ? preferredIdx : undefined,
                label: parts[0].trim(),
                value: parts.slice(1).join(': ').trim(),
              });
            }
          } else if (typeof sub === 'object') {
            const lbl = String(sub.label || sub.campo || sub.nome || sub.chave || sub.item || '').trim();
            const val = String(sub.value || sub.valor || sub.conteudo || sub.descricao || '').trim();
            if (lbl || val) {
              rawInputItems.push({
                preferredSectionIdx: preferredIdx >= 0 ? preferredIdx : undefined,
                label: lbl,
                value: val,
                confidence: sub.confidence,
                status: sub.status,
                source: sub.source,
                sourceUrl: sub.sourceUrl,
                notes: sub.notes,
              });
            }
          }
        });
      }
      // Se for um item plano (ex: { label, value })
      else if (typeof secOrItem === 'object' && (secOrItem.label || secOrItem.campo || secOrItem.chave)) {
        const lbl = String(secOrItem.label || secOrItem.campo || secOrItem.chave || '').trim();
        const val = String(secOrItem.value || secOrItem.valor || '').trim();
        if (lbl || val) {
          rawInputItems.push({
            label: lbl,
            value: val,
            confidence: secOrItem.confidence,
            status: secOrItem.status,
            source: secOrItem.source,
            sourceUrl: secOrItem.sourceUrl,
            notes: secOrItem.notes,
          });
        }
      }
    });
  } else if (incomingSections && typeof incomingSections === 'object') {
    // Se for um dicionário chave-valor plano
    Object.entries(incomingSections).forEach(([k, v]) => {
      if (v !== undefined && v !== null && typeof v !== 'object') {
        rawInputItems.push({
          label: k,
          value: String(v).trim(),
        });
      }
    });
  }

  // 3. Processa e distribui deterministicamente cada item recebido
  rawInputItems.forEach((item) => {
    const rawLabel = cleanMarkdownAndHtmlEntities(item.label);
    const rawVal = cleanSpecValue(item.value);
    if (!rawLabel && !rawVal) return;

    // A. Primeiro testa decomposição composta (ex: freios conjugados, bateria completa)
    const decomposed = decomposeCompoundSpec(rawLabel, rawVal);
    if (decomposed.length > 0) {
      decomposed.forEach((decomp) => {
        const targetSec = result[decomp.sectionIndex];
        if (!targetSec) return;

        const targetItemIdx = targetSec.items.findIndex(
          (it) => normalizeLabelKey(it.label) === normalizeLabelKey(decomp.label)
        );

        const newConfidence: SpecConfidence = decomp.confidence || item.confidence || 'ALTA';
        const newStatus: SpecStatus = item.status || 'CONFIRMADO';

        if (targetItemIdx >= 0) {
          const currentVal = targetSec.items[targetItemIdx].value;
          const currentHasValue = currentVal &&
            currentVal !== 'Não informado pelo fabricante' &&
            currentVal !== 'Não informado';
          const newIsUninformed = !decomp.value || /n[aã]o\s*informad/i.test(decomp.value);

          // Não sobrescreve especificação confirmada por valor não informado
          if (newIsUninformed && currentHasValue) {
            return;
          }

          targetSec.items[targetItemIdx] = {
            ...targetSec.items[targetItemIdx],
            value: cleanSpecValue(decomp.value),
            confidence: newConfidence,
            status: newStatus,
            source: item.source || targetSec.items[targetItemIdx].source || 'Ficha Técnica Oficial',
            sourceUrl: item.sourceUrl || targetSec.items[targetItemIdx].sourceUrl,
          };
        }
      });
      return;
    }

    // B. Correspondência canônica global
    const match = findCanonicalMatch(rawLabel, item.preferredSectionIdx);

    if (match) {
      const targetSec = result[match.sectionIndex];
      const targetItemIdx = targetSec.items.findIndex(
        (it) => normalizeLabelKey(it.label) === normalizeLabelKey(match.canonicalLabel)
      );

      // Sanitizações contextuais
      let sanitizedVal = cleanSpecValue(rawVal);
      const normCanonical = normalizeLabelKey(match.canonicalLabel);

      if (normCanonical.includes('tipodemotor')) {
        sanitizedVal = sanitizeMotorTypeValue(sanitizedVal);
      } else if (normCanonical.includes('capacidadetotal') || normCanonical.includes('wh')) {
        sanitizedVal = sanitizeBatteryCapacityValue(sanitizedVal);
      } else if (normCanonical.includes('capacidademaxima') || normCanonical.includes('pesomaximo')) {
        // Capacidade Máxima é peso suportado (kg) — rejeita valores de bateria (Ah, Wh, Volts)
        if (/\b\d+(?:\.\d+)?\s*(?:ah|wh|mah|v)\b/i.test(sanitizedVal) || /bateria/i.test(sanitizedVal)) {
          // Redireciona para Capacidade Total da bateria se estiver desinformada
          const batteryCapItem = result[2]?.items?.find((it) => normalizeLabelKey(it.label).includes('capacidadetotal'));
          if (batteryCapItem && (!batteryCapItem.value || batteryCapItem.value.includes('Não informado'))) {
            batteryCapItem.value = sanitizeBatteryCapacityValue(sanitizedVal);
            batteryCapItem.status = 'CONFIRMADO';
            batteryCapItem.confidence = 'ALTA';
          }
          sanitizedVal = scalars?.pesoKg ? `${scalars.pesoKg} kg` : '120 kg';
        } else {
          const mNum = sanitizedVal.match(/^(\d{2,3})$/);
          if (mNum) sanitizedVal = `${mNum[1]} kg`;
        }
      } else if (normCanonical.includes('torquemaximo') || normCanonical.includes('torque')) {
        sanitizedVal = sanitizeTorqueValue(sanitizedVal);
      } else if (normCanonical.includes('quimicadabateria')) {
        sanitizedVal = sanitizeBatteryChemistryValue(sanitizedVal);
      } else if (normCanonical.includes('enquadramentocontran')) {
        sanitizedVal = sanitizeContranValue(sanitizedVal, scalars?.potenciaW);
      } else if (normCanonical.includes('arodas') || normCanonical.includes('aro')) {
        sanitizedVal = sanitizeRimValue(sanitizedVal);
      } else if (normCanonical.includes('dobravel')) {
        const isMaterial = /a[cç]o|carbono|alum[ií]nio|magn[eé]sio|ferro|liga/i.test(sanitizedVal);
        if (isMaterial) {
          // Atribui o material ao Material do Quadro
          const frameMatItem = result[3]?.items?.find((it) => normalizeLabelKey(it.label).includes('materialdoquadro'));
          if (frameMatItem && (!frameMatItem.value || frameMatItem.value.includes('Não informado'))) {
            let matName = sanitizedVal;
            if (/a[cç]o\s*carbono/i.test(sanitizedVal)) matName = 'Aço Carbono de Alta Resistência';
            else if (/alum[ií]nio/i.test(sanitizedVal)) {
              matName = /6061|t6/i.test(sanitizedVal) ? 'Liga de Alumínio 6061' : 'Alumínio';
            }
            frameMatItem.value = matName;
            frameMatItem.status = 'CONFIRMADO';
            frameMatItem.confidence = 'ALTA';
          }
          sanitizedVal = 'Sim, quadro dobrável';
        } else if (/^(sim|s|true|yes|dobr[aá]vel|com\s*dobra)$/i.test(sanitizedVal.trim())) {
          sanitizedVal = 'Sim, quadro dobrável';
        } else if (/^(n[aã]o|nao|n|false|no|fix[oa]|r[ií]gid[oa])$/i.test(sanitizedVal.trim())) {
          sanitizedVal = 'Não';
        }
      } else if (normCanonical.includes('numerodemarchas')) {
        if (/^(24|36|48|52|60|72)\s*(?:v|velocidades?)$/i.test(sanitizedVal) || /^\d{2,}\s*v$/i.test(sanitizedVal)) {
          sanitizedVal = '1 Velocidade (Monomarcha)';
        }
      } else if (normCanonical.includes('cambiotraseiro')) {
        if (/^(24|36|48|52|60|72)\s*(?:v|velocidades?)$/i.test(sanitizedVal) || /^\d{2,}\s*v$/i.test(sanitizedVal) || /velocidades/i.test(sanitizedVal)) {
          sanitizedVal = 'Monomarcha (Single Speed / Sem Câmbio)';
        }
      }

      const isUninformed = !sanitizedVal ||
        /n[aã]o\s*informad/i.test(sanitizedVal) ||
        /^(n[aã]o\s*consta|n\/?a|pendente|a\s*confirmar|a\s*definir|-|--)$/i.test(sanitizedVal.trim());

      const finalVal = isUninformed ? 'Não informado pelo fabricante' : sanitizedVal.trim();
      const finalConf: SpecConfidence = isUninformed ? 'NAO_CONFIRMADA' : (item.confidence || 'ALTA');
      const finalStatus: SpecStatus = isUninformed ? 'NAO_INFORMADO' : (item.status || 'CONFIRMADO');

      if (targetItemIdx >= 0) {
        const currentVal = targetSec.items[targetItemIdx].value;
        const currentHasValue = currentVal &&
          currentVal !== 'Não informado pelo fabricante' &&
          currentVal !== 'Não informado';

        // Não sobrescreve especificação confirmada por valor não informado
        if (isUninformed && currentHasValue) {
          return;
        }

        targetSec.items[targetItemIdx] = {
          ...targetSec.items[targetItemIdx],
          value: finalVal,
          confidence: finalConf,
          status: finalStatus,
          source: item.source || targetSec.items[targetItemIdx].source || 'Ficha Técnica Oficial',
          sourceUrl: item.sourceUrl || targetSec.items[targetItemIdx].sourceUrl,
          verificationDate: item.notes || targetSec.items[targetItemIdx].verificationDate,
        };
      }
    }
  });

  // 4. Sincronização determinística com escalares principais
  const primaryDomain = scalars?.marca
    ? `${String(scalars.marca).toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`
    : undefined;

  if (scalars) {
    // 4.1 Uso Indicado (Bloco 1)
    if (scalars.usoPrincipal) {
      const usoItem = result[0]?.items?.find(
        (it) => normalizeLabelKey(it.label).includes('usoindicado') || normalizeLabelKey(it.label).includes('categoria')
      );
      if (usoItem && (!usoItem.value || usoItem.value === 'Não informado pelo fabricante')) {
        usoItem.value = String(scalars.usoPrincipal);
        usoItem.status = 'CONFIRMADO';
        usoItem.confidence = 'ALTA';
        usoItem.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.2 Potência Nominal (Bloco 1) e Bloco 2
    if (scalars.potenciaW && Number(scalars.potenciaW) > 0) {
      const potW = Number(scalars.potenciaW);
      const potItem1 = result[0]?.items?.find((it) => normalizeLabelKey(it.label).includes('potencianominal'));
      if (potItem1 && (!potItem1.value || potItem1.value === 'Não informado pelo fabricante')) {
        potItem1.value = `${potW}W`;
        potItem1.status = 'CONFIRMADO';
        potItem1.confidence = 'ALTA';
        potItem1.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.3 Autonomia Estimada (Bloco 1)
    if (scalars.autonomiaKm && Number(scalars.autonomiaKm) > 0) {
      const autoItem1 = result[0]?.items?.find(
        (it) => normalizeLabelKey(it.label).includes('autonomiaestimada') || normalizeLabelKey(it.label).includes('autonomia')
      );
      if (autoItem1 && (!autoItem1.value || autoItem1.value === 'Não informado pelo fabricante')) {
        autoItem1.value = `Até ${scalars.autonomiaKm} km`;
        autoItem1.status = 'CONFIRMADO';
        autoItem1.confidence = 'ALTA';
        autoItem1.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.4 Tempo de Recarga (Bloco 3)
    if (scalars.tempoCargaHoras && Number(scalars.tempoCargaHoras) > 0) {
      const timeItem = result[2]?.items?.find(
        (it) => normalizeLabelKey(it.label).includes('recarga') || normalizeLabelKey(it.label).includes('tempo')
      );
      if (timeItem && (!timeItem.value || timeItem.value === 'Não informado pelo fabricante')) {
        timeItem.value = `${scalars.tempoCargaHoras} a ${Number(scalars.tempoCargaHoras) + 1} horas`;
        timeItem.status = 'CONFIRMADO';
        timeItem.confidence = 'ALTA';
        timeItem.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.5 Peso Total (Bloco 1)
    if (scalars.pesoKg && Number(scalars.pesoKg) > 0) {
      const pesoItem = result[0]?.items?.find(
        (it) => normalizeLabelKey(it.label).includes('pesototal') || normalizeLabelKey(it.label).includes('peso')
      );
      if (pesoItem && (!pesoItem.value || pesoItem.value === 'Não informado pelo fabricante')) {
        pesoItem.value = `${scalars.pesoKg} kg`;
        pesoItem.status = 'CONFIRMADO';
        pesoItem.confidence = 'ALTA';
        pesoItem.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.6 Dobrável (Bloco 7)
    if (scalars.usoPrincipal && /dobr[aá]vel/i.test(scalars.usoPrincipal)) {
      const dobraItem = result[6]?.items?.find((it) => normalizeLabelKey(it.label).includes('dobravel'));
      if (dobraItem && (!dobraItem.value || dobraItem.value === 'Não informado pelo fabricante')) {
        dobraItem.value = 'Sim, mecanismo de dobra integrado';
        dobraItem.status = 'CONFIRMADO';
        dobraItem.confidence = 'ALTA';
        dobraItem.source = primaryDomain || 'Ficha Técnica';
      }
    }

    // 4.7 Bloco 10 (Auditoria CONTRAN e Fonte)
    const contranItem = result[9]?.items?.find((it) => normalizeLabelKey(it.label).includes('contran'));
    if (contranItem && (!contranItem.value || contranItem.value === 'Não informado pelo fabricante')) {
      contranItem.value = sanitizeContranValue('', scalars.potenciaW);
      contranItem.status = 'CONFIRMADO';
      contranItem.confidence = 'ALTA';
      contranItem.source = 'Resolução CONTRAN 996/2023';
    }

    const reviewDateItem = result[9]?.items?.find((it) => normalizeLabelKey(it.label).includes('ultimarevisao'));
    if (reviewDateItem && (!reviewDateItem.value || reviewDateItem.value === 'Não informado pelo fabricante')) {
      reviewDateItem.value = new Date().toLocaleDateString('pt-BR');
      reviewDateItem.status = 'CONFIRMADO';
      reviewDateItem.confidence = 'ALTA';
      reviewDateItem.source = 'TuaVia Lab';
    }

    const statusFichaItem = result[9]?.items?.find((it) => normalizeLabelKey(it.label).includes('statusdafichatecnica'));
    if (statusFichaItem && (!statusFichaItem.value || statusFichaItem.value === 'Não informado pelo fabricante')) {
      statusFichaItem.value = 'Auditada & Verificada pelo TuaVia';
      statusFichaItem.status = 'CONFIRMADO';
      statusFichaItem.confidence = 'ALTA';
      statusFichaItem.source = 'TuaVia Lab';
    }
  }

  // 5. Retorna resultado sem auditoria de IA (removida)
  return result;
}

/* ══════════════════════════════════════════════════════════════════
   ALOCAÇÃO DE ESPECIFICAÇÕES ETIQUETADAS
   ──────────────────────────────────────────────────────────────────
   Ponto único de entrada para alocar especificações que chegam de
   qualquer fonte (scanner determinístico ou LLM) nas 10 seções canônicas.

   Antes existiam dois alocadores paralelos — `allocateAndNormalizeSpecSections`
   (determinístico) e `allocateFromTaggedSpecs` (caminho LLM, que chamava uma
   função inexistente) — e eles davam resultados diferentes para o mesmo
   documento. Agora existe um só: as etiquetas do LLM são convertidas no
   formato de entrada que o alocador canônico já entende, e ele faz o resto.
   ══════════════════════════════════════════════════════════════════ */

export const STANDARD_SPEC_BLUEPRINT = CANONICAL_SPEC_SECTIONS;

export interface TaggedSpecItemLike {
  blocoIndex?: number;
  blocoNome?: string;
  tag?: string;
  campo?: string;
  label?: string;
  valor?: string | number;
  value?: string | number;
  evidencia?: string;
  evidence?: string;
  confidence?: SpecConfidence | 'CALCULADA' | string;
  status?: SpecStatus | string;
  source?: string;
  sourceUrl?: string;
  notes?: string;
}

function confidenceFromTagged(value?: string): SpecConfidence {
  switch ((value || '').toUpperCase()) {
    case 'ALTA':
      return 'ALTA';
    case 'MEDIA':
    case 'CALCULADA':
      return 'MEDIA';
    case 'BAIXA':
      return 'BAIXA';
    case 'SUSPEITA':
      return 'SUSPEITA';
    default:
      return 'NAO_CONFIRMADA';
  }
}

function statusFromTagged(value?: string): SpecStatus {
  switch ((value || '').toUpperCase()) {
    case 'CONFIRMADO':
      return 'CONFIRMADO';
    case 'CALCULADO':
      return 'CALCULADO';
    case 'FONTE_COMERCIAL':
      return 'FONTE_COMERCIAL';
    case 'CONFLITANTE':
      return 'CONFLITANTE';
    case 'SUSPEITO':
      return 'SUSPEITO';
    default:
      return 'NAO_INFORMADO';
  }
}

/**
 * Converte uma lista de especificações etiquetadas no formato de entrada do
 * alocador canônico (array de `{ title, items }`) e delega para ele.
 *
 * `rawText` e `parsedData` são aceitos e ignorados de propósito: a alocação é
 * uma função pura do conteúdo já extraído. A evidência de cada item vira o
 * campo `source`, que o auditor depois valida.
 */
export function allocateFromTaggedSpecs(
  taggedSpecs: TaggedSpecItemLike[] | null | undefined,
  rawText?: string,
  identity?: { marca?: string; modelo?: string; [key: string]: unknown } | null,
  parsedData?: unknown
): EBikeSpecSection[] {
  void rawText;
  void parsedData;

  const grouped = new Map<
    string,
    Array<{
      label: string;
      value: string;
      status: SpecStatus;
      confidence: SpecConfidence;
      source: string;
      sourceUrl: string;
      notes: string;
    }>
  >();

  for (const tagged of taggedSpecs ?? []) {
    const label = cleanSpecValue(tagged.campo ?? tagged.label ?? '');
    if (!label) continue;

    const rawValue = tagged.valor ?? tagged.value ?? '';
    const value = cleanSpecValue(typeof rawValue === 'number' ? String(rawValue) : rawValue);
    if (!value) continue;

    // Respeita o bloco declarado quando ele bate com uma seção canônica.
    let sectionTitle: string | null = null;
    const byIndex =
      typeof tagged.blocoIndex === 'number' ? CANONICAL_SPEC_SECTIONS[tagged.blocoIndex] : undefined;
    if (byIndex?.title) {
      sectionTitle = byIndex.title;
    } else if (tagged.blocoNome) {
      const matched = findCanonicalSectionIndex(tagged.blocoNome);
      if (matched >= 0) sectionTitle = CANONICAL_SPEC_SECTIONS[matched]?.title ?? null;
    }
    if (!sectionTitle) {
      const matched = findCanonicalMatch(label);
      if (matched) sectionTitle = CANONICAL_SPEC_SECTIONS[matched.sectionIndex]?.title ?? null;
    }
    // Sem destino canônico conhecido, deixa o alocador decidir pelo rótulo.
    if (!sectionTitle) sectionTitle = '10. Auditoria de Fontes & Dados';

    const list = grouped.get(sectionTitle) ?? [];
    list.push({
      label,
      value,
      status: statusFromTagged(tagged.status),
      confidence: confidenceFromTagged(tagged.confidence),
      source: cleanSpecValue(tagged.source ?? tagged.evidencia ?? tagged.evidence ?? ''),
      sourceUrl: tagged.sourceUrl ?? '',
      notes: tagged.notes ?? '',
    });
    grouped.set(sectionTitle, list);
  }

  return allocateAndNormalizeSpecSections(
    undefined,
    Array.from(grouped.entries()).map(([title, items]) => ({ title, items })),
    {
      potenciaW: identity?.potenciaW as number | string | undefined,
      autonomiaKm: identity?.autonomiaKm as number | string | undefined,
      pesoKg: identity?.pesoKg as number | string | undefined,
      tempoCargaHoras: identity?.tempoCargaHoras as number | string | undefined,
      usoPrincipal: identity?.categoria as string | undefined,
      marca: identity?.marca,
      modelo: identity?.modelo,
    }
  );
}
