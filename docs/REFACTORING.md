# Refactoring-Bericht: Lese Maze (RSVP Speed Reader)

Ausgangsstand: Commit `3134bfd`. Dieser Bericht beschreibt (1) die gefundenen Mängel, (2) die getroffenen
Architekturentscheidungen, (3) die finale Ordnerstruktur und (4) die Änderungen an `manifest.json`,
`vite.config.ts` und den Dependencies.

## 1. Analyse: Mängel im Ausgangsstand

Schweregrad: **K** = kritisch (Funktion kaputt / Sicherheit), **H** = hoch (Fehlverhalten, Leaks), **M** = mittel.

### 1.1 Build, Konfiguration, Repo

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 1 | K | `vite build` brach ab bzw. erzeugte kein ladbares Paket; `tsc` meldete 3 Fehler. | Build und Typecheck laufen fehlerfrei (`npm run build`). |
| 2 | H | `dist/` war eingecheckt (16 Dateien) und driftete vom Quelltext ab. | `dist/` ist in `.gitignore`; CI erzeugt das Paket als Artefakt. |
| 3 | M | Manifest lag als `public/manifest.json` (Version `1.0.0`) neben `package.json` (`0.0.0`) – zwei Wahrheiten. | `manifest.config.ts` (typisiert, Version aus `package.json`). |
| 4 | M | `react-native` (!), `tailwindcss`, `@tailwindcss/vite`, `@types/jsdom` standen in `dependencies`. | `react-native` entfernt; Build-Tools nach `devDependencies`. |
| 5 | M | pdf.js-CMaps wurden nicht ausgeliefert – PDFs mit CJK-/nicht eingebetteten Schriften können damit nicht korrekt dekodiert werden. | `scripts/copy-pdfjs-assets.mjs` kopiert CMaps nach `public/pdfjs/cmaps` (läuft in `predev`/`prebuild`). |
| 6 | M | Zusätzlicher Rollup-Input `index.html` (Dev-Relikt) und irreführender Chunk-Name `pdf-worker`. | Nur noch der Reader als Zusatz-Input; Chunks `pdfjs`, `epub`, `virtuoso`, `react-vendor`. |

### 1.2 Manifest V3, Service Worker, Message Passing

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 7 | K | `content_scripts` auf `<all_urls>`: Dauerhafte Berechtigung auf jeder Seite (Datenschutz, Store-Review, Performance). | Entfernt. Seitentext wird bei Bedarf per `chrome.scripting.executeScript({ func })` + `activeTab` gelesen. |
| 8 | K | `executeScript({ files: ['src/content/content.ts'] })` – ein `.ts`-Pfad existiert im Build nicht; Fehler wurde verschluckt. | Injiziert wird eine Funktion (`extractPageInPage`), das Ergebnis kommt direkt als Rückgabewert. |
| 9 | H | Hack aus `setTimeout(100)` + 3 Wiederholungen, um auf das Content Script zu warten (Race Condition). | Entfällt, da kein Nachrichtenaustausch mit dem Content Script nötig ist. |
| 10 | K | `onMessage` ohne Absenderprüfung. | `isTrustedSender` (nur eigene Extension-Seiten) + Schema-Prüfung (`isExtensionRequest`). |
| 11 | H | Uneinheitliche Antworten (`{success}`), nicht jeder Pfad antwortete → „message port closed“. | Diskriminierte Union `MessageResponse`; jede Nachricht wird genau einmal beantwortet, `return true` nur bei asynchroner Antwort. |
| 12 | H | `sendMessage` im Popup ohne Timeout/Fehlerbehandlung. | `utils/messaging.ts#sendRequest`: liefert *immer* eine Response, Timeout 20 s, übersetzt Rejections. |
| 13 | H | `tabs.query({ currentWindow: true })` im Service Worker (hat kein „aktuelles Fenster“). | `lastFocusedWindow: true`. |
| 14 | H | Ein einziger Schlüssel `pageContent` in `storage.session`: Race zwischen Tabs, nie aufgeräumt, 10-MB-Quota unbehandelt. | Schlüssel `pageContent:<uuid>`, TTL 5 min (`purgeStalePageContent`), Quota-Fallback mit gekürztem Text. |
| 15 | H | `web_accessible_resources` für `assets/*.js` auf `<all_urls>` – Webseiten konnten Extension-Code laden/fingerprinten. | Entfernt (der Reader wird nur von der Erweiterung selbst geöffnet). |
| 16 | M | Keine explizite CSP, keine Prüfung von `chrome://`, Web-Store-, PDF-URLs. | Explizite CSP (ohne `unsafe-eval`); `checkPageUrl` liefert lesbare Fehlermeldungen. |
| 17 | M | Listener-Registrierung/Zustand nicht MV3-gerecht (kein Re-Start-Konzept). | Alle Listener synchron auf oberster Ebene, kein flüchtiger Zustand im Worker. |

### 1.3 PDF (`usePDFParser`)

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 18 | H | pdf.js (inkl. 1,2-MB-Worker) wurde statisch importiert, `GlobalWorkerOptions` auf Modul-Ebene gesetzt. | `utils/pdfjs.ts`: Lazy-Import, Worker über `?url`, Konfiguration genau einmal. |
| 19 | K | Text-Items wurden mit `join(' ')` verbunden → zerrissene Wörter („Hal lo“), keine Zeilen-/Absatzlogik. | `utils/pdfText.ts`: Zeilen aus `hasEOL`/y-Position, Absätze aus Zeilenabständen, Entsilbung, Seitenzahlen entfernt. |
| 20 | H | Kein Abbruch bei erneutem Laden → parallele Parser, veralteter State. | `AbortController` je Ladevorgang; Ergebnisse veralteter Läufe werden verworfen. |
| 21 | H | `PDFDocumentProxy`/Loading-Task wurden nicht in jedem Pfad zerstört. | `try/finally` mit `destroy()`; nach der Extraktion wird nichts gehalten. |
| 22 | M | Keine differenzierte Fehlerbehandlung (Passwort, beschädigte Datei, Dateigröße). | `PdfLoadError` mit eindeutigen deutschen Meldungen, Größenlimit (200 MB). |

### 1.4 ePub (`useEPubParser`, `useEPubViewer`)

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 23 | H | Wort-Position ↔ Text im Buch wurde über CFI-Schätzungen (`cfiMapper`, Checkpoints) angenähert. | `collectDomWords` ist die **einzige** Quelle der Wahrheit – Parser und Viewer zerlegen das DOM identisch; Wort *n* ist exakt Wort *n*. |
| 24 | H | `Book`/`Rendition` wurden nicht verlässlich zerstört (Blob-URLs, Iframes, JSZip-Archiv blieben im Speicher). | `ReaderContext.setEpubBook` zerstört das vorige Buch; Rendition wird im Effekt-Cleanup zerstört; getestet in Chromium (0 Iframes nach „Zurück“). |
| 25 | M | Sequenzielles Laden aller Kapitel ohne Entladen. | Kapitel werden mit `section.unload()` freigegeben; Fortschritt wird gemeldet; Abbruch möglich. |
| 26 | M | Hervorhebung über DOM-Manipulation im Buch. | CSS Custom Highlight API (`::highlight(rsvp-current)`) – kein DOM-Eingriff, kein Re-Layout. |
| 27 | M | Viewer-Iframe ohne Sandbox. | `sandbox="allow-same-origin"` (keine Skriptausführung aus Buchinhalten). |

### 1.5 RSVP-Wiedergabe (`useRSVP`, `ReaderContext`)

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 28 | K | **Timer-Drift:** Der `setTimeout` pro Wort lag in einem Effekt mit `currentIndex` als Abhängigkeit – jede Verzögerung (Render, Timer-Jitter) addierte sich. | `engine/playbackEngine.ts`: Anker + Soll-Dauer (driftfrei); bei >250 ms Verspätung wird neu verankert statt „aufzuholen“. |
| 29 | H | Ein Re-Render des gesamten Baums pro Wort (`useReader()` überall). | Synchroner Store + `useSyncExternalStore`-Selektoren; Komponenten abonnieren nur, was sie brauchen. |
| 30 | H | Auto-Save als Debounce, der während der Wiedergabe nie feuerte (Timer wird bei jedem Wort neu gestartet); `beforeunload` mit asynchronem Speichern. | `useProgress`: Debounce **plus** Max-Wait, Flush bei `pagehide`/Unmount; Speichern erst nach dem Lesen des alten Standes. |
| 31 | M | Wiedergabe lief im Hintergrund-Tab weiter / sprang nach Drosselung. | Automatische Pause bei `visibilitychange`; kein Zeitraffer. |
| 32 | M | `PLAY` am Textende, `PAUSE` ohne Wirkung, Ende des Bereichs nicht sauber (`isFinished`). | Reducer mit `ADVANCE`/`isFinished`, definierte Randfälle (getestet). |
| 33 | M | ORP wurde auf dem ersten Zeichen inkl. Satzzeichen berechnet; Emoji wurden zerschnitten. | Codepoint-basiert, Satzzeichen zählen nicht zur Wortlänge. |

### 1.6 Speicher, Persistenz, UI

| # | Sev. | Befund | Behebung |
|---|------|--------|----------|
| 34 | H | `generateDocumentId` summierte Zeichencodes → Kollisionen („ab“ = „ba“), Fortschritte überschrieben sich. | cyrb53-Hash über Titel, Typ und Inhalts-Fingerabdruck. |
| 35 | H | Read-Modify-Write auf `chrome.storage` ohne Serialisierung → verlorene Updates. | Schreibwarteschlange in `utils/storage.ts`; Validierung/Bereinigung aller gelesenen Daten. |
| 36 | M | Textansicht re-renderte bei jedem Wortwechsel mit dem gesamten Kontext-Zustand. | `react-virtuoso` mit stabilen `components`, memoisierte Zeilen, Zeilenmodell (`viewerRows`) mit O(log n) Wort→Zeile, Event-Delegation. |
| 37 | M | `window.alert` bei falschem Dateityp (blockiert, nicht testbar). | Inline-Fehlermeldung (`role="alert"`). |
| 38 | M | Kein Error Boundary; Fehler im Viewer rissen die App mit. | `ErrorBoundary`; ePub-Viewer fällt bei Fehlern auf die Textansicht zurück. |
| 39 | M | Doppelter Code (`useTextSelection`, `useContextShortcuts`, `selection/*`, `PDFViewer`) und tote Pfade. | Entfernt/zusammengeführt (`useViewerSelection`, `WordViewer`). |

> Im Zuge der E2E-Prüfung im echten Chromium wurden zusätzlich zwei Fehler der Neuimplementierung gefunden und behoben:
> das Kontextmenü schloss sich sofort nach dem Öffnen (Klick-Reihenfolge), und der Textviewer hatte durch Padding auf dem
> Virtuoso-Scroller einen horizontalen Überlauf. Außerdem überschrieb unlayered CSS (`button { background: transparent }`)
> Tailwind-Utilities – das gesamte Basis-CSS liegt nun in `@layer base`.

## 2. Architekturentscheidungen

* **Ein Takt, ein Store.** `PlaybackEngine` liest/schreibt einen synchronen Store (`readerStore`) – kein Wettlauf mit React-Renderzyklen.
  Die Uhr ist injizierbar (`Clock`), daher deterministisch testbar.
* **Reiner Reducer.** `readerReducer` enthält alle Zustandsübergänge ohne Seiteneffekte; Randfälle sind einzeln getestet.
* **Wortliste = DOM-Zerlegung.** Für ePub erzeugt dieselbe Funktion (`collectDomWords`) die Wörter im Parser und die Textpositionen im Viewer.
* **Seiten-Extraktion ohne Content Script.** `extractPageInPage` ist eine in sich geschlossene Funktion (Chrome serialisiert nur ihren
  Quelltext). Ein Paritätstest stellt sicher, dass sie dieselben Wörter liefert wie die gemeinsame Extraktion in `htmlText.ts`.
* **Ressourcenbesitz an einer Stelle.** `ReaderContext` hält das aktuelle ePub und das geöffnete PDF (`getPdf/setPdf`) und gibt
  sie bei jedem Wechsel/Unmount frei. Schlägt das Einlesen eines PDFs fehl, wird es sofort zerstört.
* **PDF-Originalansicht (`PDFPageViewer`, `usePdfViewer`, `PdfPage`).** Die Seiten werden mit pdf.js auf Canvas gerendert (Layout,
  Bilder, Grafiken) und mit dem pdf.js-Textlayer überlagert. Gerendert werden nur sichtbare Seiten ± 1 (bekannte Seitengrößen →
  stabiles Scrollen). Die RSVP-Wörter werden pro gerenderter Seite per Zeichenabgleich (`utils/pdfAlign`) den Textlayer-Items
  zugeordnet; das funktioniert, weil die Wortliste die Reihenfolge der pdf.js-Items beibehält. Hervorhebung über die CSS Custom
  Highlight API (`rsvp-current`, `rsvp-range`), Klick/Markieren über dieselben Wort-Helfer wie beim ePub (`epubWordMap`).
  Seiten ohne zuordenbaren Text (Scans) werden angezeigt, aber nicht hervorgehoben; die Textansicht bleibt per Umschalter erreichbar.
* **pdf.js-Legacy-Build.** Der normale Build nutzt `Map.prototype.getOrInsertComputed` (nur in sehr neuen Chrome-Versionen) und
  rendert in Chrome < ~145 keine Seiten. Der Legacy-Build bringt die Polyfills mit und passt zu `minimum_chrome_version: 110`.
* **Minimale Berechtigungen.** `activeTab`, `storage`, `scripting`; keine Host-Berechtigungen, keine Content Scripts, keine `web_accessible_resources`.

## 3. Finale Ordnerstruktur

```
lese_maze/
├── manifest.config.ts            # MV3-Manifest (typisiert; Version aus package.json)
├── vite.config.ts                # @crxjs, Tailwind 4, manualChunks, Reader-Input
├── vitest.config.ts
├── eslint.config.js              # ESLint 9 Flat Config (typescript-eslint, react-hooks v7)
├── tsconfig.json / tsconfig.node.json
├── index.html                    # Dev-Einstiegsseite
├── scripts/copy-pdfjs-assets.mjs # kopiert pdf.js-CMaps, Standardschriften, WASM und ICC nach public/pdfjs/
├── public/icons/                 # Extension-Icons
├── .github/workflows/build.yml   # CI: Typecheck, Lint, Tests, Build, Artefakt
├── docs/REFACTORING.md
└── src/
    ├── background/
    │   ├── service-worker.ts     # Listener, Absenderprüfung, Antwort-Garantie
    │   ├── handlers.ts           # READ_CURRENT_PAGE, OPEN_READER, Session-Storage-Pflege
    │   └── pageExtractor.ts      # in die Seite injizierte Extraktionsfunktion
    ├── engine/
    │   ├── playbackEngine.ts     # driftfreier Takt
    │   └── readerStore.ts        # synchroner Store um den Reducer
    ├── contexts/
    │   ├── readerReducer.ts      # reiner Reducer
    │   ├── ReaderContext.tsx     # Provider, Selektor-Hooks, Dokument-Ressourcen, Settings-Persistenz
    │   └── ThemeContext.tsx
    ├── hooks/                    # useRSVP, usePDFParser, useEPubParser, useEPubViewer, usePageContent,
    │                             # useProgress, useKeyboardShortcuts, useViewerSelection, useContextMenu, usePdfViewer
    ├── utils/                    # pdfjs, pdfText, htmlText, epubParse, epubWordMap, cleanText, textProcessor,
    │                             # orpCalculator, viewerRows, pdfAlign, storage, messaging
    ├── types/                    # index.ts (Zustand), messages.ts (Nachrichtenprotokoll)
    ├── components/               # RSVPDisplay, PlaybackControls, EPubViewer, PDFViewer, PDFPageViewer, …
    │   ├── pdf/                  # PdfPage (Canvas + Textlayer einer Seite)
    │   ├── viewer/               # WordViewer (virtualisiert), DocumentTextView
    │   └── shared/               # DocumentSelector, ViewerContextMenu, ViewerToolbar, LoadingState
    ├── ads/                      # Werbe-Schnittstelle (aus im Standard-Build): Config, Regeln, Feed, Store
    ├── popup/                    # Popup (PDF/ePub/Seite, zuletzt gelesen)
    ├── reader/                   # Reader-Tab: Quellenwahl, RSVP-Panel, Resume-Hinweis
    ├── styles/index.css          # Tailwind 4, Basis-CSS in @layer base
    └── __tests__/                # 17 Testdateien, 283 Tests
```

## 4. Änderungen an Manifest, Vite und Dependencies

### manifest (`manifest.config.ts` → `dist/manifest.json`)

```diff
- "content_scripts": [{ "matches": ["<all_urls>"], "js": ["src/content/content.ts"] }],
- "web_accessible_resources": [{ "resources": ["src/reader/index.html", "assets/*.mjs", "assets/*.js"], "matches": ["<all_urls>"] }],
+ "minimum_chrome_version": "110",
+ "content_security_policy": {
+   "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; base-uri 'self'; form-action 'none'"
+ },
  "permissions": ["activeTab", "storage", "scripting"]   // unverändert
```

### `vite.config.ts`

* Manifest aus `manifest.config.ts` (`defineManifest`) statt `public/manifest.json`.
* `build.target: 'chrome110'`, Rollup-Input nur `reader`, `manualChunks` als Funktion (`pdfjs`, `epub`, `virtuoso`, `react-vendor`).
* Entfernt: `optimizeDeps.include`, Dev-Input `index.html`.

### Dependencies

| Änderung | Paket |
|----------|-------|
| entfernt | `react-native` |
| von `dependencies` nach `devDependencies` | `tailwindcss`, `@tailwindcss/vite` |
| entfernt | `@types/jsdom` |
| neu (dev) | `@types/node`, `@vitest/coverage-v8`, `typescript-eslint` |
| gepinnt | `vitest` und `@vitest/coverage-v8` auf `~4.0.18` (verhindert Peer-Konflikte beim Installieren) |

## 5. Verifikation

* `npm run check`: Typecheck (App + Node-Config), ESLint (0 Meldungen), 283 Unit-/Komponententests – alle grün.
* `npm run build`: fehlerfrei; `dist/` enthält Manifest, Service-Worker-Loader, Reader/Popup, pdf.js-Worker sowie CMaps, Standardschriften, WASM- und ICC-Dateien (`dist/pdfjs/`).
* Ende-zu-Ende in echtem Chromium (Playwright, `--load-extension`, Xvfb) – 23 Prüfungen, alle bestanden:
  PDF-Import (Entsilbung, keine Seitenzahlen), Wiedergabetakt (Ø 104 ms bei 600 WPM, kein Drift), ePub-Rendering,
  Hervorhebung über Kapitelgrenzen, Klick-auf-Wort, Dark Mode, Freigabe der Iframes nach „Zurück“, „Seite lesen“-Fluss
  (Popup → Service Worker → Reader), Ablehnung geschützter Seiten und ungültiger Nachrichten, keine Konsolenfehler.
* PDF-Originalansicht, ebenfalls in echtem Chromium (23 + 57 Stichproben, keine Konsolenfehler): Seiten mit Bild, Farbkasten,
  Linien und zwei Spalten werden korrekt gerendert (Pixelprüfung), die Hervorhebung stimmt über Seitengrenzen, nach Zoom, bei
  gedrehten Seiten und bei Seiten ohne Text mit dem RSVP-Wort überein; Klick auf Wort, Markieren → Kontextmenü → Lesebereich,
  Seitensprung, „Zur aktuellen Stelle“, Abdunkeln, Umschalter Original/Text und Freigabe der Canvas nach „Zurück“.
* Nicht automatisiert prüfbar: der echte Klick auf das Toolbar-Symbol (aktiviert `activeTab`). Im E2E-Lauf wurde dafür eine
  Kopie des Builds mit `host_permissions: http://localhost/*` verwendet; der Produktions-Build enthält diese Berechtigung nicht.
