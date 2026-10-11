import { useRSVP } from '@/hooks/useRSVP';

interface PlaybackControlsProps {
  size?: 'sm' | 'md';
}

/**
 * Playback Controls Komponente mit Play/Pause und Navigations-Buttons.
 * Navigation zu Sätzen/Absätzen erfolgt über Tastenkombinationen:
 * - Pfeil Links/Rechts: Vorheriger/Nächster Satz
 * - Shift + Pfeil Links/Rechts: Vorheriger/Nächster Absatz
 */
export function PlaybackControls({ size = 'md' }: PlaybackControlsProps) {
  const { isPlaying, toggle, goToStart, goToEnd, totalWords } = useRSVP();

  const disabled = totalWords === 0;
  
  const isSmall = size === 'sm';
  const buttonPadding = isSmall ? 'p-1.5' : 'p-2';
  const playButtonPadding = isSmall ? 'p-2.5' : 'p-4';
  const iconSize = isSmall ? 'w-4 h-4' : 'w-5 h-5';
  const playIconSize = isSmall ? 'w-5 h-5' : 'w-8 h-8';

  return (
    <div className="flex items-center justify-center gap-2">
      {/* Zum Anfang */}
      <button
        onClick={goToStart}
        disabled={disabled}
        className={`${buttonPadding} rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Zum Anfang"
        title="Zum Anfang (Home)"
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={toggle}
        disabled={disabled}
        className={`${playButtonPadding} rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500
                   text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg className={playIconSize} fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className={playIconSize} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Zum Ende */}
      <button
        onClick={goToEnd}
        disabled={disabled}
        className={`${buttonPadding} rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Zum Ende"
        title="Zum Ende (End)"
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}
