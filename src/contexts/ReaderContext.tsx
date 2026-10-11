import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Book } from 'epubjs';
import type { ReaderState } from '@/types';
import type { PdfDocumentHandle } from '@/utils/pdfjs';
import { PlaybackEngine } from '@/engine/playbackEngine';
import { createReaderStore, type ReaderStore } from '@/engine/readerStore';
import { getSettings, saveSettings } from '@/utils/storage';
import type { ReaderAction } from './readerReducer';

export type { ReaderAction, SetContentPayload } from './readerReducer';

/** Verzögerung, mit der geänderte Einstellungen gespeichert werden. */
const SETTINGS_SAVE_DEBOUNCE_MS = 400;

interface ReaderContextType {
  store: ReaderStore;
  dispatch: Dispatch<ReaderAction>;
  /** Aktuell geöffnetes ePub (nur lesen; Verwaltung über `setEpubBook`). */
  getEpubBook(): Book | null;
  /**
   * Registriert ein neues ePub und gibt das vorherige frei (Blob-URLs, Iframes, Archiv).
   * `null` gibt nur frei. PDFs werden nach der Textextraktion sofort zerstört und
   * müssen daher nicht gehalten werden.
   */
  setEpubBook(book: Book | null): void;
  /** Aktuell geöffnetes PDF (für die Seitenansicht). */
  getPdf(): PdfDocumentHandle | null;
  /**
   * Registriert ein neues PDF und beendet das vorherige (pdf.js-Worker, Schriften, Speicher).
   * `null` gibt nur frei.
   */
  setPdf(handle: PdfDocumentHandle | null): void;
  /** Gibt alle gehaltenen Dokument-Ressourcen frei. */
  releaseDocuments(): void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

async function destroyQuietly(label: string, destroy: () => unknown): Promise<void> {
  try {
    await destroy();
  } catch (error) {
    console.warn(`[reader] ${label} konnte nicht sauber freigegeben werden:`, error);
  }
}

export interface ReaderProviderProps {
  children: ReactNode;
  /** Nur für Tests: eigener Store (z. B. mit vorbelegtem Zustand). */
  store?: ReaderStore;
  /** Pausiert die Wiedergabe, wenn der Tab in den Hintergrund wechselt (Standard: an). */
  pauseWhenHidden?: boolean;
}

export function ReaderProvider({ children, store: injectedStore, pauseWhenHidden = true }: ReaderProviderProps) {
  const [ownStore] = useState(() => createReaderStore());
  const store = injectedStore ?? ownStore;

  const epubRef = useRef<Book | null>(null);
  const pdfRef = useRef<PdfDocumentHandle | null>(null);

  // --- Wiedergabe-Engine: genau eine pro Store ---------------------------------
  useEffect(() => {
    const engine = new PlaybackEngine(store);
    engine.start();
    return () => engine.dispose();
  }, [store]);

  // --- Einstellungen laden und (entprellt) speichern ---------------------------
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSaved = '';

    const snapshot = (state: ReaderState) =>
      JSON.stringify([state.wpm, state.wordsPerChunk, state.rampUpEnabled, state.rampUpDuration, state.rewindOnPause]);

    const flush = () => {
      saveTimer = null;
      const state = store.getState();
      const current = snapshot(state);
      if (current === lastSaved) return;
      lastSaved = current;
      void saveSettings({
        wpm: state.wpm,
        wordsPerChunk: state.wordsPerChunk,
        rampUpEnabled: state.rampUpEnabled,
        rampUpDuration: state.rampUpDuration,
        rewindOnPause: state.rewindOnPause,
      }).catch((error) => console.error('[reader] Einstellungen konnten nicht gespeichert werden:', error));
    };

    const unsubscribe = store.subscribe(() => {
      if (!loaded) return; // Defaults dürfen gespeicherte Werte nicht überschreiben
      if (saveTimer !== null) clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, SETTINGS_SAVE_DEBOUNCE_MS);
    });

    void getSettings().then((settings) => {
      if (cancelled) return;
      store.dispatch({
        type: 'SET_SETTINGS',
        payload: {
          wpm: settings.wpm,
          wordsPerChunk: settings.wordsPerChunk,
          rampUpEnabled: settings.rampUpEnabled,
          rampUpDuration: settings.rampUpDuration,
          rewindOnPause: settings.rewindOnPause,
        },
      });
      lastSaved = snapshot(store.getState());
      loaded = true;
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        if (loaded) flush(); // ausstehende Änderung nicht verlieren
      }
    };
  }, [store]);

  // --- Automatisch pausieren, wenn der Tab verdeckt wird ------------------------
  useEffect(() => {
    if (!pauseWhenHidden || typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') store.dispatch({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [store, pauseWhenHidden]);

  // --- Dokument-Ressourcen -------------------------------------------------------
  const setEpubBook = useCallback((book: Book | null) => {
    const previous = epubRef.current;
    epubRef.current = book;
    if (previous && previous !== book) void destroyQuietly('ePub', () => previous.destroy());
  }, []);

  const setPdf = useCallback((handle: PdfDocumentHandle | null) => {
    const previous = pdfRef.current;
    pdfRef.current = handle;
    if (previous && previous !== handle) void destroyQuietly('PDF', () => previous.document.destroy());
  }, []);

  const releaseDocuments = useCallback(() => {
    setEpubBook(null);
    setPdf(null);
  }, [setEpubBook, setPdf]);

  useEffect(() => releaseDocuments, [releaseDocuments]);

  const value = useMemo<ReaderContextType>(
    () => ({
      store,
      dispatch: store.dispatch,
      getEpubBook: () => epubRef.current,
      setEpubBook,
      getPdf: () => pdfRef.current,
      setPdf,
      releaseDocuments,
    }),
    [store, setEpubBook, setPdf, releaseDocuments],
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

function useReaderContext(): ReaderContextType {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReader must be used within a ReaderProvider');
  }
  return context;
}

/**
 * Voller Zugriff auf Zustand und Aktionen.
 * ACHTUNG: rendert bei JEDER Zustandsänderung (also bei jedem Wort) neu – für
 * Komponenten, die nur einen Teil brauchen, `useReaderSelector` verwenden.
 */
export function useReader() {
  const context = useReaderContext();
  const state = useSyncExternalStore(context.store.subscribe, context.store.getState, context.store.getState);
  return { ...context, state };
}

/** Abonniert nur einen Ausschnitt des Zustands; rendert nur neu, wenn sich dieser ändert. */
export function useReaderSelector<T>(selector: (state: ReaderState) => T): T {
  const { store } = useReaderContext();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** Stabile `dispatch`-Funktion; verursacht keine Re-Renders bei Zustandsänderungen. */
export function useReaderDispatch(): Dispatch<ReaderAction> {
  return useReaderContext().dispatch;
}

/** Zugriff auf den Store für imperativen Zugriff (Event-Handler, Effekte), ohne zu abonnieren. */
export function useReaderStore(): ReaderStore {
  return useReaderContext().store;
}

/** Dokument-Handles und deren Verwaltung (ohne Abo auf den Lesezustand). */
export function useReaderDocuments() {
  const { getEpubBook, setEpubBook, getPdf, setPdf, releaseDocuments } = useReaderContext();
  return { getEpubBook, setEpubBook, getPdf, setPdf, releaseDocuments };
}
