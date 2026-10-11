import { describe, expect, it, vi } from 'vitest';
import { readAdConfig } from '@/ads/config';
import { dayKey, defaultAdState, normalizeAdState, pickCreative, recordImpression, shouldShowAd } from '@/ads/policy';
import { DEMO_AD, loadCreatives } from '@/ads/provider';
import { parseCreatives, safeHttpsUrl } from '@/ads/validate';
import type { AdConfig, AdCreative } from '@/ads/types';

const NOW = new Date(2026, 9, 11, 12, 0, 0).getTime();
const config = (over: Partial<AdConfig> = {}): AdConfig => ({ ...readAdConfig({ VITE_ADS_ENABLED: 'true' }), ...over });

describe('readAdConfig', () => {
  it('ist ohne Variablen aus', () => {
    const c = readAdConfig({});
    expect(c.enabled).toBe(false);
    expect(c.feedUrl).toBeNull();
    expect(c.demo).toBe(false);
  });

  it('akzeptiert nur https für Feed und Iframe-Ursprünge', () => {
    const c = readAdConfig({
      VITE_ADS_ENABLED: 'true',
      VITE_ADS_FEED_URL: 'http://ads.example.com/feed.json',
      VITE_ADS_FRAME_ORIGINS: 'https://a.example.com, http://b.example.com ,https://c.example.com',
    });
    expect(c.enabled).toBe(true);
    expect(c.feedUrl).toBeNull();
    expect(c.frameOrigins).toEqual(['https://a.example.com', 'https://c.example.com']);
  });
});

describe('parseCreatives', () => {
  const good = { id: 'a1', sponsor: 'Firma', title: 'Titel', text: 'Text', href: 'https://example.com/x' };

  it('übernimmt gültige native Anzeigen und setzt Standard-Beschriftung', () => {
    const [ad] = parseCreatives([good], []);
    expect(ad).toMatchObject({ kind: 'native', id: 'a1', cta: 'Mehr erfahren', href: 'https://example.com/x' });
  });

  it('akzeptiert { ads: [...] }', () => {
    expect(parseCreatives({ ads: [good] }, [])).toHaveLength(1);
  });

  it.each([
    ['http-Ziel', { ...good, href: 'http://example.com' }],
    ['javascript-Ziel', { ...good, href: 'javascript:alert(1)' }],
    ['Zugangsdaten in der URL', { ...good, href: 'https://user:pw@example.com' }],
    ['Bild per http', { ...good, imageUrl: 'http://example.com/a.png' }],
    ['fehlender Titel', { ...good, title: '' }],
    ['zu langer Text', { ...good, text: 'x'.repeat(161) }],
    ['keine ID', { ...good, id: undefined }],
  ])('verwirft: %s', (_name, entry) => {
    expect(parseCreatives([entry], [])).toEqual([]);
  });

  it('verwirft doppelte IDs und begrenzt die Anzahl', () => {
    expect(parseCreatives([good, good], [])).toHaveLength(1);
    const many = Array.from({ length: 50 }, (_, i) => ({ ...good, id: `id${i}` }));
    expect(parseCreatives(many, [])).toHaveLength(20);
  });

  it('lässt Iframe-Anzeigen nur von erlaubten Ursprüngen und mit sinnvoller Höhe zu', () => {
    const frame = { kind: 'frame', id: 'f', sponsor: 'S', src: 'https://ads.example.com/slot', height: 120 };
    expect(parseCreatives([frame], ['https://ads.example.com'])).toHaveLength(1);
    expect(parseCreatives([frame], [])).toEqual([]);
    expect(parseCreatives([{ ...frame, src: 'https://evil.example.org/x' }], ['https://ads.example.com'])).toEqual([]);
    expect(parseCreatives([{ ...frame, height: 900 }], ['https://ads.example.com'])).toEqual([]);
  });

  it('liefert bei Unsinn eine leere Liste', () => {
    expect(parseCreatives(null, [])).toEqual([]);
    expect(parseCreatives('x', [])).toEqual([]);
    expect(parseCreatives({ ads: 3 }, [])).toEqual([]);
  });

  it('safeHttpsUrl', () => {
    expect(safeHttpsUrl('https://example.com')).toBe('https://example.com/');
    expect(safeHttpsUrl('ftp://example.com')).toBeNull();
    expect(safeHttpsUrl(5)).toBeNull();
  });
});

describe('Anzeigeregeln', () => {
  const state = defaultAdState(NOW);

  it('zeigt nichts, wenn Werbung im Build aus ist oder der Benutzer sie abgeschaltet hat', () => {
    expect(shouldShowAd({ config: config({ enabled: false }), state, placement: 'home', isPlaying: false, now: NOW })).toBe(false);
    expect(shouldShowAd({ config: config(), state: { ...state, enabled: false }, placement: 'home', isPlaying: false, now: NOW })).toBe(false);
  });

  it('zeigt nie Werbung während der Wiedergabe', () => {
    expect(shouldShowAd({ config: config(), state, placement: 'finished', isPlaying: true, now: NOW })).toBe(false);
    expect(shouldShowAd({ config: config(), state, placement: 'finished', isPlaying: false, now: NOW })).toBe(true);
  });

  it('beachtet Tageslimit und Mindestabstand', () => {
    const c = config();
    let s = state;
    for (let i = 0; i < c.limits.finished.maxPerDay; i++) {
      expect(shouldShowAd({ config: c, state: s, placement: 'finished', isPlaying: false, now: NOW + i * 3_600_000 })).toBe(true);
      s = recordImpression(s, 'finished', NOW + i * 3_600_000);
    }
    expect(shouldShowAd({ config: c, state: s, placement: 'finished', isPlaying: false, now: NOW + 10 * 3_600_000 })).toBe(false);

    const once = recordImpression(state, 'finished', NOW);
    expect(shouldShowAd({ config: c, state: once, placement: 'finished', isPlaying: false, now: NOW + 60_000 })).toBe(false);
    expect(shouldShowAd({ config: c, state: once, placement: 'finished', isPlaying: false, now: NOW + c.limits.finished.minIntervalMs })).toBe(true);
    // Platzierungen zählen getrennt
    expect(shouldShowAd({ config: c, state: once, placement: 'home', isPlaying: false, now: NOW + 1 })).toBe(true);
  });

  it('Zähler beginnen am nächsten Tag neu; Schalter bleibt erhalten', () => {
    const used = { ...recordImpression(defaultAdState(NOW), 'finished', NOW), enabled: false };
    const next = normalizeAdState(used, NOW + 24 * 3_600_000);
    expect(next.counts).toEqual({});
    expect(next.enabled).toBe(false);
    expect(next.day).toBe(dayKey(NOW + 24 * 3_600_000));
  });

  it('übersteht beschädigte Speicherdaten', () => {
    expect(normalizeAdState(null, NOW)).toEqual(defaultAdState(NOW));
    expect(normalizeAdState({ enabled: 'ja', counts: { home: 'x' }, last: { home: NaN } }, NOW)).toEqual(defaultAdState(NOW));
  });

  it('wechselt reihum zwischen Anzeigen', () => {
    const list: AdCreative[] = [DEMO_AD, { ...DEMO_AD, id: 'zwei' }];
    expect(pickCreative([], defaultAdState(NOW))).toBeNull();
    const first = pickCreative(list, defaultAdState(NOW));
    const second = pickCreative(list, recordImpression(defaultAdState(NOW), 'home', NOW));
    expect(first?.id).toBe('demo');
    expect(second?.id).toBe('zwei');
  });
});

describe('loadCreatives', () => {
  const feed = { ads: [{ id: 'f1', sponsor: 'S', title: 'T', text: 'X', href: 'https://example.com' }] };
  const respond = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });

  it('liefert ohne Feed und ohne Demo nichts', async () => {
    expect(await loadCreatives(config(), respond(feed))).toEqual([]);
  });

  it('liefert die Beispielanzeige nur im Demo-Modus', async () => {
    expect(await loadCreatives(config({ demo: true }), respond(feed))).toEqual([DEMO_AD]);
  });

  it('lädt und prüft den Feed ohne Cookies und ohne Referrer', async () => {
    const fetchMock = respond(feed);
    const ads = await loadCreatives(config({ feedUrl: 'https://ads.example.com/feed.json' }), fetchMock);
    expect(ads.map((a) => a.id)).toEqual(['f1']);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it.each([
    ['Serverfehler', respond(feed, false)],
    ['ungültiges JSON', respond('{kaputt')],
    ['zu große Antwort', respond('x'.repeat(70_000))],
    ['Netzwerkfehler', vi.fn().mockRejectedValue(new Error('offline'))],
  ])('bleibt bei %s still', async (_name, fetchMock) => {
    expect(await loadCreatives(config({ feedUrl: 'https://ads.example.com/feed.json' }), fetchMock)).toEqual([]);
  });
});
