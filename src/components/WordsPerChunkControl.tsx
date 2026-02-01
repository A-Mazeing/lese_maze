import { useRSVP } from '@/hooks/useRSVP';

interface WordsPerChunkControlProps {
  compact?: boolean;
}

/**
 * Words Per Chunk Control Komponente mit Slider (1-4 Wörter).
 * Ermöglicht die Einstellung, wie viele Wörter gleichzeitig im RSVP-Modus angezeigt werden.
 */
export function WordsPerChunkControl({ compact = false }: WordsPerChunkControlProps) {
  const { wordsPerChunk, setWordsPerChunk } = useRSVP();

  const label = wordsPerChunk === 1 ? 'Wort' : 'Wörter';

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-bold text-gray-900 dark:text-gray-100">{wordsPerChunk}</span> {label}
        </span>

        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={wordsPerChunk}
          onChange={(e) => setWordsPerChunk(Number(e.target.value))}
          className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                     accent-blue-500 dark:accent-blue-400"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 w-full max-w-md">
      <span className="text-sm text-gray-600 dark:text-gray-400 w-20">
        {label}: <span className="font-bold text-gray-900 dark:text-gray-100">{wordsPerChunk}</span>
      </span>

      <input
        type="range"
        min={1}
        max={4}
        step={1}
        value={wordsPerChunk}
        onChange={(e) => setWordsPerChunk(Number(e.target.value))}
        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                   accent-blue-500 dark:accent-blue-400"
      />

      <div className="flex gap-1">
        <button
          onClick={() => setWordsPerChunk(Math.max(1, wordsPerChunk - 1))}
          className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 
                     dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          aria-label="Weniger Wörter"
          disabled={wordsPerChunk <= 1}
        >
          -1
        </button>
        <button
          onClick={() => setWordsPerChunk(Math.min(4, wordsPerChunk + 1))}
          className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 
                     dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          aria-label="Mehr Wörter"
          disabled={wordsPerChunk >= 4}
        >
          +1
        </button>
      </div>
    </div>
  );
}
