import { createContext, useContext, useReducer, useRef, useEffect, useCallback, type ReactNode, type Dispatch, type MutableRefObject } from 'react';
import type { ReaderState, Chapter, ContentMetadata } from '@/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { calculateWordDuration } from '@/utils/orpCalculator';

interface SetContentPayload {
  words: string[];
  originalContent: string;
  title: string;
  sourceType: 'pdf' | 'epub' | 'page';
  chapters?: Chapter[];
  pageBreaks?: number[];
  totalPages?: number;
  sentenceBreaks?: number[];
  paragraphBreaks?: number[];
}

type ReaderAction =
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
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_WPM'; payload: number }
  | { type: 'RESET' }
  | { type: 'CLEAR_CONTENT' }
  | { type: 'SET_PREVIEW_MODE'; payload: boolean }
  | { type: 'SET_START_INDEX'; payload: number }
  | { type: 'SET_END_INDEX'; payload: number | null }
  | { type: 'SET_READING_RANGE'; payload: { startIndex: number; endIndex: number | null } };

const initialMetadata: ContentMetadata = {
  title: null,
  sourceType: null,
  chapters: undefined,
  pageBreaks: undefined,
  totalPages: undefined,
};

const initialState: ReaderState = {
  words: [],
  currentIndex: 0,
  isPlaying: false,
  wpm: 300,
  progress: 0,
  previewMode: true, // Standard für Split-Ansicht
  startIndex: 0,
  endIndex: null,
  originalContent: null,
  metadata: initialMetadata,
  sentenceBreaks: [],
  paragraphBreaks: [],
};

function calculateProgress(currentIndex: number, words: string[], startIndex: number, endIndex: number | null): number {
  const effectiveEnd = endIndex ?? words.length - 1;
  const range = effectiveEnd - startIndex;
  if (range <= 0) return 0;
  const positionInRange = currentIndex - startIndex;
  return Math.max(0, Math.min(100, (positionInRange / range) * 100));
}

function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'SET_WORDS':
      return {
        ...state,
        words: action.payload,
        currentIndex: 0,
        progress: 0,
        isPlaying: false,
        startIndex: 0,
        endIndex: null,
        previewMode: true,
      };
    
    case 'SET_CONTENT': {
      const { words, originalContent, title, sourceType, chapters, pageBreaks, totalPages, sentenceBreaks, paragraphBreaks } = action.payload;
      return {
        ...state,
        words,
        originalContent,
        currentIndex: 0,
        progress: 0,
        isPlaying: false,
        startIndex: 0,
        endIndex: null,
        previewMode: true,
        sentenceBreaks: sentenceBreaks ?? [],
        paragraphBreaks: paragraphBreaks ?? [],
        metadata: {
          title,
          sourceType,
          chapters,
          pageBreaks,
          totalPages,
        },
      };
    }
    
    case 'SET_INDEX': {
      const index = Math.max(0, Math.min(action.payload, state.words.length - 1));
      return {
        ...state,
        currentIndex: index,
        progress: calculateProgress(index, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'NEXT_WORD': {
      const effectiveEnd = state.endIndex ?? state.words.length - 1;
      if (state.currentIndex >= effectiveEnd) {
        return { ...state, isPlaying: false };
      }
      const newIndex = state.currentIndex + 1;
      return {
        ...state,
        currentIndex: newIndex,
        progress: calculateProgress(newIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'PREV_WORD': {
      const newIndex = Math.max(state.startIndex, state.currentIndex - 1);
      return {
        ...state,
        currentIndex: newIndex,
        progress: calculateProgress(newIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'SKIP_FORWARD': {
      const skip = action.payload || 5;
      const effectiveEnd = state.endIndex ?? state.words.length - 1;
      const newIndex = Math.min(effectiveEnd, state.currentIndex + skip);
      return {
        ...state,
        currentIndex: newIndex,
        progress: calculateProgress(newIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'SKIP_BACKWARD': {
      const skip = action.payload || 5;
      const newIndex = Math.max(state.startIndex, state.currentIndex - skip);
      return {
        ...state,
        currentIndex: newIndex,
        progress: calculateProgress(newIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'PLAY':
      return { ...state, isPlaying: true, previewMode: false };
    
    case 'PAUSE':
      return { ...state, isPlaying: false };
    
    case 'TOGGLE_PLAY':
      if (!state.isPlaying) {
        return { ...state, isPlaying: true, previewMode: false };
      }
      return { ...state, isPlaying: false };
    
    case 'SET_WPM':
      return { ...state, wpm: Math.max(50, Math.min(1500, action.payload)) };
    
    case 'RESET':
      return { 
        ...state, 
        currentIndex: state.startIndex, 
        progress: 0, 
        isPlaying: false,
        previewMode: true,
      };
    
    case 'CLEAR_CONTENT':
      return {
        ...initialState,
        wpm: state.wpm, // WPM beibehalten
      };
    
    case 'SET_PREVIEW_MODE':
      return { 
        ...state, 
        previewMode: action.payload,
        isPlaying: action.payload ? false : state.isPlaying, // Pause beim Wechsel zu Preview
      };
    
    case 'SET_START_INDEX': {
      const startIndex = Math.max(0, Math.min(action.payload, state.words.length - 1));
      const currentIndex = Math.max(startIndex, state.currentIndex);
      return {
        ...state,
        startIndex,
        currentIndex,
        progress: calculateProgress(currentIndex, state.words, startIndex, state.endIndex),
      };
    }
    
    case 'SET_END_INDEX': {
      const endIndex = action.payload === null 
        ? null 
        : Math.max(state.startIndex, Math.min(action.payload, state.words.length - 1));
      const currentIndex = endIndex !== null 
        ? Math.min(state.currentIndex, endIndex) 
        : state.currentIndex;
      return {
        ...state,
        endIndex,
        currentIndex,
        progress: calculateProgress(currentIndex, state.words, state.startIndex, endIndex),
      };
    }
    
    case 'SET_READING_RANGE': {
      const { startIndex, endIndex } = action.payload;
      const validStart = Math.max(0, Math.min(startIndex, state.words.length - 1));
      const validEnd = endIndex === null 
        ? null 
        : Math.max(validStart, Math.min(endIndex, state.words.length - 1));
      return {
        ...state,
        startIndex: validStart,
        endIndex: validEnd,
        currentIndex: validStart,
        progress: 0,
      };
    }
    
    case 'GOTO_PREV_SENTENCE': {
      if (state.sentenceBreaks.length === 0) return state;
      
      // Finde den größten Satzanfang, der kleiner als currentIndex ist
      let targetIndex = 0;
      for (let i = state.sentenceBreaks.length - 1; i >= 0; i--) {
        if (state.sentenceBreaks[i] < state.currentIndex) {
          targetIndex = state.sentenceBreaks[i];
          break;
        }
      }
      
      return {
        ...state,
        currentIndex: targetIndex,
        progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'GOTO_NEXT_SENTENCE': {
      if (state.sentenceBreaks.length === 0) return state;
      
      // Finde den kleinsten Satzanfang, der größer als currentIndex ist
      let targetIndex = state.currentIndex;
      for (let i = 0; i < state.sentenceBreaks.length; i++) {
        if (state.sentenceBreaks[i] > state.currentIndex) {
          targetIndex = state.sentenceBreaks[i];
          break;
        }
      }
      
      return {
        ...state,
        currentIndex: targetIndex,
        progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'GOTO_PREV_PARAGRAPH': {
      if (state.paragraphBreaks.length === 0) return state;
      
      // Finde den größten Absatzanfang, der kleiner als currentIndex ist
      let targetIndex = 0;
      for (let i = state.paragraphBreaks.length - 1; i >= 0; i--) {
        if (state.paragraphBreaks[i] < state.currentIndex) {
          targetIndex = state.paragraphBreaks[i];
          break;
        }
      }
      
      return {
        ...state,
        currentIndex: targetIndex,
        progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    case 'GOTO_NEXT_PARAGRAPH': {
      if (state.paragraphBreaks.length === 0) return state;
      
      // Finde den kleinsten Absatzanfang, der größer als currentIndex ist
      let targetIndex = state.currentIndex;
      for (let i = 0; i < state.paragraphBreaks.length; i++) {
        if (state.paragraphBreaks[i] > state.currentIndex) {
          targetIndex = state.paragraphBreaks[i];
          break;
        }
      }
      
      return {
        ...state,
        currentIndex: targetIndex,
        progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
      };
    }
    
    default:
      return state;
  }
}

interface ReaderContextType {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  pdfDocumentRef: MutableRefObject<PDFDocumentProxy | null>;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(readerReducer, initialState);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const timerRef = useRef<number | null>(null);

  // Timer stoppen - stabile Referenz
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Zentrale Timer-Logik für RSVP
  // Ein einziger Timer für die gesamte App - vermeidet das Problem
  // dass mehrere useRSVP-Instanzen jeweils eigene Timer starten
  useEffect(() => {
    // Immer zuerst stoppen um doppelte Timer zu vermeiden
    stopTimer();

    // Wenn nicht playing, nichts weiter tun
    if (!state.isPlaying) {
      return;
    }

    // Prüfe ob wir am Ende sind
    const effectiveEnd = state.endIndex ?? state.words.length - 1;
    if (state.currentIndex >= effectiveEnd) {
      // Am Ende angekommen - Playback stoppen
      dispatch({ type: 'PAUSE' });
      return;
    }

    // Berechne Dauer für aktuelles Wort
    const currentWord = state.words[state.currentIndex];
    if (!currentWord) {
      return;
    }
    
    const duration = calculateWordDuration(currentWord, state.wpm);

    // Starte Timer für nächstes Wort
    timerRef.current = window.setTimeout(() => {
      dispatch({ type: 'NEXT_WORD' });
    }, duration);

    // Cleanup: Timer stoppen wenn Effect neu ausgeführt wird oder Component unmounted
    return stopTimer;
  }, [state.isPlaying, state.currentIndex, state.words, state.wpm, state.endIndex, stopTimer]);

  // Cleanup beim Unmount
  useEffect(() => {
    return stopTimer;
  }, [stopTimer]);

  return (
    <ReaderContext.Provider value={{ state, dispatch, pdfDocumentRef }}>
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}
