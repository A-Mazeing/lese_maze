import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '@/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Wird nach "Neu versuchen" aufgerufen (z. B. um fehlerhaften Zustand zurückzusetzen). */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Fängt Render-Fehler ab, damit ein Fehler in einer Ansicht nicht die ganze Seite leer lässt.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] Unbehandelter Fehler:', error, info.componentStack);
  }

  private readonly retry = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">{t('error.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-words">{error.message}</p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {t('error.retry')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('error.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
