import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useReader } from '@/contexts/ReaderContext';
import type { TextSelection } from '@/hooks/useTextSelection';

interface ContentPreviewProps {
  className?: string;
}

// Anzahl der Wörter pro "Zeile" für virtuelles Rendering
const WORDS_PER_LINE = 15;

interface WordLine {
  lineIndex: number;
  words: Array<{
    word: string;
    globalIndex: number;
  }>;
  startIndex: number;
  endIndex: number;
}

/**
 * ContentPreview - Zeigt den extrahierten Text vollständig an.
 * Nutzt Virtual Scrolling für Performance bei großen Dokumenten.
 * Ermöglicht Text-Selektion zur Auswahl von Start/End-Punkten.
 */
export function ContentPreview({ className = '' }: ContentPreviewProps) {
  const { state, dispatch } = useReader();
  const { words, startIndex, endIndex, metadata, currentIndex, wpm } = state;
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // Gruppiere Wörter in Zeilen für Virtual Scrolling
  const lines = useMemo<WordLine[]>(() => {
    const result: WordLine[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_LINE) {
      const lineWords = words.slice(i, i + WORDS_PER_LINE).map((word, idx) => ({
        word,
        globalIndex: i + idx,
      }));
      result.push({
        lineIndex: result.length,
        words: lineWords,
        startIndex: i,
        endIndex: Math.min(i + WORDS_PER_LINE - 1, words.length - 1),
      });
    }
    return result;
  }, [words]);

  // Finde die Zeile für den aktuellen Index
  const currentLineIndex = useMemo(() => {
    return Math.floor(currentIndex / WORDS_PER_LINE);
  }, [currentIndex]);

  // Scroll zur aktuellen Position beim Öffnen
  useEffect(() => {
    if (virtuosoRef.current && currentIndex > 0) {
      virtuosoRef.current.scrollToIndex({
        index: currentLineIndex,
        align: 'center',
        behavior: 'smooth',
      });
    }
  }, []); // Only on mount

  // Kapitel für Navigation (falls vorhanden)
  const chapters = metadata.chapters || [];

  // Handler für Wort-Klick
  const handleWordMouseDown = useCallback((globalIndex: number) => {
    setIsSelecting(true);
    setSelectionStart(globalIndex);
    setSelection({
      startWordIndex: globalIndex,
      endWordIndex: globalIndex,
      text: words[globalIndex],
    });
    setShowContextMenu(false);
  }, [words]);

  const handleWordMouseEnter = useCallback((globalIndex: number) => {
    if (!isSelecting || selectionStart === null) return;

    const start = Math.min(selectionStart, globalIndex);
    const end = Math.max(selectionStart, globalIndex);
    
    setSelection({
      startWordIndex: start,
      endWordIndex: end,
      text: words.slice(start, end + 1).join(' '),
    });
  }, [isSelecting, selectionStart, words]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isSelecting && selection && selection.startWordIndex !== selection.endWordIndex) {
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
    setIsSelecting(false);
  }, [isSelecting, selection]);

  const handleSetStart = useCallback(() => {
    if (selection) {
      dispatch({ type: 'SET_START_INDEX', payload: selection.startWordIndex });
      dispatch({ type: 'SET_INDEX', payload: selection.startWordIndex });
    }
    setShowContextMenu(false);
    setSelection(null);
  }, [selection, dispatch]);

  const handleSetEnd = useCallback(() => {
    if (selection) {
      dispatch({ type: 'SET_END_INDEX', payload: selection.endWordIndex });
    }
    setShowContextMenu(false);
    setSelection(null);
  }, [selection, dispatch]);

  const handleSetRange = useCallback(() => {
    if (selection) {
      dispatch({ 
        type: 'SET_READING_RANGE', 
        payload: { 
          startIndex: selection.startWordIndex, 
          endIndex: selection.endWordIndex 
        } 
      });
    }
    setShowContextMenu(false);
    setSelection(null);
  }, [selection, dispatch]);

  const handleStartReading = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW_MODE', payload: false });
    dispatch({ type: 'PLAY' });
  }, [dispatch]);

  const handleJumpToChapter = useCallback((chapterStartIndex: number) => {
    dispatch({ type: 'SET_INDEX', payload: chapterStartIndex });
    const lineIndex = Math.floor(chapterStartIndex / WORDS_PER_LINE);
    virtuosoRef.current?.scrollToIndex({
      index: lineIndex,
      align: 'start',
      behavior: 'smooth',
    });
  }, [dispatch]);

  const handleResetRange = useCallback(() => {
    dispatch({ type: 'SET_READING_RANGE', payload: { startIndex: 0, endIndex: null } });
  }, [dispatch]);

  // Click-Away Handler für Context Menu
  useEffect(() => {
    const handleClickAway = () => {
      setShowContextMenu(false);
    };
    
    if (showContextMenu) {
      document.addEventListener('click', handleClickAway);
      return () => document.removeEventListener('click', handleClickAway);
    }
  }, [showContextMenu]);

  // Statistiken
  const totalWords = words.length;
  const selectedWords = (endIndex ?? words.length - 1) - startIndex + 1;
  const estimatedMinutes = Math.ceil(selectedWords / wpm);

  // Render eine einzelne Zeile
  const renderLine = useCallback((lineIndex: number) => {
    const line = lines[lineIndex];
    if (!line) return null;

    return (
      <div className="leading-relaxed py-0.5">
        {line.words.map(({ word, globalIndex }) => {
          const isInRange = globalIndex >= startIndex && (endIndex === null || globalIndex <= endIndex);
          const isCurrentWord = globalIndex === currentIndex;
          const isSelected = selection && globalIndex >= selection.startWordIndex && globalIndex <= selection.endWordIndex;
          
          return (
            <span
              key={globalIndex}
              data-word-index={globalIndex}
              onMouseDown={() => handleWordMouseDown(globalIndex)}
              onMouseEnter={() => handleWordMouseEnter(globalIndex)}
              className={`
                inline cursor-pointer transition-colors rounded px-0.5
                ${isSelected 
                  ? 'bg-yellow-300 dark:bg-yellow-600' 
                  : isCurrentWord 
                    ? 'bg-blue-200 dark:bg-blue-700 font-semibold' 
                    : isInRange 
                      ? 'text-gray-900 dark:text-gray-100' 
                      : 'text-gray-400 dark:text-gray-600'
                }
                hover:bg-gray-100 dark:hover:bg-gray-700
              `}
            >
              {word}{' '}
            </span>
          );
        })}
      </div>
    );
  }, [lines, startIndex, endIndex, currentIndex, selection, handleWordMouseDown, handleWordMouseEnter]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header mit Statistiken und Controls */}
      <div className="flex-shrink-0 p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-lg">{metadata.title || 'Vorschau'}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalWords.toLocaleString()} Wörter insgesamt
            </p>
          </div>
          <button
            onClick={handleStartReading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                       font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Lesen starten
          </button>
        </div>

        {/* Range Info */}
        {(startIndex > 0 || endIndex !== null) && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <span className="text-blue-700 dark:text-blue-300">
              Lesebereich: Wort {startIndex + 1} bis {endIndex !== null ? endIndex + 1 : totalWords}
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              ({selectedWords.toLocaleString()} Wörter, ~{estimatedMinutes} Min.)
            </span>
            <button
              onClick={handleResetRange}
              className="ml-auto text-blue-600 dark:text-blue-400 hover:text-blue-800 
                         dark:hover:text-blue-200 underline"
            >
              Zurücksetzen
            </button>
          </div>
        )}

        {/* Kapitel-Navigation */}
        {chapters.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Kapitel
            </p>
            <div className="flex flex-wrap gap-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => handleJumpToChapter(chapter.startIndex)}
                  className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full
                             hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {chapter.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anleitung */}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Markiere Text, um Startpunkt oder Endpunkt festzulegen
        </p>
      </div>

      {/* Virtualized Text-Content */}
      <div 
        className="flex-1 min-h-0 overflow-hidden select-none"
        onMouseUp={handleMouseUp}
      >
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          totalCount={lines.length}
          itemContent={renderLine}
          overscan={20}
          className="px-4"
          components={{
            Item: ({ children, ...props }) => (
              <div {...props} className="max-w-3xl mx-auto text-base">
                {children}
              </div>
            ),
          }}
        />
      </div>

      {/* Context Menu */}
      {showContextMenu && selection && (
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl 
                     border border-gray-200 dark:border-gray-700 py-2 min-w-48"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-b 
                          border-gray-200 dark:border-gray-700 mb-1">
            {selection.endWordIndex - selection.startWordIndex + 1} Wörter ausgewählt
          </div>
          <button
            onClick={handleSetStart}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            Von hier starten
          </button>
          <button
            onClick={handleSetEnd}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Hier enden
          </button>
          <button
            onClick={handleSetRange}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                       dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Nur diese Auswahl lesen
          </button>
        </div>
      )}
    </div>
  );
}
