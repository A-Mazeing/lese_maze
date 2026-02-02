import { createContext, useContext, useReducer, useRef, useEffect, useCallback, useState, type ReactNode, type Dispatch, type MutableRefObject } from 'react';
import type { ReaderState, Chapter, ContentMetadata, CFICheckpoint } from '@/types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Book } from 'epubjs';
import { calculateWordDuration } from '@/utils/orpCalculator';
import { getSettings, saveSettings } from '@/utils/storage';

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
  | { type: 'SET_WORDS_PER_CHUNK'; payload: number }
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
  wordsPerChunk: 1,
  previewMode: true, // Standard für Split-Ansicht
  startIndex: 0,
  endIndex: null,
  originalContent: null,
  metadata: initialMetadata,
  sentenceBreaks: [],
  paragraphBreaks: [],
  // Ramp-up settings
  rampUpEnabled: true,
  rampUpDuration: 5,
  rampUpWordsRemaining: 0,
  // Pause behavior
  rewindOnPause: true,
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
      return { 
        ...state, 
        isPlaying: true,
        // Starte Ramp-up wenn aktiviert
        rampUpWordsRemaining: state.rampUpEnabled ? state.rampUpDuration : 0,
      };
    
    case 'PAUSE': {
      // Wenn rewindOnPause aktiviert ist, springe zum Satzanfang zurück
      if (state.rewindOnPause && state.sentenceBreaks.length > 0) {
        // Finde den größten Satzanfang, der kleiner oder gleich currentIndex ist
        let targetIndex = state.startIndex;
        for (let i = state.sentenceBreaks.length - 1; i >= 0; i--) {
          if (state.sentenceBreaks[i] <= state.currentIndex) {
            targetIndex = Math.max(state.startIndex, state.sentenceBreaks[i]);
            break;
          }
        }
        return { 
          ...state, 
          isPlaying: false,
          currentIndex: targetIndex,
          progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
          rampUpWordsRemaining: 0,
        };
      }
      return { ...state, isPlaying: false, rampUpWordsRemaining: 0 };
    }
    
    case 'TOGGLE_PLAY': {
      if (state.isPlaying) {
        // Pausieren - gleiche Logik wie PAUSE
        if (state.rewindOnPause && state.sentenceBreaks.length > 0) {
          let targetIndex = state.startIndex;
          for (let i = state.sentenceBreaks.length - 1; i >= 0; i--) {
            if (state.sentenceBreaks[i] <= state.currentIndex) {
              targetIndex = Math.max(state.startIndex, state.sentenceBreaks[i]);
              break;
            }
          }
          return { 
            ...state, 
            isPlaying: false,
            currentIndex: targetIndex,
            progress: calculateProgress(targetIndex, state.words, state.startIndex, state.endIndex),
            rampUpWordsRemaining: 0,
          };
        }
        return { ...state, isPlaying: false, rampUpWordsRemaining: 0 };
      } else {
        // Starten - gleiche Logik wie PLAY
        return { 
          ...state, 
          isPlaying: true,
          rampUpWordsRemaining: state.rampUpEnabled ? state.rampUpDuration : 0,
        };
      }
    }
    
    case 'SET_WPM':
      return { ...state, wpm: Math.max(50, Math.min(1500, action.payload)) };
    
    case 'SET_WORDS_PER_CHUNK':
      return { ...state, wordsPerChunk: Math.max(1, Math.min(4, action.payload)) };
    
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
        wordsPerChunk: state.wordsPerChunk, // wordsPerChunk beibehalten
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
    
    case 'SET_RAMP_UP_ENABLED':
      return { ...state, rampUpEnabled: action.payload };
    
    case 'SET_RAMP_UP_DURATION':
      return { ...state, rampUpDuration: Math.max(1, Math.min(20, action.payload)) };
    
    case 'SET_REWIND_ON_PAUSE':
      return { ...state, rewindOnPause: action.payload };
    
    case 'DECREMENT_RAMP_UP':
      return { 
        ...state, 
        rampUpWordsRemaining: Math.max(0, state.rampUpWordsRemaining - 1),
      };
    
    default:
      return state;
  }
}

interface ReaderContextType {
  state: ReaderState;
  dispatch: Dispatch<ReaderAction>;
  pdfDocumentRef: MutableRefObject<PDFDocumentProxy | null>;
  epubBookRef: MutableRefObject<Book | null>;
  cfiCheckpoints: CFICheckpoint[];
  setCfiCheckpoints: (checkpoints: CFICheckpoint[]) => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(readerReducer, initialState);
  const [cfiCheckpoints, setCfiCheckpoints] = useState<CFICheckpoint[]>([]);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const epubBookRef = useRef<Book | null>(null);
  const timerRef = useRef<number | null>(null);

  // Lade Settings aus gespeicherten Settings beim Start
  useEffect(() => {
    getSettings().then(settings => {
      if (settings.wordsPerChunk && settings.wordsPerChunk !== state.wordsPerChunk) {
        dispatch({ type: 'SET_WORDS_PER_CHUNK', payload: settings.wordsPerChunk });
      }
      if (settings.rampUpEnabled !== undefined) {
        dispatch({ type: 'SET_RAMP_UP_ENABLED', payload: settings.rampUpEnabled });
      }
      if (settings.rampUpDuration !== undefined) {
        dispatch({ type: 'SET_RAMP_UP_DURATION', payload: settings.rampUpDuration });
      }
      if (settings.rewindOnPause !== undefined) {
        dispatch({ type: 'SET_REWIND_ON_PAUSE', payload: settings.rewindOnPause });
      }
    });
  }, []);

  // Speichere Settings wenn sie sich ändern
  useEffect(() => {
    saveSettings({ 
      wordsPerChunk: state.wordsPerChunk,
      rampUpEnabled: state.rampUpEnabled,
      rampUpDuration: state.rampUpDuration,
      rewindOnPause: state.rewindOnPause,
    });
  }, [state.wordsPerChunk, state.rampUpEnabled, state.rampUpDuration, state.rewindOnPause]);

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

    // Berechne Dauer für alle Wörter im Chunk
    // Die Anzeigezeit basiert auf der Anzahl der Wörter
    const chunkSize = state.wordsPerChunk;
    let totalDuration = 0;
    for (let i = 0; i < chunkSize && state.currentIndex + i <= effectiveEnd; i++) {
      const word = state.words[state.currentIndex + i];
      if (word) {
        totalDuration += calculateWordDuration(word, state.wpm);
      }
    }
    
    // Falls keine Wörter, Standard-Dauer
    if (totalDuration === 0) {
      return;
    }

    // Ramp-up: Verlangsame die Geschwindigkeit am Anfang
    // Wir starten bei 50% Geschwindigkeit und steigern linear zur Zielgeschwindigkeit
    if (state.rampUpWordsRemaining > 0 && state.rampUpDuration > 0) {
      // Berechne Ramp-up Faktor: startet bei 2.0 (50% Geschwindigkeit) und geht zu 1.0
      const progress = 1 - (state.rampUpWordsRemaining / state.rampUpDuration);
      const rampUpMultiplier = 2.0 - progress; // 2.0 -> 1.0
      totalDuration = Math.round(totalDuration * rampUpMultiplier);
    }

    // Starte Timer für nächsten Chunk
    timerRef.current = window.setTimeout(() => {
      // Dekrementiere Ramp-up Counter wenn aktiv
      if (state.rampUpWordsRemaining > 0) {
        dispatch({ type: 'DECREMENT_RAMP_UP' });
      }
      
      dispatch({ type: 'SKIP_FORWARD', payload: chunkSize });
    }, totalDuration);

    // Cleanup: Timer stoppen wenn Effect neu ausgeführt wird oder Component unmounted
    return stopTimer;
  }, [state.isPlaying, state.currentIndex, state.words, state.wpm, state.wordsPerChunk, state.endIndex, state.rampUpWordsRemaining, state.rampUpDuration, stopTimer]);

  // Cleanup beim Unmount
  useEffect(() => {
    return stopTimer;
  }, [stopTimer]);

  return (
    <ReaderContext.Provider value={{ state, dispatch, pdfDocumentRef, epubBookRef, cfiCheckpoints, setCfiCheckpoints }}>
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
