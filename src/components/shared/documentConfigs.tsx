import { t } from '@/i18n';
import type { DocumentTypeConfig } from './DocumentSelector';

/** Vorkonfigurierte Dokumenttypen für PDF und ePub. */
export const PDF_CONFIG: DocumentTypeConfig = {
  type: 'pdf',
  accept: '.pdf,application/pdf',
  mimeType: 'application/pdf',
  extension: '.pdf',
  color: 'green',
  // Getter: wird bei jedem Rendern in der aktuellen Sprache ausgewertet.
  get label() {
    return t('doc.pdfFile');
  },
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
  get label() {
    return t('doc.epubFile');
  },
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
