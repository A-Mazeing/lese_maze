import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { findLastAtOrBefore, getEffectiveEnd } from '@/contexts/readerReducer';
import { useReaderDispatch, useReaderSelector, useReaderStore } from '@/contexts/ReaderContext';
import type { PdfTextLayerInfo } from '@/components/pdf/PdfPage';
import { alignWordsToItems } from '@/utils/pdfAlign';
import type { DomWord, DomWordSegment } from '@/utils/htmlText';
import { createWordRange, findWordAtPoint, selectionToWordSpan, type WordSpan } from '@/utils/epubWordMap';
import type { PdfDocumentHandle } from '@/utils/pdfjs';

/** Namen der CSS-Hervorhebungen (CSS Custom Highlight API); Stile in styles/index.css. */
export const HIGHLIGHT_CURRENT = 'rsvp-current';
export const HIGHLIGHT_RANGE = 'rsvp-range';

/** Abstand zwischen den Seiten und zum Rand (px). */
export const PAGE_GAP = 12;
export const PAGE_PADDING = 16;
/** Zoomstufen relativ zur Seitenbreite. */
export const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
/** Rand (px), den das aktuelle Wort zum Sichtbereich einhalten soll, bevor gescrollt wird. */
const FOLLOW_MARGIN_PX = 64;
/** So viele Seiten über/unter dem Sichtbereich werden zusätzlich gerendert. */
const OVERSCAN_PAGES = 1;
/** Mindestens so viel Höhe wird angenommen, bis der Container vermessen ist. */
const FALLBACK_VIEWPORT_HEIGHT = 600;
const RESIZE_DEBOUNCE_MS = 150;

/** Wörter einer gerenderten Seite, die dem Textlayer zugeordnet werden konnten. */
export interface PageTextLayout {
  pageNumber: number;
  layer: HTMLElement;
  /** Zugeordnete Wörter (aufsteigend nach globalem Wortindex). */
  words: DomWord[];
  /** Globaler Wortindex je Eintrag in `words`. */
  indexes: number[];
}

export interface PdfViewerCallbacks {
  /** Der Benutzer hat Text markiert; `position` in Fensterkoordinaten. */
  onSelectWords?: (span: WordSpan, position: { x: number; y: number }) => void;
}

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

function highlightRegistry(): HighlightRegistry | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights ?? null;
}

function createHighlight(ranges: Range[]): unknown {
  const HighlightCtor = (globalThis as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  return HighlightCtor ? new HighlightCtor(...ranges) : null;
}

/** Letzter Eintrag mit Wert ≤ `value` (aufsteigend sortiertes Array) bzw. der erste, falls keiner existiert. */
function nearestIndex(sorted: readonly number[], value: number): number {
  const i = findLastAtOrBefore(sorted, value);
  return i >= 0 ? i : 0;
}

/**
 * Logik der PDF-Seitenansicht:
 *  - Seitenlayout (Zoom, Fit-to-Width) und Virtualisierung (nur sichtbare Seiten + 1 werden gerendert)
 *  - Zuordnung RSVP-Wörter ↔ Textlayer (pro gerenderter Seite, siehe utils/pdfAlign)
 *  - Hervorhebung des aktuellen Wortes und des Lesebereichs (CSS Custom Highlight API)
 *  - Mitlaufen während der Wiedergabe (löst sich, sobald der Benutzer selbst scrollt)
 *  - Klick auf ein Wort, Markieren mit Kontextmenü, Seitennavigation
 */
export function usePdfViewer(handle: PdfDocumentHandle, callbacks: PdfViewerCallbacks = {}) {
  const store = useReaderStore();
  const dispatch = useReaderDispatch();
  const pageBreaks = useReaderSelector((s) => s.metadata.pageBreaks);
  const currentIndex = useReaderSelector((s) => s.currentIndex);
  const wordsPerChunk = useReaderSelector((s) => s.wordsPerChunk);
  const startIndex = useReaderSelector((s) => s.startIndex);
  const endIndex = useReaderSelector((s) => s.endIndex);
  const isPlaying = useReaderSelector((s) => s.isPlaying);

  const { pageSizes } = handle;
  const pageCount = pageSizes.length;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [detached, setDetached] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);

  const followRef = useRef(true);
  const layoutsRef = useRef(new Map<number, PageTextLayout>());
  const callbacksRef = useRef(callbacks);
  const pageBreaksRef = useRef<readonly number[]>(pageBreaks ?? []);
  useEffect(() => {
    callbacksRef.current = callbacks;
    pageBreaksRef.current = pageBreaks ?? [];
  });

  // --- Container vermessen ---------------------------------------------------------
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let first = true;

    const measure = () => {
      timer = null;
      setViewport((prev) =>
        prev.width === scroller.clientWidth && prev.height === scroller.clientHeight
          ? prev
          : { width: scroller.clientWidth, height: scroller.clientHeight },
      );
    };
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        measure();
        return;
      }
      // Beim Ziehen der Fenstergröße nicht bei jedem Pixel neu rendern.
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(scroller);
    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  // --- Layout --------------------------------------------------------------------
  const maxPageWidth = useMemo(() => pageSizes.reduce((max, size) => Math.max(max, size.width), 1), [pageSizes]);
  const fitScale = viewport.width > 0 ? (viewport.width - 2 * PAGE_PADDING) / maxPageWidth : 1;
  // Auf drei Nachkommastellen runden: winzige Unterschiede sollen kein Neu-Rendern auslösen.
  const scale = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale * zoom)) * 1000) / 1000;

  const layout = useMemo(() => {
    const tops: number[] = [];
    const heights: number[] = [];
    const widths: number[] = [];
    let y = PAGE_PADDING;
    for (const size of pageSizes) {
      const width = Math.round(size.width * scale);
      const height = Math.round(size.height * scale);
      tops.push(y);
      heights.push(height);
      widths.push(width);
      y += height + PAGE_GAP;
    }
    const contentWidth = Math.max(viewport.width, Math.round(maxPageWidth * scale) + 2 * PAGE_PADDING);
    return { tops, heights, widths, contentWidth, contentHeight: y - PAGE_GAP + PAGE_PADDING };
  }, [pageSizes, scale, viewport.width, maxPageWidth]);

  const pageAtOffset = useCallback(
    (offset: number): number => {
      const i = findLastAtOrBefore(layout.tops, offset);
      return Math.max(0, i);
    },
    [layout.tops],
  );

  // Beim Ändern des Maßstabs (Zoom, Fenstergröße) an derselben Stelle im Dokument bleiben.
  const anchorRef = useRef({ page: 0, fraction: 0 });
  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const page = pageAtOffset(scroller.scrollTop);
    const height = Math.max(1, layout.heights[page] ?? 1);
    anchorRef.current = { page, fraction: Math.max(0, (scroller.scrollTop - layout.tops[page]) / height) };
    setScrollTop(scroller.scrollTop);
  }, [layout.heights, layout.tops, pageAtOffset]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || layout.tops.length === 0) return;
    const { page, fraction } = anchorRef.current;
    const target = (layout.tops[page] ?? 0) + fraction * (layout.heights[page] ?? 0);
    if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target;
  }, [layout]);

  // Sichtbare Seiten (abgeleitet, kein Zustand): erste/letzte Seite im Sichtbereich ± Überhang.
  const visible = useMemo(() => {
    const height = viewport.height || FALLBACK_VIEWPORT_HEIGHT;
    const first = pageAtOffset(scrollTop);
    const last = pageAtOffset(scrollTop + height);
    return {
      from: Math.max(0, first - OVERSCAN_PAGES),
      to: Math.min(pageCount - 1, last + OVERSCAN_PAGES),
      current: pageAtOffset(scrollTop + height * 0.3) + 1,
    };
  }, [pageAtOffset, scrollTop, viewport.height, pageCount]);

  // --- Wort ↔ Seite ---------------------------------------------------------------
  const pageOfWord = useCallback((wordIndex: number): number => {
    const breaks = pageBreaksRef.current;
    if (breaks.length === 0) return -1;
    // Bei gleichen Startindizes (leere Seiten) gewinnt die letzte: nur sie besitzt die Wörter.
    return findLastAtOrBefore(breaks, wordIndex) + 1;
  }, []);

  /** Textlayer einer Seite wurde gerendert (info) bzw. entfernt (null). */
  const registerTextLayer = useCallback(
    (pageNumber: number, info: PdfTextLayerInfo | null) => {
      if (!info) {
        if (layoutsRef.current.delete(pageNumber)) setLayoutVersion((v) => v + 1);
        return;
      }
      const breaks = pageBreaksRef.current;
      const state = store.getState();
      const first = breaks[pageNumber - 1] ?? state.words.length;
      const last = breaks[pageNumber] ?? state.words.length;
      const pageWords = state.words.slice(first, last);
      const alignment = alignWordsToItems(info.itemTexts, pageWords);

      const words: DomWord[] = [];
      const indexes: number[] = [];
      pageWords.forEach((text, local) => {
        const segments: DomWordSegment[] = [];
        for (const segment of alignment.segments[local]) {
          const node = info.textDivs[segment.item]?.firstChild;
          if (node && node.nodeType === 3) {
            segments.push({ node: node as Text, start: segment.start, end: segment.end });
          }
        }
        if (segments.length > 0) {
          words.push({ text, segments });
          indexes.push(first + local);
        }
      });

      layoutsRef.current.set(pageNumber, { pageNumber, layer: info.layer, words, indexes });
      setLayoutVersion((v) => v + 1);
    },
    [store],
  );

  const findWord = useCallback(
    (wordIndex: number, nearest: boolean): DomWord | null => {
      const page = pageOfWord(wordIndex);
      const entry = layoutsRef.current.get(page);
      if (!entry || entry.words.length === 0) return null;
      const k = findLastAtOrBefore(entry.indexes, wordIndex);
      if (k >= 0 && entry.indexes[k] === wordIndex) return entry.words[k];
      return nearest ? entry.words[nearestIndex(entry.indexes, wordIndex)] : null;
    },
    [pageOfWord],
  );

  // --- Zum Wort scrollen ---------------------------------------------------------------
  const revealWord = useCallback(
    (wordIndex: number) => {
      const scroller = scrollerRef.current;
      const page = pageOfWord(wordIndex);
      if (!scroller || page < 1 || layout.tops.length === 0) return;

      const word = findWord(wordIndex, true);
      if (!word) {
        // Seite noch nicht gerendert (oder ohne zuordenbaren Text): Seitenanfang zeigen.
        const top = layout.tops[page - 1];
        const bottom = top + layout.heights[page - 1];
        const inView = bottom > scroller.scrollTop && top < scroller.scrollTop + scroller.clientHeight;
        if (!layoutsRef.current.has(page) && !inView) scroller.scrollTop = Math.max(0, top - PAGE_PADDING);
        return;
      }

      const range = createWordRange(document, word);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      if (rect.top < bounds.top + FOLLOW_MARGIN_PX || rect.bottom > bounds.bottom - FOLLOW_MARGIN_PX) {
        scroller.scrollTop += rect.top - bounds.top - bounds.height * 0.35;
      }
      if (rect.left < bounds.left + PAGE_PADDING || rect.right > bounds.right - PAGE_PADDING) {
        scroller.scrollLeft += rect.left - bounds.left - bounds.width * 0.3;
      }
    },
    [findWord, layout.heights, layout.tops, pageOfWord],
  );

  // Mitlaufen: bei jedem Wortwechsel und sobald eine Seite gerendert wurde.
  useEffect(() => {
    if (followRef.current) revealWord(currentIndex);
  }, [currentIndex, layoutVersion, revealWord]);

  // Beim Start der Wiedergabe wieder mitlaufen.
  useEffect(() => {
    if (isPlaying) followRef.current = true;
  }, [isPlaying]);
  const [wasPlaying, setWasPlaying] = useState(isPlaying);
  if (wasPlaying !== isPlaying) {
    setWasPlaying(isPlaying);
    if (isPlaying) setDetached(false);
  }

  // --- Hervorhebung -----------------------------------------------------------------
  useEffect(() => {
    const registry = highlightRegistry();
    if (!registry) return;

    // Aktueller Chunk
    const lastOfChunk = Math.min(currentIndex + wordsPerChunk - 1, getEffectiveEnd(store.getState()));
    const current: Range[] = [];
    for (let i = currentIndex; i <= lastOfChunk; i++) {
      const word = findWord(i, false);
      if (!word) continue;
      for (const segment of word.segments) {
        const range = document.createRange();
        try {
          range.setStart(segment.node, segment.start);
          range.setEnd(segment.node, segment.end);
          current.push(range);
        } catch {
          /* Knoten wurde inzwischen entfernt */
        }
      }
    }
    const currentHighlight = current.length > 0 ? createHighlight(current) : null;
    if (currentHighlight) registry.set(HIGHLIGHT_CURRENT, currentHighlight);
    else registry.delete(HIGHLIGHT_CURRENT);

    // Eigener Lesebereich (nur wenn einer festgelegt ist)
    const lastOfRange = getEffectiveEnd(store.getState());
    const ranges: Range[] = [];
    if (startIndex > 0 || endIndex !== null) {
      for (const entry of layoutsRef.current.values()) {
        const from = entry.indexes.findIndex((index) => index >= startIndex);
        if (from < 0) continue;
        let to = findLastAtOrBefore(entry.indexes, lastOfRange);
        if (to < from) continue;
        to = Math.max(from, to);
        const firstSegments = entry.words[from].segments;
        const lastSegments = entry.words[to].segments;
        const range = document.createRange();
        try {
          range.setStart(firstSegments[0].node, firstSegments[0].start);
          const tail = lastSegments[lastSegments.length - 1];
          range.setEnd(tail.node, tail.end);
          ranges.push(range);
        } catch {
          /* Knoten wurde inzwischen entfernt */
        }
      }
    }
    const rangeHighlight = ranges.length > 0 ? createHighlight(ranges) : null;
    if (rangeHighlight) registry.set(HIGHLIGHT_RANGE, rangeHighlight);
    else registry.delete(HIGHLIGHT_RANGE);
  }, [currentIndex, wordsPerChunk, startIndex, endIndex, layoutVersion, findWord, store]);

  useEffect(() => {
    return () => {
      const registry = highlightRegistry();
      registry?.delete(HIGHLIGHT_CURRENT);
      registry?.delete(HIGHLIGHT_RANGE);
    };
  }, []);

  // Textlayer-Verweise nicht über Dokumentwechsel hinaus behalten.
  useEffect(() => {
    const layouts = layoutsRef.current;
    return () => layouts.clear();
  }, [handle]);

  // --- Markieren und Klicken -------------------------------------------------------------
  const handleMouseUp = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      const scroller = scrollerRef.current;
      if (!selection || selection.rangeCount === 0 || !scroller) return;

      if (selection.isCollapsed) {
        // Einfacher Klick: RSVP springt zum angeklickten Wort.
        const anchor = selection.anchorNode;
        if (!anchor || anchor.nodeType !== 3 || !scroller.contains(anchor)) return;
        const pageElement = anchor.parentElement?.closest<HTMLElement>('[data-page]');
        const entry = pageElement ? layoutsRef.current.get(Number(pageElement.dataset.page)) : undefined;
        if (!entry || entry.words.length === 0) return;
        const local = findWordAtPoint(document, entry.words, anchor, selection.anchorOffset);
        if (local >= 0) dispatch({ type: 'SET_INDEX', payload: entry.indexes[local] });
        return;
      }

      const range = selection.getRangeAt(0);
      if (!scroller.contains(range.commonAncestorContainer)) return;
      let start = Number.POSITIVE_INFINITY;
      let end = -1;
      for (const entry of layoutsRef.current.values()) {
        if (entry.words.length === 0 || !range.intersectsNode(entry.layer)) continue;
        const span = selectionToWordSpan(document, entry.words, range);
        if (!span) continue;
        start = Math.min(start, entry.indexes[span.start]);
        end = Math.max(end, entry.indexes[span.end]);
      }
      if (end >= start) {
        callbacksRef.current.onSelectWords?.({ start, end }, { x: event.clientX, y: event.clientY });
      }
    },
    [dispatch],
  );

  const detach = useCallback(() => {
    if (!store.getState().isPlaying) return;
    followRef.current = false;
    setDetached(true);
  }, [store]);

  // Klick auf die Bildlaufleiste (Ziel ist der Scroller selbst, nicht dessen Inhalt).
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target === scrollerRef.current) detach();
    },
    [detach],
  );

  const resumeFollowing = useCallback(() => {
    followRef.current = true;
    setDetached(false);
    revealWord(store.getState().currentIndex);
  }, [revealWord, store]);

  // --- Navigation, Zoom -----------------------------------------------------------------
  const goToPage = useCallback(
    (pageNumber: number) => {
      const scroller = scrollerRef.current;
      const page = Math.min(pageCount, Math.max(1, Math.round(pageNumber)));
      if (!scroller) return;
      followRef.current = true;
      setDetached(false);
      scroller.scrollTop = Math.max(0, layout.tops[page - 1] - PAGE_PADDING);

      // Erstes Wort der Seite (bei leeren Seiten: der Text der nächsten Seite mit Wörtern).
      const breaks = pageBreaksRef.current;
      const total = store.getState().words.length;
      let target = page - 1;
      while (target < breaks.length && (breaks[target + 1] ?? total) <= breaks[target]) target++;
      if (target < breaks.length && breaks[target] < total) {
        dispatch({ type: 'SET_INDEX', payload: breaks[target] });
      }
    },
    [dispatch, layout.tops, pageCount, store],
  );

  const zoomBy = useCallback((direction: 1 | -1) => {
    setZoom((current) => {
      if (direction > 0) return ZOOM_STEPS.find((step) => step > current + 0.001) ?? current;
      const smaller = [...ZOOM_STEPS].reverse().find((step) => step < current - 0.001);
      return smaller ?? current;
    });
  }, []);
  const resetZoom = useCallback(() => setZoom(1), []);

  return {
    scrollerRef,
    layout,
    scale,
    zoom,
    pageCount,
    currentPage: Math.min(pageCount, visible.current),
    visibleFrom: visible.from,
    visibleTo: visible.to,
    detached,
    registerTextLayer,
    goToPage,
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    resetZoom,
    resumeFollowing,
    scrollerProps: {
      onScroll: handleScroll,
      onMouseUp: handleMouseUp,
      onWheel: detach,
      onTouchMove: detach,
      onPointerDown: handlePointerDown,
    },
  };
}
