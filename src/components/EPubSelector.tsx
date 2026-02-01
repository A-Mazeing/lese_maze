import { useMemo } from 'react';
import { useEPubParser } from '@/hooks/useEPubParser';
import { DocumentSelector, EPUB_CONFIG } from './shared/DocumentSelector';

/**
 * ePub File Selector mit Drag & Drop.
 * 
 * Refactored to use the unified DocumentSelector component.
 */
export function EPubSelector() {
  const { isLoading, error, fileName, title, author, chapters, loadEPub, reset } = useEPubParser();

  // Map hook state to DocumentSelector state format
  const state = useMemo(() => ({
    isLoading,
    error,
    fileName,
  }), [isLoading, error, fileName]);

  // Metadata to display when file is loaded
  const metadata = useMemo(() => {
    if (!fileName) return undefined;
    return {
      title: title || fileName,
      subtitle: `${author || 'Unbekannt'} • ${chapters.length} Kapitel`,
    };
  }, [fileName, title, author, chapters.length]);

  return (
    <DocumentSelector
      config={EPUB_CONFIG}
      state={state}
      metadata={metadata}
      onLoadFile={loadEPub}
      onReset={reset}
    />
  );
}
