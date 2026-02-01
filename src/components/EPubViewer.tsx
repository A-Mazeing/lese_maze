import { useRef, useEffect, useCallback } from 'react';
import { useEPubViewer } from '@/hooks/useEPubViewer';
import { useReader } from '@/contexts/ReaderContext';
import { useViewerSelection } from '@/hooks/useViewerSelection';
import {
  ViewerToolbar,
  ViewerInstructions,
} from '@/components/shared/ViewerToolbar';
import { ViewerContextMenu } from '@/components/shared/ViewerContextMenu';
import { LoadingOverlay, ErrorDisplay } from '@/components/shared/LoadingState';

interface EPubViewerProps {
  className?: string;
  autoSync?: boolean;
  onStartReading?: (range?: { start: number; end: number }) => void;
}

/**
 * ePub Viewer Komponente mit epub.js Rendition.
 * Bietet Navigation, Textauswahl und RSVP-Synchronisation.
 */
export function EPubViewer({ className, autoSync = false, onStartReading }: EPubViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useReader();

  const {
    initRendition,
    nextPage,
    prevPage,
    goToChapter,
    syncToWordIndex,
    getWordIndicesFromSelection,
    getWordIndicesFromEpubSelection,
    selectedText,
    selectionPosition,
    clearSelection,
    currentPage,
    totalPages,
    isLoading,
    error,
  } = useEPubViewer();

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

  // Initialize rendition when container is available
  useEffect(() => {
    if (containerRef.current && state.metadata.sourceType === 'epub' && state.words.length > 0) {
      initRendition(containerRef.current);
    }
  }, [initRendition, state.metadata.sourceType, state.words.length]);

  // Auto-sync to RSVP position (chapter-level sync only)
  // Only sync during playback to prevent jumps when user sets start position manually
  useEffect(() => {
    if (!autoSync) return;
    if (!state.isPlaying) {
      // Update lastSyncedIndex when not playing to prevent jump on play start
      lastSyncedIndex.current = state.currentIndex;
      return;
    }
    if (state.currentIndex === lastSyncedIndex.current) return;

    const chapters = state.metadata.chapters;
    if (chapters && chapters.length > 0) {
      const currentChapter = chapters.findIndex(
        ch => state.currentIndex >= ch.startIndex && state.currentIndex <= ch.endIndex
      );
      const lastChapter = chapters.findIndex(
        ch => lastSyncedIndex.current >= ch.startIndex && lastSyncedIndex.current <= ch.endIndex
      );

      if (currentChapter !== lastChapter && currentChapter >= 0) {
        syncToWordIndex(state.currentIndex);
      }
    }

    lastSyncedIndex.current = state.currentIndex;
  }, [autoSync, state.isPlaying, state.currentIndex, state.metadata.chapters, syncToWordIndex]);

  // Handle epub.js selection events
  useEffect(() => {
    if (!selectedText || !selectionPosition) return;

    // Try to get word indices from epub.js selection
    const range = getWordIndicesFromEpubSelection();
    if (!range) {
      // Fallback: try window.getSelection()
      const windowRange = getWordIndicesFromSelection();
      if (!windowRange) return;

      showMenu(selectionPosition, windowRange);
      return;
    }

    showMenu(selectionPosition, range);
  }, [selectedText, selectionPosition, getWordIndicesFromEpubSelection, getWordIndicesFromSelection, showMenu]);

  // Close menu and clear selection after action
  const handleAction = useCallback((action: 'start' | 'end' | 'range' | 'read') => {
    handleContextMenuAction(action);
    clearSelection();
  }, [handleContextMenuAction, clearSelection]);

  // Fallback mouse handler for direct container selection
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedTextFromWindow = selection.toString().trim();
    if (!selectedTextFromWindow) return;

    const range = getWordIndicesFromSelection();
    if (!range) return;

    e.preventDefault();
    showMenu({ x: e.clientX, y: e.clientY }, range);
  }, [getWordIndicesFromSelection, showMenu]);

  // Chapter navigation handler
  const handleChapterSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const chapterIndex = parseInt(e.target.value, 10);
    goToChapter(chapterIndex);

    const chapter = state.metadata.chapters?.[chapterIndex];
    if (chapter) {
      dispatch({ type: 'SET_INDEX', payload: chapter.startIndex });
    }
  }, [goToChapter, state.metadata.chapters, dispatch]);

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

  // Find current chapter
  const currentChapterIndex = state.metadata.chapters?.findIndex(
    ch => state.currentIndex >= ch.startIndex && state.currentIndex <= ch.endIndex
  ) ?? 0;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 ${className || ''}`}>
      {/* Toolbar */}
      <ViewerToolbar
        navigation={{
          onPrev: prevPage,
          onNext: nextPage,
        }}
        pageInfo={{
          current: currentPage,
          total: totalPages,
        }}
        onStartReading={() => onStartReading?.()}
      >
        {/* Chapter selector */}
        {state.metadata.chapters && state.metadata.chapters.length > 0 && (
          <select
            value={currentChapterIndex}
            onChange={handleChapterSelect}
            className="flex-1 max-w-xs px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 
                       dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent truncate"
            aria-label="Kapitel auswählen"
          >
            {state.metadata.chapters.map((chapter, index) => (
              <option key={chapter.id} value={index}>
                {chapter.title}
              </option>
            ))}
          </select>
        )}
      </ViewerToolbar>

      {/* ePub Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        onMouseUp={handleMouseUp}
        style={{ minHeight: '400px' }}
      >
        <LoadingOverlay show={isLoading} message="Lade ePub..." />
        {error && <ErrorDisplay message={error} overlay />}
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedWordRange && (
        <ViewerContextMenu
          position={contextMenuPosition}
          selectedRange={selectedWordRange}
          onAction={handleAction}
          onClose={() => {
            hideMenu();
            clearSelection();
          }}
        />
      )}

      {/* Instructions */}
      <ViewerInstructions
        text="Markiere Text im ePub, um Startpunkt oder Endpunkt festzulegen. Tastenkürzel: ← → Sätze, Shift+← → Absätze"
      />
    </div>
  );
}
