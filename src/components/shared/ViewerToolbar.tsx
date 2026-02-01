import { ReactNode, useCallback } from 'react';

interface NavigationButtonsProps {
  /** Go to previous item */
  onPrev: () => void;
  /** Go to next item */
  onNext: () => void;
  /** Whether prev is disabled */
  prevDisabled?: boolean;
  /** Whether next is disabled */
  nextDisabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable navigation buttons (prev/next).
 */
export function NavigationButtons({
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  className = '',
}: NavigationButtonsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={onPrev}
        disabled={prevDisabled}
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Zurück"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Weiter"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

interface PageIndicatorProps {
  /** Current page/index */
  current: number;
  /** Total pages */
  total: number;
  /** Callback when page is changed via input */
  onPageChange?: (page: number) => void;
  /** Whether to show input field for page jump */
  editable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Page indicator with optional input field for direct navigation.
 */
export function PageIndicator({
  current,
  total,
  onPageChange,
  editable = false,
  className = '',
}: PageIndicatorProps) {
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input');
    if (input && onPageChange) {
      const pageNum = parseInt(input.value, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= total) {
        onPageChange(pageNum);
      }
    }
  }, [onPageChange, total]);

  if (editable && onPageChange) {
    return (
      <form onSubmit={handleSubmit} className={`flex items-center gap-1 ${className}`}>
        <input
          type="text"
          defaultValue={current}
          key={current} // Reset input when current changes
          className="w-12 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 
                     rounded bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Seitennummer"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">/ {total}</span>
      </form>
    );
  }

  return (
    <span className={`text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap ${className}`}>
      {current} / {total}
    </span>
  );
}

interface StartReadingButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Button label */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Start reading button with play icon.
 */
export function StartReadingButton({
  onClick,
  label = 'Lesen starten',
  disabled = false,
  className = '',
  size = 'md',
}: StartReadingButtonProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white 
                 font-medium rounded transition-colors flex items-center gap-1.5
                 ${sizeClasses[size]} ${className}`}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
      {label}
    </button>
  );
}

interface ViewerToolbarProps {
  /** Navigation handlers */
  navigation: {
    onPrev: () => void;
    onNext: () => void;
    prevDisabled?: boolean;
    nextDisabled?: boolean;
  };
  /** Page information */
  pageInfo?: {
    current: number;
    total: number;
    onPageChange?: (page: number) => void;
    editable?: boolean;
  };
  /** Start reading handler */
  onStartReading?: () => void;
  /** Additional controls to show in the middle section */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified toolbar for viewer components.
 * Provides consistent navigation, page info, and start reading button.
 */
export function ViewerToolbar({
  navigation,
  pageInfo,
  onStartReading,
  children,
  className = '',
}: ViewerToolbarProps) {
  return (
    <div 
      className={`flex-shrink-0 flex items-center justify-between gap-2 p-2 
                  bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
                  ${className}`}
    >
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        <NavigationButtons
          onPrev={navigation.onPrev}
          onNext={navigation.onNext}
          prevDisabled={navigation.prevDisabled}
          nextDisabled={navigation.nextDisabled}
        />
        
        {pageInfo && (
          <PageIndicator
            current={pageInfo.current}
            total={pageInfo.total}
            onPageChange={pageInfo.onPageChange}
            editable={pageInfo.editable}
          />
        )}
      </div>

      {/* Center: Custom controls */}
      {children && (
        <div className="flex-1 flex items-center justify-center gap-2">
          {children}
        </div>
      )}

      {/* Right: Start Reading */}
      {onStartReading && (
        <StartReadingButton onClick={onStartReading} />
      )}
    </div>
  );
}

interface ReadingRangeInfoProps {
  /** Start word index (0-based) */
  startIndex: number;
  /** End word index (0-based), null means end of document */
  endIndex: number | null;
  /** Total number of words */
  totalWords: number;
  /** Callback to reset the range */
  onReset: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Info bar showing the current reading range.
 */
export function ReadingRangeInfo({
  startIndex,
  endIndex,
  totalWords,
  onReset,
  className = '',
}: ReadingRangeInfoProps) {
  // Don't show if default range (start=0, end=null)
  if (startIndex === 0 && endIndex === null) return null;

  return (
    <div 
      className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 
                  border-b border-blue-200 dark:border-blue-800 text-sm ${className}`}
    >
      <span className="text-blue-700 dark:text-blue-300">
        Lesebereich: Wort {startIndex + 1} bis {endIndex !== null ? endIndex + 1 : totalWords}
      </span>
      <button
        onClick={onReset}
        className="ml-auto text-blue-600 dark:text-blue-400 hover:underline"
      >
        Zurücksetzen
      </button>
    </div>
  );
}

interface ViewerInstructionsProps {
  /** Instruction text */
  text: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Instructions footer for viewers.
 */
export function ViewerInstructions({ text, className = '' }: ViewerInstructionsProps) {
  return (
    <div 
      className={`flex-shrink-0 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-t 
                  border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400
                  ${className}`}
    >
      {text}
    </div>
  );
}
