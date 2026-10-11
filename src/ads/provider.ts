import type { AdConfig, AdCreative } from './types';
import { parseCreatives } from './validate';

/** Klar gekennzeichnete Beispielanzeige für Entwicklung und Tests (nur mit `VITE_ADS_DEMO=true`). */
export const DEMO_AD: AdCreative = {
  kind: 'native',
  id: 'demo',
  sponsor: 'Example Inc.',
  title: 'Example ad',
  text: 'This is what an ad looks like. It never appears while you are reading.',
  cta: 'Learn more',
  href: 'https://example.com/',
};

const MAX_FEED_BYTES = 64 * 1024;

/**
 * Holt die Anzeigen: Beispielanzeige (nur Demo) und/oder Feed.
 * Ein Feed enthält ausschließlich Daten (JSON), keinen Code – das ist nach Manifest V3 erlaubt.
 * Fehler führen nie zu einem Fehlerzustand: dann gibt es einfach keine Anzeige.
 */
export async function loadCreatives(config: AdConfig, fetchImpl: typeof fetch = fetch): Promise<AdCreative[]> {
  const creatives: AdCreative[] = config.demo ? [DEMO_AD] : [];
  if (!config.feedUrl) return creatives;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.feedTimeoutMs);
  try {
    const response = await fetchImpl(config.feedUrl, {
      signal: controller.signal,
      credentials: 'omit', // keine Cookies
      referrerPolicy: 'no-referrer',
      cache: 'no-cache',
    });
    if (!response.ok) return creatives;
    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) return creatives;
    creatives.push(...parseCreatives(JSON.parse(text) as unknown, config.frameOrigins));
  } catch {
    /* offline, Zeitüberschreitung oder ungültiges JSON: keine Feed-Anzeigen */
  } finally {
    clearTimeout(timer);
  }
  return creatives;
}
