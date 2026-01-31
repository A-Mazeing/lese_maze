/**
 * Gängige Abkürzungen, die nicht als Satzende gelten
 */
const ABBREVIATIONS = new Set([
  'dr', 'mr', 'mrs', 'ms', 'prof', 'sr', 'jr',
  'z.b', 'u.a', 'd.h', 'etc', 'bzw', 'ca', 'ggf',
  'nr', 'tel', 'str', 'inkl', 'exkl', 'max', 'min',
  'vgl', 'evtl', 'usw', 'bspw', 'sog', 'lt',
]);

/**
 * Prüft ob ein Wort mit einem Satzzeichen endet
 */
function endsWithSentenceEnding(word: string): boolean {
  return /[.!?]$/.test(word);
}

/**
 * Prüft ob ein Wort eine Abkürzung ist
 */
function isAbbreviation(word: string): boolean {
  const cleaned = word.toLowerCase().replace(/[.!?]+$/, '');
  return ABBREVIATIONS.has(cleaned);
}

/**
 * Prüft ob ein Wort mit einem Großbuchstaben beginnt
 */
function startsWithCapital(word: string): boolean {
  return word.length > 0 && /[A-ZÄÖÜ]/.test(word[0]);
}

/**
 * Struktur mit Wörtern und deren Grenzen
 */
export interface TextStructure {
  words: string[];
  sentenceBreaks: number[];   // Indices wo Sätze beginnen
  paragraphBreaks: number[];  // Indices wo Absätze beginnen
}

/**
 * Tokenisiert einen Text in einzelne Wörter und erkennt Satz- und Absatzgrenzen.
 * 
 * Satzgrenzen:
 * - Ein Satz endet, wenn ein Wort mit . ! oder ? endet
 * - UND das nächste Wort mit einem Großbuchstaben beginnt
 * - Ausnahmen: Bekannte Abkürzungen werden nicht als Satzende gewertet
 * 
 * Absatzgrenzen:
 * - Absätze werden durch doppelte Zeilenumbrüche getrennt (\n\n, \r\n\r\n)
 */
export function tokenizeTextWithStructure(text: string): TextStructure {
  if (!text) {
    return {
      words: [],
      sentenceBreaks: [],
      paragraphBreaks: [],
    };
  }

  // Splitte Text in Absätze (durch doppelte Zeilenumbrüche)
  const paragraphs = text.split(/\n\s*\n|\r\n\s*\r\n/);
  
  const words: string[] = [];
  const sentenceBreaks: number[] = [0]; // Erster Satz beginnt bei Index 0
  const paragraphBreaks: number[] = [0]; // Erster Absatz beginnt bei Index 0
  
  let wordIndex = 0;
  let lastWasSentenceEnd = false;

  for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
    const paragraph = paragraphs[pIndex].trim();
    
    if (!paragraph) continue; // Überspringe leere Absätze
    
    // Markiere Absatzbeginn (außer beim ersten Absatz, den wir schon bei 0 haben)
    if (pIndex > 0 && wordIndex > 0) {
      paragraphBreaks.push(wordIndex);
      // Neuer Absatz ist auch ein neuer Satz
      if (!lastWasSentenceEnd) {
        sentenceBreaks.push(wordIndex);
      }
      lastWasSentenceEnd = false;
    }
    
    // Tokenisiere Absatz in Wörter
    const paragraphWords = paragraph
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(word => word.length > 0);
    
    // Verarbeite jedes Wort für Satzgrenzen-Erkennung
    for (let i = 0; i < paragraphWords.length; i++) {
      const word = paragraphWords[i];
      const nextWord = paragraphWords[i + 1];
      
      words.push(word);
      
      // Prüfe ob dies ein Satzende ist
      if (endsWithSentenceEnding(word)) {
        // Ist es eine Abkürzung?
        if (isAbbreviation(word)) {
          lastWasSentenceEnd = false;
        } else if (nextWord && startsWithCapital(nextWord)) {
          // Satzende erkannt, nächstes Wort ist neuer Satz
          sentenceBreaks.push(wordIndex + 1);
          lastWasSentenceEnd = true;
        } else {
          lastWasSentenceEnd = false;
        }
      } else {
        lastWasSentenceEnd = false;
      }
      
      wordIndex++;
    }
  }

  // Entferne Duplikate und sortiere
  const uniqueSentenceBreaks = [...new Set(sentenceBreaks)].sort((a, b) => a - b);
  const uniqueParagraphBreaks = [...new Set(paragraphBreaks)].sort((a, b) => a - b);

  return {
    words,
    sentenceBreaks: uniqueSentenceBreaks,
    paragraphBreaks: uniqueParagraphBreaks,
  };
}

/**
 * Tokenisiert einen Text in einzelne Wörter für RSVP.
 * Entfernt leere Strings und normalisiert Whitespace.
 */
export function tokenizeText(text: string): string[] {
  if (!text) {
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
 * WICHTIG: Behält Zeilenumbrüche für Absatzerkennung!
 */
export function cleanText(text: string): string {
  return text
    // Normalisiere mehrfache Leerzeichen (aber behalte Zeilenumbrüche)
    .replace(/[^\S\n]+/g, ' ')
    // Normalisiere mehrfache Zeilenumbrüche zu maximal 2
    .replace(/\n{3,}/g, '\n\n')
    // Entferne Steuerzeichen (außer \n und \r)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
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
