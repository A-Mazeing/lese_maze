import { useState } from 'react';
import { useReaderDocuments } from '@/contexts/ReaderContext';
import { PDFPageViewer } from '@/components/PDFPageViewer';
import { PDFTextViewer } from '@/components/viewer';

interface PDFViewerProps {
  className?: string;
  onStartReading?: () => void;
}

type PdfView = 'pages' | 'text';

const VIEWS: ReadonlyArray<readonly [PdfView, string]> = [
  ['pages', 'Original'],
  ['text', 'Text'],
];

/**
 * PDF-Ansicht: standardmäßig das Original (Seiten mit Layout und Grafiken), umschaltbar auf
 * die reine Textliste. Fehlt das geöffnete Dokument (z. B. nach einem Neuladen der Seite),
 * wird automatisch die Textliste gezeigt – das Lesen selbst ist davon nicht betroffen.
 */
export function PDFViewer({ className = '', onStartReading }: PDFViewerProps) {
  const { getPdf } = useReaderDocuments();
  // Der Viewer wird pro Dokument neu eingehängt (key in Reader), das Handle ändert sich also nicht.
  const [handle] = useState(() => getPdf());
  const [view, setView] = useState<PdfView>('pages');

  if (!handle) {
    return (
      <div className={`flex flex-col h-full min-h-0 ${className}`}>
        <p role="status" className="flex-shrink-0 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          Die Originalansicht ist nicht verfügbar. Der Text wird ohne Seitenlayout angezeigt.
        </p>
        <PDFTextViewer className="flex-1 min-h-0" onStartReading={onStartReading} />
      </div>
    );
  }

  const toggle = (
    <div role="group" aria-label="PDF-Darstellung" className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
      {VIEWS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => setView(value)}
          className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
            view === value
              ? 'bg-white dark:bg-gray-600 shadow-sm font-medium'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return view === 'pages' ? (
    <PDFPageViewer handle={handle} className={className} onStartReading={onStartReading} toolbarExtra={toggle} />
  ) : (
    <PDFTextViewer className={className} onStartReading={onStartReading} toolbarExtra={toggle} />
  );
}
