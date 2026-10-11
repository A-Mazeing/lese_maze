import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/**
 * Manifest V3 – einzige Quelle der Wahrheit (die Version kommt aus package.json).
 *
 * Bewusst NICHT enthalten:
 * - `content_scripts` auf <all_urls>: Der Seitentext wird bei Bedarf per
 *   `chrome.scripting.executeScript` + `activeTab` gelesen. Dadurch braucht die
 *   Erweiterung keine dauerhafte Berechtigung auf allen Webseiten.
 * - `web_accessible_resources`: Der Reader wird ausschließlich von der Erweiterung
 *   selbst geöffnet; Webseiten dürfen weder einbetten noch die Extension-ID erraten.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'RSVP Speed Reader',
  version: pkg.version,
  description:
    'Schneller lesen mit RSVP (Rapid Serial Visual Presentation) – für PDFs, ePubs und Webseiten.',
  minimum_chrome_version: '110',
  permissions: ['activeTab', 'storage', 'scripting'],
  action: {
    default_title: 'RSVP Speed Reader',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_security_policy: {
    // pdf.js benötigt 'wasm-unsafe-eval' nur für optionale WASM-Decoder; kein 'unsafe-eval'.
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'self'; form-action 'none'",
  },
});
