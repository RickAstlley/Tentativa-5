import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'standalone' } : {}),
  reactStrictMode: true,
  serverExternalPackages: [
    'firebase-admin',
  ],
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
        os: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Image configuration with remotePatterns for optimized image delivery
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 95],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mlstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.olx.com.br',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'twodogs.com',
      },
      {
        protocol: 'https',
        hostname: 'www.lgimportados.com',
      },
    ],
  },
  async headers() {
    // Content-Security-Policy.
    //
    // Lista mínima que o site realmente usa: nenhum CDN de terceiro, conexões de
    // analytics e de IA restritas aos domínios conhecidos. `unsafe-inline` fica
    // só onde é exigido (estilos do Tailwind e o bootloader do Next).
    const isDev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com https://fundingchoicesinfo.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      // O AdSense serve os criativos de vários domínios de CDN; `https:` cobre
      // os announced, e o `data:` cobre o fallback quando o bloqueador bloqueia.
      "img-src 'self' data: blob: https:",
      // Sem os domínios de anúncio em connect-src, o script carrega mas nenhuma
      // requisição de Criativo sai: o slot fica permanentemente vazio.
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://integrate.api.nvidia.com https://googleads.g.com https://pagead2.googlesyndication.com https://csi.gstatic.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google",
      "frame-src 'self' https://www.googletagmanager.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isDev ? [] : ["frame-ancestors 'self'"]),
      ...(!isDev ? ['upgrade-insecure-requests'] : []),
    ]
      .join('; ');

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      ...(isDev ? [] : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Content-Security-Policy', value: csp },
      ...(isDev
        ? []
        : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
    ];

    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/bikes',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/articles',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
      {
        source: '/api/rankings',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
      // CORS só onde é necessário. A regra anterior valia para `/:path*` e
      // permitia `x-admin-token` no preflight: qualquer site podia tentar
      // chamar as rotas de admin a partir da origem do usuário.
      {
        source: '/api/media/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/comparador',
        destination: '/comparar',
        permanent: false,
      },
      {
        source: '/comparacao',
        destination: '/comparar',
        permanent: false,
      },
      {
        source: '/e-bike',
        destination: '/ebike',
        permanent: false,
      },
      {
        source: '/e-bikes',
        destination: '/ebike',
        permanent: false,
      },
      {
        source: '/catalogo',
        destination: '/ebike',
        permanent: false,
      },
      {
        source: '/autopropelidos',
        destination: '/artigos/legislacao-bicicletas-eletricas-contran#autopropelidos',
        permanent: false,
      },
      {
        source: '/pedal-assistido',
        destination: '/artigos/legislacao-bicicletas-eletricas-contran#pedal-assistido',
        permanent: false,
      },
      {
        source: '/ciclomotores',
        destination: '/artigos/legislacao-bicicletas-eletricas-contran#ciclomotores',
        permanent: false,
      },
      {
        source: '/artigo/:slug',
        destination: '/artigos/:slug',
        permanent: false,
      },
      {
        source: '/e-bike/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/e-bikes/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/bikes/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/ebike/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/ebikes/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/produto/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
      {
        source: '/produtos/:slug',
        destination: '/bike/:slug',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/images/uploads/:filename',
        destination: '/api/media/:filename',
      },
    ];
  },
};

export default nextConfig;
