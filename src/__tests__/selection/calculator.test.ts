import { describe, it, expect } from 'vitest';
import {
  WordSelectionCalculator,
  calculateFromContentSelection,
  calculateFromElementSelection,
} from '@/utils/selection/calculator';

describe('WordSelectionCalculator', () => {
  describe('forContent (ePub strategy)', () => {
    const words = ['hello', 'world', 'foo', 'bar'];
    const originalContent = 'hello world foo bar';

    it('should create calculator with content strategy', () => {
      const calculator = WordSelectionCalculator.forContent({
        selectedText: 'world foo',
        originalContent,
        words,
      });

      const result = calculator.calculate();
      expect(result).toEqual({ start: 1, end: 2 });
    });

    it('should work with static factory method', () => {
      const result = calculateFromContentSelection({
        selectedText: 'foo bar',
        originalContent,
        words,
      });

      expect(result).toEqual({ start: 2, end: 3 });
    });
  });

  describe('forElement (Preview strategy)', () => {
    const words = ['hello', 'world', 'foo'];

    function createMockElement(wordIndex: number): HTMLElement {
      const element = document.createElement('span');
      element.setAttribute('data-word-index', String(wordIndex));
      return element;
    }

    it('should create calculator with element strategy', () => {
      const startElement = createMockElement(0);
      const endElement = createMockElement(2);
      
      const calculator = WordSelectionCalculator.forElement({
        startElement,
        endElement,
        words,
      });

      const result = calculator.calculate();
      expect(result).toEqual({ start: 0, end: 2 });
    });

    it('should work with static factory method', () => {
      const startElement = createMockElement(1);
      const endElement = createMockElement(2);

      const result = calculateFromElementSelection({
        startElement,
        endElement,
        words,
      });

      expect(result).toEqual({ start: 1, end: 2 });
    });
  });

  describe('constructor with config object', () => {
    it('should accept content type config', () => {
      const calculator = new WordSelectionCalculator({
        type: 'content',
        config: {
          selectedText: 'hello',
          originalContent: 'hello world',
          words: ['hello', 'world'],
        },
      });

      const result = calculator.calculate();
      expect(result).toEqual({ start: 0, end: 0 });
    });

    it('should accept element type config', () => {
      const element = document.createElement('span');
      element.setAttribute('data-word-index', '1');

      const calculator = new WordSelectionCalculator({
        type: 'element',
        config: {
          startElement: element,
          words: ['a', 'b', 'c'],
        },
      });

      const result = calculator.calculate();
      expect(result).toEqual({ start: 1, end: 1 });
    });

    it('should throw for unknown strategy type', () => {
      expect(() => {
        new WordSelectionCalculator({
          type: 'unknown' as any,
          config: {} as any,
        });
      }).toThrow('Unknown selection strategy type');
    });
  });
});
