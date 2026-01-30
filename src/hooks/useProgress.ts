import { useEffect, useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { saveProgress, getProgress, generateDocumentId } from '@/utils/storage';
import type { BookProgress } from '@/types';

interface UseProgressOptions {
  title: string;
  type: 'pdf' | 'epub' | 'page';
  autoSave?: boolean;
  autoSaveInterval?: number;
}

/**
 * Hook für Lesefortschritt-Persistenz.
 */
export function useProgress({
  title,
  type,
  autoSave = true,
  autoSaveInterval = 5000,
}: UseProgressOptions) {
  const { state, dispatch } = useReader();
  const documentId = generateDocumentId(title, type);

  // Lade gespeicherten Fortschritt beim Start
  const loadSavedProgress = useCallback(async () => {
    const saved = await getProgress(documentId);
    if (saved && state.words.length > 0) {
      // Nur laden wenn Index noch gültig ist
      if (saved.currentIndex < state.words.length) {
        dispatch({ type: 'SET_INDEX', payload: saved.currentIndex });
        dispatch({ type: 'SET_WPM', payload: saved.wpm });
      }
    }
  }, [documentId, state.words.length, dispatch]);

  // Speichere aktuellen Fortschritt
  const save = useCallback(async () => {
    if (state.words.length === 0) return;

    const progress: BookProgress = {
      id: documentId,
      title,
      type,
      currentIndex: state.currentIndex,
      totalWords: state.words.length,
      lastRead: Date.now(),
      wpm: state.wpm,
    };

    await saveProgress(progress);
  }, [documentId, title, type, state.currentIndex, state.words.length, state.wpm]);

  // Auto-Save bei Änderungen
  useEffect(() => {
    if (!autoSave || state.words.length === 0) return;

    const timer = setTimeout(save, autoSaveInterval);
    return () => clearTimeout(timer);
  }, [autoSave, autoSaveInterval, save, state.currentIndex, state.words.length]);

  // Speichere beim Verlassen der Seite
  useEffect(() => {
    if (!autoSave) return;

    const handleBeforeUnload = () => {
      save();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSave, save]);

  return {
    loadSavedProgress,
    save,
    documentId,
  };
}
