import type { Book } from 'epubjs';
import type { Chapter } from '@/types';
import { collectDomWords } from './htmlText';
import { buildTextStructure } from './textProcessor';
import { t } from '@/i18n';

/**
 * Struktur der epub.js-Objekte, soweit wir sie benutzen. Die mitgelieferten Typen
 * sind an diesen Stellen ungenau (z. B. `Section.load()` als synchron deklariert,
 * `Spine.items` fehlt) und werden deshalb hier lokal korrekt beschrieben.
 */
interface SpineItemData {
  href?: string;
  idref?: string;
  index?: number;
  linear?: string | boolean;
}

interface SectionLike extends SpineItemData {
  document?: Document;
  load(request: (path: string) => Promise<unknown>): Promise<unknown>;
  unload?(): void;
}

interface SpineLike {
  items?: SpineItemData[];
  get(target: number): SectionLike | null;
}

interface TocItem {
  href: string;
  label: string;
  subitems?: TocItem[];
}

export interface ParsedEpub {
  title: string | null;
  author: string | null;
  words: string[];
  sentenceBreaks: number[];
  paragraphBreaks: number[];
  chapters: Chapter[];
  /** Anzahl der Spine-Einträge, die nicht gelesen werden konnten. */
  skippedSections: number;
}

export interface ParseEpubOptions {
  signal?: AbortSignal;
  onProgress?(done: number, total: number): void;
}

export class EpubParseAborted extends Error {
  constructor() {
    super(t('load.aborted'));
    this.name = 'EpubParseAborted';
  }
}

const MAX_TITLE_LENGTH = 80;

/** Entfernt Fragment, Query sowie führende "./" und "../" – für den Vergleich von Pfaden. */
export function normalizeHref(href: string): string {
  let path = href.split('#')[0].split('?')[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    /* ungültige Prozent-Kodierung: unverändert vergleichen */
  }
  return path.replace(/^(?:\.{1,2}\/)+/, '').replace(/^\/+/, '');
}

/** Zwei hrefs gelten als gleich, wenn einer ein Pfad-Suffix des anderen ist ("text/ch1.xhtml" ≙ "ch1.xhtml"). */
export function hrefsMatch(a: string, b: string): boolean {
  const left = normalizeHref(a);
  const right = normalizeHref(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function flattenToc(items: readonly TocItem[] | undefined, out: TocItem[] = []): TocItem[] {
  for (const item of items ?? []) {
    out.push(item);
    flattenToc(item.subitems, out);
  }
  return out;
}

function findTocTitle(toc: readonly TocItem[], sectionHref: string | undefined): string | null {
  if (!sectionHref) return null;
  const match = toc.find((item) => hrefsMatch(item.href, sectionHref));
  const label = match?.label?.replace(/\s+/g, ' ').trim();
  return label || null;
}

function findHeading(doc: Document | undefined): string | null {
  const heading = doc?.querySelector('h1, h2, h3');
  const text = heading?.textContent?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH - 1)}…` : text;
}

function isLinear(item: SpineItemData): boolean {
  return item.linear !== 'no' && item.linear !== false;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new EpubParseAborted();
}

/**
 * Liest Text, Kapitelstruktur und Satz-/Absatzgrenzen aus einem geöffneten ePub.
 *
 * - Ein Kapitel entspricht einem Spine-Eintrag (nur "lineare" Einträge, wie auch die
 *   Seitenansicht sie durchläuft). Dadurch passt `Chapter.spineIndex` zur Navigation im Viewer.
 * - Der Text kommt aus `collectDomWords` – derselben Funktion, mit der der Viewer später
 *   Wörter im gerenderten Kapitel lokalisiert.
 * - Jeder Abschnitt wird nach dem Lesen entladen, damit nicht alle DOMs gleichzeitig im
 *   Speicher liegen.
 */
export async function parseEpubBook(book: Book, options: ParseEpubOptions = {}): Promise<ParsedEpub> {
  const { signal, onProgress } = options;

  await book.ready;
  throwIfAborted(signal);

  const spine = book.spine as unknown as SpineLike;
  const items = spine.items ?? [];
  if (items.length === 0) throw new Error(t('epub.noContent'));

  const navigation = await book.loaded.navigation.catch(() => null);
  const toc = flattenToc((navigation?.toc ?? []) as unknown as TocItem[]);
  const metadata = book.packaging?.metadata;

  const linearIndices = items.map((item, index) => (isLinear(item) ? index : -1)).filter((i) => i >= 0);
  // Enthält das Buch ausschließlich nicht-lineare Einträge, werden alle gelesen.
  const indices = linearIndices.length > 0 ? linearIndices : items.map((_, i) => i);

  const words: string[] = [];
  const paragraphStarts: number[] = [];
  const chapters: Chapter[] = [];
  let skippedSections = 0;

  const request = book.load.bind(book) as (path: string) => Promise<unknown>;

  for (let n = 0; n < indices.length; n++) {
    throwIfAborted(signal);
    onProgress?.(n, indices.length);

    const spineIndex = indices[n];
    const section = spine.get(spineIndex);
    if (!section) {
      skippedSections++;
      continue;
    }

    try {
      await section.load(request);
      throwIfAborted(signal);

      const doc = section.document;
      const root = doc?.body ?? doc?.querySelector('body') ?? doc?.documentElement;
      if (!doc || !root) {
        skippedSections++;
        continue;
      }

      const collected = collectDomWords(root);
      if (collected.words.length === 0) continue; // z. B. Cover-Seite nur mit Bild

      const startIndex = words.length;
      for (const word of collected.words) words.push(word.text);
      for (const start of collected.paragraphStarts) paragraphStarts.push(startIndex + start);

      const chapterIndex = chapters.length;
      const title =
        findTocTitle(toc, section.href ?? items[spineIndex].href) ??
        findHeading(doc) ??
        `Abschnitt ${chapterIndex + 1}`;

      chapters.push({
        id: `chapter-${chapterIndex}`,
        title,
        startIndex,
        endIndex: words.length - 1,
        spineIndex,
        href: section.href ?? items[spineIndex].href,
      });
    } catch (error) {
      if (error instanceof EpubParseAborted) throw error;
      skippedSections++;
      console.warn(`[epub] Abschnitt ${spineIndex} (${section.href ?? 'unbekannt'}) übersprungen:`, error);
    } finally {
      try {
        section.unload?.();
      } catch {
        /* Entladen ist reine Speicherpflege */
      }
    }
  }
  onProgress?.(indices.length, indices.length);

  if (words.length === 0) {
    throw new Error(
      skippedSections > 0
        ? t('epub.unreadable')
        : t('epub.noText'),
    );
  }

  const structure = buildTextStructure(words, paragraphStarts);
  return {
    title: metadata?.title?.trim() || null,
    author: metadata?.creator?.trim() || null,
    words,
    sentenceBreaks: structure.sentenceBreaks,
    paragraphBreaks: structure.paragraphBreaks,
    chapters,
    skippedSections,
  };
}
