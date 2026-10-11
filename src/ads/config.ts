import type { AdConfig } from './types';

const HOUR = 60 * 60 * 1000;

/** Liest die Werbe-Konfiguration aus Build-Variablen (`VITE_ADS_*`). Ohne Variablen ist Werbung aus. */
export function readAdConfig(env: Record<string, unknown>): AdConfig {
  const text = (key: string): string => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');
  const feedUrl = text('VITE_ADS_FEED_URL');
  return {
    enabled: text('VITE_ADS_ENABLED') === 'true',
    feedUrl: feedUrl.startsWith('https://') ? feedUrl : null,
    frameOrigins: text('VITE_ADS_FRAME_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.startsWith('https://')),
    demo: text('VITE_ADS_DEMO') === 'true',
    feedTimeoutMs: 4000,
    limits: {
      // Startseite: der Benutzer wählt gerade eine Datei – kein Lesefluss, den man stören könnte.
      home: { maxPerDay: 20, minIntervalMs: 0 },
      // Nach dem Lesen: höchstens drei Einblendungen am Tag, mit Abstand.
      finished: { maxPerDay: 3, minIntervalMs: HOUR / 6 },
    },
  };
}

export const AD_CONFIG: AdConfig = readAdConfig(import.meta.env as Record<string, unknown>);
