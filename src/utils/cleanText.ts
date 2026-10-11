/**
 * Zeichenbereinigung für extrahierten Text. Bewusst in einem eigenen Modul ohne
 * Abhängigkeiten, damit `textProcessor` und `htmlText` es teilen können, ohne einen
 * Importzyklus zu bilden.
 *
 * Alle Sonderzeichen sind als \u-Escapes notiert: unsichtbare Zeichen im Quelltext
 * wären weder lesbar noch gegen Editor-/Formatter-Änderungen geschützt.
 */

const LIGATURES: Record<string, string> = {
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'ﬅ': 'st',
  'ﬆ': 'st',
};

/** Soft-Hyphen, Zero-Width-Zeichen (ZWSP, ZWNJ, ZWJ), Word Joiner und BOM. */
export const INVISIBLE_CHARS_RE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

const LIGATURE_RE = /[ﬀ-ﬆ]/g;
// eslint-disable-next-line no-control-regex -- bewusst: Steuerzeichen entfernen (außer \n)
const CONTROL_CHARS_RE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;
const DOUBLE_QUOTES_RE = /[“”„‟«»]/g;
const SINGLE_QUOTES_RE = /[‘’‚‛]/g;

/**
 * Bereinigt Text von unerwünschten Zeichen, behält aber Satzzeichen und
 * Zeilenumbrüche (für die Absatzerkennung).
 * - Zeilenenden werden vereinheitlicht, Mehrfach-Leerzeichen zusammengefasst
 * - Steuer- und unsichtbare Zeichen (inkl. Soft-Hyphen) werden entfernt
 * - Typografische Anführungszeichen werden zu ASCII, Ligaturen aufgelöst
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(LIGATURE_RE, (m) => LIGATURES[m] ?? m)
    .replace(INVISIBLE_CHARS_RE, '')
    .replace(CONTROL_CHARS_RE, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(DOUBLE_QUOTES_RE, '"')
    .replace(SINGLE_QUOTES_RE, "'")
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normalisiert ein einzelnes UTF-16-Zeichen für den Textvergleich (z. B. beim Abgleich
 * der Wortliste mit dem Textlayer eines PDFs). Liefert '' für Zeichen, die beim
 * Vergleich ignoriert werden: Leerraum, Steuer- und unsichtbare Zeichen sowie
 * Bindestriche (sie werden bei der Entsilbung entfernt oder bleiben erhalten – beides
 * soll den Vergleich nicht stören). Ligaturen werden aufgelöst, typografische
 * Anführungszeichen zu ASCII.
 *
 * Bewusst über Codepoints statt Zeichenklassen formuliert, damit keine unsichtbaren
 * Zeichen im Quelltext stehen.
 */
export function foldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (
    code <= 0x20 || // Steuerzeichen, Leerzeichen
    (code >= 0x7f && code <= 0xa0) || // DEL, C1-Steuerzeichen, geschütztes Leerzeichen
    code === 0xad || // Soft-Hyphen
    code === 0x2d || // Bindestrich-Minus
    (code >= 0x2000 && code <= 0x200f) || // Leerzeichen, Zero-Width-Zeichen
    (code >= 0x2010 && code <= 0x2015) || // Bindestriche, Gedankenstriche
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x2060 ||
    code === 0x2212 || // Minuszeichen
    code === 0x3000 ||
    code === 0xfeff
  ) {
    return '';
  }
  const ligature = LIGATURES[ch];
  if (ligature) return ligature;
  if (code === 0xab || code === 0xbb || (code >= 0x201c && code <= 0x201f)) return '"';
  if (code >= 0x2018 && code <= 0x201b) return "'";
  return ch;
}
