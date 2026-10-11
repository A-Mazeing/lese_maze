import { describe, it, expect } from 'vitest';
import { cleanText } from '@/utils/cleanText';
import {
  buildTextStructure,
  estimateReadingTime,
  extractTextFromHTML,
  formatProgress,
  mergeTextStructures,
  tokenizeText,
  tokenizeTextWithStructure,
} from '@/utils/textProcessor';
import { calculateORP, calculateWordDuration, formatWordWithORP } from '@/utils/orpCalculator';

describe('cleanText', () => {
  it('removes soft hyphens, zero-width characters and control characters', () => {
    expect(cleanText('Sil­ben​tren⁠nung﻿')).toBe('Silbentrennung');
    expect(cleanText('a\u0000b\u0007c')).toBe('abc');
  });

  it('normalizes line endings, whitespace and blank lines', () => {
    expect(cleanText('a\r\nb\rc')).toBe('a\nb\nc');
    expect(cleanText('a   \t b')).toBe('a b');
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb');
    expect(cleanText('  x   y  ')).toBe('x y');
  });

  it('resolves ligatures and typographic quotes', () => {
    expect(cleanText('ﬁnden ﬂiegen')).toBe('finden fliegen');
    expect(cleanText('„Hallo“ und ‚Welt‘')).toBe('"Hallo" und \'Welt\'');
  });
});

describe('tokenizeText', () => {
  it('splits on any whitespace and ignores empties', () => {
    expect(tokenizeText('  a  b\n\tc ')).toEqual(['a', 'b', 'c']);
    expect(tokenizeText('')).toEqual([]);
  });
});

describe('tokenizeTextWithStructure', () => {
  it('detects paragraphs on blank lines and sentences on punctuation + capital', () => {
    const { words, paragraphBreaks, sentenceBreaks } = tokenizeTextWithStructure(
      'Erster Satz. Zweiter Satz!\n\nNeuer Absatz hier.',
    );
    expect(words).toEqual(['Erster', 'Satz.', 'Zweiter', 'Satz!', 'Neuer', 'Absatz', 'hier.']);
    expect(paragraphBreaks).toEqual([0, 4]);
    expect(sentenceBreaks).toEqual([0, 2, 4]);
  });

  it('does not break sentences after abbreviations, initials or ordinals', () => {
    const { sentenceBreaks } = tokenizeTextWithStructure('Dr. Müller kam am 3. Oktober, z.B. mit J. Schmidt.');
    expect(sentenceBreaks).toEqual([0]);
  });

  it('handles closing quotes and lowercase continuations', () => {
    const quoted = tokenizeTextWithStructure('Er sagte „Hallo.“ Dann ging er.');
    expect(quoted.sentenceBreaks).toContain(3);
    const lower = tokenizeTextWithStructure('Das war es. und weiter');
    expect(lower.sentenceBreaks).toEqual([0]);
  });

  it('returns an empty structure for empty input', () => {
    expect(tokenizeTextWithStructure('')).toEqual({ words: [], sentenceBreaks: [], paragraphBreaks: [] });
    expect(buildTextStructure([], [])).toEqual({ words: [], sentenceBreaks: [], paragraphBreaks: [] });
  });
});

describe('mergeTextStructures', () => {
  it('offsets the breaks of later parts; partStarts is index-aligned with the input parts', () => {
    const a = tokenizeTextWithStructure('Eins zwei. Drei vier.');
    const b = tokenizeTextWithStructure('Fünf sechs.');
    const merged = mergeTextStructures([a, { words: [], sentenceBreaks: [], paragraphBreaks: [] }, b]);
    expect(merged.words).toHaveLength(6);
    expect(merged.partStarts).toEqual([0, 4, 4]); // leerer Teil beginnt dort, wo der nächste anfängt
    expect(merged.paragraphBreaks).toEqual([0, 4]);
    expect(merged.sentenceBreaks).toEqual([0, 2, 4]);
  });

  it('copes with parts of several hundred thousand words (no stack overflow)', () => {
    const words = Array.from({ length: 300_000 }, () => 'wort');
    const merged = mergeTextStructures([
      { words, sentenceBreaks: [0], paragraphBreaks: [0] },
      { words, sentenceBreaks: [0], paragraphBreaks: [0] },
    ]);
    expect(merged.words).toHaveLength(600_000);
  });
});

describe('extractTextFromHTML', () => {
  it('keeps adjacent blocks apart and skips scripts/styles', () => {
    const text = extractTextFromHTML(
      '<style>p{}</style><p>Ende</p><p>Anfang</p><script>alert(1)</script><ul><li>eins</li><li>zwei</li></ul>',
    );
    expect(tokenizeText(text)).toEqual(['Ende', 'Anfang', 'eins', 'zwei']);
  });

  it('joins text across inline elements', () => {
    expect(tokenizeText(extractTextFromHTML('<p><b>Hal</b>lo <i>Welt</i></p>'))).toEqual(['Hallo', 'Welt']);
  });
});

describe('formatting helpers', () => {
  it('estimateReadingTime', () => {
    expect(estimateReadingTime(0, 300)).toBe('Weniger als 1 Minute');
    expect(estimateReadingTime(300, 300)).toBe('1 Minute');
    expect(estimateReadingTime(3000, 300)).toBe('10 Minuten');
    expect(estimateReadingTime(18000, 300)).toBe('1 Stunde');
    expect(estimateReadingTime(21000, 300)).toBe('1h 10min');
  });

  it('formatProgress clamps', () => {
    expect(formatProgress(50, 200)).toBe('25%');
    expect(formatProgress(1, 0)).toBe('0%');
    expect(formatProgress(500, 200)).toBe('100%');
  });
});

describe('ORP', () => {
  it('ignores surrounding punctuation when choosing the pivot letter', () => {
    expect(calculateORP('Hallo')).toBe(1);
    expect(calculateORP('„Hallo“')).toBe(2);
    expect(calculateORP('(a)')).toBe(1);
    expect(calculateORP('...')).toBe(0);
    expect(calculateORP('')).toBe(0);
  });

  it('splits into before / orp / after without breaking emoji', () => {
    expect(formatWordWithORP('Hallo')).toEqual({ before: 'H', orp: 'a', after: 'llo', fullWord: 'Hallo' });
    const emoji = formatWordWithORP('😀😀😀😀');
    expect(emoji.before + emoji.orp + emoji.after).toBe('😀😀😀😀');
    expect(Array.from(emoji.orp)).toHaveLength(1);
    expect(formatWordWithORP('')).toEqual({ before: '', orp: '', after: '', fullWord: '' });
  });

  it('word duration grows for long words and survives invalid WPM', () => {
    expect(calculateWordDuration('kurz', 600)).toBe(100);
    expect(calculateWordDuration('Donaudampfschifffahrt', 600)).toBeGreaterThan(100);
    expect(calculateWordDuration('x', 0)).toBe(200);
    expect(calculateWordDuration('x', NaN)).toBe(200);
  });
});
