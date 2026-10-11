import { useCallback, useSyncExternalStore } from 'react';
import { readStoredValue, writeStoredValue } from '@/utils/storage';

const KEY = 'rsvp_support';

/** Einstellung „Buchtipps anzeigen“ (Standard: an). Liegt außerhalb des Reader-Zustands. */
let snapshot = { loaded: false, showTips: true };
let loading = false;
const listeners = new Set<() => void>();

function publish(next: { loaded: boolean; showTips: boolean }): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function ensureLoaded(): void {
  if (loading || snapshot.loaded) return;
  loading = true;
  void readStoredValue(KEY).then((raw) => {
    const showTips = typeof raw === 'object' && raw !== null && (raw as { showTips?: unknown }).showTips === false ? false : true;
    publish({ loaded: true, showTips });
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensureLoaded();
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

export function useShowBookTips(): { loaded: boolean; showTips: boolean; setShowTips: (value: boolean) => void } {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setShowTips = useCallback((value: boolean) => {
    publish({ loaded: true, showTips: value });
    void writeStoredValue(KEY, { showTips: value });
  }, []);
  return { ...state, setShowTips };
}

/** Nur für Tests. */
export function resetSupportStoreForTests(): void {
  snapshot = { loaded: false, showTips: true };
  loading = false;
  listeners.clear();
}
