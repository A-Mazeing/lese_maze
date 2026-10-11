import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from 'epubjs';
import { useReaderDispatch, useReaderDocuments } from '@/contexts/ReaderContext';
import { EpubParseAborted, parseEpubBook } from '@/utils/epubParse';
import { fingerprintWords, generateDocumentId } from '@/utils/storage';
import type { ParseResult } from './usePDFParser';
import { t } from '@/i18n';

/** Größenlimit, ab dem ein ePub abgelehnt wird. */
export const MAX_EPUB_BYTES = 150 * 1024 * 1024;

export interface EPubParserState {
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  title: string | null;
  author: string | null;
  /** Anzahl bereits gelesener Abschnitte. */
  progressDone: number;
  progressTotal: number;
  /** Abschnitte, die übersprungen werden mussten. */
  skippedSections: number;
}

const initialState: EPubParserState = {
  isLoading: false,
  error: null,
  fileName: null,
  title: null,
  author: null,
  progressDone: 0,
  progressTotal: 0,
  skippedSections: 0,
};

async function destroyQuietly(book: Book | null): Promise<void> {
  if (!book) return;
  try {
    book.destroy();
  } catch (error) {
    console.warn('[epub] Buch konnte nicht freigegeben werden:', error);
  }
}

/**
 * Hook zum Einlesen von ePub-Dateien.
 *
 * Das geöffnete Buch bleibt für den Viewer im ReaderContext erhalten. Es wird erst dort
 * registriert, wenn das Einlesen gelungen ist; bei Fehler oder Abbruch wird es sofort
 * zerstört (Archiv, Blob-URLs).
 */
export function useEPubParser() {
  const dispatch = useReaderDispatch();
  const { setEpubBook, releaseDocuments } = useReaderDocuments();
  const [state, setState] = useState<EPubParserState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const update = useCallback((patch: Partial<EPubParserState>) => {
    if (mountedRef.current) setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const cancel = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;
    update({ isLoading: false });
  }, [update]);

  const loadEPub = useCallback(
    async (file: File): Promise<ParseResult> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      const isCurrent = () => controllerRef.current === controller;
      const updateIfCurrent = (patch: Partial<EPubParserState>) => {
        if (isCurrent()) update(patch);
      };

      if (file.size > MAX_EPUB_BYTES) {
        const error = t('load.tooLarge', { mb: Math.round(MAX_EPUB_BYTES / 1024 / 1024) });
        update({ ...initialState, error, fileName: file.name });
        return { success: false, error };
      }

      setState({ ...initialState, isLoading: true, fileName: file.name });
      let book: Book | null = null;
      let accepted = false;

      try {
        const buffer = await file.arrayBuffer();
        if (signal.aborted) throw new EpubParseAborted();

        // epub.js (inkl. JSZip) wird erst bei Bedarf geladen.
        const { default: ePub } = await import('epubjs');
        book = ePub(buffer);

        const parsed = await parseEpubBook(book, {
          signal,
          onProgress: (done, total) => updateIfCurrent({ progressDone: done, progressTotal: total }),
        });
        if (signal.aborted) throw new EpubParseAborted();

        const title = parsed.title || file.name.replace(/\.epub$/i, '') || 'ePub';

        // Neues Buch registrieren; das vorherige wird dabei freigegeben.
        setEpubBook(book);
        accepted = true;

        dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: parsed.words,
            originalContent: parsed.words.join(' '),
            title,
            sourceType: 'epub',
            chapters: parsed.chapters,
            sentenceBreaks: parsed.sentenceBreaks,
            paragraphBreaks: parsed.paragraphBreaks,
            documentId: generateDocumentId(title, 'epub', fingerprintWords(parsed.words)),
          },
        });

        updateIfCurrent({
          isLoading: false,
          title,
          author: parsed.author,
          skippedSections: parsed.skippedSections,
        });
        return { success: true, wordCount: parsed.words.length };
      } catch (error) {
        if (error instanceof EpubParseAborted) {
          return { success: false, error: error.message };
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : t('epub.loadFailed');
        console.error('[epub] Laden fehlgeschlagen:', error);
        updateIfCurrent({ isLoading: false, error: message });
        return { success: false, error: message };
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        if (!accepted) await destroyQuietly(book);
      }
    },
    [dispatch, setEpubBook, update],
  );

  const reset = useCallback(() => {
    cancel();
    releaseDocuments();
    setState(initialState);
    dispatch({ type: 'CLEAR_CONTENT' });
  }, [cancel, dispatch, releaseDocuments]);

  return { ...state, loadEPub, cancel, reset };
}
