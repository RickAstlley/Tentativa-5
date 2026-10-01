export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-51V5XXS4MC';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// Verifica consentimento LGPD antes de disparar
export const hasCookieConsent = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('tuavia_cookie_consent') === 'accepted';
};

// Dispara eventos customizados para o Google Analytics 4 com checagem de consentimento
export const trackGAEvent = (action: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && hasCookieConsent() && typeof window.gtag === 'function') {
    window.gtag('event', action, params);
  }
};
