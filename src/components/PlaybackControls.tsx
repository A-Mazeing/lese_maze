import { memo } from 'react';
import { useReaderDispatch, useReaderSelector, useReaderStore } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import { useT } from '@/i18n';

interface PlaybackControlsProps {
  size?: 'sm' | 'md';
}

const SKIP_WORDS = 5;

interface IconButtonProps {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
  children: React.ReactNode;
}

function IconButton({ label, title, onClick, disabled, className, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${className} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}

/** Play/Pause/Skip-Schaltflächen. */
export const PlaybackControls = memo(function PlaybackControls({ size = 'md' }: PlaybackControlsProps) {
  const t = useT();
  const isPlaying = useReaderSelector((s) => s.isPlaying);
  const disabled = useReaderSelector((s) => s.words.length === 0);
  const dispatch = useReaderDispatch();
  const store = useReaderStore();

  const isSmall = size === 'sm';
  const ghost = `${isSmall ? 'p-1.5' : 'p-2'} rounded-full hover:bg-gray-200 dark:hover:bg-gray-700`;
  const playClass = `${isSmall ? 'p-2.5' : 'p-4'} rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white`;
  const iconSize = isSmall ? 'w-4 h-4' : 'w-5 h-5';
  const skipIconSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const playIconSize = isSmall ? 'w-5 h-5' : 'w-8 h-8';

  return (
    <div className="flex items-center justify-center gap-2">
      <IconButton
        label={t('playback.toStart')}
        title={t('playback.toStartTitle')}
        disabled={disabled}
        className={ghost}
        onClick={() => dispatch({ type: 'SET_INDEX', payload: store.getState().startIndex })}
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </IconButton>

      <IconButton
        label={t('playback.skipBack', { n: SKIP_WORDS })}
        title={t('playback.skipBack', { n: SKIP_WORDS })}
        disabled={disabled}
        className={ghost}
        onClick={() => dispatch({ type: 'SKIP_BACKWARD', payload: SKIP_WORDS })}
      >
        <svg className={skipIconSize} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
        </svg>
      </IconButton>

      <IconButton
        label={isPlaying ? t('playback.pause') : t('playback.play')}
        title={isPlaying ? t('playback.pauseTitle') : t('playback.playTitle')}
        disabled={disabled}
        className={playClass}
        onClick={() => dispatch({ type: 'TOGGLE_PLAY' })}
      >
        <svg className={playIconSize} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </IconButton>

      <IconButton
        label={t('playback.skipForward', { n: SKIP_WORDS })}
        title={t('playback.skipForward', { n: SKIP_WORDS })}
        disabled={disabled}
        className={ghost}
        onClick={() => dispatch({ type: 'SKIP_FORWARD', payload: SKIP_WORDS })}
      >
        <svg className={skipIconSize} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
        </svg>
      </IconButton>

      <IconButton
        label={t('playback.toEnd')}
        title={t('playback.toEndTitle')}
        disabled={disabled}
        className={ghost}
        onClick={() => dispatch({ type: 'SET_INDEX', payload: getEffectiveEnd(store.getState()) })}
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </IconButton>
    </div>
  );
});
