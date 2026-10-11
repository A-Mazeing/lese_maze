import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

/** In-Memory-Implementierung von chrome.storage.* für Tests. */
function createStorageArea() {
  let data: Record<string, unknown> = {};
  return {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of list) if (key in data) result[key] = structuredClone(data[key]);
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data[key] = structuredClone(value);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }),
    clear: vi.fn(async () => {
      data = {};
    }),
  };
}

function installChromeMock() {
  const mockChrome = {
    storage: {
      local: createStorageArea(),
      session: createStorageArea(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    runtime: {
      id: 'test-extension-id',
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path.replace(/^\//, '')}`),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
    },
  };
  // @ts-expect-error - minimaler Mock der Chrome-API
  globalThis.chrome = mockChrome;
}

beforeEach(() => {
  installChromeMock();
  try {
    localStorage.clear();
  } catch {
    /* localStorage nicht verfügbar */
  }
});

afterEach(() => {
  vi.useRealTimers();
});

// jsdom kennt matchMedia nicht (ThemeContext).
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

installChromeMock();
