/**
 * useViewerSelection - Common selection handling for document viewers.
 * Consolidates text selection, context menu, and reading range logic.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useReader } from '@/contexts/ReaderContext';
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
  const { dispatch } = useReader();
  const { onStartReading } = options;

  const [state, setState] = useState<ViewerSelectionState>({
    showContextMenu: false,
    contextMenuPosition: { x: 0, y: 0 },
    selectedWordRange: null,
  });

  // Refs for tracking selection state
  const isMouseDownRef = useRef(false);
  const lastProcessedSelectionRef = useRef('');
  // Ref to store the selected range to avoid stale closure issues
  const selectedWordRangeRef = useRef<WordRange | null>(null);

  /**
   * Show context menu at position with selected range.
   */
  const showMenu = useCallback((position: { x: number; y: number }, range: WordRange) => {
    // Store in ref for reliable access in handleContextMenuAction
    selectedWordRangeRef.current = range;
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
    // Clear ref after a small delay to ensure dispatches complete first
    setTimeout(() => {
      selectedWordRangeRef.current = null;
    }, 0);
    lastProcessedSelectionRef.current = '';
  }, []);

  /**
   * Handle context menu action.
   * Uses ref to avoid stale closure issues with selectedWordRange.
   */
  const handleContextMenuAction = useCallback((action: ContextMenuAction) => {
    // Use ref instead of state to avoid stale closure issues
    const range = selectedWordRangeRef.current;
    if (!range) return;

    // Copy values locally to ensure they're captured before any state changes
    const startIdx = range.start;
    const endIdx = range.end;

    // Execute dispatches first, then clean up
    switch (action) {
      case 'start':
        dispatch({ type: 'SET_START_INDEX', payload: startIdx });
        dispatch({ type: 'SET_INDEX', payload: startIdx });
        break;
      case 'end':
        dispatch({ type: 'SET_END_INDEX', payload: endIdx });
        break;
      case 'range':
        dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: startIdx, endIndex: endIdx }
        });
        break;
      case 'read':
        dispatch({
          type: 'SET_READING_RANGE',
          payload: { startIndex: startIdx, endIndex: endIdx }
        });
        dispatch({ type: 'SET_INDEX', payload: startIdx });
        onStartReading?.({ start: startIdx, end: endIdx });
        break;
    }

    // Clean up after dispatches
    hideMenu();
    window.getSelection()?.removeAllRanges();
  }, [dispatch, onStartReading, hideMenu]);

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

  // Close menu on click outside
  useEffect(() => {
    if (!state.showContextMenu) return;

    const handleClickAway = () => hideMenu();
    document.addEventListener('click', handleClickAway);
    return () => document.removeEventListener('click', handleClickAway);
  }, [state.showContextMenu, hideMenu]);

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
