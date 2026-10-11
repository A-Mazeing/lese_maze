import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildReaderUrl,
  checkPageUrl,
  handleOpenReader,
  handleReadCurrentPage,
  purgeStalePageContent,
} from '@/background/handlers';
import { sendRequest } from '@/utils/messaging';
import { PAGE_CONTENT_KEY_PREFIX, PAGE_CONTENT_MAX_AGE_MS, type StoredPageContent } from '@/types/messages';

const mocked = <T>(fn: unknown) => fn as ReturnType<typeof vi.fn> & T;

describe('checkPageUrl', () => {
  it.each([
    ['https://example.com/artikel', null],
    ['http://example.com', null],
    ['file:///home/user/doc.html', null],
  ])('allows %s', (url, expected) => {
    expect(checkPageUrl(url)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    'not a url',
    'chrome://extensions',
    'chrome-extension://abc/page.html',
    'about:blank',
    'view-source:https://example.com',
    'https://chromewebstore.google.com/detail/x',
    'ftp://example.com/x',
    'https://example.com/paper.PDF',
  ])('rejects %s with a readable message', (url) => {
    const message = checkPageUrl(url);
    expect(typeof message).toBe('string');
    expect(message!.length).toBeGreaterThan(10);
  });
});

describe('buildReaderUrl', () => {
  it('builds an extension URL with the mode and optional parameters', () => {
    const url = new URL(buildReaderUrl('page', { key: 'abc', resume: undefined }));
    expect(url.protocol).toBe('chrome-extension:');
    expect(url.pathname).toBe('/src/reader/index.html');
    expect(url.searchParams.get('mode')).toBe('page');
    expect(url.searchParams.get('key')).toBe('abc');
    expect(url.searchParams.has('resume')).toBe(false);
  });
});

describe('handleOpenReader', () => {
  it('opens the reader in a new tab', async () => {
    const response = await handleOpenReader({ type: 'OPEN_READER', mode: 'epub', resumeId: 'doc-1' });
    expect(response).toEqual({ ok: true, data: undefined });
    const { url } = mocked(chrome.tabs.create).mock.calls[0][0] as { url: string };
    expect(new URL(url).searchParams.get('mode')).toBe('epub');
    expect(new URL(url).searchParams.get('resume')).toBe('doc-1');
  });
});

describe('handleReadCurrentPage', () => {
  const tab = { id: 7, url: 'https://example.com/a' };
  const page = { text: 'Hallo Welt', title: 'T', url: tab.url, fromSelection: false, truncated: false };

  beforeEach(() => {
    mocked(chrome.tabs.query).mockResolvedValue([tab]);
  });

  it('fails without an active tab', async () => {
    mocked(chrome.tabs.query).mockResolvedValue([]);
    const response = await handleReadCurrentPage();
    expect(response.ok).toBe(false);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('refuses protected pages before injecting anything', async () => {
    mocked(chrome.tabs.query).mockResolvedValue([{ id: 1, url: 'chrome://settings' }]);
    const response = await handleReadCurrentPage();
    expect(response.ok).toBe(false);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('stores the extracted page in session storage and opens the reader', async () => {
    mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: page }]);
    const response = await handleReadCurrentPage();
    expect(response.ok).toBe(true);
    if (!response.ok) return;

    const key = (response.data as { key: string }).key;
    const stored = await chrome.storage.session.get(`${PAGE_CONTENT_KEY_PREFIX}${key}`);
    expect(stored[`${PAGE_CONTENT_KEY_PREFIX}${key}`]).toMatchObject({ text: 'Hallo Welt', title: 'T' });

    const { url } = mocked(chrome.tabs.create).mock.calls[0][0] as { url: string };
    expect(new URL(url).searchParams.get('key')).toBe(key);
    expect(new URL(url).searchParams.get('mode')).toBe('page');
  });

  it('passes a size limit to the injected function', async () => {
    mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: page }]);
    await handleReadCurrentPage();
    const call = mocked(chrome.scripting.executeScript).mock.calls[0][0] as { args: Array<{ maxChars: number }>; target: { tabId: number } };
    expect(call.target.tabId).toBe(7);
    expect(call.args[0].maxChars).toBeGreaterThan(0);
  });

  it('turns an injection error into a readable failure', async () => {
    mocked(chrome.scripting.executeScript).mockRejectedValue(new Error('Cannot access contents of the page'));
    const response = await handleReadCurrentPage();
    expect(response.ok).toBe(false);
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('reports extraction errors and empty results', async () => {
    mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: { error: 'Kein Text' } }]);
    expect(await handleReadCurrentPage()).toEqual({ ok: false, error: 'Kein Text' });
    mocked(chrome.scripting.executeScript).mockResolvedValue([]);
    expect((await handleReadCurrentPage()).ok).toBe(false);
  });

  it('retries with truncated text when the session quota is exceeded', async () => {
    const big = { ...page, text: 'wort '.repeat(500_000) };
    mocked(chrome.scripting.executeScript).mockResolvedValue([{ result: big }]);
    mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    const response = await handleReadCurrentPage();
    expect(response.ok).toBe(true);
    const all = await chrome.storage.session.get(null);
    const entry = Object.values(all)[0] as StoredPageContent;
    expect(entry.truncated).toBe(true);
    expect(entry.text.length).toBeLessThan(big.text.length);
  });
});

describe('purgeStalePageContent', () => {
  it('removes only expired page entries', async () => {
    const now = 10_000_000;
    await chrome.storage.session.set({
      [`${PAGE_CONTENT_KEY_PREFIX}old`]: { text: 'x', timestamp: now - PAGE_CONTENT_MAX_AGE_MS - 1 },
      [`${PAGE_CONTENT_KEY_PREFIX}fresh`]: { text: 'y', timestamp: now - 1000 },
      [`${PAGE_CONTENT_KEY_PREFIX}broken`]: { text: 'z' },
      unrelated: { timestamp: 1 },
    });
    await purgeStalePageContent(now);
    const left = Object.keys(await chrome.storage.session.get(null)).sort();
    expect(left).toEqual([`${PAGE_CONTENT_KEY_PREFIX}fresh`, 'unrelated']);
  });
});

describe('service worker message listener', () => {
  type Listener = (
    message: unknown,
    sender: Partial<chrome.runtime.MessageSender>,
    sendResponse: (response: unknown) => void,
  ) => boolean | undefined;

  async function loadListener(): Promise<Listener> {
    vi.resetModules();
    await import('@/background/service-worker');
    return mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as Listener;
  }

  const trusted = { id: 'test-extension-id', url: 'chrome-extension://test-extension-id/src/popup/index.html' };

  it('registers all listeners synchronously on load', async () => {
    await loadListener();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('answers asynchronously and keeps the channel open', async () => {
    const listener = await loadListener();
    const sendResponse = vi.fn();
    const keepOpen = listener({ type: 'OPEN_READER', mode: 'pdf' }, trusted, sendResponse);
    expect(keepOpen).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: undefined }));
  });

  it('rejects messages from other extensions and from web pages', async () => {
    const listener = await loadListener();
    const senders: Array<Partial<chrome.runtime.MessageSender>> = [
      { id: 'other-extension', url: 'chrome-extension://other-extension/x.html' },
      { id: 'test-extension-id', url: 'https://evil.example/', tab: { id: 1 } as chrome.tabs.Tab },
      {},
    ];
    for (const sender of senders) {
      const sendResponse = vi.fn();
      expect(listener({ type: 'READ_CURRENT_PAGE' }, sender, sendResponse)).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    }
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('rejects malformed messages', async () => {
    const listener = await loadListener();
    for (const message of [null, 'x', {}, { type: 'OPEN_READER' }, { type: 'OPEN_READER', mode: 'doc' }, { type: 'NOPE' }]) {
      const sendResponse = vi.fn();
      expect(listener(message, trusted, sendResponse)).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    }
  });

  it('always responds, even when a handler throws', async () => {
    mocked(chrome.tabs.create).mockRejectedValueOnce(new Error('tab kaputt'));
    const listener = await loadListener();
    const sendResponse = vi.fn();
    listener({ type: 'OPEN_READER', mode: 'pdf' }, trusted, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'tab kaputt' }));
  });
});

describe('sendRequest', () => {
  it('returns the worker response', async () => {
    mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true, data: { key: 'k' } });
    expect(await sendRequest({ type: 'READ_CURRENT_PAGE' })).toEqual({ ok: true, data: { key: 'k' } });
  });

  it('converts rejections ("Receiving end does not exist") into failures', async () => {
    mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist.'));
    const response = await sendRequest({ type: 'READ_CURRENT_PAGE' });
    expect(response.ok).toBe(false);
  });

  it('converts missing or malformed responses into failures', async () => {
    mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    expect((await sendRequest({ type: 'READ_CURRENT_PAGE' })).ok).toBe(false);
    mocked(chrome.runtime.sendMessage).mockResolvedValue('seltsam');
    expect((await sendRequest({ type: 'READ_CURRENT_PAGE' })).ok).toBe(false);
  });

  it('times out when the worker never answers', async () => {
    vi.useFakeTimers();
    mocked(chrome.runtime.sendMessage).mockReturnValue(new Promise(() => {}));
    const pending = sendRequest({ type: 'READ_CURRENT_PAGE' });
    await vi.advanceTimersByTimeAsync(20_001);
    const response = await pending;
    expect(response.ok).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
