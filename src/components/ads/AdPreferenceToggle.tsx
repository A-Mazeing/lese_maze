import { AD_CONFIG } from '@/ads/config';
import { useAdsEnabled } from '@/ads/adStore';

/** Schalter „Werbung anzeigen“ (nur sichtbar, wenn der Build Werbung enthält). */
export function AdPreferenceToggle() {
  const { loaded, enabled, setEnabled } = useAdsEnabled();
  if (!AD_CONFIG.enabled || !loaded) return null;
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      Werbung anzeigen (unterstützt die Entwicklung)
    </label>
  );
}
