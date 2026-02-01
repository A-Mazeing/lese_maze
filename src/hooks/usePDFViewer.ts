import { useState, useCallback, useRef, useEffect } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import type { PDFPageProxy } from 'pdfjs-dist';
import { TextLayer } from 'pdfjs-dist';

export interface PDFViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
  isLoading: boolean;
  error: string | null;
}

export interface PageRenderResult {
  width: number;
  height: number;
}

/**
 * Prüft robust, ob eine aktive Text-Selektion im gegebenen Container existiert.
 * Berücksichtigt sowohl anchorNode als auch focusNode der Selektion.
 */
function hasActiveSelectionInContainer(container: HTMLElement | null): boolean {
  if (!container) return false;
  
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  
  const selectedText = selection.toString().trim();
  if (!selectedText) return false;
  
  // Prüfe ob anchorNode ODER focusNode im Container sind
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  
  const anchorInContainer = anchorNode ? container.contains(anchorNode) : false;
  const focusInContainer = focusNode ? container.contains(focusNode) : false;
  
  return anchorInContainer || focusInContainer;
}

/**
 * Hook für PDF-Viewer Funktionalität.
 * Verwaltet Rendering, Navigation und Zoom.
 */
export function usePDFViewer() {
  const { state, pdfDocumentRef } = useReader();
  const { metadata } = state;
  
  const [viewerState, setViewerState] = useState<PDFViewerState>({
    currentPage: 1,
    totalPages: metadata.totalPages || 0,
    scale: 1.0,
    isLoading: false,
    error: null,
  });

  const currentRenderTask = useRef<{ cancel: () => void } | null>(null);
  const currentTextLayerTask = useRef<{ cancel: () => void; render: () => Promise<void> } | null>(null);
  const lastRenderedPage = useRef<number>(0);
  const lastRenderedScale = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  
  // Ref für Text-Layer Rendering-Status
  const isRenderingTextLayer = useRef<boolean>(false);

  // Aktualisiere totalPages wenn sich metadata ändert
  useEffect(() => {
    if (metadata.totalPages) {
      setViewerState(prev => ({ ...prev, totalPages: metadata.totalPages || 0 }));
    }
  }, [metadata.totalPages]);

  // Finde aktuelle Seite basierend auf Wort-Index
  const getPageForWordIndex = useCallback((wordIndex: number): number => {
    const pageBreaks = metadata.pageBreaks || [0];
    for (let i = pageBreaks.length - 1; i >= 0; i--) {
      if (wordIndex >= pageBreaks[i]) {
        return i + 1;
      }
    }
    return 1;
  }, [metadata.pageBreaks]);

  // Finde Wort-Index-Bereich für eine Seite
  const getWordRangeForPage = useCallback((pageNum: number): { start: number; end: number } => {
    const pageBreaks = metadata.pageBreaks || [0];
    const totalWords = state.words.length;
    
    const startIndex = pageBreaks[pageNum - 1] || 0;
    const endIndex = pageBreaks[pageNum] !== undefined ? pageBreaks[pageNum] - 1 : totalWords - 1;
    
    return { start: startIndex, end: endIndex };
  }, [metadata.pageBreaks, state.words.length]);

  // Rendere eine PDF-Seite auf Canvas
  const renderPage = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement,
    textLayerDiv?: HTMLDivElement | null
  ): Promise<PageRenderResult | null> => {
    const pdfDoc = pdfDocumentRef.current;
    if (!pdfDoc) {
      setViewerState(prev => ({ ...prev, error: 'Kein PDF-Dokument geladen' }));
      return null;
    }

    // Prüfe ob wir diese Seite bereits mit diesem Scale gerendert haben
    const needsRerender = pageNum !== lastRenderedPage.current || 
                          viewerState.scale !== lastRenderedScale.current;
    
    if (!needsRerender && canvas.width > 0) {
      // Seite ist bereits korrekt gerendert
      return null;
    }

    // Abbrechen des vorherigen Render-Tasks
    if (currentRenderTask.current) {
      currentRenderTask.current.cancel();
      currentRenderTask.current = null;
    }

    // Text-Layer-Task wird später bei Bedarf abgebrochen (nicht hier, um Selektion zu erhalten)

    setViewerState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: viewerState.scale });

      // Canvas-Größe setzen
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas context nicht verfügbar');
      }

      // Für High-DPI Displays
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * pixelRatio;
      canvas.height = viewport.height * pixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.scale(pixelRatio, pixelRatio);

      // Render-Task starten
      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      });

      currentRenderTask.current = renderTask;

      await renderTask.promise;

      // Speichere gerenderte Seite/Scale
      lastRenderedPage.current = pageNum;
      lastRenderedScale.current = viewerState.scale;

      // Text-Layer rendern (für Selektion)
      if (textLayerDiv) {
        // Prüfe ob eine aktive Selektion im Text-Layer existiert
        const hasActiveSelection = hasActiveSelectionInContainer(textLayerDiv);
        
        // Verhindere Re-Rendering während aktiver Selektion
        if (hasActiveSelection) {
          // Nur Dimensionen aktualisieren, nicht Inhalt
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;
        } else if (!isRenderingTextLayer.current) {
          // Kein aktive Selektion - sicheres Re-Rendering
          isRenderingTextLayer.current = true;
          
          // Abbrechen des vorherigen Text-Layer-Tasks falls noch aktiv
          const prevTask = currentTextLayerTask.current;
          if (prevTask) {
            prevTask.cancel();
            currentTextLayerTask.current = null;
          }
          
          try {
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;

            const textContent = await page.getTextContent();
            
            // Finale Prüfung vor dem Leeren - Selektion könnte während getTextContent gestartet worden sein
            if (!hasActiveSelectionInContainer(textLayerDiv)) {
              textLayerDiv.innerHTML = '';
              
              const textLayer = new TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
              });

              currentTextLayerTask.current = textLayer;
              await textLayer.render();
            }
          } finally {
            isRenderingTextLayer.current = false;
          }
        }
      }

      setViewerState(prev => ({ 
        ...prev, 
        isLoading: false, 
        currentPage: pageNum 
      }));

      return { width: viewport.width, height: viewport.height };
    } catch (error) {
      // Ignoriere Abbruch-Fehler
      if ((error as Error).name === 'RenderingCancelledException') {
        return null;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Rendern der Seite';
      setViewerState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return null;
    }
  }, [pdfDocumentRef, viewerState.scale]);

  // Navigation
  const goToPage = useCallback((pageNum: number) => {
    const totalPages = metadata.totalPages || 1;
    const validPage = Math.max(1, Math.min(pageNum, totalPages));
    setViewerState(prev => ({ ...prev, currentPage: validPage }));
  }, [metadata.totalPages]);

  const nextPage = useCallback(() => {
    goToPage(viewerState.currentPage + 1);
  }, [viewerState.currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(viewerState.currentPage - 1);
  }, [viewerState.currentPage, goToPage]);

  // Zoom-Kontrolle
  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale));
    setViewerState(prev => ({ ...prev, scale: clampedScale }));
  }, []);

  const zoomIn = useCallback(() => {
    setScale(viewerState.scale + 0.25);
  }, [viewerState.scale, setScale]);

  const zoomOut = useCallback(() => {
    setScale(viewerState.scale - 0.25);
  }, [viewerState.scale, setScale]);

  const fitToWidth = useCallback((containerWidth: number) => {
    const pdfDoc = pdfDocumentRef.current;
    if (!pdfDoc) return;

    pdfDoc.getPage(viewerState.currentPage).then((page: PDFPageProxy) => {
      const viewport = page.getViewport({ scale: 1 });
      const newScale = (containerWidth - 40) / viewport.width; // 40px für Padding
      setScale(newScale);
    });
  }, [pdfDocumentRef, viewerState.currentPage, setScale]);

  // Synchronisiere mit aktuellem Leseindex
  const syncToCurrentWord = useCallback(() => {
    const currentWordPage = getPageForWordIndex(state.currentIndex);
    if (currentWordPage !== viewerState.currentPage) {
      goToPage(currentWordPage);
    }
  }, [state.currentIndex, viewerState.currentPage, getPageForWordIndex, goToPage]);

  // Prüfe ob PDF verfügbar ist
  const hasPDF = pdfDocumentRef.current !== null;

  return {
    // State
    ...viewerState,
    hasPDF,
    
    // Refs für Komponenten
    canvasRef,
    textLayerRef,
    
    // Rendering
    renderPage,
    
    // Navigation
    goToPage,
    nextPage,
    prevPage,
    
    // Zoom
    setScale,
    zoomIn,
    zoomOut,
    fitToWidth,
    
    // Synchronisation
    syncToCurrentWord,
    getPageForWordIndex,
    getWordRangeForPage,
  };
}
