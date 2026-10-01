'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, X, Check, AlertCircle, Smartphone, Monitor, Globe } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebApp = (window.navigator as any).standalone === true;
    if (isStandalone || isInWebApp) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem('pwa_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      setDismissed(true);
      return;
    }

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after 10 seconds on admin pages
      setTimeout(() => {
        if (mountedRef.current && !isInstalled && !dismissed) {
          setShowPrompt(true);
        }
      }, 10000);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    // Track app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, [dismissed, isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa_dismissed_until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setDismissed(true);
  };

  if (isInstalled || !showPrompt || !mountedRef.current) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 lg:right-auto lg:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300" role="dialog" aria-label="Instalar TuaVia Admin">
      <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
        <div className="p-4 bg-amber-50 border-b-2 border-stone-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-900 text-sm">Instalar TuaVia Admin</h3>
              <p className="text-[11px] text-stone-600">Acesso rápido offline, notificações e experiência nativa</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors" aria-label="Dispensar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-stone-200 space-y-2 text-[11px] text-stone-700">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Funciona offline (IndexedDB + Service Worker)</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Acesso rápido pela tela inicial</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Notificações de jobs IA em tempo real</span>
          </div>
        </div>
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
          <button onClick={handleDismiss} className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-lg border border-stone-200 transition-colors">
            Agora não
          </button>
          <button onClick={handleInstall} className="px-4 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs rounded-lg shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span>Instalar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}