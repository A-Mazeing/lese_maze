/**
 * useWordSelection - React hook for unified word selection.
 * Provides easy-to-use APIs for different selection contexts.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import {
  WordSelectionResult,
  calculateFromDOMSelection,
  calculateFromContentSelection,
} from '@/utils/selection';

/**
 * Selection state interface.
 */
export interface SelectionState {
  startWordIndex: number;
  endWordIndex: number;
  text: string;
}

/**
 * Hook for DOM-based word selection (PDF viewer).
 */
export function useDOMWordSelection(
  pageWords: string[],
  pageStartIndex: number
) {
  const getWordIndices = useCallback(
    (textLayerDiv: HTMLElement): WordSelectionResult | null => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return null;

      return calculateFromDOMSelection({
        selection,
        textLayerDiv,
        pageWords,
        pageStartIndex,
      });
    },
    [pageWords, pageStartIndex]
  );

  return { getWordIndices };
}

/**
 * Hook for content-based word selection (ePub viewer).
 */
export function useContentWordSelection(
  originalContent: string,
  words: string[]
) {
  const getWordIndices = useCallback(
    (selectedText: string, fallbackStartIndex?: number): WordSelectionResult | null => {
      if (!selectedText?.trim()) return null;

      return calculateFromContentSelection({
        selectedText,
        originalContent,
        words,
        fallbackStartIndex,
      });
    },
    [originalContent, words]
  );

  const getWordIndicesFromWindowSelection = useCallback(
    (fallbackStartIndex?: number): WordSelectionResult | null => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return null;

      const selectedText = selection.toString().trim();
      if (!selectedText) return null;

      return getWordIndices(selectedText, fallbackStartIndex);
    },
    [getWordIndices]
  );

  return {
    getWordIndices,
    getWordIndicesFromWindowSelection,
  };
}

/**
 * Options for element-based selection hook.
 */
interface UseElementWordSelectionOptions {
  words: string[];
  onSelectionChange?: (selection: SelectionState | null) => void;
}

/**
 * Hook for element-based word selection (Preview).
 * Tracks mouse events for selecting words with data-word-index attributes.
 */
export function useElementWordSelection({
  words,
  onSelectionChange,
}: UseElementWordSelectionOptions) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startIndexRef = useRef<number | null>(null);

  const getWordIndexFromElement = useCallback((element: HTMLElement): number | null => {
    const wordIndex = element.getAttribute('data-word-index');
    if (wordIndex !== null) {
      return parseInt(wordIndex, 10);
    }
    const parent = element.closest('[data-word-index]');
    if (parent) {
      return parseInt(parent.getAttribute('data-word-index') || '0', 10);
    }
    return null;
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const wordIndex = getWordIndexFromElement(target);

      if (wordIndex !== null) {
        setIsSelecting(true);
        startIndexRef.current = wordIndex;
        const newSelection: SelectionState = {
          startWordIndex: wordIndex,
          endWordIndex: wordIndex,
          text: words[wordIndex] || '',
        };
        setSelection(newSelection);
      }
    },
    [getWordIndexFromElement, words]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isSelecting || startIndexRef.current === null) return;

      const target = e.target as HTMLElement;
      const wordIndex = getWordIndexFromElement(target);

      if (wordIndex !== null) {
        const startIdx = Math.min(startIndexRef.current, wordIndex);
        const endIdx = Math.max(startIndexRef.current, wordIndex);
        const selectedWords = words.slice(startIdx, endIdx + 1);

        const newSelection: SelectionState = {
          startWordIndex: startIdx,
          endWordIndex: endIdx,
          text: selectedWords.join(' '),
        };
        setSelection(newSelection);
      }
    },
    [isSelecting, getWordIndexFromElement, words]
  );

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selection) {
      setIsSelecting(false);
      onSelectionChange?.(selection);
    }
  }, [isSelecting, selection, onSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
    startIndexRef.current = null;
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
    containerRef,
    selection,
    isSelecting,
    clearSelection,
  };
}

/**
 * Creates an array of word objects with indices for rendering.
 * @param words - Array of words
 * @returns Array of objects with word and index
 */
export function createWordElements(words: string[]): Array<{ word: string; index: number }> {
  return words.map((word, index) => ({ word, index }));
}
