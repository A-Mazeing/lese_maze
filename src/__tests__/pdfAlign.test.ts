import { describe, it, expect } from 'vitest';
import { alignWordsToItems, type ItemSegment } from '@/utils/pdfAlign';
import { buildPageText, type PdfTextItemLike } from '@/utils/pdfText';
import { foldChar } from '@/utils/cleanText';
import { cleanText, tokenizeText } from '@/utils/textProcessor';

const fold = (text: string) => Array.from(text, foldChar).join('');

/** Text, auf den die Abschnitte eines Wortes zeigen. */
function textOf(itemTexts: readonly string[], segments: readonly ItemSegment[]): string {
  return segments.map((s) => itemTexts[s.item].slice(s.start, s.end)).join('');
}

function line(text: string, y: number): PdfTextItemLike {
  return { str: text, hasEOL: true, transform: [1, 0, 0, 1, 0, y], height: 10 };
}

describe('foldChar', () => {
  it('ignores whitespace, hyphens and invisible characters', () => {
    for (const ch of [' ', '\n', '-', String.fromCharCode(0xad, 0xa0, 0x200b, 0x2013, 0xfeff)[0]]) {
      expect(foldChar(ch)).toBe('');
    }
    expect(foldChar(String.fromCharCode(0x2013))).toBe('');
  });

  it('folds ligatures and typographic quotes, keeps letters', () => {
    expect(foldChar(String.fromCharCode(0xfb01))).toBe('fi');
    expect(foldChar(String.fromCharCode(0x201e))).toBe('"');
    expect(foldChar(String.fromCharCode(0x2019))).toBe("'");
    expect(foldChar('ä')).toBe('ä');
  });
});

describe('alignWordsToItems', () => {
  it('maps every word of a simple page to its item', () => {
    const items = ['Hallo Welt ', 'wie geht ', 'es?'];
    const words = ['Hallo', 'Welt', 'wie', 'geht', 'es?'];
    const { segments, coverage } = alignWordsToItems(items, words);
    expect(coverage).toBe(1);
    words.forEach((word, i) => expect(textOf(items, segments[i])).toBe(word));
    expect(segments[0]).toEqual([{ item: 0, start: 0, end: 5 }]);
  });

  it('maps a word that is split across items to several segments', () => {
    const items = ['Hal', 'lo ', 'Welt'];
    const { segments } = alignWordsToItems(items, ['Hallo', 'Welt']);
    expect(segments[0]).toEqual([
      { item: 0, start: 0, end: 3 },
      { item: 1, start: 0, end: 2 },
    ]);
  });

  it('follows a dehyphenated word across two lines', () => {
    const items = ['Dies ist ein Silben-', 'trennungstest fuer Zeilen.'];
    const words = ['Dies', 'ist', 'ein', 'Silbentrennungstest', 'fuer', 'Zeilen.'];
    const { segments, coverage } = alignWordsToItems(items, words);
    expect(coverage).toBe(1);
    expect(segments[3].map((s) => s.item)).toEqual([0, 1]);
    expect(fold(textOf(items, segments[3]))).toBe('Silbentrennungstest');
  });

  it('skips text that the word list does not contain (removed page number)', () => {
    const items = ['Erster Satz hier.', '42', 'Zweiter Satz folgt.'];
    const words = ['Erster', 'Satz', 'hier.', 'Zweiter', 'Satz', 'folgt.'];
    const { segments, coverage } = alignWordsToItems(items, words);
    expect(coverage).toBe(1);
    expect(textOf(items, segments[3])).toBe('Zweiter');
    expect(segments[3][0].item).toBe(2);
  });

  it('skips words that are missing in the item stream', () => {
    const items = ['Anfang Mitte Ende'];
    const words = ['Anfang', 'Zusatztext', 'Mitte', 'Ende'];
    const { segments } = alignWordsToItems(items, words);
    expect(textOf(items, segments[2])).toBe('Mitte');
    expect(textOf(items, segments[3])).toBe('Ende');
  });

  it('resolves ligatures in the item text', () => {
    const items = ['E' + String.fromCharCode(0xfb03) + 'zient und «zitiert»'];
    const words = ['Effizient', 'und', '"zitiert"'];
    const { segments, coverage } = alignWordsToItems(items, words);
    expect(coverage).toBe(1);
    expect(segments[0]).toEqual([{ item: 0, start: 0, end: 7 }]);
    expect(segments[1][0].start).toBe(8);
  });

  it('handles empty inputs', () => {
    expect(alignWordsToItems(['x'], [])).toEqual({ segments: [], coverage: 1 });
    expect(alignWordsToItems([], ['x']).coverage).toBe(0);
  });

  it('matches the output of the real text pipeline (buildPageText + cleanText)', () => {
    const items: PdfTextItemLike[] = [
      line('Dies ist die erste Seite des Testdokuments. Sie enth' + String.fromCharCode(0xe4) + 'lt', 700),
      line('mehrere S' + String.fromCharCode(0xe4) + 'tze und eine Silben-', 688),
      line('trennung am Zeilenende. Das ' + String.fromCharCode(0xfb01) + 'nden', 676),
      line('funktioniert damit hoffentlich.', 664),
      line('Ein neuer Absatz beginnt hier nach einer Lücke.', 620),
      line('Er hat nur zwei Zeilen.', 608),
      line('7', 40),
    ];
    const itemTexts = items.map((i) => i.str);
    const words = tokenizeText(cleanText(buildPageText(items)));
    expect(words.length).toBeGreaterThan(25);

    const { segments, coverage } = alignWordsToItems(itemTexts, words);
    expect(coverage).toBe(1);
    words.forEach((word, i) => {
      expect(fold(textOf(itemTexts, segments[i]))).toBe(fold(word));
    });
    // Item-Reihenfolge bleibt monoton.
    let lastItem = -1;
    for (const wordSegments of segments) {
      expect(wordSegments[0].item).toBeGreaterThanOrEqual(lastItem);
      lastItem = wordSegments[wordSegments.length - 1].item;
    }
  });

  it('stays fast for a dense page (20 000 characters)', () => {
    const lineText = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ';
    const items = Array.from({ length: 260 }, () => lineText);
    const words = tokenizeText(items.join(' '));
    const started = performance.now();
    const { coverage } = alignWordsToItems(items, words);
    expect(coverage).toBe(1);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
