'use client';

import React, { useEffect } from 'react';

export default function SWRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/admin/',
          });
          
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  if (confirm('Nova versão do TuaVia Admin disponível! Recarregar para atualizar?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });

          console.log('[PWA] Service Worker registrado:', registration.scope);
        } catch (error) {
          console.error('[PWA] Erro ao registrar Service Worker:', error);
        }
      };

      // Register after page load to not block initial render
      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}