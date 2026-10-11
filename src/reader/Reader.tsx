import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EPubSelector } from '@/components/EPubSelector';
import { EPubViewer } from '@/components/EPubViewer';
import { PDFSelector } from '@/components/PDFSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AdPreferenceToggle } from '@/components/ads/AdPreferenceToggle';
import { AdSlot } from '@/components/ads/AdSlot';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PDFViewer } from '@/components/PDFViewer';
import { ContentPreview } from '@/components/viewer';
import { ErrorDisplay, LoadingState } from '@/components/shared';
import {
  useReaderDispatch,
  useReaderDocuments,
  useReaderSelector,
} from '@/contexts/ReaderContext';
import { formatNumber, useT } from '@/i18n';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageContent } from '@/hooks/usePageContent';
import { useProgress } from '@/hooks/useProgress';
import { formatProgress } from '@/utils/textProcessor';
import { parseReaderParams, type ReaderMode } from './readerParams';
import { RsvpPanel } from './RsvpPanel';
import { ShortcutHelp } from './ShortcutHelp';
import { SourcePicker } from './SourcePicker';
import { useResumeHint } from './useResumeHint';

function modeTitle(mode: ReaderMode, t: ReturnType<typeof useT>): string {
  switch (mode) {
    case 'pdf':
      return t('reader.title_pdf');
    case 'epub':
      return t('reader.title_epub');
    case 'page':
      return t('reader.title_page');
    default:
      return t('reader.title_select');
  }
}

export function Reader() {
  const t = useT();
  const dispatch = useReaderDispatch();
  const { releaseDocuments } = useReaderDocuments();
  const params = useMemo(() => parseReaderParams(window.location.search), []);
  const [mode, setMode] = useState<ReaderMode>(params.mode);

  const hasContent = useReaderSelector((s) => s.words.length > 0);
  const wordCount = useReaderSelector((s) => s.words.length);
  const title = useReaderSelector((s) => s.metadata.title);
  const sourceType = useReaderSelector((s) => s.metadata.sourceType);
  const documentId = useReaderSelector((s) => s.metadata.documentId);
  const showText = useReaderSelector((s) => s.previewMode);

  const page = usePageContent();
  const resumeHint = useResumeHint(params.resumeId);
  useKeyboardShortcuts({ enabled: hasContent });
  const { restored } = useProgress({ enabled: hasContent });
  const [dismissedHint, setDismissedHint] = useState<unknown>(null);
  const restoredDismissed = restored !== null && dismissedHint === restored;

  // Seiteninhalt genau einmal laden (auch unter React.StrictMode, das Effekte doppelt ausführt).
  const pageLoadStarted = useRef(false);
  useEffect(() => {
    if (params.mode !== 'page' || pageLoadStarted.current) return;
    pageLoadStarted.current = true;
    void page.loadPageContent(params.key);
  }, [params.mode, params.key, page]);

  useEffect(() => {
    document.title = title ? `${title} – RSVP Speed Reader` : modeTitle(mode, t);
  }, [title, mode, t]);

  const backToSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_CONTENT' });
    releaseDocuments();
    setMode('select');
    // Der Seiteninhalt-Schlüssel soll bei einem Neuladen nicht erneut geladen werden.
    window.history.replaceState(null, '', window.location.pathname);
  }, [dispatch, releaseDocuments]);

  const setShowText = useCallback(
    (value: boolean) => dispatch({ type: 'SET_PREVIEW_MODE', payload: value }),
    [dispatch],
  );

  const viewer =
    sourceType === 'pdf' ? <PDFViewer key={documentId} className="h-full" /> :
    sourceType === 'epub' ? <EPubViewer className="h-full" /> :
    <ContentPreview className="h-full" />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {mode !== 'select' && (
              <button
                type="button"
                onClick={backToSelection}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={t('reader.backToSelection')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-bold truncate">{title || modeTitle(mode, t)}</h1>
          </div>

          <div className="flex items-center gap-4">
            {hasContent && (
              <div role="group" aria-label={t('reader.view')} className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {([
                  [false, t('reader.viewRsvp')],
                  [true, t('reader.viewText')],
                ] as const).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={showText === value}
                    onClick={() => setShowText(value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      showText === value ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {hasContent && (
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {t('reader.words', { count: formatNumber(wordCount) })}
              </span>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {restored && !restoredDismissed && hasContent && (
        <div role="status" className="flex-shrink-0 flex items-center justify-center gap-3 px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-800">
          <span>
            {t('reader.restored', { word: formatNumber(restored.index + 1), percent: formatProgress(restored.index, wordCount) })}
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INDEX', payload: 0 })}
            className="underline hover:no-underline"
          >
            {t('reader.fromStart')}
          </button>
          <button type="button" onClick={() => setDismissedHint(restored)} className="ml-2" aria-label={t('reader.dismiss')}>
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!hasContent && resumeHint && mode !== 'page' && (
          <div role="status" className="flex-shrink-0 px-4 py-2 text-sm text-center bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 border-b border-amber-200 dark:border-amber-800">
            {t('reader.resumeHint', { title: resumeHint.title, percent: formatProgress(resumeHint.currentIndex, resumeHint.totalWords) })}
          </div>
        )}

        {mode === 'select' && !hasContent && (
          <>
            <SourcePicker onSelect={setMode} />
            <div className="flex-shrink-0 flex justify-center px-4 pb-4 empty:hidden">
              <AdSlot placement="home" />
            </div>
          </>
        )}

        {mode === 'pdf' && !hasContent && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl w-full">
              <PDFSelector />
            </div>
          </div>
        )}

        {mode === 'epub' && !hasContent && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl w-full">
              <EPubSelector />
            </div>
          </div>
        )}

        {mode === 'page' && !hasContent && page.isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <LoadingState message={t('reader.loadingPage')} size="lg" color="green" />
          </div>
        )}

        {mode === 'page' && !hasContent && !page.isLoading && page.error && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <ErrorDisplay
                message={page.error}
                action={{ label: t('reader.toSelection'), onClick: backToSelection }}
              />
            </div>
          </div>
        )}

        {hasContent && mode === 'page' && (page.truncated || page.fromSelection) && (
          <div role="status" className="flex-shrink-0 px-4 py-1.5 text-xs text-center text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {page.fromSelection ? t('reader.onlySelection') : ''}
            {page.truncated ? ` ${t('reader.truncated')}` : ''}
          </div>
        )}

        {hasContent && !showText && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 overflow-y-auto">
            <RsvpPanel size="lg" />
            <ShortcutHelp />
          </div>
        )}

        {hasContent && showText && (
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            <div className="md:w-1/2 h-1/2 md:h-auto min-h-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 overflow-hidden">
              {viewer}
            </div>
            <div className="md:w-1/2 flex-1 md:flex-none min-h-0 flex flex-col items-center justify-center p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              <RsvpPanel size="sm" />
            </div>
          </div>
        )}
      </main>

      <footer className="flex-shrink-0 flex justify-center px-4 py-1.5 empty:hidden">
        <AdPreferenceToggle />
      </footer>
    </div>
  );
}
