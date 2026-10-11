import {
  fail,
  ok,
  PAGE_CONTENT_KEY_PREFIX,
  PAGE_CONTENT_MAX_AGE_MS,
  PAGE_TEXT_MAX_CHARS,
  type ExtensionRequest,
  type ExtractedPage,
  type MessageResponse,
  type ReaderOpenMode,
  type StoredPageContent,
} from '@/types/messages';
import { loadLanguage, t } from '@/i18n';
import { extractPageInPage, type PageExtractionResult } from './pageExtractor';

/** Fehlercode, den `extractPageInPage` liefert, wenn kein Text gefunden wurde. */
const NO_TEXT_ERROR = 'NO_READABLE_TEXT';

/** Pfad des Readers innerhalb der Erweiterung (siehe vite.config.ts → rollupOptions.input). */
export const READER_PATH = 'src/reader/index.html';

/** Fallback-Größe, falls das Quota von chrome.storage.session überschritten wird. */
const QUOTA_FALLBACK_CHARS = 1_500_000;

/** Seitentypen, in die Chrome keine Skripte injizieren lässt. */
const BLOCKED_PROTOCOLS = ['chrome:', 'chrome-extension:', 'chrome-untrusted:', 'devtools:', 'edge:', 'about:', 'view-source:'];
const BLOCKED_HOSTS = ['chromewebstore.google.com', 'chrome.google.com'];

export function buildReaderUrl(
  mode: ReaderOpenMode | 'page',
  params: Record<string, string | undefined> = {},
): string {
  const search = new URLSearchParams({ mode });
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return chrome.runtime.getURL(`${READER_PATH}?${search.toString()}`);
}

/** Prüft, ob in die Seite Skripte injiziert werden dürfen; liefert sonst eine Fehlermeldung. */
export function checkPageUrl(url: string | undefined): string | null {
  if (!url) {
    return t('error.tabUnreadable');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return t('error.tabInvalid');
  }
  if (BLOCKED_PROTOCOLS.includes(parsed.protocol) || BLOCKED_HOSTS.includes(parsed.hostname)) {
    return t('error.browserPage');
  }
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
    return t('error.protocol', { protocol: parsed.protocol });
  }
  if (parsed.pathname.toLowerCase().endsWith('.pdf')) {
    return t('error.pdfTab');
  }
  return null;
}

function isPageResult(result: PageExtractionResult | undefined | null): result is ExtractedPage {
  return !!result && typeof result === 'object' && 'text' in result && typeof result.text === 'string';
}

/** Entfernt abgelaufene Seiteninhalte aus chrome.storage.session. */
export async function purgeStalePageContent(now = Date.now()): Promise<void> {
  try {
    const all = await chrome.storage.session.get(null);
    const stale = Object.entries(all)
      .filter(([key, value]) => {
        if (!key.startsWith(PAGE_CONTENT_KEY_PREFIX)) return false;
        const timestamp = (value as Partial<StoredPageContent> | undefined)?.timestamp;
        return typeof timestamp !== 'number' || now - timestamp > PAGE_CONTENT_MAX_AGE_MS;
      })
      .map(([key]) => key);
    if (stale.length > 0) await chrome.storage.session.remove(stale);
  } catch (error) {
    console.warn('[sw] Aufräumen des Session-Speichers fehlgeschlagen:', error);
  }
}

async function storePageContent(page: ExtractedPage): Promise<string> {
  const key = crypto.randomUUID();
  const write = (content: ExtractedPage) =>
    chrome.storage.session.set({
      [`${PAGE_CONTENT_KEY_PREFIX}${key}`]: { ...content, timestamp: Date.now() } satisfies StoredPageContent,
    });

  try {
    await write(page);
  } catch (error) {
    // Das Quota von chrome.storage.session (10 MB) ist überschritten → gekürzt erneut versuchen.
    if (page.text.length <= QUOTA_FALLBACK_CHARS) throw error;
    await write({ ...page, text: page.text.slice(0, QUOTA_FALLBACK_CHARS), truncated: true });
  }
  return key;
}

async function findTargetTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

export async function handleReadCurrentPage(): Promise<MessageResponse<{ key: string }>> {
  await loadLanguage(); // Fehlermeldungen in der gewählten Sprache
  const tab = await findTargetTab();
  if (!tab?.id) return fail(t('error.noTab'));

  const urlProblem = checkPageUrl(tab.url);
  if (urlProblem) return fail(urlProblem);

  let results: Array<{ result?: PageExtractionResult }>;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageInPage,
      args: [{ maxChars: PAGE_TEXT_MAX_CHARS }],
    });
  } catch (error) {
    // Typisch: fehlende activeTab-Berechtigung, Seite geschützt oder Tab wurde geschlossen.
    console.warn('[sw] executeScript fehlgeschlagen:', error);
    return fail(t('error.noAccess'));
  }

  const result = results[0]?.result;
  if (!result) return fail(t('error.pageEmpty'));
  if (!isPageResult(result)) {
    return fail('error' in result && result.error !== NO_TEXT_ERROR ? result.error : t('error.pageNoText'));
  }

  await purgeStalePageContent();
  let key: string;
  try {
    key = await storePageContent(result);
  } catch (error) {
    console.error('[sw] Seiteninhalt konnte nicht zwischengespeichert werden:', error);
    return fail(t('error.pageTooLarge'));
  }

  await chrome.tabs.create({ url: buildReaderUrl('page', { key }) });
  return ok({ key });
}

export async function handleOpenReader(
  request: Extract<ExtensionRequest, { type: 'OPEN_READER' }>,
): Promise<MessageResponse> {
  await chrome.tabs.create({ url: buildReaderUrl(request.mode, { resume: request.resumeId }) });
  return ok();
}

export async function dispatchRequest(request: ExtensionRequest): Promise<MessageResponse<unknown>> {
  switch (request.type) {
    case 'OPEN_READER':
      return handleOpenReader(request);
    case 'READ_CURRENT_PAGE':
      return handleReadCurrentPage();
  }
}
