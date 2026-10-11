import type * as PdfJsNamespace from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Geöffnetes PDF samt Seitengrößen (in PDF-Punkten bei Zoom 1, Drehung berücksichtigt). */
export interface PdfDocumentHandle {
  document: PDFDocumentProxy;
  pageSizes: ReadonlyArray<{ width: number; height: number }>;
}
// Legacy-Build: enthält die Polyfills für neuere JavaScript-Funktionen (z. B. Map.getOrInsertComputed),
// die in älteren Chrome-Versionen fehlen (die Extension unterstützt Chrome ab 110).
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

type PdfJsModule = typeof PdfJsNamespace;

let modulePromise: Promise<PdfJsModule> | null = null;

/**
 * Lädt pdf.js beim ersten Bedarf (Code-Splitting: Popup und Seiten-Modus laden die
 * Bibliothek nie) und konfiguriert den Worker genau einmal.
 *
 * Der Worker wird über die von Vite ausgelieferte Asset-URL gestartet. Sie liegt im
 * eigenen Extension-Ursprung und erfüllt damit `script-src 'self'` der CSP.
 */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (!modulePromise) {
    modulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        return pdfjs;
      })
      .catch((error) => {
        modulePromise = null; // nächster Versuch darf neu laden
        throw error;
      });
  }
  return modulePromise;
}

/** URL einer mitgelieferten Ressource aus `public/` (Extension-URL bzw. Dev-Server-Pfad). */
export function resolveAssetUrl(path: string): string {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function') {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

export class PdfLoadError extends Error {
  constructor(
    message: string,
    readonly code: 'password' | 'invalid' | 'missing' | 'aborted' | 'unknown',
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PdfLoadError';
  }
}

function toLoadError(error: unknown): PdfLoadError {
  if (error instanceof PdfLoadError) return error;
  const name = typeof error === 'object' && error !== null ? (error as { name?: string }).name : undefined;
  switch (name) {
    case 'PasswordException':
      return new PdfLoadError(
        'Das PDF ist passwortgeschützt. Passwortgeschützte Dokumente werden nicht unterstützt.',
        'password',
        { cause: error },
      );
    case 'InvalidPDFException':
      return new PdfLoadError('Die Datei ist kein gültiges oder ein beschädigtes PDF.', 'invalid', { cause: error });
    case 'MissingPDFException':
      return new PdfLoadError('Das PDF wurde nicht gefunden.', 'missing', { cause: error });
    case 'AbortException':
      return new PdfLoadError('Das Laden wurde abgebrochen.', 'aborted', { cause: error });
    default:
      return new PdfLoadError(
        error instanceof Error && error.message ? `PDF konnte nicht geladen werden: ${error.message}` : 'PDF konnte nicht geladen werden.',
        'unknown',
        { cause: error },
      );
  }
}

export interface OpenPdfOptions {
  signal?: AbortSignal;
}

/**
 * Öffnet ein PDF für Textextraktion UND Seitendarstellung. Ressourcen (CMaps,
 * Standardschriften, WASM-Decoder, ICC-Profile) kommen aus dem Extension-Paket – es
 * werden keine externen Adressen kontaktiert. pdf.js-Warnungen werden über die
 * Log-Stufe unterdrückt, ohne `console.warn` global zu überschreiben.
 *
 * Der Aufrufer ist für `doc.destroy()` verantwortlich: Erst das beendet den Worker.
 */
export async function openPdf(data: ArrayBuffer | Uint8Array, options: OpenPdfOptions = {}): Promise<PDFDocumentProxy> {
  const { signal } = options;
  if (signal?.aborted) throw new PdfLoadError('Das Laden wurde abgebrochen.', 'aborted');

  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    cMapUrl: resolveAssetUrl('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: resolveAssetUrl('pdfjs/standard_fonts/'),
    wasmUrl: resolveAssetUrl('pdfjs/wasm/'),
    iccUrl: resolveAssetUrl('pdfjs/iccs/'),
    enableXfa: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  const onAbort = () => {
    void task.destroy().catch(() => undefined);
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const doc = await task.promise;
    if (signal?.aborted) {
      await doc.destroy().catch(() => undefined);
      throw new PdfLoadError('Das Laden wurde abgebrochen.', 'aborted');
    }
    return doc;
  } catch (error) {
    throw signal?.aborted ? new PdfLoadError('Das Laden wurde abgebrochen.', 'aborted', { cause: error }) : toLoadError(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
