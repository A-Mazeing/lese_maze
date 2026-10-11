/**
 * useViewerSelection - Common selection handling for document viewers.
 * Consolidates text selection, context menu, and reading range logic.
 */

import { useState, useCallback, useRef } from 'react';
import { useReaderDispatch } from '@/contexts/ReaderContext';
import type { WordRange, ContextMenuAction } from '@/components/shared/ViewerContextMenu';

export interface ViewerSelectionState {
  /** Whether context menu is visible */
  showContextMenu: boolean;
  /** Context menu position */
  contextMenuPosition: { x: number; y: number };
  /** Currently selected word range */
  selectedWordRange: WordRange | null;
}

export interface UseViewerSelectionOptions {
  /** Callback when user starts reading a selection */
  onStartReading?: (range?: WordRange) => void;
}

/**
 * Hook for managing text selection and context menu in document viewers.
 * Provides consistent behavior across PDF and ePub viewers.
 */
export function useViewerSelection(options: UseViewerSelectionOptions = {}) {
  const dispatch = useReaderDispatch();
  const { onStartReading } = options;

  const [state, setState] = useState<ViewerSelectionState>({
    showContextMenu: false,
    contextMenuPosition: { x: 0, y: 0 },
    selectedWordRange: null,
  });

  // Refs for tracking selection state
  const isMouseDownRef = useRef(false);
  const lastProcessedSelectionRef = useRef('');

  /**
   * Show context menu at position with selected range.
   */
  const showMenu = useCallback((position: { x: number; y: number }, range: WordRange) => {
    setState({
      showContextMenu: true,
      contextMenuPosition: position,
      selectedWordRange: range,
    });
  }, []);

  /**
   * Hide context menu and clear selection.
   */
  const hideMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      showContextMenu: false,
      selectedWordRange: null,
    }));
    lastProcessedSelectionRef.current = '';
  }, []);

  /**
   * Handle context menu action.
   */
  const handleContextMenuAction = useCallback((action: ContextMenuAction) => {
    const range = state.selectedWordRange;
    if (!range) return;

    switch (action) {
      case 'start':
        dispatch({ type: 'SET_START_INDEX', payload: range.start });
        dispatch({ type: 'SET_INDEX', payload: range.start });
        break;
      case 'end':
        dispatch({ type: 'SET_END_INDEX', payload: range.end });
        break;
      case 'range':
        dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: range.start, endIndex: range.end }
        });
        break;
      case 'read':
        dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: range.start, endIndex: range.end }
        });
        dispatch({ type: 'SET_INDEX', payload: range.start });
        onStartReading?.(range);
        break;
    }

    hideMenu();
    if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
  }, [state.selectedWordRange, dispatch, onStartReading, hideMenu]);

  /**
   * Reset reading range to full document.
   */
  const resetReadingRange = useCallback(() => {
    dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: 0, endIndex: null } });
  }, [dispatch]);

  /**
   * Start reading (enter RSVP mode).
   */
  const startReading = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW_MODE', payload: false });
    dispatch({ type: 'PLAY' });
  }, [dispatch]);

  /**
   * Track mouse down state for selection handling.
   */
  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);

  /**
   * Track mouse up state for selection handling.
   */
  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
  }, []);

  return {
    // State
    showContextMenu: state.showContextMenu,
    contextMenuPosition: state.contextMenuPosition,
    selectedWordRange: state.selectedWordRange,

    // Actions
    showMenu,
    hideMenu,
    handleContextMenuAction,
    resetReadingRange,
    startReading,

    // Mouse tracking
    handleMouseDown,
    handleMouseUp,
    isMouseDownRef,
    lastProcessedSelectionRef,
  };
}

/**
 * Adjusts menu position to stay within viewport bounds.
 */
export function adjustMenuPosition(
  x: number,
  y: number,
  menuWidth = 220,
  menuHeight = 200
): { x: number; y: number } {
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return {
    x: Math.max(10, adjustedX),
    y: Math.max(10, adjustedY),
  };
}
