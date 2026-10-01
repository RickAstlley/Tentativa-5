export interface SiteSettings {
  heroTitulo: string;
  heroDescricao: string;
  heroBadge?: string;
  sidebarConfianca: string;
  footerConfianca: string;
  sidebarConfiancaTitulo?: string;
  sidebarConfiancaTexto?: string;
  footerConfiancaTexto?: string;
  guiaRapidoTitulo: string;
  guiaRapidoDescricao: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  heroTitulo: 'Encontre a e-bike perfeita para a sua rotina.',
  heroDescricao: 'Comparador neutro de autonomia, potência do motor e preço real em lojas parceiras. Sem pegadinhas.',
  heroBadge: '100% Curadoria Independente & Auditada',
  sidebarConfianca: '100% Curadoria Manual: preços verificados por humanos, não por robô.',
  footerConfianca: 'Sem robôs ou scraping quebrado: cada preço listado aqui foi conferido manualmente pela nossa equipe.',
  sidebarConfiancaTitulo: '100% Curadoria Manual',
  sidebarConfiancaTexto: 'preços verificados por humanos, não por robô.',
  footerConfiancaTexto: 'Sem robôs ou scraping quebrado: cada preço listado aqui foi conferido manualmente pela nossa equipe.',
  guiaRapidoTitulo: 'Como escolher sua e-bike ideal?',
  guiaRapidoDescricao: 'Não sabe por onde começar? Responda às perguntas abaixo e encontre a categoria certa para a sua rotina:',
};
