import { useSyncExternalStore } from 'react';
import { readStoredValue, writeStoredValue } from '@/utils/storage';
import { de } from './de';
import { en, type MessageKey } from './en';

export type Language = 'en' | 'de';
export type { MessageKey };

export const LANGUAGES: ReadonlyArray<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

const STORAGE_KEY = 'rsvp_language';
const DEFAULT_LANGUAGE: Language = 'en';
const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, de };
const LOCALES: Record<Language, string> = { en: 'en-US', de: 'de-DE' };

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'de';
}

let current: Language = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

function apply(language: Language): void {
  if (language === current) return;
  current = language;
  if (typeof document !== 'undefined') document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}

export const getLanguage = (): Language => current;

/** Ersetzt `{name}`-Platzhalter. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

function translateIn(language: Language, key: MessageKey, params?: Record<string, string | number>): string {
  return interpolate(MESSAGES[language][key] ?? MESSAGES.en[key] ?? key, params);
}

/** Übersetzt in der aktuellen Sprache (auch außerhalb von React nutzbar). */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translateIn(current, key, params);
}

/** Je Sprache eine stabile Funktion: ändert sich nur beim Sprachwechsel (nützlich als Abhängigkeit von useMemo). */
const TRANSLATORS: Record<Language, typeof t> = {
  en: (key, params) => translateIn('en', key, params),
  de: (key, params) => translateIn('de', key, params),
};

/** Einzahl/Mehrzahl: wählt `<key>_one` bzw. `<key>_other`. */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;
export function tn(key: PluralKey, count: number, params: Record<string, string | number> = {}): string {
  const suffixed = `${key}_${count === 1 ? 'one' : 'other'}` as MessageKey;
  return t(suffixed, { count: formatNumber(count), ...params });
}

export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALES[current]);
}

/** Liest die gespeicherte Sprache (z. B. im Service Worker für Fehlermeldungen). */
export async function loadLanguage(): Promise<Language> {
  const stored = await readStoredValue(STORAGE_KEY);
  apply(isLanguage(stored) ? stored : DEFAULT_LANGUAGE);
  return current;
}

let watching = false;

/** Lädt die gespeicherte Sprache und hält mehrere Erweiterungsseiten synchron. Vor dem ersten Rendern aufrufen. */
export async function initLanguage(): Promise<Language> {
  await loadLanguage();
  if (!watching && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    watching = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      const change = changes[STORAGE_KEY];
      if (area === 'local' && change && isLanguage(change.newValue)) apply(change.newValue);
    });
  }
  return current;
}

/** Wechselt die Sprache sofort und speichert sie. */
export async function setLanguage(language: Language): Promise<void> {
  apply(language);
  try {
    await writeStoredValue(STORAGE_KEY, language);
  } catch (error) {
    console.error('[i18n] Sprache konnte nicht gespeichert werden:', error);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Aktuelle Sprache; rendert bei einem Wechsel neu. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

/** Übersetzungsfunktion für Komponenten (aktualisiert sich bei Sprachwechsel). */
export function useT(): typeof t {
  return TRANSLATORS[useLanguage()];
}

/** Nur für Tests. */
export function resetLanguageForTests(language: Language = DEFAULT_LANGUAGE): void {
  current = language;
  listeners.clear();
}
