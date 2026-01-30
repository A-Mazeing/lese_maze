# Lese Maze - RSVP Speed Reader

Eine moderne Browser Extension für schnelles Lesen mit der RSVP-Methode (Rapid Serial Visual Presentation). Lese Maze ermöglicht es, PDFs und ePub-Dateien mit deutlich erhöhter Geschwindigkeit zu lesen, indem Wörter einzeln und nacheinander angezeigt werden.

## Features

### RSVP Speed Reading
- **Rapid Serial Visual Presentation**: Wörter werden einzeln in schneller Folge angezeigt
- **Anpassbare Geschwindigkeit**: Flexibel einstellbare Lesegeschwindigkeit (WPM - Words Per Minute)
- **ORP-Technologie**: Optimal Recognition Point für bessere Lesbarkeit und Fokus
- **Pausieren & Fortsetzen**: Volle Kontrolle über den Lesefluss

### Unterstützte Formate
- **PDF-Dateien**: Vollständige PDF-Unterstützung mit Text-Extraktion
- **ePub-Dateien**: Native ePub-Unterstützung für E-Books
- **Web-Inhalte**: Textauswahl auf beliebigen Webseiten

### Benutzerfreundlichkeit
- **Keyboard Shortcuts**: Schnelle Navigation und Steuerung per Tastatur
- **Dark/Light Mode**: Unterstützung für helle und dunkle Themes
- **Fortschrittsanzeige**: Tracking des Lesefortschritts
- **Content Preview**: Vorschau und Navigation durch Dokumente

### Technische Features
- **Service Worker**: Moderne Browser Extension Architektur
- **Context Isolation**: Sichere Content Scripts
- **Virtualisierte Listen**: Performance-optimierte Darstellung großer Dokumente
- **TypeScript**: Vollständig typsicher entwickelt

## Installation

### Für Entwickler

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd lese_maze
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Extension bauen**
   ```bash
   npm run build
   ```

4. **In Chrome laden**
   - Öffne `chrome://extensions/`
   - Aktiviere "Entwicklermodus" (oben rechts)
   - Klicke auf "Entpackte Erweiterung laden"
   - Wähle den `dist`-Ordner aus dem Projekt

### Als Extension installieren (nach Release)
- Installiere direkt aus dem Chrome Web Store (Link folgt nach Veröffentlichung)

## Entwicklung

### Entwicklungsserver starten
```bash
npm run dev
```
Startet den Vite Development Server mit Hot Module Replacement.

### Build erstellen
```bash
npm run build
```
Erstellt eine optimierte Production-Build im `dist`-Ordner.

### Tests ausführen
```bash
# Tests im Watch-Modus
npm run test

# Tests einmalig ausführen
npm run test:run

# Tests mit Coverage
npm run test:coverage
```

### Linting
```bash
npm run lint
```

## Technologie-Stack

### Core
- **React 19.2** - UI Framework
- **TypeScript 5.9** - Type Safety
- **Vite 7.2** - Build Tool & Dev Server

### Browser Extension
- **@crxjs/vite-plugin** - Chrome Extension Development
- **Chrome Extension Manifest V3** - Moderne Extension API

### UI & Styling
- **Tailwind CSS 4.1** - Utility-First CSS Framework
- **React Virtuoso** - Virtualisierte Listen für Performance

### Document Parsing
- **pdfjs-dist 5.4** - PDF Rendering und Text-Extraktion
- **epubjs 0.3** - ePub Parsing und Rendering

## Projektstruktur

```
lese_maze/
├── public/
│   ├── manifest.json          # Chrome Extension Manifest
│   └── icons/                 # Extension Icons
├── src/
│   ├── background/            # Service Worker
│   ├── content/               # Content Scripts
│   ├── popup/                 # Extension Popup UI
│   ├── reader/                # RSVP Reader Komponenten
│   ├── components/            # Wiederverwendbare UI Komponenten
│   ├── contexts/              # React Contexts (Theme, Reader)
│   ├── hooks/                 # Custom React Hooks
│   │   ├── useRSVP.ts        # RSVP Logic
│   │   ├── usePDFParser.ts   # PDF Parsing
│   │   ├── useEPubParser.ts  # ePub Parsing
│   │   └── ...
│   ├── utils/                 # Utility Functions
│   │   ├── textProcessor.ts  # Text Processing
│   │   ├── orpCalculator.ts  # ORP Berechnung
│   │   └── storage.ts        # Chrome Storage API
│   ├── types/                 # TypeScript Type Definitions
│   └── __tests__/             # Test Files
├── dist/                      # Build Output (generiert)
└── package.json
```

## Verwendung

1. **Extension öffnen**: Klicke auf das Extension-Icon in der Chrome Toolbar
2. **Dokument auswählen**: Wähle eine PDF- oder ePub-Datei aus
3. **Geschwindigkeit anpassen**: Stelle die gewünschte WPM ein
4. **Lesen starten**: Drücke Play und genieße das schnelle Lesen
5. **Keyboard Shortcuts nutzen**:
   - `Space` - Pausieren/Fortsetzen
   - `←/→` - Geschwindigkeit anpassen
   - `Esc` - Reader schließen

## Autor

Maze

---

**Hinweis**: Dies ist ein Entwicklungsprojekt. Features und Funktionalität können sich ändern.
