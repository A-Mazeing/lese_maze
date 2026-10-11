import { useAd } from '@/ads/useAd';
import { useT } from '@/i18n';
import { useAdsEnabled } from '@/ads/adStore';
import type { AdPlacement } from '@/ads/types';

interface AdSlotProps {
  placement: AdPlacement;
  className?: string;
}

/**
 * Anzeigeplatz. Ohne Anzeige (Werbung aus, Limit erreicht, Wiedergabe läuft) rendert er nichts
 * und belegt keinen Platz. Anzeigen sind als solche gekennzeichnet und lassen sich mit einem
 * Klick abschalten (Chrome-Web-Store-Richtlinie: „easily removable“).
 */
export function AdSlot({ placement, className = '' }: AdSlotProps) {
  const t = useT();
  const ad = useAd(placement);
  const { setEnabled } = useAdsEnabled();
  if (!ad) return null;

  return (
    <aside
      aria-label={t('ads.aria')}
      data-testid={`ad-${placement}`}
      className={`w-full max-w-xl rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <span>{t('ads.label', { sponsor: ad.sponsor })}</span>
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className="normal-case tracking-normal underline hover:no-underline"
        >
          {t('ads.hide')}
        </button>
      </div>

      {ad.kind === 'native' ? (
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored nofollow"
          className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-b-lg transition-colors"
        >
          {ad.imageUrl && (
            <img
              src={ad.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
              className="w-16 h-16 rounded object-cover flex-shrink-0"
            />
          )}
          <span className="min-w-0">
            <span className="block font-medium text-gray-900 dark:text-gray-100">{ad.title}</span>
            <span className="block text-gray-600 dark:text-gray-400">{ad.text}</span>
            <span className="block mt-1 text-blue-600 dark:text-blue-400">{ad.cta || t('ads.learnMore')} →</span>
          </span>
        </a>
      ) : (
        <iframe
          title={t('ads.frameTitle', { sponsor: ad.sponsor })}
          src={ad.src}
          // Ohne allow-same-origin: Der Inhalt hat keinen Zugriff auf die Erweiterung.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="block w-full border-0 rounded-b-lg"
          style={{ height: ad.height }}
        />
      )}
    </aside>
  );
}
