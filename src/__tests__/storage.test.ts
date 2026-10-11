import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  deleteProgress,
  fingerprintWords,
  generateDocumentId,
  getAllProgress,
  getProgress,
  getSettings,
  sanitizeSettings,
  saveProgress,
  saveSettings,
} from '@/utils/storage';
import type { BookProgress } from '@/types';

const entry = (id: string, lastRead: number, extra: Partial<BookProgress> = {}): BookProgress => ({
  id,
  title: id,
  type: 'pdf',
  currentIndex: 10,
  totalWords: 100,
  lastRead,
  wpm: 300,
  ...extra,
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists partial updates and keeps other fields', async () => {
    await saveSettings({ wpm: 450 });
    await saveSettings({ wordsPerChunk: 2 });
    expect(await getSettings()).toMatchObject({ wpm: 450, wordsPerChunk: 2, rewindOnPause: true });
  });

  it('serialises concurrent writes (no lost updates)', async () => {
    await Promise.all([saveSettings({ wpm: 500 }), saveSettings({ wordsPerChunk: 3 }), saveSettings({ rampUpDuration: 9 })]);
    expect(await getSettings()).toMatchObject({ wpm: 500, wordsPerChunk: 3, rampUpDuration: 9 });
  });

  it('sanitises corrupt or out-of-range values', () => {
    const cleaned = sanitizeSettings({ wpm: 'schnell', wordsPerChunk: 99, theme: 'neon', rampUpEnabled: 'ja', fontSize: -4 });
    expect(cleaned.wpm).toBe(DEFAULT_SETTINGS.wpm);
    expect(cleaned.wordsPerChunk).toBe(4);
    expect(cleaned.theme).toBe('system');
    expect(cleaned.rampUpEnabled).toBe(true);
    expect(cleaned.fontSize).toBe(12);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ wpm: 99999 }).wpm).toBe(1500);
  });

  it('survives a failing storage backend', async () => {
    (chrome.storage.local.get as unknown as { mockRejectedValueOnce(e: Error): void }).mockRejectedValueOnce(new Error('kaputt'));
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('progress', () => {
  it('stores, replaces and deletes entries', async () => {
    await saveProgress(entry('a', 1));
    await saveProgress(entry('b', 2));
    await saveProgress(entry('a', 3, { currentIndex: 55 }));
    const all = await getAllProgress();
    expect(all.map((p) => p.id)).toEqual(['a', 'b']);
    expect((await getProgress('a'))?.currentIndex).toBe(55);
    await deleteProgress('a');
    expect(await getProgress('a')).toBeNull();
  });

  it('keeps at most 50 entries, newest first', async () => {
    for (let i = 0; i < 60; i++) await saveProgress(entry(`doc${i}`, i));
    const all = await getAllProgress();
    expect(all).toHaveLength(50);
    expect(all[0].id).toBe('doc59');
    expect(all.some((p) => p.id === 'doc0')).toBe(false);
  });

  it('does not lose entries when saved concurrently', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => saveProgress(entry(`p${i}`, i))));
    expect(await getAllProgress()).toHaveLength(10);
  });

  it('drops malformed stored entries', async () => {
    await chrome.storage.local.set({ rsvp_progress: [entry('ok', 1), { id: 5 }, null, 'x'] });
    expect((await getAllProgress()).map((p) => p.id)).toEqual(['ok']);
  });
});

describe('document ids', () => {
  const words = ['Eins', 'zwei', 'drei'];

  it('is stable for identical input and differs for different content', () => {
    const a = generateDocumentId('Buch', 'epub', fingerprintWords(words));
    expect(generateDocumentId('Buch', 'epub', fingerprintWords(words))).toBe(a);
    expect(generateDocumentId('Buch', 'epub', fingerprintWords([...words, 'vier']))).not.toBe(a);
    expect(generateDocumentId('Buch', 'pdf', fingerprintWords(words))).not.toBe(a);
  });

  it('does not collide for anagram titles (sum-of-char-codes weakness)', () => {
    expect(generateDocumentId('ab', 'pdf')).not.toBe(generateDocumentId('ba', 'pdf'));
  });

  it('produces a safe slug even for symbol-only titles', () => {
    expect(generateDocumentId('!!!', 'pdf')).toMatch(/^pdf-dokument-[0-9a-z]+$/);
    expect(generateDocumentId('Größe & Maß', 'pdf')).toMatch(/^pdf-große-maß-[0-9a-z]+$/u);
  });
});
