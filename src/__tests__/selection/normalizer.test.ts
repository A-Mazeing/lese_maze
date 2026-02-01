import { describe, it, expect } from 'vitest';
import {
  normalizeForComparison,
  splitIntoWords,
  extractAlphanumeric,
  countWordsBefore,
  findBestWordMatch,
} from '@/utils/selection/normalizer';

describe('normalizer utilities', () => {
  describe('normalizeForComparison', () => {
    it('should remove zero-width characters', () => {
      const text = 'hello\u200Bworld';
      expect(normalizeForComparison(text)).toBe('helloworld');
    });

    it('should collapse multiple spaces', () => {
      const text = 'hello    world';
      expect(normalizeForComparison(text)).toBe('hello world');
    });

    it('should trim whitespace', () => {
      const text = '  hello world  ';
      expect(normalizeForComparison(text)).toBe('hello world');
    });

    it('should convert to lowercase', () => {
      const text = 'Hello World';
      expect(normalizeForComparison(text)).toBe('hello world');
    });

    it('should handle all transformations together', () => {
      const text = '  Hello\u200B   World  ';
      expect(normalizeForComparison(text)).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(normalizeForComparison('')).toBe('');
    });
  });

  describe('splitIntoWords', () => {
    it('should split text by whitespace', () => {
      const text = 'hello world foo';
      expect(splitIntoWords(text)).toEqual(['hello', 'world', 'foo']);
    });

    it('should handle multiple spaces', () => {
      const text = 'hello   world';
      expect(splitIntoWords(text)).toEqual(['hello', 'world']);
    });

    it('should filter out empty strings', () => {
      const text = '  hello  ';
      expect(splitIntoWords(text)).toEqual(['hello']);
    });

    it('should handle empty string', () => {
      expect(splitIntoWords('')).toEqual([]);
    });
  });

  describe('extractAlphanumeric', () => {
    it('should remove punctuation', () => {
      const text = 'hello, world!';
      expect(extractAlphanumeric(text)).toBe('helloworld');
    });

    it('should keep unicode letters', () => {
      const text = 'café';
      expect(extractAlphanumeric(text)).toBe('café');
    });

    it('should keep numbers', () => {
      const text = 'hello123';
      expect(extractAlphanumeric(text)).toBe('hello123');
    });

    it('should handle empty string', () => {
      expect(extractAlphanumeric('')).toBe('');
    });
  });

  describe('countWordsBefore', () => {
    it('should count words before position', () => {
      const text = 'hello world foo bar';
      // Position after "hello world " (12 characters)
      expect(countWordsBefore(text, 12)).toBe(2);
    });

    it('should return 0 for position 0', () => {
      const text = 'hello world';
      expect(countWordsBefore(text, 0)).toBe(0);
    });

    it('should count partial words', () => {
      const text = 'hello world';
      // Position in the middle of "hello"
      expect(countWordsBefore(text, 3)).toBe(1);
    });
  });

  describe('findBestWordMatch', () => {
    const words = ['hello', 'world', 'foo', 'bar'];

    it('should find exact match', () => {
      expect(findBestWordMatch('world', words)).toBe(1);
    });

    it('should find match case-insensitively', () => {
      expect(findBestWordMatch('WORLD', words)).toBe(1);
    });

    it('should find partial match (contains)', () => {
      const wordsWithPunctuation = ['hello,', 'world.', 'foo!'];
      expect(findBestWordMatch('world', wordsWithPunctuation)).toBe(1);
    });

    it('should return -1 for no match', () => {
      expect(findBestWordMatch('baz', words)).toBe(-1);
    });

    it('should start from specified index', () => {
      const wordsWithDupes = ['hello', 'world', 'hello', 'bar'];
      expect(findBestWordMatch('hello', wordsWithDupes, 1)).toBe(2);
    });

    it('should search backward when specified', () => {
      const wordsWithDupes = ['hello', 'world', 'hello', 'bar'];
      expect(findBestWordMatch('hello', wordsWithDupes, 0, true)).toBe(2);
    });

    it('should handle empty search word', () => {
      expect(findBestWordMatch('', words)).toBe(-1);
    });

    it('should match with alphanumeric comparison', () => {
      const wordsWithPunctuation = ['"hello"', "'world'", 'foo'];
      expect(findBestWordMatch('hello', wordsWithPunctuation)).toBe(0);
    });
  });
});
