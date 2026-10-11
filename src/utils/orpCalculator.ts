import type { ORPWord } from '@/types';

const LEADING_NON_WORD_RE = /^[^\p{L}\p{N}]+/u;
const TRAILING_NON_WORD_RE = /[^\p{L}\p{N}]+$/u;

/** ORP-Position innerhalb eines Wortkerns der Länge `length` (ohne Satzzeichen). */
function orpPositionForLength(length: number): number {
  if (length <= 2) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return Math.floor(length * 0.35);
}

/**
 * Berechnet den Optimal Recognition Point (ORP) eines Wortes als Index in der
 * Zeichenfolge (nach Unicode-Codepoints). Führende/abschließende Satzzeichen
 * (Anführungszeichen, Klammern, Punkte) zählen nicht zur Wortlänge, damit der
 * Fixationspunkt bei „Hallo“ auf dem Buchstaben und nicht auf dem Anführungszeichen liegt.
 */
export function calculateORP(word: string): number {
  const chars = Array.from(word);
  if (chars.length === 0) return 0;

  const leading = Array.from(word.match(LEADING_NON_WORD_RE)?.[0] ?? '').length;
  if (leading >= chars.length) return 0; // nur Satzzeichen
  const trailing = Array.from(word.match(TRAILING_NON_WORD_RE)?.[0] ?? '').length;
  const coreLength = Math.max(1, chars.length - leading - trailing);

  return Math.min(chars.length - 1, leading + orpPositionForLength(coreLength));
}

/**
 * Formatiert ein Wort mit ORP-Markierung in drei Teile
 * (vor dem ORP, ORP-Buchstabe, nach dem ORP). Surrogate-Paare (Emoji) bleiben intakt.
 */
export function formatWordWithORP(word: string): ORPWord {
  if (!word) {
    return { before: '', orp: '', after: '', fullWord: '' };
  }

  const chars = Array.from(word);
  const orpIndex = calculateORP(word);

  return {
    before: chars.slice(0, orpIndex).join(''),
    orp: chars[orpIndex] ?? '',
    after: chars.slice(orpIndex + 1).join(''),
    fullWord: word,
  };
}

/**
 * Berechnet die Anzeigedauer eines Wortes in Millisekunden.
 * Längere Wörter bekommen etwas mehr Zeit; Satzzeichen verlängern bewusst nicht
 * (gleichmäßiger Lesefluss).
 */
export function calculateWordDuration(word: string, baseWpm: number): number {
  const wpm = Number.isFinite(baseWpm) && baseWpm > 0 ? baseWpm : 300;
  const baseMs = 60_000 / wpm;
  const length = Array.from(word).length;

  let multiplier = 1;
  if (length > 8) multiplier += 0.2;
  if (length > 12) multiplier += 0.3;

  return Math.round(baseMs * multiplier);
}
