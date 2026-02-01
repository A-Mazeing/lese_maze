/**
 * Text selection hook for Preview view.
 * Re-exports from the consolidated selection hooks for backward compatibility.
 */

import { useElementWordSelection, createWordElements } from './selection';

// Re-export types for backward compatibility
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
 * 
 * @deprecated Use useElementWordSelection from '@/hooks/selection' instead
 */
export function useTextSelection({ words, onSelectionChange }: UseTextSelectionOptions) {
  const { containerRef, selection, isSelecting, clearSelection } = useElementWordSelection({
    words,
    onSelectionChange: onSelectionChange
      ? (sel) => onSelectionChange(sel as TextSelection | null)
      : undefined,
  });

  return {
    containerRef,
    selection: selection as TextSelection | null,
    isSelecting,
    clearSelection,
  };
}

/**
 * Hilfsfunktion: Erstellt ein Array von Wort-Objekten mit Index für das Rendering
 * 
 * @deprecated Use createWordElements from '@/hooks/selection' instead
 */
export { createWordElements };
