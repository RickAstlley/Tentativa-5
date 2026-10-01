'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

const DEFAULT_ARTICLE_FALLBACK = 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1200&q=80';

// Ultra-compact SVG Blur placeholder (cinza neutro elegante para evitar CLS)
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDMiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjMiIGZpbGw9IiNmM2Y0ZjYiLz48L3N2Zz4=';

// Variantes de dimensão e sizes responsivos - Single Source of Truth
export const IMAGE_VARIANTS = {
  // Hero sections - full width, high priority
  hero: {
    width: 1200,
    height: 600,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, (max-width: 1440px) 1200px, 1200px',
  },
  // Hero mobile - taller aspect
  heroMobile: {
    width: 640,
    height: 480,
    sizes: '(max-width: 640px) 100vw, 640px',
  },
  // Article cover images
  article: {
    width: 800,
    height: 450,
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 800px, 800px',
  },
  // Bike cards in grids - 16:9 aspect
  card: {
    width: 480,
    height: 270,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 480px',
  },
  // Compact cards - 16:9 aspect
  compact: {
    width: 320,
    height: 180,
    sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1440px) 25vw, 320px',
  },
  // Thumbnail/small - square
  thumb: {
    width: 120,
    height: 120,
    sizes: '(max-width: 640px) 100vw, 120px',
  },
  // Avatar/profile - circle
  avatar: {
    width: 48,
    height: 48,
    sizes: '48px',
  },
  // Bento grid cards - variable width but fixed height
  bento: {
    width: 245,
    height: 184,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 245px',
  },
  // Full width section backgrounds
  background: {
    width: 1920,
    height: 1080,
    sizes: '100vw',
  },
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

export interface SafeImageProps extends Omit<ImageProps, 'src' | 'width' | 'height' | 'sizes'> {
  src: string | undefined | null;
  fallbackSrc?: string;
  variant?: ImageVariant;
  fadeIn?: boolean;
  // Allow override for special cases
  width?: number;
  height?: number;
  sizes?: string;
}

export function cleanImageUrl(input: string | undefined | null, fallback: string = DEFAULT_ARTICLE_FALLBACK): string {
  if (!input || typeof input !== 'string') return fallback;
  let clean = input.trim();
  if (
    !clean || 
    clean === 'undefined' || 
    clean === 'null' || 
    clean === '[]' || 
    clean === '{}' ||
    clean === '""' ||
    clean === "''"
  ) {
    return fallback;
  }

  // Remove aspas envolventes se houver
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }

  // Protocolo relativo //
  if (clean.startsWith('//')) {
    clean = `https:${clean}`;
  }

  // Mapeia /images/uploads/ para /api/media/ para resolução resiliente em qualquer servidor
  if (clean.startsWith('/images/uploads/')) {
    clean = clean.replace('/images/uploads/', '/api/media/');
  }

  // Se não começa com http, https, data: ou /, mas parece um domínio
  if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:') && !clean.startsWith('/')) {
    if (clean.includes('.') && !clean.includes(' ')) {
      clean = `https://${clean}`;
    } else {
      return fallback;
    }
  }

  return clean;
}

export default function SafeImage({
  src,
  alt,
  fallbackSrc = DEFAULT_ARTICLE_FALLBACK,
  variant = 'card',
  unoptimized,
  referrerPolicy = 'no-referrer',
  priority = false,
  className = '',
  fadeIn = true,
  width: overrideWidth,
  height: overrideHeight,
  sizes: overrideSizes,
  ...props
}: SafeImageProps) {
  const sanitizeSrc = useCallback((input: string | undefined | null) => {
    return cleanImageUrl(input, fallbackSrc);
  }, [fallbackSrc]);

  const [imgSrc, setImgSrc] = useState<string>(() => sanitizeSrc(src));
  const [hasError, setHasError] = useState<boolean>(false);
  const [useNativeImg, setUseNativeImg] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Resolve dimensions from variant or override
  const { width, height, sizes } = useMemo(() => {
    const variantConfig = IMAGE_VARIANTS[variant];
    return {
      width: overrideWidth ?? variantConfig.width,
      height: overrideHeight ?? variantConfig.height,
      sizes: overrideSizes ?? variantConfig.sizes,
    };
  }, [variant, overrideWidth, overrideHeight, overrideSizes]);

  useEffect(() => {
    const valid = sanitizeSrc(src);
    setImgSrc(valid);
    setHasError(false);
    setUseNativeImg(false);
    setIsLoaded(false);
  }, [src, sanitizeSrc]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    } else if (!useNativeImg) {
      setUseNativeImg(true);
    }
  };

  const finalSrc = hasError ? fallbackSrc : imgSrc;
  const isDataUri = typeof finalSrc === 'string' && (finalSrc.startsWith('data:') || finalSrc.endsWith('.svg'));
  const shouldBeUnoptimized = unoptimized !== undefined ? unoptimized : (isDataUri ? true : undefined);
  const safePriority = isDataUri ? false : priority;

  const isFill = Boolean((props as Record<string, unknown>).fill);

  const animationClasses = fadeIn 
    ? `transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}` 
    : 'opacity-100';

  if (useNativeImg) {
    /* eslint-disable @next/next/no-img-element */
    return (
      <img
        src={fallbackSrc}
        alt={alt || 'Imagem TuaVia'}
        referrerPolicy={referrerPolicy}
        width={isFill ? undefined : width}
        height={isFill ? undefined : height}
        className={cn('object-cover w-full h-full', animationClasses, className)}
        loading={safePriority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        suppressHydrationWarning
      />
    );
  }

  return (
    <Image
      {...props}
      src={finalSrc}
      alt={alt || 'Imagem TuaVia'}
      width={isFill ? undefined : width}
      height={isFill ? undefined : height}
      sizes={sizes}
      priority={safePriority}
      unoptimized={shouldBeUnoptimized}
      referrerPolicy={referrerPolicy}
      placeholder="blur"
      blurDataURL={BLUR_PLACEHOLDER}
      className={cn(animationClasses, className)}
      onLoad={() => setIsLoaded(true)}
      onError={handleError}
      suppressHydrationWarning
    />
  );
}
