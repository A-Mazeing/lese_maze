import { useCallback, useState, type ReactNode } from 'react';
import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import { useTheme } from '@/contexts/ThemeContext';
import { usePdfViewer } from '@/hooks/usePdfViewer';
import { useViewerSelection } from '@/hooks/useViewerSelection';
import { PdfPage } from '@/components/pdf/PdfPage';
import {
  NavigationButtons,
  PageIndicator,
  ReadingRangeEstimate,
  ReadingRangeInfo,
  StartReadingButton,
  ViewerContextMenu,
  ViewerInstructions,
} from '@/components/shared';
import type { PdfDocumentHandle } from '@/utils/pdfjs';

interface PDFPageViewerProps {
  handle: PdfDocumentHandle;
  className?: string;
  /** Wird nach "Lesen starten" bzw. "Auswahl im RSVP starten" aufgerufen (Standard: Wiedergabe starten). */
  onStartReading?: () => void;
  /** Zusätzliche Bedienelemente in der Werkzeugleiste (Umschalter Original/Text). */
  toolbarExtra?: ReactNode;
}

const buttonClass =
  'p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/**
 * PDF wie im Browser: Seiten mit Layout, Bildern und Grafiken, darüber ein unsichtbarer
 * Textlayer. Das aktuelle RSVP-Wort wird direkt im Seitenbild hervorgehoben; Anklicken
 * und Markieren funktionieren wie in der Textansicht.
 */
export function PDFPageViewer({ handle, className = '', onStartReading, toolbarExtra }: PDFPageViewerProps) {
  const dispatch = useReaderDispatch();
  const { resolvedTheme } = useTheme();
  const startIndex = useReaderSelector((s) => s.startIndex);
  const endIndex = useReaderSelector((s) => s.endIndex);
  const lastIndex = useReaderSelector((s) => getEffectiveEnd(s));
  const totalWords = useReaderSelector((s) => s.words.length);
  const wpm = useReaderSelector((s) => s.wpm);

  // Dunkle Seitendarstellung folgt dem Design, bis der Benutzer sie selbst umschaltet.
  const [dimOverride, setDimOverride] = useState<boolean | null>(null);
  const dim = dimOverride ?? resolvedTheme === 'dark';

  const start = useCallback(() => {
    if (onStartReading) onStartReading();
    else dispatch({ type: 'PLAY' });
  }, [dispatch, onStartReading]);

  const selection = useViewerSelection({ onStartReading: start });
  const { showMenu } = selection;
  const onSelectWords = useCallback(
    (span: { start: number; end: number }, position: { x: number; y: number }) => showMenu(position, span),
    [showMenu],
  );

  const {
    scrollerRef,
    scrollerProps,
    layout,
    scale,
    zoom,
    pageCount,
    currentPage,
    visibleFrom,
    visibleTo,
    detached,
    registerTextLayer,
    goToPage,
    zoomIn,
    zoomOut,
    resetZoom,
    resumeFollowing,
  } = usePdfViewer(handle, { onSelectWords });

  const pages: ReactNode[] = [];
  for (let i = visibleFrom; i <= visibleTo; i++) {
    const width = layout.widths[i];
    pages.push(
      <PdfPage
        key={i}
        doc={handle.document}
        pageNumber={i + 1}
        scale={scale}
        left={Math.round((layout.contentWidth - width) / 2)}
        top={layout.tops[i]}
        width={width}
        height={layout.heights[i]}
        onTextLayer={registerTextLayer}
      />,
    );
  }

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <NavigationButtons
            onPrev={() => goToPage(currentPage - 1)}
            onNext={() => goToPage(currentPage + 1)}
            prevDisabled={currentPage <= 1}
            nextDisabled={currentPage >= pageCount}
          />
          <PageIndicator current={currentPage} total={pageCount} editable onPageChange={goToPage} />

          <div role="group" aria-label="Zoom" className="flex items-center gap-0.5">
            <button type="button" className={buttonClass} onClick={zoomOut} aria-label="Verkleinern">
              <span aria-hidden="true" className="inline-block w-4 text-center font-semibold">−</span>
            </button>
            <button
              type="button"
              className="px-1.5 py-1 min-w-12 text-sm tabular-nums rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={resetZoom}
              aria-label="Zoom zurücksetzen (an Breite anpassen)"
              title="An Breite anpassen"
            >
              {zoomPercent} %
            </button>
            <button type="button" className={buttonClass} onClick={zoomIn} aria-label="Vergrößern">
              <span aria-hidden="true" className="inline-block w-4 text-center font-semibold">+</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`${buttonClass} ${dim ? 'bg-gray-300 dark:bg-gray-600' : ''}`}
            aria-pressed={dim}
            onClick={() => setDimOverride(!dim)}
            title="Seiten abdunkeln"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span className="sr-only">Seiten abdunkeln</span>
          </button>
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

      <div className={`relative flex-1 min-h-0 ${dim ? 'pdf-dim bg-gray-800' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <div
          ref={scrollerRef}
          className="absolute inset-0 overflow-auto"
          data-testid="pdf-viewer"
          {...scrollerProps}
        >
          <div className="relative" style={{ width: layout.contentWidth, height: layout.contentHeight }}>
            {pages}
          </div>
        </div>
        {detached && (
          <button
            type="button"
            onClick={resumeFollowing}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 text-sm rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Zur aktuellen Stelle
          </button>
        )}
      </div>

      <ViewerInstructions text="Klicke ein Wort, um dorthin zu springen. Markiere Text, um Start, Ende oder einen Lesebereich festzulegen." />

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
}
