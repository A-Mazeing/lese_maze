import type { BookProgress, Settings } from '@/types';

const STORAGE_KEYS = {
  SETTINGS: 'rsvp_settings',
  PROGRESS: 'rsvp_progress',
  THEME: 'rsvp_theme',
} as const;

const DEFAULT_SETTINGS: Settings = {
  wpm: 300,
  theme: 'system',
  fontSize: 48,
  fontFamily: 'system-ui',
  wordsPerChunk: 1,
};

/**
 * Speichert Einstellungen im Chrome Storage.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  } else {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  }
}

/**
 * Lädt Einstellungen aus dem Chrome Storage.
 */
export async function getSettings(): Promise<Settings> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const storedSettings = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined;
    return { ...DEFAULT_SETTINGS, ...storedSettings };
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
    return DEFAULT_SETTINGS;
  }
}

/**
 * Speichert den Lesefortschritt eines Dokuments.
 */
export async function saveProgress(progress: BookProgress): Promise<void> {
  const allProgress = await getAllProgress();
  const index = allProgress.findIndex(p => p.id === progress.id);
  
  if (index >= 0) {
    allProgress[index] = progress;
  } else {
    allProgress.push(progress);
  }
  
  // Behalte nur die letzten 50 Einträge
  const trimmed = allProgress
    .sort((a, b) => b.lastRead - a.lastRead)
    .slice(0, 50);
  
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ [STORAGE_KEYS.PROGRESS]: trimmed });
  } else {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(trimmed));
  }
}

/**
 * Lädt alle gespeicherten Fortschritte.
 */
export async function getAllProgress(): Promise<BookProgress[]> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PROGRESS);
    const storedProgress = result[STORAGE_KEYS.PROGRESS] as BookProgress[] | undefined;
    return storedProgress || [];
  } else {
    const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    return stored ? JSON.parse(stored) : [];
  }
}

/**
 * Lädt den Fortschritt für ein bestimmtes Dokument.
 */
export async function getProgress(id: string): Promise<BookProgress | null> {
  const allProgress = await getAllProgress();
  return allProgress.find(p => p.id === id) || null;
}

/**
 * Löscht den Fortschritt eines Dokuments.
 */
export async function deleteProgress(id: string): Promise<void> {
  const allProgress = await getAllProgress();
  const filtered = allProgress.filter(p => p.id !== id);
  
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ [STORAGE_KEYS.PROGRESS]: filtered });
  } else {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(filtered));
  }
}

/**
 * Generiert eine eindeutige ID für ein Dokument.
 */
export function generateDocumentId(title: string, type: string): string {
  const base = `${type}-${title}`.toLowerCase().replace(/\s+/g, '-');
  const hash = Array.from(base).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `${base}-${hash}`;
}
