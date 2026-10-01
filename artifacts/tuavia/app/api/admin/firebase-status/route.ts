import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, parseServiceAccount, getRawServiceAccountEnv, getFirebaseProjectIdEnv, isRealFirebaseConfigured } from '@/lib/firebaseAdmin';
import { verifyServerAdmin } from '@/lib/serverAdminAuth';
import { cleanEnvValue, ensureServerEnvLoaded } from '@/lib/envLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTIONS_TO_CHECK = ['artigos', 'articles', 'publicacoes', 'posts', 'bicicletas', 'bikes', 'ebikes', 'rankings', 'settings'];
const FIRESTORE_COLLECTION_TIMEOUT_MS = 2500;

type FirestoreCollectionResult = {
  snapshot?: any;
  error?: any;
  timedOut?: boolean;
};

async function readFirestoreCollection(adminDb: any, collectionName: string): Promise<FirestoreCollectionResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = adminDb
    .collection(collectionName)
    .limit(20)
    .get()
    .then((snapshot: any) => ({ snapshot }))
    .catch((error: any) => ({ error }));
  const timeout = new Promise<FirestoreCollectionResult>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), FIRESTORE_COLLECTION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const auth = verifyServerAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        message: 'Acesso não autorizado ao diagnóstico do Firebase. Autenticação de administrador necessária.',
      },
      { status: 401 }
    );
  }

  const { loadedFiles } = ensureServerEnvLoaded(true);

  const rawSA = getRawServiceAccountEnv();
  const parsedSA = parseServiceAccount(rawSA);
  const detectedProjectId = getFirebaseProjectIdEnv() || parsedSA?.project_id || '';
  const isRealConfigured = isRealFirebaseConfigured();

  const apiKeyVal = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '');
  const hasApiKey = Boolean(apiKeyVal && !apiKeyVal.includes('placeholder') && !apiKeyVal.includes('PlaceholderKey'));

  const envPidVal = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '');
  const hasProjectId = Boolean((envPidVal && !envPidVal.includes('placeholder')) || parsedSA?.project_id);

  const envCheck = {
    NEXT_PUBLIC_FIREBASE_API_KEY: hasApiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: hasProjectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID),
    NEXT_PUBLIC_FIREBASE_APP_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID),
    FIREBASE_ADMIN_SERVICE_ACCOUNT: Boolean(rawSA),
    FIREBASE_ADMIN_SERVICE_ACCOUNT_VALID: Boolean(parsedSA && (parsedSA.private_key || parsedSA.project_id)),
    FIREBASE_PROJECT_ID: detectedProjectId || (parsedSA?.project_id ? `${parsedSA.project_id} (via Service Account)` : 'Nenhum definido'),
    IS_REAL_CONFIGURED: isRealConfigured,
  };

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({
      success: false,
      connected: false,
      isRealConfigured,
      loadedFiles,
      message: 'Firebase Admin DB não pôde ser inicializado. Para conectar com o Firestore em produção, adicione a variável FIREBASE_ADMIN_SERVICE_ACCOUNT ou o arquivo serviceAccountKey.json na raiz do projeto na Hostinger.',
      envCheck,
      collections: {},
    });
  }

  const collectionsReport: Record<string, { count: number; docs: Array<{ id: string; title?: string }> }> = {};
  let totalDocsFound = 0;

  let firestoreDbError: string | null = null;
  let databaseExists = true;
  let permissionDenied = false;
  let quotaExhausted = false;

  const collectionResults = await Promise.all(
    COLLECTIONS_TO_CHECK.map((colName) => readFirestoreCollection(adminDb, colName))
  );

  collectionResults.forEach((result, index) => {
    const colName = COLLECTIONS_TO_CHECK[index];
    const snap = result.snapshot;

    if (snap) {
      const docsSummary: Array<{ id: string; title?: string }> = [];
      snap.forEach((d: any) => {
        const data = d.data();
        docsSummary.push({
          id: d.id,
          title: data.title || data.titulo || data.name || data.nome || '(sem título)',
        });
      });
      collectionsReport[colName] = {
        count: snap.size,
        docs: docsSummary,
      };
      totalDocsFound += snap.size;
      return;
    }

    if (result.timedOut) {
      if (!firestoreDbError) {
        firestoreDbError = `A consulta à coleção "${colName}" excedeu ${FIRESTORE_COLLECTION_TIMEOUT_MS / 1000}s.`;
      }
    } else {
      const err = result.error;
      const errStr = err?.message || String(err);
      const errCode = err?.code;

      if (errCode === 5 || errStr.includes('5 NOT_FOUND') || errStr.includes('does not exist')) {
        databaseExists = false;
        firestoreDbError = 'O banco de dados Cloud Firestore (default) ainda não foi criado no console do Firebase para este projeto.';
      } else if (errCode === 7 || errStr.includes('PERMISSION_DENIED') || errStr.includes('7 PERMISSION_DENIED')) {
        permissionDenied = true;
        firestoreDbError = 'Permissão negada (PERMISSION_DENIED). A Service Account precisa da permissão "Cloud Datastore User" ou "Firebase Admin" no Google Cloud Console.';
      } else if (errCode === 8 || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota limit exceeded')) {
        quotaExhausted = true;
        firestoreDbError = 'Quota diária do Firestore atingida (RESOURCE_EXHAUSTED). O site opera normalmente usando o disco local da Hostinger.';
      } else if (!firestoreDbError) {
        firestoreDbError = errStr;
      }
    }

    collectionsReport[colName] = {
      count: -1,
      docs: [],
    };
  });

  if (!databaseExists) {
    return NextResponse.json({
      success: false,
      connected: false,
      databaseExists: false,
      permissionDenied: false,
      quotaExhausted: false,
      isRealConfigured,
      loadedFiles,
      firestoreConsoleUrl: `https://console.firebase.google.com/project/${detectedProjectId}/firestore`,
      message: `Credenciais encontradas, porém o banco de dados Cloud Firestore (default) ainda NÃO foi criado no projeto "${detectedProjectId}". Crie o banco de dados no Firebase Console.`,
      envCheck,
      errorDetails: firestoreDbError,
      collections: collectionsReport,
    });
  }

  if (permissionDenied) {
    return NextResponse.json({
      success: false,
      connected: false,
      databaseExists: true,
      permissionDenied: true,
      quotaExhausted: false,
      isRealConfigured,
      loadedFiles,
      message: `Permissão negada no Firestore: A conta de serviço não tem permissão para ler/gravar na coleção do projeto "${detectedProjectId}". Verifique o IAM no Google Cloud Console.`,
      envCheck,
      errorDetails: firestoreDbError,
      collections: collectionsReport,
    });
  }

  if (quotaExhausted) {
    return NextResponse.json({
      success: false,
      connected: false,
      databaseExists: true,
      permissionDenied: false,
      quotaExhausted: true,
      isRealConfigured,
      loadedFiles,
      message: 'Quota diária do Firestore atingida (RESOURCE_EXHAUSTED). O site está operando 100% via armazenamento em disco local da Hostinger.',
      envCheck,
      errorDetails: firestoreDbError,
      collections: collectionsReport,
    });
  }

  if (firestoreDbError && totalDocsFound === 0) {
    return NextResponse.json({
      success: false,
      connected: false,
      databaseExists: true,
      permissionDenied: false,
      quotaExhausted: false,
      isRealConfigured,
      loadedFiles,
      message: `Erro ao consultar coleções do Firestore: ${firestoreDbError}`,
      envCheck,
      errorDetails: firestoreDbError,
      collections: collectionsReport,
    });
  }

  return NextResponse.json({
    success: true,
    connected: true,
    databaseExists: true,
    permissionDenied: false,
    quotaExhausted: false,
    isRealConfigured,
    loadedFiles,
    message: totalDocsFound > 0
      ? `Conexão ativa com Firebase Firestore (${detectedProjectId}). ${totalDocsFound} documentos encontrados nas coleções verificadas.`
      : `Conexão ativa com Firebase Firestore (${detectedProjectId}). Nenhuma publicação encontrada ainda nas coleções pesquisadas.`,
    envCheck,
    totalDocsFound,
    collections: collectionsReport,
  });
}
