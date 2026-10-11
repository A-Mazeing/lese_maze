import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useReaderDispatch, useReaderSelector, useReaderStore } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import { useT } from '@/i18n';
import { useViewerSelection } from '@/hooks/useViewerSelection';
import { ViewerContextMenu, type WordRange } from '@/components/shared/ViewerContextMenu';
import {
  buildViewerRows,
  findRowForWord,
  type ViewerRow,
  type ViewerSection,
} from '@/utils/viewerRows';

export interface WordViewerHandle {
  /** Scrollt zum Wort und aktiviert das automatische Mitlaufen wieder. */
  scrollToWord(index: number, align?: 'start' | 'center'): void;
}

interface WordViewerProps {
  sections?: readonly ViewerSection[];
  className?: string;
  /** Nach "Auswahl im RSVP starten" aufgerufen. */
  onStartReading?: (range?: WordRange) => void;
}

interface WordsRowProps {
  words: readonly string[];
  start: number;
  end: number;
  /** Auswahlbereich (nur für Zeilen, die ihn schneiden – sonst null, damit die Zeile nicht neu rendert). */
  selStart: number | null;
  selEnd: number | null;
}

const WORD_BASE = 'rounded-sm cursor-pointer hover:bg-gray-200/70 dark:hover:bg-gray-700/70';

/** Eine Zeile mit Wörtern. Abonniert nur, ob sie das aktuelle Wort enthält, und den Lesebereich. */
const WordsRow = memo(function WordsRow({ words, start, end, selStart, selEnd }: WordsRowProps) {
  const current = useReaderSelector((s) => (s.currentIndex >= start && s.currentIndex < end ? s.currentIndex : -1));
  const rangeStart = useReaderSelector((s) => s.startIndex);
  const rangeEnd = useReaderSelector((s) => getEffectiveEnd(s));

  const spans = [];
  for (let i = start; i < end; i++) {
    const selected = selStart !== null && selEnd !== null && i >= selStart && i <= selEnd;
    const inRange = i >= rangeStart && i <= rangeEnd;
    let tone = inRange ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600';
    if (selected) tone = 'bg-yellow-300 text-gray-900 dark:bg-yellow-600 dark:text-gray-100';
    else if (i === current) tone = 'bg-blue-200 text-gray-900 dark:bg-blue-700 dark:text-white';

    spans.push(
      <span key={i} data-w={i} data-current={i === current ? 'true' : undefined} className={`${WORD_BASE} ${tone}`}>
        {words[i]}
      </span>,
      ' ',
    );
  }
  return <div className="leading-relaxed py-0.5">{spans}</div>;
});

function HeadingRow({ label }: { label: string }) {
  return (
    <div className="pt-6 pb-2 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
      {label}
    </div>
  );
}

/** Stabile Item-Komponente (eine inline definierte würde bei jedem Render alle Zeilen neu mounten). */
function ViewerItem(props: ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className="max-w-3xl mx-auto px-4 text-base" />;
}
const VIRTUOSO_COMPONENTS = { Item: ViewerItem };

function wordFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>('[data-w]');
  if (!element) return null;
  const value = Number(element.dataset.w);
  return Number.isInteger(value) ? value : null;
}

/**
 * Virtualisierte Textansicht mit Wortauswahl.
 *
 * - Klick auf ein Wort springt dorthin; Ziehen über mehrere Wörter öffnet das Kontextmenü
 *   (Startpunkt, Endpunkt, Lesebereich, im RSVP lesen).
 * - Während der Wiedergabe läuft die Ansicht mit, solange der Benutzer nicht selbst scrollt.
 * - Alle Mausereignisse laufen über Event-Delegation am Container; einzelne Wörter tragen
 *   keine eigenen Handler.
 */
export const WordViewer = forwardRef<WordViewerHandle, WordViewerProps>(function WordViewer(
  { sections, className = '', onStartReading },
  ref,
) {
  const t = useT();
  const words = useReaderSelector((s) => s.words);
  const isPlaying = useReaderSelector((s) => s.isPlaying);
  const currentIndex = useReaderSelector((s) => s.currentIndex);
  const store = useReaderStore();
  const dispatch = useReaderDispatch();

  const model = useMemo(() => buildViewerRows(words.length, sections), [words.length, sections]);
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const visibleRef = useRef({ start: 0, end: 0 });
  const followRef = useRef(true);
  const [detached, setDetached] = useState(false);

  const selection = useViewerSelection({ onStartReading });
  const { showMenu, hideMenu } = selection;

  // --- Auswahl per Maus ---------------------------------------------------------
  const [drag, setDrag] = useState<WordRange | null>(null);
  const anchorRef = useRef<number | null>(null);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const word = wordFromTarget(event.target);
      if (word === null) return;
      event.preventDefault(); // verhindert die native Textauswahl
      hideMenu();
      anchorRef.current = word;
      setDrag({ start: word, end: word });
    },
    [hideMenu],
  );

  const handleMouseOver = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const anchor = anchorRef.current;
    if (anchor === null) return;
    const word = wordFromTarget(event.target);
    if (word === null) return;
    const next = { start: Math.min(anchor, word), end: Math.max(anchor, word) };
    setDrag((prev) => (prev && prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  const dragActive = drag !== null;
  useEffect(() => {
    if (!dragActive) return;

    const finish = (event: MouseEvent) => {
      const anchor = anchorRef.current;
      anchorRef.current = null;
      setDrag(null);
      if (anchor === null) return;

      // Das Ziel unter dem Zeiger bestimmt das Ende; fehlt es (Maus außerhalb), gilt die letzte Auswahl.
      const target = wordFromTarget(event.target);
      setDrag((last) => {
        const range =
          target !== null ? { start: Math.min(anchor, target), end: Math.max(anchor, target) } : last;
        if (range) {
          if (range.start === range.end) {
            dispatch({ type: 'SET_INDEX', payload: range.start });
            followRef.current = true;
            setDetached(false);
          } else {
            showMenu({ x: event.clientX, y: event.clientY }, range);
          }
        }
        return null;
      });
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      anchorRef.current = null;
      setDrag(null);
    };

    window.addEventListener('mouseup', finish, { once: true });
    window.addEventListener('keydown', cancel);
    return () => {
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('keydown', cancel);
    };
  }, [dragActive, dispatch, showMenu]);

  const activeSelection = drag ?? (selection.showContextMenu ? selection.selectedWordRange : null);

  // --- Scrollen / Mitlaufen -------------------------------------------------------
  const scrollToRowOfWord = useCallback((wordIndex: number, align: 'start' | 'center') => {
    const row = findRowForWord(modelRef.current.rows, wordIndex);
    if (row < 0) return;
    virtuosoRef.current?.scrollToIndex({ index: row, align, behavior: 'auto' });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToWord(index, align = 'start') {
        followRef.current = true;
        setDetached(false);
        scrollToRowOfWord(index, align);
      },
    }),
    [scrollToRowOfWord],
  );

  // Mitlaufen: nur wenn die aktuelle Zeile (fast) aus dem Sichtbereich läuft.
  useEffect(() => {
    if (!followRef.current) return;
    const row = findRowForWord(model.rows, currentIndex);
    if (row < 0) return;
    const { start, end } = visibleRef.current;
    if (row <= start || row >= end) scrollToRowOfWord(currentIndex, 'center');
  }, [currentIndex, model.rows, scrollToRowOfWord]);

  // Beim Start der Wiedergabe wieder mitlaufen.
  useEffect(() => {
    if (isPlaying) followRef.current = true;
  }, [isPlaying]);
  const [wasPlaying, setWasPlaying] = useState(isPlaying);
  if (wasPlaying !== isPlaying) {
    setWasPlaying(isPlaying);
    if (isPlaying) setDetached(false);
  }

  const markDetached = useCallback(() => {
    if (!isPlaying) return;
    followRef.current = false;
    setDetached(true);
  }, [isPlaying]);

  const [initialIndex] = useState(() => Math.max(0, findRowForWord(model.rows, store.getState().currentIndex)));

  const renderRow = useCallback(
    (_index: number, row: ViewerRow) => {
      if (row.kind === 'heading') return <HeadingRow label={row.label} />;
      const intersects = activeSelection !== null && activeSelection.end >= row.start && activeSelection.start < row.end;
      return (
        <WordsRow
          words={words}
          start={row.start}
          end={row.end}
          selStart={intersects ? activeSelection.start : null}
          selEnd={intersects ? activeSelection.end : null}
        />
      );
    },
    [words, activeSelection],
  );

  if (words.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 dark:text-gray-400 ${className}`}>
        {t('viewer.noText')}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="h-full select-none"
        data-testid="word-viewer"
        onMouseDown={handleMouseDown}
        onMouseOver={handleMouseOver}
        onWheel={markDetached}
        onTouchMove={markDetached}
      >
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          data={model.rows}
          itemContent={renderRow}
          computeItemKey={(index) => index}
          overscan={400}
          components={VIRTUOSO_COMPONENTS}
          initialTopMostItemIndex={{ index: initialIndex, align: 'center' }}
          rangeChanged={(range) => {
            visibleRef.current = { start: range.startIndex, end: range.endIndex };
          }}
        />
      </div>

      {detached && (
        <button
          type="button"
          onClick={() => {
            followRef.current = true;
            setDetached(false);
            scrollToRowOfWord(store.getState().currentIndex, 'center');
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 text-sm rounded-full shadow-lg
                     bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {t('viewer.jumpToCurrent')}
        </button>
      )}

      {selection.showContextMenu && (
        <ViewerContextMenu
          position={selection.contextMenuPosition}
          selectedRange={selection.selectedWordRange}
          onAction={selection.handleContextMenuAction}
          onClose={selection.hideMenu}
        />
      )}
    </div>
  );
});
