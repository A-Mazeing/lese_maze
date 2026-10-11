import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';
import { useT } from '@/i18n';
import { WPM_MAX, WPM_MIN } from '@/utils/storage';

interface SpeedControlProps {
  compact?: boolean;
}

/**
 * Geschwindigkeitsregler (Slider 100-1000 WPM; per Tastatur/Buttons 50-1500).
 */
export function SpeedControl({ compact = false }: SpeedControlProps) {
  const t = useT();
  const wpm = useReaderSelector((s) => s.wpm);
  const dispatch = useReaderDispatch();
  const setWpm = (value: number) => dispatch({ type: 'SET_WPM', payload: value });

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-bold text-gray-900 dark:text-gray-100">{wpm}</span> WPM
        </span>

        <input
          type="range"
          min={100}
          max={1000}
          step={25}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          aria-label={t('speed.label')}
          className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                     accent-blue-500 dark:accent-blue-400"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 w-full max-w-md">
      <span className="text-sm text-gray-600 dark:text-gray-400 w-20">
        WPM: <span className="font-bold text-gray-900 dark:text-gray-100">{wpm}</span>
      </span>

      <input
        type="range"
        min={100}
        max={1000}
        step={10}
        value={wpm}
        onChange={(e) => setWpm(Number(e.target.value))}
        aria-label={t('speed.label')}
        className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                   accent-blue-500 dark:accent-blue-400"
      />

      <div className="flex gap-1">
        <button
          onClick={() => setWpm(Math.max(WPM_MIN, wpm - 50))}
          className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 
                     dark:hover:bg-gray-600 transition-colors"
          aria-label={t('speed.decrease')}
        >
          -50
        </button>
        <button
          onClick={() => setWpm(Math.min(WPM_MAX, wpm + 50))}
          className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 
                     dark:hover:bg-gray-600 transition-colors"
          aria-label={t('speed.increase')}
        >
          +50
        </button>
      </div>
    </div>
  );
}
