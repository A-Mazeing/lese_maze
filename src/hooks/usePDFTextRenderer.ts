import { useState, useCallback, useRef, useEffect } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { calculateFromContentSelection } from '@/utils/selection';
import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';

export interface PDFPageContent {
  pageNum: number;
  text: string;
  paragraphs: string[];
  rawItems: TextItem[];
}

export interface PDFTextRendererState {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  textContent: PDFPageContent[];
}

/**
 * Hook für text-basiertes PDF-Rendering (ohne Canvas).
 * Ähnlich wie useEPubViewer, aber für PDFs.
 * Extrahiert Text aus PDF und rendert ihn als scrollbaren HTML-Content.
 */
export function usePDFTextRenderer() {
  const { state, pdfDocumentRef } = useReader();
  const { metadata } = state;

  const [rendererState, setRendererState] = useState<PDFTextRendererState>({
    currentPage: 1,
    totalPages: metadata.totalPages || 0,
    isLoading: false,
    error: null,
    textContent: [],
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const isExtractedRef = useRef(false);
  const currentWordIndexRef = useRef<number>(-1);

  /**
   * Extrahiert Text aus einer einzelnen PDF-Seite.
   */
  const extractPageText = useCallback(async (
    page: PDFPageProxy,
    pageNum: number
  ): Promise<PDFPageContent> => {
    const textContent = await page.getTextContent();
    const items = textContent.items as TextItem[];

    // Gruppiere Text-Items nach Y-Position für Absatz-Erkennung
    const lines: { y: number; text: string }[] = [];
    let currentLine = { y: 0, text: '' };

    items.forEach((item, index) => {
      if ('str' in item) {
        const y = Math.round(item.transform[5]); // Y-Position
        const text = item.str;

        // Neue Zeile wenn Y-Position sich signifikant ändert
        if (index === 0) {
          currentLine = { y, text };
        } else if (Math.abs(y - currentLine.y) > 2) {
          if (currentLine.text.trim()) {
            lines.push(currentLine);
          }
          currentLine = { y, text };
        } else {
          // Gleiche Zeile - füge Text hinzu
          currentLine.text += (item.hasEOL ? '\n' : ' ') + text;
        }
      }
    });

    // Letzte Zeile hinzufügen
    if (currentLine.text.trim()) {
      lines.push(currentLine);
    }

    // Gruppiere Zeilen zu Absätzen (größere Y-Abstände = neue Absätze)
    const paragraphs: string[] = [];
    let currentParagraph = '';
    let lastY = lines[0]?.y || 0;

    lines.forEach((line, index) => {
      const yDiff = index > 0 ? Math.abs(lastY - line.y) : 0;

      // Neuer Absatz wenn Y-Abstand > 20 oder doppelte Zeilenhöhe
      if (yDiff > 20 && currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = line.text;
      } else {
        currentParagraph += (currentParagraph ? ' ' : '') + line.text;
      }

      lastY = line.y;
    });

    // Letzten Absatz hinzufügen
    if (currentParagraph.trim()) {
      paragraphs.push(currentParagraph.trim());
    }

    // Gesamter Seitentext (für Fallback)
    const fullText = items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ');

    return {
      pageNum,
      text: fullText,
      paragraphs: paragraphs.length > 0 ? paragraphs : [fullText],
      rawItems: items,
    };
  }, []);

  /**
   * Extrahiert Text aus allen Seiten des PDFs.
   */
  const extractAllText = useCallback(async () => {
    const pdfDoc = pdfDocumentRef.current;
    if (!pdfDoc || isExtractedRef.current) return;

    setRendererState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const numPages = pdfDoc.numPages;
      const pages: PDFPageContent[] = [];

      // Extrahiere alle Seiten sequentiell
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const pageContent = await extractPageText(page, i);
        pages.push(pageContent);
      }

      isExtractedRef.current = true;

      setRendererState(prev => ({
        ...prev,
        isLoading: false,
        textContent: pages,
        totalPages: numPages,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Extrahieren des PDF-Texts';
      setRendererState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, [pdfDocumentRef, extractPageText]);

  /**
   * Initialisiere Text-Extraktion wenn PDF geladen ist.
   */
  useEffect(() => {
    if (pdfDocumentRef.current && !isExtractedRef.current && state.words.length > 0) {
      extractAllText();
    }
  }, [pdfDocumentRef, state.words.length, extractAllText]);

  /**
   * Aktualisiere totalPages wenn Metadata sich ändert.
   */
  useEffect(() => {
    if (metadata.totalPages) {
      setRendererState(prev => ({ ...prev, totalPages: metadata.totalPages || 0 }));
    }
  }, [metadata.totalPages]);

  /**
   * Finde Seite basierend auf Scroll-Position.
   */
  const updateCurrentPageFromScroll = useCallback(() => {
    if (!containerRef.current || pageRefs.current.size === 0) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const containerTop = container.getBoundingClientRect().top;

    // Finde erste sichtbare Seite
    for (const [pageNum, pageElement] of pageRefs.current.entries()) {
      const rect = pageElement.getBoundingClientRect();
      const relativeTop = rect.top - containerTop;

      if (relativeTop >= 0 && relativeTop < container.clientHeight / 2) {
        setRendererState(prev => ({ ...prev, currentPage: pageNum }));
        return;
      }
    }

    // Fallback: Schätze Seite basierend auf Scroll-Prozent
    const scrollPercent = scrollTop / (container.scrollHeight - container.clientHeight);
    const estimatedPage = Math.ceil(scrollPercent * rendererState.totalPages) || 1;
    setRendererState(prev => ({ ...prev, currentPage: estimatedPage }));
  }, [rendererState.totalPages]);

  /**
   * Navigiert zu einer bestimmten Seite.
   */
  const goToPage = useCallback((pageNum: number) => {
    const validPage = Math.max(1, Math.min(pageNum, rendererState.totalPages));
    const pageElement = pageRefs.current.get(validPage);

    if (pageElement && containerRef.current) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setRendererState(prev => ({ ...prev, currentPage: validPage }));
    }
  }, [rendererState.totalPages]);

  /**
   * Navigiert zur nächsten Seite.
   */
  const nextPage = useCallback(() => {
    goToPage(rendererState.currentPage + 1);
  }, [rendererState.currentPage, goToPage]);

  /**
   * Navigiert zur vorherigen Seite.
   */
  const prevPage = useCallback(() => {
    goToPage(rendererState.currentPage - 1);
  }, [rendererState.currentPage, goToPage]);

  /**
   * Finde Seite basierend auf Wort-Index.
   */
  const getPageForWordIndex = useCallback((wordIndex: number): number => {
    const pageBreaks = metadata.pageBreaks || [0];
    for (let i = pageBreaks.length - 1; i >= 0; i--) {
      if (wordIndex >= pageBreaks[i]) {
        return i + 1;
      }
    }
    return 1;
  }, [metadata.pageBreaks]);

  /**
   * Synchronisiert den Viewer zum aktuellen RSVP Wort-Index.
   */
  const syncToWordIndex = useCallback((wordIndex: number) => {
    const targetPage = getPageForWordIndex(wordIndex);
    
    // Nur zur Seite scrollen, nicht bei jedem Wort
    if (targetPage !== rendererState.currentPage) {
      goToPage(targetPage);
    }

    currentWordIndexRef.current = wordIndex;
  }, [getPageForWordIndex, rendererState.currentPage, goToPage]);

  /**
   * Holt Wort-Indizes aus einer Text-Selektion.
   */
  const getWordIndicesFromSelection = useCallback((): { start: number; end: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;

    const selectedText = selection.toString().trim();
    if (!selectedText) return null;

    const originalContent = state.originalContent;
    const words = state.words;

    if (!originalContent || words.length === 0) return null;

    // Nutze shared content selection utility
    const result = calculateFromContentSelection({
      selectedText,
      originalContent,
      words,
    });

    if (result) {
      console.log('[usePDFTextRenderer] Selection found:', { start: result.start, end: result.end });
    } else {
      console.warn('[usePDFTextRenderer] Selection not found in content');
    }

    return result;
  }, [state.originalContent, state.words]);

  /**
   * Hebt das aktuelle Wort/Chunk im Text hervor.
   * Nutzt data-word-index Attribute für präzises Highlighting.
   * Ruft den optionalen Callback mit der Viewport-Y-Position des markierten Wortes auf.
   */
  const highlightCurrentWord = useCallback((
    wordIndex: number, 
    wordsPerChunk: number = 1,
    onPositionUpdate?: (viewportY: number) => void
  ): void => {
    const container = containerRef.current;
    if (!container) return;

    const words = state.words;
    if (words.length === 0 || wordIndex >= words.length) return;

    // Entferne vorherige Highlights (entferne Klasse statt DOM-Manipulation)
    const existingHighlights = container.querySelectorAll('.rsvp-text-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('rsvp-text-highlight');
    });

    // Highlighte die aktuellen Wörter basierend auf data-word-index
    const endIndex = Math.min(wordIndex + wordsPerChunk, words.length);
    let firstHighlighted: Element | null = null;

    for (let i = wordIndex; i < endIndex; i++) {
      const wordSpan = container.querySelector(`[data-word-index="${i}"]`);
      if (wordSpan) {
        wordSpan.classList.add('rsvp-text-highlight');
        if (!firstHighlighted) {
          firstHighlighted = wordSpan;
        }
      }
    }

    // Scrolle zum ersten hervorgehobenen Wort
    if (firstHighlighted) {
      firstHighlighted.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
      
      // Warte auf Scroll-Abschluss, dann Position berechnen und Callback aufrufen
      if (onPositionUpdate) {
        // Doppeltes RAF um sicherzustellen, dass der Scroll gestartet hat
        const element = firstHighlighted;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const wordRect = element.getBoundingClientRect();
            onPositionUpdate(wordRect.top);
          });
        });
      }
    }
  }, [state.words]);

  /**
   * Entfernt alle Highlights.
   */
  const clearHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const existingHighlights = container.querySelectorAll('.rsvp-text-highlight');
    existingHighlights.forEach(el => {
      el.classList.remove('rsvp-text-highlight');
    });
  }, []);

  /**
   * Registriere Page Ref für Scroll-basierte Navigation.
   */
  const registerPageRef = useCallback((pageNum: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNum, element);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  /**
   * Prüfe ob PDF verfügbar ist.
   */
  const hasPDF = pdfDocumentRef.current !== null;

  return {
    // State
    ...rendererState,
    hasPDF,

    // Refs
    containerRef,
    registerPageRef,

    // Lifecycle
    extractAllText,

    // Navigation
    goToPage,
    nextPage,
    prevPage,
    updateCurrentPageFromScroll,

    // Sync
    syncToWordIndex,
    getPageForWordIndex,

    // Selection
    getWordIndicesFromSelection,

    // Highlighting
    highlightCurrentWord,
    clearHighlights,
  };
}
