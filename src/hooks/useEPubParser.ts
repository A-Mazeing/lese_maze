import { useState, useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { tokenizeTextWithStructure, cleanText } from '@/utils/textProcessor';
import ePub from 'epubjs';
import type { Chapter, CFICheckpoint } from '@/types';

interface EPubParserState {
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
  title: string | null;
  author: string | null;
  chapters: { href: string; label: string }[];
  currentChapter: number;
}

/**
 * Extrahiert Text aus einem Element in korrekter Lesereihenfolge.
 * Berücksichtigt Block-Elemente und fügt Zeilenumbrüche ein.
 */
function extractTextInReadingOrder(element: Element): string {
  const blockElements = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'TR', 'BLOCKQUOTE', 'PRE', 'ARTICLE', 'SECTION',
    'HEADER', 'FOOTER', 'NAV', 'ASIDE', 'BR', 'HR'
  ]);
  
  const result: string[] = [];
  
  function traverse(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        result.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toUpperCase();
      
      // Überspringe versteckte Elemente
      const style = (el as HTMLElement).style;
      if (style?.display === 'none' || style?.visibility === 'hidden') {
        return;
      }
      
      // Füge Zeilenumbruch vor Block-Elementen ein
      if (blockElements.has(tagName) && result.length > 0) {
        result.push('\n');
      }
      
      // Rekursiv durch Kinder
      for (const child of Array.from(node.childNodes)) {
        traverse(child);
      }
      
      // Füge Zeilenumbruch nach Block-Elementen ein
      if (blockElements.has(tagName)) {
        result.push('\n');
      }
    }
  }
  
  traverse(element);
  
  // Normalisiere das Ergebnis
  return result.join('')
    .replace(/\n{3,}/g, '\n\n')  // Max 2 Zeilenumbrüche
    .replace(/[ \t]+/g, ' ')     // Normalisiere Leerzeichen
    .trim();
}

/**
 * Hook für ePub-Parsing mit epub.js.
 * Extrahiert Text und Kapitel-Struktur für die Preview.
 * Speichert Book-Referenz im ReaderContext für den EPubViewer.
 */
export function useEPubParser() {
  const { dispatch, epubBookRef, setCfiCheckpoints } = useReader();
  const [state, setState] = useState<EPubParserState>({
    isLoading: false,
    error: null,
    fileName: null,
    title: null,
    author: null,
    chapters: [],
    currentChapter: 0,
  });

  const loadEPub = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, fileName: file.name }));
    console.log('[useEPubParser] Starting to load ePub:', file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('[useEPubParser] ArrayBuffer loaded, size:', arrayBuffer.byteLength);
      
      const epubBook = ePub(arrayBuffer);
      
      // Speichere Book-Referenz im Context für EPubViewer
      epubBookRef.current = epubBook;

      await epubBook.ready;
      console.log('[useEPubParser] ePub book ready');

      // Metadaten extrahieren
      const metadata = epubBook.packaging.metadata;
      const navigation = await epubBook.loaded.navigation;
      console.log('[useEPubParser] Metadata:', metadata.title, 'by', metadata.creator);

      const tocItems = navigation.toc.map(item => ({
        href: item.href,
        label: item.label,
      }));
      console.log('[useEPubParser] TOC items:', tocItems.length);

      setState(prev => ({
        ...prev,
        title: metadata.title || file.name,
        author: metadata.creator || 'Unbekannt',
        chapters: tocItems,
      }));

      // Extrahiere Text von allen Kapiteln und tracke Kapitel-Grenzen
      const textParts: string[] = [];
      const chapterData: Chapter[] = [];
      const cfiCheckpointData: CFICheckpoint[] = [];
      const spine = epubBook.spine;
      let totalWordCount = 0;
      let chapterIndex = 0;

      // @ts-ignore - epub.js types sind unvollständig
      console.log('[useEPubParser] Spine items:', spine.items?.length || 'undefined');

      // @ts-ignore - epub.js types sind unvollständig
      for (const section of spine.items) {
        try {
          const sectionHref = section.href || section.url || 'unknown';
          console.log('[useEPubParser] Loading section:', sectionHref);
          
          // Methode 1: Versuche section.load() mit dem book request handler
          let doc: Document | null = null;
          
          // @ts-ignore - epub.js types sind unvollständig
          if (typeof section.load === 'function') {
            try {
              // epub.js erwartet den request handler vom book
              // @ts-ignore
              doc = await section.load(epubBook.load.bind(epubBook));
            } catch {
              console.log('[useEPubParser] section.load() failed, trying alternative method');
            }
          }
          
          // Methode 2: Falls section.load() nicht funktioniert, lade über book.load()
          if (!doc) {
            try {
              // Hole die URL für die Section
              // @ts-ignore
              const sectionUrl = section.url || section.href;
              if (sectionUrl) {
                // Lade den HTML-Inhalt über den Archive
                // @ts-ignore
                const content = await epubBook.archive.getText(sectionUrl);
                if (content) {
                  const parser = new DOMParser();
                  doc = parser.parseFromString(content, 'application/xhtml+xml');
                  
                  // Prüfe auf Parse-Fehler
                  const parseError = doc.querySelector('parsererror');
                  if (parseError) {
                    // Versuche als HTML zu parsen
                    doc = parser.parseFromString(content, 'text/html');
                  }
                }
              }
            } catch (archiveError) {
              console.log('[useEPubParser] archive.getText() failed:', archiveError);
            }
          }
          
          // Methode 3: Falls archive nicht funktioniert, versuche über resources
          if (!doc) {
            try {
              // @ts-ignore
              const sectionUrl = section.canonical || section.url || section.href;
              // @ts-ignore
              if (epubBook.resources && typeof epubBook.resources.get === 'function') {
                // @ts-ignore
                const resource = await epubBook.resources.get(sectionUrl);
                if (resource) {
                  const parser = new DOMParser();
                  doc = parser.parseFromString(resource, 'application/xhtml+xml');
                }
              }
            } catch (resourceError) {
              console.log('[useEPubParser] resources.get() failed:', resourceError);
            }
          }

          if (doc && doc.documentElement) {
            // Extrahiere nur den Body-Text, nicht Head/Metadaten
            const body = doc.body || doc.querySelector('body');
            if (!body) {
              console.log('[useEPubParser] Section has no body:', sectionHref);
              continue;
            }
            
            // Entferne Script/Style-Tags die Text enthalten könnten
            const clonedBody = body.cloneNode(true) as HTMLElement;
            clonedBody.querySelectorAll('script, style, noscript, meta, link').forEach(el => el.remove());
            
            // Extrahiere Text in DOM-Reihenfolge (entspricht Lesereihenfolge)
            const text = extractTextInReadingOrder(clonedBody);
            const cleanedText = cleanText(text);
            // Normalisiere auf einfache Leerzeichen für konsistente Tokenisierung
            const normalizedText = cleanedText.replace(/\s+/g, ' ').trim();
            const { words: chapterWords } = tokenizeTextWithStructure(normalizedText);
            console.log('[useEPubParser] Section loaded, words:', chapterWords.length);
            
            if (chapterWords.length > 0) {
              const chapterStartIndex = totalWordCount;
              totalWordCount += chapterWords.length;
              
              // Finde das passende TOC-Label für dieses Kapitel
              const tocMatch = tocItems.find(item => sectionHref.includes(item.href));
              const chapterTitle = tocMatch?.label || `Kapitel ${chapterIndex + 1}`;
              
              chapterData.push({
                id: `chapter-${chapterIndex}`,
                title: chapterTitle,
                startIndex: chapterStartIndex,
                endIndex: totalWordCount - 1,
              });
              
              // Erstelle CFI-Checkpoint für Kapitelanfang
              // @ts-ignore - epub.js types sind unvollständig
              const sectionCfi = section.cfiBase || section.href || `chapter-${chapterIndex}`;
              cfiCheckpointData.push({
                wordIndex: chapterStartIndex,
                cfi: sectionCfi,
                chapterIndex: chapterIndex,
              });
              
              // Speichere den normalisierten Text (ohne Zeilenumbrüche)
              textParts.push(normalizedText);
              chapterIndex++;
            }
          } else {
            console.log('[useEPubParser] Section has no content:', sectionHref);
          }
        } catch (sectionError) {
          // Einige Sections können nicht geladen werden
          console.warn('[useEPubParser] Failed to load section:', section.href, sectionError);
          continue;
        }
      }

      console.log('[useEPubParser] Total chapters processed:', chapterIndex, 'Total words:', totalWordCount);

      // Füge Kapitel mit einfachem Leerzeichen zusammen (wie bei PDF)
      // Dies stellt sicher, dass die Wortanzahl konsistent bleibt
      const fullText = textParts.join(' ');
      const { words, sentenceBreaks, paragraphBreaks } = tokenizeTextWithStructure(fullText);

      // Prüfe Konsistenz der Wortanzahl
      if (words.length !== totalWordCount) {
        console.warn('[useEPubParser] Word count mismatch! Chapter sum:', totalWordCount, 'Final:', words.length);
      }

      if (words.length === 0) {
        throw new Error('Keine lesbaren Wörter im ePub gefunden.');
      }

      console.log('[useEPubParser] Final word count:', words.length);

      // Speichere CFI-Checkpoints im Context
      setCfiCheckpoints(cfiCheckpointData);

      // Nutze SET_CONTENT für erweiterte Metadaten
      dispatch({ 
        type: 'SET_CONTENT', 
        payload: {
          words,
          originalContent: fullText,
          title: metadata.title || file.name.replace(/\.epub$/i, ''),
          sourceType: 'epub',
          chapters: chapterData,
          sentenceBreaks,
          paragraphBreaks,
        }
      });
      
      console.log('[useEPubParser] SET_CONTENT dispatched successfully');
      setState(prev => ({ ...prev, isLoading: false }));

      return { success: true, wordCount: words.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden des ePubs';
      console.error('[useEPubParser] Error:', errorMessage, error);
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [dispatch, epubBookRef, setCfiCheckpoints]);

  const reset = useCallback(() => {
    if (epubBookRef.current) {
      epubBookRef.current.destroy();
      epubBookRef.current = null;
    }
    setCfiCheckpoints([]);
    setState({
      isLoading: false,
      error: null,
      fileName: null,
      title: null,
      author: null,
      chapters: [],
      currentChapter: 0,
    });
    dispatch({ type: 'RESET' });
  }, [dispatch, epubBookRef, setCfiCheckpoints]);

  return {
    ...state,
    loadEPub,
    reset,
  };
}
