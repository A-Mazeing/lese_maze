import { useCallback, useEffect, useRef, useState } from 'react';
import { useReaderDispatch } from '@/contexts/ReaderContext';
import { t } from '@/i18n';
import {
  PAGE_CONTENT_KEY_PREFIX,
  PAGE_CONTENT_MAX_AGE_MS,
  type StoredPageContent,
} from '@/types/messages';
import { cleanText, tokenizeTextWithStructure } from '@/utils/textProcessor';
import { fingerprintWords, generateDocumentId } from '@/utils/storage';
import type { ParseResult } from './usePDFParser';

export interface PageContentState {
  isLoading: boolean;
  error: string | null;
  title: string | null;
  url: string | null;
  /** Der Benutzer hatte Text markiert; nur dieser wird gelesen. */
  fromSelection: boolean;
  /** Der Seitentext wurde wegen des Größenlimits gekürzt. */
  truncated: boolean;
}

const initialState: PageContentState = {
  isLoading: false,
  error: null,
  title: null,
  url: null,
  fromSelection: false,
  truncated: false,
};

function isStoredPageContent(value: unknown): value is StoredPageContent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.text === 'string' &&
    typeof v.title === 'string' &&
    typeof v.url === 'string' &&
    typeof v.timestamp === 'number'
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Lädt den vom Service Worker zwischengespeicherten Seiteninhalt.
 *
 * Die Reader-URL trägt nur einen Schlüssel (`?mode=page&key=…`); der Text selbst liegt in
 * chrome.storage.session. Er bleibt dort bis zum Ablauf (5 Minuten) bzw. bis der Service
 * Worker aufräumt – so überlebt ein Neuladen des Reader-Tabs.
 */
export function usePageContent() {
  const dispatch = useReaderDispatch();
  const [state, setState] = useState<PageContentState>(initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPageContent = useCallback(
    async (key: string | null): Promise<ParseResult> => {
      const fail = (error: string): ParseResult => {
        if (mountedRef.current) setState((prev) => ({ ...prev, isLoading: false, error }));
        return { success: false, error };
      };

      setState({ ...initialState, isLoading: true });

      if (!key) {
        return fail(t('error.noPageKey'));
      }
      if (typeof chrome === 'undefined' || !chrome.storage?.session) {
        return fail(t('error.pageOnlyInExtension'));
      }

      try {
        const storageKey = `${PAGE_CONTENT_KEY_PREFIX}${key}`;
        const stored = (await chrome.storage.session.get(storageKey))[storageKey] as unknown;

        if (!isStoredPageContent(stored)) {
          return fail(t('error.pageNotFound'));
        }
        if (Date.now() - stored.timestamp > PAGE_CONTENT_MAX_AGE_MS) {
          return fail(t('error.pageExpired'));
        }

        const { words, sentenceBreaks, paragraphBreaks } = tokenizeTextWithStructure(cleanText(stored.text));
        if (words.length === 0) return fail(t('error.pageNoWords'));

        const host = hostnameOf(stored.url);
        const title = stored.title.trim() || host || 'Webseite';
        dispatch({
          type: 'SET_CONTENT',
          payload: {
            words,
            originalContent: words.join(' '),
            title,
            sourceType: 'page',
            sentenceBreaks,
            paragraphBreaks,
            documentId: generateDocumentId(title, 'page', `${stored.url}|${fingerprintWords(words)}`),
          },
        });

        if (mountedRef.current) {
          setState({
            isLoading: false,
            error: null,
            title,
            url: stored.url,
            fromSelection: Boolean(stored.fromSelection),
            truncated: Boolean(stored.truncated),
          });
        }
        return { success: true, wordCount: words.length };
      } catch (error) {
        console.error('[page] Seiteninhalt konnte nicht geladen werden:', error);
        return fail(error instanceof Error ? error.message : t('error.pageLoadFailed'));
      }
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    setState(initialState);
    dispatch({ type: 'CLEAR_CONTENT' });
  }, [dispatch]);

  return { ...state, loadPageContent, reset };
}
