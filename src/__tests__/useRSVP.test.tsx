/**
 * Tests für useRSVP Hook
 * 
 * Testet die folgenden Features:
 * - goToStart respektiert startIndex (Phase 1.4 Fix)
 * - goToEnd respektiert endIndex (Phase 1.4 Fix)
 * - Playback-Kontrollen
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReaderProvider, useReader } from '@/contexts/ReaderContext';
import { useRSVP } from '@/hooks/useRSVP';
import type { ReactNode } from 'react';

// Wrapper für Tests
function wrapper({ children }: { children: ReactNode }) {
  return <ReaderProvider>{children}</ReaderProvider>;
}

describe('useRSVP Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('goToStart (Phase 1.4 Fix)', () => {
    it('should go to startIndex instead of 0 when reading range is set', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 50 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // Reading Range setzen (Start bei 10)
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: 10, endIndex: 40 },
        });
      });

      // Zu einem anderen Index navigieren
      act(() => {
        result.current.reader.dispatch({ type: 'SET_INDEX', payload: 25 });
      });

      expect(result.current.rsvp.currentIndex).toBe(25);

      // goToStart sollte zu startIndex (10) gehen, NICHT zu 0
      act(() => {
        result.current.rsvp.goToStart();
      });

      expect(result.current.rsvp.currentIndex).toBe(10);
      expect(result.current.reader.state.currentIndex).toBe(10);
    });

    it('should go to 0 when no reading range is set', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 50 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // Zu einem anderen Index navigieren
      act(() => {
        result.current.reader.dispatch({ type: 'SET_INDEX', payload: 25 });
      });

      // goToStart sollte zu 0 gehen (kein startIndex gesetzt)
      act(() => {
        result.current.rsvp.goToStart();
      });

      expect(result.current.rsvp.currentIndex).toBe(0);
    });
  });

  describe('goToEnd (Phase 1.4 Fix)', () => {
    it('should go to endIndex instead of last word when reading range is set', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen mit 50 Wörtern
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 50 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // Reading Range setzen (Ende bei 40)
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: 10, endIndex: 40 },
        });
      });

      // goToEnd sollte zu endIndex (40) gehen, NICHT zu 49
      act(() => {
        result.current.rsvp.goToEnd();
      });

      expect(result.current.rsvp.currentIndex).toBe(40);
      expect(result.current.reader.state.currentIndex).toBe(40);
    });

    it('should go to last word when no endIndex is set', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen mit 50 Wörtern
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 50 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // goToEnd sollte zum letzten Wort (49) gehen
      act(() => {
        result.current.rsvp.goToEnd();
      });

      expect(result.current.rsvp.currentIndex).toBe(49);
    });

    it('should go to last word when endIndex is null', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 30 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // Nur startIndex setzen, endIndex bleibt null
      act(() => {
        result.current.reader.dispatch({ type: 'SET_START_INDEX', payload: 5 });
      });

      expect(result.current.reader.state.endIndex).toBeNull();

      // goToEnd sollte zum letzten Wort gehen
      act(() => {
        result.current.rsvp.goToEnd();
      });

      expect(result.current.rsvp.currentIndex).toBe(29);
    });
  });

  describe('Play/Pause Controls', () => {
    it('should toggle play state', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      // Content setzen
      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Test', 'Words'],
            originalContent: 'Test Words',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      expect(result.current.rsvp.isPlaying).toBe(false);

      act(() => {
        result.current.rsvp.play();
      });

      expect(result.current.rsvp.isPlaying).toBe(true);

      act(() => {
        result.current.rsvp.pause();
      });

      expect(result.current.rsvp.isPlaying).toBe(false);
    });

    it('should toggle correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Test', 'Words', 'Here'],
            originalContent: 'Test Words Here',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      // Toggle ON
      act(() => {
        result.current.rsvp.toggle();
      });
      expect(result.current.rsvp.isPlaying).toBe(true);

      // Toggle OFF
      act(() => {
        result.current.rsvp.toggle();
      });
      expect(result.current.rsvp.isPlaying).toBe(false);
    });
  });

  describe('Skip Controls', () => {
    it('should skip forward correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 20 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      act(() => {
        result.current.rsvp.skipForward(5);
      });

      expect(result.current.rsvp.currentIndex).toBe(5);

      act(() => {
        result.current.rsvp.skipForward(3);
      });

      expect(result.current.rsvp.currentIndex).toBe(8);
    });

    it('should skip backward correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 20 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
        result.current.reader.dispatch({ type: 'SET_INDEX', payload: 10 });
      });

      act(() => {
        result.current.rsvp.skipBackward(3);
      });

      expect(result.current.rsvp.currentIndex).toBe(7);
    });
  });

  describe('WPM Controls', () => {
    it('should set WPM correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      expect(result.current.rsvp.wpm).toBe(300);

      act(() => {
        result.current.rsvp.setWpm(500);
      });

      expect(result.current.rsvp.wpm).toBe(500);
    });

    it('should increase WPM correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.rsvp.increaseWpm(100);
      });

      expect(result.current.rsvp.wpm).toBe(400);
    });

    it('should decrease WPM correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.rsvp.decreaseWpm(100);
      });

      expect(result.current.rsvp.wpm).toBe(200);
    });
  });

  describe('Current Word', () => {
    it('should return current word correctly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Hello', 'World', 'Test'],
            originalContent: 'Hello World Test',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      expect(result.current.rsvp.currentWord).toBe('Hello');

      act(() => {
        result.current.reader.dispatch({ type: 'SET_INDEX', payload: 1 });
      });

      expect(result.current.rsvp.currentWord).toBe('World');
    });

    it('should return empty string when no words', () => {
      const { result } = renderHook(
        () => {
          const rsvp = useRSVP();
          return { rsvp };
        },
        { wrapper }
      );

      expect(result.current.rsvp.currentWord).toBe('');
    });
  });

  describe('setIndex', () => {
    it('should set index directly', () => {
      const { result } = renderHook(
        () => {
          const reader = useReader();
          const rsvp = useRSVP();
          return { reader, rsvp };
        },
        { wrapper }
      );

      act(() => {
        result.current.reader.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 20 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });

      act(() => {
        result.current.rsvp.setIndex(15);
      });

      expect(result.current.rsvp.currentIndex).toBe(15);
    });
  });
});
