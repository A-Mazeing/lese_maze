import { useEffect, useRef, useState } from 'react';
import { useReaderDispatch, useReaderSelector, useReaderStore } from '@/contexts/ReaderContext';
import { getProgress, saveProgress } from '@/utils/storage';
import type { BookProgress } from '@/types';

/** Entprellzeit: Der Fortschritt wird frühestens so lange nach der letzten Änderung gespeichert. */
const SAVE_DEBOUNCE_MS = 1500;
/** Während der Wiedergabe wird spätestens in diesem Abstand gespeichert. */
const SAVE_MAX_WAIT_MS = 10_000;

export interface RestoredProgress {
  index: number;
  lastRead: number;
}

/**
 * Stellt die Leseposition eines Dokuments wieder her und speichert sie fortlaufend.
 *
 * - Die Dokument-ID stammt aus den Metadaten (Titel + Typ + Inhalts-Fingerabdruck); dasselbe
 *   Buch wird auch nach erneutem Laden der Datei erkannt.
 * - Gespeichert wird erst, NACHDEM die gespeicherte Position gelesen wurde. Andernfalls würde
 *   der Startwert 0 den alten Fortschritt überschreiben.
 * - Der Hook liest den Store direkt und rendert nicht bei jedem Wort neu.
 */
export function useProgress({ enabled = true }: { enabled?: boolean } = {}) {
  const store = useReaderStore();
  const dispatch = useReaderDispatch();
  const documentId = useReaderSelector((s) => s.metadata.documentId ?? null);
  const [restoredEntry, setRestoredEntry] = useState<(RestoredProgress & { documentId: string }) | null>(null);
  const readyRef = useRef(false);

  // Position wiederherstellen, sobald ein Dokument geladen ist.
  useEffect(() => {
    readyRef.current = false;
    if (!enabled || !documentId) return;

    let cancelled = false;
    void getProgress(documentId)
      .then((saved) => {
        if (cancelled) return;
        const state = store.getState();
        if (
          saved &&
          state.metadata.documentId === documentId &&
          saved.currentIndex > 0 &&
          saved.currentIndex < state.words.length
        ) {
          dispatch({ type: 'SET_INDEX', payload: saved.currentIndex });
          setRestoredEntry({ documentId, index: saved.currentIndex, lastRead: saved.lastRead });
        }
      })
      .catch((error) => console.warn('[progress] Fortschritt konnte nicht gelesen werden:', error))
      .finally(() => {
        if (!cancelled) readyRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, enabled, store, dispatch]);

  // Fortschritt speichern.
  useEffect(() => {
    if (!enabled || !documentId) return;

    let lastSavedIndex = -1;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let maxWait: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (debounce !== null) clearTimeout(debounce);
      if (maxWait !== null) clearTimeout(maxWait);
      debounce = null;
      maxWait = null;
    };

    const save = () => {
      clearTimers();
      if (!readyRef.current) return;
      const state = store.getState();
      if (state.metadata.documentId !== documentId || state.words.length === 0) return;
      if (state.currentIndex === lastSavedIndex) return;
      lastSavedIndex = state.currentIndex;

      const progress: BookProgress = {
        id: documentId,
        title: state.metadata.title ?? 'Unbenannt',
        type: state.metadata.sourceType ?? 'page',
        currentIndex: state.currentIndex,
        totalWords: state.words.length,
        lastRead: Date.now(),
        wpm: state.wpm,
      };
      void saveProgress(progress).catch((error) =>
        console.warn('[progress] Fortschritt konnte nicht gespeichert werden:', error),
      );
    };

    let previousIndex = store.getState().currentIndex;
    let previousPlaying = store.getState().isPlaying;
    const unsubscribe = store.subscribe(() => {
      const { currentIndex, isPlaying } = store.getState();
      const paused = previousPlaying && !isPlaying;
      const moved = currentIndex !== previousIndex;
      previousIndex = currentIndex;
      previousPlaying = isPlaying;

      if (paused) {
        save(); // Pause/Ende: sofort sichern
        return;
      }
      if (!moved) return;
      if (debounce !== null) clearTimeout(debounce);
      debounce = setTimeout(save, SAVE_DEBOUNCE_MS);
      if (maxWait === null) maxWait = setTimeout(save, SAVE_MAX_WAIT_MS);
    });

    // Tab wird verdeckt/geschlossen: asynchrone Schreibzugriffe starten, solange die Seite noch lebt.
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      save(); // z. B. beim Wechsel des Dokuments
      clearTimers();
    };
  }, [documentId, enabled, store]);

  // Nur Treffer für das aktuell geladene Dokument gelten (kein Zurücksetzen per Effekt nötig).
  const restored: RestoredProgress | null =
    enabled && restoredEntry && restoredEntry.documentId === documentId ? restoredEntry : null;
  return { restored };
}
