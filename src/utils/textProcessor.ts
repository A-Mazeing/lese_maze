/**
 * Tokenisiert einen Text in einzelne Wörter für RSVP.
 * Entfernt leere Strings und normalisiert Whitespace.
 */
export function tokenizeText(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Normalisiere Whitespace und splitte in Wörter
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 0);
}

/**
 * Bereinigt Text von unerwünschten Zeichen,
 * behält aber Satzzeichen für natürliche Pausen.
 */
export function cleanText(text: string): string {
  return text
    // Entferne mehrfache Leerzeichen/Zeilenumbrüche
    .replace(/\s+/g, ' ')
    // Entferne Steuerzeichen
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalisiere Anführungszeichen
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Extrahiert reinen Text aus HTML.
 */
export function extractTextFromHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Entferne Script und Style Tags
  doc.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  
  // Hole den Text
  const text = doc.body?.textContent || '';
  
  return cleanText(text);
}

/**
 * Schätzt die Lesezeit basierend auf Wortanzahl und WPM.
 */
export function estimateReadingTime(wordCount: number, wpm: number): string {
  const minutes = Math.ceil(wordCount / wpm);
  
  if (minutes < 1) return 'Weniger als 1 Minute';
  if (minutes === 1) return '1 Minute';
  if (minutes < 60) return `${minutes} Minuten`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 Stunde' : `${hours} Stunden`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Formatiert einen Fortschritt als Prozent-String.
 */
export function formatProgress(current: number, total: number): string {
  if (total === 0) return '0%';
  const percent = Math.round((current / total) * 100);
  return `${percent}%`;
}
