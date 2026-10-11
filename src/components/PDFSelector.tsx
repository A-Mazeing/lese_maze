import { useMemo } from 'react';
import { usePDFParser } from '@/hooks/usePDFParser';
import { useT } from '@/i18n';
import { DocumentSelector } from './shared/DocumentSelector';
import { PDF_CONFIG } from './shared/documentConfigs';

/**
 * PDF File Selector mit Drag & Drop.
 * 
 * Refactored to use the unified DocumentSelector component.
 */
export function PDFSelector() {
  const t = useT();
  const { isLoading, error, fileName, pageCount, currentPage, loadPDF, reset } = usePDFParser();

  // Map hook state to DocumentSelector state format
  const state = useMemo(() => ({
    isLoading,
    error,
    fileName,
    loadingProgress: isLoading && pageCount > 0 
      ? t('pdf.loadingPage', { page: currentPage, total: pageCount })
      : undefined,
  }), [isLoading, error, fileName, pageCount, currentPage, t]);

  // Metadata to display when file is loaded
  const metadata = useMemo(() => {
    if (!fileName) return undefined;
    return {
      title: fileName,
      subtitle: t('pdf.pages', { count: pageCount }),
    };
  }, [fileName, pageCount, t]);

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
