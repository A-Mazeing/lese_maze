/**
 * Wandelt die Text-Items einer PDF-Seite (pdf.js `getTextContent`) in lesbaren
 * Fließtext um:
 *  - Zeilen werden anhand von `hasEOL` bzw. der y-Position erkannt,
 *  - Absätze anhand ungewöhnlich großer Zeilenabstände (und Spaltenwechseln),
 *  - Silbentrennung am Zeilenende wird aufgelöst ("Silben-" + "trennung"),
 *  - alleinstehende Seitenzahlen in der ersten/letzten Zeile werden entfernt.
 *
 * Die Items werden – wie in pdf.js selbst (Suche/Kopieren) – OHNE Trennzeichen
 * konkateniert: pdf.js fügt Leerzeichen bereits als Teil von `str` ein.
 */

export interface PdfTextItemLike {
  str: string;
  hasEOL?: boolean;
  /** PDF-Transformationsmatrix [a, b, c, d, e, f]; f ist die y-Position der Grundlinie. */
  transform?: number[];
  height?: number;
}

interface Line {
  text: string;
  y: number | null;
  height: number;
}

/** Wörter, die nach einem Bindestrich am Zeilenende KEINE Fortsetzung des Wortes sind. */
const NON_CONTINUATION_WORDS = new Set([
  'und', 'oder', 'bzw', 'sowie', 'bis', 'beziehungsweise', 'respektive', 'als', 'wie',
  'and', 'or', 'to', 'of', 'the',
]);

const PAGE_NUMBER_LINE_RE = /^\s*(?:(?:seite|page|s\.)\s*)?\d{1,4}\s*$/i;

function itemHeight(item: PdfTextItemLike): number {
  if (item.height && item.height > 0) return item.height;
  const d = item.transform?.[3];
  return d ? Math.abs(d) : 0;
}

function splitIntoLines(items: readonly PdfTextItemLike[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  let previousHadEOL = false;

  for (const item of items) {
    if (typeof item?.str !== 'string') continue; // TextMarkedContent o. Ä.

    const y = item.transform?.[5] ?? null;
    const height = itemHeight(item);

    const movedToNewLine =
      current !== null &&
      current.y !== null &&
      y !== null &&
      Math.abs(y - current.y) > Math.max(1, Math.min(current.height, height || current.height) * 0.5);

    if (current === null || previousHadEOL || movedToNewLine) {
      if (current !== null) lines.push(current);
      current = { text: '', y, height };
    }

    current.text += item.str;
    if (item.str.trim().length > 0) {
      current.height = Math.max(current.height, height);
      if (current.y === null) current.y = y;
    }
    previousHadEOL = Boolean(item.hasEOL);
  }

  if (current !== null) lines.push(current);
  return lines.filter((line) => line.text.trim().length > 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Fügt zwei aufeinanderfolgende Zeilen eines Absatzes zusammen (inkl. Entbindestrichung). */
export function joinLines(previous: string, next: string): string {
  const prev = previous.replace(/[ \t]+$/, '');
  const nxt = next.replace(/^[ \t]+/, '');
  if (!prev) return nxt;
  if (!nxt) return prev;

  // Weicher Trennstrich am Zeilenende: immer entfernen.
  if (prev.endsWith('\u00AD')) return prev.slice(0, -1) + nxt;

  // Harter Bindestrich nach einem Buchstaben ("Silben-" / "trennung").
  if (/\p{L}[-‐]$/u.test(prev)) {
    const firstWord = nxt.match(/^\p{L}+/u)?.[0];
    if (firstWord) {
      const startsLowercase = firstWord[0] === firstWord[0].toLowerCase() && firstWord[0] !== firstWord[0].toUpperCase();
      if (startsLowercase && !NON_CONTINUATION_WORDS.has(firstWord.toLowerCase())) {
        return prev.slice(0, -1) + nxt;
      }
      if (!startsLowercase) {
        // "E-" + "Mail", "Nord-" + "Rhein": Bindestrich bleibt, Leerzeichen entfällt.
        return prev + nxt;
      }
    }
  }
  return `${prev} ${nxt}`;
}

/**
 * Baut den Text einer Seite aus ihren Text-Items.
 * Absätze werden durch eine Leerzeile ("\n\n") getrennt.
 */
export function buildPageText(items: readonly PdfTextItemLike[]): string {
  let lines = splitIntoLines(items);
  if (lines.length === 0) return '';

  // Alleinstehende Seitenzahl in der ersten/letzten Zeile entfernen.
  if (lines.length > 1 && PAGE_NUMBER_LINE_RE.test(lines[lines.length - 1].text)) {
    lines = lines.slice(0, -1);
  }
  if (lines.length > 1 && PAGE_NUMBER_LINE_RE.test(lines[0].text)) {
    lines = lines.slice(1);
  }

  // Typischer Zeilenabstand der Seite (Median aller Abstände nach unten).
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1].y;
    const b = lines[i].y;
    if (a !== null && b !== null && a - b > 0) gaps.push(a - b);
  }
  const typicalGap = median(gaps);

  const paragraphs: string[] = [];
  let paragraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.replace(/[ \t]+/g, ' ').trim();

    if (i === 0) {
      paragraph = text;
      continue;
    }

    const prev = lines[i - 1];
    let startsParagraph = false;
    if (prev.y !== null && line.y !== null) {
      const gap = prev.y - line.y;
      const reference = Math.max(prev.height, line.height, 1);
      if (gap <= 0) {
        // Sprung nach oben: neue Spalte oder neuer Textblock.
        startsParagraph = true;
      } else if (typicalGap > 0) {
        startsParagraph = gap > Math.max(typicalGap * 1.45, reference * 1.75);
      } else {
        startsParagraph = gap > reference * 2.2;
      }
    }

    if (startsParagraph) {
      paragraphs.push(paragraph);
      paragraph = text;
    } else {
      paragraph = joinLines(paragraph, text);
    }
  }
  paragraphs.push(paragraph);

  return paragraphs.filter((p) => p.length > 0).join('\n\n');
}
