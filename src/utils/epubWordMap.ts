import type { DomWord } from './htmlText';

/**
 * Hilfsfunktionen, die Wörter eines gerenderten ePub-Kapitels (aus `collectDomWords`
 * mit `trackSegments`) mit Positionen im DOM verbinden.
 */

export interface WordSpan {
  start: number;
  end: number;
}

/** Erzeugt einen Range über das ganze Wort (auch wenn es sich über Inline-Elemente erstreckt). */
export function createWordRange(doc: Document, word: DomWord): Range | null {
  const first = word.segments[0];
  const last = word.segments[word.segments.length - 1];
  if (!first || !last) return null;
  try {
    const range = doc.createRange();
    range.setStart(first.node, first.start);
    range.setEnd(last.node, last.end);
    return range;
  } catch {
    return null; // Knoten wurde inzwischen aus dem DOM entfernt
  }
}

/** Vorzeichen von (b − a) in Dokumentreihenfolge: −1, 0 oder 1. */
function comparePoints(doc: Document, aNode: Node, aOffset: number, bNode: Node, bOffset: number): number {
  const probe = doc.createRange();
  probe.setStart(aNode, aOffset);
  probe.collapse(true);
  return probe.comparePoint(bNode, bOffset);
}

/**
 * Erstes Wort, dessen Ende strikt nach dem Punkt (node, offset) liegt, d. h. das Wort an
 * oder hinter dem Punkt. Gibt `words.length` zurück, wenn der Punkt hinter allen Wörtern liegt.
 */
function firstWordEndingAfter(doc: Document, words: readonly DomWord[], node: Node, offset: number): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const segments = words[mid].segments;
    const last = segments[segments.length - 1];
    if (!last) {
      lo = mid + 1;
      continue;
    }
    if (comparePoints(doc, node, offset, last.node, last.end) > 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Wortindex an einer Caret-Position (Klick); bei Leerraum das nächste Wort danach, sonst das letzte. */
export function findWordAtPoint(doc: Document, words: readonly DomWord[], node: Node, offset: number): number {
  if (words.length === 0) return -1;
  const index = firstWordEndingAfter(doc, words, node, offset);
  return Math.min(index, words.length - 1);
}

/**
 * Bildet eine Textauswahl auf den Bereich der berührten Wörter ab.
 * Gibt `null` zurück, wenn die Auswahl kein Wort berührt.
 */
export function selectionToWordSpan(doc: Document, words: readonly DomWord[], selection: Range): WordSpan | null {
  if (words.length === 0) return null;

  const start = firstWordEndingAfter(doc, words, selection.startContainer, selection.startOffset);
  if (start >= words.length) return null;

  // Letztes Wort, dessen Anfang strikt vor dem Ende der Auswahl liegt.
  let lo = start;
  let hi = words.length - 1;
  let end = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const first = words[mid].segments[0];
    if (first && comparePoints(doc, first.node, first.start, selection.endContainer, selection.endOffset) > 0) {
      end = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return end >= start ? { start, end } : null;
}
