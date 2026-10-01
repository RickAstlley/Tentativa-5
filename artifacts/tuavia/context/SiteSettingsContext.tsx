'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SiteSettings } from '@/types/settings';
import { DEFAULT_SITE_SETTINGS, fetchSiteSettingsFromFirestore, sanitizeSiteSettings } from '@/lib/settings';

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: DEFAULT_SITE_SETTINGS,
  loading: false,
  refreshSettings: async () => {},
});

export function SiteSettingsProvider({
  children,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettings?: Partial<SiteSettings>;
}) {
  const [settings, setSettings] = useState<SiteSettings>(() =>
    initialSettings ? sanitizeSiteSettings(initialSettings) : DEFAULT_SITE_SETTINGS
  );
  const [loading, setLoading] = useState<boolean>(false);

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSiteSettingsFromFirestore();
      setSettings(data);
    } catch (error) {
      console.warn('Erro ao atualizar configurações:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    try {
      const docRef = doc(db, 'settings', 'site');
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (!isMounted) return;
          if (snapshot.exists()) {
            setSettings(sanitizeSiteSettings(snapshot.data()));
          }
        },
        (error) => {
          console.warn('Fallback para configurações locais:', error);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (error) {
      console.warn('Erro ao registrar listener de settings:', error);
      return () => {
        isMounted = false;
      };
    }
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettingsContextType {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    return {
      settings: DEFAULT_SITE_SETTINGS,
      loading: false,
      refreshSettings: async () => {},
    };
  }
  return context;
}
