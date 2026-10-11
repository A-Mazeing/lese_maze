import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import {
  NavigationButtons,
  PageIndicator,
  ReadingRangeEstimate,
  ReadingRangeInfo,
  StartReadingButton,
  ViewerInstructions,
} from '@/components/shared';
import { findSectionForWord, type ViewerSection } from '@/utils/viewerRows';
import { WordViewer, type WordViewerHandle } from './WordViewer';

export interface DocumentTextViewProps {
  className?: string;
  /** Wird nach "Lesen starten" bzw. "Auswahl im RSVP starten" aufgerufen (Standard: Wiedergabe starten). */
  onStartReading?: () => void;
  /** Zusätzliche Bedienelemente in der Werkzeugleiste (z. B. Umschalter Original/Text). */
  toolbarExtra?: ReactNode;
}

const INSTRUCTIONS =
  'Klicke ein Wort, um dorthin zu springen. Ziehe über mehrere Wörter, um Start, Ende oder einen Lesebereich festzulegen.';

/** Abschnitte aus den Seitengrenzen eines PDFs. */
function pageSections(pageBreaks: readonly number[] | undefined): ViewerSection[] {
  return (pageBreaks ?? []).map((startIndex, i) => ({ startIndex, label: `Seite ${i + 1}`, id: i + 1 }));
}

/**
 * Gemeinsamer Rumpf der Textansichten: Werkzeugleiste, Lesebereich-Info, Wortliste.
 * `kind` bestimmt, wie das Dokument gegliedert wird (PDF-Seiten, Kapitel oder gar nicht).
 */
function DocumentTextView({ className = '', onStartReading, toolbarExtra, kind }: DocumentTextViewProps & { kind: 'pdf' | 'generic' }) {
  const dispatch = useReaderDispatch();
  const viewerRef = useRef<WordViewerHandle>(null);

  const title = useReaderSelector((s) => s.metadata.title);
  const pageBreaks = useReaderSelector((s) => s.metadata.pageBreaks);
  const chapters = useReaderSelector((s) => s.metadata.chapters);
  const totalWords = useReaderSelector((s) => s.words.length);
  const startIndex = useReaderSelector((s) => s.startIndex);
  const endIndex = useReaderSelector((s) => s.endIndex);
  const lastIndex = useReaderSelector((s) => getEffectiveEnd(s));
  const wpm = useReaderSelector((s) => s.wpm);
  const currentIndex = useReaderSelector((s) => s.currentIndex);

  const sections = useMemo<ViewerSection[]>(() => {
    if (kind === 'pdf') return pageSections(pageBreaks);
    return (chapters ?? []).map((c, i) => ({ startIndex: c.startIndex, label: c.title, id: i }));
  }, [kind, pageBreaks, chapters]);

  const currentSection = findSectionForWord(sections, currentIndex);

  const jumpToSection = useCallback(
    (sectionIndex: number) => {
      const section = sections[sectionIndex];
      if (!section) return;
      dispatch({ type: 'SET_INDEX', payload: section.startIndex });
      viewerRef.current?.scrollToWord(section.startIndex, 'start');
    },
    [dispatch, sections],
  );

  const start = useCallback(() => {
    if (onStartReading) onStartReading();
    else dispatch({ type: 'PLAY' });
  }, [dispatch, onStartReading]);

  const hasSections = sections.length > 0;

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          {kind === 'pdf' && hasSections ? (
            <>
              <NavigationButtons
                onPrev={() => {
                  const sectionStart = sections[Math.max(0, currentSection)]?.startIndex ?? 0;
                  // Zuerst zum Anfang der aktuellen Seite, beim zweiten Druck zur vorigen.
                  jumpToSection(currentIndex > sectionStart ? Math.max(0, currentSection) : Math.max(0, currentSection - 1));
                }}
                onNext={() => jumpToSection(Math.min(sections.length - 1, currentSection + 1))}
                prevDisabled={currentSection <= 0 && currentIndex <= (sections[0]?.startIndex ?? 0)}
                nextDisabled={currentSection >= sections.length - 1}
              />
              <PageIndicator
                current={sections[Math.max(0, currentSection)]?.id ?? 1}
                total={pageBreaks?.length ?? sections.length}
                editable
                onPageChange={(page) => {
                  const target = sections.findIndex((s) => s.id === page);
                  // Leere Seiten haben keine eigene Position: nächste Seite mit Text wählen.
                  if (target >= 0) jumpToSection(target);
                  else {
                    const next = sections.findIndex((s) => (s.id ?? 0) > page);
                    jumpToSection(next >= 0 ? next : sections.length - 1);
                  }
                }}
              />
            </>
          ) : (
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{title || 'Vorschau'}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{totalWords.toLocaleString('de-DE')} Wörter</p>
            </div>
          )}

          {kind === 'generic' && hasSections && (
            <label className="flex items-center gap-1 text-sm">
              <span className="sr-only">Abschnitt</span>
              <select
                value={Math.max(0, currentSection)}
                onChange={(e) => jumpToSection(Number(e.target.value))}
                className="max-w-48 truncate rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1"
              >
                {sections.map((section, i) => (
                  <option key={`${section.startIndex}-${i}`} value={i}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          {toolbarExtra}
          <StartReadingButton onClick={start} />
        </div>
      </div>

      <ReadingRangeInfo
        startIndex={startIndex}
        endIndex={endIndex}
        totalWords={totalWords}
        onReset={() => dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: 0, endIndex: null } })}
      />
      <ReadingRangeEstimate
        startIndex={startIndex}
        lastIndex={lastIndex}
        active={startIndex > 0 || endIndex !== null}
        wpm={wpm}
      />

      <WordViewer
        ref={viewerRef}
        className="flex-1 min-h-0"
        sections={sections}
        onStartReading={onStartReading ? () => onStartReading() : () => dispatch({ type: 'PLAY' })}
      />

      <ViewerInstructions text={INSTRUCTIONS} />
    </div>
  );
}

/** Textvorschau für Webseiten (und alle Quellen ohne eigenen Viewer). */
export function ContentPreview(props: DocumentTextViewProps) {
  return <DocumentTextView {...props} kind="generic" />;
}

/** Seitenweise Textansicht eines PDFs. */
export function PDFTextViewer(props: DocumentTextViewProps) {
  return <DocumentTextView {...props} kind="pdf" />;
}
