import { useEffect, useState } from 'react';
import { useReaderSelector } from '@/contexts/ReaderContext';
import { readAdState, updateAdState, useAdsEnabled } from './adStore';
import { AD_CONFIG } from './config';
import { pickCreative, recordImpression, shouldShowAd } from './policy';
import { loadCreatives } from './provider';
import type { AdCreative, AdPlacement } from './types';

/**
 * Entscheidet, ob an einer Stelle eine Anzeige erscheint, und liefert sie.
 * Regeln (siehe policy.ts): Hauptschalter, Benutzerschalter, Tageslimit, Mindestabstand –
 * und nie während der Wiedergabe. Eine Einblendung wird erst gezählt, wenn sie wirklich erscheint.
 */
export function useAd(placement: AdPlacement): AdCreative | null {
  const isPlaying = useReaderSelector((s) => s.isPlaying);
  const { loaded, enabled } = useAdsEnabled();
  const [ad, setAd] = useState<AdCreative | null>(null);

  useEffect(() => {
    if (!AD_CONFIG.enabled || !loaded || !enabled) return;
    let cancelled = false;
    void (async () => {
      const state = await readAdState();
      const now = Date.now();
      if (!shouldShowAd({ config: AD_CONFIG, state, placement, isPlaying: false, now })) return;
      const creative = pickCreative(await loadCreatives(AD_CONFIG), state);
      if (cancelled || !creative) return;
      await updateAdState((current) => recordImpression(current, placement, now));
      if (!cancelled) setAd(creative);
    })();
    return () => {
      cancelled = true;
    };
  }, [placement, loaded, enabled]);

  // Ausblenden: abgeleitet, damit Schalter und Wiedergabe sofort wirken.
  return enabled && !isPlaying ? ad : null;
}
