import { useRSVP } from '@/hooks/useRSVP';
import { estimateReadingTime } from '@/utils/textProcessor';

/**
 * Progress Bar Komponente mit Fortschrittsanzeige.
 * 
 * Zeigt den Fortschritt innerhalb des aktuellen Lesebereichs an.
 * Wenn ein Lesebereich (startIndex/endIndex) gesetzt ist, werden
 * alle Anzeigen relativ zu diesem Bereich berechnet.
 */
export function ProgressBar() {
  const { 
    progress, 
    wpm, 
    setIndex,
    startIndex,
    totalWordsInRange,
    positionInRange,
  } = useRSVP();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    // Berechne den absoluten Index innerhalb des Lesebereichs
    const relativeIndex = Math.floor(percentage * totalWordsInRange);
    const newIndex = startIndex + relativeIndex;
    setIndex(newIndex);
  };

  // Verbleibende Wörter im Lesebereich
  const remainingWords = totalWordsInRange - positionInRange;
  const remainingTime = estimateReadingTime(remainingWords, wpm);

  // Prozentanzeige basierend auf dem Lesebereich
  const progressPercent = totalWordsInRange > 0 
    ? Math.round((positionInRange / totalWordsInRange) * 100) 
    : 0;

  return (
    <div className="w-full max-w-2xl">
      {/* Progress Bar */}
      <div
        className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden"
        onClick={handleClick}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Info Row */}
      <div className="flex justify-between mt-2 text-sm text-gray-600 dark:text-gray-400">
        <span>
          Wort {positionInRange} von {totalWordsInRange}
        </span>
        <span className="font-medium">
          {progressPercent}%
        </span>
        <span>
          Verbleibend: {remainingTime}
        </span>
      </div>
    </div>
  );
}
