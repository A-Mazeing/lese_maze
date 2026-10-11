import type { BookProgress, Settings, SourceType } from '@/types';

const STORAGE_KEYS = {
  SETTINGS: 'rsvp_settings',
  PROGRESS: 'rsvp_progress',
} as const;

const MAX_PROGRESS_ENTRIES = 50;

export const DEFAULT_SETTINGS: Settings = {
  wpm: 300,
  theme: 'system',
  fontSize: 48,
  fontFamily: 'system-ui',
  wordsPerChunk: 1,
  rampUpEnabled: true,
  rampUpDuration: 5,
  rewindOnPause: true,
};

export const WPM_MIN = 50;
export const WPM_MAX = 1500;

// ---------------------------------------------------------------------------
// Backend: chrome.storage.local (Extension) mit localStorage-Fallback (Entwicklung/Tests)
// ---------------------------------------------------------------------------

interface StorageBackend {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}

const extensionBackend: StorageBackend = {
  async read(key) {
    const result = await chrome.storage.local.get(key);
    return result?.[key];
  },
  async write(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
};

const webBackend: StorageBackend = {
  async read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined; // beschädigte Daten oder localStorage gesperrt
    }
  },
  async write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function getBackend(): StorageBackend {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? extensionBackend : webBackend;
}

/**
 * Serialisiert alle Schreibzugriffe. Ohne Warteschlange überschreiben sich
 * gleichzeitige Read-Modify-Write-Zyklen gegenseitig (Lost Update).
 */
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Validierung
// ---------------------------------------------------------------------------

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Bereinigt eingelesene/übergebene Einstellungen; ungültige Felder fallen auf den Default bzw. werden verworfen. */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    wpm: Math.round(clampNumber(raw.wpm, WPM_MIN, WPM_MAX, base.wpm)),
    theme: raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : base.theme,
    fontSize: Math.round(clampNumber(raw.fontSize, 12, 120, base.fontSize)),
    fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily ? raw.fontFamily : base.fontFamily,
    wordsPerChunk: Math.round(clampNumber(raw.wordsPerChunk, 1, 4, base.wordsPerChunk)),
    rampUpEnabled: typeof raw.rampUpEnabled === 'boolean' ? raw.rampUpEnabled : base.rampUpEnabled,
    rampUpDuration: Math.round(clampNumber(raw.rampUpDuration, 1, 20, base.rampUpDuration)),
    rewindOnPause: typeof raw.rewindOnPause === 'boolean' ? raw.rewindOnPause : base.rewindOnPause,
  };
}

const SOURCE_TYPES: readonly SourceType[] = ['pdf', 'epub', 'page'];

function isBookProgress(value: unknown): value is BookProgress {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    SOURCE_TYPES.includes(v.type as SourceType) &&
    typeof v.currentIndex === 'number' &&
    typeof v.totalWords === 'number' &&
    typeof v.lastRead === 'number' &&
    typeof v.wpm === 'number'
  );
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

/** Lädt Einstellungen (nie werfend; bei Fehlern gelten die Defaults). */
export async function getSettings(): Promise<Settings> {
  try {
    return sanitizeSettings(await getBackend().read(STORAGE_KEYS.SETTINGS));
  } catch (error) {
    console.error('[storage] Einstellungen konnten nicht gelesen werden:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/** Speichert (teilweise) Einstellungen. */
export function saveSettings(settings: Partial<Settings>): Promise<void> {
  return serialize(async () => {
    const backend = getBackend();
    const current = sanitizeSettings(await backend.read(STORAGE_KEYS.SETTINGS));
    const updated = sanitizeSettings({ ...current, ...settings }, current);
    await backend.write(STORAGE_KEYS.SETTINGS, updated);
  });
}

// ---------------------------------------------------------------------------
// Lesefortschritt
// ---------------------------------------------------------------------------

/** Lädt alle gespeicherten Fortschritte, neueste zuerst. */
export async function getAllProgress(): Promise<BookProgress[]> {
  try {
    const stored = await getBackend().read(STORAGE_KEYS.PROGRESS);
    if (!Array.isArray(stored)) return [];
    return stored.filter(isBookProgress).sort((a, b) => b.lastRead - a.lastRead);
  } catch (error) {
    console.error('[storage] Fortschritt konnte nicht gelesen werden:', error);
    return [];
  }
}

/** Speichert den Lesefortschritt eines Dokuments (maximal 50 Einträge, neueste zuerst). */
export function saveProgress(progress: BookProgress): Promise<void> {
  return serialize(async () => {
    const all = (await getAllProgress()).filter((p) => p.id !== progress.id);
    all.push(progress);
    const trimmed = all.sort((a, b) => b.lastRead - a.lastRead).slice(0, MAX_PROGRESS_ENTRIES);
    await getBackend().write(STORAGE_KEYS.PROGRESS, trimmed);
  });
}

/** Lädt den Fortschritt für ein bestimmtes Dokument. */
export async function getProgress(id: string): Promise<BookProgress | null> {
  const all = await getAllProgress();
  return all.find((p) => p.id === id) ?? null;
}

/** Löscht den Fortschritt eines Dokuments. */
export function deleteProgress(id: string): Promise<void> {
  return serialize(async () => {
    const all = (await getAllProgress()).filter((p) => p.id !== id);
    await getBackend().write(STORAGE_KEYS.PROGRESS, all);
  });
}

// ---------------------------------------------------------------------------
// Allgemeine Werte (z. B. Werbe-Einstellungen)
// ---------------------------------------------------------------------------

/** Liest einen beliebigen Wert (nie werfend; bei Fehlern `undefined`). */
export async function readStoredValue(key: string): Promise<unknown> {
  try {
    return await getBackend().read(key);
  } catch (error) {
    console.error(`[storage] "${key}" konnte nicht gelesen werden:`, error);
    return undefined;
  }
}

/** Schreibt einen beliebigen Wert (serialisiert). */
export function writeStoredValue(key: string, value: unknown): Promise<void> {
  return serialize(() => getBackend().write(key, value));
}

/** Liest, ändert und schreibt einen Wert atomar (serialisiert mit allen anderen Schreibzugriffen). */
export function updateStoredValue(key: string, update: (current: unknown) => unknown): Promise<void> {
  return serialize(async () => {
    const backend = getBackend();
    await backend.write(key, update(await backend.read(key)));
  });
}

// ---------------------------------------------------------------------------
// Dokument-ID
// ---------------------------------------------------------------------------

/** cyrb53: schneller, gut verteilter 53-Bit-Hash (kein kryptografischer Zweck). */
function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Erzeugt einen kompakten Fingerabdruck aus Wortanzahl sowie Anfang und Ende des Textes. */
export function fingerprintWords(words: readonly string[]): string {
  const head = words.slice(0, 40).join(' ');
  const tail = words.slice(-40).join(' ');
  return `${words.length}|${head}|${tail}`;
}

/**
 * Erzeugt eine stabile ID für ein Dokument. Gleicher Titel, Typ und Inhalt
 * (Fingerabdruck) ergeben dieselbe ID; unterschiedliche Dokumente kollidieren
 * praktisch nie (im Gegensatz zu einer bloßen Zeichencode-Summe).
 */
export function generateDocumentId(title: string, type: string, fingerprint = ''): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // Akzente/Umlaut-Punkte entfernen, ohne Wörter zu zerschneiden
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${type}-${slug || 'dokument'}-${hashString(`${type}\u0000${title}\u0000${fingerprint}`)}`;
}
