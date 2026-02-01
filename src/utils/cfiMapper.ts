import type { CFICheckpoint } from '@/types';

/**
 * Findet den nächsten CFI-Checkpoint für einen gegebenen Wort-Index.
 * Nutzt binäre Suche für Effizienz.
 */
export function findNearestCheckpoint(
  wordIndex: number,
  checkpoints: CFICheckpoint[]
): CFICheckpoint | null {
  if (checkpoints.length === 0) return null;
  
  // Binäre Suche für den größten Checkpoint <= wordIndex
  let left = 0;
  let right = checkpoints.length - 1;
  let nearest = checkpoints[0];
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const checkpoint = checkpoints[mid];
    
    if (checkpoint.wordIndex <= wordIndex) {
      nearest = checkpoint;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return nearest;
}

/**
 * Findet den Checkpoint, der einem bestimmten CFI am nächsten kommt.
 * Da CFIs komplexe Strings sind, suchen wir nach Prefix-Matches.
 */
export function findCheckpointByCFI(
  cfi: string,
  checkpoints: CFICheckpoint[]
): CFICheckpoint | null {
  if (checkpoints.length === 0 || !cfi) return null;
  
  // Normalisiere CFI für Vergleich
  const normalizedCfi = normalizeCFI(cfi);
  
  // Exakter Match
  const exactMatch = checkpoints.find(cp => normalizeCFI(cp.cfi) === normalizedCfi);
  if (exactMatch) return exactMatch;
  
  // Prefix-Match: Suche den längsten passenden Prefix
  let bestMatch: CFICheckpoint | null = null;
  let bestMatchLength = 0;
  
  for (const checkpoint of checkpoints) {
    const cpCfi = normalizeCFI(checkpoint.cfi);
    
    // Prüfe ob einer ein Prefix des anderen ist
    const commonLength = getCommonPrefixLength(cpCfi, normalizedCfi);
    if (commonLength > bestMatchLength) {
      bestMatchLength = commonLength;
      bestMatch = checkpoint;
    }
  }
  
  return bestMatch;
}

/**
 * Normalisiert einen CFI-String für Vergleiche.
 */
export function normalizeCFI(cfi: string): string {
  if (!cfi) return '';
  // Entferne epubcfi() wrapper wenn vorhanden
  const match = cfi.match(/epubcfi\((.+)\)/);
  return match ? match[1] : cfi;
}

/**
 * Berechnet die Länge des gemeinsamen Prefixes zweier Strings.
 */
function getCommonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return i;
}

/**
 * Schätzt den Wort-Index basierend auf einem CFI.
 * Interpoliert zwischen bekannten Checkpoints.
 */
export function estimateWordIndexFromCFI(
  cfi: string,
  checkpoints: CFICheckpoint[]
): number {
  if (checkpoints.length === 0) return 0;
  
  const checkpoint = findCheckpointByCFI(cfi, checkpoints);
  if (!checkpoint) return 0;
  
  return checkpoint.wordIndex;
}

/**
 * Generiert einen approximativen CFI für einen Wort-Index.
 * Basiert auf den nächstgelegenen Checkpoints.
 */
export function generateCFIForWordIndex(
  wordIndex: number,
  checkpoints: CFICheckpoint[]
): string {
  const checkpoint = findNearestCheckpoint(wordIndex, checkpoints);
  return checkpoint?.cfi || '';
}

/**
 * Findet das Kapitel, das einen bestimmten Wort-Index enthält.
 */
export function findChapterForWordIndex(
  wordIndex: number,
  checkpoints: CFICheckpoint[]
): number {
  const checkpoint = findNearestCheckpoint(wordIndex, checkpoints);
  return checkpoint?.chapterIndex ?? 0;
}

/**
 * Berechnet den Fortschritt (0-100%) basierend auf Wort-Index.
 */
export function calculateProgressFromWordIndex(
  wordIndex: number,
  totalWords: number
): number {
  if (totalWords === 0) return 0;
  return Math.round((wordIndex / totalWords) * 100);
}

/**
 * Schätzt den Wort-Index basierend auf einem Prozentwert.
 */
export function estimateWordIndexFromPercentage(
  percentage: number,
  totalWords: number
): number {
  return Math.floor((percentage / 100) * totalWords);
}
