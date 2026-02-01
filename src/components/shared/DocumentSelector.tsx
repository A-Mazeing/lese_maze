import { useCallback, useRef, useState, ReactNode } from 'react';

/**
 * Configuration for a document type.
 */
export interface DocumentTypeConfig {
  /** File type identifier */
  type: 'pdf' | 'epub';
  /** Accepted file extensions/MIME types */
  accept: string;
  /** MIME type for validation */
  mimeType: string;
  /** File extension for validation */
  extension: string;
  /** Theme color for the UI */
  color: 'blue' | 'purple' | 'green' | 'red';
  /** Label shown to user */
  label: string;
  /** Icon component */
  icon: ReactNode;
  /** Icon for success state */
  successIcon: ReactNode;
}

/**
 * Parser state passed from hook.
 */
export interface DocumentParserState {
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  loadingProgress?: string;
}

/**
 * Extended metadata shown when document is loaded.
 */
export interface DocumentMetadataDisplay {
  /** Primary title/filename */
  title: string;
  /** Subtitle (e.g. page count, chapter count) */
  subtitle: string;
}

interface DocumentSelectorProps {
  /** Document type configuration */
  config: DocumentTypeConfig;
  /** Parser state from hook */
  state: DocumentParserState;
  /** Metadata to display when loaded */
  metadata?: DocumentMetadataDisplay;
  /** Called when file should be loaded */
  onLoadFile: (file: File) => void;
  /** Called when file should be reset/removed */
  onReset: () => void;
}

// Color mappings for dynamic styling
const colorClasses = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    spinner: 'border-blue-500',
    successBg: 'bg-blue-50 dark:bg-blue-900/20',
    successBorder: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    spinner: 'border-purple-500',
    successBg: 'bg-purple-50 dark:bg-purple-900/20',
    successBorder: 'border-purple-200 dark:border-purple-800',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
    spinner: 'border-green-500',
    successBg: 'bg-green-50 dark:bg-green-900/20',
    successBorder: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    spinner: 'border-red-500',
    successBg: 'bg-red-50 dark:bg-red-900/20',
    successBorder: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

/**
 * Unified document selector component with drag & drop support.
 * 
 * Replaces PDFSelector and EPubSelector with a single, configurable component.
 */
export function DocumentSelector({
  config,
  state,
  metadata,
  onLoadFile,
  onReset,
}: DocumentSelectorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = colorClasses[config.color];

  const validateFile = useCallback((file: File): boolean => {
    return file.type === config.mimeType || file.name.endsWith(config.extension);
  }, [config.mimeType, config.extension]);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onLoadFile(file);
    } else {
      alert(`Bitte wähle eine ${config.label} aus.`);
    }
  }, [validateFile, onLoadFile, config.label]);

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

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 
                      dark:border-gray-600 rounded-lg">
        <div className={`animate-spin rounded-full h-12 w-12 border-4 ${colors.spinner} border-t-transparent mb-4`} />
        <p className="text-gray-600 dark:text-gray-400">
          {state.loadingProgress || `Lade ${config.label}...`}
        </p>
      </div>
    );
  }

  // File loaded state
  if (state.fileName && metadata) {
    return (
      <div className="flex flex-col gap-2">
        <div className={`flex items-center justify-between p-4 ${colors.successBg} 
                        border ${colors.successBorder} rounded-lg`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${colors.iconColor}`}>
              {config.successIcon}
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{metadata.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{metadata.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 
                       dark:hover:bg-red-900/20 rounded transition-colors"
          >
            Entfernen
          </button>
        </div>
        {state.error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{state.error}</p>
          </div>
        )}
      </div>
    );
  }

  // Default drop zone state
  return (
    <div
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg 
                  cursor-pointer transition-colors
                  ${isDragOver 
                    ? `${colors.border} ${colors.bg}` 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${state.error ? 'border-red-300 dark:border-red-600' : ''}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleInputChange}
        className="hidden"
      />
      
      <div className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4">
        {config.icon}
      </div>
      
      <p className="text-gray-600 dark:text-gray-400 mb-2">
        {config.label} hierher ziehen oder klicken zum Auswählen
      </p>
      
      {state.error && (
        <p className="text-red-500 dark:text-red-400 text-sm mt-2">{state.error}</p>
      )}
    </div>
  );
}

// Pre-configured document type configs for PDF and ePub
export const PDF_CONFIG: DocumentTypeConfig = {
  type: 'pdf',
  accept: '.pdf,application/pdf',
  mimeType: 'application/pdf',
  extension: '.pdf',
  color: 'green',
  label: 'PDF-Datei',
  icon: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  successIcon: (
    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
    </svg>
  ),
};

export const EPUB_CONFIG: DocumentTypeConfig = {
  type: 'epub',
  accept: '.epub,application/epub+zip',
  mimeType: 'application/epub+zip',
  extension: '.epub',
  color: 'purple',
  label: 'ePub-Datei',
  icon: (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  successIcon: (
    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
    </svg>
  ),
};
