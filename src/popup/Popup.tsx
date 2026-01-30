import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { getAllProgress } from '@/utils/storage';
import type { BookProgress } from '@/types';

function PopupContent() {
  const { resolvedTheme } = useTheme();
  const [recentBooks, setRecentBooks] = useState<BookProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllProgress().then(progress => {
      setRecentBooks(progress.slice(0, 3));
    });
  }, []);

  const openReader = (mode: 'pdf' | 'epub') => {
    const url = chrome.runtime.getURL(`src/reader/index.html?mode=${mode}`);
    chrome.tabs.create({ url });
  };

  const readCurrentPage = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Nutze den Service Worker um den Inhalt zu extrahieren und zu speichern
      const response = await chrome.runtime.sendMessage({ type: 'READ_CURRENT_PAGE' });
      
      if (!response.success) {
        setError(response.error || 'Fehler beim Laden der Seite');
      }
      // Bei Erfolg wird der Reader-Tab automatisch vom Service Worker geöffnet
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  };

  const continueReading = (book: BookProgress) => {
    const url = chrome.runtime.getURL(`src/reader/index.html?mode=${book.type}&id=${book.id}`);
    chrome.tabs.create({ url });
  };

  return (
    <div className={`w-80 ${resolvedTheme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">RSVP Speed Reader</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Schneller lesen mit ORP</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Menu Options */}
        <div className="space-y-2">
          <button
            onClick={() => openReader('pdf')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 
                       dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Open PDF Reader</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">PDF-Datei laden und lesen</p>
            </div>
          </button>

          <button
            onClick={() => openReader('epub')}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 
                       dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Open ePub Reader</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">ePub-Datei laden und lesen</p>
            </div>
          </button>

          <button
            onClick={readCurrentPage}
            disabled={isLoading}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 
                       dark:hover:bg-gray-800 transition-colors text-left
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-medium">Read Current Page</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isLoading ? 'Wird geladen...' : 'Aktuelle Webseite lesen'}
              </p>
            </div>
          </button>
        </div>

        {/* Recent Books */}
        {recentBooks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Zuletzt gelesen
            </h2>
            <div className="space-y-1">
              {recentBooks.map(book => (
                <button
                  key={book.id}
                  onClick={() => continueReading(book)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-100 
                             dark:hover:bg-gray-800 transition-colors text-left text-sm"
                >
                  <span className="truncate flex-1">{book.title}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {Math.round((book.currentIndex / book.totalWords) * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Space = Play/Pause | Pfeiltasten = Navigieren
          </p>
        </div>
      </div>
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
