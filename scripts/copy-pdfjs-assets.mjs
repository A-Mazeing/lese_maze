/**
 * Kopiert die zur Laufzeit benötigten pdf.js-Ressourcen nach public/pdfjs/.
 *
 *  - cmaps          Zeichenzuordnungen (CJK/Spezialkodierungen) für Text und Darstellung
 *  - standard_fonts Ersatzschriften für nicht eingebettete Standardschriften (Darstellung)
 *  - wasm           Decoder für JPEG 2000 / JBIG2 (Bilder in manchen PDFs)
 *  - iccs           ICC-Profile für CMYK-Farbräume
 *
 * Die Dateien werden zur Laufzeit über chrome.runtime.getURL('pdfjs/…') geladen.
 * Plattformunabhängig (kein cp/xcopy).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = [
  ['cmaps', 'cmaps'],
  ['standard_fonts', 'standard_fonts'],
  ['wasm', 'wasm'],
  ['iccs', 'iccs'],
];

rmSync(join(root, 'public', 'pdfjs'), { recursive: true, force: true });

for (const [from, to] of assets) {
  const source = join(root, 'node_modules', 'pdfjs-dist', from);
  const target = join(root, 'public', 'pdfjs', to);
  if (!existsSync(source)) {
    console.error(`[copy-pdfjs-assets] ${source} nicht gefunden – wurde "npm install" ausgeführt?`);
    process.exit(1);
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}
console.log(`[copy-pdfjs-assets] ${assets.map(([, to]) => to).join(', ')} nach public/pdfjs kopiert.`);
