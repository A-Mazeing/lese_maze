import { cleanText, INVISIBLE_CHARS_RE } from './cleanText';

/**
 * Block-bewusste Textextraktion aus DOM-Bäumen (ePub-Kapitel, importiertes HTML).
 *
 * `Node.textContent` fügt den Text benachbarter Block-Elemente ohne Trennzeichen
 * zusammen ("</p><p>" → "EndeAnfang") und kennt keine Absätze. Diese Funktion
 * geht den Baum in Dokumentreihenfolge durch und setzt an Block-Grenzen
 * Zeilen-/Absatzumbrüche.
 *
 * HINWEIS: `extractPageInPage` (src/background/pageExtractor.ts) enthält aus
 * technischen Gründen (Serialisierung für chrome.scripting.executeScript) eine
 * eigenständige Kopie dieses Algorithmus. Die Tests stellen sicher, dass beide
 * identische Ergebnisse liefern.
 */

/** Elemente, deren Inhalt nie gelesen wird. */
export const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE',
  'SVG', 'MATH', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'PICTURE',
  'SELECT', 'OPTION', 'TEXTAREA', 'INPUT', 'BUTTON',
]);

/** Elemente, die einen Absatz (Leerzeile) begrenzen. */
export const PARAGRAPH_TAGS: ReadonlySet<string> = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TR', 'UL',
]);

/** Elemente, deren Zellen durch ein Leerzeichen getrennt werden. */
export const CELL_TAGS: ReadonlySet<string> = new Set(['TD', 'TH']);

export interface ExtractTextOptions {
  /** Zusätzliche Sichtbarkeitsprüfung (z. B. für Live-Seiten mit berechneten Styles). */
  isHidden?: (element: Element) => boolean;
  /** Abbruch, sobald mehr als diese Zeichenzahl gesammelt wurde. */
  maxChars?: number;
}

/**
 * Extrahiert den Text eines DOM-Teilbaums in Lesereihenfolge.
 * Absätze werden durch "\n\n", harte Zeilenumbrüche (<br>) durch "\n" getrennt.
 * Die Verarbeitung ist iterativ und damit auch bei sehr tiefen DOM-Bäumen stack-sicher.
 */
export function extractTextInReadingOrder(root: Node, options: ExtractTextOptions = {}): string {
  const { isHidden, maxChars = Number.POSITIVE_INFINITY } = options;
  const out: string[] = [];
  let length = 0;

  type Separator = { separator: string };
  const stack: Array<Node | Separator> = [root];

  while (stack.length > 0 && length <= maxChars) {
    const item = stack.pop() as Node | Separator;

    if (!('nodeType' in item)) {
      out.push(item.separator);
      continue;
    }

    if (item.nodeType === 3 /* TEXT_NODE */) {
      const value = (item.nodeValue ?? '').replace(/[\t\n\r\f ]+/g, ' ');
      if (value.trim()) {
        out.push(value);
        length += value.length;
      } else if (value) {
        out.push(' ');
      }
      continue;
    }

    if (item.nodeType !== 1 /* ELEMENT_NODE */ && item.nodeType !== 9 /* DOCUMENT_NODE */ && item.nodeType !== 11) {
      continue;
    }

    let separator = '';
    if (item.nodeType === 1) {
      const element = item as Element;
      const tag = (element.localName || element.tagName).toUpperCase();

      if (SKIPPED_TAGS.has(tag)) continue;
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') continue;
      const style = (element as HTMLElement).style;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;
      if (isHidden?.(element)) continue;

      if (tag === 'BR') {
        out.push('\n');
        continue;
      }
      if (PARAGRAPH_TAGS.has(tag)) separator = '\n\n';
      else if (CELL_TAGS.has(tag)) separator = ' ';
    }

    if (separator) {
      out.push(separator);
      stack.push({ separator });
    }
    const children = item.childNodes;
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }

  return normalizeExtractedText(out.join(''));
}

/** Vereinheitlicht Leerraum im extrahierten Text (Absätze bleiben erhalten). */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Wortweise Zerlegung eines DOM-Baums (ePub-Kapitel)
// ---------------------------------------------------------------------------

/** Ein zusammenhängender Abschnitt eines Textknotens, der zu einem Wort gehört. */
export interface DomWordSegment {
  node: Text;
  start: number;
  end: number;
}

export interface DomWord {
  /** Bereinigter Text des Wortes (wie im Reader angezeigt). */
  text: string;
  /** Fundstellen im DOM (leer, wenn `trackSegments` ausgeschaltet ist). */
  segments: DomWordSegment[];
}

export interface CollectDomWordsOptions {
  /** Speichert für jedes Wort die Textknoten-Abschnitte (nötig für Hervorhebungen). */
  trackSegments?: boolean;
}

export interface CollectedDomWords {
  words: DomWord[];
  /** Indices der Wörter, die einen neuen Absatz beginnen (enthält 0, sobald Wörter existieren). */
  paragraphStarts: number[];
}

/**
 * Zerlegt einen DOM-Baum in Wörter – in Lesereihenfolge und mit genau den Regeln
 * der Textextraktion (übersprungene/versteckte Elemente, Absatz- und Zeilengrenzen,
 * Zusammenfügen von Text über Inline-Elemente hinweg: `<b>Hal</b>lo` → „Hallo“).
 *
 * Diese Funktion ist die EINZIGE Quelle der Wahrheit für ePub-Wörter: Der Parser
 * baut daraus die Wortliste, der Viewer ermittelt damit die Textstellen für die
 * Hervorhebung. Dadurch stimmen Wortindex und Position im Kapitel immer überein.
 */
export function collectDomWords(root: Node, options: CollectDomWordsOptions = {}): CollectedDomWords {
  const { trackSegments = false } = options;
  const words: DomWord[] = [];
  const paragraphStarts: number[] = [];

  let current: { raw: string; segments: DomWordSegment[] } | null = null;
  let paragraphPending = true;

  const finishWord = (): void => {
    if (current === null) return;
    const text = cleanText(current.raw);
    if (text) {
      if (paragraphPending) paragraphStarts.push(words.length);
      paragraphPending = false;
      words.push({ text, segments: current.segments });
    }
    current = null;
  };

  const startParagraph = (): void => {
    finishWord();
    paragraphPending = true;
  };

  type Closer = { close: 'paragraph' | 'cell' };
  const stack: Array<Node | Closer> = [root];

  while (stack.length > 0) {
    const item = stack.pop() as Node | Closer;

    if (!('nodeType' in item)) {
      if (item.close === 'paragraph') startParagraph();
      else finishWord();
      continue;
    }

    if (item.nodeType === 3 /* TEXT_NODE */) {
      scanTextNode(item as Text);
      continue;
    }

    if (item.nodeType !== 1 && item.nodeType !== 9 && item.nodeType !== 11) continue;

    if (item.nodeType === 1) {
      const element = item as Element;
      const tag = (element.localName || element.tagName).toUpperCase();

      if (SKIPPED_TAGS.has(tag)) continue;
      if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') continue;
      const style = (element as HTMLElement).style;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;

      if (tag === 'BR') {
        finishWord();
        continue;
      }
      if (PARAGRAPH_TAGS.has(tag)) {
        startParagraph();
        stack.push({ close: 'paragraph' });
      } else if (CELL_TAGS.has(tag)) {
        finishWord();
        stack.push({ close: 'cell' });
      }
    }

    const children = item.childNodes;
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  finishWord();

  return { words, paragraphStarts };

  /**
   * Zerlegt einen Textknoten in Wörter. Unsichtbare Zeichen (Soft-Hyphen, Zero-Width)
   * werden durch NUL gleicher Länge ersetzt: Die Offsets bleiben gültig, das Zeichen
   * gehört weiterhin zum Wort (wie bei der Textbereinigung) und wird von `cleanText`
   * entfernt. Ein Wort, das nur daraus besteht, entfällt ganz.
   */
  function scanTextNode(textNode: Text): void {
    const data = (textNode.data ?? '').replace(INVISIBLE_CHARS_RE, '\u0000');
    const re = /\S+/g;
    let lastEnd = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(data)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Leerraum vor dem Treffer beendet das offene Wort (auch eines aus dem Vorgängerknoten).
      if (start > lastEnd) finishWord();

      if (current === null) current = { raw: '', segments: [] };
      current.raw += match[0];
      if (trackSegments) current.segments.push({ node: textNode, start, end });
      lastEnd = end;
    }

    // Leerraum am Ende des Knotens (oder ein reiner Leerraum-Knoten) schließt das Wort ab.
    if (data.length > lastEnd) finishWord();
  }
}
