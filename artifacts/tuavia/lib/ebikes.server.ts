import { getAdminDb, withAdminTimeout, isFirestoreDatabaseAvailable } from '@/lib/firebaseAdmin';
import { collectionsFor } from '@/lib/firestoreCollections';
import { getGroupedEBikes, getEBikeBySlug, buildEnrichedDetailFromBike } from '@/lib/ebikes';
import { getCommunityReviews } from '@/lib/reviews.server';
import { EBikeGrouped, EnrichedEBikeDetail } from '@/types/ebike';
import {
  getAllBikesServer,
  getBikeBySlugServer,
  getDeletedSlugsServer,
  saveBikesToServerFileBulk,
} from '@/lib/serverStorage';
import { sanitizeBikeImagesServer } from '@/lib/imageOptimization.server';

// Cache em memória do servidor com TTL para carregamento instantâneo (<5ms)
let cachedServerBikes: EBikeGrouped[] | null = null;
let cachedServerBikesTimestamp = 0;
const SERVER_BIKES_CACHE_TTL_MS = 60 * 1000; // 60 segundos de retenção em memória

export function invalidateBikesServerCache(): void {
  cachedServerBikes = null;
  cachedServerBikesTimestamp = 0;
}

export async function getPublishedBikesServer(): Promise<EBikeGrouped[]> {
  const now = Date.now();
  if (cachedServerBikes && (now - cachedServerBikesTimestamp < SERVER_BIKES_CACHE_TTL_MS)) {
    return cachedServerBikes;
  }

  try {
    const bikes = await getGroupedEBikesFromFirestore();
    if (Array.isArray(bikes) && bikes.length > 0) {
      cachedServerBikes = bikes;
      cachedServerBikesTimestamp = now;
      return bikes;
    }
    const local = await getAllBikesServer();
    if (Array.isArray(local) && local.length > 0) {
      cachedServerBikes = local;
      cachedServerBikesTimestamp = now;
    }
    return local;
  } catch (err) {
    console.warn('[ebikes.server] Erro ao carregar bikes no servidor, caindo para storage local:', err);
    return await getAllBikesServer();
  }
}

export async function getGroupedEBikesFromFirestore(): Promise<EBikeGrouped[]> {
  try {
    const deleted = await getDeletedSlugsServer();
    const deletedSet = new Set(deleted.bikes || []);
    const serverBikes = await getAllBikesServer();
    const map = new Map<string, EBikeGrouped>();
    const localSlugs = new Set<string>();

    serverBikes.forEach((b) => {
      if (b && b.slug && !deletedSet.has(b.slug)) {
        map.set(b.slug, b);
        localSlugs.add(b.slug);
      }
    });

    const missingBikesToRehydrate: EBikeGrouped[] = [];

    const adminDb = getAdminDb();
    if (adminDb && isFirestoreDatabaseAvailable()) {
      const bikeCollections = collectionsFor('bikes');
      const fetchPromises = bikeCollections.map((colName) =>
        withAdminTimeout(() => adminDb.collection(colName).get(), 3500, null)
      );

      const results = await Promise.allSettled(fetchPromises);
      results.forEach((res, idx) => {
        const colName = bikeCollections[idx];
        if (res.status === 'fulfilled' && res.value && !res.value.empty) {
          res.value.forEach((doc) => {
            const b = doc.data() as EBikeGrouped;
            if (b && b.slug && !deletedSet.has(b.slug)) {
              // Se já temos a bike local com imagem estática limpa e a do Firestore tem data:image, preserva a imagem limpa
              const localBike = map.get(b.slug);
              if (localBike && localBike.imagemUrl && !localBike.imagemUrl.startsWith('data:image/') && b.imagemUrl?.startsWith('data:image/')) {
                b.imagemUrl = localBike.imagemUrl;
              }
              map.set(b.slug, b);
              
              // Se a ebike está no Firestore, mas não no disco local, agendamos sua reidratação
              if (!localSlugs.has(b.slug)) {
                missingBikesToRehydrate.push(b);
              }
            }
          });
        } else if (res.status === 'rejected') {
          console.warn(`[ebikes.server] Erro ao consultar coleção ${colName} no Firestore:`, res.reason);
        }
      });
    }

    // Higieniza todas as bikes para remover qualquer data:image antes de gravar em disco ou cache
    const sanitizedBikes = await Promise.all(
      Array.from(map.values()).map((b) => sanitizeBikeImagesServer(b))
    );

    // Agenda reidratação no disco local de forma assíncrona (não bloqueante)
    if (missingBikesToRehydrate.length > 0) {
      const sanitizedRehydrate = await Promise.all(
        missingBikesToRehydrate.map((b) => sanitizeBikeImagesServer(b))
      );
      saveBikesToServerFileBulk(sanitizedRehydrate).catch((err) =>
        console.warn('[ebikes.server] Erro ao reidratar cache local de ebikes:', err)
      );
    }

    sanitizedBikes.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      const timeB = new Date(b.createdAt || b.ofertas?.[0]?.dataAtualizacao || '2020-01-01T00:00:00.000Z').getTime();
      return (timeB - timeA) || a.slug.localeCompare(b.slug);
    });

    return sanitizedBikes;
  } catch (error) {
    console.error('[ebikes.server] Erro fatal no Firestore, caindo para storage local:', error);
    const local = await getAllBikesServer();
    return await Promise.all(local.map((b) => sanitizeBikeImagesServer(b)));
  }
}

export async function getEBikeBySlugFromFirestore(slug: string): Promise<EBikeGrouped | null> {
  if (!slug) return null;

  // 1. Tenta no storage de arquivos do servidor (estático + admin publicado) primeiro para performance máxima
  const serverBike = await getBikeBySlugServer(slug);
  if (serverBike) {
    return await sanitizeBikeImagesServer(serverBike);
  }

  try {
    // 2. Tenta no Firestore se não achou no local
    const adminDb = getAdminDb();
    if (adminDb && isFirestoreDatabaseAvailable()) {
      const docSnap = await withAdminTimeout(() => adminDb.collection('bikes').doc(slug).get(), 1000, null);
      if (docSnap && docSnap.exists) {
        const b = docSnap.data() as EBikeGrouped;
        if (b) {
          const sanitized = await sanitizeBikeImagesServer(b);
          // Reidrata esta bike de forma assíncrona no disco
          saveBikesToServerFileBulk([sanitized]).catch((err) =>
            console.warn('[ebikes.server] Erro ao reidratar ebike individual:', err)
          );
          return sanitized;
        }
      }
    }
  } catch (error) {
    console.warn(`[ebikes.server] Erro ao buscar bike ${slug} no Firestore:`, error);
  }

  const staticBike = getEBikeBySlug(slug);
  return staticBike ? await sanitizeBikeImagesServer(staticBike) : null;
}

export async function getEnrichedEBikeDetailFromFirestore(slug: string): Promise<EnrichedEBikeDetail | null> {
  const bike = await getEBikeBySlugFromFirestore(slug);
  if (!bike) return null;

  // Carrega avaliações reais e auditadas persistidas no banco de dados
  let realReviews = await getCommunityReviews(bike).catch(() => []);

  // Mescla com eventuais avaliações já cadastradas no documento da bike
  if (bike.reviews && Array.isArray(bike.reviews)) {
    const map = new Map<string, any>();
    realReviews.forEach((r) => map.set(r.id, r));
    bike.reviews.forEach((r) => {
      if (r && r.id && !map.has(r.id)) {
        map.set(r.id, r);
      }
    });
    realReviews = Array.from(map.values());
  }

  const bikeWithLiveReviews: EBikeGrouped = {
    ...bike,
    reviews: realReviews,
  };

  return buildEnrichedDetailFromBike(bikeWithLiveReviews);
}


