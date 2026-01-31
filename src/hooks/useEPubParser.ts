import { useState, useCallback } from 'react';
import { useReader } from '@/contexts/ReaderContext';
import { tokenizeTextWithStructure, cleanText } from '@/utils/textProcessor';
import ePub, { Book } from 'epubjs';
import type { Chapter } from '@/types';

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
 * Hook für ePub-Parsing mit epub.js.
 * Extrahiert Text und Kapitel-Struktur für die Preview.
 */
export function useEPubParser() {
  const { dispatch } = useReader();
  const [state, setState] = useState<EPubParserState>({
    isLoading: false,
    error: null,
    fileName: null,
    title: null,
    author: null,
    chapters: [],
    currentChapter: 0,
  });
  const [book, setBook] = useState<Book | null>(null);

  const loadEPub = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null, fileName: file.name }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const epubBook = ePub(arrayBuffer);
      setBook(epubBook);

      await epubBook.ready;

      // Metadaten extrahieren
      const metadata = epubBook.packaging.metadata;
      const navigation = await epubBook.loaded.navigation;

      const tocItems = navigation.toc.map(item => ({
        href: item.href,
        label: item.label,
      }));

      setState(prev => ({
        ...prev,
        title: metadata.title || file.name,
        author: metadata.creator || 'Unbekannt',
        chapters: tocItems,
      }));

      // Extrahiere Text von allen Kapiteln und tracke Kapitel-Grenzen
      const textParts: string[] = [];
      const chapterData: Chapter[] = [];
      const spine = epubBook.spine;
      let totalWordCount = 0;
      let chapterIndex = 0;

      // @ts-ignore - epub.js types sind unvollständig
      for (const section of spine.items) {
        try {
          const contents = await section.load(epubBook.load.bind(epubBook));
          if (contents && contents.documentElement) {
            const text = contents.documentElement.textContent || '';
            const cleanedText = cleanText(text);
            const { words: chapterWords } = tokenizeTextWithStructure(cleanedText);
            
            if (chapterWords.length > 0) {
              const chapterStartIndex = totalWordCount;
              totalWordCount += chapterWords.length;
              
              // Finde das passende TOC-Label für dieses Kapitel
              // @ts-ignore - epub.js types sind unvollständig
              const sectionHref = section.href || section.url || '';
              const tocMatch = tocItems.find(item => sectionHref.includes(item.href));
              const chapterTitle = tocMatch?.label || `Kapitel ${chapterIndex + 1}`;
              
              chapterData.push({
                id: `chapter-${chapterIndex}`,
                title: chapterTitle,
                startIndex: chapterStartIndex,
                endIndex: totalWordCount - 1,
              });
              
              textParts.push(cleanedText);
              chapterIndex++;
            }
          }
        } catch {
          // Einige Sections können nicht geladen werden
          continue;
        }
      }

      const fullText = textParts.join(' ');
      const { words, sentenceBreaks, paragraphBreaks } = tokenizeTextWithStructure(fullText);

      if (words.length === 0) {
        throw new Error('Keine lesbaren Wörter im ePub gefunden.');
      }

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
      
      setState(prev => ({ ...prev, isLoading: false }));

      return { success: true, wordCount: words.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Laden des ePubs';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return { success: false, error: errorMessage };
    }
  }, [dispatch]);

  const reset = useCallback(() => {
    if (book) {
      book.destroy();
    }
    setBook(null);
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
  }, [book, dispatch]);

  return {
    ...state,
    loadEPub,
    reset,
  };
}
