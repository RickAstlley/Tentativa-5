import { useEffect, useRef, useCallback, useState } from 'react';

interface AutoSaveOptions<T> {
  key: string;
  data: T;
  onSave?: (data: T) => void;
  onRestore?: (data: T) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
  maxAgeMs?: number;
  serialize?: (data: T) => string;
  deserialize?: (str: string) => T;
  enabled?: boolean;
}

interface StoredPayload<T> {
  data: string;
  timestamp: number;
  version: number;
}

const STORAGE_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open('TuaviaAdmin', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('autosave')) {
        db.createObjectStore('autosave');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function useAutoSave<T>({
  key,
  data,
  onSave,
  onRestore,
  onError,
  debounceMs = 2000,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  enabled = true,
}: AutoSaveOptions<T>) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  const mountedRef = useRef(false);
  const dbRef = useRef<IDBDatabase | null>(null);
  const [lastRestored, setLastRestored] = useState<Date | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const initDB = async () => {
      try {
        dbRef.current = await openDB();
      } catch (e) {
        console.warn('[AutoSave] IndexedDB unavailable, using localStorage only:', e);
      }
    };
    initDB();

    const restore = async () => {
      if (!enabled) return;
      try {
        if (dbRef.current) {
          const stored = await getFromIDB<StoredPayload<T>>(dbRef.current, 'autosave', key);
          if (stored && Date.now() - stored.timestamp < maxAgeMs && stored.version === STORAGE_VERSION) {
            const restored = deserialize(stored.data);
            onRestore?.(restored);
            lastSavedRef.current = stored.data;
            setLastRestored(new Date(stored.timestamp));
            return;
          }
        }
        const local = localStorage.getItem(`autosave_${key}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (Date.now() - parsed.timestamp < maxAgeMs && parsed.version === STORAGE_VERSION) {
            const restored = deserialize(parsed.data);
            onRestore?.(restored);
            lastSavedRef.current = parsed.data;
            setLastRestored(new Date(parsed.timestamp));
          }
        }
      } catch (e) {
        console.warn('[AutoSave] Falha ao restaurar:', e);
        onError?.(e as Error);
      }
    };
    restore();
  }, [key, deserialize, maxAgeMs, onRestore, onError, enabled]);

  const save = useCallback(async () => {
    if (!enabled) return;
    const serialized = serialize(data);
    if (serialized === lastSavedRef.current) return;

    lastSavedRef.current = serialized;
    const payload: StoredPayload<T> = { data: serialized, timestamp: Date.now(), version: STORAGE_VERSION };

    try {
      if (dbRef.current) {
        await putToIDB(dbRef.current, 'autosave', payload, key);
      }
      localStorage.setItem(`autosave_${key}`, JSON.stringify(payload));
      onSave?.(data);
    } catch (e) {
      console.error('[AutoSave] Falha ao salvar:', e);
      onError?.(e as Error);
    }
  }, [key, data, serialize, onSave, onError, enabled]);

  useEffect(() => {
    if (!mountedRef.current || !enabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, debounceMs);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [data, debounceMs, save, enabled]);

  useEffect(() => {
    const handleBeforeUnload = () => save();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [save]);

  const forceSave = useCallback(() => save(), [save]);
  const clear = useCallback(async () => {
    lastSavedRef.current = '';
    try {
      if (dbRef.current) {
        await deleteFromIDB(dbRef.current, 'autosave', key);
      }
      localStorage.removeItem(`autosave_${key}`);
    } catch (e) {
      console.warn('[AutoSave] Falha ao limpar:', e);
      onError?.(e as Error);
    }
  }, [key, onError]);

  return { forceSave, clear, lastRestored, lastSaved: lastSavedRef.current };
}

function getFromIDB<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function putToIDB<T>(db: IDBDatabase, storeName: string, value: T, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteFromIDB(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}