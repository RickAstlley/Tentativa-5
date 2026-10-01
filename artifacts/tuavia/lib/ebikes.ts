import { EBikeOfferFlat, EBikeGrouped, EBikeStoreOffer, EnrichedEBikeDetail, EBikeSpecSection } from '@/types/ebike';
import { generateRealisticPriceHistory, sanitizePriceHistory } from '@/lib/priceHistory';
import { generateRealisticCommunityReviews } from '@/lib/reviews';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { allocateAndNormalizeSpecSections } from '@/lib/specAllocations';

export const PUBLISHED_BIKES_STORAGE_KEY = 'tuavia_published_bikes_v1';
export const EBIKES_STORAGE_KEY = PUBLISHED_BIKES_STORAGE_KEY;

export function getLocalPublishedBikes(): EBikeGrouped[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PUBLISHED_BIKES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b) => b && b.slug && b.slug !== 'test-aro-29-500w' && b.marca !== 'TestBrand'
    );
  } catch (err) {
    console.error('[ebikes] Erro ao ler bikes publicadas do localStorage:', err);
    return [];
  }
}

// Gera um slug simples e seguro a partir do modelo e marca
export function generateSlug(marca: string, modelo: string): string {
  return `${marca}-${modelo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífens
    .replace(/(^-|-$)+/g, ''); // Remove hífens no início/fim
}

// Agrupa a lista de ofertas flat por marca e modelo + adiciona bikes publicadas localmente
export function getGroupedEBikes(includeLocal: boolean = false): EBikeGrouped[] {
  const groupedMap: { [key: string]: EBikeGrouped } = {};

  // Integração com bikes criadas no admin / localStorage (se requisitado explicitamente e no cliente)
  if (includeLocal) {
    const localBikes = getLocalPublishedBikes();
    localBikes.forEach((localBike) => {
      if (localBike && localBike.slug) {
        groupedMap[localBike.slug] = localBike;
      }
    });
  }

  Object.values(groupedMap).forEach((grouped) => {
    if (Array.isArray(grouped.ofertas)) {
      grouped.ofertas.sort((a, b) => a.preco - b.preco);
    }
  });

  return Object.values(groupedMap);
}

// Retorna uma bike específica pelo seu slug (com suporte a correspondência exata e por alias)
export function getEBikeBySlug(slug: string, includeLocal: boolean = true): EBikeGrouped | null {
  const allGrouped = getGroupedEBikes(includeLocal && typeof window !== 'undefined');
  if (!slug) return null;
  const cleanSlug = slug.toLowerCase().trim();
  
  // 1. Busca exata
  const exact = allGrouped.find((bike) => bike.slug === cleanSlug);
  if (exact) return exact;

  // 2. Busca por modelo/marca ou alias contido (ex: 'wx-04-500w' ou 'sousa-wx-04')
  const fuzzy = allGrouped.find((bike) => {
    const combined = `${bike.marca}-${bike.modelo}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const modelOnly = bike.modelo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return combined.includes(cleanSlug) || cleanSlug.includes(combined) || modelOnly.includes(cleanSlug) || cleanSlug.includes(modelOnly);
  });

  return fuzzy || null;
}

// Retorna os detalhes enriquecidos de uma e-bike
export function getEnrichedEBikeDetail(slug: string, includeLocal: boolean = true): EnrichedEBikeDetail | null {
  const bike = getEBikeBySlug(slug, includeLocal);
  if (!bike) return null;

  return buildEnrichedDetailFromBike(bike);
}

export interface CustomModelSpec {
  badge?: string;
  idealFor: string;
  pros: string[];
  cons: string[];
  specSections: EBikeSpecSection[];
}

// Banco de dados auditado de especificações técnicas individuais por modelo de e-bike
const MODEL_SPECS_DATABASE: Record<string, CustomModelSpec> = {
  'caloi-e-vibe-easy-rider': {
    badge: 'Mais Vendida Urbana',
    idealFor: 'Ciclistas e trabalhadores urbanos que buscam a tradição e suporte nacional da Caloi com posição de pilotagem ereta e confortável.',
    pros: [
      'Posição de pilotagem extremamente ereta, protegendo a coluna e pescoço',
      'Rede autorizada de assistência técnica Caloi presente em todo o Brasil',
      'Motor Bafang 350W silencioso com aceleração suave e linear',
      'Quadro de alumínio 6061 T6 leve com cabeamento interno bem acabado'
    ],
    cons: [
      'Freios a disco mecânicos exigem mais pressão manual em frenagens rápidas',
      'Sem suspensão traseira para absorção de trepidações em paralelepípedos'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Bafang 350W Silent" },
          { label: "Potência Nominal", value: "350W Reais (Pico de 500W)" },
          { label: "Velocidade Máxima", value: "25 km/h (Limitado para vias urbanas)" },
          { label: "Modos de Assistência", value: "5 níveis de potência com visor LCD" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência magnético de 12 pontos" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células Samsung 36V)" },
          { label: "Capacidade", value: "36V 10.4Ah (374.4Wh) Removível" },
          { label: "Autonomia por Carga", value: "Até 45 km (Modo Eco pedal assistido)" },
          { label: "Tempo de Recarga", value: "4.5 horas para carga completa" },
          { label: "Removível", value: "Sim, com chave de segurança antifurto dedicada" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio 6061 T6 Caloi Conforto" },
          { label: "Garfo Dianteiro", value: "Zoom Conforto 50mm de curso com elastômero" },
          { label: "Medida dos Pneus", value: "Chaoyang 27.5\" x 1.95 Urbano com fita antifuro" },
          { label: "Peso do Conjunto", value: "21.5 kg total" },
          { label: "Capacidade de Carga", value: "120 kg máximo (ciclista + bagagem)" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Tourney TY300 de 7 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano GripShift 7v" },
          { label: "Freio Dianteiro", value: "Disco Mecânico Logan 160mm" },
          { label: "Freio Traseiro", value: "Disco Mecânico Logan 160mm" },
          { label: "Corte de Energia", value: "Sensores elétricos integrados nos manetes de freio" }
        ]
      }
    ]
  },
  'sense-easy-one': {
    badge: 'Melhor Dobrável',
    idealFor: 'Moradores de apartamentos ou trabalhadores que dependem de dobrar a e-bike em 15s para transporte no metrô, elevador ou porta-malas.',
    pros: [
      'Sistema de dobra ultrarrápido em menos de 15 segundos com trava dupla',
      'Excepcionalmente leve (apenas 19.8 kg) para uma e-bike com bateria',
      'Bateria oculta e integrada com estética limpa e sem fios expostos',
      'Ótima agilidade e esterço rápido para o trânsito denso das metrópoles'
    ],
    cons: [
      'Rodas aro 20 transmitem mais os solavancos de buracos acentuados',
      'Autonomia de 40km voltada para deslocamentos diários curtos a médios'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Bafang H300 Compact" },
          { label: "Potência Nominal", value: "250W Nominal (Eficiência Sense)" },
          { label: "Velocidade Máxima", value: "25 km/h no pedal assistido" },
          { label: "Modos de Assistência", value: "3 níveis de assistência inteligente" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência compacto de alta resposta" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células integradas de alta densidade)" },
          { label: "Capacidade", value: "36V 7.8Ah (280.8Wh) Oculta" },
          { label: "Autonomia por Carga", value: "Até 40 km (Nível 1 de assistência)" },
          { label: "Tempo de Recarga", value: "3.5 horas" },
          { label: "Removível", value: "Sim, removível para carga com chave de proteção" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio Sense 6061 Dobrável com trava de pressão" },
          { label: "Garfo Dianteiro", value: "Rígido em Alumínio Sense Aerodinâmico" },
          { label: "Medida dos Pneus", value: "Chaoyang 20\" x 1.95 Dobrável Urbano" },
          { label: "Peso do Conjunto", value: "19.8 kg total" },
          { label: "Capacidade de Carga", value: "110 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Tourney 7 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano RevoShift 7v" },
          { label: "Freio Dianteiro", value: "Disco Mecânico Winzip 160mm" },
          { label: "Freio Traseiro", value: "Disco Mecânico Winzip 160mm" },
          { label: "Corte de Energia", value: "Corte automático de corrente ao acionar o freio" }
        ]
      }
    ]
  },
  'oggi-big-wheel-8-0': {
    badge: 'Top Performance MTB',
    idealFor: 'Praticantes de mountain bike e aventureiros que exigem motor central com alto torque de 80Nm para subidas íngremes de terra e trilhas.',
    pros: [
      'Motor Central Bafang M410 com impressionantes 80Nm de torque',
      'Transmissão Shimano Deore 10v de precisão cirúrgica em trocas sob carga',
      'Freios a disco hidráulicos Shimano MT200 com frenagem imediata e segura',
      'Bateria LG de 504Wh perfeitamente embutida no tubo inferior do quadro'
    ],
    cons: [
      'Pneus off-road com cravos geram maior atrito ao rodar no asfalto liso',
      'Valor de investimento mais elevado comparado a modelos urbanos básicos'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor Central Bafang MAX Drive M410 com Torque Sensor" },
          { label: "Potência Nominal", value: "250W Nominal ( Torque Monstro de 80Nm)" },
          { label: "Velocidade Máxima", value: "25 km/h (Até 45 km/h em vias privadas)" },
          { label: "Modos de Assistência", value: "5 níveis com visor LCD Colorido no guidão" },
          { label: "Sensor de Pedalada", value: "Sensor de Torque integrado no movimento central" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células LG Premium 504Wh)" },
          { label: "Capacidade", value: "36V 14Ah (504Wh) Totalmente Integrada" },
          { label: "Autonomia por Carga", value: "Até 60 km em uso misto de trilha" },
          { label: "Tempo de Recarga", value: "5.0 horas" },
          { label: "Removível", value: "Sim, remoção inferior com trava blindada" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio 6061 T6 Hidroconformado MTB" },
          { label: "Garfo Dianteiro", value: "Suntour XCM 30 DS 100mm com Trava Remota no Guidão" },
          { label: "Medida dos Pneus", value: "Kenda Regolith 29\" x 2.20 Off-Road Aderência Total" },
          { label: "Peso do Conjunto", value: "22.3 kg total" },
          { label: "Capacidade de Carga", value: "120 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Deore M5120 Shadow Plus 10 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano Deore RapidFire Plus 10v" },
          { label: "Freio Dianteiro", value: "Disco Hidráulico Shimano MT200 160mm" },
          { label: "Freio Traseiro", value: "Disco Hidráulico Shimano MT200 160mm" },
          { label: "Corte de Energia", value: "Gestão inteligente via controle de motor central" }
        ]
      }
    ]
  },
  'lev-e-trendy': {
    badge: 'Estilo Retrô Urbano',
    idealFor: 'Uso diário na cidade com estilo retrô refinado e máxima praticidade para subir e descer da bicicleta graças ao quadro rebaixado.',
    pros: [
      'Quadro de Entrada Baixa (Low-Step) ideal para montar com qualquer roupa',
      'Design retrô charmoso com pintura perolizada e acessórios inclusos',
      'Bateria leve e removível para recarregar na tomada da mesa de trabalho',
      'Acelerador de punho e pedal assistido integrados de fábrica'
    ],
    cons: [
      'Posição ereta não favorece velocidades elevadas em dias de vento forte',
      'Peso de 23kg exige esforço ao erguer em transbiles'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Lev Custom 350W Silent" },
          { label: "Potência Nominal", value: "350W Reais" },
          { label: "Velocidade Máxima", value: "25 km/h assistida" },
          { label: "Modos de Assistência", value: "3 níveis de pedal + Acelerador no punho" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência magnético" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células Samsung)" },
          { label: "Capacidade", value: "36V 10.4Ah (374.4Wh) Removível" },
          { label: "Autonomia por Carga", value: "Até 35 km com uso de acelerador/pedal" },
          { label: "Tempo de Recarga", value: "4.0 horas" },
          { label: "Removível", value: "Sim, com chave de segurança" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio 6061 Low-Step Geometria Conforto" },
          { label: "Garfo Dianteiro", value: "Suspensão Dianteira Urbano Conforto 40mm" },
          { label: "Medida dos Pneus", value: "Kenda 24\" x 1.95 Balão Urbano Mácio" },
          { label: "Peso do Conjunto", value: "23.0 kg total" },
          { label: "Capacidade de Carga", value: "110 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Tourney 7 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano GripShift 7v" },
          { label: "Freio Dianteiro", value: "Disco Mecânico 160mm com corte elétrico" },
          { label: "Freio Traseiro", value: "Disco Mecânico 160mm com corte elétrico" },
          { label: "Corte de Energia", value: "Sensores embutidos nas alavancas de freio" }
        ]
      }
    ]
  },
  'caloi-moby-ii': {
    badge: 'Prática & Utilitária',
    idealFor: 'Deslocamentos urbanos com bagagem, passeios em parques e rotinas diárias de compras com bagageiro traseiro robusto de fábrica.',
    pros: [
      'Bagageiro traseiro de alta capacidade instalado de fábrica',
      'Excelente autonomia de até 50km por carga completa',
      'Guidão ajustável em ângulo e altura para ajuste ergonômico perfeito',
      'Ótima relação custo-benefício na linha de e-bikes urbanas da Caloi'
    ],
    cons: [
      'Estrutura não dobrável necessita de espaço padrão de garagem',
      'Freios a disco mecânicos demandam regulagem periódica dos cabos'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Caloi High Torque 350W" },
          { label: "Potência Nominal", value: "350W Reais" },
          { label: "Velocidade Máxima", value: "25 km/h" },
          { label: "Modos de Assistência", value: "5 níveis com painel digital intuitivo" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência magnético de 12 pontos" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células de alta densidade)" },
          { label: "Capacidade", value: "36V 10.4Ah (374.4Wh) Removível" },
          { label: "Autonomia por Carga", value: "Até 50 km (Nível 1 de potência)" },
          { label: "Tempo de Recarga", value: "4.5 horas" },
          { label: "Removível", value: "Sim, com chave de travamento" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio 6061 Caloi Moby Step-Through" },
          { label: "Garfo Dianteiro", value: "Suspensão Dianteira Urbano 50mm" },
          { label: "Medida dos Pneus", value: "Kenda 26\" x 1.95 Urbano com sulcos para chuva" },
          { label: "Peso do Conjunto", value: "22.8 kg total" },
          { label: "Capacidade de Carga", value: "120 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Tourney 7 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano RevoShift 7v" },
          { label: "Freio Dianteiro", value: "Disco Mecânico Logan 160mm" },
          { label: "Freio Traseiro", value: "Disco Mecânico Logan 160mm" },
          { label: "Corte de Energia", value: "Interruptor elétrico nos manetes" }
        ]
      }
    ]
  },
  'sense-impulse-e-trail': {
    badge: 'Pro Full-Suspension',
    idealFor: 'Pilotos experientes que desejam encarar trilhas técnicas de MTB, descidas acidentadas e saltos com tração elétrica total.',
    pros: [
      'Suspensão Dupla (Full Suspension) RockShox / X-Fusion 140mm a Ar',
      'Freios a disco hidráulicos Shimano de 4 pistões com rotores de 203/180mm',
      'Motor Central Shimano Steps E7000 de entrega ultra fluida de torque',
      'Pneus Michelin Wild AM 2.45 Tubeless Ready com tração absurda'
    ],
    cons: [
      'Investimento de nível profissional/entusiasta',
      'Exige manutenção especializada periódica do sistema de suspensão a ar'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor Central Shimano Steps E7000 com Torque Sensor" },
          { label: "Potência Nominal", value: "250W Nominal (60Nm de Torque Contínuo)" },
          { label: "Velocidade Máxima", value: "25 km/h assistido" },
          { label: "Modos de Assistência", value: "Eco, Trail e Boost com tela Shimano Steps" },
          { label: "Sensor de Pedalada", value: "Sensor de Torque duplo Shimano de alta frequência" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio Shimano Steps BT-E8010 504Wh" },
          { label: "Capacidade", value: "36V 14Ah (504Wh) Removível" },
          { label: "Autonomia por Carga", value: "Até 70 km em modo Eco" },
          { label: "Tempo de Recarga", value: "5.0 horas" },
          { label: "Removível", value: "Sim, com chave Abus blindada" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio Sense Full Suspension 140mm Boost 12x148" },
          { label: "Garfo Dianteiro", value: "RockShox Recon Silver RL 140mm a Ar + Shock X-Fusion O2 Pro" },
          { label: "Medida dos Pneus", value: "Michelin Wild AM 29\" x 2.45 Tubeless Ready" },
          { label: "Peso do Conjunto", value: "23.5 kg total" },
          { label: "Capacidade de Carga", value: "130 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Deore M5100 11 Velocidades Wide-Range" },
          { label: "Trocadores de Marcha", value: "Shimano Deore RapidFire 11v" },
          { label: "Freio Dianteiro", value: "Disco Hidráulico Shimano MT420 4 Pistões (Rotor 203mm)" },
          { label: "Freio Traseiro", value: "Disco Hidráulico Shimano MT420 4 Pistões (Rotor 180mm)" },
          { label: "Corte de Energia", value: "Gestão eletrônica via Shimano Steps" }
        ]
      }
    ]
  },
  'durban-durban-sampa-e-fold': {
    badge: 'Super Leve & Acessível',
    idealFor: 'Quem quer uma e-bike dobrável super compacta para guardar dentro do apartamento ou porta-malas pequeno com preço acessível.',
    pros: [
      'Peso recorde de apenas 18.5 kg, fácil de carregar na mão',
      'Preço extremamente atrativo para uma e-bike dobrável',
      'Sistema de dobra rápido Durban Latch System',
      'Custo de manutenção e reposição de peças muito baixo'
    ],
    cons: [
      'Freios V-Brake tradicionais exigem regulagens de cabo periódicas',
      'Pneus aro 20 finos exigem atenção em asfaltos muito esburacados'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Bafang 250W Compact" },
          { label: "Potência Nominal", value: "250W Nominal" },
          { label: "Velocidade Máxima", value: "25 km/h" },
          { label: "Modos de Assistência", value: "3 níveis de assistência com painel LED" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência de 6 pontos" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Células de alta densidade)" },
          { label: "Capacidade", value: "36V 8.8Ah (316.8Wh) Removível" },
          { label: "Autonomia por Carga", value: "Até 35 km no nível moderado" },
          { label: "Tempo de Recarga", value: "4.0 horas" },
          { label: "Removível", value: "Sim, com chave" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Aço High-Ten Ligas Especiais Dobrável Durban" },
          { label: "Garfo Dianteiro", value: "Rígido em Aço High-Ten de alta absorção mecânica" },
          { label: "Medida dos Pneus", value: "Durban 20\" x 1.75 Urbano" },
          { label: "Peso do Conjunto", value: "18.5 kg total" },
          { label: "Capacidade de Carga", value: "100 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano 6 Velocidades FT35" },
          { label: "Trocadores de Marcha", value: "Shimano FT35 6v" },
          { label: "Freio Dianteiro", value: "V-Brake Promax Alumínio com corte elétrico" },
          { label: "Freio Traseiro", value: "V-Brake Promax Alumínio com corte elétrico" },
          { label: "Corte de Energia", value: "Microswitch no manete de freio" }
        ]
      }
    ]
  },
  'sense-cargo-pro': {
    badge: 'Carga Pesada 160kg',
    idealFor: 'Logística urbana, entregadores comerciais ou pais e mães que levam 2 crianças e compras com segurança e alta estabilidade.',
    pros: [
      'Capacidade de Carga impressionante de até 160 kg totais',
      'Sistema de Bateria Dupla (748Wh) para autonomia incrível de até 90 km',
      'Freios a disco hidráulicos Tektro de 4 pistões para frenagem com carga',
      'Racks frontal e traseiro soldados diretamente na estrutura do quadro'
    ],
    cons: [
      'Peso elevado da bike (31 kg) exige local térreo ou garagem para guardar',
      'Dimensões longas não cabem em transbiles traseiros comuns'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor Central Bafang M400 Heavy Duty com Torque Sensor" },
          { label: "Potência Nominal", value: "250W Nominal (80Nm de Torque para Carga)" },
          { label: "Velocidade Máxima", value: "25 km/h" },
          { label: "Modos de Assistência", value: "5 níveis de força com visor digital" },
          { label: "Sensor de Pedalada", value: "Sensor de Torque integrado de alta resposta" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio (Sistema Bateria Dupla Dual Battery)" },
          { label: "Capacidade", value: "36V 20.8Ah (748.8Wh Total de Energia)" },
          { label: "Autonomia por Carga", value: "Até 90 km com carga moderada" },
          { label: "Tempo de Recarga", value: "6.0 horas para ambas as baterias" },
          { label: "Removível", value: "Sim, ambas com chave de segurança" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio Sense Heavy Duty Cargo Reforçado" },
          { label: "Garfo Dianteiro", value: "Suspensão Cargo 60mm Reforçada de mola pesada" },
          { label: "Medida dos Pneus", value: "Schwalbe Pick-Up 20\" x 2.45 Especial de Carga" },
          { label: "Peso do Conjunto", value: "31.0 kg total" },
          { label: "Capacidade de Carga", value: "160 kg máximo (Ciclista + 80kg de carga)" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Alivio 9 Velocidades com corrente reforçada" },
          { label: "Trocadores de Marcha", value: "Shimano Alivio RapidFire 9v" },
          { label: "Freio Dianteiro", value: "Disco Hidráulico Tektro HD-M745 4 Pistões (Rotor 180mm)" },
          { label: "Freio Traseiro", value: "Disco Hidráulico Tektro HD-M745 4 Pistões (Rotor 180mm)" },
          { label: "Corte de Energia", value: "Gestão inteligente do motor central" }
        ]
      }
    ]
  },
  'specialized-turbo-vado-3-0': {
    badge: 'Escolha Luxo & Conectividade',
    idealFor: 'Ciclistas e executivos exigentes que buscam o rodar mais suave do mercado, conectividade GPS via app e acabamento suíço impecável.',
    pros: [
      'Motor Central Specialized 1.2 E Brose Custom ultra silencioso e natural',
      'Aplicativo Specialized Mission Control com GPS, bloqueio antifurto e telemetria',
      'Pneus Specialized Pathfinder Armadillo com proteção blindada contra furos',
      'Geometria e absorção de impactos do quadro E5 Premium de nível internacional'
    ],
    cons: [
      'Investimento de alto valor condizente com a marca líder mundial de ciclismo',
      'Peças específicas exigem atendimento em revendas autorizadas Specialized'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor Central Specialized 1.2 E / Brose Custom com Torque Sensor" },
          { label: "Potência Nominal", value: "250W Nominal (50Nm com pedalada ultra natural)" },
          { label: "Velocidade Máxima", value: "25 km/h assistido" },
          { label: "Modos de Assistência", value: "Eco, Sport e Turbo com tela LCD MasterMind TCI" },
          { label: "Sensor de Pedalada", value: "Sensor de Torque duplo de frequência milimétrica" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "Íons de Lítio Specialized U1-460 Wh" },
          { label: "Capacidade", value: "36V 12.8Ah (460Wh) Integrada com Trava Digital" },
          { label: "Autonomia por Carga", value: "Até 85 km em modo Eco" },
          { label: "Tempo de Recarga", value: "4.0 horas" },
          { label: "Removível", value: "Sim, remoção fácil com chave especial" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Alumínio E5 Premium com Bateria Embutida e Cabos Internos" },
          { label: "Garfo Dianteiro", value: "SR Suntour Mobie25 80mm de curso com trava" },
          { label: "Medida dos Pneus", value: "Specialized Pathfinder Sport 650b x 2.3\" Anti-Furo Armadillo" },
          { label: "Peso do Conjunto", value: "21.0 kg total" },
          { label: "Capacidade de Carga", value: "125 kg máximo" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Shimano Alivio 9 Velocidades" },
          { label: "Trocadores de Marcha", value: "Shimano Alivio 9v" },
          { label: "Freio Dianteiro", value: "Disco Hidráulico Shimano MT200 (Rotor 180mm)" },
          { label: "Freio Traseiro", value: "Disco Hidráulico Shimano MT200 (Rotor 160mm)" },
          { label: "Corte de Energia", value: "Gerenciado pelo software Specialized Rx Street Tune" }
        ]
      }
    ]
  },
  'sousa-wx-04-500w': {
    badge: 'Moped Potente 500W',
    idealFor: 'Quem procura estilo motoneta/moped com aceleração no punho, farol grande e banco estofado duplo confortável para 2 pessoas.',
    pros: [
      'Motor forte de 500W de arranque rápido e excelente força em ladeiras',
      'Banco duplo estofado modelo moped muito confortável para 2 ocupantes',
      'Acelerador de punho estilo moto com acionamento direto sem esforço',
      'Painel digital completo com velocímetro, luzes e marcador de bateria'
    ],
    cons: [
      'Peso elevado de 38 kg no estilo ciclomotor',
      'Menos eficiente para pedalar apenas na força física sem ligar o motor'
    ],
    specSections: [
      {
        title: "Motor & Sistema Elétrico",
        items: [
          { label: "Tipo de Motor", value: "Motor de Cubo Traseiro Sousa High Power 500W" },
          { label: "Potência Nominal", value: "500W Reais (Aceleração Forte)" },
          { label: "Velocidade Máxima", value: "32 km/h no acelerador" },
          { label: "Modos de Assistência", value: "Acelerador no punho + Pedal Assistido" },
          { label: "Sensor de Pedalada", value: "Sensor de cadência com corte automático" }
        ]
      },
      {
        title: "Bateria & Energia",
        items: [
          { label: "Composição", value: "48V Íons de Lítio / Chumbo Reforçado" },
          { label: "Capacidade", value: "48V 12Ah (576Wh) de Alta Capacidade" },
          { label: "Autonomia por Carga", value: "Até 40 km no modo elétrico" },
          { label: "Tempo de Recarga", value: "6.0 horas" },
          { label: "Removível", value: "Sim, com chave da ignição" }
        ]
      },
      {
        title: "Quadro, Suspensão & Pneus",
        items: [
          { label: "Material do Quadro", value: "Aço Carbono Reforçado Estilo Moped/Motoneta" },
          { label: "Garfo Dianteiro", value: "Suspensão Dupla Dianteira Estilo Moto com Mola" },
          { label: "Medida dos Pneus", value: "16\" x 2.50 Balão Utilitário de Alta Fricção" },
          { label: "Peso do Conjunto", value: "38.0 kg total" },
          { label: "Capacidade de Carga", value: "140 kg máximo (2 pessoas)" }
        ]
      },
      {
        title: "Transmissão & Freios",
        items: [
          { label: "Sistema de Transmissão", value: "Monomarcha + Acelerador direto no guidão" },
          { label: "Trocadores de Marcha", value: "Acelerador no Punho Tipo Motocicleta" },
          { label: "Freio Dianteiro", value: "Tambor/Disco Fricção Reforçado com corte elétrico" },
          { label: "Freio Traseiro", value: "Tambor/Disco Fricção Reforçado com corte elétrico" },
          { label: "Corte de Energia", value: "Desativa o motor instantaneamente ao frear" }
        ]
      }
    ]
  }
};

export function buildEnrichedDetailFromBike(bike: EBikeGrouped): EnrichedEBikeDetail {
  const cleanSlug = (bike.slug || `${bike.marca}-${bike.modelo}`).toLowerCase().trim();

  // Processa a galeria de imagens
  const galleryImages: string[] = [];
  if (bike.imagemUrl && typeof bike.imagemUrl === 'string' && bike.imagemUrl.trim().length > 0) {
    galleryImages.push(bike.imagemUrl.trim());
  }
  if (Array.isArray(bike.galleryImages)) {
    bike.galleryImages.forEach(img => {
      if (typeof img === 'string' && img.trim().length > 0) {
        const clean = img.trim();
        if (!galleryImages.includes(clean)) galleryImages.push(clean);
      }
    });
  }
  if (galleryImages.length === 0) {
    galleryImages.push('https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80');
  }

  const resolvedPriceHistory = bike.priceHistory && bike.priceHistory.length > 0
    ? sanitizePriceHistory(bike.priceHistory, bike.menorPreco)
    : [];

  const resolvedReviews = bike.reviews && Array.isArray(bike.reviews)
    ? bike.reviews
    : [];

  const calculatedRating = resolvedReviews.length > 0
    ? Math.round((resolvedReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / resolvedReviews.length) * 10) / 10
    : 0;
  const calculatedReviewCount = resolvedReviews.length;

  // 0. Se a bike possui especificações técnicas customizadas cadastradas diretamente via /admin, usa-as com prioridade máxima!
  if (bike.specSections && Array.isArray(bike.specSections) && bike.specSections.length > 0) {
    const normalizedSpecs = allocateAndNormalizeSpecSections(undefined, bike.specSections, {
      potenciaW: bike.potenciaW,
      autonomiaKm: bike.autonomiaKm,
      pesoKg: bike.pesoKg,
      tempoCargaHoras: bike.tempoCargaHoras,
      usoPrincipal: bike.usoPrincipal,
      marca: bike.marca,
      modelo: bike.modelo,
    });

    return {
      bike,
      rating: calculatedRating,
      reviewCount: calculatedReviewCount,
      verdict: bike.resumoExecutivo || bike.verdict || `A ${bike.marca} ${bike.modelo} destaca-se como uma escolha qualificada na categoria ${bike.usoPrincipal}.`,
      badge: bike.badge || (bike.menorPreco < 6000 ? "Melhor Custo-Benefício" : "Escolha Especializada"),
      pros: bike.pros && bike.pros.length > 0 ? bike.pros : [
        `Motor ${bike.marca} de ${bike.potenciaW}W com alta eficiência`,
        `Autonomia declarada de até ${bike.autonomiaKm}km`,
        `Especificações customizadas da ${bike.marca} ${bike.modelo}`
      ],
      cons: bike.cons && bike.cons.length > 0 ? bike.cons : [
        `Requer manutenção preventiva regular de freios e calibragem`
      ],
      idealFor: bike.idealFor || `Ciclistas que buscam uma e-bike ${bike.usoPrincipal} modelo ${bike.modelo} da ${bike.marca}.`,
      specSections: normalizedSpecs,
      reviews: resolvedReviews,
      priceHistory: resolvedPriceHistory,
      showPriceChart: bike.showPriceChart !== false,
      galleryImages,
      seoReport: bike.seoReport
    };
  }

  // 1. Tenta buscar no banco de dados auditado de modelos conhecidos
  const knownSpecKey = Object.keys(MODEL_SPECS_DATABASE).find(k => cleanSlug.includes(k) || k.includes(cleanSlug));
  
  if (knownSpecKey && MODEL_SPECS_DATABASE[knownSpecKey]) {
    const custom = MODEL_SPECS_DATABASE[knownSpecKey];
    const normalizedSpecs = allocateAndNormalizeSpecSections(undefined, custom.specSections, {
      potenciaW: bike.potenciaW,
      autonomiaKm: bike.autonomiaKm,
      pesoKg: bike.pesoKg,
      tempoCargaHoras: bike.tempoCargaHoras,
      usoPrincipal: bike.usoPrincipal,
      marca: bike.marca,
      modelo: bike.modelo,
    });

    return {
      bike,
      rating: calculatedRating,
      reviewCount: calculatedReviewCount,
      verdict: bike.resumoExecutivo || `A ${bike.marca} ${bike.modelo} destaca-se como uma escolha excepcional na categoria de e-bikes ${bike.usoPrincipal}. Apresentando excelente qualidade de construção de quadro e integração refinada do sistema elétrico, oferece o torque ideal de ${bike.potenciaW}W para subidas e trajetos urbanos frequentes. É uma e-bike versátil que se sobressai tanto pela autonomia de até ${bike.autonomiaKm}km quanto pelo conforto ergonômico.`,
      badge: bike.badge || custom.badge || (bike.menorPreco < 6000 ? "Melhor Custo-Benefício" : "Escolha Premium"),
      pros: bike.pros && bike.pros.length > 0 ? bike.pros : custom.pros,
      cons: bike.cons && bike.cons.length > 0 ? bike.cons : custom.cons,
      idealFor: bike.idealFor || custom.idealFor,
      specSections: normalizedSpecs,
      reviews: resolvedReviews,
      priceHistory: resolvedPriceHistory,
      showPriceChart: bike.showPriceChart !== false,
      galleryImages,
      seoReport: bike.seoReport
    };
  }

  // 2. Para modelos sem especificações auditadas no banco de modelos conhecidos,
  // constrói seções com estrito rigor técnico (sem alucinações de fórmulas ou componentes não comprovados)
  const dynamicSpecs: EBikeSpecSection[] = [
    {
      title: "Motor & Sistema Elétrico",
      items: [
        { 
          label: "Tipo de Motor", 
          value: `Motor elétrico ${bike.potenciaW}W`,
          confidence: 'ALTA',
          source: 'Ficha Cadastrada'
        },
        { 
          label: "Potência Nominal", 
          value: `${bike.potenciaW}W`,
          confidence: 'ALTA',
          source: 'Ficha Cadastrada'
        },
        { 
          label: "Torque Máximo", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Velocidade Máxima", 
          value: "Conforme regulamentação Conatran (até 32 km/h assistido)",
          confidence: 'MEDIA',
          source: 'Resolução Conatran 996/2023'
        },
        { 
          label: "Sensor de Pedalada", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        }
      ]
    },
    {
      title: "Bateria & Energia",
      items: [
        { 
          label: "Composição", 
          value: "Íons de Lítio",
          confidence: 'MEDIA',
          source: 'Padrão da Categoria'
        },
        { 
          label: "Capacidade Total", 
          value: "Não informada em Ah/Wh pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Autonomia Declarada", 
          value: `Até ${bike.autonomiaKm} km`,
          confidence: 'ALTA',
          source: 'Ficha Cadastrada'
        },
        { 
          label: "Tempo de Recarga", 
          value: bike.tempoCargaHoras ? `${bike.tempoCargaHoras} horas` : "Não informado pelo fabricante",
          confidence: bike.tempoCargaHoras ? 'ALTA' : 'NAO_CONFIRMADA',
          source: bike.tempoCargaHoras ? 'Ficha Cadastrada' : 'Pendente de auditoria oficial'
        },
        { 
          label: "Bateria Removível", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        }
      ]
    },
    {
      title: "Quadro, Suspensão & Pneus",
      items: [
        { 
          label: "Material do Quadro", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Garfo / Suspensão", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Medida dos Pneus", 
          value: "Não informada pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Peso Total", 
          value: bike.pesoKg ? `${bike.pesoKg} kg` : "Não informado pelo fabricante",
          confidence: bike.pesoKg ? 'ALTA' : 'NAO_CONFIRMADA',
          source: bike.pesoKg ? 'Ficha Cadastrada' : 'Pendente de auditoria oficial'
        },
        { 
          label: "Capacidade de Carga", 
          value: "Não informada pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        }
      ]
    },
    {
      title: "Transmissão & Freios",
      items: [
        { 
          label: "Sistema de Transmissão", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Tipo de Freios", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        },
        { 
          label: "Corte de Energia nos Manetes", 
          value: "Não informado pelo fabricante",
          confidence: 'NAO_CONFIRMADA',
          source: 'Pendente de auditoria oficial'
        }
      ]
    }
  ];

  return {
    bike,
    rating: calculatedRating,
    reviewCount: calculatedReviewCount,
    verdict: `A ${bike.marca} ${bike.modelo} destaca-se como uma escolha na categoria de e-bikes ${bike.usoPrincipal}. Com potência nominal de ${bike.potenciaW}W e autonomia declarada de até ${bike.autonomiaKm}km, entrega proposta equilibrada para o seu perfil de uso.`,
    badge: bike.badge || (bike.menorPreco < 6000 ? "Melhor Custo-Benefício" : "Alta Performance"),
    pros: [
      `Motor ${bike.marca} de ${bike.potenciaW}W com entrega linear de assistência`,
      `Autonomia declarada de até ${bike.autonomiaKm}km`,
      `Quadro projetado para a categoria de e-bikes ${bike.usoPrincipal}`
    ],
    cons: [
      `Requer checagem preventiva e calibragem periódica de pneus`,
      `Especificações detalhadas pendentes de confirmação pelo catálogo oficial`
    ],
    idealFor: `Ciclistas que procuram uma e-bike ${bike.usoPrincipal} da marca ${bike.marca} com proposta de assistência elétrica focada em custo-benefício.`,
    specSections: allocateAndNormalizeSpecSections(undefined, dynamicSpecs, {
      potenciaW: bike.potenciaW,
      autonomiaKm: bike.autonomiaKm,
      pesoKg: bike.pesoKg,
      tempoCargaHoras: bike.tempoCargaHoras,
      usoPrincipal: bike.usoPrincipal,
      marca: bike.marca,
      modelo: bike.modelo,
    }),
    reviews: resolvedReviews,
    priceHistory: resolvedPriceHistory,
    showPriceChart: bike.showPriceChart !== false,
    galleryImages,
    seoReport: bike.seoReport
  };
}

export async function fetchEBikesFromFirestore(): Promise<EBikeGrouped[]> {
  const map = new Map<string, EBikeGrouped>();

  // 1. Tenta prioritariamente endpoint oficial /api/bikes (com timeout resiliente)
  let apiSuccess = false;
  let deletedSlugsSet = new Set<string>();

  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/bikes', { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json?.success === true && Array.isArray(json.bikes) && json.bikes.length > 0) {
          deletedSlugsSet = new Set(Array.isArray(json.deletedSlugs) ? json.deletedSlugs : []);
          json.bikes.forEach((b: EBikeGrouped) => {
            if (b && b.slug && !deletedSlugsSet.has(b.slug)) {
              map.set(b.slug, b);
            }
          });

          // Sincroniza o storage local limpo
          try {
            const cleanList = Array.from(map.values());
            localStorage.setItem(PUBLISHED_BIKES_STORAGE_KEY, JSON.stringify(cleanList));
          } catch {}

          apiSuccess = true;
        }
      }
    } catch (apiErr) {
      console.warn('[ebikes] Erro na requisição para /api/bikes:', apiErr);
    }
  }

  // 2. Se a API falhou ou retornou vazio, carrega do catálogo estático e cache local
  if (!apiSuccess || map.size === 0) {
    // 2.1 Bikes estáticas do catálogo
    getGroupedEBikes(false).forEach((b) => {
      if (!deletedSlugsSet.has(b.slug)) {
        map.set(b.slug, b);
      }
    });

    // 2.2 Bikes publicadas no localStorage
    const localBikes = getLocalPublishedBikes();
    localBikes.forEach((b) => {
      if (!deletedSlugsSet.has(b.slug)) {
        map.set(b.slug, b);
      }
    });

    // 2.3 Firestore Client
    if (isFirebaseConfigured) {
      try {
        const firestorePromise = getDocs(collection(db, 'bikes'));
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 600)
        );
        const snap = await Promise.race([firestorePromise, timeoutPromise]);
        if (snap && !snap.empty) {
          snap.forEach((docSnap) => {
            const b = docSnap.data() as EBikeGrouped;
            if (b && b.slug && !deletedSlugsSet.has(b.slug)) {
              map.set(b.slug, b);
            }
          });
        }
      } catch (fErr) {
        console.warn('[ebikes] Firestore client offline ou timeout:', fErr);
      }
    }
  }

  // 3. Garante que nenhum item deletado permaneça no resultado
  if (deletedSlugsSet.size > 0) {
    deletedSlugsSet.forEach((delSlug) => map.delete(delSlug));
  }

  const allCombinedBikes = Array.from(map.values());

  // Ordena para que as bikes publicadas mais recentemente apareçam primeiro
  allCombinedBikes.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
    const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
    return timeB - timeA;
  });

  return allCombinedBikes;
}

export async function fetchEBikeBySlugFromFirestore(slug: string): Promise<EBikeGrouped | null> {
  if (!slug) return null;

  // 1. Tenta via API do servidor com timeout
  if (typeof window !== 'undefined') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`/api/bikes?slug=${encodeURIComponent(slug)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.bike) {
          return json.bike as EBikeGrouped;
        }
      }
    } catch {
      // Fallback para as próximas etapas
    }
  }

  // 2. Tenta via Firestore client se configurado
  if (isFirebaseConfigured) {
    try {
      const docRef = doc(db, 'bikes', slug);
      const firestorePromise = getDoc(docRef);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), 1500)
      );
      const snap = await Promise.race([firestorePromise, timeoutPromise]);
      if (snap && snap.exists()) {
        return snap.data() as EBikeGrouped;
      }
    } catch {
      // Fallback
    }
  }

  // 3. Fallback no catálogo local
  return getEBikeBySlug(slug, true);
}

