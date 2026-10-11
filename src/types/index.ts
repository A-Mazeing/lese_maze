/**
 * Zentrale Typdefinitionen der Anwendung.
 * Nachrichten-Typen für die Extension-Kommunikation liegen in ./messages.ts.
 */

export type SourceType = 'pdf' | 'epub' | 'page';

/** Struktur, die der Reader-Reducer verwaltet. */
export interface ReaderState {
  words: string[];
  /** Index des ersten Wortes des aktuell angezeigten Chunks. */
  currentIndex: number;
  isPlaying: boolean;
  /** true, sobald die Wiedergabe das Ende des Lesebereichs erreicht hat. */
  isFinished: boolean;
  wpm: number;
  /** Fortschritt im Lesebereich in Prozent (0-100). */
  progress: number;
  /** Anzahl der gleichzeitig angezeigten Wörter (1-4). */
  wordsPerChunk: number;
  previewMode: boolean;
  startIndex: number;
  endIndex: number | null;
  originalContent: string | null;
  metadata: ContentMetadata;
  /** Indices, an denen ein Satz beginnt (aufsteigend sortiert). */
  sentenceBreaks: number[];
  /** Indices, an denen ein Absatz beginnt (aufsteigend sortiert). */
  paragraphBreaks: number[];
  rampUpEnabled: boolean;
  /** Anzahl der Chunks, über die beschleunigt wird. */
  rampUpDuration: number;
  /** Verbleibende Chunks des laufenden Ramp-ups. */
  rampUpWordsRemaining: number;
  /** Bei Pause zum Satzanfang zurückspringen. */
  rewindOnPause: boolean;
}

export interface ContentMetadata {
  title: string | null;
  sourceType: SourceType | null;
  chapters?: Chapter[];
  /** Wort-Indices, an denen eine PDF-Seite beginnt (pageBreaks[0] === 0). */
  pageBreaks?: number[];
  totalPages?: number;
  /** Stabile Dokument-ID für den gespeicherten Lesefortschritt. */
  documentId?: string;
}

export interface Chapter {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
  /** Position im ePub-Spine (für die Navigation im Viewer). */
  spineIndex?: number;
  /** href des Spine-Items (für die Navigation im Viewer). */
  href?: string;
}

export interface SelectionRange {
  startIndex: number;
  endIndex: number;
}

export interface BookProgress {
  id: string;
  title: string;
  type: SourceType;
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
  rampUpEnabled: boolean;
  rampUpDuration: number;
  rewindOnPause: boolean;
}

export interface ORPWord {
  before: string;
  orp: string;
  after: string;
  fullWord: string;
}
