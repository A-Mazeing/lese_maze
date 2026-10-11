import type { Chapter, ContentMetadata, ReaderState, Settings, SourceType } from '@/types';
import { WPM_MAX, WPM_MIN } from '@/utils/storage';

/** Inhalt, der in den Reader geladen wird. */
export interface SetContentPayload {
  words: string[];
  originalContent: string;
  title: string;
  sourceType: SourceType;
  chapters?: Chapter[];
  pageBreaks?: number[];
  totalPages?: number;
  sentenceBreaks?: number[];
  paragraphBreaks?: number[];
  documentId?: string;
}

/** Einstellungen, die der Reducer selbst verwaltet. */
export type ReaderSettingsPatch = Partial<
  Pick<Settings, 'wpm' | 'wordsPerChunk' | 'rampUpEnabled' | 'rampUpDuration' | 'rewindOnPause'>
>;

export type ReaderAction =
  | { type: 'SET_WORDS'; payload: string[] }
  | { type: 'SET_CONTENT'; payload: SetContentPayload }
  | { type: 'SET_INDEX'; payload: number }
  | { type: 'NEXT_WORD' }
  | { type: 'PREV_WORD' }
  | { type: 'SKIP_FORWARD'; payload?: number }
  | { type: 'SKIP_BACKWARD'; payload?: number }
  | { type: 'GOTO_PREV_SENTENCE' }
  | { type: 'GOTO_NEXT_SENTENCE' }
  | { type: 'GOTO_PREV_PARAGRAPH' }
  | { type: 'GOTO_NEXT_PARAGRAPH' }
  /** Vom Playback-Takt ausgelöst: rückt um `count` Wörter vor bzw. beendet die Wiedergabe. */
  | { type: 'ADVANCE'; payload: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_WPM'; payload: number }
  | { type: 'SET_WORDS_PER_CHUNK'; payload: number }
  | { type: 'SET_SETTINGS'; payload: ReaderSettingsPatch }
  | { type: 'RESET' }
  | { type: 'CLEAR_CONTENT' }
  | { type: 'SET_PREVIEW_MODE'; payload: boolean }
  | { type: 'SET_START_INDEX'; payload: number }
  | { type: 'SET_END_INDEX'; payload: number | null }
  | { type: 'SET_READING_RANGE'; payload: { startIndex: number; endIndex: number | null } }
  | { type: 'SET_RAMP_UP_ENABLED'; payload: boolean }
  | { type: 'SET_RAMP_UP_DURATION'; payload: number }
  | { type: 'SET_REWIND_ON_PAUSE'; payload: boolean }
  | { type: 'DECREMENT_RAMP_UP' };

export const DEFAULT_SKIP = 5;

const initialMetadata: ContentMetadata = {
  title: null,
  sourceType: null,
  chapters: undefined,
  pageBreaks: undefined,
  totalPages: undefined,
  documentId: undefined,
};

export const initialReaderState: ReaderState = {
  words: [],
  currentIndex: 0,
  isPlaying: false,
  isFinished: false,
  wpm: 300,
  progress: 0,
  wordsPerChunk: 1,
  previewMode: true,
  startIndex: 0,
  endIndex: null,
  originalContent: null,
  metadata: initialMetadata,
  sentenceBreaks: [],
  paragraphBreaks: [],
  rampUpEnabled: true,
  rampUpDuration: 5,
  rampUpWordsRemaining: 0,
  rewindOnPause: true,
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen (rein, einzeln testbar)
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toInt(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** Letzter gültiger Wortindex des Lesebereichs (-1 bei leerem Dokument). */
export function getEffectiveEnd(state: Pick<ReaderState, 'words' | 'endIndex'>): number {
  const last = state.words.length - 1;
  return state.endIndex === null ? last : Math.min(state.endIndex, last);
}

/** Fortschritt innerhalb des Lesebereichs in Prozent (0-100). */
export function calculateProgress(
  currentIndex: number,
  startIndex: number,
  effectiveEnd: number,
): number {
  const range = effectiveEnd - startIndex;
  if (range <= 0) return 0;
  return clamp(((currentIndex - startIndex) / range) * 100, 0, 100);
}

/** Index des größten Elements <= value, oder -1 (Binärsuche über aufsteigend sortierte Liste). */
export function findLastAtOrBefore(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/** Index des kleinsten Elements > value, oder -1. */
export function findFirstAfter(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] > value) {
      result = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return result;
}

/** Setzt die Position und leitet den Fortschritt daraus ab. Beendet-Status wird zurückgesetzt. */
function moveTo(state: ReaderState, index: number): ReaderState {
  if (index === state.currentIndex && !state.isFinished) {
    return state;
  }
  return {
    ...state,
    currentIndex: index,
    isFinished: false,
    progress: calculateProgress(index, state.startIndex, getEffectiveEnd(state)),
  };
}

/** Pausiert; springt bei aktivem `rewindOnPause` zum Beginn des aktuellen Satzes zurück. */
function pause(state: ReaderState): ReaderState {
  if (!state.isPlaying) return state;

  let target = state.currentIndex;
  if (state.rewindOnPause && state.sentenceBreaks.length > 0) {
    const i = findLastAtOrBefore(state.sentenceBreaks, state.currentIndex);
    if (i >= 0) target = Math.max(state.startIndex, state.sentenceBreaks[i]);
  }
  return {
    ...state,
    isPlaying: false,
    currentIndex: target,
    progress: calculateProgress(target, state.startIndex, getEffectiveEnd(state)),
    rampUpWordsRemaining: 0,
  };
}

/** Startet die Wiedergabe; am Ende des Lesebereichs beginnt sie von vorn. */
function play(state: ReaderState): ReaderState {
  if (state.isPlaying || state.words.length === 0) return state;

  const end = getEffectiveEnd(state);
  const restart = state.isFinished || state.currentIndex >= end || state.currentIndex < state.startIndex;
  const index = restart ? state.startIndex : state.currentIndex;

  return {
    ...state,
    isPlaying: true,
    isFinished: false,
    currentIndex: index,
    progress: calculateProgress(index, state.startIndex, end),
    rampUpWordsRemaining: state.rampUpEnabled ? state.rampUpDuration : 0,
  };
}

function applySettings(state: ReaderState, patch: ReaderSettingsPatch): ReaderState {
  const next = { ...state };
  if (patch.wpm !== undefined) next.wpm = clamp(toInt(patch.wpm, state.wpm), WPM_MIN, WPM_MAX);
  if (patch.wordsPerChunk !== undefined) {
    next.wordsPerChunk = clamp(toInt(patch.wordsPerChunk, state.wordsPerChunk), 1, 4);
  }
  if (patch.rampUpEnabled !== undefined) next.rampUpEnabled = patch.rampUpEnabled;
  if (patch.rampUpDuration !== undefined) {
    next.rampUpDuration = clamp(toInt(patch.rampUpDuration, state.rampUpDuration), 1, 20);
  }
  if (patch.rewindOnPause !== undefined) next.rewindOnPause = patch.rewindOnPause;
  if (!next.rampUpEnabled) next.rampUpWordsRemaining = 0;
  return next;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'SET_WORDS':
      return {
        ...state,
        words: action.payload,
        currentIndex: 0,
        progress: 0,
        isPlaying: false,
        isFinished: false,
        startIndex: 0,
        endIndex: null,
        previewMode: true,
        rampUpWordsRemaining: 0,
      };

    case 'SET_CONTENT': {
      const {
        words, originalContent, title, sourceType, chapters, pageBreaks, totalPages,
        sentenceBreaks, paragraphBreaks, documentId,
      } = action.payload;
      return {
        ...state,
        words,
        originalContent,
        currentIndex: 0,
        progress: 0,
        isPlaying: false,
        isFinished: false,
        startIndex: 0,
        endIndex: null,
        previewMode: true,
        rampUpWordsRemaining: 0,
        sentenceBreaks: sentenceBreaks ?? [],
        paragraphBreaks: paragraphBreaks ?? [],
        metadata: { title, sourceType, chapters, pageBreaks, totalPages, documentId },
      };
    }

    case 'SET_INDEX': {
      if (state.words.length === 0) return state;
      const index = clamp(toInt(action.payload, state.currentIndex), 0, state.words.length - 1);
      return moveTo(state, index);
    }

    case 'NEXT_WORD':
      return moveTo(state, Math.min(getEffectiveEnd(state), state.currentIndex + 1));

    case 'PREV_WORD':
      return moveTo(state, Math.max(state.startIndex, state.currentIndex - 1));

    case 'SKIP_FORWARD': {
      const skip = Math.max(1, toInt(action.payload ?? DEFAULT_SKIP, DEFAULT_SKIP));
      const end = getEffectiveEnd(state);
      if (end < 0) return state;
      return moveTo(state, Math.min(end, state.currentIndex + skip));
    }

    case 'SKIP_BACKWARD': {
      const skip = Math.max(1, toInt(action.payload ?? DEFAULT_SKIP, DEFAULT_SKIP));
      return moveTo(state, Math.max(state.startIndex, state.currentIndex - skip));
    }

    case 'ADVANCE': {
      if (!state.isPlaying) return state;
      const count = Math.max(1, toInt(action.payload, 1));
      const end = getEffectiveEnd(state);
      const next = state.currentIndex + count;
      const rampUpWordsRemaining = Math.max(0, state.rampUpWordsRemaining - 1);

      if (next > end) {
        // Der letzte Chunk wurde vollständig angezeigt: Wiedergabe endet.
        return {
          ...state,
          currentIndex: Math.max(0, end),
          isPlaying: false,
          isFinished: true,
          progress: end >= 0 ? 100 : 0,
          rampUpWordsRemaining: 0,
        };
      }
      return {
        ...state,
        currentIndex: next,
        progress: calculateProgress(next, state.startIndex, end),
        rampUpWordsRemaining,
      };
    }

    case 'PLAY':
      return play(state);

    case 'PAUSE':
      return pause(state);

    case 'TOGGLE_PLAY':
      return state.isPlaying ? pause(state) : play(state);

    case 'SET_WPM':
      return applySettings(state, { wpm: action.payload });

    case 'SET_WORDS_PER_CHUNK':
      return applySettings(state, { wordsPerChunk: action.payload });

    case 'SET_SETTINGS':
      return applySettings(state, action.payload);

    case 'SET_RAMP_UP_ENABLED':
      return applySettings(state, { rampUpEnabled: action.payload });

    case 'SET_RAMP_UP_DURATION':
      return applySettings(state, { rampUpDuration: action.payload });

    case 'SET_REWIND_ON_PAUSE':
      return applySettings(state, { rewindOnPause: action.payload });

    case 'DECREMENT_RAMP_UP':
      return { ...state, rampUpWordsRemaining: Math.max(0, state.rampUpWordsRemaining - 1) };

    case 'RESET':
      return {
        ...state,
        currentIndex: state.startIndex,
        progress: 0,
        isPlaying: false,
        isFinished: false,
        previewMode: true,
        rampUpWordsRemaining: 0,
      };

    case 'CLEAR_CONTENT':
      return {
        ...initialReaderState,
        wpm: state.wpm,
        wordsPerChunk: state.wordsPerChunk,
        rampUpEnabled: state.rampUpEnabled,
        rampUpDuration: state.rampUpDuration,
        rewindOnPause: state.rewindOnPause,
      };

    case 'SET_PREVIEW_MODE':
      return {
        ...state,
        previewMode: action.payload,
        isPlaying: action.payload ? false : state.isPlaying,
        rampUpWordsRemaining: action.payload ? 0 : state.rampUpWordsRemaining,
      };

    case 'SET_START_INDEX': {
      if (state.words.length === 0) return state;
      const startIndex = clamp(toInt(action.payload, 0), 0, state.words.length - 1);
      const endIndex = state.endIndex === null ? null : Math.max(startIndex, state.endIndex);
      const currentIndex = Math.max(startIndex, state.currentIndex);
      const next = { ...state, startIndex, endIndex, isFinished: false };
      return {
        ...next,
        currentIndex,
        progress: calculateProgress(currentIndex, startIndex, getEffectiveEnd(next)),
      };
    }

    case 'SET_END_INDEX': {
      if (state.words.length === 0) return state;
      const endIndex =
        action.payload === null
          ? null
          : clamp(toInt(action.payload, state.words.length - 1), state.startIndex, state.words.length - 1);
      const next = { ...state, endIndex, isFinished: false };
      const currentIndex =
        endIndex !== null ? Math.min(state.currentIndex, endIndex) : state.currentIndex;
      return {
        ...next,
        currentIndex,
        progress: calculateProgress(currentIndex, state.startIndex, getEffectiveEnd(next)),
      };
    }

    case 'SET_READING_RANGE': {
      if (state.words.length === 0) return state;
      const last = state.words.length - 1;
      const startIndex = clamp(toInt(action.payload.startIndex, 0), 0, last);
      const endIndex =
        action.payload.endIndex === null
          ? null
          : clamp(toInt(action.payload.endIndex, last), startIndex, last);
      return {
        ...state,
        startIndex,
        endIndex,
        currentIndex: startIndex,
        progress: 0,
        isFinished: false,
      };
    }

    case 'GOTO_PREV_SENTENCE':
      return gotoBreak(state, state.sentenceBreaks, 'prev');
    case 'GOTO_NEXT_SENTENCE':
      return gotoBreak(state, state.sentenceBreaks, 'next');
    case 'GOTO_PREV_PARAGRAPH':
      return gotoBreak(state, state.paragraphBreaks, 'prev');
    case 'GOTO_NEXT_PARAGRAPH':
      return gotoBreak(state, state.paragraphBreaks, 'next');

    default:
      return state;
  }
}

function gotoBreak(state: ReaderState, breaks: readonly number[], direction: 'prev' | 'next'): ReaderState {
  if (breaks.length === 0 || state.words.length === 0) return state;
  const end = getEffectiveEnd(state);

  if (direction === 'prev') {
    // Größter Beginn, der strikt vor der aktuellen Position liegt.
    const i = findLastAtOrBefore(breaks, state.currentIndex - 1);
    const target = i >= 0 ? breaks[i] : state.startIndex;
    return moveTo(state, clamp(target, state.startIndex, Math.max(state.startIndex, end)));
  }

  const i = findFirstAfter(breaks, state.currentIndex);
  if (i < 0) return state;
  return moveTo(state, Math.min(end, breaks[i]));
}
