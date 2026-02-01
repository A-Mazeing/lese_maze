import { useState, useCallback, useRef, useEffect } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { useTheme } from '@/contexts/ThemeContext';
import { findNearestCheckpoint, estimateWordIndexFromCFI } from '@/utils/cfiMapper';
import { calculateFromContentSelection, splitIntoWords } from '@/utils/selection';
import type { Rendition, Location } from 'epubjs';
import type { EPubViewerState } from '@/types';

/**
 * Hook für ePub-Viewer Funktionalität.
 * Verwaltet Rendering, Navigation und Synchronisation mit RSVP.
 */
export function useEPubViewer() {
  const { state, epubBookRef, cfiCheckpoints } = useReader();
  const { resolvedTheme } = useTheme();
  
  const [viewerState, setViewerState] = useState<EPubViewerState>({
    currentLocation: null,
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    error: null,
  });
  
  // State für Text-Selektion aus dem epub.js iframe
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  
  const renditionRef = useRef<Rendition | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Initialisiert die epub.js Rendition.
   */
  const initRendition = useCallback((container: HTMLElement) => {
    const book = epubBookRef.current;
    if (!book || isInitializedRef.current) return;
    
    containerRef.current = container;
    setViewerState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Zerstöre vorhandene Rendition
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      
      // Erstelle neue Rendition
      const rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        minSpreadWidth: 9999, // Verhindert Zwei-Seiten-Ansicht
      });
      
      renditionRef.current = rendition;
      isInitializedRef.current = true;
      
      // Event Listeners
      rendition.on('relocated', (location: unknown) => {
        handleRelocated(location as Location);
      });
      
      rendition.on('rendered', () => {
        setViewerState(prev => ({ ...prev, isLoading: false }));
      });
      
      // Event für Text-Selektion im iframe
      // @ts-ignore - epub.js event types sind unvollständig
      rendition.on('selected', (_cfiRange: string, contents: unknown) => {
        try {
          // @ts-ignore - epub.js types sind unvollständig
          const doc = contents?.document || contents?.window?.document;
          if (doc) {
            const selection = doc.getSelection?.();
            const text = selection?.toString()?.trim() || '';
            
            if (text) {
              setSelectedText(text);
              // Position für Kontextmenü (Mitte des Containers)
              if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setSelectionPosition({
                  x: rect.left + rect.width / 2,
                  y: rect.top + 100,
                });
              }
            }
          }
        } catch (err) {
          console.warn('[useEPubViewer] Error handling selection:', err);
        }
      });
      
      // Generiere Locations für Seitennavigation
      book.locations.generate(1024).then(() => {
        const total = book.locations.length();
        setViewerState(prev => ({ ...prev, totalPages: total || 1 }));
      });
      
      // Zeige erste Seite
      rendition.display();
      
      // Initiales Theming
      applyTheme(resolvedTheme === 'dark');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Initialisieren des ePub-Viewers';
      setViewerState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
    }
  }, [epubBookRef, resolvedTheme]);

  /**
   * Handler für Location-Änderungen.
   */
  const handleRelocated = useCallback((location: Location) => {
    const cfi = location.start?.cfi || null;
    const book = epubBookRef.current;
    
    let currentPage = 1;
    if (book && book.locations && cfi) {
      const locationIndex = book.locations.locationFromCfi(cfi);
      currentPage = typeof locationIndex === 'number' ? locationIndex + 1 : 1;
    }
    
    setViewerState(prev => ({
      ...prev,
      currentLocation: cfi,
      currentPage: Math.max(1, currentPage),
    }));
  }, [epubBookRef]);

  /**
   * Navigiert zur nächsten Seite.
   */
  const nextPage = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  /**
   * Navigiert zur vorherigen Seite.
   */
  const prevPage = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  /**
   * Navigiert zu einer bestimmten CFI-Position.
   */
  const goToLocation = useCallback((cfi: string) => {
    if (cfi && renditionRef.current) {
      renditionRef.current.display(cfi);
    }
  }, []);

  /**
   * Navigiert zu einem bestimmten Prozentwert (0-1).
   */
  const goToPercentage = useCallback((percentage: number) => {
    const book = epubBookRef.current;
    if (!book || !book.locations || !renditionRef.current) return;
    
    const cfi = book.locations.cfiFromPercentage(percentage);
    if (cfi) {
      renditionRef.current.display(cfi);
    }
  }, [epubBookRef]);

  /**
   * Navigiert zu einem bestimmten Kapitel.
   * Verwendet primär den Spine-Index, da CFI-basierte Navigation oft fehlschlägt.
   */
  const goToChapter = useCallback((chapterIndex: number) => {
    const rendition = renditionRef.current;
    const book = epubBookRef.current;
    
    if (!rendition || !book) {
      console.warn('[useEPubViewer] goToChapter: Rendition or book not initialized');
      return;
    }
    
    // Primäre Methode: Navigiere über Spine-Index
    // Dies ist zuverlässiger als CFI oder href
    try {
      // @ts-ignore - epub.js types sind unvollständig
      const spine = book.spine;
      if (spine?.items && spine.items[chapterIndex]) {
        const spineItem = spine.items[chapterIndex];
        
        // Methode 1: Verwende section() mit Index
        // epub.js Rendition unterstützt display() mit spine index
        console.log('[useEPubViewer] goToChapter via spine index:', chapterIndex);
        
        // @ts-ignore - epub.js erlaubt auch Spine-Item-Index als number
        rendition.display(chapterIndex).catch((err1: Error) => {
          console.warn('[useEPubViewer] Spine index navigation failed:', err1.message);
          
          // Methode 2: Verwende href/url der Section
          const href = spineItem.href || spineItem.url;
          if (href) {
            console.log('[useEPubViewer] Trying href navigation:', href);
            rendition.display(href).catch((err2: Error) => {
              console.warn('[useEPubViewer] Href navigation failed:', err2.message);
              
              // Methode 3: Verwende canonical path
              // @ts-ignore
              const canonical = spineItem.canonical;
              if (canonical) {
                console.log('[useEPubViewer] Trying canonical navigation:', canonical);
                rendition.display(canonical).catch((err3: Error) => {
                  console.error('[useEPubViewer] All navigation methods failed:', err3.message);
                });
              }
            });
          }
        });
      } else {
        console.warn('[useEPubViewer] Invalid chapter index:', chapterIndex);
      }
    } catch (error) {
      console.error('[useEPubViewer] goToChapter error:', error);
    }
  }, [epubBookRef]);

  /**
   * Synchronisiert den Viewer zum aktuellen RSVP Wort-Index.
   * Verwendet Kapitel-basierte Navigation, da CFI oft unzuverlässig ist.
   */
  const syncToWordIndex = useCallback((wordIndex: number) => {
    // Finde das Kapitel, das diesen Wort-Index enthält
    const checkpoint = findNearestCheckpoint(wordIndex, cfiCheckpoints);
    if (checkpoint && typeof checkpoint.chapterIndex === 'number') {
      // Navigiere zum Kapitel statt zum CFI
      goToChapter(checkpoint.chapterIndex);
    }
  }, [cfiCheckpoints, goToChapter]);

  /**
   * Konvertiert CFI zu Wort-Index.
   */
  const cfiToWordIndex = useCallback((cfi: string): number => {
    return estimateWordIndexFromCFI(cfi, cfiCheckpoints);
  }, [cfiCheckpoints]);

  /**
   * Wendet Theme auf die Rendition an.
   */
  const applyTheme = useCallback((isDark: boolean) => {
    if (!renditionRef.current) return;
    
    const themes = renditionRef.current.themes;
    
    if (isDark) {
      themes.default({
        'body': {
          'color': '#e5e7eb !important',
          'background-color': '#1f2937 !important',
        },
        'p, div, span, h1, h2, h3, h4, h5, h6': {
          'color': '#e5e7eb !important',
        },
        'a': {
          'color': '#60a5fa !important',
        },
      });
    } else {
      themes.default({
        'body': {
          'color': '#1f2937 !important',
          'background-color': '#ffffff !important',
        },
        'p, div, span, h1, h2, h3, h4, h5, h6': {
          'color': '#1f2937 !important',
        },
        'a': {
          'color': '#3b82f6 !important',
        },
      });
    }
  }, []);

  /**
   * Holt Wort-Indizes aus einer Text-Selektion.
   * Sucht den ausgewählten Text im originalContent für genauere Position.
   */
  const getWordIndicesFromSelection = useCallback((): { start: number; end: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;
    
    const selectedTextStr = selection.toString().trim();
    if (!selectedTextStr) return null;
    
    const originalContent = state.originalContent;
    const words = state.words;
    
    if (!originalContent || words.length === 0) {
      // Fallback: Use CFI-based method
      const currentCfi = viewerState.currentLocation;
      if (!currentCfi) return null;
      
      const startWordIndex = cfiToWordIndex(currentCfi);
      const selectedWords = splitIntoWords(selectedTextStr);
      const endWordIndex = startWordIndex + selectedWords.length - 1;
      
      return {
        start: startWordIndex,
        end: Math.min(endWordIndex, words.length - 1),
      };
    }
    
    // Use shared content selection utility
    const result = calculateFromContentSelection({
      selectedText: selectedTextStr,
      originalContent,
      words,
      fallbackStartIndex: cfiToWordIndex(viewerState.currentLocation || ''),
    });
    
    if (result) {
      console.log('[useEPubViewer] Selection found:', { startIndex: result.start, endIndex: result.end });
    }
    
    return result;
  }, [cfiToWordIndex, viewerState.currentLocation, state.originalContent, state.words]);

  /**
   * Holt Wort-Indizes aus der epub.js Selektion (via 'selected' Event).
   * Nutzt den gespeicherten selectedText anstatt window.getSelection().
   */
  const getWordIndicesFromEpubSelection = useCallback((): { start: number; end: number } | null => {
    if (!selectedText) return null;
    
    const originalContent = state.originalContent;
    const words = state.words;
    
    if (!originalContent || words.length === 0) return null;
    
    // Use shared content selection utility
    const result = calculateFromContentSelection({
      selectedText,
      originalContent,
      words,
    });
    
    if (result) {
      console.log('[useEPubViewer] Epub selection found:', { start: result.start, end: result.end });
    } else {
      console.warn('[useEPubViewer] Epub selection not found in content');
    }
    
    return result;
  }, [selectedText, state.originalContent, state.words]);

  /**
   * Löscht die gespeicherte Selektion.
   */
  const clearSelection = useCallback(() => {
    setSelectedText(null);
    setSelectionPosition(null);
  }, []);

  /**
   * Hebt das aktuelle Wort/Chunk im ePub iframe hervor.
   * Verwendet Text-Suche und CSS-Injection für das Highlighting.
   */
  const highlightCurrentWord = useCallback((wordIndex: number, wordsPerChunk: number = 1) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    const words = state.words;
    if (words.length === 0 || wordIndex >= words.length) return;
    
    // Hole die Wörter für den aktuellen Chunk
    const endIndex = Math.min(wordIndex + wordsPerChunk, words.length);
    const chunkWords = words.slice(wordIndex, endIndex);
    const searchText = chunkWords.join(' ');
    
    if (!searchText) return;
    
    try {
      // Hole alle Contents (iframe-Dokumente)
      // @ts-ignore - epub.js types sind unvollständig
      const contents = rendition.getContents();
      
      contents.forEach((content: unknown) => {
        // @ts-ignore - epub.js types sind unvollständig
        const doc = content?.document as Document | undefined;
        if (!doc) return;
        
        // Entferne vorherige Highlights
        const existingHighlights = doc.querySelectorAll('.rsvp-highlight');
        existingHighlights.forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            // Ersetze das Highlight-Element mit dem ursprünglichen Text
            const textNode = doc.createTextNode(el.textContent || '');
            parent.replaceChild(textNode, el);
            // Normalisiere den Parent um zusammenhängende Textknoten zu vereinen
            parent.normalize();
          }
        });
        
        // Injiziere CSS für Highlight wenn nicht vorhanden
        if (!doc.getElementById('rsvp-highlight-styles')) {
          const style = doc.createElement('style');
          style.id = 'rsvp-highlight-styles';
          style.textContent = `
            .rsvp-highlight {
              background-color: #fef08a !important;
              color: #1f2937 !important;
              border-radius: 2px;
              padding: 0 2px;
              box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.5);
            }
            @media (prefers-color-scheme: dark) {
              .rsvp-highlight {
                background-color: #854d0e !important;
                color: #fef9c3 !important;
              }
            }
          `;
          doc.head?.appendChild(style);
        }
        
        // Suche nach dem Text im Dokument
        const body = doc.body;
        if (!body) return;
        
        // TreeWalker um durch alle Textknoten zu iterieren
        const walker = doc.createTreeWalker(
          body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node: Text | null;
        let found = false;
        
        while ((node = walker.nextNode() as Text | null) && !found) {
          const nodeText = node.textContent || '';
          
          // Suche case-insensitive nach dem Text
          const lowerNodeText = nodeText.toLowerCase();
          const lowerSearchText = searchText.toLowerCase();
          const index = lowerNodeText.indexOf(lowerSearchText);
          
          if (index !== -1) {
            // Gefunden! Teile den Textknoten und füge Highlight ein
            const before = nodeText.substring(0, index);
            const match = nodeText.substring(index, index + searchText.length);
            const after = nodeText.substring(index + searchText.length);
            
            const parent = node.parentNode;
            if (!parent) continue;
            
            // Erstelle die neuen Elemente
            const fragment = doc.createDocumentFragment();
            
            if (before) {
              fragment.appendChild(doc.createTextNode(before));
            }
            
            const highlightSpan = doc.createElement('span');
            highlightSpan.className = 'rsvp-highlight';
            highlightSpan.textContent = match;
            fragment.appendChild(highlightSpan);
            
            if (after) {
              fragment.appendChild(doc.createTextNode(after));
            }
            
            // Ersetze den originalen Textknoten
            parent.replaceChild(fragment, node);
            
            // Scrolle zum Highlight
            highlightSpan.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            
            found = true;
          }
        }
      });
    } catch (err) {
      console.warn('[useEPubViewer] Error highlighting word:', err);
    }
  }, [state.words]);

  /**
   * Entfernt alle Highlights aus dem ePub iframe.
   */
  const clearHighlights = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    try {
      // @ts-ignore - epub.js types sind unvollständig
      const contents = rendition.getContents();
      
      contents.forEach((content: unknown) => {
        // @ts-ignore - epub.js types sind unvollständig
        const doc = content?.document as Document | undefined;
        if (!doc) return;
        
        const existingHighlights = doc.querySelectorAll('.rsvp-highlight');
        existingHighlights.forEach(el => {
          const parent = el.parentNode;
          if (parent) {
            const textNode = doc.createTextNode(el.textContent || '');
            parent.replaceChild(textNode, el);
            parent.normalize();
          }
        });
      });
    } catch (err) {
      console.warn('[useEPubViewer] Error clearing highlights:', err);
    }
  }, []);

  /**
   * Bereinigt die Rendition.
   */
  const cleanup = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.destroy();
      renditionRef.current = null;
    }
    isInitializedRef.current = false;
    containerRef.current = null;
  }, []);

  // Theme-Änderungen anwenden
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(resolvedTheme === 'dark');
    }
  }, [resolvedTheme, applyTheme]);

  // Cleanup beim Unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    ...viewerState,
    rendition: renditionRef.current,
    
    // Lifecycle
    initRendition,
    cleanup,
    
    // Navigation
    nextPage,
    prevPage,
    goToLocation,
    goToPercentage,
    goToChapter,
    
    // Sync
    syncToWordIndex,
    cfiToWordIndex,
    
    // Theming
    applyTheme,
    
    // Selection
    getWordIndicesFromSelection,
    getWordIndicesFromEpubSelection,
    selectedText,
    selectionPosition,
    clearSelection,
    
    // Highlighting
    highlightCurrentWord,
    clearHighlights,
  };
}
