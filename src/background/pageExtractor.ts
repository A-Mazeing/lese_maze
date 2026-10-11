import type { ExtractedPage } from '@/types/messages';

export interface PageExtractionOptions {
  maxChars: number;
}

/** Ergebnis der Seiten-Extraktion: Inhalt oder lesbare Fehlermeldung. */
export type PageExtractionResult = ExtractedPage | { error: string };

/**
 * Liest den lesbaren Text der aktuellen Seite.
 *
 * ACHTUNG – Ausführungskontext: Diese Funktion wird mit `chrome.scripting.executeScript({ func })`
 * in die Webseite injiziert. Chrome überträgt dabei nur ihren Quelltext; sie darf deshalb
 * KEINE Importe, Modul-Konstanten oder Hilfsfunktionen von außen verwenden – alles Nötige
 * ist hier drin definiert. Der Block-Algorithmus entspricht `extractTextInReadingOrder`
 * (src/utils/htmlText.ts); ein Test stellt sicher, dass beide dasselbe Ergebnis liefern.
 */
export function extractPageInPage(options: PageExtractionOptions): PageExtractionResult {
  const maxChars = options.maxChars;

  const SKIPPED = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE',
    'SVG', 'MATH', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'PICTURE',
    'SELECT', 'OPTION', 'TEXTAREA', 'INPUT', 'BUTTON',
  ]);
  const PARAGRAPH = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TR', 'UL',
  ]);
  const CELLS = new Set(['TD', 'TH']);
  // Seitenelemente, die nicht zum Fließtext gehören.
  const BOILERPLATE_TAGS = new Set(['NAV', 'ASIDE', 'FOOTER']);
  const BOILERPLATE_ROLES = new Set(['navigation', 'complementary', 'contentinfo', 'banner', 'search']);
  const BOILERPLATE_SELECTOR = '.sidebar, .navigation, .menu, .comments, .advertisement, .ad, .cookie-banner';

  const doc = document;
  const win = window;

  function isHiddenByStyle(element: Element): boolean {
    try {
      const style = win.getComputedStyle(element);
      return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse';
    } catch {
      return false;
    }
  }

  function isBoilerplate(element: Element, tag: string, insideContent: boolean): boolean {
    if (BOILERPLATE_TAGS.has(tag)) return true;
    // <header> innerhalb von <article>/<main> enthält meist die Überschrift – behalten.
    if (tag === 'HEADER' && !insideContent) return true;
    const role = element.getAttribute('role');
    if (role && BOILERPLATE_ROLES.has(role) && !(role === 'banner' && insideContent)) return true;
    try {
      return element.matches(BOILERPLATE_SELECTOR);
    } catch {
      return false;
    }
  }

  function normalize(raw: string): string {
    return raw
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Iterative Textextraktion (stack-sicher bei sehr tiefen DOM-Bäumen). */
  function extractText(root: Node, filterBoilerplate: boolean, insideContentInitially: boolean): string {
    const out: string[] = [];
    let length = 0;
    const stack: Array<Node | { separator: string } | { leave: true }> = [root];
    let contentDepth = insideContentInitially ? 1 : 0;

    while (stack.length > 0 && length <= maxChars) {
      const item = stack.pop() as Node | { separator: string } | { leave: true };

      if (!('nodeType' in item)) {
        if ('separator' in item) out.push(item.separator);
        else contentDepth--;
        continue;
      }

      if (item.nodeType === 3) {
        const value = (item.nodeValue || '').replace(/[\t\n\r\f ]+/g, ' ');
        if (value.trim()) {
          out.push(value);
          length += value.length;
        } else if (value) {
          out.push(' ');
        }
        continue;
      }

      if (item.nodeType !== 1 && item.nodeType !== 9 && item.nodeType !== 11) continue;

      let separator = '';
      let entersContent = false;
      if (item.nodeType === 1) {
        const element = item as Element;
        const tag = (element.localName || element.tagName).toUpperCase();

        if (SKIPPED.has(tag)) continue;
        if (element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') continue;
        if (isHiddenByStyle(element)) continue;
        if (filterBoilerplate && isBoilerplate(element, tag, contentDepth > 0)) continue;

        if (tag === 'BR') {
          out.push('\n');
          continue;
        }
        if (PARAGRAPH.has(tag)) separator = '\n\n';
        else if (CELLS.has(tag)) separator = ' ';
        entersContent = tag === 'ARTICLE' || tag === 'MAIN' || element.getAttribute('role') === 'main';
      }

      if (separator) {
        out.push(separator);
        stack.push({ separator });
      }
      if (entersContent) {
        contentDepth++;
        stack.push({ leave: true });
      }
      const children = item.childNodes;
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }

    return normalize(out.join(''));
  }

  function textLength(element: Element): number {
    return (element.textContent || '').trim().length;
  }

  /** Wählt das Element mit dem Hauptinhalt: größter Treffer unter den üblichen Kandidaten. */
  function findMainElement(): { element: Element; isContent: boolean } {
    const candidates = Array.from(
      doc.querySelectorAll('article, main, [role="main"], #content, #main, .post-content, .article-content, .entry-content'),
    );
    let best: Element | null = null;
    let bestLength = 0;
    for (const candidate of candidates) {
      const length = textLength(candidate);
      if (length > bestLength) {
        best = candidate;
        bestLength = length;
      }
    }
    const bodyLength = doc.body ? textLength(doc.body) : 0;
    // Ein winziger Treffer (z. B. ein Teaser-<article>) ist kein Hauptinhalt.
    if (best && bestLength >= 400 && bestLength >= bodyLength * 0.2) {
      return { element: best, isContent: true };
    }
    return { element: (doc.body || doc.documentElement) as Element, isContent: false };
  }

  function truncate(text: string): { text: string; truncated: boolean } {
    if (text.length <= maxChars) return { text, truncated: false };
    const cut = text.slice(0, maxChars);
    const lastSpace = cut.search(/\s\S*$/);
    return { text: (lastSpace > maxChars * 0.9 ? cut.slice(0, lastSpace) : cut).trimEnd(), truncated: true };
  }

  try {
    const meta = { title: doc.title || '', url: win.location.href };

    // 1. Markierter Text hat Vorrang.
    const selection = win.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
      const holder = doc.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        holder.appendChild(selection.getRangeAt(i).cloneContents());
      }
      const selected = extractText(holder, false, false);
      if (selected) {
        const result = truncate(selected);
        return { text: result.text, title: meta.title, url: meta.url, fromSelection: true, truncated: result.truncated };
      }
    }

    // 2. Hauptinhalt der Seite.
    const main = findMainElement();
    const text = extractText(main.element, true, main.isContent);
    if (!text) {
      return { error: 'Auf dieser Seite wurde kein lesbarer Text gefunden.' };
    }
    const result = truncate(text);
    return { text: result.text, title: meta.title, url: meta.url, fromSelection: false, truncated: result.truncated };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
