import { useCallback, useSyncExternalStore } from 'react';
import { readStoredValue, updateStoredValue } from '@/utils/storage';
import { normalizeAdState, defaultAdState } from './policy';
import type { AdState } from './types';

const KEY = 'rsvp_ads';

/**
 * Kleiner Store für den Werbezustand (Schalter + Einblendungszähler). Er liegt außerhalb des
 * Reader-Zustands, damit Werbung die Lese-Logik nicht berührt und sich komplett entfernen lässt.
 */
let snapshot: { loaded: boolean; state: AdState } = { loaded: false, state: defaultAdState(Date.now()) };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: AdState, loaded = true): void {
  snapshot = { loaded, state: next };
  listeners.forEach((listener) => listener());
}

function ensureLoaded(): void {
  if (loading || snapshot.loaded) return;
  loading = readStoredValue(KEY).then((raw) => {
    publish(normalizeAdState(raw, Date.now()));
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** Ändert den Zustand (Speicher und Anzeige bleiben konsistent). */
export async function updateAdState(update: (state: AdState) => AdState): Promise<AdState> {
  let result = snapshot.state;
  await updateStoredValue(KEY, (raw) => {
    result = update(normalizeAdState(raw, Date.now()));
    return result;
  });
  publish(result);
  return result;
}

/** Aktueller, aus dem Speicher geladener Zustand (wartet auf das erste Laden). */
export async function readAdState(): Promise<AdState> {
  const raw = await readStoredValue(KEY);
  const state = normalizeAdState(raw, Date.now());
  publish(state);
  return state;
}

/** „Werbung anzeigen“: Zustand und Schalter für die Oberfläche. */
export function useAdsEnabled(): { loaded: boolean; enabled: boolean; setEnabled: (value: boolean) => void } {
  const { loaded, state } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setEnabled = useCallback((value: boolean) => {
    void updateAdState((current) => ({ ...current, enabled: value }));
  }, []);
  return { loaded, enabled: state.enabled, setEnabled };
}

/** Nur für Tests. */
export function resetAdStoreForTests(): void {
  snapshot = { loaded: false, state: defaultAdState(Date.now()) };
  loading = null;
  listeners.clear();
}
