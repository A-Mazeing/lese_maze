import { describe, it, expect } from 'vitest';
import {
  ContentSelectionStrategy,
  ElementSelectionStrategy,
} from '@/utils/selection/strategies';

// Note: DOMSelectionStrategy requires a real DOM and is tested in integration tests

describe('ContentSelectionStrategy', () => {
  const words = ['hello', 'world', 'foo', 'bar', 'baz'];
  const originalContent = 'hello world foo bar baz';

  it('should find selection at the beginning', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'hello world',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 0, end: 1 });
  });

  it('should find selection in the middle', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'foo bar',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 2, end: 3 });
  });

  it('should find selection at the end', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'bar baz',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 3, end: 4 });
  });

  it('should handle single word selection', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'world',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 1, end: 1 });
  });

  it('should handle case-insensitive matching', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'HELLO WORLD',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 0, end: 1 });
  });

  it('should handle extra whitespace in selection', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'hello   world',
      originalContent,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 0, end: 1 });
  });

  it('should return null for empty selection', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: '',
      originalContent,
      words,
    });

    expect(strategy.calculate()).toBeNull();
  });

  it('should return null for whitespace-only selection', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: '   ',
      originalContent,
      words,
    });

    expect(strategy.calculate()).toBeNull();
  });

  it('should use fallback when text not found', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'notfound text',
      originalContent,
      words,
      fallbackStartIndex: 2,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 2, end: 3 });
  });

  it('should return null when text not found and no fallback', () => {
    const strategy = new ContentSelectionStrategy({
      selectedText: 'notfound',
      originalContent,
      words,
    });

    expect(strategy.calculate()).toBeNull();
  });

  it('should clamp indices to valid range', () => {
    const shortWords = ['one', 'two'];
    const strategy = new ContentSelectionStrategy({
      selectedText: 'two',
      originalContent: 'one two',
      words: shortWords,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 1, end: 1 });
  });
});

describe('ElementSelectionStrategy', () => {
  const words = ['hello', 'world', 'foo', 'bar'];

  function createMockElement(wordIndex: number | null): HTMLElement {
    const element = document.createElement('span');
    if (wordIndex !== null) {
      element.setAttribute('data-word-index', String(wordIndex));
    }
    return element;
  }

  it('should calculate selection from single element', () => {
    const element = createMockElement(1);
    const strategy = new ElementSelectionStrategy({
      startElement: element,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 1, end: 1 });
  });

  it('should calculate selection from two elements', () => {
    const startElement = createMockElement(1);
    const endElement = createMockElement(3);
    const strategy = new ElementSelectionStrategy({
      startElement,
      endElement,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 1, end: 3 });
  });

  it('should handle reversed selection (end before start)', () => {
    const startElement = createMockElement(3);
    const endElement = createMockElement(1);
    const strategy = new ElementSelectionStrategy({
      startElement,
      endElement,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 1, end: 3 });
  });

  it('should return null when element has no word index', () => {
    const element = createMockElement(null);
    const strategy = new ElementSelectionStrategy({
      startElement: element,
      words,
    });

    expect(strategy.calculate()).toBeNull();
  });

  it('should find word index in parent element', () => {
    const parent = createMockElement(2);
    const child = document.createElement('span');
    parent.appendChild(child);
    
    const strategy = new ElementSelectionStrategy({
      startElement: child,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 2, end: 2 });
  });

  it('should clamp indices to valid range', () => {
    const startElement = createMockElement(0);
    const endElement = createMockElement(10); // Out of range
    const strategy = new ElementSelectionStrategy({
      startElement,
      endElement,
      words,
    });

    const result = strategy.calculate();
    expect(result).toEqual({ start: 0, end: 3 }); // Clamped to words.length - 1
  });
});
