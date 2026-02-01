/**
 * Selection strategies for different contexts (PDF, ePub, Preview).
 * Each strategy implements a common interface for calculating word indices.
 */

import {
  normalizeForComparison,
  splitIntoWords,
  findBestWordMatch,
  countWordsBefore,
} from './normalizer';

/**
 * Result of a word selection calculation.
 */
export interface WordSelectionResult {
  start: number;
  end: number;
}

/**
 * Base interface for selection strategies.
 */
export interface SelectionStrategy {
  /**
   * Calculate word indices from the current selection state.
   * @returns Word indices or null if selection is invalid
   */
  calculate(): WordSelectionResult | null;
}

/**
 * Configuration for DOM-based selection (used in PDF viewer).
 */
export interface DOMSelectionConfig {
  selection: Selection;
  textLayerDiv: HTMLElement;
  pageWords: string[];
  pageStartIndex: number;
}

/**
 * DOM-based selection strategy for PDF viewer.
 * Uses DOM Range API and character position mapping.
 */
export class DOMSelectionStrategy implements SelectionStrategy {
  constructor(private config: DOMSelectionConfig) {}

  calculate(): WordSelectionResult | null {
    const { selection, textLayerDiv, pageWords, pageStartIndex } = this.config;

    try {
      const selectedText = selection.toString();
      const trimmedSelectedText = selectedText.trim();
      if (!trimmedSelectedText || pageWords.length === 0) return null;

      const fullLayerText = textLayerDiv.textContent || '';
      if (!fullLayerText.trim()) return null;

      // Strategy 1: Direct DOM position-based calculation
      const range = selection.getRangeAt(0);

      const preSelectionRange = document.createRange();
      preSelectionRange.selectNodeContents(textLayerDiv);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const startCharIndex = preSelectionRange.toString().length;
      const endCharIndex = startCharIndex + selectedText.length;

      // Strategy 2: Word-based search with improved matching
      const selectedWords = splitIntoWords(trimmedSelectedText);
      let startWordIndex = -1;
      let endWordIndex = -1;

      if (selectedWords.length > 0) {
        const firstWord = selectedWords[0];
        const lastWord = selectedWords[selectedWords.length - 1];

        startWordIndex = findBestWordMatch(firstWord, pageWords, 0, false);

        if (selectedWords.length === 1) {
          endWordIndex = startWordIndex;
        } else {
          endWordIndex = findBestWordMatch(lastWord, pageWords, startWordIndex, true);

          if (endWordIndex === -1 || endWordIndex < startWordIndex) {
            endWordIndex = findBestWordMatch(lastWord, pageWords, startWordIndex, false);
          }
        }

        // Validation: end must come after start
        if (startWordIndex !== -1 && endWordIndex !== -1 && endWordIndex < startWordIndex) {
          if (selectedWords.length <= 3) {
            [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
          } else {
            endWordIndex = -1;
          }
        }
      }

      // Strategy 3: Character position ratio as fallback
      if (startWordIndex === -1 || endWordIndex === -1) {
        const normalizedLayerText = normalizeForComparison(fullLayerText);
        const normalizedPageWords = pageWords.map(w => normalizeForComparison(w)).join(' ');

        const textRatio = normalizedLayerText.length > 0
          ? normalizedPageWords.length / normalizedLayerText.length
          : 1;

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

          charCount = wordEnd + 1; // +1 for space
        }
      }

      // Strategy 4: Context-based refinement
      if (startWordIndex !== -1 && endWordIndex !== -1) {
        const firstSelectedNorm = normalizeForComparison(selectedWords[0] || '');
        const firstPageWordNorm = normalizeForComparison(pageWords[startWordIndex] || '');

        if (startWordIndex > 0 && !firstPageWordNorm.startsWith(firstSelectedNorm.substring(0, 3))) {
          const prevWordNorm = normalizeForComparison(pageWords[startWordIndex - 1] || '');
          if (prevWordNorm.includes(firstSelectedNorm.substring(0, 3))) {
            startWordIndex--;
          }
        }
      }

      // Final validation
      if (startWordIndex === -1) startWordIndex = 0;
      if (endWordIndex === -1) endWordIndex = pageWords.length - 1;
      if (endWordIndex < startWordIndex) {
        [startWordIndex, endWordIndex] = [endWordIndex, startWordIndex];
      }

      startWordIndex = Math.max(0, Math.min(startWordIndex, pageWords.length - 1));
      endWordIndex = Math.max(0, Math.min(endWordIndex, pageWords.length - 1));

      return {
        start: pageStartIndex + startWordIndex,
        end: pageStartIndex + endWordIndex,
      };
    } catch (error) {
      console.error('Error calculating word indices (DOM strategy):', error);
      return null;
    }
  }
}

/**
 * Configuration for content-based selection (used in ePub viewer).
 */
export interface ContentSelectionConfig {
  selectedText: string;
  originalContent: string;
  words: string[];
  fallbackStartIndex?: number;
}

/**
 * Content-based selection strategy for ePub viewer.
 * Searches for selected text within the original content.
 */
export class ContentSelectionStrategy implements SelectionStrategy {
  constructor(private config: ContentSelectionConfig) {}

  calculate(): WordSelectionResult | null {
    const { selectedText, originalContent, words, fallbackStartIndex } = this.config;

    if (!selectedText?.trim()) return null;

    const normalizedSelected = normalizeForComparison(selectedText);
    const normalizedContent = normalizeForComparison(originalContent);

    const textIndex = normalizedContent.indexOf(normalizedSelected);

    if (textIndex === -1) {
      // Text not found - use fallback if available
      if (fallbackStartIndex !== undefined) {
        console.warn('[ContentSelectionStrategy] Selected text not found, using fallback');
        const selectedWords = splitIntoWords(selectedText);
        return {
          start: fallbackStartIndex,
          end: Math.min(fallbackStartIndex + selectedWords.length - 1, words.length - 1),
        };
      }
      return null;
    }

    // Count words before the found text
    const wordsBefore = countWordsBefore(normalizedContent, textIndex);
    const selectedWords = splitIntoWords(normalizedSelected);

    const startIndex = Math.min(wordsBefore, words.length - 1);
    const endIndex = Math.min(wordsBefore + selectedWords.length - 1, words.length - 1);

    return {
      start: startIndex,
      end: endIndex,
    };
  }
}

/**
 * Configuration for element-based selection (used in Preview).
 */
export interface ElementSelectionConfig {
  startElement: HTMLElement;
  endElement?: HTMLElement;
  words: string[];
}

/**
 * Element-based selection strategy for Preview components.
 * Uses data-word-index attributes on DOM elements.
 */
export class ElementSelectionStrategy implements SelectionStrategy {
  constructor(private config: ElementSelectionConfig) {}

  calculate(): WordSelectionResult | null {
    const { startElement, endElement, words } = this.config;

    const startIndex = this.getWordIndexFromElement(startElement);
    if (startIndex === null) return null;

    const endIndex = endElement ? this.getWordIndexFromElement(endElement) : startIndex;
    if (endIndex === null) return null;

    // Ensure valid range
    const finalStart = Math.min(startIndex, endIndex);
    const finalEnd = Math.max(startIndex, endIndex);

    return {
      start: Math.max(0, Math.min(finalStart, words.length - 1)),
      end: Math.max(0, Math.min(finalEnd, words.length - 1)),
    };
  }

  /**
   * Extracts word index from element's data attribute.
   */
  private getWordIndexFromElement(element: HTMLElement): number | null {
    const wordIndex = element.getAttribute('data-word-index');
    if (wordIndex !== null) {
      return parseInt(wordIndex, 10);
    }

    // Search parent with data-word-index
    const parent = element.closest('[data-word-index]');
    if (parent) {
      return parseInt(parent.getAttribute('data-word-index') || '0', 10);
    }

    return null;
  }
}
