import { EBikeReview } from '@/types/ebike';
import { generateRealisticCommunityReviews, calculateRealRangeStats } from '@/lib/reviews';
import { getAdminDb, isFirestoreDatabaseAvailable, withAdminTimeout } from '@/lib/firebaseAdmin';
import fs from 'fs';
import path from 'path';

const REVIEWS_FILE_PATH = path.join(process.cwd(), 'data', 'community_reviews.json');
const DELETED_REVIEWS_FILE_PATH = path.join(process.cwd(), 'data', 'deleted_reviews.json');

/**
 * Lê IDs de reviews excluídas pelo administrador para garantir exclusão permanente (tombstone)
 */
export function readDeletedReviewIds(): string[] {
  try {
    if (fs.existsSync(DELETED_REVIEWS_FILE_PATH)) {
      const content = fs.readFileSync(DELETED_REVIEWS_FILE_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[Reviews Server] Erro ao ler deleted_reviews.json:', err);
  }
  return [];
}

/**
 * Registra uma review como excluída permanentemente
 */
export function recordDeletedReviewId(reviewId: string): void {
  try {
    const dir = path.dirname(DELETED_REVIEWS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = readDeletedReviewIds();
    if (!current.includes(reviewId)) {
      current.push(reviewId);
      fs.writeFileSync(DELETED_REVIEWS_FILE_PATH, JSON.stringify(current, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[Reviews Server] Erro ao gravar deleted_reviews.json:', err);
  }
}

/**
 * Lê avaliações submetidas pela comunidade do arquivo local (cache / fallback)
 */
export function readLocalCommunityReviews(): EBikeReview[] {
  try {
    if (fs.existsSync(REVIEWS_FILE_PATH)) {
      const content = fs.readFileSync(REVIEWS_FILE_PATH, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        const deletedIds = new Set(readDeletedReviewIds());
        return data.filter((r) => r && r.id && !deletedIds.has(r.id));
      }
    }
  } catch (err) {
    console.warn('[Reviews Server] Erro ao ler community_reviews.json:', err);
  }
  return [];
}

/**
 * Grava avaliações no arquivo local para cache e resiliência offline
 */
export function writeLocalCommunityReviews(reviews: EBikeReview[]): void {
  try {
    const dir = path.dirname(REVIEWS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REVIEWS_FILE_PATH, JSON.stringify(reviews, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Reviews Server] Erro ao gravar community_reviews.json:', err);
  }
}

/**
 * Obtém todas as avaliações reais de uma e-bike submetidas por usuários.
 * Busca no Firestore primeiro; se indisponível ou offline, utiliza o storage seguro local.
 */
export async function getCommunityReviews(bike: {
  slug: string;
  modelo?: string;
  marca?: string;
  autonomiaKm?: number;
  potenciaW?: number;
  usoPrincipal?: string;
}): Promise<EBikeReview[]> {
  const localSaved = readLocalCommunityReviews().filter((r) => r.bikeSlug === bike.slug);

  try {
    const db = getAdminDb();
    if (db && isFirestoreDatabaseAvailable()) {
      const querySnap = await withAdminTimeout(
        () =>
          db
            .collection('reviews')
            .where('bikeSlug', '==', bike.slug)
            .get(),
        2500,
        null
      );

      if (querySnap && !querySnap.empty) {
        const firestoreReviews: EBikeReview[] = [];
        const deletedIds = new Set(readDeletedReviewIds());
        querySnap.forEach((docSnap) => {
          const r = docSnap.data() as EBikeReview;
          const revId = r.id || docSnap.id;
          // Filtra apenas aprovadas, registros válidos e não deletados
          if (r && (!r.status || r.status === 'approved') && !deletedIds.has(revId)) {
            firestoreReviews.push({
              ...r,
              id: revId,
            });
          }
        });

        // Mescla sem duplicidade com o cache local
        const mergedMap = new Map<string, EBikeReview>();
        localSaved.forEach((r) => mergedMap.set(r.id, r));
        firestoreReviews.forEach((r) => mergedMap.set(r.id, r));

        const allReviews = Array.from(mergedMap.values());
        allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Atualiza cache local de forma não bloqueante
        setTimeout(() => {
          const allLocal = readLocalCommunityReviews();
          const globalMerged = new Map<string, EBikeReview>();
          allLocal.forEach((item) => globalMerged.set(item.id, item));
          firestoreReviews.forEach((item) => globalMerged.set(item.id, item));
          writeLocalCommunityReviews(Array.from(globalMerged.values()));
        }, 10);

        return allReviews;
      }
    }
  } catch (err) {
    console.warn('[Reviews Server] Firestore indisponível para reviews, utilizando cache local:', err);
  }

  // Ordena por data decrescente
  localSaved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return localSaved;
}

/**
 * Salva uma nova avaliação real de usuário no banco de dados Firestore e no cache local
 */
export async function addCommunityReview(data: {
  bikeSlug: string;
  author: string;
  city?: string;
  userWeightKg?: number;
  usageProfile?: string;
  terrain?: 'plano' | 'misto' | 'íngreme';
  assistanceModeUsed?: string;
  realRangeKm: number;
  advertisedRangeKm?: number;
  rating: number;
  criteria?: {
    batteryAutonomy?: number;
    motorPower?: number;
    comfort?: number;
    reliability?: number;
  };
  title: string;
  comment: string;
  timeUsing?: string;
}): Promise<EBikeReview> {
  const newReview: EBikeReview = {
    id: `rev-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    bikeSlug: data.bikeSlug,
    author: data.author.trim(),
    city: data.city?.trim() || 'Brasil',
    userWeightKg: data.userWeightKg ? Math.round(Number(data.userWeightKg)) : undefined,
    usageProfile: data.usageProfile?.trim() || 'Uso diário',
    terrain: data.terrain || 'misto',
    assistanceModeUsed: data.assistanceModeUsed || 'Misto',
    realRangeKm: Math.round(Math.max(5, Math.min(300, Number(data.realRangeKm)))),
    advertisedRangeKm: data.advertisedRangeKm ? Math.round(Number(data.advertisedRangeKm)) : undefined,
    rating: Math.max(1, Math.min(5, Math.round(Number(data.rating)))),
    criteria: {
      batteryAutonomy: Math.max(1, Math.min(5, Math.round(Number(data.criteria?.batteryAutonomy || data.rating)))),
      motorPower: Math.max(1, Math.min(5, Math.round(Number(data.criteria?.motorPower || data.rating)))),
      comfort: Math.max(1, Math.min(5, Math.round(Number(data.criteria?.comfort || data.rating)))),
      reliability: Math.max(1, Math.min(5, Math.round(Number(data.criteria?.reliability || data.rating)))),
    },
    date: new Date().toISOString().split('T')[0],
    timeUsing: data.timeUsing || 'Novo usuário',
    title: data.title.trim(),
    comment: data.comment.trim(),
    verified: true,
    status: 'approved', // Automaticamente aprovado após passar por toda a sanitização rígida
    helpfulCount: 0,
  };

  // 1. Grava no banco de dados Firestore
  try {
    const db = getAdminDb();
    if (db && isFirestoreDatabaseAvailable()) {
      await withAdminTimeout(
        () => db.collection('reviews').doc(newReview.id).set(newReview),
        3000,
        null
      );
    }
  } catch (err) {
    console.warn('[Reviews Server] Falha ao persistir no Firestore, mantendo no cache local:', err);
  }

  // 2. Salva no arquivo local para cache imediato
  const currentReviews = readLocalCommunityReviews();
  currentReviews.unshift(newReview);
  writeLocalCommunityReviews(currentReviews);

  return newReview;
}

/**
 * Incrementa voto de "útil" em uma avaliação no Firestore e no cache local
 */
export async function voteHelpful(reviewId: string): Promise<number> {
  const currentReviews = readLocalCommunityReviews();
  const index = currentReviews.findIndex((r) => r.id === reviewId);
  let newCount = 1;

  if (index !== -1) {
    currentReviews[index].helpfulCount = (currentReviews[index].helpfulCount || 0) + 1;
    newCount = currentReviews[index].helpfulCount;
    writeLocalCommunityReviews(currentReviews);
  }

  // Atualiza no Firestore de forma assíncrona
  try {
    const db = getAdminDb();
    if (db && isFirestoreDatabaseAvailable()) {
      withAdminTimeout(
        async () => {
          const docRef = db.collection('reviews').doc(reviewId);
          const snap = await docRef.get();
          if (snap.exists) {
            const cur = snap.data()?.helpfulCount || 0;
            await docRef.update({ helpfulCount: cur + 1 });
          }
        },
        2000,
        null
      ).catch((e) => console.warn('[Reviews Server] Erro ao atualizar voto no Firestore:', e));
    }
  } catch (err) {
    console.warn('[Reviews Server] Firestore indisponível para voto:', err);
  }

  return newCount;
}

/**
 * Exclui permanentemente uma avaliação no Firestore e no armazenamento em arquivo local.
 * Registra o ID no tombstone para evitar re-sincronização fantasma.
 */
export async function deleteCommunityReview(reviewId: string): Promise<boolean> {
  if (!reviewId) return false;

  // 1. Registra no tombstone local
  recordDeletedReviewId(reviewId);

  // 2. Remove do arquivo JSON local
  try {
    const currentReviews = readLocalCommunityReviews();
    const filtered = currentReviews.filter((r) => r.id !== reviewId);
    writeLocalCommunityReviews(filtered);
  } catch (err) {
    console.warn('[Reviews Server] Erro ao remover do arquivo local:', err);
  }

  // 3. Remove do Firestore Admin
  try {
    const db = getAdminDb();
    if (db && isFirestoreDatabaseAvailable()) {
      await withAdminTimeout(
        () => db.collection('reviews').doc(reviewId).delete(),
        3000,
        null
      );
    }
  } catch (err) {
    console.warn('[Reviews Server] Erro ao remover avaliação do Firestore:', err);
  }

  return true;
}

export { calculateRealRangeStats, generateRealisticCommunityReviews };

