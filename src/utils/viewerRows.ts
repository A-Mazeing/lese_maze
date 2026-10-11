/**
 * Zeilenmodell für die virtualisierte Textansicht.
 *
 * Die Wortliste wird in Zeilen mit fester Wortzahl zerlegt; vor jedem Abschnitt
 * (PDF-Seite, Kapitel) steht optional eine Überschriftenzeile. So lassen sich
 * Wortindex ↔ Zeile ohne Messung in O(log n) umrechnen.
 */

export const WORDS_PER_ROW = 14;

export interface ViewerSection {
  /** Index des ersten Wortes des Abschnitts. */
  startIndex: number;
  label: string;
  /** Optionale Kennung (z. B. PDF-Seitenzahl) für die Navigation. */
  id?: number;
}

export type ViewerRow =
  | { kind: 'heading'; label: string; sectionIndex: number }
  | { kind: 'words'; start: number; end: number }; // end ist exklusiv

export interface ViewerRowModel {
  rows: ViewerRow[];
  /** Zeilenindex der Überschrift je Abschnitt (gleiche Reihenfolge wie die bereinigte Abschnittsliste). */
  headingRowIndex: number[];
  /** Bereinigte Abschnitte (aufsteigend, ohne leere und ohne Duplikate je Startindex). */
  sections: ViewerSection[];
}

/**
 * Baut das Zeilenmodell. Abschnitte mit identischem Startindex (z. B. leere PDF-Seiten
 * vor einer Seite mit Text) werden zusammengefasst; der LETZTE gewinnt, denn nur er
 * besitzt die Wörter ab diesem Index.
 */
export function buildViewerRows(
  wordCount: number,
  inputSections: readonly ViewerSection[] = [],
  wordsPerRow = WORDS_PER_ROW,
): ViewerRowModel {
  const sections: ViewerSection[] = [];
  for (const section of [...inputSections].sort((a, b) => a.startIndex - b.startIndex)) {
    if (section.startIndex < 0 || section.startIndex >= wordCount) continue;
    const last = sections[sections.length - 1];
    if (last && last.startIndex === section.startIndex) sections[sections.length - 1] = section;
    else sections.push(section);
  }

  const rows: ViewerRow[] = [];
  const headingRowIndex: number[] = [];

  // Ohne Abschnitt am Anfang beginnt der Text direkt mit Wörtern.
  const boundaries = sections.map((s) => s.startIndex);
  let cursor = 0;
  let sectionCursor = 0;

  while (cursor < wordCount) {
    if (sectionCursor < sections.length && sections[sectionCursor].startIndex === cursor) {
      headingRowIndex.push(rows.length);
      rows.push({ kind: 'heading', label: sections[sectionCursor].label, sectionIndex: sectionCursor });
      sectionCursor++;
    }
    const nextBoundary = sectionCursor < boundaries.length ? boundaries[sectionCursor] : wordCount;
    const end = Math.min(cursor + wordsPerRow, nextBoundary);
    rows.push({ kind: 'words', start: cursor, end });
    cursor = end;
  }

  return { rows, headingRowIndex, sections };
}

/** Zeilenindex der Wortzeile, die das Wort enthält (Binärsuche; -1 bei leerem Modell). */
export function findRowForWord(rows: readonly ViewerRow[], wordIndex: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const row = rows[mid];
    if (row.kind === 'heading') {
      // Überschriften liegen vor ihrer ersten Wortzeile: nach rechts ausweichen.
      const next = rows[mid + 1];
      if (next && next.kind === 'words' && wordIndex >= next.start) lo = mid + 1;
      else hi = mid - 1;
    } else if (wordIndex < row.start) {
      hi = mid - 1;
    } else if (wordIndex >= row.end) {
      lo = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

/** Index des Abschnitts, in dem das Wort liegt (-1 vor dem ersten Abschnitt). */
export function findSectionForWord(sections: readonly ViewerSection[], wordIndex: number): number {
  let lo = 0;
  let hi = sections.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (sections[mid].startIndex <= wordIndex) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}
