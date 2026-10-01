import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SiteSettings } from '@/types/settings';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  heroTitulo: 'Encontre a e-bike perfeita para a sua rotina.',
  heroDescricao: 'Comparador neutro de autonomia, potência do motor e preço real em lojas parceiras. Sem pegadinhas.',
  sidebarConfianca: '100% Curadoria Manual: preços verificados por humanos, não por robô.',
  footerConfianca: 'Sem robôs ou scraping quebrado: cada preço listado aqui foi conferido manualmente pela nossa equipe.',
  guiaRapidoTitulo: 'Como escolher sua e-bike ideal?',
  guiaRapidoDescricao: 'Não sabe por onde começar? Responda às perguntas abaixo e encontre a categoria certa para a sua rotina:',
};

/**
 * Mescla dados recebidos do Firestore com os valores padrão para assegurar
 * que nenhum campo fique indefinido, nulo ou quebre a renderização.
 */
export function sanitizeSiteSettings(data: unknown): SiteSettings {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_SITE_SETTINGS };
  }

  const raw = data as Record<string, unknown>;

  return {
    heroTitulo: typeof raw.heroTitulo === 'string' && raw.heroTitulo.trim() !== ''
      ? raw.heroTitulo.trim()
      : DEFAULT_SITE_SETTINGS.heroTitulo,
    heroDescricao: typeof raw.heroDescricao === 'string' && raw.heroDescricao.trim() !== ''
      ? raw.heroDescricao.trim()
      : DEFAULT_SITE_SETTINGS.heroDescricao,
    sidebarConfianca: typeof raw.sidebarConfianca === 'string' && raw.sidebarConfianca.trim() !== ''
      ? raw.sidebarConfianca.trim()
      : DEFAULT_SITE_SETTINGS.sidebarConfianca,
    footerConfianca: typeof raw.footerConfianca === 'string' && raw.footerConfianca.trim() !== ''
      ? raw.footerConfianca.trim()
      : DEFAULT_SITE_SETTINGS.footerConfianca,
    guiaRapidoTitulo: typeof raw.guiaRapidoTitulo === 'string' && raw.guiaRapidoTitulo.trim() !== ''
      ? raw.guiaRapidoTitulo.trim()
      : DEFAULT_SITE_SETTINGS.guiaRapidoTitulo,
    guiaRapidoDescricao: typeof raw.guiaRapidoDescricao === 'string' && raw.guiaRapidoDescricao.trim() !== ''
      ? raw.guiaRapidoDescricao.trim()
      : DEFAULT_SITE_SETTINGS.guiaRapidoDescricao,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

/**
 * Busca o documento settings/site no Firestore (Client SDK).
 * Retorna os padrões se o documento não existir ou houver falha de rede.
 */
export async function fetchSiteSettingsFromFirestore(): Promise<SiteSettings> {
  try {
    const docRef = doc(db, 'settings', 'site');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return sanitizeSiteSettings(docSnap.data());
    }

    return { ...DEFAULT_SITE_SETTINGS };
  } catch (error) {
    console.warn('Não foi possível carregar settings/site do Firestore, usando padrões:', error);
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

/**
 * Salva as configurações no documento settings/site no Firestore.
 */
export async function saveSiteSettingsToFirestore(
  settings: Partial<SiteSettings>,
  userEmail?: string
): Promise<SiteSettings> {
  const sanitized = sanitizeSiteSettings(settings);
  const dataToSave: SiteSettings = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
    ...(userEmail ? { updatedBy: userEmail } : {}),
  };

  const docRef = doc(db, 'settings', 'site');
  await setDoc(docRef, dataToSave, { merge: true });

  return dataToSave;
}
