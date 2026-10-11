import type { AdCreative } from './types';

const MAX_CREATIVES = 20;

function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

/** Nur https-URLs ohne Zugangsdaten. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function parseOne(raw: unknown, frameOrigins: readonly string[]): AdCreative | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 64);
  const sponsor = str(r.sponsor, 40);
  if (!id || !sponsor) return null;

  if (r.kind === 'frame') {
    const src = safeHttpsUrl(r.src);
    const height = typeof r.height === 'number' && Number.isFinite(r.height) ? Math.round(r.height) : 0;
    if (!src || height < 50 || height > 300) return null;
    if (!frameOrigins.includes(new URL(src).origin)) return null;
    return { kind: 'frame', id, sponsor, src, height };
  }

  const title = str(r.title, 60);
  const text = str(r.text, 160);
  const href = safeHttpsUrl(r.href);
  if (!title || !text || !href) return null;
  const imageUrl = r.imageUrl === undefined ? undefined : safeHttpsUrl(r.imageUrl);
  if (imageUrl === null) return null;
  return { kind: 'native', id, sponsor, title, text, cta: str(r.cta, 24) ?? '', href, imageUrl };
}

/**
 * Prüft Anzeigen aus einem Feed streng: ungültige Einträge werden verworfen, nie repariert.
 * Akzeptiert ein Array oder `{ "ads": [...] }`.
 */
export function parseCreatives(raw: unknown, frameOrigins: readonly string[]): AdCreative[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { ads?: unknown }).ads)
      ? (raw as { ads: unknown[] }).ads
      : [];
  const result: AdCreative[] = [];
  const seen = new Set<string>();
  for (const entry of list.slice(0, MAX_CREATIVES)) {
    const ad = parseOne(entry, frameOrigins);
    if (ad && !seen.has(ad.id)) {
      seen.add(ad.id);
      result.push(ad);
    }
  }
  return result;
}
