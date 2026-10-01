import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import Image from 'next/image';
import './globals.css'; // Global styles
import PublicShell from '@/components/PublicShell';
import { SiteSettingsProvider } from '@/context/SiteSettingsContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FAFAF7',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://tuavia.com.br'),
  title: 'TuaVia | Comparador de Bicicletas Elétricas',
  description: 'Encontre a e-bike perfeita pelo menor preço. Ofertas reais conferidas manualmente para você tomar o seu caminho.',
  verification: {
    google: '3u4UP8pfdZ7mCrRCBl0_FnLqiOOvpFtqjbSAO4ooKnI',
  },
  other: {
    'google-adsense-account': 'ca-pub-7432900526570149',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Google Fonts (Plus Jakarta Sans & IBM Plex Mono) carregadas com preconnect e swap */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
        />

        {/* Resource Hints para acelerar imagens remotas e links de marketplaces */}
        <link rel="preconnect" href="https://http2.mlstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://http2.mlstatic.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://img.olx.com.br" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://img.olx.com.br" />
        <link rel="preconnect" href="https://twodogs.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://twodogs.com" />
        <link rel="preconnect" href="https://www.lgimportados.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.lgimportados.com" />
        
        {/* Preload LCP-critical images */}
        <link rel="preload" as="image" href="/images/ciclovia-bg.webp" fetchPriority="high" />
      </head>
      <body suppressHydrationWarning className="text-ink antialiased">
        {/*
          O script do AdSense NÃO é carregado aqui.

          Ele vivia neste layout com `lazyOnload`, o que baixava a biblioteca de
          publicidade para todo visitante — inclusive para quem recusa cookies.
          O AdSense grava cookies de publicidade personalizada, e no Brasil isso
          exige consentimento prévio (LGPD). Como a escolha é estado do cliente,
          a injeção acontece em `lib/adsense.ts`, só depois do aceite.
        */}

        {/* Google Tag Manager (Script) carregado sem travar a thread principal */}
        <Script
          id="gtm-script"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MN9SVGWR');`,
          }}
        />

        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MN9SVGWR"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <SiteSettingsProvider>
          <PublicShell>
            {children}
          </PublicShell>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
