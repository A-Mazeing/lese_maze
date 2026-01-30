import { useEffect, useState } from 'react';
import { getAllProgress, deleteProgress } from '@/utils/storage';
import type { BookProgress } from '@/types';

interface BookmarkListProps {
  onSelect?: (bookmark: BookProgress) => void;
}

/**
 * Liste der gespeicherten Lesefortschritte.
 */
export function BookmarkList({ onSelect }: BookmarkListProps) {
  const [bookmarks, setBookmarks] = useState<BookProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setIsLoading(true);
    const progress = await getAllProgress();
    setBookmarks(progress);
    setIsLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProgress(id);
    await loadBookmarks();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          </svg>
        );
      case 'epub':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
          </svg>
        );
      case 'page':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <p>Keine gespeicherten Lesezeichen</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          onClick={() => onSelect?.(bookmark)}
          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border 
                     border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 
                     cursor-pointer transition-colors group"
        >
          {getTypeIcon(bookmark.type)}
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {bookmark.title}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{Math.round((bookmark.currentIndex / bookmark.totalWords) * 100)}% gelesen</span>
              <span>•</span>
              <span>{bookmark.wpm} WPM</span>
              <span>•</span>
              <span>{formatDate(bookmark.lastRead)}</span>
            </div>
          </div>

          {/* Progress Ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 transform -rotate-90">
              <circle
                className="text-gray-200 dark:text-gray-700"
                strokeWidth="3"
                stroke="currentColor"
                fill="transparent"
                r="16"
                cx="20"
                cy="20"
              />
              <circle
                className="text-blue-500"
                strokeWidth="3"
                strokeDasharray={100}
                strokeDashoffset={100 - (bookmark.currentIndex / bookmark.totalWords) * 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="16"
                cx="20"
                cy="20"
              />
            </svg>
          </div>

          {/* Delete Button */}
          <button
            onClick={(e) => handleDelete(bookmark.id, e)}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 
                       rounded transition-all"
            aria-label="Lesezeichen löschen"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
