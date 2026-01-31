import { useState, useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { tokenizeTextWithStructure, cleanText } from '@/utils/textProcessor';
import * as pdfjsLib from 'pdfjs-dist';

// Worker konfigurieren - Chrome Extension kompatibel
// Vite's ?url Import-Suffix gibt die korrekte URL für den Worker zurück
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Unterdrücke bekannte harmlose PDF.js Warnungen (TrueType Font Warnungen)
const originalConsoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (typeof message === 'string' && message.includes('TT: undefined function')) {
    return; // Ignoriere TrueType Font Warnungen
  }
  originalConsoleWarn.apply(console, args);
};

interface PDFParserState {
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  pageCount: number;
  currentPage: number;
}

/**
 * Hook für PDF-Parsing mit PDF.js.
 * Extrahiert Text und Seitenumbruch-Indices für die Preview.
 * Behält PDF-Dokument-Referenz für den PDF-Viewer.
 */
export function usePDFParser() {
  const { dispatch, pdfDocumentRef } = useReader();
  const [state, setState] = useState<PDFParserState>({
    isLoading: false,
    error: null,
    fileName: null,
    pageCount: 0,
    currentPage: 0,
  });

  const loadPDF = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, fileName: file.name }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setState(prev => ({ ...prev, pageCount: pdf.numPages }));

      // Extrahiere Text von allen Seiten und tracke Seitenumbrüche
      const textParts: string[] = [];
      const pageBreaks: number[] = [0]; // Index 0 = Seite 1
      let totalWordCount = 0;
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setState(prev => ({ ...prev, currentPage: pageNum }));
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ');
        
        const cleanedPageText = cleanText(pageText);
        const { words: pageWords } = tokenizeTextWithStructure(cleanedPageText);
        
        textParts.push(cleanedPageText);
        totalWordCount += pageWords.length;
        
        // Speichere Startindex der nächsten Seite (außer bei letzter Seite)
        if (pageNum < pdf.numPages) {
          pageBreaks.push(totalWordCount);
        }
      }

      const fullText = textParts.join(' ');
      const { words, sentenceBreaks, paragraphBreaks } = tokenizeTextWithStructure(fullText);

      if (words.length === 0) {
        throw new Error('Keine lesbaren Wörter im PDF gefunden.');
      }

      // Speichere PDF-Dokument-Referenz für den Viewer
      pdfDocumentRef.current = pdf;

      // Nutze SET_CONTENT für erweiterte Metadaten
      dispatch({ 
        type: 'SET_CONTENT', 
        payload: {
          words,
          originalContent: fullText,
          title: file.name.replace(/\.pdf$/i, ''),
          sourceType: 'pdf',
          pageBreaks,
          totalPages: pdf.numPages,
          sentenceBreaks,
          paragraphBreaks,
        }
      });
      
      setState(prev => ({ ...prev, isLoading: false }));

      return { success: true, wordCount: words.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden des PDFs';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [dispatch]);

  const reset = useCallback(() => {
    // Bereinige PDF-Dokument
    if (pdfDocumentRef.current) {
      pdfDocumentRef.current.destroy();
      pdfDocumentRef.current = null;
    }
    
    setState({
      isLoading: false,
      error: null,
      fileName: null,
      pageCount: 0,
      currentPage: 0,
    });
    dispatch({ type: 'RESET' });
  }, [dispatch, pdfDocumentRef]);

  return {
    ...state,
    loadPDF,
    reset,
  };
}
