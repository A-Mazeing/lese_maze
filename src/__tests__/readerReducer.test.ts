import { describe, it, expect } from 'vitest';
import {
  calculateProgress,
  findFirstAfter,
  findLastAtOrBefore,
  getEffectiveEnd,
  initialReaderState,
  readerReducer,
  type ReaderAction,
} from '@/contexts/readerReducer';
import type { ReaderState } from '@/types';

const words = Array.from({ length: 20 }, (_, i) => `w${i}`);

function run(state: ReaderState, ...actions: ReaderAction[]): ReaderState {
  return actions.reduce(readerReducer, state);
}

function withContent(extra: Partial<ReaderState> = {}): ReaderState {
  return {
    ...run(initialReaderState, {
      type: 'SET_CONTENT',
      payload: {
        words,
        originalContent: words.join(' '),
        title: 'T',
        sourceType: 'page',
        sentenceBreaks: [0, 5, 10, 15],
        paragraphBreaks: [0, 10],
      },
    }),
    rampUpEnabled: false,
    ...extra,
  };
}

describe('helpers', () => {
  it('findLastAtOrBefore / findFirstAfter', () => {
    const list = [0, 5, 10];
    expect(findLastAtOrBefore(list, -1)).toBe(-1);
    expect(findLastAtOrBefore(list, 0)).toBe(0);
    expect(findLastAtOrBefore(list, 7)).toBe(1);
    expect(findLastAtOrBefore(list, 99)).toBe(2);
    expect(findFirstAfter(list, -1)).toBe(0);
    expect(findFirstAfter(list, 5)).toBe(2);
    expect(findFirstAfter(list, 10)).toBe(-1);
  });

  it('calculateProgress clamps and handles empty ranges', () => {
    expect(calculateProgress(5, 0, 10)).toBe(50);
    expect(calculateProgress(0, 3, 3)).toBe(0);
    expect(calculateProgress(50, 0, 10)).toBe(100);
    expect(calculateProgress(-5, 0, 10)).toBe(0);
  });

  it('getEffectiveEnd respects endIndex and the word count', () => {
    expect(getEffectiveEnd({ words: ['a', 'b', 'c'], endIndex: null })).toBe(2);
    expect(getEffectiveEnd({ words: ['a', 'b', 'c'], endIndex: 1 })).toBe(1);
    expect(getEffectiveEnd({ words: ['a', 'b', 'c'], endIndex: 99 })).toBe(2);
    expect(getEffectiveEnd({ words: [], endIndex: null })).toBe(-1);
  });
});

describe('readerReducer', () => {
  it('SET_INDEX clamps to the word range and ignores NaN', () => {
    const state = withContent();
    expect(run(state, { type: 'SET_INDEX', payload: 999 }).currentIndex).toBe(19);
    expect(run(state, { type: 'SET_INDEX', payload: -4 }).currentIndex).toBe(0);
    expect(run(state, { type: 'SET_INDEX', payload: 7 }, { type: 'SET_INDEX', payload: NaN }).currentIndex).toBe(7);
  });

  it('is a no-op (same reference) when nothing changes', () => {
    const state = withContent();
    expect(readerReducer(state, { type: 'SET_INDEX', payload: 0 })).toBe(state);
    expect(readerReducer(state, { type: 'PAUSE' })).toBe(state);
    expect(readerReducer(state, { type: 'ADVANCE', payload: 1 })).toBe(state);
  });

  it('PLAY does nothing without words', () => {
    expect(run(initialReaderState, { type: 'PLAY' }).isPlaying).toBe(false);
  });

  it('ADVANCE moves by the chunk size and finishes after the last chunk', () => {
    let state = run(withContent(), { type: 'PLAY' });
    state = run(state, { type: 'ADVANCE', payload: 3 });
    expect(state.currentIndex).toBe(3);

    state = run(state, { type: 'SET_INDEX', payload: 17 });
    state = run(state, { type: 'ADVANCE', payload: 2 }); // 19 ist noch gültig
    expect(state.currentIndex).toBe(19);
    expect(state.isPlaying).toBe(true);

    state = run(state, { type: 'ADVANCE', payload: 1 });
    expect(state).toMatchObject({ isPlaying: false, isFinished: true, currentIndex: 19, progress: 100 });
  });

  it('PLAY after finishing restarts from the start of the range', () => {
    let state = withContent({ startIndex: 4 });
    state = run(state, { type: 'SET_INDEX', payload: 19 }, { type: 'PLAY' });
    expect(state.isPlaying).toBe(true);
    expect(state.currentIndex).toBe(4);
  });

  it('PAUSE rewinds to the sentence start when rewindOnPause is on', () => {
    let state = run(withContent(), { type: 'SET_INDEX', payload: 8 }, { type: 'PLAY' });
    state = run(state, { type: 'PAUSE' });
    expect(state.isPlaying).toBe(false);
    expect(state.currentIndex).toBe(5);
  });

  it('PAUSE keeps the position when rewindOnPause is off', () => {
    let state = run(withContent(), { type: 'SET_REWIND_ON_PAUSE', payload: false });
    state = run(state, { type: 'SET_INDEX', payload: 8 }, { type: 'PLAY' }, { type: 'PAUSE' });
    expect(state.currentIndex).toBe(8);
  });

  it('PAUSE never rewinds before startIndex', () => {
    let state = run(withContent(), { type: 'SET_READING_RANGE', payload: { startIndex: 7, endIndex: null } });
    state = run(state, { type: 'SET_INDEX', payload: 9 }, { type: 'PLAY' }, { type: 'PAUSE' });
    expect(state.currentIndex).toBeGreaterThanOrEqual(7);
  });

  it('respects the reading range at both ends', () => {
    let state = run(withContent(), { type: 'SET_READING_RANGE', payload: { startIndex: 5, endIndex: 8 } });
    expect(state.currentIndex).toBe(5);
    state = run(state, { type: 'SKIP_FORWARD', payload: 50 });
    expect(state.currentIndex).toBe(8);
    state = run(state, { type: 'SKIP_BACKWARD', payload: 50 });
    expect(state.currentIndex).toBe(5);
  });

  it('SET_END_INDEX / SET_START_INDEX keep the range consistent', () => {
    let state = withContent();
    state = run(state, { type: 'SET_INDEX', payload: 15 }, { type: 'SET_END_INDEX', payload: 10 });
    expect(state.currentIndex).toBe(10);
    state = run(state, { type: 'SET_START_INDEX', payload: 12 });
    expect(state.startIndex).toBe(12);
    expect(state.endIndex).toBeGreaterThanOrEqual(12);
  });

  it('ramp-up is armed on PLAY and consumed per chunk', () => {
    let state = withContent({ rampUpEnabled: true, rampUpDuration: 3 });
    state = run(state, { type: 'PLAY' });
    expect(state.rampUpWordsRemaining).toBe(3);
    state = run(state, { type: 'ADVANCE', payload: 1 });
    expect(state.rampUpWordsRemaining).toBe(2);
  });

  it('settings are clamped', () => {
    const state = run(
      initialReaderState,
      { type: 'SET_WPM', payload: 99999 },
      { type: 'SET_WORDS_PER_CHUNK', payload: 17 },
    );
    expect(state.wpm).toBe(1500);
    expect(state.wordsPerChunk).toBe(4);
    expect(run(state, { type: 'SET_WPM', payload: 1 }).wpm).toBe(50);
    expect(run(state, { type: 'SET_WPM', payload: NaN }).wpm).toBe(1500);
  });

  it('sentence / paragraph navigation', () => {
    let state = run(withContent(), { type: 'SET_INDEX', payload: 7 });
    expect(run(state, { type: 'GOTO_NEXT_SENTENCE' }).currentIndex).toBe(10);
    expect(run(state, { type: 'GOTO_PREV_SENTENCE' }).currentIndex).toBe(5);
    expect(run(state, { type: 'GOTO_NEXT_PARAGRAPH' }).currentIndex).toBe(10);
    expect(run(state, { type: 'GOTO_PREV_PARAGRAPH' }).currentIndex).toBe(0);
    state = run(state, { type: 'SET_INDEX', payload: 19 });
    expect(run(state, { type: 'GOTO_NEXT_SENTENCE' }).currentIndex).toBe(19);
  });

  it('SET_CONTENT resets playback state; CLEAR_CONTENT keeps the settings', () => {
    let state = run(withContent(), { type: 'SET_WPM', payload: 700 }, { type: 'PLAY' });
    state = run(state, {
      type: 'SET_CONTENT',
      payload: { words: ['a'], originalContent: 'a', title: 'x', sourceType: 'pdf' },
    });
    expect(state).toMatchObject({ isPlaying: false, currentIndex: 0, startIndex: 0, endIndex: null, wpm: 700 });
    state = run(state, { type: 'CLEAR_CONTENT' });
    expect(state.words).toEqual([]);
    expect(state.wpm).toBe(700);
    expect(state.metadata.title).toBeNull();
  });

  it('SET_PREVIEW_MODE(true) stops playback', () => {
    const state = run(withContent(), { type: 'PLAY' }, { type: 'SET_PREVIEW_MODE', payload: true });
    expect(state.isPlaying).toBe(false);
  });
});
