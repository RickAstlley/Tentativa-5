'use client';

/**
 * components/ui/AdSenseBanner.tsx
 *
 * Banner de publicidade.
 *
 * A conta AdSense estava configurada no metadata, o script era carregado no
 * layout e o `ads.txt` existia — mas este componente não era montado em lugar
 * nenhum. A monetization nunca aconteceu.
 *
 * Três decisões que importam:
 *
 *   1. **Consentimento.** O script não é carregado antes de o visitante
 *      aceitar. O carregamento e a injeção ficam em `lib/adsense.ts`.
 *   2. **Sem salto de layout (CLS).** O espaço é reservado antes de o anúncio
 *      existir, e o container nunca some se o bloqueador impedir o anúncio.
 *   3. **Sem clique acidental.** O banner não fica sobreposto a nada, tem
 *      rótulo "Publicidade" e um respiro largo ao redor — o que a política do
 *      AdSense exige para não parecer navegação.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { hasAdsConsent, loadAdSenseScript, onConsentChange } from '@/lib/adsense';
import { cn } from '@/lib/utils';

interface AdSenseBannerProps {
  /** Slot cadastrado no painel do AdSense. Sem ele o banner fica inerte. */
  slotId?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  /** Altura reservada, para não haver salto quando o anúncio entra. */
  minHeight?: number;
  className?: string;
  label?: boolean;
  /** Identifica a posição na página; ajuda a auditar sem inspecionar o DOM. */
  slotName?: string;
}

export default function AdSenseBanner({
  slotId,
  format = 'auto',
  minHeight = 100,
  className,
  label = true,
  slotName,
}: AdSenseBannerProps) {
  // O id precisa ser único: vários banners na mesma página geravam
  // `id="adsense-banner-container"` repetido, o que é HTML inválido.
  const reactId = useId();
  const containerId = `adsense-${reactId.replace(/:/g, '')}`;

  const insRef = useRef<HTMLElement>(null);
  const pushedRef = useRef(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const ready = hasAdsConsent();
    setConsentGiven(ready);
    // Quem já aceitou em visita anterior carrega sem esperar o banner.
    if (ready) void loadAdSenseScript();
  }, []);

  useEffect(() => {
    return onConsentChange((accepted) => {
      setConsentGiven(accepted);
      if (accepted) void loadAdSenseScript();
    });
  }, []);

  useEffect(() => {
    if (!consentGiven || pushedRef.current || attempted) return;
    setAttempted(true);

    loadAdSenseScript()
      .then(() => {
        if (pushedRef.current) return;
        // O push é idempotente por guarda: Strict Mode monta o efeito duas
        // vezes, e um push duplo faria o Google cobrar por dois anúncios.
        pushedRef.current = true;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
          pushedRef.current = false;
          console.debug('[AdSense] bloqueador de anúncios ativo:', error);
        }
      })
      .catch(() => {
        // Sem script, o espaço reservado continua lá. É o comportamento certo.
      });
  }, [consentGiven, attempted]);

  // Sem slot cadastrado, não há o que exibir — e um banner vazio só ocupa
  // espaço e derruba a confiança na página.
  if (!slotId) return null;

  return (
    <aside
      id={containerId}
      data-adsense-slot={slotName || 'unlabeled'}
      aria-label="Publicidade"
      className={cn('my-8 w-full', className)}
    >
      {label && (
        <span className="mb-1 block text-center text-[10px] font-bold uppercase tracking-widest text-ink/30 dark:text-white/30">
          Publicidade
        </span>
      )}
      <div
        style={{ minHeight }}
        className={cn(
          'flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-bg-surface/40 p-2',
          'dark:bg-dark-surface/40'
        )}
      >
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client="ca-pub-7432900526570149"
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
