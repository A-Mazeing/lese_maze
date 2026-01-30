import { useCallback, useRef, useState } from 'react';
import { useEPubParser } from '@/hooks/useEPubParser';

/**
 * ePub File Selector mit Drag & Drop.
 */
export function EPubSelector() {
  const { isLoading, error, fileName, title, author, chapters, loadEPub, reset } = useEPubParser();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
      loadEPub(file);
    } else {
      alert('Bitte wähle eine ePub-Datei aus.');
    }
  }, [loadEPub]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 
                      dark:border-gray-600 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Lade ePub...
        </p>
      </div>
    );
  }

  if (fileName) {
    return (
      <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 
                      border border-purple-200 dark:border-purple-800 rounded-lg">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
          </svg>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{title || fileName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {author} • {chapters.length} Kapitel
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 
                     dark:hover:bg-red-900/20 rounded transition-colors"
        >
          Entfernen
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg 
                  cursor-pointer transition-colors
                  ${isDragOver 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${error ? 'border-red-300 dark:border-red-600' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        ePub-Datei hierher ziehen oder klicken zum Auswählen
      </p>
      
      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
