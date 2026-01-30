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

  return {
    // State
    currentWord: state.words[state.currentIndex] || '',
    currentIndex: state.currentIndex,
    totalWords: state.words.length,
    isPlaying: state.isPlaying,
    wpm: state.wpm,
    progress: state.progress,
    
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
  };
}
