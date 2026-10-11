import { foldChar } from './cleanText';

/**
 * Ordnet die Wörter einer PDF-Seite (so, wie sie der RSVP-Reader liest) den Text-Items
 * der Seite zu (so, wie pdf.js sie im Textlayer ausgibt).
 *
 * Warum ein Abgleich? Die Wortliste entsteht aus dem *aufbereiteten* Seitentext
 * (Zeilen zusammengeführt, Silbentrennung aufgelöst, Seitenzahl entfernt, Zeichen
 * bereinigt). Der Textlayer enthält dagegen den Rohtext pro Item. Beide Ströme
 * beschreiben denselben Text in derselben Reihenfolge, unterscheiden sich aber in
 * einzelnen Zeichen. Der Abgleich vergleicht deshalb beide Ströme zeichenweise
 * (ohne Leerraum und Bindestriche, mit aufgelösten Ligaturen) und synchronisiert sich
 * nach Abweichungen wieder, indem er auf einer der beiden Seiten kurze Stücke
 * überspringt (entfernte Seitenzahl, zusätzliche Zeichen).
 */

export interface ItemSegment {
  /** Index des Text-Items. */
  item: number;
  /** Beginn im Item-Text (UTF-16-Index, inklusive). */
  start: number;
  /** Ende im Item-Text (exklusiv). */
  end: number;
}

export interface WordAlignment {
  /** Pro Wort die Fundstellen (leer, wenn das Wort nicht zugeordnet werden konnte). */
  segments: ItemSegment[][];
  /** Anteil der zugeordneten Wörter (0–1; 1 bei leerer Wortliste). */
  coverage: number;
}

/** So weit (in Zeichen) wird nach einer Abweichung nach dem Wiedereinstieg gesucht. */
const RESYNC_WINDOW = 96;
/** So viele aufeinanderfolgende Zeichen müssen für einen Wiedereinstieg übereinstimmen. */
const RESYNC_LENGTH = 6;

interface FoldedStream {
  text: string;
  /** Pro gefaltetem Zeichen: Index der Quelle (Item bzw. Wort). */
  owner: Int32Array;
  /** Pro gefaltetem Zeichen: Offset in der Quelle (nur bei Items genutzt). */
  offset: Int32Array;
}

function foldSources(sources: readonly string[]): FoldedStream {
  let total = 0;
  for (const source of sources) total += source.length * 3; // Ligaturen können auf 3 Zeichen wachsen
  const owner = new Int32Array(total);
  const offset = new Int32Array(total);
  const parts: string[] = [];
  let length = 0;

  for (let s = 0; s < sources.length; s++) {
    const source = sources[s];
    for (let i = 0; i < source.length; i++) {
      const folded = foldChar(source[i]);
      for (let k = 0; k < folded.length; k++) {
        owner[length] = s;
        offset[length] = i;
        length++;
      }
      if (folded) parts.push(folded);
    }
  }
  return { text: parts.join(''), owner: owner.subarray(0, length), offset: offset.subarray(0, length) };
}

function matchesAt(a: string, i: number, b: string, j: number): boolean {
  const length = Math.min(RESYNC_LENGTH, a.length - i, b.length - j);
  if (length <= 0) return false;
  for (let k = 0; k < length; k++) {
    if (a.charCodeAt(i + k) !== b.charCodeAt(j + k)) return false;
  }
  return true;
}

/**
 * @param itemTexts Texte der Text-Items (in Reihenfolge des Textlayers)
 * @param words     Wörter der Seite (in Lesereihenfolge)
 */
export function alignWordsToItems(itemTexts: readonly string[], words: readonly string[]): WordAlignment {
  const segments: ItemSegment[][] = words.map(() => []);
  if (words.length === 0) return { segments, coverage: 1 };
  if (itemTexts.length === 0) return { segments, coverage: 0 };

  const a = foldSources(itemTexts); // Textlayer
  const b = foldSources(words); // Wortliste

  // Pro Wort die zugeordneten Positionen im Textlayer-Strom (aufsteigend).
  const matched: number[][] = words.map(() => []);

  let i = 0;
  let j = 0;
  while (i < a.text.length && j < b.text.length) {
    if (a.text.charCodeAt(i) === b.text.charCodeAt(j)) {
      matched[b.owner[j]].push(i);
      i++;
      j++;
      continue;
    }

    // Abweichung: kürzesten Sprung suchen, nach dem beide Ströme wieder übereinstimmen.
    let skippedA = 0;
    let skippedB = 0;
    let found = false;
    for (let d = 1; d <= RESYNC_WINDOW && !found; d++) {
      if (i + d < a.text.length && matchesAt(a.text, i + d, b.text, j)) {
        skippedA = d; // zusätzlicher Text im Textlayer (z. B. entfernte Seitenzahl)
        found = true;
      } else if (j + d < b.text.length && matchesAt(a.text, i, b.text, j + d)) {
        skippedB = d; // zusätzlicher Text in der Wortliste (nicht im Textlayer vorhanden)
        found = true;
      }
    }
    if (found) {
      i += skippedA;
      j += skippedB;
    } else {
      i++; // Ersetzung: beide Zeichen überspringen
      j++;
    }
  }

  let matchedWords = 0;
  for (let w = 0; w < words.length; w++) {
    const positions = matched[w];
    if (positions.length === 0) continue;
    matchedWords++;

    // Zusammenhängende Positionen desselben Items zu einem Abschnitt zusammenfassen.
    let item = a.owner[positions[0]];
    let start = a.offset[positions[0]];
    let end = start + 1;
    for (let k = 1; k < positions.length; k++) {
      const position = positions[k];
      const positionItem = a.owner[position];
      const positionOffset = a.offset[position];
      if (positionItem === item) {
        end = Math.max(end, positionOffset + 1);
      } else {
        segments[w].push({ item, start, end });
        item = positionItem;
        start = positionOffset;
        end = positionOffset + 1;
      }
    }
    segments[w].push({ item, start, end });
  }

  return { segments, coverage: matchedWords / words.length };
}
