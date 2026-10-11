import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { sendRequest } from '@/utils/messaging';
import { getAllProgress } from '@/utils/storage';
import { formatProgress } from '@/utils/textProcessor';
import type { ExtensionRequest } from '@/types/messages';
import type { BookProgress } from '@/types';

const RECENT_COUNT = 3;

interface MenuItemProps {
  title: string;
  description: string;
  tone: 'red' | 'purple' | 'green';
  icon: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}

const TONES = {
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
} as const;

function MenuItem({ title, description, tone, icon, onClick, busy = false, disabled = false }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
                 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
        {busy ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </button>
  );
}

function PopupContent() {
  const [recentBooks, setRecentBooks] = useState<BookProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAllProgress().then((progress) => {
      if (!cancelled) setRecentBooks(progress.slice(0, RECENT_COUNT));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(async (request: ExtensionRequest) => {
    setBusy(true);
    setError(null);
    const response = await sendRequest(request);
    if (!response.ok) {
      setBusy(false);
      setError(response.error);
      return;
    }
    // Der Service Worker hat den Reader-Tab geöffnet; das Popup schließt sich.
    window.close();
  }, []);

  return (
    <div className="w-80 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center" aria-hidden="true">
          <span className="text-white font-bold text-xl">R</span>
        </div>
        <div>
          <h1 className="font-bold text-lg">RSVP Speed Reader</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Schneller lesen mit ORP</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <MenuItem
          title="PDF Reader"
          description="PDF-Datei laden und lesen"
          tone="red"
          disabled={busy}
          onClick={() => void send({ type: 'OPEN_READER', mode: 'pdf' })}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
          }
        />
        <MenuItem
          title="ePub Reader"
          description="ePub-Datei laden und lesen"
          tone="purple"
          disabled={busy}
          onClick={() => void send({ type: 'OPEN_READER', mode: 'epub' })}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
            </svg>
          }
        />
        <MenuItem
          title="Aktuelle Seite lesen"
          description={busy ? 'Wird geladen…' : 'Markierten Text oder Hauptinhalt lesen'}
          tone="green"
          busy={busy}
          disabled={busy}
          onClick={() => void send({ type: 'READ_CURRENT_PAGE' })}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          }
        />
      </div>

      {recentBooks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Zuletzt gelesen</h2>
          <ul className="space-y-1">
            {recentBooks.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  disabled={busy || book.type === 'page'}
                  title={book.type === 'page' ? 'Webseiten müssen erneut über „Aktuelle Seite lesen“ geladen werden.' : undefined}
                  onClick={() => void send({ type: 'OPEN_READER', mode: book.type === 'epub' ? 'epub' : 'pdf', resumeId: book.id })}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800
                             transition-colors text-left text-sm disabled:opacity-60 disabled:cursor-default"
                >
                  <span className="truncate flex-1">{book.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {formatProgress(book.currentIndex, book.totalWords)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400 dark:text-gray-500">
        Leertaste = Wiedergabe/Pause · Pfeiltasten = Navigieren
      </p>
    </div>
  );
}

export function Popup() {
  return (
    <ThemeProvider>
      <PopupContent />
    </ThemeProvider>
  );
}
