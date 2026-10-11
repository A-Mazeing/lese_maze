import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_CATCH_UP_MS, PlaybackEngine, getChunkDuration, type Clock } from '@/engine/playbackEngine';
import { createReaderStore, type ReaderStore } from '@/engine/readerStore';
import { initialReaderState } from '@/contexts/readerReducer';

/** Deterministische Uhr: Timer feuern erst, wenn die Zeit per `advance` vorgerückt wird. */
class FakeClock implements Clock {
  time = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback: () => void }>();

  now() {
    return this.time;
  }
  setTimeout(callback: () => void, delay: number) {
    const id = this.nextId++;
    this.timers.set(id, { at: this.time + delay, callback });
    return id;
  }
  clearTimeout(handle: unknown) {
    this.timers.delete(handle as number);
  }
  get pending() {
    return this.timers.size;
  }

  /** Rückt die Zeit vor; `lateBy` simuliert verspätete Timer (gedrosselter Tab). */
  advance(ms: number, lateBy = 0) {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!due || due[1].at > target) break;
      this.timers.delete(due[0]);
      this.time = due[1].at + lateBy;
      lateBy = 0;
      due[1].callback();
    }
    this.time = Math.max(this.time, target);
  }
}

const words = Array.from({ length: 12 }, (_, i) => `wort${i}`);

function setup(overrides: Partial<typeof initialReaderState> = {}) {
  const clock = new FakeClock();
  const store: ReaderStore = createReaderStore({
    ...initialReaderState,
    words,
    wpm: 600, // 100 ms pro Wort
    rampUpEnabled: false,
    ...overrides,
  });
  const engine = new PlaybackEngine(store, clock);
  engine.start();
  return { clock, store, engine };
}

describe('getChunkDuration', () => {
  const base = {
    words: ['kurz', 'kurz'],
    currentIndex: 0,
    wordsPerChunk: 1,
    wpm: 600,
    endIndex: null,
    rampUpDuration: 5,
    rampUpWordsRemaining: 0,
  };

  it('returns 60000/wpm for short words', () => {
    expect(getChunkDuration(base)).toBe(100);
  });

  it('sums the words of a multi-word chunk and stops at the range end', () => {
    expect(getChunkDuration({ ...base, wordsPerChunk: 2 })).toBe(200);
    expect(getChunkDuration({ ...base, wordsPerChunk: 4 })).toBe(200);
  });

  it('doubles the duration at the start of the ramp-up and eases back to normal', () => {
    expect(getChunkDuration({ ...base, rampUpWordsRemaining: 5 })).toBe(200);
    expect(getChunkDuration({ ...base, rampUpWordsRemaining: 1 })).toBeLessThan(200);
    expect(getChunkDuration({ ...base, rampUpWordsRemaining: 1 })).toBeGreaterThan(100);
  });
});

describe('PlaybackEngine', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('does not schedule anything while paused', () => {
    expect(ctx.engine.isScheduled).toBe(false);
    expect(ctx.clock.pending).toBe(0);
  });

  it('advances one word per interval', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    expect(ctx.engine.isScheduled).toBe(true);
    ctx.clock.advance(100);
    expect(ctx.store.getState().currentIndex).toBe(1);
    ctx.clock.advance(300);
    expect(ctx.store.getState().currentIndex).toBe(4);
  });

  it('does not drift when ticks fire late (but within the catch-up window)', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    for (let i = 0; i < 10; i++) ctx.clock.advance(100, 20);
    // 10 Intervalle à 100 ms → Index 10, trotz jeweils 20 ms Verspätung.
    expect(ctx.store.getState().currentIndex).toBe(10);
  });

  it('re-anchors instead of fast-forwarding after a long stall', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    ctx.clock.advance(100, MAX_CATCH_UP_MS + 5000);
    expect(ctx.store.getState().currentIndex).toBe(1);
    // Es wird NICHT im Zeitraffer aufgeholt: der nächste Wechsel kommt erst nach ~100 ms.
    ctx.clock.advance(50);
    expect(ctx.store.getState().currentIndex).toBe(1);
    ctx.clock.advance(60);
    expect(ctx.store.getState().currentIndex).toBe(2);
  });

  it('finishes at the end and stops scheduling', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    ctx.clock.advance(5000);
    const state = ctx.store.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.isFinished).toBe(true);
    expect(state.currentIndex).toBe(11);
    expect(ctx.clock.pending).toBe(0);
  });

  it('reschedules immediately when the WPM changes during playback', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    ctx.clock.advance(60);
    ctx.store.dispatch({ type: 'SET_WPM', payload: 1200 }); // 50 ms pro Wort
    ctx.clock.advance(50);
    expect(ctx.store.getState().currentIndex).toBe(1);
  });

  it('restarts the chunk when the user jumps', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    ctx.clock.advance(80);
    ctx.store.dispatch({ type: 'SET_INDEX', payload: 6 });
    ctx.clock.advance(99);
    expect(ctx.store.getState().currentIndex).toBe(6);
    ctx.clock.advance(1);
    expect(ctx.store.getState().currentIndex).toBe(7);
  });

  it('cancels the timer on pause and on dispose', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    ctx.store.dispatch({ type: 'PAUSE' });
    expect(ctx.clock.pending).toBe(0);

    ctx.store.dispatch({ type: 'PLAY' });
    expect(ctx.clock.pending).toBe(1);
    ctx.engine.dispose();
    expect(ctx.clock.pending).toBe(0);
    ctx.store.dispatch({ type: 'PAUSE' });
    ctx.store.dispatch({ type: 'PLAY' });
    expect(ctx.clock.pending).toBe(0);
  });

  it('never keeps more than one timer, even for repeated state changes', () => {
    ctx.store.dispatch({ type: 'PLAY' });
    for (let i = 0; i < 20; i++) ctx.store.dispatch({ type: 'SET_WPM', payload: 400 + i });
    expect(ctx.clock.pending).toBe(1);
  });

  it('respects wordsPerChunk', () => {
    const local = setup({ wordsPerChunk: 3 });
    local.store.dispatch({ type: 'PLAY' });
    local.clock.advance(300);
    expect(local.store.getState().currentIndex).toBe(3);
  });
});
