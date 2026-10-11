import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import {
  formatNumber,
  getLanguage,
  initLanguage,
  loadLanguage,
  resetLanguageForTests,
  setLanguage,
  t,
  tn,
  useT,
} from '@/i18n';

beforeEach(() => resetLanguageForTests('en'));
afterEach(() => resetLanguageForTests('en'));

/** Platzhalter eines Textes, sortiert. */
const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

describe('dictionaries', () => {
  it('German has exactly the English keys', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('has no empty texts and every plural has both forms', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.length, key).toBeGreaterThan(0);
      if (key.endsWith('_one')) expect(en, key).toHaveProperty(key.replace(/_one$/, '_other'));
    }
  });
});

describe('translation', () => {
  it('defaults to English', () => {
    expect(getLanguage()).toBe('en');
    expect(t('playback.play')).toBe(en['playback.play']);
  });

  it('interpolates parameters and keeps unknown placeholders', () => {
    expect(t('support.tipBy', { title: 'A', author: 'B' })).toBe('A by B');
    expect(t('support.tipBy', { title: 'A' })).toBe('A by {author}');
  });

  it('picks singular and plural forms', async () => {
    await setLanguage('en');
    expect(tn('settings.chunks', 1)).toBe('1 chunk');
    expect(tn('settings.chunks', 5)).toBe('5 chunks');
    await setLanguage('de');
    expect(tn('settings.chunks', 1)).toBe('1 Chunk');
    expect(tn('settings.chunks', 1500)).toBe('1.500 Chunks');
  });

  it('formats numbers by language', async () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    await setLanguage('de');
    expect(formatNumber(1234.5)).toBe('1.234,5');
  });
});

describe('language selection', () => {
  it('persists the choice and restores it', async () => {
    await setLanguage('de');
    expect(document.documentElement.lang).toBe('de');
    resetLanguageForTests('en');
    expect(await loadLanguage()).toBe('de');
    expect(t('playback.play')).toBe(de['playback.play']);
  });

  it('falls back to English for unknown stored values', async () => {
    await chrome.storage.local.set({ rsvp_language: 'fr' });
    expect(await initLanguage()).toBe('en');
  });

  it('re-renders components when the language changes', async () => {
    function Label() {
      const tr = useT();
      return <span>{tr('playback.play')}</span>;
    }
    render(<Label />);
    expect(screen.getByText(en['playback.play'])).toBeInTheDocument();
    await act(async () => setLanguage('de'));
    expect(screen.getByText(de['playback.play'])).toBeInTheDocument();
  });

  it('switches via the LanguageSwitcher', async () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    await act(async () => screen.getByRole('button', { name: 'Deutsch' }).click());
    expect(getLanguage()).toBe('de');
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
  });
});
