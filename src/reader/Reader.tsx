import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useReader } from '@/contexts/ReaderContext';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageContent } from '@/hooks/usePageContent';
import { RSVPDisplay } from '@/components/RSVPDisplay';
import { SpeedControl } from '@/components/SpeedControl';
import { ProgressBar } from '@/components/ProgressBar';
import { PlaybackControls } from '@/components/PlaybackControls';
import { PDFSelector } from '@/components/PDFSelector';
import { PDFViewer } from '@/components/PDFViewer';
import { EPubSelector } from '@/components/EPubSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ContentPreview } from '@/components/ContentPreview';

type ReaderMode = 'pdf' | 'epub' | 'page' | 'select';
type ViewMode = 'rsvp' | 'split' | 'pdfSplit';

export function Reader() {
  const { resolvedTheme } = useTheme();
  const { state, dispatch } = useReader();
  const { loadCurrentPage, title: pageTitle, isLoading: pageLoading, error: pageError } = usePageContent();
  const [mode, setMode] = useState<ReaderMode>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const hasContent = state.words.length > 0;

  // Aktiviere Keyboard Shortcuts
  useKeyboardShortcuts({ enabled: hasContent });

  // Parse URL-Parameter für Modus
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode') as ReaderMode | null;
    const urlView = params.get('view') as ViewMode | null;
    
    if (urlMode && ['pdf', 'epub', 'page'].includes(urlMode)) {
      setMode(urlMode);
      
      // Wenn page-Modus, lade automatisch den Inhalt
      if (urlMode === 'page') {
        loadCurrentPage();
      }
    }

    // Setze View-Mode aus URL-Parameter wenn vorhanden
    if (urlView && ['rsvp', 'split', 'pdfSplit'].includes(urlView)) {
      setViewMode(urlView);
    }
  }, [loadCurrentPage]);

  // Synchronisiere viewMode mit previewMode aus dem State
  useEffect(() => {
    if (state.previewMode && viewMode === 'rsvp') {
      setViewMode('split');
    } else if (!state.previewMode && (viewMode === 'split' || viewMode === 'pdfSplit')) {
      setViewMode('rsvp');
    }
  }, [state.previewMode, viewMode]);

  // Wechsle zur PDF+RSVP Split-Ansicht wenn PDF geladen wird
  useEffect(() => {
    if (mode === 'pdf' && hasContent && viewMode !== 'pdfSplit' && viewMode !== 'rsvp') {
      setViewMode('pdfSplit');
    }
  }, [mode, hasContent, viewMode]);

  const getTitle = () => {
    if (state.metadata.title) {
      return state.metadata.title;
    }
    switch (mode) {
      case 'pdf':
        return 'PDF Reader';
      case 'epub':
        return 'ePub Reader';
      case 'page':
        return pageTitle || 'Webseite lesen';
      default:
        return 'RSVP Speed Reader';
    }
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    const isPreviewMode = newMode === 'split' || newMode === 'pdfSplit';
    dispatch({ type: 'SET_PREVIEW_MODE', payload: isPreviewMode });
  };

  // Handler for starting RSVP reading from PDF selection
  const handleStartReadingFromPDF = useCallback((range?: { start: number; end: number }) => {
    if (range) {
      // Range is already set by PDFViewer, just switch to RSVP view
      dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: range.start, endIndex: range.end } });
      dispatch({ type: 'SET_INDEX', payload: range.start });
    }
    // Switch to RSVP full view
    setViewMode('rsvp');
    dispatch({ type: 'SET_PREVIEW_MODE', payload: false });
    // Start playback
    dispatch({ type: 'PLAY' });
  }, [dispatch]);

  return (
    <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {mode !== 'select' && (
                <button
                  onClick={() => {
                    setMode('select');
                    dispatch({ type: 'CLEAR_CONTENT' });
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Zurück zur Auswahl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-bold truncate max-w-md">{getTitle()}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Mode Toggle - nur wenn Inhalt vorhanden */}
              {hasContent && (
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {/* PDF-Ansicht: RSVP und PDF+RSVP */}
                  {mode === 'pdf' ? (
                    <>
                      <button
                        onClick={() => handleViewModeChange('rsvp')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                          ${viewMode === 'rsvp' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        RSVP
                      </button>
                      <button
                        onClick={() => handleViewModeChange('pdfSplit')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                          ${viewMode === 'pdfSplit' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        PDF+RSVP
                      </button>
                    </>
                  ) : (
                    /* ePub/Page-Ansicht: RSVP und Split */
                    <>
                      <button
                        onClick={() => handleViewModeChange('rsvp')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                          ${viewMode === 'rsvp' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        RSVP
                      </button>
                      <button
                        onClick={() => handleViewModeChange('split')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                          ${viewMode === 'split' 
                            ? 'bg-white dark:bg-gray-600 shadow-sm' 
                            : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                      >
                        Split
                      </button>
                    </>
                  )}
                </div>
              )}

              {hasContent && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {state.words.length.toLocaleString()} Wörter
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mode Selection */}
          {mode === 'select' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl">
                <button
                  onClick={() => setMode('pdf')}
                  className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-xl 
                             shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 
                             dark:hover:border-blue-600 transition-all hover:shadow-md"
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg">PDF öffnen</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">PDF-Datei laden</p>
                  </div>
                </button>

                <button
                  onClick={() => setMode('epub')}
                  className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-xl 
                             shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 
                             dark:hover:border-blue-600 transition-all hover:shadow-md"
                >
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg">ePub öffnen</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">E-Book laden</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMode('page');
                    loadCurrentPage();
                  }}
                  disabled={pageLoading}
                  className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-800 rounded-xl 
                             shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 
                             dark:hover:border-blue-600 transition-all hover:shadow-md
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-lg">Webseite lesen</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Aktuelle Seite</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* File Selector */}
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

          {/* Loading State for Page Mode */}
          {mode === 'page' && pageLoading && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Lade Seiteninhalt...</p>
            </div>
          )}

          {/* Error State */}
          {mode === 'page' && pageError && !pageLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                              rounded-xl p-6 max-w-md text-center">
                <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
                  Fehler beim Laden
                </h3>
                <p className="text-red-600 dark:text-red-400 mb-4">{pageError}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bitte nutze die Erweiterung über das Popup auf der gewünschten Webseite.
                </p>
              </div>
            </div>
          )}

          {/* Content Views */}
          {hasContent && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* RSVP Only */}
              {viewMode === 'rsvp' && (
                <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6 overflow-y-auto">
                  <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-sm 
                                  border border-gray-200 dark:border-gray-700 p-8">
                    <RSVPDisplay fontSize={56} />
                  </div>

                  <div className="flex flex-col items-center gap-4 w-full max-w-xl">
                    <PlaybackControls />
                    <ProgressBar />
                    <SpeedControl />
                  </div>

                  {/* Keyboard Shortcuts Info */}
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-md">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tastaturkürzel
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Space</kbd> Play/Pause</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">←</kbd> Voriger Satz</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">→</kbd> Nächster Satz</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+←</kbd> Vorig. Absatz</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+→</kbd> Nächst. Absatz</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd> Speed</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Home</kbd> Anfang</span>
                      <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">End</kbd> Ende</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Split View */}
              {viewMode === 'split' && (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* Left: Preview */}
                  <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
                    <ContentPreview className="h-full" />
                  </div>

                  {/* Right: RSVP */}
                  <div className="w-1/2 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-sm 
                                    border border-gray-200 dark:border-gray-700 p-6">
                      <RSVPDisplay fontSize={42} />
                    </div>

                    <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                      <PlaybackControls size="sm" />
                      <ProgressBar />
                      <SpeedControl compact />
                    </div>
                  </div>
                </div>
              )}

              {/* PDF + RSVP Split View */}
              {viewMode === 'pdfSplit' && mode === 'pdf' && (
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* Left: PDF Viewer */}
                  <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
                    <PDFViewer 
                      className="h-full" 
                      autoSync={true} 
                      onStartReading={handleStartReadingFromPDF}
                    />
                  </div>

                  {/* Right: RSVP */}
                  <div className="w-1/2 flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-sm 
                                    border border-gray-200 dark:border-gray-700 p-6">
                      <RSVPDisplay fontSize={42} />
                    </div>

                    <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                      <PlaybackControls size="sm" />
                      <ProgressBar />
                      <SpeedControl compact />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
