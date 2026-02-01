/**
 * Text normalization utilities for word selection.
 * Provides consistent text processing across all selection strategies.
 */

/**
 * Normalizes text for comparison by removing special characters and whitespace.
 * @param text - The text to normalize
 * @returns Normalized lowercase text
 */
export function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '') // Remove Zero-Width Characters
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Splits text into words, filtering out empty strings.
 * @param text - The text to split
 * @returns Array of non-empty words
 */
export function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Extracts only alphanumeric characters (including Unicode letters).
 * Useful for fuzzy matching that ignores punctuation.
 * @param text - The text to process
 * @returns Text with only alphanumeric characters
 */
export function extractAlphanumeric(text: string): string {
  return text.replace(/[^\w\u00C0-\u024F]/g, '');
}

/**
 * Counts words in text before a given character index.
 * @param text - The full text
 * @param charIndex - Character position
 * @returns Number of words before the position
 */
export function countWordsBefore(text: string, charIndex: number): number {
  const textBefore = text.substring(0, charIndex);
  return splitIntoWords(textBefore).length;
}

/**
 * Finds the best matching word index using fuzzy matching strategies.
 * @param searchWord - Word to find
 * @param words - Array of words to search in
 * @param startFrom - Index to start searching from
 * @param searchBackward - Whether to search backward from the end
 * @returns Index of best match or -1 if not found
 */
export function findBestWordMatch(
  searchWord: string,
  words: string[],
  startFrom: number = 0,
  searchBackward: boolean = false
): number {
  const normalizedSearch = normalizeForComparison(searchWord);
  if (!normalizedSearch) return -1;

  const indices = searchBackward
    ? Array.from({ length: words.length }, (_, i) => words.length - 1 - i).filter(i => i >= startFrom)
    : Array.from({ length: words.length - startFrom }, (_, i) => i + startFrom);

  for (const i of indices) {
    const normalizedWord = normalizeForComparison(words[i]);

    // Exact match
    if (normalizedWord === normalizedSearch) return i;

    // Contains match (for words with punctuation)
    if (normalizedWord.includes(normalizedSearch) || normalizedSearch.includes(normalizedWord)) {
      return i;
    }

    // Alphanumeric match (ignores punctuation)
    const alphaSearch = extractAlphanumeric(normalizedSearch);
    const alphaWord = extractAlphanumeric(normalizedWord);
    if (alphaSearch && alphaWord && (alphaSearch === alphaWord || alphaWord.includes(alphaSearch))) {
      return i;
    }
  }

  return -1;
}
