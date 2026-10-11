import { useCallback, useEffect, useRef, useState } from 'react';
import { useReaderDispatch, useReaderDocuments } from '@/contexts/ReaderContext';
import { openPdf, PdfLoadError, type PdfDocumentHandle } from '@/utils/pdfjs';
import { buildPageText, type PdfTextItemLike } from '@/utils/pdfText';
import { cleanText, tokenizeText, tokenizeTextWithStructure } from '@/utils/textProcessor';
import { fingerprintWords, generateDocumentId } from '@/utils/storage';
import { t } from '@/i18n';

/** Größenlimit, ab dem ein PDF abgelehnt wird (schützt vor Speicherüberlauf der Extension). */
export const MAX_PDF_BYTES = 200 * 1024 * 1024;

export interface PDFParserState {
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  pageCount: number;
  currentPage: number;
}

export type ParseResult = { success: true; wordCount: number } | { success: false; error: string };

const initialState: PDFParserState = {
  isLoading: false,
  error: null,
  fileName: null,
  pageCount: 0,
  currentPage: 0,
};

/** Satzende am Seitenende → neuer Absatz; sonst läuft der Satz auf der nächsten Seite weiter. */
const ENDS_SENTENCE_RE = /[.!?…]["'“”„‘’»«)\]]*\s*$/u;

export interface ExtractedPdf {
  words: string[];
  sentenceBreaks: number[];
  paragraphBreaks: number[];
  /** Wort-Index, an dem jede Seite beginnt (pageBreaks[0] === 0, nicht fallend). */
  pageBreaks: number[];
  fullText: string;
}

/**
 * Baut aus den Texten der einzelnen Seiten die Wortliste samt Satz-, Absatz- und
 * Seitengrenzen. Seitentexte werden nur bei Satzende mit einem Absatzumbruch verbunden:
 * Ein Satz, der über den Seitenumbruch läuft, bleibt ein Satz (wichtig für „Bei Pause
 * zum Satzanfang“). Die Seitenstarts ergeben sich aus den Wortzahlen je Seite.
 */
export function assemblePdfText(pageTexts: readonly string[]): ExtractedPdf {
  const pageBreaks: number[] = [];
  let wordCount = 0;
  let fullText = '';

  for (const pageText of pageTexts) {
    pageBreaks.push(wordCount);
    if (!pageText) continue;
    if (fullText) fullText += ENDS_SENTENCE_RE.test(fullText) ? '\n\n' : ' ';
    fullText += pageText;
    wordCount += tokenizeText(pageText).length;
  }

  const { words, sentenceBreaks, paragraphBreaks } = tokenizeTextWithStructure(fullText);
  return { words, sentenceBreaks, paragraphBreaks, pageBreaks, fullText };
}

/**
 * Hook zum Einlesen von PDF-Dateien.
 *
 * Das Dokument wird einmal geöffnet: Aus ihm wird der Text für den RSVP-Reader
 * extrahiert, danach übernimmt der `ReaderContext` das geöffnete PDF für die
 * Seitenansicht und beendet es (pdf.js-Worker, Speicher), sobald ein anderes Dokument
 * geladen wird oder der Reader schließt. Schlägt das Laden fehl, wird es sofort beendet.
 */
export function usePDFParser() {
  const dispatch = useReaderDispatch();
  const { setPdf } = useReaderDocuments();
  const [state, setState] = useState<PDFParserState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const update = useCallback((patch: Partial<PDFParserState>) => {
    if (mountedRef.current) setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const cancel = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;
    update({ isLoading: false });
  }, [update]);

  const loadPDF = useCallback(
    async (file: File): Promise<ParseResult> => {
      // Ein neues Laden ersetzt ein noch laufendes.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      // Nur das jeweils neueste Laden darf den Hook-Zustand ändern.
      const isCurrent = () => controllerRef.current === controller;
      const updateIfCurrent = (patch: Partial<PDFParserState>) => {
        if (isCurrent()) update(patch);
      };

      if (file.size > MAX_PDF_BYTES) {
        const error = t('load.tooLarge', { mb: Math.round(MAX_PDF_BYTES / 1024 / 1024) });
        update({ isLoading: false, error, fileName: file.name });
        return { success: false, error };
      }

      setState({ ...initialState, isLoading: true, fileName: file.name });
      let pdf: Awaited<ReturnType<typeof openPdf>> | null = null;
      let accepted = false;

      try {
        const buffer = await file.arrayBuffer();
        if (signal.aborted) throw new PdfLoadError(t('load.aborted'), 'aborted');

        pdf = await openPdf(buffer, { signal });
        updateIfCurrent({ pageCount: pdf.numPages });

        const pageTexts: string[] = [];
        const pageSizes: PdfDocumentHandle['pageSizes'][number][] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (signal.aborted) throw new PdfLoadError(t('load.aborted'), 'aborted');
          updateIfCurrent({ currentPage: pageNumber });

          const page = await pdf.getPage(pageNumber);
          try {
            const viewport = page.getViewport({ scale: 1 });
            pageSizes.push({ width: viewport.width, height: viewport.height });
            const content = await page.getTextContent();
            pageTexts.push(cleanText(buildPageText(content.items as PdfTextItemLike[])));
          } finally {
            page.cleanup();
          }
        }

        const extracted = assemblePdfText(pageTexts);
        if (extracted.words.length === 0) {
          throw new Error(t('pdf.noText'));
        }

        if (signal.aborted) throw new PdfLoadError(t('load.aborted'), 'aborted');

        // Das geöffnete PDF übernimmt der Kontext (Seitenansicht); das vorherige wird beendet.
        setPdf({ document: pdf, pageSizes });
        accepted = true;

        const title = file.name.replace(/\.pdf$/i, '') || 'PDF';
        dispatch({
          type: 'SET_CONTENT',
          payload: {
            words: extracted.words,
            originalContent: extracted.fullText,
            title,
            sourceType: 'pdf',
            pageBreaks: extracted.pageBreaks,
            totalPages: pdf.numPages,
            sentenceBreaks: extracted.sentenceBreaks,
            paragraphBreaks: extracted.paragraphBreaks,
            documentId: generateDocumentId(title, 'pdf', fingerprintWords(extracted.words)),
          },
        });

        updateIfCurrent({ isLoading: false });
        return { success: true, wordCount: extracted.words.length };
      } catch (error) {
        if (error instanceof PdfLoadError && error.code === 'aborted') {
          return { success: false, error: error.message };
        }
        const message = error instanceof Error ? error.message : t('pdf.loadFailed');
        updateIfCurrent({ isLoading: false, error: message });
        return { success: false, error: message };
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
        if (pdf && !accepted) await pdf.destroy().catch(() => undefined); // beendet den Worker
      }
    },
    [dispatch, setPdf, update],
  );

  const reset = useCallback(() => {
    cancel();
    setState(initialState);
    dispatch({ type: 'CLEAR_CONTENT' });
  }, [cancel, dispatch]);

  return { ...state, loadPDF, cancel, reset };
}
