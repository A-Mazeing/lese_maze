import { useCallback, useMemo } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';

/** Schrittweite der Geschwindigkeitsänderung per Tastatur/Button. */
const WPM_STEP = 50;

/**
 * Hook für die RSVP-Steuerung.
 *
 * Die Wiedergabe selbst (Takt, Ramp-up, Ende) läuft in der `PlaybackEngine`, die
 * der `ReaderProvider` genau einmal startet. Dieser Hook ist reine Lese-/Steuer-
 * Schnittstelle und kann beliebig oft verwendet werden, ohne zusätzliche Timer zu
 * erzeugen. Alle Aktionen lesen den *aktuellen* Store-Zustand, nicht den des letzten
 * Renders – dadurch sind sie auch in veralteten Closures (Event-Handler, Timer)
 * korrekt.
 */
export function useRSVP() {
  const { state, store, dispatch } = useReader();

  const play = useCallback(() => dispatch({ type: 'PLAY' }), [dispatch]);
  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), [dispatch]);
  const toggle = useCallback(() => dispatch({ type: 'TOGGLE_PLAY' }), [dispatch]);

  const skipForward = useCallback(
    (count = 5) => dispatch({ type: 'SKIP_FORWARD', payload: count }),
    [dispatch],
  );
  const skipBackward = useCallback(
    (count = 5) => dispatch({ type: 'SKIP_BACKWARD', payload: count }),
    [dispatch],
  );

  const goToStart = useCallback(() => {
    dispatch({ type: 'SET_INDEX', payload: store.getState().startIndex });
  }, [dispatch, store]);

  const goToEnd = useCallback(() => {
    dispatch({ type: 'SET_INDEX', payload: getEffectiveEnd(store.getState()) });
  }, [dispatch, store]);

  const setIndex = useCallback((index: number) => dispatch({ type: 'SET_INDEX', payload: index }), [dispatch]);
  const setWpm = useCallback((wpm: number) => dispatch({ type: 'SET_WPM', payload: wpm }), [dispatch]);

  const increaseWpm = useCallback(
    (amount = WPM_STEP) => dispatch({ type: 'SET_WPM', payload: store.getState().wpm + amount }),
    [dispatch, store],
  );
  const decreaseWpm = useCallback(
    (amount = WPM_STEP) => dispatch({ type: 'SET_WPM', payload: store.getState().wpm - amount }),
    [dispatch, store],
  );

  const goToPrevSentence = useCallback(() => dispatch({ type: 'GOTO_PREV_SENTENCE' }), [dispatch]);
  const goToNextSentence = useCallback(() => dispatch({ type: 'GOTO_NEXT_SENTENCE' }), [dispatch]);
  const goToPrevParagraph = useCallback(() => dispatch({ type: 'GOTO_PREV_PARAGRAPH' }), [dispatch]);
  const goToNextParagraph = useCallback(() => dispatch({ type: 'GOTO_NEXT_PARAGRAPH' }), [dispatch]);
  const setWordsPerChunk = useCallback(
    (count: number) => dispatch({ type: 'SET_WORDS_PER_CHUNK', payload: count }),
    [dispatch],
  );

  const range = useMemo(() => {
    const end = getEffectiveEnd(state);
    return {
      totalWordsInRange: Math.max(0, end - state.startIndex + 1),
      positionInRange: Math.max(0, state.currentIndex - state.startIndex + 1),
    };
  }, [state]);

  return {
    // Zustand
    currentWord: state.words[state.currentIndex] ?? '',
    currentIndex: state.currentIndex,
    totalWords: state.words.length,
    isPlaying: state.isPlaying,
    isFinished: state.isFinished,
    wpm: state.wpm,
    progress: state.progress,
    wordsPerChunk: state.wordsPerChunk,

    // Lesebereich
    startIndex: state.startIndex,
    endIndex: state.endIndex,
    totalWordsInRange: range.totalWordsInRange,
    positionInRange: range.positionInRange,

    // Aktionen
    play,
    pause,
    toggle,
    skipForward,
    skipBackward,
    goToStart,
    goToEnd,
    setIndex,
    setWpm,
    increaseWpm,
    decreaseWpm,
    goToPrevSentence,
    goToNextSentence,
    goToPrevParagraph,
    goToNextParagraph,
    setWordsPerChunk,
  };
}
