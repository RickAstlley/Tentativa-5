'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';

const AboutDrawer = dynamic(() => import('@/components/AboutDrawer'), { ssr: false });
const SearchModal = dynamic(() => import('@/components/SearchModal'), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/CookieConsent'), { ssr: false });

export default function GlobalModals() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(() => setMounted(true), { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(() => setMounted(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <AboutDrawer />
      <SearchModal />
      <CookieConsent />
    </Suspense>
  );
}

