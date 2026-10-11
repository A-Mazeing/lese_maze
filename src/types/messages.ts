/**
 * Typisiertes Nachrichtenprotokoll zwischen Extension-Seiten (Popup/Reader)
 * und dem Service Worker.
 *
 * Alle Nachrichten sind eine diskriminierte Union über `type`; jede Antwort ist
 * ein `MessageResponse`, damit Aufrufer Fehler nie über ungefangene Promise
 * Rejections ("message port closed") behandeln müssen.
 */

export type ReaderOpenMode = 'pdf' | 'epub';

export type ExtensionRequest =
  | { type: 'OPEN_READER'; mode: ReaderOpenMode; resumeId?: string }
  | { type: 'READ_CURRENT_PAGE' };

export type ExtensionRequestType = ExtensionRequest['type'];

export type MessageResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Inhalt einer Webseite, wie ihn die Seiten-Extraktion liefert. */
export interface ExtractedPage {
  text: string;
  title: string;
  url: string;
  /** true, wenn der Benutzer Text markiert hatte und nur dieser gelesen wird. */
  fromSelection: boolean;
  /** true, wenn der Text wegen des Größenlimits gekürzt wurde. */
  truncated: boolean;
}

/** Eintrag in chrome.storage.session, auf den die Reader-URL per Schlüssel verweist. */
export interface StoredPageContent extends ExtractedPage {
  timestamp: number;
}

export const PAGE_CONTENT_KEY_PREFIX = 'pageContent:';
/** Maximale Lebensdauer eines zwischengespeicherten Seiteninhalts. */
export const PAGE_CONTENT_MAX_AGE_MS = 5 * 60 * 1000;
/** Obergrenze für extrahierten Seitentext (chrome.storage.session hat 10 MB Quota). */
export const PAGE_TEXT_MAX_CHARS = 4_000_000;

export function ok<T>(data: T): MessageResponse<T>;
export function ok(): MessageResponse<undefined>;
export function ok<T>(data?: T): MessageResponse<T | undefined> {
  return { ok: true, data };
}

export function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}
