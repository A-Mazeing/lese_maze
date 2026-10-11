import { useRef, useEffect, useCallback, useMemo } from 'react';
import { usePDFTextRenderer } from '@/hooks/usePDFTextRenderer';
import { useReader } from '@/contexts/ReaderContext';
import { useViewerSelection } from '@/hooks/useViewerSelection';
import {
  ViewerToolbar,
  ViewerInstructions,
} from '@/components/shared/ViewerToolbar';
import { ViewerContextMenu } from '@/components/shared/ViewerContextMenu';
import { LoadingOverlay, ErrorDisplay } from '@/components/shared/LoadingState';
import { splitIntoWords } from '@/utils/selection';
import { adjustMenuPosition } from '@/hooks/useViewerSelection';

interface WordWithIndex {
  word: string;
  index: number;
}

interface PDFTextViewerProps {
  className?: string;
  autoSync?: boolean;
  onStartReading?: (range?: { start: number; end: number }) => void;
  onHighlightPositionChange?: (viewportY: number | null) => void;
}

/**
 * Text-basierter PDF Viewer (ohne Canvas).
 * Rendert PDF-Text als scrollbaren HTML-Content ähnlich wie EPubViewer.
 * Bietet bessere Performance und zuverlässigere Text-Selektion.
 */
export function PDFTextViewer({ 
  className = '', 
  autoSync = false, 
  onStartReading,
  onHighlightPositionChange,
}: PDFTextViewerProps) {
  const { state } = useReader();

  const {
    textContent,
    currentPage,
    totalPages,
    isLoading,
    error,
    hasPDF,
    containerRef,
    registerPageRef,
    goToPage,
    nextPage,
    prevPage,
    updateCurrentPageFromScroll,
    syncToWordIndex,
    getWordIndicesFromSelection,
    highlightCurrentWord,
    clearHighlights,
  } = usePDFTextRenderer();

  // Use shared selection hook
  const {
    showContextMenu,
    contextMenuPosition,
    selectedWordRange,
    showMenu,
    hideMenu,
    handleContextMenuAction,
  } = useViewerSelection({ onStartReading });

  const lastSyncedIndex = useRef<number>(-1);

  // Berechne Wort-Start-Index für jede Seite basierend auf pageBreaks
  const pageWordStartIndices = useMemo(() => {
    const pageBreaks = state.metadata.pageBreaks || [0];
    const indices: Map<number, number> = new Map();
    
    pageBreaks.forEach((wordIndex, pageIndex) => {
      indices.set(pageIndex + 1, wordIndex);
    });
    
    return indices;
  }, [state.metadata.pageBreaks]);

  // Helper-Funktion: Absatz in Wörter mit globalen Indizes aufteilen
  const splitParagraphIntoWords = useCallback((
    paragraph: string, 
    startIndex: number
  ): WordWithIndex[] => {
    const words = splitIntoWords(paragraph);
    return words.map((word, idx) => ({
      word,
      index: startIndex + idx,
    }));
  }, []);

  // Mouse selection handler - zeigt Menü bei mouseUp innerhalb des Containers
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = getWordIndicesFromSelection();
    if (!range) return;

    e.preventDefault();
    const adjustedPos = adjustMenuPosition(e.clientX, e.clientY);
    showMenu(adjustedPos, range);
  }, [getWordIndicesFromSelection, showMenu]);

  // Automatisches Erscheinen des Kontextmenüs bei Text-Selektion
  // Verwendet selectionchange Event für zuverlässigere Erkennung
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleSelectionChange = () => {
      // Debounce: warte kurz bis Selektion stabil ist
      if (selectionTimeout) clearTimeout(selectionTimeout);
      
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (!selectedText || selectedText.length < 2) return;

        // Prüfe ob Selektion innerhalb des PDF-Containers ist
        const anchorNode = selection.anchorNode;
        const focusNode = selection.focusNode;
        if (!anchorNode || !focusNode) return;
        
        const isInContainer = container.contains(anchorNode) && container.contains(focusNode);
        if (!isInContainer) return;

        // Hole Wort-Indizes
        const range = getWordIndicesFromSelection();
        if (!range) return;

        // Position basierend auf der Selektion berechnen
        const selectionRange = selection.getRangeAt(0);
        const rect = selectionRange.getBoundingClientRect();
        
        // Menü unter der Selektion anzeigen
        const menuX = rect.left + rect.width / 2;
        const menuY = rect.bottom + 5;
        
        const adjustedPos = adjustMenuPosition(menuX, menuY);
        showMenu(adjustedPos, range);
      }, 150); // 150ms Debounce
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeout) clearTimeout(selectionTimeout);
    };
  }, [containerRef, getWordIndicesFromSelection, showMenu]);

  // Auto-sync to RSVP position during playback
  useEffect(() => {
    if (!autoSync) return;
    if (!state.isPlaying) {
      lastSyncedIndex.current = state.currentIndex;
      // NICHT die Position zurücksetzen bei Pause - Panel soll an der Stelle bleiben
      return;
    }
    if (state.currentIndex === lastSyncedIndex.current) return;

    // Sync page position
    syncToWordIndex(state.currentIndex);

    // Highlight current word - Position wird via Callback gemeldet
    highlightCurrentWord(
      state.currentIndex, 
      state.wordsPerChunk || 1,
      onHighlightPositionChange ?? undefined
    );

    lastSyncedIndex.current = state.currentIndex;
  }, [
    autoSync, 
    state.isPlaying, 
    state.currentIndex, 
    state.wordsPerChunk,
    syncToWordIndex,
    highlightCurrentWord,
    onHighlightPositionChange
  ]);

  // Highlights werden NICHT bei Pause gelöscht - sie bleiben sichtbar
  // Nur bei Unmount oder wenn ein neues PDF geladen wird, werden sie gelöscht

  // Update current page based on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateCurrentPageFromScroll();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, updateCurrentPageFromScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPage, nextPage]);

  // Cleanup highlights on unmount
  useEffect(() => {
    return () => {
      clearHighlights();
    };
  }, [clearHighlights]);

  if (!hasPDF) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">Kein PDF geladen</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 ${className}`}>
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
        onStartReading={() => onStartReading?.()}
      />

      {/* PDF Text Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onMouseUp={handleMouseUp}
        style={{ minHeight: '400px' }}
      >
        <LoadingOverlay show={isLoading} message="Lade PDF-Text..." />
        {error && <ErrorDisplay message={error} overlay />}

        {/* Rendered Text Content */}
        {!isLoading && !error && textContent.length > 0 && (
          <div className="pdf-text-content max-w-4xl mx-auto px-6 py-8">
            {textContent.map((page) => (
              <div
                key={page.pageNum}
                ref={(el) => registerPageRef(page.pageNum, el)}
                className="pdf-page mb-12 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                data-page={page.pageNum}
              >
                {/* Page number indicator */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Seite {page.pageNum}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {page.pageNum} / {totalPages}
                  </div>
                </div>

                {/* Page content as paragraphs with word-index spans */}
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  {page.paragraphs.map((paragraph, idx) => {
                    // Berechne den Wort-Start-Index für diese Seite
                    const pageStartIndex = pageWordStartIndices.get(page.pageNum) || 0;
                    
                    // Berechne den Offset für vorherige Absätze auf dieser Seite
                    let paragraphOffset = 0;
                    for (let i = 0; i < idx; i++) {
                      paragraphOffset += splitIntoWords(page.paragraphs[i]).length;
                    }
                    
                    const wordsWithIndices = splitParagraphIntoWords(
                      paragraph, 
                      pageStartIndex + paragraphOffset
                    );
                    
                    return (
                      <p
                        key={`${page.pageNum}-p${idx}`}
                        className="mb-4 text-base leading-relaxed text-gray-900 dark:text-gray-100"
                      >
                        {wordsWithIndices.map(({ word, index }) => (
                          <span
                            key={index}
                            data-word-index={index}
                            className="pdf-word"
                          >
                            {word}{' '}
                          </span>
                        ))}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && textContent.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">
              Kein Text im PDF gefunden
            </p>
          </div>
        )}
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
        text="Markiere Text im PDF, um Startpunkt oder Endpunkt festzulegen. Tastenkürzel: PageUp/PageDown für Navigation"
      />
    </div>
  );
}
