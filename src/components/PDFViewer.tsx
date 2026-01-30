import { useRef, useEffect, useState, useCallback } from 'react';
import { usePDFViewer } from '@/hooks/usePDFViewer';
import { useReader } from '@/contexts/ReaderContext';

interface PDFViewerProps {
  className?: string;
  autoSync?: boolean;
  onPageChange?: (page: number) => void;
}

/**
 * PDF-Viewer Komponente mit visueller PDF-Darstellung.
 * Unterstützt Navigation, Zoom und Text-Selektion für Lesebereich-Festlegung.
 */
export function PDFViewer({ className = '', autoSync = true, onPageChange }: PDFViewerProps) {
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
  
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedWordRange, setSelectedWordRange] = useState<{ start: number; end: number } | null>(null);

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

  // Handle text selection for reading range
  const handleTextLayerMouseUp = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowContextMenu(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setShowContextMenu(false);
      return;
    }

    // Get word range for current page
    const wordRange = getWordRangeForPage(currentPage);
    
    // Estimate word position based on selection
    // This is a simplified approach - for more accuracy, we'd need to map text positions
    const pageWords = state.words.slice(wordRange.start, wordRange.end + 1);
    const firstSelectedWord = selectedText.split(/\s+/)[0];
    const lastSelectedWord = selectedText.split(/\s+/).pop() || firstSelectedWord;
    
    const startOffset = pageWords.findIndex(w => w.includes(firstSelectedWord));
    const endOffset = pageWords.findIndex(w => w.includes(lastSelectedWord));
    
    if (startOffset !== -1) {
      const start = wordRange.start + startOffset;
      const end = endOffset !== -1 ? wordRange.start + endOffset : start;
      
      setSelectedWordRange({ start, end: Math.max(start, end) });
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
  }, [currentPage, getWordRangeForPage, state.words]);

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
              className="absolute top-0 left-0 text-layer"
              onMouseUp={handleTextLayerMouseUp}
              style={{
                // PDF.js text layer styling
                opacity: 0.2,
                lineHeight: 1.0,
                overflow: 'hidden',
              }}
            />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedWordRange && (
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl 
                     border border-gray-200 dark:border-gray-700 py-2 min-w-48"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-b 
                          border-gray-200 dark:border-gray-700 mb-1">
            Wörter {selectedWordRange.start + 1} - {selectedWordRange.end + 1}
          </div>
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
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Nur diese Auswahl lesen
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
