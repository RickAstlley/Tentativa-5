// Tipo RadarPauta definido localmente (era importado de aiRadarService)
export interface RadarPauta {
  id: string;
  title: string;
  summary: string;
  whyRelevant: string;
  keyPoints: string[];
  sourceUrl?: string;
  sourceName?: string;
  category: string;
  suggestedKeywords: string[];
  createdAt: string;
  starred: boolean;
  impactLevel: 'alto' | 'medio' | 'tendencia';
  fullArticleGenerated?: boolean;
}

/**
 * Modos do copilot para onde uma pauta do radar pode ser despachada.
 * Cada modo tem uma tela correspondente em `app/admin/ia/page.tsx`.
 */
export type CopilotMode =
  | 'chat'
  | 'article_writer'
  | 'radar_pautas'
  | 'ebike_analysis'
  | 'top_ranking'
  | 'audit_anti_hallucination'
  | 'image_search'
  | 'telemetry'
  | 'llm_panel';

/**
 * Resultado da classificação determinística de uma pauta
 * (`lib/ai/radarDispatcher.ts#classifyRadarPauta`). Já vem no formato que a UI
 * consome: cor de badge, ícone e o motivo da escolha.
 */
export interface RadarClassificationResult {
  target: CopilotMode;
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  buttonLabel: string;
  reason: string;
}

export type TechRegionKey =
  | 'all'
  | 'china'
  | 'japan'
  | 'korea'
  | 'usa'
  | 'europe'
  | 'russia'
  | 'brazil';

export type TechTopicKey =
  | 'all'
  | 'batteries'
  | 'motors'
  | 'components'
  | 'launches'
  | 'safety'
  | 'market'
  | 'promos';

export interface TechRegionConfig {
  key: TechRegionKey;
  label: string;
  flag: string;
  language: string;
  locale: string;
  country: string;
  techFocus: string;
  nativeKeywordsSample: string[];
  searchQueries: {
    all: string[];
    batteries: string[];
    motors: string[];
    components: string[];
    launches: string[];
    safety: string[];
    market: string[];
    promos: string[];
  };
}

export const TECH_REGIONS: Record<TechRegionKey, TechRegionConfig> = {
  all: {
    key: 'all',
    label: 'Global Multilíngue (Todos os Polos)',
    flag: '🌐',
    language: 'Multilíngue (CN, JP, KR, US, EU, RU, BR)',
    locale: 'en-US',
    country: 'US',
    techFocus: 'Varredura aberta e irrestrita em toda a web: montadoras globais, startups emergentes, crowdfunding (Kickstarter/Indiegogo), laboratórios de P&D, oficinas boutique e e-commerces mundiais',
    nativeKeywordsSample: [
      'Open-Web Deep Scan',
      'Solid-state battery startup',
      'Crowdfunding e-bike 2026',
      '电动自行车 钠离子电池 创业公司',
      'シマノ EP801 / 新興ブランド',
      '삼성 SDI / LG 차세대 배터리',
      'Pinion MGU / Getriebemotor',
      'Электровелосипед кастом 2x2',
      'Resolução CONTRAN 996 / Marcas Nacionais',
    ],
    searchQueries: {
      all: [
        'e-bike technology innovation motor battery breakthrough 2026 startup',
        'electric bike industry trends launches Eurobike crowdfunding kickstarter',
        'new ebike brand release boutique manufacturer prototype 2026',
        'ebike mid drive high torque solid state battery lab test',
        'electric bicycle sale promotion discount coupon outlet 2026',
      ],
      batteries: [
        'solid state battery e-bike sodium ion 2026 energy density startup lab',
        '电动自行车 钠离子电池 锂电池 2026 新技术 实验室 突破',
        'samsung lg catl ebike battery pack 21700 fast charge open innovation',
        'ebike battery fire safety patent BMS breakthrough 2026',
      ],
      motors: [
        'ebike mid drive motor lightweight high torque new manufacturer 2026',
        'electric bike motor gearbox integrated Pinion MGU Bafang Ananda DJI',
        '電動アシスト自転車 ドライブユニット 100Nm auto shift 新技術',
        'custom e-bike conversion kit torque sensor motor 2026',
      ],
      components: [
        'ebike parts components conversion kit bafang tongsheng cyc motor 2026',
        'ebike hydraulic brakes cutoff sensor ABS display oled controller GaN charger',
        'ebike battery BMS smart bluetooth cells 21700 sodium ion pack parts',
        'ebike puncture resistant tires carbon belt drive gates cdx',
      ],
      launches: [
        'new ebike release 2026 lightweight carbon emtb commuter startup',
        'Eurobike Frankfurt Taipei Cycle electric bicycle novelties exhibition',
        'crowdfunding electric bike campaign kickstarter indiegogo 2026',
        '전기자전거 2026 신제품 출시 스타트업',
      ],
      safety: [
        'ebike ABS braking system Blubrake Bosch radar anti theft IoT startup',
        'UL 2849 fire safety battery certification ebike testing laboratory',
        'smart ebike crash detection automatic emergency response sensor',
      ],
      market: [
        'global electric bicycle market statistics growth 2026 startup investment',
        'e-bike regulations EN 15194 CONTRAN Class 1 2 3 compliance trends',
      ],
      promos: [
        'ebike sale deals discount coupons clearance flash promo 2026',
        'bicicleta eletrica promocao cupom menor preco oferta liquidacao brasil',
        'electric bike discount outlet sale free shipping clearance 2026',
      ],
    },
  },
  china: {
    key: 'china',
    label: 'China (Ásia - Matriz & Startups)',
    flag: '🇨🇳',
    language: 'Mandarim (中文)',
    locale: 'zh-CN',
    country: 'CN',
    techFocus: 'Varredura aberta na Ásia: fornecedores OEM, startups de baterias (Na+ Sódio), novos fabricantes de motores e marcas emergentes',
    nativeKeywordsSample: [
      '电动自行车 (Bicicleta Elétrica)',
      '钠离子电池 (Bateria Íon-Sódio)',
      '中置电机 (Motor Central)',
      '大疆 Avinox (DJI Avinox 120Nm)',
      '八方 M820 (Bafang M820)',
      '新势力 创新品牌 (Startups Emergentes)',
      '众筹 电助力车 (Crowdfunding E-Bike)',
    ],
    searchQueries: {
      all: [
        '电动自行车 行业 新技术 2026 创新 创业公司',
        '电助力自行车 新品牌 众筹 展会 评测 2026',
        '大疆 Avinox 八方 安乃达 电机 驱动系统 评测',
        '两轮电动车 钠电池 锂电池 续航 突破',
      ],
      batteries: [
        '电动自行车 钠离子电池 商业化 2026 宁德时代 比亚迪 实验室',
        '高能量密度 21700 4680 锂电池 电助力车 安全 防火',
        '固态电池 两轮车 研发 专利 突破',
      ],
      motors: [
        '八方 Bafang 中置电机 M820 M510 安乃达 麦思 扭矩 升级',
        '大疆 DJI Avinox 120Nm 驱动电机 轻量化 体验',
        '微型 高扭矩 电动自行车 电机 控制器 创新',
      ],
      components: [
        '电动自行车 配件 锂电池保护板 BMS 控制器 仪表 减震器 刹车断电 2026',
        '电助力自行车 改装套件 八方 中置电机套件 轮毂电机 传感器',
        '两轮电动车 快充 充电器 氮化镓 GaN 智能车机 蓝牙 IoT',
      ],
      launches: [
        '雅迪 爱玛 极氪 新势力 2026 新款 碳纤维 电动自行车',
        '轻量化 电助力公路车 展会 发布 2026 众筹',
        '折叠 电动自行车 铝合金 钛合金 便携 新款',
      ],
      safety: [
        '电动自行车 防火安全 BMS 电池管理系统 阻燃 专利',
        '智能 GPS 防盗 定位 电助力车 物联网 5G',
      ],
      market: [
        '新国标 电动自行车 产业 趋势 出口 欧美 巴西 2026',
        '中国 电动两轮车 销量 报告 出口 供应链 2026',
      ],
      promos: [
        '电动自行车 优惠 促销 降价 性价比 2026 爆款',
        '高性价比 电动助力车 推荐 测评 折扣 网购 优惠券',
      ],
    },
  },
  japan: {
    key: 'japan',
    label: 'Japão (Ásia - Alta Precisão & Inovação)',
    flag: '🇯🇵',
    language: 'Japonês (日本語)',
    locale: 'ja-JP',
    country: 'JP',
    techFocus: 'Varredura aberta no Japão: transmissões de alta precisão, motores avançados, startups de mobilidade, protótipos de estado sólido e ofertas',
    nativeKeywordsSample: [
      '電動アシスト自転車 (Bike c/ Assistência)',
      'シマノ EP801 (Shimano EP801)',
      '自動変速 AutoShift (Câmbio Automático)',
      '新興 e-bike ブランド (Startups / Novas Marcas)',
      '全固体電池 開発 (Bateria Estado Sólido)',
      'クラウドファンディング (Crowdfunding)',
    ],
    searchQueries: {
      all: [
        '電動アシスト自転車 新型 2026 新興ブランド 開発 クラウドファンディング',
        'e-bike 日本 最新技術 2026 ベンチャー 試乗 レビュー',
        'シマノ ヤマハ パナソニック e-bike ドライブユニット 新技術',
        '電動自転車 セール 特価 キャンペーン 2026',
      ],
      batteries: [
        '電動アシスト自転車 バッテリー 小型軽量 大容量 2026 全固体電池 日本 開発',
        'e-bike 高密度バッテリー 航続距離 延長 技術 研究所',
      ],
      motors: [
        'シマノ EP801 自動変速 Auto Shift Free Shift e-bike ユニット',
        'ヤマハ ドライブユニット 新型 トルクセンサー 高効率 小型化',
        '日本 国内 e-bike モーター 開発 ベンチャー 2026',
      ],
      components: [
        '電動アシスト自転車 パーツ カスタム 部品 シマノ ディスプレイ センサー 2026',
        'e-bike 油圧ディスクブレーキ ABS 回生ブレーキ 急速充電器',
      ],
      launches: [
        'e-bike ミニベロ 軽量 スポーツモデル 2026 新車 発売 クラウドファンディング Makuake',
        'グラベル e-bike 日本 国内 発売 モデル カーボン 軽量',
        '折りたたみ 電動アシスト自転車 最新 おすすめ 2026',
      ],
      safety: [
        '電動アシスト自転車 ABS ブレーキ 安全技術 センサー 連動',
        '盗難防止 スマートロック IoT e-bike GPS 追跡 日本',
      ],
      market: [
        '日本の電動アシスト自転車 市場動向 規制 法改正 免許不要',
        'e-bike 国内 需要 拡大 補助金 普及',
      ],
      promos: [
        '電動アシスト自転車 セール クーポン 安い 特価 2026 値引き',
        '型落ち e-bike キャンペーン 最安値 激安 アウトレット',
      ],
    },
  },
  korea: {
    key: 'korea',
    label: 'Coreia do Sul (Ásia - Células & IoT)',
    flag: '🇰🇷',
    language: 'Coreano (한국어)',
    locale: 'ko-KR',
    country: 'KR',
    techFocus: 'Varredura aberta na Coreia: células 21700/4680, startups de e-mobilidade IoT, telemetria 5G, novos quadros e financiamento coletivo Wadiz',
    nativeKeywordsSample: [
      '전기자전거 (Bicicleta Elétrica)',
      '차세대 배터리 21700 (Bateria Nova Geração)',
      '스마트 e-모빌리티 (Smart Mobility)',
      '크라우드펀딩 와디즈 (Crowdfunding Wadiz)',
      '토크센서 모터 (Motor c/ Sensor de Torque)',
      '스타트업 신제품 (Novos Produtos Startups)',
    ],
    searchQueries: {
      all: [
        '전기자전거 스마트 e-모빌리티 신제품 스타트업 2026',
        '삼성SDI LG에너지솔루션 전기자전거 팩 신기술 2026',
        '전기자전거 크라우드펀딩 와디즈 신규 런칭',
        '전기자전거 특가 할인 프로모션 가성비 2026',
      ],
      batteries: [
        '삼성SDI LG 전기자전거 배터리 21700 고용量 급속충전 전고체 연구',
        '전기자전거 BMS 화재 안전 방폭 배터리 기술',
      ],
      motors: [
        '전기자전거 중앙모터 허브모터 토크센서 정밀제어 스타트업',
        '국산 전기자전거 모터 컨트롤러 고효율 2026',
      ],
      components: [
        '전기자전거 부품 배터리팩 BMS 컨트롤러 디스플레이 개조 키트 2026',
        '스마트 e-모빌리티 IoT 위치추적기 고속 충전기 액세서리',
      ],
      launches: [
        '전기자전거 2026 신모델 발표 카본 경량 접이식 와디즈',
        '스마트 커뮤터 전기자전거 신제품 리뷰',
      ],
      safety: [
        '전기자전거 배터리 화재 방지 안전 인증 KC 스마트 관제',
        '도난방지 GPS IoT 전기자전거 연동 앱',
      ],
      market: [
        '한국 전기자전거 시장 법규 자전거도로 허용 기준 2026',
        '친환경 마이크로 모빌리티 보조금 혜택',
      ],
      promos: [
        '전기자전거 할인 프로모션 특가 가성비 2026 최저가',
        '전기자전거 보조금 지원 행사 가격 비교',
      ],
    },
  },
  usa: {
    key: 'usa',
    label: 'Estados Unidos (América do Norte - Aberto)',
    flag: '🇺🇸',
    language: 'Inglês (English)',
    locale: 'en-US',
    country: 'US',
    techFocus: 'Varredura aberta na América do Norte: startups do Vale do Silício, crowdfunding (Kickstarter/Indiegogo), marcas consagradas, patentes e ofertas em lojas virtuais',
    nativeKeywordsSample: [
      'Open Web Deep Scan USA',
      'Kickstarter / Indiegogo E-Bikes',
      'Solid-State Battery Startup',
      'Class 1/2/3 Compliance',
      'Direct-to-Consumer Deals',
      'UL 2849 Fire Certification',
    ],
    searchQueries: {
      all: [
        'electric bike tech innovation breakthrough startup 2026 open web',
        'new ebike crowdfunding campaign kickstarter indiegogo 2026',
        'best new electric bike releases reviews direct to consumer brands',
        'ebike deals sale clearance coupon discount lowest price 2026',
      ],
      batteries: [
        'ebike solid state battery startup fast charging 2026 lab report',
        'UL 2849 fire safe certified ebike battery pack testing standards',
        'high capacity lightweight ebike battery technology breakthrough',
      ],
      motors: [
        'mid-drive hub motor new manufacturer high torque ebike 2026',
        'TQ HPR50 vs Mahle X30 vs Fazua Ride 60 vs DJI Avinox comparison',
        'lightweight electric bike conversion kit torque sensor 2026',
      ],
      components: [
        'ebike conversion kit mid drive hub bafang cyc photon test review 2026',
        'ebike hydraulic disc brakes cutoff sensors smart displays GaN chargers',
        'ebike parts replacement batteries smart BMS flat protection tires',
      ],
      launches: [
        'best new electric mountain bikes e-MTB commuter cargo 2026 release',
        'lightweight carbon e-bike startup launch review test',
        'innovative folding ebike long range utility bike 2026',
      ],
      safety: [
        'ebike radar rear light collision warning smart helmet safety',
        'ABS anti lock braking system electric bike testing review',
      ],
      market: [
        'e-bike regulations Class 1 2 3 USA updates tax incentives 2026',
        'electric bicycle industry market growth startup venture funding',
      ],
      promos: [
        'best ebike deals discounts sales coupons clearance 2026',
        'electric bike flash sale promotional offer discount code direct',
      ],
    },
  },
  europe: {
    key: 'europe',
    label: 'Europa (Alemanha / Holanda / Suíça / UK)',
    flag: '🇪🇺',
    language: 'Alemão / Inglês (Deutsch / English)',
    locale: 'de-DE',
    country: 'DE',
    techFocus: 'Varredura aberta na Europa: Eurobike, oficinas boutique, sistemas integrados (Pinion MGU, Bosch CX Gen 5, Fazua), startups sustentáveis e liquidações de lojas',
    nativeKeywordsSample: [
      'Open Web Scan Europa',
      'Eurobike Frankfurt Neuheiten',
      'Pinion MGU / Getriebemotor',
      'Boutique E-Bike Hersteller',
      'E-Bike Angebote & Rabatte',
      'EN 15194 Pedelec 250W',
    ],
    searchQueries: {
      all: [
        'E-Bike Neuheiten 2026 Innovationen Startups Eurobike Testbericht',
        'Pedelec Antriebe Getriebemotoren E-Bike Trends 2026 Europa',
        'new European ebike brand boutique manufacturer release 2026',
        'E-Bike Schnäppchen Angebote Rabatt Test 2026',
      ],
      batteries: [
        'E-Bike Akku Neuheiten Schnellladung Leichtbau Reichweite Test 2026',
        'Recyclingfähige Akkus E-Bike Nachhaltigkeit Europa Innovation',
      ],
      motors: [
        'Pinion MGU Getriebemotor Bosch CX Gen 5 Fazua Mahle Vergleich Test',
        'neue E-Bike Motoren Antriebe integrierte Schaltung 2026',
      ],
      components: [
        'E-Bike Komponenten Rohloff Pinion Gates Riemenantrieb Scheibenbremsen ABS',
        'Pedelec Nachrüstsatz Umrüstsatz Drehmomentsensor Zubehör Neuheiten',
      ],
      launches: [
        'neue E-MTB E-Cargo E-Gravel Modelle 2026 Testbericht Übersicht',
        'Leichtes E-Bike Carbon Titan Prototyp Eurobike',
      ],
      safety: [
        'Bosch eBike ABS Blubrake Antiblockiersystem Bremsen Test Sicherheit',
        'GPS Tracker E-Bike Diebstahlschutz Vernetzung IoT',
      ],
      market: [
        'E-Bike Markt Europa Verkaufszahlen Trends ZIV Eurobike 2026',
        'Pedelec Gesetz EN 15194 Vorschriften S-Pedelec Diskussion',
      ],
      promos: [
        'E-Bike Angebote Rabatt Schnäppchen Test Abverkauf 2026',
        'Pedelec Sonderangebote Gutschein günstiger Preis Outlet',
      ],
    },
  },
  russia: {
    key: 'russia',
    label: 'Rússia / Leste Europeu (All-Terrain & Custom)',
    flag: '🇷🇺',
    language: 'Russo (Русский)',
    locale: 'ru-RU',
    country: 'RU',
    techFocus: 'Varredura aberta no Leste Europeu: montagens customizadas de alta potência, baterias LTO anti-frio severo, tração integral 2x2 e oficinas independentes',
    nativeKeywordsSample: [
      'Электровелосипед (E-Bike)',
      'Кастомная сборка (Montagem Custom)',
      'Полный привод 2x2 (AWD)',
      'Морозостойкий LTO (Titanato Anti-Frio)',
      'Мощный электробайк 1000W+',
      'Распродажа и скидки (Descontos e Ofertas)',
    ],
    searchQueries: {
      all: [
        'электровелосипед 2026 новинки технологии кастом обзор тест',
        'мощный электровелосипед полный привод 2x2 самодельный новинки',
        'электрофэтбайк мастерская сборка новинки рынка 2026',
        'электровелосипед скидки распродажа акции 2026',
      ],
      batteries: [
        'аккумулятор для электровелосипеда титанат LTO мороз сборка BMS',
        'высоковольтные батареи для электробайка 60V 72V емкость новинки',
      ],
      motors: [
        'кареточный мотор прямоприводный мотор-колесо 1000W 1500W тест',
        'контроллер для мощного электровелосипеда синусный программируемый',
      ],
      components: [
        'комплект для электрификации велосипеда набор мотор колесо контроллер',
        'запчасти для электровелосипеда гидравлические тормоза дисплей BMS',
      ],
      launches: [
        'лучшие электровелосипеды 2026 новинки обзор испытания',
        'электровелосипед для бездорожья и зимы фэтбайк новинки',
      ],
      safety: [
        'гидравлические тормоза датчики отключения безопасность электробайка',
        'сигнализация GPS трекер электровелосипед защита от угона',
      ],
      market: [
        'рынок электровелосипедов ПДД правила мощность самоделки 2026',
        'электровелосипеды в России тенденции мастерские',
      ],
      promos: [
        'электровелосипед скидки акции распродажа 2026 недорого',
        'купить надежный электровелосипед по акции спецпредложение',
      ],
    },
  },
  brazil: {
    key: 'brazil',
    label: 'Brasil (Nacional, Startups & Lojas)',
    flag: '🇧🇷',
    language: 'Português (pt-BR)',
    locale: 'pt-BR',
    country: 'BR',
    techFocus: 'Varredura aberta no Brasil: todas as marcas nacionais e importadas, startups de mobilidade, kits de conversão, promoções em lojas e e-commerces, e Resolução CONTRAN 996',
    nativeKeywordsSample: [
      'Varredura Aberta Web Brasil',
      'Promoções e Cupons E-Bikes',
      'Kits de Conversão Elétrica',
      'Resolução CONTRAN 996/2023',
      'Startups de Mobilidade Urbana',
      'Lançamentos e Comparativos',
    ],
    searchQueries: {
      all: [
        'bicicleta eletrica lancamento brasil 2026 teste novidade startup',
        'e-bike promocao desconto cupom oferta menor preco brasil 2026',
        'novidades bicicletas eletricas mobilidade urbana brasil mercado',
        'kit conversao bicicleta eletrica motor bateria review brasil',
      ],
      batteries: [
        'bateria bicicleta eletrica autonomia teste real brasil 2026',
        'reforma de bateria litio e-bike celulas seguranca brasil',
      ],
      motors: [
        'motor central cubo bicicleta eletrica brasil shimano bafang dji tq',
        'e-bike motor 250w 350w 500w 1000w contran legislacao regras',
      ],
      components: [
        'kit conversao bicicleta eletrica bafang tongsheng fitpower brasil',
        'pecas bicicleta eletrica display acelerador freio com corte manete carregador',
        'pneu bicicleta eletrica reforçado antifuro kenda continental schwalbe',
      ],
      launches: [
        'lancamento e-bike 2026 nova linha marcas nacionais importadas',
        'bicicleta eletrica dobravel urbana mtb lancamento brasil',
      ],
      safety: [
        'seguranca bicicleta eletrica capacete iluminacao ciclovia leis',
        'seguro para bicicleta eletrica brasil rastreador antifurto',
      ],
      market: [
        'resolucao contran 996 bicicleta eletrica ciclomotor regras 2026',
        'mercado e-bikes brasil crescimento vendas alianca bike dados',
      ],
      promos: [
        'bicicleta eletrica promocao cupom desconto oferta 2026 menor preco',
        'e-bike em oferta liquidacao outlet magazine luiza amazon mercadolivre',
      ],
    },
  },
};

export type EbikeComponentType =
  | 'bike_completa'
  | 'motor'
  | 'bateria'
  | 'transmissao'
  | 'freio'
  | 'quadro'
  | 'software_iot'
  | 'acessorios'
  | 'geral';

export interface GlobalRadarSpecsSummary {
  componentType?: EbikeComponentType;
  motor?: string;
  potenciaWatts?: string;
  torqueNm?: string;
  bateria?: string;
  capacidadeWh?: string;
  autonomiaEstimadaKm?: string;
  autonomiaKm?: string;
  velocidadeMaxKmH?: string;
  pesoKg?: string;
  precoOriginal?: string;
  precoEstimadoBRL?: string;
  precoEstimadoComImpostosBRL?: string;
  concorrenteNacionalDireto?: string;
  inovacaoChave?: string;
  conformidadeContran996?: '100% Compatível (Bike Elétrica)' | 'Ciclomotor (Exige Habilitação/Placa)' | 'Uso Exclusivo Off-Road';
}

export interface GlobalRadarSearchResultItem extends RadarPauta {
  regionKey: TechRegionKey;
  regionLabel: string;
  countryFlag: string;
  originalLanguage: string;
  titleOriginal?: string;
  nativeKeywordsSearched?: string[];
  componentType?: EbikeComponentType;
  concorrenteNacionalDireto?: string;
  specsSummary?: GlobalRadarSpecsSummary;
  socialSnippet?: string;
  classifiedTags?: string[];
  itemTypeTag?: 'alto-impacto' | 'artigo' | 'noticias' | 'e-bike' | 'promocao' | 'bateria' | 'motor' | 'pecas' | 'dossie';
  modelUsed?: string;
}

export interface GlobalRadarSearchResponse {
  success: boolean;
  region: TechRegionKey;
  topic: TechTopicKey;
  queryExecuted: string;
  results: GlobalRadarSearchResultItem[];
  totalFound: number;
  sourcesSearched: { title: string; link: string; domain: string; region: string }[];
  durationMs: number;
  message?: string;
  error?: string;
}
