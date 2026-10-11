import { AD_PLACEMENTS, type AdConfig, type AdCreative, type AdPlacement, type AdState } from './types';

/** Kalendertag in lokaler Zeit (YYYY-MM-DD). */
export function dayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function defaultAdState(now: number): AdState {
  return { enabled: true, day: dayKey(now), counts: {}, last: {} };
}

/** Bereinigt gespeicherte Daten; Tageszähler beginnen jeden Tag neu. */
export function normalizeAdState(raw: unknown, now: number): AdState {
  const fresh = defaultAdState(now);
  if (typeof raw !== 'object' || raw === null) return fresh;
  const r = raw as Record<string, unknown>;
  const state: AdState = {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    day: typeof r.day === 'string' ? r.day : fresh.day,
    counts: {},
    last: {},
  };
  for (const placement of AD_PLACEMENTS) {
    const count = (r.counts as Record<string, unknown> | undefined)?.[placement];
    const last = (r.last as Record<string, unknown> | undefined)?.[placement];
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) state.counts[placement] = Math.floor(count);
    if (typeof last === 'number' && Number.isFinite(last)) state.last[placement] = last;
  }
  if (state.day !== fresh.day) {
    state.day = fresh.day;
    state.counts = {};
  }
  return state;
}

export interface ShowContext {
  config: AdConfig;
  state: AdState;
  placement: AdPlacement;
  /** Während der Wiedergabe wird nie Werbung gezeigt. */
  isPlaying: boolean;
  now: number;
}

/** Darf an dieser Stelle jetzt eine Anzeige erscheinen? */
export function shouldShowAd({ config, state, placement, isPlaying, now }: ShowContext): boolean {
  if (!config.enabled || !state.enabled || isPlaying) return false;
  const limit = config.limits[placement];
  if ((state.counts[placement] ?? 0) >= limit.maxPerDay) return false;
  const last = state.last[placement];
  return last === undefined || now - last >= limit.minIntervalMs || now < last;
}

export function recordImpression(state: AdState, placement: AdPlacement, now: number): AdState {
  return {
    ...state,
    counts: { ...state.counts, [placement]: (state.counts[placement] ?? 0) + 1 },
    last: { ...state.last, [placement]: now },
  };
}

/** Wählt reihum eine Anzeige (anhand der bisherigen Einblendungen), damit nicht immer dieselbe erscheint. */
export function pickCreative(creatives: readonly AdCreative[], state: AdState): AdCreative | null {
  if (creatives.length === 0) return null;
  const total = AD_PLACEMENTS.reduce((sum, placement) => sum + (state.counts[placement] ?? 0), 0);
  return creatives[total % creatives.length];
}
