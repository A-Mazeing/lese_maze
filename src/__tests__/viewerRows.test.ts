import { describe, it, expect } from 'vitest';
import { buildViewerRows, findRowForWord, findSectionForWord, WORDS_PER_ROW } from '@/utils/viewerRows';

describe('buildViewerRows', () => {
  it('covers every word exactly once, without gaps or overlaps', () => {
    const model = buildViewerRows(100, [
      { startIndex: 0, label: 'A' },
      { startIndex: 33, label: 'B' },
    ]);
    const covered: number[] = [];
    for (const row of model.rows) {
      if (row.kind === 'words') {
        expect(row.end).toBeGreaterThan(row.start);
        expect(row.end - row.start).toBeLessThanOrEqual(WORDS_PER_ROW);
        for (let i = row.start; i < row.end; i++) covered.push(i);
      }
    }
    expect(covered).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it('starts a new row at every section boundary and puts a heading in front', () => {
    const model = buildViewerRows(40, [
      { startIndex: 0, label: 'Eins' },
      { startIndex: 20, label: 'Zwei' },
    ]);
    expect(model.rows[0]).toMatchObject({ kind: 'heading', label: 'Eins' });
    const headingAt20 = model.rows.findIndex((r) => r.kind === 'heading' && r.label === 'Zwei');
    expect(model.rows[headingAt20 + 1]).toMatchObject({ kind: 'words', start: 20 });
    expect(model.headingRowIndex).toEqual([0, headingAt20]);
  });

  it('ignores out-of-range sections and keeps the last of duplicates', () => {
    const model = buildViewerRows(10, [
      { startIndex: 5, label: 'leer' },
      { startIndex: 5, label: 'voll' },
      { startIndex: 99, label: 'draußen' },
      { startIndex: -1, label: 'negativ' },
    ]);
    expect(model.sections.map((s) => s.label)).toEqual(['voll']);
  });

  it('handles empty documents and documents without sections', () => {
    expect(buildViewerRows(0, [{ startIndex: 0, label: 'x' }]).rows).toEqual([]);
    expect(buildViewerRows(3).rows).toEqual([{ kind: 'words', start: 0, end: 3 }]);
  });
});

describe('findRowForWord / findSectionForWord', () => {
  const model = buildViewerRows(50, [
    { startIndex: 0, label: 'A' },
    { startIndex: 20, label: 'B' },
  ]);

  it('maps word indices to the containing row', () => {
    for (const index of [0, 13, 14, 19, 20, 35, 49]) {
      const row = model.rows[findRowForWord(model.rows, index)];
      expect(row.kind).toBe('words');
      if (row.kind === 'words') {
        expect(index).toBeGreaterThanOrEqual(row.start);
        expect(index).toBeLessThan(row.end);
      }
    }
  });

  it('returns -1 for words outside the document', () => {
    expect(findRowForWord(model.rows, 50)).toBe(-1);
    expect(findRowForWord(model.rows, -3)).toBe(-1);
  });

  it('finds the section of a word', () => {
    expect(findSectionForWord(model.sections, 0)).toBe(0);
    expect(findSectionForWord(model.sections, 19)).toBe(0);
    expect(findSectionForWord(model.sections, 20)).toBe(1);
    expect(findSectionForWord([], 5)).toBe(-1);
  });
});
