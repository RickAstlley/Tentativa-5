'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Script from 'next/script';
import { ShieldCheck, Cookie, X } from 'lucide-react';
import { GA_MEASUREMENT_ID } from '@/lib/gtag';
import { announceConsent } from '@/lib/adsense';

const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

const getSnapshot = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tuavia_cookie_consent') as 'accepted' | 'declined' | null;
};

const getServerSnapshot = () => null;

export default function CookieConsent() {
  const [localConsent, setLocalConsent] = useState<'accepted' | 'declined' | null>(null);
  const storedConsent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const consent = localConsent ?? storedConsent;

  const handleAccept = () => {
    localStorage.setItem('tuavia_cookie_consent', 'accepted');
    setLocalConsent('accepted');
    // O AdSense só pode carregar depois desta linha: o script grava cookies de
    // publicidade personalizada. O evento é o que destrava os banners.
    announceConsent(true);
  };

  const handleDecline = () => {
    localStorage.setItem('tuavia_cookie_consent', 'declined');
    setLocalConsent('declined');
    announceConsent(false);
  };

  return (
    <>
      {/* Script do GA4 - Apenas injetado se o usuário aceitou os cookies */}
      {consent === 'accepted' && GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="google-analytics-gtag"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}

      {/* Banner de Consentimento LGPD (Visível até o usuário escolher) */}
      {consent === null && (
        <div 
          id="cookie-consent-banner"
          className="fixed bottom-[92px] sm:bottom-[98px] md:bottom-6 left-2.5 right-2.5 sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md z-[55] bg-surface border-2 border-ink rounded-2xl p-3 sm:p-4 md:p-5 shadow-[3px_3px_0_0_rgba(46,43,39,1)] md:shadow-[6px_6px_0_0_rgba(46,43,39,1)] flex flex-col gap-2 sm:gap-3 animate-in slide-in-from-bottom-5 duration-300"
          role="dialog"
          aria-live="polite"
          aria-label="Consentimento de Cookies e Privacidade LGPD"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent-gold/20 border border-accent-gold/40 rounded-lg text-accent-gold shrink-0">
                <Cookie className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm text-ink font-display font-bold">Privacidade & Cookies (LGPD)</span>
            </div>
            <button
              onClick={handleDecline}
              className="text-ink/60 hover:text-ink p-2 rounded-lg transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Fechar (Apenas Essenciais)"
              aria-label="Fechar banner de cookies e usar apenas essenciais"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-ink/80 leading-snug sm:leading-relaxed font-sans">
            Usamos cookies e métricas anônimas para salvar suas preferências e otimizar a comparação de e-bikes. Seus dados não são vendidos.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
            <button
              onClick={handleDecline}
              className="flex-1 sm:flex-none px-3 py-2 text-xs font-mono font-bold text-ink/80 hover:text-ink bg-neutral-100 hover:bg-neutral-200 border border-ink/40 rounded-xl transition-all cursor-pointer min-h-[44px] flex items-center justify-center text-center"
            >
              Apenas Essenciais
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs font-mono font-bold text-white bg-primary hover:bg-primary-dark border border-primary/20 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-accent-charge" />
              <span>Aceitar Cookies</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
