import { describe, it, expect } from 'vitest';
import { buildPageText, joinLines, type PdfTextItemLike } from '@/utils/pdfText';

function line(text: string, y: number, height = 10): PdfTextItemLike[] {
  return [{ str: text, hasEOL: true, transform: [1, 0, 0, 1, 0, y], height }];
}

describe('joinLines', () => {
  it('removes soft hyphens', () => {
    expect(joinLines('Silben­', 'trennung')).toBe('Silbentrennung');
  });
  it('merges a hard hyphen followed by a lowercase continuation', () => {
    expect(joinLines('Silben-', 'trennung geht')).toBe('Silbentrennung geht');
  });
  it('keeps the hyphen in compounds with a capitalised continuation', () => {
    expect(joinLines('E-', 'Mail')).toBe('E-Mail');
  });
  it('does not merge conjunction-like follow-ups', () => {
    expect(joinLines('Vor-', 'und Nachteile')).toBe('Vor- und Nachteile');
  });
  it('joins ordinary lines with a space and tolerates empty parts', () => {
    expect(joinLines('eins', 'zwei')).toBe('eins zwei');
    expect(joinLines('', 'zwei')).toBe('zwei');
    expect(joinLines('eins', '')).toBe('eins');
  });
});

describe('buildPageText', () => {
  it('returns an empty string for empty input', () => {
    expect(buildPageText([])).toBe('');
  });

  it('reflows lines of one paragraph and dehyphenates', () => {
    const items = [...line('Dies ist ein Silben-', 700), ...line('trennungstest', 688), ...line('für mehrere Zeilen.', 676)];
    expect(buildPageText(items)).toBe('Dies ist ein Silbentrennungstest für mehrere Zeilen.');
  });

  it('starts a new paragraph at an unusually large gap', () => {
    const items = [...line('Erster Absatz', 700), ...line('geht weiter.', 688), ...line('Zweiter Absatz.', 640), ...line('Und weiter.', 628)];
    expect(buildPageText(items)).toBe('Erster Absatz geht weiter.\n\nZweiter Absatz. Und weiter.');
  });

  it('drops a standalone page number in the last line', () => {
    const items = [...line('Inhalt der Seite.', 700), ...line('Mehr Inhalt.', 688), ...line('42', 40)];
    expect(buildPageText(items)).not.toMatch(/42/);
  });

  it('concatenates items without inserting extra separators', () => {
    const items: PdfTextItemLike[] = [
      { str: 'Hal', transform: [1, 0, 0, 1, 0, 700], height: 10 },
      { str: 'lo ', transform: [1, 0, 0, 1, 20, 700], height: 10 },
      { str: 'Welt', transform: [1, 0, 0, 1, 40, 700], height: 10, hasEOL: true },
    ];
    expect(buildPageText(items)).toBe('Hallo Welt');
  });
});
