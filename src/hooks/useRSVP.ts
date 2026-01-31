import { useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';

/**
 * Hook für RSVP-Steuerung.
 * 
 * Bietet Zugriff auf den aktuellen State und Control-Funktionen.
 * 
 * WICHTIG: Die Timer-Logik wurde in den ReaderContext verschoben,
 * um das Problem zu vermeiden, dass mehrere Hook-Instanzen jeweils
 * eigene Timer starten und dadurch Wörter übersprungen werden.
 */
export function useRSVP() {
  const { state, dispatch } = useReader();

  const play = useCallback(() => {
    dispatch({ type: 'PLAY' });
  }, [dispatch]);

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE' });
  }, [dispatch]);

  const toggle = useCallback(() => {
    dispatch({ type: 'TOGGLE_PLAY' });
  }, [dispatch]);

  const skipForward = useCallback((count = 5) => {
    dispatch({ type: 'SKIP_FORWARD', payload: count });
  }, [dispatch]);

  const skipBackward = useCallback((count = 5) => {
    dispatch({ type: 'SKIP_BACKWARD', payload: count });
  }, [dispatch]);

  const goToStart = useCallback(() => {
    dispatch({ type: 'SET_INDEX', payload: state.startIndex });
  }, [dispatch, state.startIndex]);

  const goToEnd = useCallback(() => {
    const endIndex = state.endIndex ?? state.words.length - 1;
    dispatch({ type: 'SET_INDEX', payload: endIndex });
  }, [dispatch, state.endIndex, state.words.length]);

  const setIndex = useCallback((index: number) => {
    dispatch({ type: 'SET_INDEX', payload: index });
  }, [dispatch]);

  const setWpm = useCallback((wpm: number) => {
    dispatch({ type: 'SET_WPM', payload: wpm });
  }, [dispatch]);

  const increaseWpm = useCallback((amount = 50) => {
    dispatch({ type: 'SET_WPM', payload: state.wpm + amount });
  }, [dispatch, state.wpm]);

  const decreaseWpm = useCallback((amount = 50) => {
    dispatch({ type: 'SET_WPM', payload: state.wpm - amount });
  }, [dispatch, state.wpm]);

  const goToPrevSentence = useCallback(() => {
    dispatch({ type: 'GOTO_PREV_SENTENCE' });
  }, [dispatch]);

  const goToNextSentence = useCallback(() => {
    dispatch({ type: 'GOTO_NEXT_SENTENCE' });
  }, [dispatch]);

  const goToPrevParagraph = useCallback(() => {
    dispatch({ type: 'GOTO_PREV_PARAGRAPH' });
  }, [dispatch]);

  const goToNextParagraph = useCallback(() => {
    dispatch({ type: 'GOTO_NEXT_PARAGRAPH' });
  }, [dispatch]);

  const setWordsPerChunk = useCallback((count: number) => {
    dispatch({ type: 'SET_WORDS_PER_CHUNK', payload: count });
  }, [dispatch]);

  return {
    // State
    currentWord: state.words[state.currentIndex] || '',
    currentIndex: state.currentIndex,
    totalWords: state.words.length,
    isPlaying: state.isPlaying,
    wpm: state.wpm,
    progress: state.progress,
    wordsPerChunk: state.wordsPerChunk,
    
    // Lesebereich
    startIndex: state.startIndex,
    endIndex: state.endIndex,
    // Berechne die effektive Anzahl der Wörter im Lesebereich
    totalWordsInRange: (state.endIndex ?? state.words.length - 1) - state.startIndex + 1,
    // Position innerhalb des Lesebereichs (1-basiert)
    positionInRange: state.currentIndex - state.startIndex + 1,
    
    // Actions
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
