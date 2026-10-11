import type { ReaderState } from '@/types';
import { calculateWordDuration } from '@/utils/orpCalculator';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import type { ReaderStore } from './readerStore';

/** Ab dieser Verspätung (ms) wird nicht aufgeholt, sondern neu synchronisiert. */
export const MAX_CATCH_UP_MS = 250;

/** Ramp-up beginnt mit doppelter Anzeigedauer (halbe Geschwindigkeit). */
const RAMP_UP_START_MULTIPLIER = 2;

/**
 * Anzeigedauer des aktuellen Chunks in Millisekunden – inklusive Ramp-up.
 * Rein und zustandslos, damit sie direkt getestet werden kann.
 */
export function getChunkDuration(
  state: Pick<
    ReaderState,
    'words' | 'currentIndex' | 'wordsPerChunk' | 'wpm' | 'endIndex' | 'rampUpDuration' | 'rampUpWordsRemaining'
  >,
): number {
  const end = getEffectiveEnd(state);
  const last = Math.min(end, state.currentIndex + state.wordsPerChunk - 1);

  let total = 0;
  for (let i = state.currentIndex; i <= last; i++) {
    total += calculateWordDuration(state.words[i] ?? '', state.wpm);
  }
  if (total <= 0) total = Math.round(60_000 / Math.max(1, state.wpm));

  if (state.rampUpWordsRemaining > 0 && state.rampUpDuration > 0) {
    const remaining = Math.min(state.rampUpWordsRemaining, state.rampUpDuration);
    const progress = 1 - remaining / state.rampUpDuration;
    total = Math.round(total * (RAMP_UP_START_MULTIPLIER - (RAMP_UP_START_MULTIPLIER - 1) * progress));
  }
  return total;
}

export interface Clock {
  now(): number;
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultClock: Clock = {
  now: () => performance.now(),
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Wiedergabe-Takt für den RSVP-Reader.
 *
 * Gegenüber einem "Effekt pro Wort mit setTimeout(duration)" ergeben sich drei Vorteile:
 *  1. **Driftfrei:** Der Zeitpunkt jedes Chunks ergibt sich aus dem *Soll*-Zeitpunkt des
 *     vorigen Chunks (Anker + Dauer), nicht aus "jetzt + Dauer". Timer-Verspätung und
 *     React-Renderzeit summieren sich dadurch nicht auf.
 *  2. **Kein Wettlauf mit React:** Der Takt liest und schreibt den synchronen Store; es
 *     gibt keine Effekt-Kette, in der ein Re-Render einen laufenden Timer abbricht.
 *  3. **Kein Aufholen im Hintergrund:** Ist ein Tick um mehr als `MAX_CATCH_UP_MS`
 *     verspätet (gedrosselter Hintergrund-Tab, Debugger, Suspend), wird neu verankert,
 *     statt Wörter im Zeitraffer abzuspielen.
 *
 * Externe Änderungen (Sprung, WPM-Wechsel, neuer Inhalt) während der Wiedergabe
 * starten den aktuellen Chunk mit frischem Anker neu.
 */
export class PlaybackEngine {
  private timer: unknown = null;
  private anchor = 0;
  private ticking = false;
  private unsubscribe: (() => void) | null = null;

  /** Snapshot der Eingaben, für die der laufende Timer geplant wurde. */
  private plannedWords: readonly string[] | null = null;
  private plannedKey = '';

  constructor(
    private readonly store: ReaderStore,
    private readonly clock: Clock = defaultClock,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.subscribe(this.sync);
    this.sync();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.stopTimer();
  }

  /** Ob aktuell ein Tick eingeplant ist (für Tests und Diagnose). */
  get isScheduled(): boolean {
    return this.timer !== null;
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    this.plannedWords = null;
    this.plannedKey = '';
  }

  private keyOf(state: ReaderState): string {
    return [
      state.currentIndex,
      state.wpm,
      state.wordsPerChunk,
      state.endIndex,
      state.rampUpDuration,
      state.rampUpWordsRemaining,
    ].join('|');
  }

  private readonly sync = (): void => {
    if (this.ticking) return; // eigene Änderung während eines Ticks

    const state = this.store.getState();
    if (!state.isPlaying) {
      this.stopTimer();
      return;
    }
    if (this.timer !== null && this.plannedWords === state.words && this.plannedKey === this.keyOf(state)) {
      return; // unverändert
    }
    this.schedule(state, this.clock.now());
  };

  private schedule(state: ReaderState, anchor: number): void {
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    this.anchor = anchor;
    this.plannedWords = state.words;
    this.plannedKey = this.keyOf(state);

    const delay = Math.max(0, anchor + getChunkDuration(state) - this.clock.now());
    this.timer = this.clock.setTimeout(this.tick, delay);
  }

  private readonly tick = (): void => {
    this.timer = null;
    const before = this.store.getState();
    if (!before.isPlaying) {
      this.stopTimer();
      return;
    }

    const due = this.anchor + getChunkDuration(before);
    const lag = this.clock.now() - due;

    this.ticking = true;
    try {
      this.store.dispatch({ type: 'ADVANCE', payload: before.wordsPerChunk });
    } finally {
      this.ticking = false;
    }

    const after = this.store.getState();
    if (!after.isPlaying) {
      this.stopTimer();
      return;
    }
    this.schedule(after, lag > MAX_CATCH_UP_MS ? this.clock.now() : due);
  };
}
