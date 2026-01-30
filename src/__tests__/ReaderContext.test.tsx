/**
 * Tests für ReaderContext
 * 
 * Testet die folgenden Features:
 * - CLEAR_CONTENT Action (Phase 1.2)
 * - Basis-Reducer-Funktionalität
 * - Reading Range Management
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReaderProvider, useReader } from '@/contexts/ReaderContext';
import type { ReactNode } from 'react';

// Wrapper für Tests
function wrapper({ children }: { children: ReactNode }) {
  return <ReaderProvider>{children}</ReaderProvider>;
}

describe('ReaderContext', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      expect(result.current.state.words).toEqual([]);
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.wpm).toBe(300);
      expect(result.current.state.previewMode).toBe(true);
      expect(result.current.state.startIndex).toBe(0);
      expect(result.current.state.endIndex).toBeNull();
    });
  });

  describe('SET_CONTENT Action', () => {
    it('should set content with all metadata', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Hello', 'World', 'Test'],
            originalContent: 'Hello World Test',
            title: 'Test Document',
            sourceType: 'page',
          },
        });
      });
      
      expect(result.current.state.words).toEqual(['Hello', 'World', 'Test']);
      expect(result.current.state.metadata.title).toBe('Test Document');
      expect(result.current.state.metadata.sourceType).toBe('page');
      expect(result.current.state.originalContent).toBe('Hello World Test');
    });
  });

  describe('CLEAR_CONTENT Action (Phase 1.2 Fix)', () => {
    it('should clear all content and reset to initial state', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      // Zuerst Content setzen
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Hello', 'World', 'Test', 'Content'],
            originalContent: 'Hello World Test Content',
            title: 'Test Document',
            sourceType: 'pdf',
          },
        });
      });
      
      // WPM ändern
      act(() => {
        result.current.dispatch({ type: 'SET_WPM', payload: 500 });
      });
      
      // Überprüfen dass Content gesetzt wurde
      expect(result.current.state.words.length).toBe(4);
      expect(result.current.state.metadata.title).toBe('Test Document');
      
      // CLEAR_CONTENT ausführen
      act(() => {
        result.current.dispatch({ type: 'CLEAR_CONTENT' });
      });
      
      // Überprüfen dass alles zurückgesetzt wurde
      expect(result.current.state.words).toEqual([]);
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.previewMode).toBe(true);
      expect(result.current.state.startIndex).toBe(0);
      expect(result.current.state.endIndex).toBeNull();
      expect(result.current.state.originalContent).toBeNull();
      expect(result.current.state.metadata.title).toBeNull();
      expect(result.current.state.metadata.sourceType).toBeNull();
      
      // WPM sollte ERHALTEN bleiben
      expect(result.current.state.wpm).toBe(500);
    });

    it('should preserve WPM setting after CLEAR_CONTENT', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      // WPM ändern
      act(() => {
        result.current.dispatch({ type: 'SET_WPM', payload: 750 });
      });
      
      // Content setzen
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Test'],
            originalContent: 'Test',
            title: 'Doc',
            sourceType: 'epub',
          },
        });
      });
      
      // Clear
      act(() => {
        result.current.dispatch({ type: 'CLEAR_CONTENT' });
      });
      
      // WPM sollte erhalten sein
      expect(result.current.state.wpm).toBe(750);
    });
  });

  describe('RESET Action (should NOT clear words)', () => {
    it('should reset playback state but keep words', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      // Content setzen
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['Hello', 'World', 'Test'],
            originalContent: 'Hello World Test',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      // Playback starten und vorspulen (nicht ans Ende!)
      act(() => {
        result.current.dispatch({ type: 'PLAY' });
        result.current.dispatch({ type: 'SET_INDEX', payload: 1 }); // Mitte, nicht Ende
      });
      
      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.currentIndex).toBe(1);
      
      // RESET ausführen
      act(() => {
        result.current.dispatch({ type: 'RESET' });
      });
      
      // Words sollten NICHT gelöscht werden
      expect(result.current.state.words).toEqual(['Hello', 'World', 'Test']);
      // Aber Playback sollte gestoppt und Index zurückgesetzt sein
      expect(result.current.state.isPlaying).toBe(false);
      expect(result.current.state.currentIndex).toBe(0);
      expect(result.current.state.previewMode).toBe(true);
    });
  });

  describe('Reading Range (Start/End Index)', () => {
    it('should set start index correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      // Content mit 10 Wörtern setzen
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 10 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      // Start Index setzen
      act(() => {
        result.current.dispatch({ type: 'SET_START_INDEX', payload: 3 });
      });
      
      expect(result.current.state.startIndex).toBe(3);
      expect(result.current.state.currentIndex).toBe(3); // Current sollte mindestens startIndex sein
    });

    it('should set end index correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 10 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      act(() => {
        result.current.dispatch({ type: 'SET_END_INDEX', payload: 7 });
      });
      
      expect(result.current.state.endIndex).toBe(7);
    });

    it('should set reading range correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
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
        result.current.dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: 5, endIndex: 15 },
        });
      });
      
      expect(result.current.state.startIndex).toBe(5);
      expect(result.current.state.endIndex).toBe(15);
      expect(result.current.state.currentIndex).toBe(5); // Springt zum Start
    });
  });

  describe('Playback Controls', () => {
    it('should play and pause correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['One', 'Two', 'Three', 'Four', 'Five'], // Mehr Wörter, um nicht am Ende zu sein
            originalContent: 'One Two Three Four Five',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      act(() => {
        result.current.dispatch({ type: 'PLAY' });
      });
      
      expect(result.current.state.isPlaying).toBe(true);
      expect(result.current.state.previewMode).toBe(false);
      
      act(() => {
        result.current.dispatch({ type: 'PAUSE' });
      });
      
      expect(result.current.state.isPlaying).toBe(false);
    });

    it('should toggle play correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['One', 'Two', 'Three', 'Four', 'Five'], // Mehr Wörter, um nicht am Ende zu sein
            originalContent: 'One Two Three Four Five',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      // Toggle ON
      act(() => {
        result.current.dispatch({ type: 'TOGGLE_PLAY' });
      });
      expect(result.current.state.isPlaying).toBe(true);
      
      // Toggle OFF
      act(() => {
        result.current.dispatch({ type: 'TOGGLE_PLAY' });
      });
      expect(result.current.state.isPlaying).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should navigate with NEXT_WORD and PREV_WORD', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: ['One', 'Two', 'Three', 'Four', 'Five'],
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
      });
      
      act(() => {
        result.current.dispatch({ type: 'NEXT_WORD' });
      });
      expect(result.current.state.currentIndex).toBe(1);
      
      act(() => {
        result.current.dispatch({ type: 'NEXT_WORD' });
        result.current.dispatch({ type: 'NEXT_WORD' });
      });
      expect(result.current.state.currentIndex).toBe(3);
      
      act(() => {
        result.current.dispatch({ type: 'PREV_WORD' });
      });
      expect(result.current.state.currentIndex).toBe(2);
    });

    it('should skip forward and backward correctly', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
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
        result.current.dispatch({ type: 'SKIP_FORWARD', payload: 5 });
      });
      expect(result.current.state.currentIndex).toBe(5);
      
      act(() => {
        result.current.dispatch({ type: 'SKIP_BACKWARD', payload: 3 });
      });
      expect(result.current.state.currentIndex).toBe(2);
    });

    it('should respect start/end boundaries when navigating', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 20 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
        result.current.dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: 5, endIndex: 15 },
        });
      });
      
      // Versuche vor Start zu gehen
      act(() => {
        result.current.dispatch({ type: 'SKIP_BACKWARD', payload: 10 });
      });
      expect(result.current.state.currentIndex).toBe(5); // Bleibt bei startIndex
      
      // Zum Ende gehen
      act(() => {
        result.current.dispatch({ type: 'SKIP_FORWARD', payload: 20 });
      });
      expect(result.current.state.currentIndex).toBe(15); // Bleibt bei endIndex
    });
  });

  describe('WPM Settings', () => {
    it('should set WPM within valid range', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({ type: 'SET_WPM', payload: 600 });
      });
      expect(result.current.state.wpm).toBe(600);
    });

    it('should clamp WPM to minimum 50', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({ type: 'SET_WPM', payload: 20 });
      });
      expect(result.current.state.wpm).toBe(50);
    });

    it('should clamp WPM to maximum 1500', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({ type: 'SET_WPM', payload: 2000 });
      });
      expect(result.current.state.wpm).toBe(1500);
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress correctly within reading range', () => {
      const { result } = renderHook(() => useReader(), { wrapper });
      
      act(() => {
        result.current.dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: Array.from({ length: 100 }, (_, i) => `Word${i}`),
            originalContent: '',
            title: 'Test',
            sourceType: 'page',
          },
        });
        result.current.dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: 0, endIndex: 99 },
        });
      });
      
      // Am Anfang sollte progress 0 sein
      expect(result.current.state.progress).toBe(0);
      
      // Zur Mitte gehen
      act(() => {
        result.current.dispatch({ type: 'SET_INDEX', payload: 50 });
      });
      expect(result.current.state.progress).toBeCloseTo(50.5, 0);
      
      // Zum Ende gehen
      act(() => {
        result.current.dispatch({ type: 'SET_INDEX', payload: 99 });
      });
      expect(result.current.state.progress).toBe(100);
    });
  });
});
