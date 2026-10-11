import { t } from '@/i18n';
import { cleanText } from './cleanText';
import { extractTextInReadingOrder } from './htmlText';

export { cleanText };

/**
 * Gängige Abkürzungen (ohne abschließenden Punkt, kleingeschrieben), nach denen
 * ein Satz normalerweise NICHT endet.
 */
const ABBREVIATIONS = new Set([
  // Titel / Anreden
  'dr', 'prof', 'mr', 'mrs', 'ms', 'sr', 'jr', 'hr', 'fr', 'st', 'dipl', 'ing', 'med', 'jur', 'rer', 'nat', 'phil',
  // Deutsch
  'z.b', 'u.a', 'd.h', 'i.d.r', 'u.u', 's.o', 's.u', 'o.ä', 'z.t', 'z.z', 'z.zt', 'm.e', 'e.v', 'v.a', 'u.ä', 'o.g',
  'etc', 'usw', 'bzw', 'ca', 'ggf', 'evtl', 'vgl', 'bspw', 'sog', 'inkl', 'exkl', 'max', 'min', 'mind', 'nr', 'tel',
  'str', 'abb', 'tab', 'kap', 'bd', 'hrsg', 'jh', 'jhd', 'mio', 'mrd', 'ff', 'lt', 'gem', 'zzgl', 'abs', 'anm', 'vs',
  // Englisch
  'inc', 'ltd', 'co', 'corp', 'e.g', 'i.e', 'cf', 'approx', 'dept', 'est', 'fig', 'no', 'vol',
]);

/** Schließende Zeichen, die nach dem Satzzeichen stehen können: ." .) .» … */
const CLOSING_PUNCT = '"\'“”„‘’»«)\\]';
const SENTENCE_END_RE = new RegExp(`[.!?…][${CLOSING_PUNCT}]*$`, 'u');
const TRAILING_CLOSING_RE = new RegExp(`[${CLOSING_PUNCT}]+$`, 'u');
const LEADING_OPENING_RE = /^[\s"'“”„‘‚«»([{¿¡*_–—-]+/u;

/** Prüft, ob ein Wort mit einem Satzzeichen (optional gefolgt von Anführungszeichen) endet. */
function endsWithSentenceEnding(word: string): boolean {
  return SENTENCE_END_RE.test(word);
}

/**
 * Prüft, ob ein auf "." endendes Wort eine Abkürzung, ein Initial ("J.") oder
 * eine Ordnungszahl ("3.") ist – dann beginnt danach kein neuer Satz.
 */
function isAbbreviation(word: string): boolean {
  const core = word.replace(TRAILING_CLOSING_RE, '');
  // Nur ein einzelner Punkt kann eine Abkürzung markieren; "..." / "!" / "?" nicht.
  if (!core.endsWith('.') || core.endsWith('..') || core.endsWith('…')) return false;

  const stem = core.slice(0, -1).replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
  if (!stem) return false;
  if (ABBREVIATIONS.has(stem)) return true;
  if (/^\p{L}$/u.test(stem)) return true; // Initiale: "J." "K."
  if (/^\d+$/u.test(stem)) return true; // Ordnungszahl: "3. Oktober"
  return false;
}

/** Prüft, ob ein Wort (nach führenden Anführungszeichen/Klammern) mit einem Großbuchstaben beginnt. */
function startsWithCapital(word: string): boolean {
  const stripped = word.replace(LEADING_OPENING_RE, '');
  return stripped.length > 0 && /^\p{Lu}/u.test(stripped);
}

/** Struktur mit Wörtern und deren Grenzen. */
export interface TextStructure {
  words: string[];
  /** Indices, an denen ein Satz beginnt. */
  sentenceBreaks: number[];
  /** Indices, an denen ein Absatz beginnt. */
  paragraphBreaks: number[];
}

/**
 * Leitet Satz- und Absatzgrenzen aus einer fertigen Wortliste ab.
 *
 * @param words Wörter in Lesereihenfolge
 * @param paragraphStarts Indices (aufsteigend), an denen ein Absatz beginnt; Index 0
 *        gilt immer als Absatzanfang.
 *
 * Satzgrenzen: Ein Wort endet mit . ! ? … (ggf. gefolgt von Anführungszeichen), ist
 * keine Abkürzung, und das nächste Wort beginnt mit einem Großbuchstaben. Jeder
 * Absatzanfang ist zugleich ein Satzanfang.
 */
export function buildTextStructure(words: string[], paragraphStarts: readonly number[]): TextStructure {
  const sentenceBreaks: number[] = [];
  const paragraphBreaks: number[] = [];
  if (words.length === 0) return { words, sentenceBreaks, paragraphBreaks };

  const starts = new Set<number>(paragraphStarts.filter((i) => i > 0 && i < words.length));
  starts.add(0);

  for (let i = 0; i < words.length; i++) {
    if (starts.has(i)) {
      paragraphBreaks.push(i);
      sentenceBreaks.push(i);
      continue;
    }
    const previous = words[i - 1];
    if (endsWithSentenceEnding(previous) && !isAbbreviation(previous) && startsWithCapital(words[i])) {
      sentenceBreaks.push(i);
    }
  }
  return { words, sentenceBreaks, paragraphBreaks };
}

/**
 * Tokenisiert einen Text in einzelne Wörter und erkennt Satz- und Absatzgrenzen.
 * Absatzgrenzen sind Leerzeilen (zwei aufeinanderfolgende Zeilenumbrüche).
 */
export function tokenizeTextWithStructure(text: string): TextStructure {
  if (!text) return { words: [], sentenceBreaks: [], paragraphBreaks: [] };

  const words: string[] = [];
  const paragraphStarts: number[] = [];

  for (const rawParagraph of text.split(/\r?\n(?:[^\S\r\n]*\r?\n)+/)) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) continue;
    paragraphStarts.push(words.length);
    for (const word of paragraph.split(/\s+/)) words.push(word);
  }
  return buildTextStructure(words, paragraphStarts);
}

/**
 * Fügt mehrere Teilstrukturen (z. B. PDF-Seiten, ePub-Kapitel) zusammen.
 * Der Beginn jedes nicht-leeren Teils ist zugleich Absatz- und Satzgrenze.
 *
 * Arbeitet bewusst mit Schleifen statt `push(...arr)`, damit auch Teile mit
 * Hunderttausenden Wörtern keinen "Maximum call stack size exceeded" auslösen.
 */
export function mergeTextStructures(parts: readonly TextStructure[]): TextStructure & { partStarts: number[] } {
  const words: string[] = [];
  const sentenceBreaks: number[] = [];
  const paragraphBreaks: number[] = [];
  const partStarts: number[] = [];

  for (const part of parts) {
    const offset = words.length;
    partStarts.push(offset);
    if (part.words.length === 0) continue;

    for (const w of part.words) words.push(w);
    for (const b of part.sentenceBreaks) pushUnique(sentenceBreaks, b + offset);
    for (const b of part.paragraphBreaks) pushUnique(paragraphBreaks, b + offset);
    pushUnique(sentenceBreaks, offset);
    pushUnique(paragraphBreaks, offset);
  }

  sentenceBreaks.sort((a, b) => a - b);
  paragraphBreaks.sort((a, b) => a - b);
  return { words, sentenceBreaks, paragraphBreaks, partStarts };
}

function pushUnique(list: number[], value: number): void {
  if (list.length === 0 || list[list.length - 1] < value) {
    list.push(value);
  } else if (!list.includes(value)) {
    list.push(value);
  }
}

/** Tokenisiert einen Text in einzelne Wörter (ohne Struktur). */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * Extrahiert reinen Text aus HTML. Block-Elemente erzeugen Absatzgrenzen, damit
 * Wörter benachbarter Absätze nicht zusammenwachsen ("Ende</p><p>Anfang").
 */
export function extractTextFromHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body ?? doc.documentElement;
  if (!root) return '';
  return cleanText(extractTextInReadingOrder(root));
}

/** Schätzt die Lesezeit basierend auf Wortanzahl und WPM. */
export function estimateReadingTime(wordCount: number, wpm: number): string {
  if (wordCount <= 0 || wpm <= 0) return t('time.lessThanMinute');
  const minutes = Math.ceil(wordCount / wpm);

  if (minutes <= 1) return minutes < 1 ? t('time.lessThanMinute') : t('time.oneMinute');
  if (minutes < 60) return t('time.minutes', { n: minutes });

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? t('time.oneHour') : t('time.hours', { n: hours });
  }
  return t('time.hoursMinutes', { h: hours, m: remainingMinutes });
}

/** Formatiert einen Fortschritt als Prozent-String. */
export function formatProgress(current: number, total: number): string {
  if (total <= 0) return '0%';
  const percent = Math.round((current / total) * 100);
  return `${Math.max(0, Math.min(100, percent))}%`;
}
