// Reader Types
export interface ReaderState {
  words: string[];
  currentIndex: number;
  isPlaying: boolean;
  wpm: number;
  progress: number;
  wordsPerChunk: number;  // Anzahl der gleichzeitig angezeigten Wörter (1-4)
  // Preview-bezogene States
  previewMode: boolean;
  startIndex: number;
  endIndex: number | null;
  originalContent: string | null;
  metadata: ContentMetadata;
  // Text-Struktur für Navigation
  sentenceBreaks: number[];   // Indices wo Sätze beginnen
  paragraphBreaks: number[];  // Indices wo Absätze beginnen
}

export interface ContentMetadata {
  title: string | null;
  sourceType: 'pdf' | 'epub' | 'page' | null;
  chapters?: Chapter[];
  pageBreaks?: number[]; // Wort-Indices bei Seitenumbrüchen (für PDF)
  totalPages?: number;
}

export interface Chapter {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface SelectionRange {
  startIndex: number;
  endIndex: number;
}

export interface BookProgress {
  id: string;
  title: string;
  type: 'pdf' | 'epub' | 'page';
  currentIndex: number;
  totalWords: number;
  lastRead: number;
  wpm: number;
}

export interface Settings {
  wpm: number;
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  wordsPerChunk: number;
}

export interface ORPWord {
  before: string;
  orp: string;
  after: string;
  fullWord: string;
}

// Chrome Message Types
export type MessageType = 
  | 'OPEN_PDF_READER'
  | 'OPEN_EPUB_READER'
  | 'READ_CURRENT_PAGE'
  | 'GET_PAGE_CONTENT'
  | 'PAGE_CONTENT_RESPONSE';

export interface ChromeMessage {
  type: MessageType;
  payload?: unknown;
}

export interface PageContentResponse {
  type: 'PAGE_CONTENT_RESPONSE';
  payload: {
    content: string;
    title: string;
    url: string;
  };
}

// PDF Types
export interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
}

export interface PDFPage {
  getTextContent: () => Promise<PDFTextContent>;
  getViewport: (options: { scale: number }) => PDFViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }) => PDFRenderTask;
}

export interface PDFViewport {
  width: number;
  height: number;
  scale: number;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PDFTextContent {
  items: PDFTextItem[];
}

export interface PDFTextItem {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

// PDF Viewer Types
export interface PDFViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
  isLoading: boolean;
}

export interface PageTextMapping {
  pageNum: number;
  wordStartIndex: number;
  wordEndIndex: number;
}

// ePub Types
export interface CFICheckpoint {
  wordIndex: number;
  cfi: string;
  chapterIndex?: number;
}

export interface EPubLocation {
  cfi: string;
  percentage: number;
  displayed: {
    page: number;
    total: number;
  };
}

export interface EPubViewerState {
  currentLocation: string | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
}
