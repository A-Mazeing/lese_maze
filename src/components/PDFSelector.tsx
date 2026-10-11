import { useMemo } from 'react';
import { usePDFParser } from '@/hooks/usePDFParser';
import { DocumentSelector } from './shared/DocumentSelector';
import { PDF_CONFIG } from './shared/documentConfigs';

/**
 * PDF File Selector mit Drag & Drop.
 * 
 * Refactored to use the unified DocumentSelector component.
 */
export function PDFSelector() {
  const { isLoading, error, fileName, pageCount, currentPage, loadPDF, reset } = usePDFParser();

  // Map hook state to DocumentSelector state format
  const state = useMemo(() => ({
    isLoading,
    error,
    fileName,
    loadingProgress: isLoading && pageCount > 0 
      ? `Lade PDF... Seite ${currentPage} von ${pageCount}` 
      : undefined,
  }), [isLoading, error, fileName, pageCount, currentPage]);

  // Metadata to display when file is loaded
  const metadata = useMemo(() => {
    if (!fileName) return undefined;
    return {
      title: fileName,
      subtitle: `${pageCount} Seiten`,
    };
  }, [fileName, pageCount]);

  return (
    <DocumentSelector
      config={PDF_CONFIG}
      state={state}
      metadata={metadata}
      onLoadFile={loadPDF}
      onReset={reset}
    />
  );
}
