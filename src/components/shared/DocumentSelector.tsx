import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '@/i18n';

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
  onLoadFile: (file: File) => unknown;
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = colorClasses[config.color];
  const t = useT();

  const validateFile = useCallback((file: File): boolean => {
    // Der MIME-Typ ist je nach System leer oder abweichend; die Endung ist maßgeblich (ohne Groß-/Kleinschreibung).
    return file.type === config.mimeType || file.name.toLowerCase().endsWith(config.extension);
  }, [config.mimeType, config.extension]);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setValidationError(null);
      onLoadFile(file);
    } else {
      // Inline statt window.alert(): blockiert nicht und ist für Screenreader sichtbar (role="alert").
      setValidationError(t('selector.pickValid', { label: config.label }));
    }
  }, [validateFile, onLoadFile, config.label, t]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    // Beim Überfahren von Kindelementen feuert dragleave – nur echtes Verlassen zählt.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Erlaubt, dieselbe Datei nach "Entfernen" erneut zu wählen.
    e.target.value = '';
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 
                      dark:border-gray-600 rounded-lg">
        <div className={`animate-spin rounded-full h-12 w-12 border-4 ${colors.spinner} border-t-transparent mb-4`} />
        <p className="text-gray-600 dark:text-gray-400" role="status">
          {state.loadingProgress || t('selector.loading', { label: config.label })}
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
            {t('selector.remove')}
          </button>
        </div>
        {state.error && (
          <div role="alert" className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{state.error}</p>
          </div>
        )}
      </div>
    );
  }

  // Default drop zone state
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('selector.choose', { label: config.label })}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg 
                  cursor-pointer transition-colors
                  ${isDragOver 
                    ? `${colors.border} ${colors.bg}` 
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                  ${state.error || validationError ? 'border-red-300 dark:border-red-600' : ''}`}
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
        {t('selector.drop', { label: config.label })}
      </p>
      
      {(validationError || state.error) && (
        <p role="alert" className="text-red-500 dark:text-red-400 text-sm mt-2 text-center">
          {validationError || state.error}
        </p>
      )}
    </div>
  );
}
