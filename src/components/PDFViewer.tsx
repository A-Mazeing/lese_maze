import { useRef, useEffect, useCallback } from 'react';
import { usePDFViewer } from '@/hooks/usePDFViewer';
import { useReader } from '@/contexts/ReaderContext';
import { useViewerSelection, adjustMenuPosition } from '@/hooks/useViewerSelection';
import { calculateFromContentSelection } from '@/utils/selection';
import {
  ViewerToolbar,
  ReadingRangeInfo,
  ViewerInstructions,
} from '@/components/shared/ViewerToolbar';
import { ViewerContextMenu } from '@/components/shared/ViewerContextMenu';
import { LoadingOverlay, ErrorDisplay } from '@/components/shared/LoadingState';

interface PDFViewerProps {
  className?: string;
  autoSync?: boolean;
  onPageChange?: (page: number) => void;
  onStartReading?: (range?: { start: number; end: number }) => void;
}

/**
 * SelectionState für deterministische Event-Verarbeitung.
 */
type SelectionState = 'idle' | 'selecting' | 'selected' | 'processing';

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
  const { state } = useReader();
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
  } = usePDFViewer();

  // Use shared selection hook
  const {
    showContextMenu,
    contextMenuPosition,
    selectedWordRange,
    showMenu,
    hideMenu,
    handleContextMenuAction,
    resetReadingRange,
    startReading,
    isMouseDownRef,
    lastProcessedSelectionRef,
  } = useViewerSelection({ onStartReading });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selection state machine refs
  const selectionStateRef = useRef<SelectionState>('idle');
  const pendingTimeoutsRef = useRef<number[]>([]);

  // Helper: Clear all pending timeouts
  const clearAllTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach(id => clearTimeout(id));
    pendingTimeoutsRef.current = [];
  }, []);

  // Helper: Create tracked timeout
  const createTrackedTimeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter(t => t !== id);
      callback();
    }, delay);
    pendingTimeoutsRef.current.push(id);
    return id;
  }, []);

  // Core text selection handler
  const processTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;

    const selectedText = selection.toString().trim();
    if (!selectedText) return false;

    const textLayer = textLayerRef.current;
    if (!textLayer) return false;

    try {
      const range = selection.getRangeAt(0);
      if (!textLayer.contains(range.commonAncestorContainer)) return false;
    } catch {
      return false;
    }

    // Verwende Content-basierte Suche für genauere Ergebnisse
    // Dies funktioniert besser als DOM-basierte Berechnung, da PDF.js Text fragmentiert
    if (!state.originalContent) return false;
    
    const calculatedRange = calculateFromContentSelection({
      selectedText,
      originalContent: state.originalContent,
      words: state.words,
    });

    if (calculatedRange) {
      const selectionRange = selection.getRangeAt(0);
      const rect = selectionRange.getBoundingClientRect();
      const position = adjustMenuPosition(rect.right + 5, rect.bottom + 5);

      showMenu(position, calculatedRange);
      return true;
    }

    return false;
  }, [state.originalContent, state.words, showMenu]);

  // Selection event handlers
  useEffect(() => {
    if (!hasPDF) return;

    const handleSelectionChange = () => {
      clearAllTimeouts();

      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        if (isMouseDownRef.current) {
          selectionStateRef.current = 'selecting';
          return;
        }

        createTrackedTimeout(() => {
          const currentSel = window.getSelection();
          if (!currentSel || currentSel.isCollapsed) {
            hideMenu();
            selectionStateRef.current = 'idle';
            lastProcessedSelectionRef.current = '';
          }
        }, 100);
        return;
      }

      const textLayer = textLayerRef.current;
      if (!textLayer) return;

      try {
        const range = selection.getRangeAt(0);
        if (!textLayer.contains(range.commonAncestorContainer)) return;
      } catch {
        return;
      }

      selectionStateRef.current = 'selecting';

      if (isMouseDownRef.current) return;

      createTrackedTimeout(() => {
        const currentSelection = window.getSelection()?.toString().trim() || '';

        if (currentSelection === lastProcessedSelectionRef.current && showContextMenu) return;

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

      requestAnimationFrame(() => {
        createTrackedTimeout(() => {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selectionStateRef.current === 'selecting') {
            const currentSelection = selection.toString().trim();

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
  }, [hasPDF, processTextSelection, clearAllTimeouts, createTrackedTimeout, showContextMenu, hideMenu, isMouseDownRef, lastProcessedSelectionRef]);

  // Render page when page/scale changes
  useEffect(() => {
    if (canvasRef.current && hasPDF) {
      renderPage(currentPage, canvasRef.current, textLayerRef.current);
    }
  }, [currentPage, scale, hasPDF, renderPage]);

  // Notify parent of page changes
  useEffect(() => {
    onPageChange?.(currentPage);
  }, [currentPage, onPageChange]);

  // Auto-sync with reading position
  useEffect(() => {
    if (autoSync && state.isPlaying) {
      syncToCurrentWord();
    }
  }, [autoSync, state.currentIndex, state.isPlaying, syncToCurrentWord]);

  // Fit to width on load
  useEffect(() => {
    if (containerRef.current && hasPDF) {
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width) fitToWidth(width);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [hasPDF, fitToWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
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
      <ViewerToolbar
        navigation={{
          onPrev: prevPage,
          onNext: nextPage,
          prevDisabled: currentPage <= 1,
          nextDisabled: currentPage >= totalPages,
        }}
        pageInfo={{
          current: currentPage,
          total: totalPages,
          onPageChange: goToPage,
          editable: true,
        }}
        onStartReading={startReading}
      >
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
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
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
      </ViewerToolbar>

      {/* Reading Range Info */}
      <ReadingRangeInfo
        startIndex={state.startIndex}
        endIndex={state.endIndex}
        totalWords={state.words.length}
        onReset={resetReadingRange}
      />

      {/* PDF Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900"
      >
        <div className="flex justify-center p-4">
          <div className="relative shadow-lg">
            <LoadingOverlay show={isLoading} />
            {error && <ErrorDisplay message={error} overlay />}

            <canvas ref={canvasRef} className="block bg-white" />
            <div ref={textLayerRef} className="text-layer" />
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedWordRange && (
        <ViewerContextMenu
          position={contextMenuPosition}
          selectedRange={selectedWordRange}
          onAction={handleContextMenuAction}
          onClose={hideMenu}
        />
      )}

      {/* Instructions */}
      <ViewerInstructions
        text="Markiere Text auf der PDF-Seite, um Startpunkt oder Endpunkt festzulegen. Tastenkürzel: ← → Sätze, Shift+← → Absätze, +/- Zoom"
      />
    </div>
  );
}
