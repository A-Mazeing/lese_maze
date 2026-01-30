import { useState, useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { tokenizeText, extractTextFromHTML } from '@/utils/textProcessor';

interface PageContentState {
  isLoading: boolean;
  error: string | null;
  title: string | null;
  url: string | null;
  originalContent: string | null;
}

interface StoredPageContent {
  content: string;
  title: string;
  url: string;
  timestamp: number;
}

/**
 * Hook zum Extrahieren von Text aus der aktuellen Browser-Seite.
 * Liest Inhalt aus chrome.storage.session (gesetzt vom Service Worker).
 */
export function usePageContent() {
  const { dispatch } = useReader();
  const [state, setState] = useState<PageContentState>({
    isLoading: false,
    error: null,
    title: null,
    url: null,
    originalContent: null,
  });

  /**
   * Lädt den Seiteninhalt aus chrome.storage.session.
   * Der Service Worker speichert den Inhalt dort BEVOR der Reader-Tab geöffnet wird.
   */
  const loadCurrentPage = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Prüfe ob wir im Extension-Kontext sind
      if (typeof chrome !== 'undefined' && chrome.storage?.session) {
        // Lese aus session storage (gesetzt vom Service Worker)
        const result = await chrome.storage.session.get('pageContent');
        const pageContent = result.pageContent as StoredPageContent | undefined;
        
        if (pageContent && pageContent.content) {
          // Prüfe ob der Inhalt nicht zu alt ist (max 5 Minuten)
          const maxAge = 5 * 60 * 1000; // 5 Minuten
          if (Date.now() - pageContent.timestamp > maxAge) {
            throw new Error('Seiteninhalt ist abgelaufen. Bitte erneut laden.');
          }

          const text = extractTextFromHTML(pageContent.content);
          const words = tokenizeText(text);

          if (words.length === 0) {
            throw new Error('Keine lesbaren Wörter auf der Seite gefunden.');
          }

          // Speichere Original-Content für Preview
          dispatch({ 
            type: 'SET_CONTENT', 
            payload: { 
              words, 
              originalContent: text,
              title: pageContent.title || 'Aktuelle Seite',
              sourceType: 'page'
            } 
          });
          
          setState({
            isLoading: false,
            error: null,
            title: pageContent.title || 'Aktuelle Seite',
            url: pageContent.url,
            originalContent: text,
          });

          // Lösche den session storage nach dem Laden
          await chrome.storage.session.remove('pageContent');

          return { success: true, wordCount: words.length };
        }

        throw new Error('Kein Seiteninhalt gefunden. Bitte nutze "Read Current Page" vom Popup.');
      } else {
        // Fallback für Entwicklung ohne Extension-Kontext
        const text = document.body.innerText;
        const words = tokenizeText(text);
        
        dispatch({ 
          type: 'SET_CONTENT', 
          payload: { 
            words, 
            originalContent: text,
            title: document.title,
            sourceType: 'page'
          } 
        });
        
        setState({
          isLoading: false,
          error: null,
          title: document.title,
          url: window.location.href,
          originalContent: text,
        });

        return { success: true, wordCount: words.length };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden der Seite';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [dispatch]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      title: null,
      url: null,
      originalContent: null,
    });
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return {
    ...state,
    loadCurrentPage,
    reset,
  };
}
