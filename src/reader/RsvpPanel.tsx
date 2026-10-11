import { AdSlot } from '@/components/ads/AdSlot';
import { PlaybackControls } from '@/components/PlaybackControls';
import { PlaybackSettings } from '@/components/PlaybackSettings';
import { ProgressBar } from '@/components/ProgressBar';
import { RSVPDisplay } from '@/components/RSVPDisplay';
import { SpeedControl } from '@/components/SpeedControl';
import { WordsPerChunkControl } from '@/components/WordsPerChunkControl';
import { useReaderDispatch, useReaderSelector } from '@/contexts/ReaderContext';

interface RsvpPanelProps {
  /** `lg`: Vollansicht, `sm`: schmale Spalte neben dem Text. */
  size?: 'lg' | 'sm';
}

/** RSVP-Anzeige samt allen Bedienelementen. */
export function RsvpPanel({ size = 'lg' }: RsvpPanelProps) {
  const compact = size === 'sm';
  const isFinished = useReaderSelector((s) => s.isFinished);
  const dispatch = useReaderDispatch();

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        className={`w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700
                    ${compact ? 'max-w-md p-6' : 'max-w-3xl p-8'}`}
      >
        <RSVPDisplay fontSize={compact ? 42 : 56} />
        {isFinished && (
          <div role="status" className="mt-2 flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span>Ende des Lesebereichs erreicht.</span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'PLAY' })}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Von vorn
            </button>
          </div>
        )}
      </div>

      <div className={`flex flex-col items-center gap-3 w-full ${compact ? 'max-w-sm' : 'max-w-xl'}`}>
        <PlaybackControls size={compact ? 'sm' : 'md'} />
        <ProgressBar />
        <SpeedControl compact={compact} />
        <WordsPerChunkControl compact={compact} />
        <PlaybackSettings compact={compact} />
      </div>

      {/* Nur am Ende des Lesens, nie während der Wiedergabe. */}
      {isFinished && <AdSlot placement="finished" />}
    </div>
  );
}
