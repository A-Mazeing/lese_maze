import type { ORPWord } from '@/types';

/**
 * Berechnet den Optimal Recognition Point (ORP) eines Wortes.
 * Der ORP ist der Punkt, auf den das Auge beim Lesen fokussiert.
 * Er liegt typischerweise bei etwa 35% der Wortlänge.
 */
export function calculateORP(word: string): number {
  const length = word.length;
  
  if (length <= 1) return 0;
  if (length === 2) return 0;
  if (length === 3) return 1;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  
  // Für längere Wörter: ca. 35% Position
  return Math.floor(length * 0.35);
}

/**
 * Formatiert ein Wort mit ORP-Markierung in drei Teile:
 * - before: Buchstaben vor dem ORP
 * - orp: Der ORP-Buchstabe (wird rot dargestellt)
 * - after: Buchstaben nach dem ORP
 */
export function formatWordWithORP(word: string): ORPWord {
  if (!word || word.length === 0) {
    return { before: '', orp: '', after: '', fullWord: '' };
  }
  
  const orpIndex = calculateORP(word);
  
  return {
    before: word.slice(0, orpIndex),
    orp: word[orpIndex] || '',
    after: word.slice(orpIndex + 1),
    fullWord: word,
  };
}

/**
 * Berechnet die Anzeigedauer eines Wortes in Millisekunden.
 * Längere Wörter und Wörter mit Satzzeichen bekommen mehr Zeit.
 */
export function calculateWordDuration(word: string, baseWpm: number): number {
  const baseMs = (60 * 1000) / baseWpm;
  
  // Längere Wörter bekommen mehr Zeit
  let multiplier = 1;
  if (word.length > 8) multiplier += 0.2;
  if (word.length > 12) multiplier += 0.3;
  
  // Satzzeichen bekommen Pause
  if (/[.!?]$/.test(word)) multiplier += 0.5;
  if (/[,;:]$/.test(word)) multiplier += 0.2;
  
  return Math.round(baseMs * multiplier);
}
