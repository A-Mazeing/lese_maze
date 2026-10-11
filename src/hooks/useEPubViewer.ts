import { useCallback, useEffect, useRef, useState } from 'react';
import type { Contents, Rendition } from 'epubjs';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useReaderDispatch,
  useReaderDocuments,
  useReaderSelector,
  useReaderStore,
} from '@/contexts/ReaderContext';
import { collectDomWords, type DomWord } from '@/utils/htmlText';
import { createWordRange, findWordAtPoint, selectionToWordSpan, type WordSpan } from '@/utils/epubWordMap';
import type { Chapter } from '@/types';
import { t } from '@/i18n';

/** Name der CSS-Hervorhebung im Buch-iframe (CSS Custom Highlight API). */
const HIGHLIGHT_NAME = 'rsvp-current';
/** So viele Kapitel-Wortlisten bleiben im Speicher (aktuelles + angrenzende). */
const MAX_CACHED_SECTIONS = 3;
/** Rand (px), den das aktuelle Wort zum Sichtbereich einhalten soll, bevor gescrollt wird. */
const FOLLOW_MARGIN_PX = 48;

export interface EPubViewerStatus {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Spine-Index des aktuell angezeigten Kapitels (-1 solange nichts angezeigt wird). */
  spineIndex: number;
}

export interface EPubViewerCallbacks {
  /** Der Benutzer hat im Buch Text markiert. `position` ist in Fensterkoordinaten. */
  onSelectWords?: (span: WordSpan, position: { x: number; y: number }) => void;
}

interface SectionWords {
  document: Document;
  words: DomWord[];
}

const themeRules = (dark: boolean) => ({
  body: {
    color: `${dark ? '#e5e7eb' : '#111827'} !important`,
    'background-color': `${dark ? '#111827' : '#ffffff'} !important`,
    'line-height': '1.7 !important',
  },
  'a, a:visited': { color: `${dark ? '#93c5fd' : '#1d4ed8'} !important` },
  [`::highlight(${HIGHLIGHT_NAME})`]: {
    'background-color': dark ? 'rgba(59, 130, 246, 0.55)' : 'rgba(250, 204, 21, 0.6)',
    color: 'inherit',
  },
});

function chapterForWord(chapters: readonly Chapter[], wordIndex: number): Chapter | undefined {
  let lo = 0;
  let hi = chapters.length - 1;
  let found: Chapter | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (chapters[mid].startIndex <= wordIndex) {
      found = chapters[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Zeigt das geöffnete ePub mit epub.js (ein Kapitel pro Ansicht, scrollend) und hält die
 * Hervorhebung des aktuellen RSVP-Wortes synchron.
 *
 * Wortindex ↔ Textstelle: Beim Laden jedes Kapitels wird `collectDomWords` – dieselbe Funktion
 * wie im Parser – über das gerenderte DOM ausgeführt. Dadurch entspricht Wort Nr. n eines
 * Kapitels exakt Wort Nr. n im Reader; es werden keine Schätzungen über CFIs benötigt.
 */
export function useEPubViewer(callbacks: EPubViewerCallbacks = {}) {
  const { resolvedTheme } = useTheme();
  const dispatch = useReaderDispatch();
  const store = useReaderStore();
  const { getEpubBook } = useReaderDocuments();

  const documentId = useReaderSelector((s) => s.metadata.documentId ?? null);
  const chapters = useReaderSelector((s) => s.metadata.chapters);
  const currentIndex = useReaderSelector((s) => s.currentIndex);
  const isPlaying = useReaderSelector((s) => s.isPlaying);

  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const sectionWords = useRef(new Map<number, SectionWords>());
  const chaptersRef = useRef<readonly Chapter[]>(chapters ?? []);
  const callbacksRef = useRef(callbacks);
  const themeRef = useRef(resolvedTheme);
  // Refs erst nach dem Rendern aktualisieren (nie während des Renderns schreiben).
  useEffect(() => {
    chaptersRef.current = chapters ?? [];
    callbacksRef.current = callbacks;
    themeRef.current = resolvedTheme;
  });

  const followRef = useRef(true);
  const [detached, setDetached] = useState(false);
  const displayingRef = useRef<number | null>(null);
  const [status, setStatus] = useState<EPubViewerStatus>({ phase: 'idle', error: null, spineIndex: -1 });

  // --- Hervorhebung ----------------------------------------------------------------
  const highlight = useCallback((wordIndex: number) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const chapter = chapterForWord(chaptersRef.current, wordIndex);
    if (!chapter || chapter.spineIndex === undefined) return;

    const contents = (rendition.getContents() as unknown as Contents[]).find(
      (c) => c.sectionIndex === chapter.spineIndex,
    );
    const entry = contents ? sectionWords.current.get(chapter.spineIndex) : undefined;
    if (!contents || !entry) {
      // Kapitel ist (noch) nicht gerendert: anzeigen; die Hervorhebung folgt nach dem Rendern.
      if (displayingRef.current !== chapter.spineIndex) {
        displayingRef.current = chapter.spineIndex;
        rendition.display(chapter.spineIndex).catch((error: unknown) => {
          console.warn('[epub] Kapitel konnte nicht angezeigt werden:', error);
          displayingRef.current = null;
        });
      }
      return;
    }

    const word = entry.words[wordIndex - chapter.startIndex];
    const range = word ? createWordRange(entry.document, word) : null;
    const win = contents.window as Window & typeof globalThis;
    if (!range || !win.CSS?.highlights) return;

    win.CSS.highlights.set(HIGHLIGHT_NAME, new win.Highlight(range));

    if (!followRef.current) return;
    const frame = win.frameElement as HTMLElement | null;
    const scroller = containerRef.current;
    if (!frame || !scroller) return;
    const rect = range.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const top = frameRect.top + rect.top;
    const bottom = frameRect.top + rect.bottom;
    const visible = top >= scrollerRect.top + FOLLOW_MARGIN_PX && bottom <= scrollerRect.bottom - FOLLOW_MARGIN_PX;
    if (!visible) {
      (range.startContainer.parentElement ?? entry.document.body).scrollIntoView({ block: 'center' });
    }
  }, []);

  // --- Rendition aufbauen / abbauen ------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    const book = getEpubBook();
    if (!container || !book || !documentId) {
      setStatus({ phase: 'idle', error: null, spineIndex: -1 });
      return;
    }

    let disposed = false;
    setStatus({ phase: 'loading', error: null, spineIndex: -1 });
    const cache = sectionWords.current;

    try {
      const rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        flow: 'scrolled-doc',
        spread: 'none',
        allowScriptedContent: false, // Skripte im Buch bleiben gesperrt (sandboxed iframe)
      });
      renditionRef.current = rendition;
      rendition.themes.default(themeRules(themeRef.current === 'dark'));

      // Wird für jedes geladene Kapitel aufgerufen, bevor es sichtbar wird.
      rendition.hooks.content.register((contents: Contents) => {
        const spineIndex = contents.sectionIndex;
        const doc = contents.document;
        const root = doc.body ?? doc.documentElement;
        cache.set(spineIndex, { document: doc, words: collectDomWords(root, { trackSegments: true }).words });
        while (cache.size > MAX_CACHED_SECTIONS) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          cache.delete(oldest);
        }

        const markDetached = () => {
          if (!store.getState().isPlaying) return;
          followRef.current = false;
          setDetached(true);
        };
        doc.addEventListener('wheel', markDetached, { passive: true });
        doc.addEventListener('touchmove', markDetached, { passive: true });

        doc.addEventListener('mouseup', (event: MouseEvent) => {
          const words = cache.get(spineIndex)?.words;
          const win = contents.window;
          const selection = win.getSelection();
          if (!words || !selection || selection.rangeCount === 0) return;
          const chapter = chaptersRef.current.find((c) => c.spineIndex === spineIndex);
          if (!chapter) return;

          const frame = win.frameElement as HTMLElement | null;
          const frameRect = frame?.getBoundingClientRect();
          const position = {
            x: (frameRect?.left ?? 0) + event.clientX,
            y: (frameRect?.top ?? 0) + event.clientY,
          };

          if (selection.isCollapsed) {
            // Einfacher Klick: RSVP springt zum angeklickten Wort.
            if (!selection.anchorNode) return;
            const local = findWordAtPoint(doc, words, selection.anchorNode, selection.anchorOffset);
            if (local >= 0) dispatch({ type: 'SET_INDEX', payload: chapter.startIndex + local });
            return;
          }
          const span = selectionToWordSpan(doc, words, selection.getRangeAt(0));
          if (span) {
            callbacksRef.current.onSelectWords?.(
              { start: chapter.startIndex + span.start, end: chapter.startIndex + span.end },
              position,
            );
          }
        });
      });

      rendition.on('rendered', (section: { index: number }) => {
        if (disposed) return;
        displayingRef.current = null;
        setStatus({ phase: 'ready', error: null, spineIndex: section.index });
        highlight(store.getState().currentIndex);
      });

      const startChapter = chapterForWord(chaptersRef.current, store.getState().currentIndex);
      Promise.resolve(rendition.display(startChapter?.spineIndex ?? 0)).catch((error: unknown) => {
        if (disposed) return;
        const message = error instanceof Error ? error.message : t('epub.chapterFailed');
        setStatus({ phase: 'error', error: message, spineIndex: -1 });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('epub.viewerFailed');
      // Asynchron melden: kein setState im synchronen Teil des Effekts.
      queueMicrotask(() => {
        if (!disposed) setStatus({ phase: 'error', error: message, spineIndex: -1 });
      });
    }

    return () => {
      disposed = true;
      cache.clear();
      displayingRef.current = null;
      const rendition = renditionRef.current;
      renditionRef.current = null;
      try {
        rendition?.destroy();
      } catch (error) {
        console.warn('[epub] Rendition konnte nicht freigegeben werden:', error);
      }
    };
  }, [documentId, dispatch, getEpubBook, highlight, store]);

  // --- Synchronisation mit dem RSVP-Index ------------------------------------------
  useEffect(() => {
    if (status.phase === 'ready') highlight(currentIndex);
  }, [currentIndex, status.phase, highlight]);

  // Beim Start der Wiedergabe wieder mitlaufen.
  useEffect(() => {
    if (isPlaying) followRef.current = true;
  }, [isPlaying]);
  const [wasPlaying, setWasPlaying] = useState(isPlaying);
  if (wasPlaying !== isPlaying) {
    setWasPlaying(isPlaying);
    if (isPlaying) setDetached(false);
  }

  // --- Theme -------------------------------------------------------------------------
  useEffect(() => {
    renditionRef.current?.themes.default(themeRules(resolvedTheme === 'dark'));
  }, [resolvedTheme]);

  // --- Navigation --------------------------------------------------------------------
  const goToChapter = useCallback(
    (chapterIndex: number) => {
      const chapter = chaptersRef.current[chapterIndex];
      if (!chapter) return;
      followRef.current = true;
      setDetached(false);
      dispatch({ type: 'SET_INDEX', payload: chapter.startIndex });
      // Ist das Kapitel schon sichtbar, ändert sich kein Wort-Index-Effekt → explizit hervorheben.
      highlight(chapter.startIndex);
    },
    [dispatch, highlight],
  );

  const resumeFollowing = useCallback(() => {
    followRef.current = true;
    setDetached(false);
    highlight(store.getState().currentIndex);
  }, [highlight, store]);

  return { containerRef, status, detached, goToChapter, resumeFollowing };
}
