// vitest.setup.ts
// Global test setup for Vitest

import { vi } from 'vitest';

// Mock environment variables for tests
vi.stubGlobal('process', {
  ...process,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    ADMIN_EMAILS: 'admin@test.com',
    ADMIN_PASSCODE: 'test-passcode',
    ADMIN_SESSION_SECRET: 'test-secret-key-very-long-and-random-1234567890',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
    NEXT_PUBLIC_FIREBASE_DATABASE_ID: '(default)',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef',
  },
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  isFirebaseConfigured: true,
  checkFirebaseConfigured: () => true,
}));

// Mock Firebase Admin
vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => null,
  getAdminDb: () => null,
  ensureAdminAccessConfig: vi.fn().mockResolvedValue(undefined),
}));

// Mock security
vi.mock('@/lib/security', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 }),
}));

// Mock envLoader
vi.mock('@/lib/envLoader', () => ({
  cleanEnvValue: (val?: string | null) => (val || '').trim(),
  ensureServerEnvLoaded: vi.fn(),
}));

// Suppress console.warn in tests unless explicitly testing warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('[test]') || process.env.VITEST_VERBOSE) {
    originalWarn(...args);
  }
};