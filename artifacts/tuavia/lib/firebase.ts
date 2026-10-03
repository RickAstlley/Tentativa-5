import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { cleanEnvValue } from '@/lib/envShared';

import appletConfigJson from '../firebase-applet-config.json';

const appletConfig: Record<string, any> = appletConfigJson || {};

function getFirebaseProjectId(): string {
  const envPid = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID);
  if (envPid && !envPid.includes('placeholder') && envPid.trim() !== '') {
    return envPid.trim();
  }

  if (appletConfig.projectId) {
    return appletConfig.projectId;
  }

  const rawSA =
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_ADMIN_CREDENTIALS ||
    process.env.FIREBASE_CREDENTIALS ||
    process.env.GOOGLE_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (rawSA && typeof rawSA === 'string') {
    try {
      let cleaned = rawSA.trim();
      cleaned = cleaned
        .replace(/^(export\s+)?FIREBASE_ADMIN_SERVICE_ACCOUNT\s*=\s*/i, '')
        .replace(/^json\s*:\s*/i, '')
        .replace(/^service_account\s*:\s*/i, '')
        .trim();

      if (
        (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
        (cleaned.startsWith('"') && cleaned.endsWith('"'))
      ) {
        cleaned = cleaned.slice(1, -1).trim();
      }

      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.project_id) {
        return parsed.project_id;
      }
    } catch (_) {
      // ignore
    }
  }

  return 'tuavia-cf9ba';
}

export function getFirebaseDatabaseId(): string {
  const envDbId = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID);
  if (envDbId && !envDbId.includes('placeholder') && envDbId.trim() !== '' && envDbId !== '(default)') {
    return envDbId.trim();
  }
  if (appletConfig.firestoreDatabaseId) {
    return appletConfig.firestoreDatabaseId;
  }
  return '(default)';
}

const apiKey = cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY) || appletConfig.apiKey;
const projectId = getFirebaseProjectId();
const databaseId = getFirebaseDatabaseId();

const isServerBuild = typeof window === 'undefined' && process.env && process.env.NEXT_PHASE?.includes?.('build');

const finalApiKey = apiKey || (isServerBuild ? 'build-time-placeholder-key' : '');

if (!finalApiKey || finalApiKey.trim() === '') {
  throw new Error(
    'NEXT_PUBLIC_FIREBASE_API_KEY or FIREBASE_API_KEY must be set in environment. ' +
      'Copy .env.example to .env.local and fill in your Firebase project credentials.'
  );
}

const firebaseConfig = {
  apiKey: finalApiKey,
  authDomain: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN) || appletConfig.authDomain || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET) || appletConfig.storageBucket || `${projectId}.firebasestorage.app`,
  messagingSenderId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID) || appletConfig.messagingSenderId || '994446221503',
  appId: cleanEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID) || appletConfig.appId || '1:994446221503:web:41239ea88ef21951b6660a',
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);
export const storage: FirebaseStorage = getStorage(app);
export const auth: Auth = getAuth(app);

export function checkFirebaseConfigured(): boolean {
  const currentApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || appletConfig.apiKey || finalApiKey;
  const currentProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || appletConfig.projectId || projectId;
  const hasValidApiKey = Boolean(currentApiKey && !currentApiKey.includes('PlaceholderKey') && !currentApiKey.includes('build-time-placeholder') && currentApiKey.trim() !== '');
  const hasValidProjectId = Boolean(currentProjectId && !currentProjectId.includes('placeholder') && currentProjectId.trim() !== '');
  const hasServiceAccount = Boolean(
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_CREDENTIALS ||
    process.env.FIREBASE_ADMIN_CREDENTIALS
  );

  return (hasValidApiKey && hasValidProjectId) || hasValidProjectId || hasServiceAccount;
}

export const isFirebaseConfigured = checkFirebaseConfigured();

export default app;
