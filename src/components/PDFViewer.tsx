import { useRef, useEffect, useState, useCallback } from 'react';
import { usePDFViewer } from '@/hooks/usePDFViewer';
import { useReader } from '@/contexts/ReaderContext';

interface PDFViewerProps {
  className?: string;
  autoSync?: boolean;
  onPageChange?: (page: number) => void;
  onStartReading?: (range?: { start: number; end: number }) => void;
}

/**
 * SelectionState für deterministische Event-Verarbeitung.
 * Verhindert Race Conditions zwischen verschiedenen Event-Handlern.
 */
type SelectionState = 'idle' | 'selecting' | 'selected' | 'processing';

/**
 * Normalisiert Text für Vergleiche (entfernt Sonderzeichen, vereinheitlicht Leerzeichen)
 */
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '') // Entferne Zero-Width Characters
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Findet den besten Match für ein Wort in einem Array mit Fuzzy-Matching.
 * Gibt den Index zurück oder -1 wenn nicht gefunden.
 */
function findBestWordMatch(
  searchWord: string, 
  words: string[], 
  startFrom: number = 0,
  searchBackward: boolean = false
): number {
  const normalizedSearch = normalizeForComparison(searchWord);
  if (!normalizedSearch) return -1;

  const indices = searchBackward 
    ? Array.from({ length: words.length }, (_, i) => words.length - 1 - i).filter(i => i >= startFrom)
    : Array.from({ length: words.length - startFrom }, (_, i) => i + startFrom);

  for (const i of indices) {
    const normalizedWord = normalizeForComparison(words[i]);
    
    // Exakter Match
    if (normalizedWord === normalizedSearch) return i;
    
    // Enthält-Match (für Wörter mit Interpunktion)
    if (normalizedWord.includes(normalizedSearch) || normalizedSearch.includes(normalizedWord)) {
      return i;
    }
    
    // Alphanumerischer Match (ignoriert Interpunktion)
    const alphaSearch = normalizedSearch.replace(/[^\w\u00C0-\u024F]/g, '');
    const alphaWord = normalizedWord.replace(/[^\w\u00C0-\u024F]/g, '');
    if (alphaSearch && alphaWord && (alphaSearch === alphaWord || alphaWord.includes(alphaSearch))) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Berechnet die Wort-Indizes basierend auf der Text-Selektion im PDF-Layer.
 * Verwendet verbessertes DOM-basiertes Mapping mit Fallback-Strategien.
 */
function getWordIndicesFromSelection(
  selection: Selection,
  textLayerDiv: HTMLElement,
  pageWords: string[],
  pageStartIndex: number
): { start: number; end: number } | null {
  try {
    const selectedText = selection.toString();
    const trimmedSelectedText = selectedText.trim();
    if (!trimmedSelectedText || pageWords.length === 0) return null;

    // Hole den gesamten Text aus dem Text-Layer
    const fullLayerText = textLayerDiv.textContent || '';
    if (!fullLayerText.trim()) return null;

    // Strategie 1: Direkte DOM-Position-basierte Berechnung
    const range = selection.getRangeAt(0);
    
    // Berechne Zeichenposition im Text-Layer
    const preSelectionRange = document.createRange();
    preSelectionRange.selectNodeContents(textLayerDiv);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startCharIndex = preSelectionRange.toString().length;
    const endCharIndex = startCharIndex + selectedText.length;

    // Strategie 2: Wort-basierte Suche mit verbessertem Matching
    const selectedWords = trimmedSelectedText.split(/\s+/).filter(w => w.length > 0);
    let startWordIndex = -1;
    let endWordIndex = -1;

    if (selectedWords.length > 0) {
      const firstWord = selectedWords[0];
      const lastWord = selectedWords[selectedWords.length - 1];

      // Suche erstes Wort mit verbessertem Matching
      startWordIndex = findBestWordMatch(firstWord, pageWords, 0, false);
      
      // Suche letztes Wort (rückwärts von Ende)
      if (selectedWords.length === 1) {
        endWordIndex = startWordIndex;
      } else {
        endWordIndex = findBestWordMatch(lastWord, pageWords, startWordIndex, true);
        
        // Falls rückwärts nichts gefunden, vorwärts ab startIndex suchen
        if (endWordIndex === -1 || endWordIndex < startWordIndex) {
          endWordIndex = findBestWordMatch(lastWord, pageWords, startWordIndex, false);
        }
      }

      // Validierung: End muss nach Start kommen
      if (startWordIndex !== -1 && endWordIndex !== -1 && endWordIndex < startWordIndex) {
        // Bei wenigen Wörtern, tausche
        if (selectedWords.length <= 3) {
          [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
        } else {
          // Sonst nutze Verhältnis-basierte Schätzung
          endWordIndex = -1;
        }
      }
    }

    // Strategie 3: Zeichenposition-Verhältnis als Fallback
    if (startWordIndex === -1 || endWordIndex === -1) {
      const normalizedLayerText = normalizeForComparison(fullLayerText);
      const normalizedPageWords = pageWords.map(w => normalizeForComparison(w)).join(' ');
      
      const textRatio = normalizedLayerText.length > 0 
        ? normalizedPageWords.length / normalizedLayerText.length 
        : 1;
      
      // Berechne ungefähre Wort-Position basierend auf Zeichenposition
      const adjustedStartChar = Math.floor(startCharIndex * textRatio);
      const adjustedEndChar = Math.floor(endCharIndex * textRatio);

      let charCount = 0;
      for (let i = 0; i < pageWords.length; i++) {
        const wordStart = charCount;
        const wordEnd = charCount + pageWords[i].length;

        if (startWordIndex === -1 && adjustedStartChar <= wordEnd) {
          startWordIndex = i;
        }
        if (adjustedEndChar >= wordStart) {
          endWordIndex = i;
        }

        charCount = wordEnd + 1; // +1 für Leerzeichen
      }
    }

    // Strategie 4: Kontextbasierte Verfeinerung
    // Wenn die Selektion mitten im Wort beginnt/endet, erweitere auf ganze Wörter
    if (startWordIndex !== -1 && endWordIndex !== -1) {
      // Prüfe ob das erste selektierte Wort am Anfang eines pageWords beginnt
      const firstSelectedNorm = normalizeForComparison(selectedWords[0] || '');
      const firstPageWordNorm = normalizeForComparison(pageWords[startWordIndex] || '');
      
      // Wenn pageWord mit mehr beginnt als selektiert, ist es korrekt
      // Wenn selektiertes Wort nicht am Anfang von pageWord ist, gehe eins zurück
      if (startWordIndex > 0 && !firstPageWordNorm.startsWith(firstSelectedNorm.substring(0, 3))) {
        // Prüfe vorheriges Wort
        const prevWordNorm = normalizeForComparison(pageWords[startWordIndex - 1] || '');
        if (prevWordNorm.includes(firstSelectedNorm.substring(0, 3))) {
          startWordIndex--;
        }
      }
    }

    // Finale Validierung
    if (startWordIndex === -1) startWordIndex = 0;
    if (endWordIndex === -1) endWordIndex = pageWords.length - 1;
    if (endWordIndex < startWordIndex) {
      [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
    }
    
    // Begrenze auf gültige Indizes
    startWordIndex = Math.max(0, Math.min(startWordIndex, pageWords.length - 1));
    endWordIndex = Math.max(0, Math.min(endWordIndex, pageWords.length - 1));

    return {
      start: pageStartIndex + startWordIndex,
      end: pageStartIndex + endWordIndex
    };
  } catch (error) {
    console.error('Error calculating word indices:', error);
    return null;
  }
}

/**
 * PDF-Viewer Komponente mit visueller PDF-Darstellung.
 * Unterstützt Navigation, Zoom und Text-Selektion für Lesebereich-Festlegung.
 */
export function PDFViewer({ 
  className = '', 
  autoSync = true, 
  onPageChange,
  onStartReading 
}: PDFViewerProps) {
  const { state, dispatch } = useReader();
  const { 
    currentPage, 
    totalPages, 
    scale, 
    isLoading, 
    error,
    hasPDF,
    renderPage,
    goToPage,
    nextPage,
    prevPage,
    setScale,
    zoomIn,
    zoomOut,
    fitToWidth,
    syncToCurrentWord,
    getWordRangeForPage,
  } = usePDFViewer();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Konsolidierte Refs für robuste Event-Verwaltung
  const selectionStateRef = useRef<SelectionState>('idle');
  const pendingTimeoutsRef = useRef<number[]>([]);
  const lastProcessedSelectionRef = useRef<string>('');
  const isMouseDownRef = useRef<boolean>(false);
  
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedWordRange, setSelectedWordRange] = useState<{ start: number; end: number } | null>(null);

  // Hilfsfunktion: Alle pending Timeouts clearen
  const clearAllTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach(id => clearTimeout(id));
    pendingTimeoutsRef.current = [];
  }, []);

  // Hilfsfunktion: Timeout mit Tracking erstellen
  const createTrackedTimeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      // Entferne ID aus der Liste nach Ausführung
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter(t => t !== id);
      callback();
    }, delay);
    pendingTimeoutsRef.current.push(id);
    return id;
  }, []);

  // Adjust menu position to stay within viewport
  const adjustMenuPosition = useCallback((x: number, y: number) => {
    const menuWidth = 220;
    const menuHeight = 220;
    
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);
    
    return {
      x: Math.max(10, adjustedX),
      y: Math.max(10, adjustedY)
    };
  }, []);

  // Core text selection handler - processes selection and shows context menu
  const processTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return false;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return false;
    }

    // Check if selection is within our text layer
    const textLayer = textLayerRef.current;
    if (!textLayer) return false;
    
    try {
      const range = selection.getRangeAt(0);
      if (!textLayer.contains(range.commonAncestorContainer)) {
        return false;
      }
    } catch {
      return false;
    }

    // Get word range for current page
    const wordRange = getWordRangeForPage(currentPage);
    const pageWords = state.words.slice(wordRange.start, wordRange.end + 1);

    // Use improved word index calculation
    let calculatedRange: { start: number; end: number } | null = null;
    
    if (textLayer) {
      calculatedRange = getWordIndicesFromSelection(
        selection,
        textLayer,
        pageWords,
        wordRange.start
      );
    }

    // Fallback to simple matching if calculation fails
    if (!calculatedRange) {
      const firstSelectedWord = selectedText.split(/\s+/)[0];
      const lastSelectedWord = selectedText.split(/\s+/).pop() || firstSelectedWord;
      
      const startOffset = pageWords.findIndex(w => w.includes(firstSelectedWord));
      const endOffset = pageWords.findIndex(w => w.includes(lastSelectedWord));
      
      if (startOffset !== -1) {
        calculatedRange = {
          start: wordRange.start + startOffset,
          end: endOffset !== -1 ? wordRange.start + Math.max(startOffset, endOffset) : wordRange.start + startOffset
        };
      }
    }

    if (calculatedRange) {
      setSelectedWordRange(calculatedRange);
      
      // Position menu near the end of selection
      const selectionRange = selection.getRangeAt(0);
      const rect = selectionRange.getBoundingClientRect();
      const position = adjustMenuPosition(rect.right + 5, rect.bottom + 5);
      
      setContextMenuPosition(position);
      setShowContextMenu(true);
      return true;
    }
    
    return false;
  }, [currentPage, getWordRangeForPage, state.words, adjustMenuPosition]);

  // Konsolidierter Event-Handler mit State-Machine
  // Verhindert Race Conditions zwischen selectionchange und mouseup Events
  useEffect(() => {
    if (!hasPDF) return;

    const handleSelectionChange = () => {
      // Clear alle pending timeouts um Race Conditions zu vermeiden
      clearAllTimeouts();

      const selection = window.getSelection();
      
      // Wenn keine Selektion oder collapsed, verstecke Menü nach kurzer Verzögerung
      if (!selection || selection.isCollapsed) {
        // Ignoriere während mousedown (User selektiert noch)
        if (isMouseDownRef.current) {
          selectionStateRef.current = 'selecting';
          return;
        }
        
        createTrackedTimeout(() => {
          // Double-check dass Selektion immer noch leer ist
          const currentSel = window.getSelection();
          if (!currentSel || currentSel.isCollapsed) {
            setShowContextMenu(false);
            selectionStateRef.current = 'idle';
            lastProcessedSelectionRef.current = '';
          }
        }, 100);
        return;
      }

      // Check ob Selektion in unserem Text-Layer ist
      const textLayer = textLayerRef.current;
      if (!textLayer) return;

      try {
        const range = selection.getRangeAt(0);
        if (!textLayer.contains(range.commonAncestorContainer)) {
          return;
        }
      } catch {
        return;
      }

      // Markiere als selektierend
      selectionStateRef.current = 'selecting';

      // Wenn Maus noch gedrückt, warte auf mouseup
      if (isMouseDownRef.current) {
        return;
      }

      // Verarbeite Selektion mit requestAnimationFrame für smooth Updates
      createTrackedTimeout(() => {
        const currentSelection = window.getSelection()?.toString().trim() || '';
        
        // Verhindere Doppelverarbeitung derselben Selektion
        if (currentSelection === lastProcessedSelectionRef.current && showContextMenu) {
          return;
        }
        
        if (selectionStateRef.current !== 'processing') {
          selectionStateRef.current = 'processing';
          const success = processTextSelection();
          selectionStateRef.current = success ? 'selected' : 'idle';
          if (success) {
            lastProcessedSelectionRef.current = currentSelection;
          }
        }
      }, 50);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const textLayer = textLayerRef.current;
      if (textLayer && textLayer.contains(e.target as Node)) {
        isMouseDownRef.current = true;
        selectionStateRef.current = 'selecting';
      }
    };

    const handleMouseUp = () => {
      if (!isMouseDownRef.current) return;
      
      isMouseDownRef.current = false;
      
      // Gib dem Browser einen Moment um die Selektion zu finalisieren
      // Nutze requestAnimationFrame für bessere Timing-Präzision
      requestAnimationFrame(() => {
        createTrackedTimeout(() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selectionStateRef.current === 'selecting') {
            const currentSelection = selection.toString().trim();
            
            // Verhindere Doppelverarbeitung
            if (currentSelection !== lastProcessedSelectionRef.current) {
              selectionStateRef.current = 'processing';
              const success = processTextSelection();
              selectionStateRef.current = success ? 'selected' : 'idle';
              if (success) {
                lastProcessedSelectionRef.current = currentSelection;
              }
            }
          }
        }, 10);
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      clearAllTimeouts();
    };
  }, [hasPDF, processTextSelection, clearAllTimeouts, createTrackedTimeout, showContextMenu]);

  // Render current page when page or scale changes
  useEffect(() => {
    if (canvasRef.current && hasPDF) {
      renderPage(currentPage, canvasRef.current, textLayerRef.current);
    }
  }, [currentPage, scale, hasPDF, renderPage]);

  // Update page input when current page changes
  useEffect(() => {
    setPageInput(String(currentPage));
    onPageChange?.(currentPage);
  }, [currentPage, onPageChange]);

  // Auto-sync with current reading position
  useEffect(() => {
    if (autoSync && state.isPlaying) {
      syncToCurrentWord();
    }
  }, [autoSync, state.currentIndex, state.isPlaying, syncToCurrentWord]);

  // Fit to width on initial load
  useEffect(() => {
    if (containerRef.current && hasPDF) {
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width) {
          fitToWidth(width);
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [hasPDF, fitToWidth]);

  // Handle page input change
  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  }, []);

  const handlePageInputSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      goToPage(pageNum);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, totalPages, currentPage, goToPage]);

  // Context menu actions
  const handleSetStart = useCallback(() => {
    if (selectedWordRange) {
      dispatch({ type: 'SET_START_INDEX', payload: selectedWordRange.start });
      dispatch({ type: 'SET_INDEX', payload: selectedWordRange.start });
    }
    setShowContextMenu(false);
    setSelectedWordRange(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedWordRange, dispatch]);

  const handleSetEnd = useCallback(() => {
    if (selectedWordRange) {
      dispatch({ type: 'SET_END_INDEX', payload: selectedWordRange.end });
    }
    setShowContextMenu(false);
    setSelectedWordRange(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedWordRange, dispatch]);

  const handleSetRange = useCallback(() => {
    if (selectedWordRange) {
      dispatch({ 
        type: 'SET_READING_RANGE', 
        payload: { 
          startIndex: selectedWordRange.start, 
          endIndex: selectedWordRange.end 
        } 
      });
    }
    setShowContextMenu(false);
    setSelectedWordRange(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedWordRange, dispatch]);

  // Start reading the selection in RSVP full view
  const handleReadSelectionInRSVP = useCallback(() => {
    if (selectedWordRange) {
      // Set the reading range to the selection
      dispatch({ 
        type: 'SET_READING_RANGE', 
        payload: { 
          startIndex: selectedWordRange.start, 
          endIndex: selectedWordRange.end 
        } 
      });
      // Set current position to start of selection
      dispatch({ type: 'SET_INDEX', payload: selectedWordRange.start });
      
      // Notify parent to switch to RSVP view and start
      if (onStartReading) {
        onStartReading(selectedWordRange);
      }
    }
    setShowContextMenu(false);
    setSelectedWordRange(null);
    window.getSelection()?.removeAllRanges();
  }, [selectedWordRange, dispatch, onStartReading]);

  const handleStartReading = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW_MODE', payload: false });
    dispatch({ type: 'PLAY' });
  }, [dispatch]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickAway = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickAway);
      return () => document.removeEventListener('click', handleClickAway);
    }
  }, [showContextMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPage, nextPage, zoomIn, zoomOut]);

  if (!hasPDF) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">Kein PDF geladen</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Vorherige Seite"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              className="w-12 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 
                         rounded bg-white dark:bg-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">/ {totalPages}</span>
          </form>
          
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Nächste Seite"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            aria-label="Verkleinern"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <select
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 
                       rounded bg-white dark:bg-gray-700"
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
          
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            aria-label="Vergrößern"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Start Reading Button */}
        <button
          onClick={handleStartReading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm 
                     font-medium rounded transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Lesen starten
        </button>
      </div>

      {/* Reading Range Info */}
      {(state.startIndex > 0 || state.endIndex !== null) && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 
                        border-b border-blue-200 dark:border-blue-800 text-sm">
          <span className="text-blue-700 dark:text-blue-300">
            Lesebereich: Wort {state.startIndex + 1} bis {state.endIndex !== null ? state.endIndex + 1 : state.words.length}
          </span>
          <button
            onClick={() => dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: 0, endIndex: null } })}
            className="ml-auto text-blue-600 dark:text-blue-400 hover:underline"
          >
            Zurücksetzen
          </button>
        </div>
      )}

      {/* PDF Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900"
      >
        <div className="flex justify-center p-4">
          <div className="relative shadow-lg">
            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
              </div>
            )}
            
            {/* Error Display */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 z-10">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            
            {/* PDF Canvas */}
            <canvas 
              ref={canvasRef}
              className="block bg-white"
            />
            
            {/* Text Layer for Selection */}
            <div 
              ref={textLayerRef}
              className="text-layer"
            />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedWordRange && (
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl 
                     border border-gray-200 dark:border-gray-700 py-2 min-w-52"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-b 
                          border-gray-200 dark:border-gray-700 mb-1">
            Wörter {selectedWordRange.start + 1} - {selectedWordRange.end + 1}
          </div>
          
          {/* Primary action - Start RSVP with selection */}
          <button
            onClick={handleReadSelectionInRSVP}
            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 
                       dark:hover:bg-blue-900/30 flex items-center gap-2 font-medium
                       text-blue-700 dark:text-blue-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Auswahl im RSVP starten
          </button>
          
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          
          <button
            onClick={handleSetStart}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            Von hier starten
          </button>
          <button
            onClick={handleSetEnd}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Hier enden
          </button>
          <button
            onClick={handleSetRange}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Lesebereich setzen
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="flex-shrink-0 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-t 
                      border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Markiere Text auf der PDF-Seite, um Startpunkt oder Endpunkt festzulegen. 
        Tastenkürzel: ← → Navigation, +/- Zoom
      </div>
    </div>
  );
}
