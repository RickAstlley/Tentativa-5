/**
 * lib/adsense.ts
 *
 * Carregamento do AdSense(subject to consentimento).
 *
 * Este módulo é o ÚNICO lugar que injeta o script do AdSense. Antes ele era um
 * `<Script strategy="lazyOnload">` no layout raiz, que carregava para todo
 * visitante — inclusive os que recusam cookies. Isso é problema de LGPD: o
 * AdSense grava cookies de publicidade personalizada, e no Brasil isso exige
 * consentimento prévio.
 *
 * Como o consentimento é estado do cliente, o servidor não consegue decidir.
 * A injeção acontece aqui, no navegador, só depois da escolha do visitante.
 */

const ADSENSE_CLIENT = 'ca-pub-7432900526570149';
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const CONSENT_KEY = 'tuavia_cookie_consent';

export const CONSENT_ACCEPTED_EVENT = 'tuavia:consent-accepted';
export const CONSENT_DECLINED_EVENT = 'tuavia:consent-declined';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function getConsent(): 'accepted' | 'declined' | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
}

export function hasAdsConsent(): boolean {
  return getConsent() === 'accepted';
}

let scriptPromise: Promise<void> | null = null;

/**
 * Injeta o script do AdSense uma única vez. Idempotente: chamar de novo antes
 * da decisão do visitante apenas marca que deve carregar assim que houver
 * consentimento.
 */
export function loadAdSenseScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof window === 'undefined') return Promise.resolve();

  scriptPromise = new Promise<void>((resolve, reject) => {
    if (window.adsbygoogle) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = ADSENSE_SRC;
    script.dataset.adsenseLoader = 'tuavia';
    script.onload = () => resolve();
    script.onerror = () => {
      // Um bloqueador de anúncios é o caso comum, não uma falha. O banner
      // simply fica com o espaço reservado e nada aparece — que é o correto.
      scriptPromise = null;
      reject(new Error('Não foi possível carregar o AdSense (bloqueador ativo ou rede).'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Assina as mudanças de consentimento.
 * O banner usa isto para carregar tarde, sem duplicar `<Script>`.
 */
export function onConsentChange(handler: (accepted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const accept = () => handler(true);
  const decline = () => handler(false);

  window.addEventListener(CONSENT_ACCEPTED_EVENT, accept);
  window.addEventListener(CONSENT_DECLINED_EVENT, decline);
  return () => {
    window.removeEventListener(CONSENT_ACCEPTED_EVENT, accept);
    window.removeEventListener(CONSENT_DECLINED_EVENT, decline);
  };
}

/** Usado pelo `CookieConsent` ao registrar a escolha. */
export function announceConsent(accepted: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(accepted ? CONSENT_ACCEPTED_EVENT : CONSENT_DECLINED_EVENT));
}
