export type ReaderMode = 'select' | 'pdf' | 'epub' | 'page';

export interface ReaderParams {
  mode: ReaderMode;
  /** Schlüssel des zwischengespeicherten Seiteninhalts (nur mode=page). */
  key: string | null;
  /** ID eines zuletzt gelesenen Dokuments, das fortgesetzt werden soll. */
  resumeId: string | null;
}

const MODES: readonly ReaderMode[] = ['pdf', 'epub', 'page'];

/** Liest die Reader-Parameter aus der URL; unbekannte Werte fallen auf die Quellenauswahl zurück. */
export function parseReaderParams(search: string): ReaderParams {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return {
    mode: MODES.includes(mode as ReaderMode) ? (mode as ReaderMode) : 'select',
    key: params.get('key'),
    resumeId: params.get('resume'),
  };
}
