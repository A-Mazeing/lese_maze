import { ReactNode } from 'react';

interface LoadingStateProps {
  /** Message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
  /** Spinner color - uses Tailwind color */
  color?: 'blue' | 'purple' | 'green' | 'red';
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
}

const spinnerColors = {
  blue: 'border-blue-500',
  purple: 'border-purple-500',
  green: 'border-green-500',
  red: 'border-red-500',
};

const spinnerSizes = {
  sm: 'h-6 w-6 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

/**
 * Reusable loading state component with spinner and optional message.
 */
export function LoadingState({ 
  message, 
  className = '',
  color = 'blue',
  size = 'md',
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div 
        className={`animate-spin rounded-full ${spinnerSizes[size]} ${spinnerColors[color]} border-t-transparent`} 
      />
      {message && (
        <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
      )}
    </div>
  );
}

interface LoadingOverlayProps extends LoadingStateProps {
  /** Whether to show the overlay */
  show: boolean;
}

/**
 * Full-overlay loading state with semi-transparent background.
 */
export function LoadingOverlay({ show, ...props }: LoadingOverlayProps) {
  if (!show) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10">
      <LoadingState {...props} />
    </div>
  );
}

interface ErrorDisplayProps {
  /** Error message to display */
  message: string;
  /** Additional CSS classes */
  className?: string;
  /** Show as overlay */
  overlay?: boolean;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Reusable error display component.
 */
export function ErrorDisplay({ 
  message, 
  className = '',
  overlay = false,
  action,
}: ErrorDisplayProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 p-4 ${className}`}>
      <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
      <p className="text-red-600 dark:text-red-400 text-center">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 
                     rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-10">
        {content}
      </div>
    );
  }

  return content;
}

interface ErrorBannerProps {
  /** Error message */
  message: string;
  /** Optional dismiss handler */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Inline error banner for non-blocking error display.
 */
export function ErrorBanner({ message, onDismiss, className = '' }: ErrorBannerProps) {
  return (
    <div className={`p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                     rounded-lg flex items-center justify-between ${className}`}>
      <p className="text-red-600 dark:text-red-400 text-sm">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Custom icon */
  icon?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state placeholder component.
 */
export function EmptyState({ 
  title = 'Keine Daten',
  description,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 ${className}`}>
      {icon || (
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}
