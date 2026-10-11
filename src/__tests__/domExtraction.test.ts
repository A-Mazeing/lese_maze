import { describe, it, expect, afterEach } from 'vitest';
import { collectDomWords, extractTextInReadingOrder } from '@/utils/htmlText';
import { extractPageInPage } from '@/background/pageExtractor';
import { createWordRange, findWordAtPoint, selectionToWordSpan } from '@/utils/epubWordMap';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.title = '';
  window.getSelection()?.removeAllRanges();
});

describe('extractTextInReadingOrder', () => {
  it('separates paragraphs, keeps <br> as line break, joins inline text', () => {
    const root = mount('<p>Erster<br>Zeile</p><div>Zwei <b>fett</b>er</div><table><tr><td>a</td><td>b</td></tr></table>');
    expect(extractTextInReadingOrder(root)).toBe('Erster\nZeile\n\nZwei fetter\n\na b');
  });

  it('skips scripts, hidden elements and aria-hidden content', () => {
    const root = mount(
      '<p>sichtbar</p><script>x()</script><p hidden>weg</p><p aria-hidden="true">auch weg</p><p style="display:none">nein</p>',
    );
    expect(extractTextInReadingOrder(root)).toBe('sichtbar');
  });

  it('survives extremely deep DOM trees', () => {
    // Der Baum wird iterativ aufgebaut; jsdoms eigene (rekursive) Aufräumroutine begrenzt die Tiefe.
    const root = document.createElement('div');
    let node: HTMLElement = root;
    for (let i = 0; i < 1500; i++) {
      const child = document.createElement('span');
      node.appendChild(child);
      node = child;
    }
    node.textContent = 'tief';
    expect(extractTextInReadingOrder(root)).toBe('tief');
    expect(collectDomWords(root).words.map((w) => w.text)).toEqual(['tief']);
  });

  it('stops collecting at maxChars', () => {
    const root = mount(Array.from({ length: 200 }, (_, i) => `<p>Absatz ${i}</p>`).join(''));
    expect(extractTextInReadingOrder(root, { maxChars: 50 }).length).toBeLessThan(300);
  });
});

describe('extractPageInPage', () => {
  const content = (n = 1) => `<p>${'Lorem ipsum dolor sit amet. '.repeat(20 * n)}</p>`;

  it('reads the main content and ignores navigation and footer', () => {
    mount(`<nav>Menü Start</nav><main>${content()}</main><footer>Impressum</footer>`);
    document.title = 'Titel';
    const result = extractPageInPage({ maxChars: 100_000 });
    expect('text' in result).toBe(true);
    if ('text' in result) {
      expect(result.text).toContain('Lorem ipsum');
      expect(result.text).not.toContain('Menü');
      expect(result.text).not.toContain('Impressum');
      expect(result).toMatchObject({ title: 'Titel', fromSelection: false, truncated: false });
    }
  });

  it('prefers the selected text', () => {
    mount(`<main>${content()}</main><p id="sel">Nur diese Stelle</p>`);
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('sel')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const result = extractPageInPage({ maxChars: 100_000 });
    expect(result).toMatchObject({ text: 'Nur diese Stelle', fromSelection: true });
  });

  it('truncates at a word boundary and reports it', () => {
    mount(`<main>${content(10)}</main>`);
    const result = extractPageInPage({ maxChars: 500 });
    expect('text' in result && result.truncated).toBe(true);
    if ('text' in result) expect(result.text.length).toBeLessThanOrEqual(500);
  });

  it('returns a readable error for empty pages', () => {
    mount('<div></div>');
    const result = extractPageInPage({ maxChars: 1000 });
    expect(result).toEqual({ error: 'NO_READABLE_TEXT' });
  });

  it('produces the same words as the shared extractor (parity)', () => {
    const html = `<p>Erster <b>Ab</b>satz mit Umlaut&shy;en.</p><p>Zweiter<br>Absatz</p><ul><li>eins</li><li>zwei</li></ul>
      <table><tr><th>K</th><td>V</td></tr></table><p hidden>unsichtbar</p><script>1</script><p>Ende&nbsp;hier</p>`;
    const root = mount(html);
    const shared = extractTextInReadingOrder(root).split(/\s+/).filter(Boolean);
    const page = extractPageInPage({ maxChars: 100_000 });
    expect('text' in page).toBe(true);
    if ('text' in page) expect(page.text.split(/\s+/).filter(Boolean)).toEqual(shared);
  });
});

describe('collectDomWords', () => {
  it('merges words across inline elements and records paragraph starts', () => {
    const root = mount('<p><b>Hal</b>lo Welt</p><p>Zwei</p>');
    const { words, paragraphStarts } = collectDomWords(root);
    expect(words.map((w) => w.text)).toEqual(['Hallo', 'Welt', 'Zwei']);
    expect(paragraphStarts).toEqual([0, 2]);
  });

  it('removes invisible characters and ignores hidden content', () => {
    const root = mount('<p>Sil­ben</p><p hidden>weg</p><p>da</p>');
    expect(collectDomWords(root).words.map((w) => w.text)).toEqual(['Silben', 'da']);
  });

  it('tracks DOM segments only on request', () => {
    const root = mount('<p>ein Wort</p>');
    expect(collectDomWords(root).words[0].segments).toEqual([]);
    expect(collectDomWords(root, { trackSegments: true }).words[0].segments.length).toBeGreaterThan(0);
  });

  it('matches the word count of the plain-text extractor', () => {
    const root = mount('<h1>Titel</h1><p>Ein <i>kurzer</i> Absatz.</p><div>Noch<br>mehr</div>');
    const fromText = extractTextInReadingOrder(root).split(/\s+/).filter(Boolean);
    expect(collectDomWords(root).words.map((w) => w.text)).toEqual(fromText);
  });
});

describe('epubWordMap', () => {
  function prepare() {
    const root = mount('<p>Alpha <b>Be</b>ta Gamma</p><p>Delta</p>');
    const { words } = collectDomWords(root, { trackSegments: true });
    return { root, words }; // Alpha, Beta, Gamma, Delta
  }

  it('creates a range covering a word that spans inline elements', () => {
    const { words } = prepare();
    expect(words.map((w) => w.text)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(createWordRange(document, words[1])?.toString()).toBe('Beta');
  });

  it('returns null for words without segments', () => {
    expect(createWordRange(document, { text: 'x', segments: [] })).toBeNull();
  });

  it('finds the word at a caret position', () => {
    const { words } = prepare();
    const gamma = words[2].segments[0];
    expect(findWordAtPoint(document, words, gamma.node, gamma.start + 2)).toBe(2);
    const alpha = words[0].segments[0];
    expect(findWordAtPoint(document, words, alpha.node, 0)).toBe(0);
    expect(findWordAtPoint(document, [], alpha.node, 0)).toBe(-1);
  });

  it('maps a selection to the touched word span', () => {
    const { words } = prepare();
    const range = document.createRange();
    const beta = words[1].segments;
    range.setStart(beta[0].node, beta[0].start + 1);
    const gamma = words[2].segments[0];
    range.setEnd(gamma.node, gamma.start + 2);
    expect(selectionToWordSpan(document, words, range)).toEqual({ start: 1, end: 2 });
  });

  it('returns null for a selection after the last word', () => {
    const { root, words } = prepare();
    root.appendChild(document.createTextNode('   '));
    const tail = root.lastChild!;
    const range = document.createRange();
    range.setStart(tail, 1);
    range.setEnd(tail, 2);
    expect(selectionToWordSpan(document, words, range)).toBeNull();
  });
});
