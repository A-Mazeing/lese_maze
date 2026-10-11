import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';

interface PlaybackSettingsProps {
  compact?: boolean;
}

/**
 * Playback-Einstellungen für Ramp-up und Pause-Verhalten.
 */
export function PlaybackSettings({ compact = false }: PlaybackSettingsProps) {
  const dispatch = useReaderDispatch();
  const rampUpEnabled = useReaderSelector((s) => s.rampUpEnabled);
  const rampUpDuration = useReaderSelector((s) => s.rampUpDuration);
  const rewindOnPause = useReaderSelector((s) => s.rewindOnPause);

  const handleRampUpToggle = () => {
    dispatch({ type: 'SET_RAMP_UP_ENABLED', payload: !rampUpEnabled });
  };

  const handleRewindOnPauseToggle = () => {
    dispatch({ type: 'SET_REWIND_ON_PAUSE', payload: !rewindOnPause });
  };

  const handleRampUpDurationChange = (value: number) => {
    dispatch({ type: 'SET_RAMP_UP_DURATION', payload: value });
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {/* Ramp-up Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={rampUpEnabled}
            onChange={handleRampUpToggle}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                       text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-gray-700 dark:text-gray-300">Sanfter Start</span>
        </label>

        {/* Rewind on Pause Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={rewindOnPause}
            onChange={handleRewindOnPauseToggle}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                       text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-gray-700 dark:text-gray-300">Satz bei Pause</span>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Wiedergabe-Einstellungen
      </h3>

      {/* Ramp-up Setting */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rampUpEnabled}
            onChange={handleRampUpToggle}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                       text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Sanfter Start (Ramp-up)
          </span>
        </label>
        
        {rampUpEnabled && (
          <div className="flex items-center gap-2 ml-6">
            <input
              type="range"
              min="1"
              max="20"
              value={rampUpDuration}
              onChange={(e) => handleRampUpDurationChange(Number(e.target.value))}
              aria-label="Dauer des sanften Starts in Wörtern"
              className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
              {rampUpDuration} {rampUpDuration === 1 ? 'Chunk' : 'Chunks'}
            </span>
          </div>
        )}
        
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          Startet langsamer und beschleunigt zur Zielgeschwindigkeit
        </p>
      </div>

      {/* Rewind on Pause Setting */}
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rewindOnPause}
            onChange={handleRewindOnPauseToggle}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 
                       text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-gray-700 dark:text-gray-300">
            Bei Pause zum Satzanfang
          </span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          Springt beim Pausieren automatisch zum Anfang des aktuellen Satzes
        </p>
      </div>
    </div>
  );
}
