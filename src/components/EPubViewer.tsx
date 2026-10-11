import { useCallback, useMemo } from 'react';
import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';
import { useT } from '@/i18n';
import { useEPubViewer } from '@/hooks/useEPubViewer';
import { useViewerSelection } from '@/hooks/useViewerSelection';
import {
  LoadingState,
  NavigationButtons,
  ReadingRangeInfo,
  StartReadingButton,
  ViewerContextMenu,
  ViewerInstructions,
} from '@/components/shared';
import { ContentPreview } from '@/components/viewer';

interface EPubViewerProps {
  className?: string;
  /** Wird nach "Lesen starten" bzw. "Auswahl im RSVP starten" aufgerufen (Standard: Wiedergabe starten). */
  onStartReading?: () => void;
}

/**
 * ePub-Ansicht mit Kapitelnavigation, Hervorhebung des aktuellen RSVP-Wortes und
 * Kontextmenü für markierten Text. Schlägt das Rendern fehl, wird automatisch die reine
 * Textansicht gezeigt – das Lesen selbst ist davon nicht betroffen.
 */
export function EPubViewer({ className = '', onStartReading }: EPubViewerProps) {
  const t = useT();
  const dispatch = useReaderDispatch();
  const chapters = useReaderSelector((s) => s.metadata.chapters);
  const startIndex = useReaderSelector((s) => s.startIndex);
  const endIndex = useReaderSelector((s) => s.endIndex);
  const totalWords = useReaderSelector((s) => s.words.length);

  const start = useCallback(() => {
    if (onStartReading) onStartReading();
    else dispatch({ type: 'PLAY' });
  }, [dispatch, onStartReading]);

  const selection = useViewerSelection({ onStartReading: start });
  const { showMenu } = selection;

  const { containerRef, status, detached, goToChapter, resumeFollowing } = useEPubViewer({
    onSelectWords: (span, position) => showMenu(position, span),
  });

  const chapterList = useMemo(() => chapters ?? [], [chapters]);
  const currentChapter = useMemo(
    () => chapterList.findIndex((c) => c.spineIndex === status.spineIndex),
    [chapterList, status.spineIndex],
  );

  // Fallback: Textansicht, wenn das Buch nicht gerendert werden kann.
  if (status.phase === 'error') {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className}`}>
        <p role="status" className="flex-shrink-0 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          {t('epubviewer.unavailable', { error: status.error ?? '' })}
        </p>
        <ContentPreview className="flex-1 min-h-0" onStartReading={onStartReading} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <NavigationButtons
            onPrev={() => goToChapter(Math.max(0, currentChapter - 1))}
            onNext={() => goToChapter(Math.min(chapterList.length - 1, currentChapter + 1))}
            prevDisabled={currentChapter <= 0}
            nextDisabled={currentChapter < 0 || currentChapter >= chapterList.length - 1}
          />
          {chapterList.length > 0 && (
            <label className="flex items-center gap-1 text-sm min-w-0">
              <span className="sr-only">{t('epubviewer.chapter')}</span>
              <select
                value={Math.max(0, currentChapter)}
                onChange={(e) => goToChapter(Number(e.target.value))}
                className="max-w-56 truncate rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1"
              >
                {chapterList.map((chapter, i) => (
                  <option key={chapter.id} value={i}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <StartReadingButton onClick={start} />
      </div>

      <ReadingRangeInfo
        startIndex={startIndex}
        endIndex={endIndex}
        totalWords={totalWords}
        onReset={() => dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: 0, endIndex: null } })}
      />

      <div className="relative flex-1 min-h-0 bg-white dark:bg-gray-900">
        <div ref={containerRef} className="absolute inset-0" data-testid="epub-container" />
        {status.phase === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 pointer-events-none">
            <LoadingState message={t('epubviewer.loadingChapter')} color="purple" />
          </div>
        )}
        {detached && (
          <button
            type="button"
            onClick={resumeFollowing}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 text-sm rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {t('viewer.jumpToCurrent')}
          </button>
        )}
      </div>

      <ViewerInstructions text={t('view.instructionsSelect')} />

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
