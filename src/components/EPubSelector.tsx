import { useMemo } from 'react';
import { useEPubParser } from '@/hooks/useEPubParser';
import { useReaderSelector } from '@/contexts/ReaderContext';
import { DocumentSelector } from './shared/DocumentSelector';
import { EPUB_CONFIG } from './shared/documentConfigs';

/**
 * ePub File Selector mit Drag & Drop.
 * 
 * Refactored to use the unified DocumentSelector component.
 */
export function EPubSelector() {
  const { isLoading, error, fileName, title, author, progressDone, progressTotal, loadEPub, reset } = useEPubParser();

  const chapterCount = useReaderSelector((s) => s.metadata.chapters?.length ?? 0);

  // Map hook state to DocumentSelector state format
  const state = useMemo(() => ({
    isLoading,
    error,
    fileName,
    loadingProgress: isLoading && progressTotal > 0
      ? `Lade ePub... Abschnitt ${Math.min(progressDone + 1, progressTotal)} von ${progressTotal}`
      : undefined,
  }), [isLoading, error, fileName, progressDone, progressTotal]);

  // Metadata to display when file is loaded
  const metadata = useMemo(() => {
    if (!fileName) return undefined;
    return {
      title: title || fileName,
      subtitle: `${author || 'Unbekannter Autor'} • ${chapterCount} Kapitel`,
    };
  }, [fileName, title, author, chapterCount]);

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
