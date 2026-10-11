import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { t } from '@/i18n';
import { loadPdfJs } from '@/utils/pdfjs';

/** Maximale Pixelzahl einer Seiten-Canvas (begrenzt den Speicherbedarf bei hohem Zoom). */
const MAX_CANVAS_PIXELS = 16_777_216;

/** Der gerenderte Textlayer einer Seite (für Hervorhebung und Markieren). */
export interface PdfTextLayerInfo {
  /** Container des Textlayers. */
  layer: HTMLElement;
  /** Text jedes Items, in der Reihenfolge von `textDivs`. */
  itemTexts: string[];
  /** Ein Element je Text-Item (leere Items haben keinen Textknoten). */
  textDivs: HTMLElement[];
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Wird aufgerufen, sobald der Textlayer steht, und mit `null`, wenn die Seite entfernt wird. */
  onTextLayer: (pageNumber: number, info: PdfTextLayerInfo | null) => void;
}

function isCancellation(error: unknown): boolean {
  const name = typeof error === 'object' && error !== null ? (error as { name?: string }).name : undefined;
  return name === 'RenderingCancelledException' || name === 'AbortException';
}

/**
 * Eine Seite des PDFs: Canvas (Darstellung) und Textlayer (markierbarer, unsichtbarer Text).
 *
 * Canvas und Textlayer werden pro Renderdurchlauf neu angelegt. pdf.js verbietet zwei
 * gleichzeitige Renderings auf derselben Canvas; ein frisches Element macht das
 * Abbrechen und Neustarten (Zoom, Größenänderung) frei von Wettläufen. Beim Entfernen
 * der Seite wird die Canvas auf 0×0 gesetzt, damit der Grafikspeicher sofort frei wird.
 */
export const PdfPage = memo(function PdfPage({
  doc,
  pageNumber,
  scale,
  left,
  top,
  width,
  height,
  onTextLayer,
}: PdfPageProps) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const textHost = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<{ scale: number; message: string } | null>(null);

  useEffect(() => {
    const canvasParent = canvasHost.current;
    const textParent = textHost.current;
    if (!canvasParent || !textParent) return;

    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<unknown> } | null = null;
    let textLayer: { cancel(): void } | null = null;
    let pageProxy: { cleanup(): unknown } | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let removeSelectionListeners: (() => void) | null = null;

    const run = async () => {
      try {
        const [pdfjs, page] = await Promise.all([loadPdfJs(), doc.getPage(pageNumber)]);
        pageProxy = page;
        if (cancelled) return;

        const viewport = page.getViewport({ scale });

        // --- Darstellung ----------------------------------------------------------
        const pixelRatio = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height)));
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvasParent.replaceChildren(canvas);
        renderTask = page.render({
          canvas,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        const painted = renderTask.promise;
        // Wird die Seite vor dem Ende abgebrochen (Zoom, Größenänderung), lehnt pdf.js dieses Promise ab,
        // bevor unten darauf gewartet wird. Ohne Handler gäbe das einen „unhandled rejection“.
        painted.catch(() => undefined);

        // --- Textlayer (unabhängig von der Darstellung, damit Markieren sofort geht) ---
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const layer = document.createElement('div');
        layer.className = 'textLayer';
        textParent.replaceChildren(layer);
        const layerRenderer = new pdfjs.TextLayer({ textContentSource: textContent, container: layer, viewport });
        textLayer = layerRenderer;
        await layerRenderer.render();
        if (cancelled) return;

        // Wie in pdf.js: Der „endOfContent“-Block verhindert, dass die Auswahl beim Ziehen
        // über Leerraum zwischen den Textstücken springt.
        const endOfContent = document.createElement('div');
        endOfContent.className = 'endOfContent';
        layer.append(endOfContent);
        const onMouseDown = () => layer.classList.add('selecting');
        const onMouseUp = () => layer.classList.remove('selecting');
        layer.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        removeSelectionListeners = () => {
          layer.removeEventListener('mousedown', onMouseDown);
          document.removeEventListener('mouseup', onMouseUp);
        };

        onTextLayer(pageNumber, {
          layer,
          itemTexts: [...layerRenderer.textContentItemsStr],
          textDivs: [...layerRenderer.textDivs],
        });

        await painted;
      } catch (error) {
        if (cancelled || isCancellation(error)) return;
        console.warn(`[pdf] Seite ${pageNumber} konnte nicht dargestellt werden:`, error);
        setFailure({ scale, message: error instanceof Error ? error.message : t('pdfviewer.unknownError') });
      }
    };
    void run();

    return () => {
      cancelled = true;
      removeSelectionListeners?.();
      try {
        renderTask?.cancel();
      } catch {
        /* bereits beendet */
      }
      try {
        textLayer?.cancel();
      } catch {
        /* bereits beendet */
      }
      if (canvas) {
        canvas.width = 0; // Grafikspeicher sofort freigeben
        canvas.height = 0;
      }
      canvasParent.replaceChildren();
      textParent.replaceChildren();
      onTextLayer(pageNumber, null);
      try {
        pageProxy?.cleanup();
      } catch {
        /* Dokument wurde bereits beendet */
      }
    };
  }, [doc, pageNumber, scale, onTextLayer]);

  return (
    <div
      className="pdf-page"
      data-page={pageNumber}
      style={
        {
          left,
          top,
          width,
          height,
          '--total-scale-factor': scale,
        } as CSSProperties
      }
    >
      <div ref={canvasHost} className="absolute inset-0 overflow-hidden" />
      <div ref={textHost} className="absolute inset-0" />
      {failure && failure.scale === scale && (
        <p
          role="alert"
          className="absolute inset-x-4 top-4 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow"
        >
          {t('pdfviewer.pageFailed', { page: pageNumber, message: failure.message })}
        </p>
      )}
    </div>
  );
});
