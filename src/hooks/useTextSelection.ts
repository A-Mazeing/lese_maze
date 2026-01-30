import { useState, useCallback, useRef, useEffect } from 'react';

export interface TextSelection {
  startWordIndex: number;
  endWordIndex: number;
  text: string;
}

interface UseTextSelectionOptions {
  words: string[];
  onSelectionChange?: (selection: TextSelection | null) => void;
}

/**
 * Hook für Text-Selektion in der Preview-Ansicht.
 * Ermöglicht das Auswählen von Text und das Bestimmen der Start/End-Wort-Indices.
 */
export function useTextSelection({ words, onSelectionChange }: UseTextSelectionOptions) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Berechnet den Wort-Index basierend auf dem angeklickten Element
  const getWordIndexFromElement = useCallback((element: HTMLElement): number | null => {
    const wordIndex = element.getAttribute('data-word-index');
    if (wordIndex !== null) {
      return parseInt(wordIndex, 10);
    }
    // Suche nach dem nächsten Parent mit data-word-index
    const parent = element.closest('[data-word-index]');
    if (parent) {
      return parseInt(parent.getAttribute('data-word-index') || '0', 10);
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const wordIndex = getWordIndexFromElement(target);
    
    if (wordIndex !== null) {
      setIsSelecting(true);
      setSelection({
        startWordIndex: wordIndex,
        endWordIndex: wordIndex,
        text: words[wordIndex] || '',
      });
    }
  }, [getWordIndexFromElement, words]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelecting || !selection) return;

    const target = e.target as HTMLElement;
    const wordIndex = getWordIndexFromElement(target);

    if (wordIndex !== null && wordIndex !== selection.endWordIndex) {
      const startIdx = Math.min(selection.startWordIndex, wordIndex);
      const endIdx = Math.max(selection.startWordIndex, wordIndex);
      const selectedWords = words.slice(startIdx, endIdx + 1);

      setSelection({
        startWordIndex: startIdx,
        endWordIndex: endIdx,
        text: selectedWords.join(' '),
      });
    }
  }, [isSelecting, selection, getWordIndexFromElement, words]);

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selection) {
      setIsSelecting(false);
      onSelectionChange?.(selection);
    }
  }, [isSelecting, selection, onSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setIsSelecting(false);
    onSelectionChange?.(null);
  }, [onSelectionChange]);

  // Event Listener für das Container-Element
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
 * Hilfsfunktion: Erstellt ein Array von Wort-Objekten mit Index für das Rendering
 */
export function createWordElements(words: string[]): Array<{ word: string; index: number }> {
  return words.map((word, index) => ({ word, index }));
}
