import { collectionsFor } from '@/lib/firestoreCollections';
import fs from 'fs/promises';
import path from 'path';
import { getAdminDb, isFirestoreDatabaseAvailable, markFirestoreUnavailable } from '@/lib/firebaseAdmin';
import { ensureServerEnvLoaded } from '@/lib/envLoader';
import {
  getAllArticlesServer,
  getDeletedSlugsServer,
  getAllBikesServer,
  getAllRankingsServer,
  saveArticlesToServerFileBulk,
  saveBikesToServerFileBulk,
  saveRankingsToServerFileBulk,
} from '@/lib/serverStorage';
import { Article } from '@/types/article';
import { EBikeGrouped } from '@/types/ebike';
import { TopRanking } from '@/types/ranking';
import { normalizeArticle } from '@/lib/articles';

const DATA_DIR = path.join(process.cwd(), 'data');
const SYNC_STATUS_FILE = path.join(DATA_DIR, 'last_firestore_sync.json');

// Sincronização automática a cada 30 minutos (1.800.000 ms)
export const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos em milissegundos
export const SYNC_INTERVAL_MINUTES = 30;

export interface SyncStatusRecord {
  lastSync: string;
  intervalMinutes: number;
  syncedArticlesCount: number;
  syncedBikesCount: number;
  syncedRankingsCount?: number;
  savedToDiskArticlesCount?: number;
  savedToDiskBikesCount?: number;
  savedToDiskRankingsCount?: number;
  uploadedToFirestoreArticlesCount?: number;
  uploadedToFirestoreBikesCount?: number;
  uploadedToFirestoreRankingsCount?: number;
  totalDiskArticles: number;
  totalDiskBikes: number;
  totalDiskRankings?: number;
  missingArticlesCount: number;
  missingBikesCount: number;
  status: 'success' | 'partial' | 'error' | 'skipped' | 'firestore_unavailable';
  syncedArticleSlugs: string[];
  syncedBikeSlugs: string[];
  message: string;
}

// Em memória: evita sincronizações concorrentes simultâneas
let isSyncing = false;
let globalSchedulerTimer: NodeJS.Timeout | null = null;

async function readSyncStatus(): Promise<SyncStatusRecord | null> {
  try {
    const content = await fs.readFile(SYNC_STATUS_FILE, 'utf-8');
    if (!content.trim()) return null;
    return JSON.parse(content) as SyncStatusRecord;
  } catch {
    return null;
  }
}

async function writeSyncStatus(status: SyncStatusRecord): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SYNC_STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[syncDiskToFirestore] Erro ao salvar status de sync no disco:', err);
  }
}

/**
 * Realiza a sincronização bidirecional completa entre o Firebase Firestore
 * e o armazenamento em disco da Hostinger a cada 30 minutos:
 * 1. Salva no disco da Hostinger todos os dados novos/atualizados do Firestore
 * 2. Envia para o Firestore dados criados ou atualizados no disco local
 */
export async function syncDiskToFirestore(force: boolean = false): Promise<SyncStatusRecord> {
  const now = new Date();

  // 1. Verifica intervalo de 30 minutos se não for forçado
  if (!force) {
    const lastRecord = await readSyncStatus();
    if (lastRecord && lastRecord.lastSync) {
      const lastTime = new Date(lastRecord.lastSync).getTime();
      const elapsed = now.getTime() - lastTime;
      if (elapsed < SYNC_INTERVAL_MS) {
        const remainingMinutes = Math.max(1, Math.round((SYNC_INTERVAL_MS - elapsed) / (60 * 1000)));
        return {
          ...lastRecord,
          intervalMinutes: SYNC_INTERVAL_MINUTES,
          status: 'skipped',
          message: `Sincronização 30min ignorada. Última execução há ${Math.round(elapsed / (60 * 1000))} min. Próxima rodada em ~${remainingMinutes} min.`,
        };
      }
    }
  }

  if (isSyncing) {
    return {
      lastSync: now.toISOString(),
      intervalMinutes: SYNC_INTERVAL_MINUTES,
      syncedArticlesCount: 0,
      syncedBikesCount: 0,
      syncedRankingsCount: 0,
      totalDiskArticles: 0,
      totalDiskBikes: 0,
      missingArticlesCount: 0,
      missingBikesCount: 0,
      status: 'skipped',
      syncedArticleSlugs: [],
      syncedBikeSlugs: [],
      message: 'Sincronização já em andamento por outro processo.',
    };
  }

  isSyncing = true;
  ensureServerEnvLoaded();

  try {
    const adminDb = getAdminDb();
    if (!adminDb || !isFirestoreDatabaseAvailable()) {
      const diskArticles = await getAllArticlesServer();
      const diskBikes = await getAllBikesServer();
      const diskRankings = await getAllRankingsServer();

      const record: SyncStatusRecord = {
        lastSync: now.toISOString(),
        intervalMinutes: SYNC_INTERVAL_MINUTES,
        syncedArticlesCount: 0,
        syncedBikesCount: 0,
        syncedRankingsCount: 0,
        savedToDiskArticlesCount: 0,
        savedToDiskBikesCount: 0,
        savedToDiskRankingsCount: 0,
        uploadedToFirestoreArticlesCount: 0,
        uploadedToFirestoreBikesCount: 0,
        uploadedToFirestoreRankingsCount: 0,
        totalDiskArticles: diskArticles.length,
        totalDiskBikes: diskBikes.length,
        totalDiskRankings: diskRankings.length,
        missingArticlesCount: 0,
        missingBikesCount: 0,
        status: 'firestore_unavailable',
        syncedArticleSlugs: [],
        syncedBikeSlugs: [],
        message: 'Firestore indisponível, limite de quota atingido ou credenciais não configuradas. Dados mantidos com 100% de segurança e persistência no disco da Hostinger.',
      };
      await writeSyncStatus(record);
      return record;
    }

    // 2. Carrega artigos, bikes, rankings do disco e a lista de itens deletados
    const diskArticles = await getAllArticlesServer();
    const diskBikes = await getAllBikesServer();
    const diskRankings = await getAllRankingsServer();
    const deletedRecord = await getDeletedSlugsServer();
    const deletedArticlesSet = new Set(deletedRecord.articles || []);
    const deletedBikesSet = new Set(deletedRecord.bikes || []);
    const deletedRankingsSet = new Set(deletedRecord.rankings || []);

    const diskArticleSlugsSet = new Set(diskArticles.map((a) => a.slug));
    const diskBikeSlugsSet = new Set(diskBikes.map((b) => b.slug));
    const diskRankingSlugsSet = new Set(diskRankings.map((r) => r.slug));

    // =========================================================================
    // PASSO A: FIRESTORE ➔ DISCO HOSTINGER (SALVAMENTO NO DISCO)
    // =========================================================================

    // 3. Busca artigos existentes no Firestore em coleções possíveis
    const firestoreArticlesList: Article[] = [];
    const existingFirestoreArticleSlugs = new Set<string>();
    const articleCols = collectionsFor('articles');

    for (const col of articleCols) {
      try {
        const snap = await adminDb.collection(col).get();
        if (!snap.empty) {
          snap.forEach((doc) => {
            existingFirestoreArticleSlugs.add(doc.id);
            const data = doc.data() as Article;
            if (data && data.slug && !deletedArticlesSet.has(data.slug)) {
              firestoreArticlesList.push(data);
            }
          });
        }
      } catch (err) {
        // ignora se coleção não existir
      }
    }

    // Identifica artigos do Firestore que precisam ser gravados no disco da Hostinger
    const articlesToSaveOnDisk = firestoreArticlesList.filter((art) => {
      if (!art || !art.slug) return false;
      if (deletedArticlesSet.has(art.slug)) return false;
      return force || !diskArticleSlugsSet.has(art.slug);
    });

    if (articlesToSaveOnDisk.length > 0) {
      console.log(`[Sync 30min] 💾 Salvando ${articlesToSaveOnDisk.length} artigo(s) do Firestore no disco da Hostinger...`);
      await saveArticlesToServerFileBulk(articlesToSaveOnDisk);
    }

    // 4. Busca e-bikes existentes no Firestore em coleções possíveis
    const firestoreBikesList: EBikeGrouped[] = [];
    const existingFirestoreBikeSlugs = new Set<string>();
    const bikeCols = collectionsFor('bikes');

    for (const col of bikeCols) {
      try {
        const snap = await adminDb.collection(col).get();
        if (!snap.empty) {
          snap.forEach((doc) => {
            existingFirestoreBikeSlugs.add(doc.id);
            const data = doc.data() as EBikeGrouped;
            if (data && data.slug && !deletedBikesSet.has(data.slug)) {
              firestoreBikesList.push(data);
            }
          });
        }
      } catch (err) {
        // ignora se coleção não existir
      }
    }

    // Identifica e-bikes do Firestore que precisam ser gravadas no disco da Hostinger
    const bikesToSaveOnDisk = firestoreBikesList.filter((bike) => {
      if (!bike || !bike.slug) return false;
      if (deletedBikesSet.has(bike.slug)) return false;
      return force || !diskBikeSlugsSet.has(bike.slug);
    });

    if (bikesToSaveOnDisk.length > 0) {
      console.log(`[Sync 30min] 💾 Salvando ${bikesToSaveOnDisk.length} e-bike(s) do Firestore no disco da Hostinger...`);
      await saveBikesToServerFileBulk(bikesToSaveOnDisk);
    }

    // 5. Busca rankings existentes no Firestore
    const firestoreRankingsList: TopRanking[] = [];
    const existingFirestoreRankingSlugs = new Set<string>();
    const rankingCols = collectionsFor('rankings');

    for (const col of rankingCols) {
      try {
        const snap = await adminDb.collection(col).get();
        if (!snap.empty) {
          snap.forEach((doc) => {
            existingFirestoreRankingSlugs.add(doc.id);
            const data = doc.data() as TopRanking;
            if (data && data.slug && !deletedRankingsSet.has(data.slug)) {
              firestoreRankingsList.push(data);
            }
          });
        }
      } catch (err) {
        // ignora se coleção não existir
      }
    }

    // Identifica rankings do Firestore que precisam ser gravados no disco da Hostinger
    const rankingsToSaveOnDisk = firestoreRankingsList.filter((ranking) => {
      if (!ranking || !ranking.slug) return false;
      if (deletedRankingsSet.has(ranking.slug)) return false;
      return force || !diskRankingSlugsSet.has(ranking.slug);
    });

    if (rankingsToSaveOnDisk.length > 0) {
      console.log(`[Sync 30min] 💾 Salvando ${rankingsToSaveOnDisk.length} ranking(s) do Firestore no disco da Hostinger...`);
      await saveRankingsToServerFileBulk(rankingsToSaveOnDisk);
    }

    // =========================================================================
    // PASSO B: DISCO HOSTINGER ➔ FIRESTORE (ENVIAR ITENS LOCAIS)
    // =========================================================================

    // 6. Identifica artigos a serem enviados para o Firestore
    const targetArticles = diskArticles.filter((art) => {
      if (!art || !art.slug) return false;
      if (deletedArticlesSet.has(art.slug)) return false;
      return force || !existingFirestoreArticleSlugs.has(art.slug);
    });

    const syncedArticleSlugs: string[] = [];

    // Envia artigos para o Firestore em lotes de 400
    if (targetArticles.length > 0) {
      console.log(`[Sync 30min] 📰 Enviando ${targetArticles.length} artigo(s) do disco da Hostinger para o Firestore (force=${force})...`);
      const BATCH_SIZE = 400;
      for (let i = 0; i < targetArticles.length; i += BATCH_SIZE) {
        const chunk = targetArticles.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();
        chunk.forEach((art) => {
          const norm = normalizeArticle(art);
          const cleanArt = JSON.parse(JSON.stringify(norm));
          const docRef = adminDb.collection('artigos').doc(cleanArt.slug);
          batch.set(docRef, cleanArt, { merge: true });
          syncedArticleSlugs.push(cleanArt.slug);
        });
        await batch.commit();
      }
      console.log(`[Sync 30min] ✅ ${targetArticles.length} artigo(s) sincronizado(s) no Firestore com sucesso!`);
    }

    // 7. Identifica e-bikes a serem enviadas para o Firestore
    const targetBikes = diskBikes.filter((bike) => {
      if (!bike || !bike.slug) return false;
      if (deletedBikesSet.has(bike.slug)) return false;
      return force || !existingFirestoreBikeSlugs.has(bike.slug);
    });

    const syncedBikeSlugs: string[] = [];

    if (targetBikes.length > 0) {
      console.log(`[Sync 30min] 🚲 Enviando ${targetBikes.length} e-bike(s) do disco da Hostinger para o Firestore (force=${force})...`);
      const BATCH_SIZE = 400;
      for (let i = 0; i < targetBikes.length; i += BATCH_SIZE) {
        const chunk = targetBikes.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();
        chunk.forEach((bike) => {
          const cleanBike = JSON.parse(JSON.stringify(bike));
          const docRef = adminDb.collection('bikes').doc(cleanBike.slug);
          batch.set(docRef, cleanBike, { merge: true });
          syncedBikeSlugs.push(cleanBike.slug);
        });
        await batch.commit();
      }
      console.log(`[Sync 30min] ✅ ${targetBikes.length} e-bike(s) sincronizada(s) no Firestore com sucesso!`);
    }

    // 8. Identifica rankings a serem enviados para o Firestore
    const targetRankings = diskRankings.filter((ranking) => {
      if (!ranking || !ranking.slug) return false;
      if (deletedRankingsSet.has(ranking.slug)) return false;
      return force || !existingFirestoreRankingSlugs.has(ranking.slug);
    });

    if (targetRankings.length > 0) {
      console.log(`[Sync 30min] 🏆 Enviando ${targetRankings.length} ranking(s) do disco da Hostinger para o Firestore (force=${force})...`);
      const BATCH_SIZE = 400;
      for (let i = 0; i < targetRankings.length; i += BATCH_SIZE) {
        const chunk = targetRankings.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();
        chunk.forEach((ranking) => {
          const cleanRanking = JSON.parse(JSON.stringify(ranking));
          const docRef = adminDb.collection('rankings').doc(cleanRanking.slug);
          batch.set(docRef, cleanRanking, { merge: true });
        });
        await batch.commit();
      }
      console.log(`[Sync 30min] ✅ ${targetRankings.length} ranking(s) sincronizado(s) no Firestore com sucesso!`);
    }

    // Atualiza totais em disco após gravação
    const updatedDiskArticles = await getAllArticlesServer();
    const updatedDiskBikes = await getAllBikesServer();
    const updatedDiskRankings = await getAllRankingsServer();

    const record: SyncStatusRecord = {
      lastSync: now.toISOString(),
      intervalMinutes: SYNC_INTERVAL_MINUTES,
      syncedArticlesCount: targetArticles.length + articlesToSaveOnDisk.length,
      syncedBikesCount: targetBikes.length + bikesToSaveOnDisk.length,
      syncedRankingsCount: targetRankings.length + rankingsToSaveOnDisk.length,
      savedToDiskArticlesCount: articlesToSaveOnDisk.length,
      savedToDiskBikesCount: bikesToSaveOnDisk.length,
      savedToDiskRankingsCount: rankingsToSaveOnDisk.length,
      uploadedToFirestoreArticlesCount: targetArticles.length,
      uploadedToFirestoreBikesCount: targetBikes.length,
      uploadedToFirestoreRankingsCount: targetRankings.length,
      totalDiskArticles: updatedDiskArticles.length,
      totalDiskBikes: updatedDiskBikes.length,
      totalDiskRankings: updatedDiskRankings.length,
      missingArticlesCount: Math.max(0, updatedDiskArticles.length - existingFirestoreArticleSlugs.size),
      missingBikesCount: Math.max(0, updatedDiskBikes.length - existingFirestoreBikeSlugs.size),
      status: 'success',
      syncedArticleSlugs,
      syncedBikeSlugs,
      message:
        articlesToSaveOnDisk.length === 0 &&
        bikesToSaveOnDisk.length === 0 &&
        targetArticles.length === 0 &&
        targetBikes.length === 0
          ? 'Todos os artigos, e-bikes e rankings estão 100% sincronizados entre o Firestore e o disco da Hostinger (ciclo 30 min).'
          : `Sincronização 30min concluída: ${articlesToSaveOnDisk.length} artigos e ${bikesToSaveOnDisk.length} bikes salvos no disco; ${targetArticles.length} artigos e ${targetBikes.length} bikes enviados ao Firestore.`,
    };

    await writeSyncStatus(record);
    return record;
  } catch (err: any) {
    const isQuotaExceeded =
      err?.code === 8 ||
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('Quota limit exceeded');

    if (isQuotaExceeded) {
      markFirestoreUnavailable();
      console.warn('[syncDiskToFirestore] Quota do Firestore excedida (RESOURCE_EXHAUSTED). Operando com fallback do disco local Hostinger.');
    } else {
      console.error('[syncDiskToFirestore] Erro ao sincronizar disco da Hostinger com Firestore:', err);
    }

    const diskArticles = await getAllArticlesServer().catch(() => []);
    const diskBikes = await getAllBikesServer().catch(() => []);
    const diskRankings = await getAllRankingsServer().catch(() => []);

    const errRecord: SyncStatusRecord = {
      lastSync: now.toISOString(),
      intervalMinutes: SYNC_INTERVAL_MINUTES,
      syncedArticlesCount: 0,
      syncedBikesCount: 0,
      syncedRankingsCount: 0,
      totalDiskArticles: diskArticles.length,
      totalDiskBikes: diskBikes.length,
      totalDiskRankings: diskRankings.length,
      missingArticlesCount: 0,
      missingBikesCount: 0,
      status: isQuotaExceeded ? 'firestore_unavailable' : 'error',
      syncedArticleSlugs: [],
      syncedBikeSlugs: [],
      message: isQuotaExceeded
        ? 'Quota diária do Firestore atingida (RESOURCE_EXHAUSTED). Mantendo o site operando 100% via armazenamento em disco local da Hostinger.'
        : `Erro ao sincronizar (ciclo 30 min): ${err?.message || String(err)}`,
    };
    await writeSyncStatus(errRecord);
    return errRecord;
  } finally {
    isSyncing = false;
  }
}

/**
 * Inicializa a execução automática a cada 30 minutos no ambiente Node.js do servidor.
 */
export function initAutoSyncScheduler(): void {
  if (globalSchedulerTimer) return; // já inicializado

  console.log('[Sync 30min] ⏱️ Inicializando agendador automático de sincronização bidirecional Firebase ⇄ Disco Hostinger (a cada 30 minutos)...');

  // Tenta rodar uma checagem inicial leve após 10 segundos
  setTimeout(() => {
    syncDiskToFirestore(false).catch((err) =>
      console.warn('[Sync 30min] Erro na checagem inicial:', err)
    );
  }, 10000);

  // Agenda loop recorrente de 30 em 30 minutos
  globalSchedulerTimer = setInterval(() => {
    console.log('[Sync 30min] 🔄 Executando sincronização programada de 30 minutos...');
    syncDiskToFirestore(true).catch((err) =>
      console.warn('[Sync 30min] Erro na sincronização programada de 30 min:', err)
    );
  }, SYNC_INTERVAL_MS);
}

// Alias para compatibilidade com chamadas existentes
export const initSixHourSyncScheduler = initAutoSyncScheduler;

// Inicia o agendador automaticamente quando o módulo é importado no servidor Node.js em tempo de execução (não durante build)
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  // Sincronização automática desativada (mudança para manual conforme solicitação do usuário)
  // initAutoSyncScheduler();
  console.log('[Sync] Sincronização automática em segundo plano desativada. Agora operando em modo 100% manual.');
}


