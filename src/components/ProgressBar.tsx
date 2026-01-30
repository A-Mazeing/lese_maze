import { useRSVP } from '@/hooks/useRSVP';
import { formatProgress, estimateReadingTime } from '@/utils/textProcessor';

/**
 * Progress Bar Komponente mit Fortschrittsanzeige.
 */
export function ProgressBar() {
  const { currentIndex, totalWords, progress, wpm, setIndex } = useRSVP();

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newIndex = Math.floor(percentage * totalWords);
    setIndex(newIndex);
  };

  const remainingWords = totalWords - currentIndex;
  const remainingTime = estimateReadingTime(remainingWords, wpm);

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
          Wort {currentIndex + 1} von {totalWords}
        </span>
        <span className="font-medium">
          {formatProgress(currentIndex, totalWords)}
        </span>
        <span>
          Verbleibend: {remainingTime}
        </span>
      </div>
    </div>
  );
}
