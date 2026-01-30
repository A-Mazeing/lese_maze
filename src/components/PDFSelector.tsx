import { useCallback, useRef, useState } from 'react';
import { usePDFParser } from '@/hooks/usePDFParser';

/**
 * PDF File Selector mit Drag & Drop.
 */
export function PDFSelector() {
  const { isLoading, error, fileName, pageCount, currentPage, loadPDF, reset } = usePDFParser();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      loadPDF(file);
    } else {
      alert('Bitte wähle eine PDF-Datei aus.');
    }
  }, [loadPDF]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          Lade PDF... Seite {currentPage} von {pageCount}
        </p>
      </div>
    );
  }

  if (fileName) {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 
                      border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
          </svg>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{fileName}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{pageCount} Seiten</p>
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${error ? 'border-red-300 dark:border-red-600' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      
      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        PDF-Datei hierher ziehen oder klicken zum Auswählen
      </p>
      
      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  );
}
