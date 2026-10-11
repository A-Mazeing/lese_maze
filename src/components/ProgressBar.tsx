import { memo, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import { estimateReadingTime } from '@/utils/textProcessor';

/** Schrittweite der Tastatursteuerung des Fortschrittsbalkens (Wörter). */
const KEY_STEP = 10;

/**
 * Fortschrittsanzeige für den aktuellen Lesebereich (startIndex … endIndex).
 * Per Klick oder Tastatur (←/→, Pos1/Ende am fokussierten Balken) navigierbar.
 */
export const ProgressBar = memo(function ProgressBar() {
  const dispatch = useReaderDispatch();
  const currentIndex = useReaderSelector((s) => s.currentIndex);
  const startIndex = useReaderSelector((s) => s.startIndex);
  const wpm = useReaderSelector((s) => s.wpm);
  const progress = useReaderSelector((s) => s.progress);
  const end = useReaderSelector((s) => getEffectiveEnd(s));

  const totalWordsInRange = Math.max(0, end - startIndex + 1);
  const positionInRange = totalWordsInRange === 0 ? 0 : Math.max(0, currentIndex - startIndex + 1);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (totalWordsInRange === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      dispatch({
        type: 'SET_INDEX',
        payload: startIndex + Math.min(totalWordsInRange - 1, Math.floor(fraction * totalWordsInRange)),
      });
    },
    [dispatch, startIndex, totalWordsInRange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowRight':
          dispatch({ type: 'SKIP_FORWARD', payload: KEY_STEP });
          break;
        case 'ArrowLeft':
          dispatch({ type: 'SKIP_BACKWARD', payload: KEY_STEP });
          break;
        case 'Home':
          dispatch({ type: 'SET_INDEX', payload: startIndex });
          break;
        case 'End':
          dispatch({ type: 'SET_INDEX', payload: end });
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [dispatch, startIndex, end],
  );

  const remainingWords = Math.max(0, totalWordsInRange - positionInRange);
  const progressPercent = totalWordsInRange > 0 ? Math.round((positionInRange / totalWordsInRange) * 100) : 0;

  return (
    <div className="w-full max-w-2xl">
      <div
        className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden
                   focus-visible:outline-2 focus-visible:outline-blue-500"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Lesefortschritt"
        aria-valuemin={1}
        aria-valuemax={Math.max(1, totalWordsInRange)}
        aria-valuenow={Math.max(1, positionInRange)}
        aria-valuetext={`Wort ${positionInRange} von ${totalWordsInRange}`}
      >
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 dark:bg-blue-400 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Wort {positionInRange.toLocaleString('de-DE')} von {totalWordsInRange.toLocaleString('de-DE')}
        </span>
        <span className="font-medium">{progressPercent}%</span>
        <span>Verbleibend: {estimateReadingTime(remainingWords, wpm)}</span>
      </div>
    </div>
  );
});
