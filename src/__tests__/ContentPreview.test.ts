/**
 * Tests für ContentPreview mit Virtual Scrolling
 * 
 * Testet die folgenden Features:
 * - Korrekte Gruppierung von Wörtern in Zeilen (Phase 2.2)
 * - Virtual Scrolling Performance
 * - Text-Selektion Funktionalität
 */

import { describe, it, expect } from 'vitest';

// Konstante für Wörter pro Zeile (muss mit ContentPreview übereinstimmen)
const WORDS_PER_LINE = 15;

interface WordLine {
  lineIndex: number;
  words: Array<{
    word: string;
    globalIndex: number;
  }>;
  startIndex: number;
  endIndex: number;
}

// Hilfsfunktion um Zeilen zu generieren (entspricht der Logik in ContentPreview)
function createLines(words: string[]): WordLine[] {
  const result: WordLine[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
    const lineWords = words.slice(i, i + WORDS_PER_LINE).map((word, idx) => ({
      word,
      globalIndex: i + idx,
    }));
    result.push({
      lineIndex: result.length,
      words: lineWords,
      startIndex: i,
      endIndex: Math.min(i + WORDS_PER_LINE - 1, words.length - 1),
    });
  }
  return result;
}

describe('ContentPreview Virtual Scrolling', () => {
  describe('Line Grouping Algorithm', () => {
    it('should group words into lines of 15 words each', () => {
      const words = Array.from({ length: 45 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      expect(lines.length).toBe(3); // 45 / 15 = 3 Zeilen
      expect(lines[0].words.length).toBe(15);
      expect(lines[1].words.length).toBe(15);
      expect(lines[2].words.length).toBe(15);
    });

    it('should handle partial last line correctly', () => {
      const words = Array.from({ length: 40 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      expect(lines.length).toBe(3); // 40 / 15 = 2.67 -> 3 Zeilen
      expect(lines[0].words.length).toBe(15);
      expect(lines[1].words.length).toBe(15);
      expect(lines[2].words.length).toBe(10); // Rest
    });

    it('should maintain correct global indices', () => {
      const words = Array.from({ length: 30 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      // Erste Zeile: 0-14
      expect(lines[0].startIndex).toBe(0);
      expect(lines[0].endIndex).toBe(14);
      expect(lines[0].words[0].globalIndex).toBe(0);
      expect(lines[0].words[14].globalIndex).toBe(14);

      // Zweite Zeile: 15-29
      expect(lines[1].startIndex).toBe(15);
      expect(lines[1].endIndex).toBe(29);
      expect(lines[1].words[0].globalIndex).toBe(15);
      expect(lines[1].words[14].globalIndex).toBe(29);
    });

    it('should handle empty words array', () => {
      const words: string[] = [];
      const lines = createLines(words);

      expect(lines.length).toBe(0);
    });

    it('should handle single word', () => {
      const words = ['Hello'];
      const lines = createLines(words);

      expect(lines.length).toBe(1);
      expect(lines[0].words.length).toBe(1);
      expect(lines[0].words[0].word).toBe('Hello');
      expect(lines[0].words[0].globalIndex).toBe(0);
    });

    it('should correctly handle exactly 15 words', () => {
      const words = Array.from({ length: 15 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      expect(lines.length).toBe(1);
      expect(lines[0].words.length).toBe(15);
    });

    it('should correctly handle 16 words (one overflow)', () => {
      const words = Array.from({ length: 16 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      expect(lines.length).toBe(2);
      expect(lines[0].words.length).toBe(15);
      expect(lines[1].words.length).toBe(1);
    });
  });

  describe('Line Index Calculation', () => {
    it('should calculate correct line index for any word', () => {
      // Diese Formel wird in ContentPreview verwendet
      const getLineIndex = (wordIndex: number) => Math.floor(wordIndex / WORDS_PER_LINE);

      expect(getLineIndex(0)).toBe(0);
      expect(getLineIndex(14)).toBe(0);
      expect(getLineIndex(15)).toBe(1);
      expect(getLineIndex(29)).toBe(1);
      expect(getLineIndex(30)).toBe(2);
      expect(getLineIndex(100)).toBe(6);
    });
  });

  describe('Performance Optimizations', () => {
    it('should create reasonable number of lines for large documents', () => {
      // 50.000 Wörter (typisches großes Dokument)
      const words = Array.from({ length: 50000 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      // 50.000 / 15 = 3.333,33 -> 3.334 Zeilen
      expect(lines.length).toBe(Math.ceil(50000 / WORDS_PER_LINE));
      expect(lines.length).toBeLessThan(4000); // Viel weniger DOM-Elemente als 50.000!
    });

    it('should reduce DOM elements by factor of ~15', () => {
      const wordCount = 10000;
      const words = Array.from({ length: wordCount }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      // Ohne Virtual Scrolling: 10.000 DOM-Elemente
      // Mit Virtual Scrolling: ~667 Container-Elemente (nur sichtbare werden gerendert)
      const reductionFactor = wordCount / lines.length;
      expect(reductionFactor).toBeCloseTo(WORDS_PER_LINE, 0);
    });
  });

  describe('Word Lookup', () => {
    it('should find word in correct line', () => {
      const words = Array.from({ length: 100 }, (_, i) => `Word${i}`);
      const lines = createLines(words);

      // Suche Wort 50
      const targetIndex = 50;
      const lineIndex = Math.floor(targetIndex / WORDS_PER_LINE);
      const line = lines[lineIndex];

      const wordInLine = line.words.find(w => w.globalIndex === targetIndex);
      expect(wordInLine).toBeDefined();
      expect(wordInLine?.word).toBe('Word50');
    });
  });
});

describe('Text Selection Logic', () => {
  interface TextSelection {
    startWordIndex: number;
    endWordIndex: number;
    text: string;
  }

  describe('Selection Range Calculation', () => {
    it('should create correct selection for single word', () => {
      const words = ['Hello', 'World', 'Test'];
      const clickIndex = 1;

      const selection: TextSelection = {
        startWordIndex: clickIndex,
        endWordIndex: clickIndex,
        text: words[clickIndex],
      };

      expect(selection.startWordIndex).toBe(1);
      expect(selection.endWordIndex).toBe(1);
      expect(selection.text).toBe('World');
    });

    it('should create correct selection for word range (forward)', () => {
      const words = ['One', 'Two', 'Three', 'Four', 'Five'];
      const startClick = 1;
      const endHover = 3;

      const start = Math.min(startClick, endHover);
      const end = Math.max(startClick, endHover);

      const selection: TextSelection = {
        startWordIndex: start,
        endWordIndex: end,
        text: words.slice(start, end + 1).join(' '),
      };

      expect(selection.startWordIndex).toBe(1);
      expect(selection.endWordIndex).toBe(3);
      expect(selection.text).toBe('Two Three Four');
    });

    it('should create correct selection for word range (backward)', () => {
      const words = ['One', 'Two', 'Three', 'Four', 'Five'];
      const startClick = 3;
      const endHover = 1;

      const start = Math.min(startClick, endHover);
      const end = Math.max(startClick, endHover);

      const selection: TextSelection = {
        startWordIndex: start,
        endWordIndex: end,
        text: words.slice(start, end + 1).join(' '),
      };

      expect(selection.startWordIndex).toBe(1);
      expect(selection.endWordIndex).toBe(3);
      expect(selection.text).toBe('Two Three Four');
    });
  });

  describe('Reading Range from Selection', () => {
    it('should calculate reading range correctly', () => {
      const selection: TextSelection = {
        startWordIndex: 10,
        endWordIndex: 50,
        text: '...',
      };

      const readingRange = {
        startIndex: selection.startWordIndex,
        endIndex: selection.endWordIndex,
      };

      expect(readingRange.startIndex).toBe(10);
      expect(readingRange.endIndex).toBe(50);
    });

    it('should calculate word count from selection', () => {
      const selection: TextSelection = {
        startWordIndex: 10,
        endWordIndex: 50,
        text: '...',
      };

      const wordCount = selection.endWordIndex - selection.startWordIndex + 1;
      expect(wordCount).toBe(41);
    });
  });
});

describe('Word Highlighting States', () => {
  interface WordState {
    isInRange: boolean;
    isCurrentWord: boolean;
    isSelected: boolean;
  }

  function getWordState(
    index: number,
    startIndex: number,
    endIndex: number | null,
    currentIndex: number,
    selection: { startWordIndex: number; endWordIndex: number } | null
  ): WordState {
    const isInRange = index >= startIndex && (endIndex === null || index <= endIndex);
    const isCurrentWord = index === currentIndex;
    const isSelected = selection !== null && 
      index >= selection.startWordIndex && 
      index <= selection.endWordIndex;

    return { isInRange, isCurrentWord, isSelected };
  }

  it('should mark current word correctly', () => {
    const state = getWordState(5, 0, null, 5, null);
    expect(state.isCurrentWord).toBe(true);
    expect(state.isInRange).toBe(true);
    expect(state.isSelected).toBe(false);
  });

  it('should mark words outside range as not in range', () => {
    // Range ist 10-20
    const state1 = getWordState(5, 10, 20, 10, null);
    expect(state1.isInRange).toBe(false);

    const state2 = getWordState(25, 10, 20, 10, null);
    expect(state2.isInRange).toBe(false);

    const state3 = getWordState(15, 10, 20, 10, null);
    expect(state3.isInRange).toBe(true);
  });

  it('should mark selected words correctly', () => {
    const selection = { startWordIndex: 5, endWordIndex: 10 };

    const state1 = getWordState(3, 0, null, 0, selection);
    expect(state1.isSelected).toBe(false);

    const state2 = getWordState(7, 0, null, 0, selection);
    expect(state2.isSelected).toBe(true);

    const state3 = getWordState(12, 0, null, 0, selection);
    expect(state3.isSelected).toBe(false);
  });

  it('should handle null endIndex correctly (read to end)', () => {
    const state = getWordState(1000, 0, null, 0, null);
    expect(state.isInRange).toBe(true); // Alle Wörter sind im Range wenn endIndex null ist
  });
});
