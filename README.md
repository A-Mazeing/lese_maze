# Lese Maze – RSVP Speed Reader

Chrome-Erweiterung (Manifest V3) zum Schnelllesen von **PDF-, ePub- und Webseiten-Inhalten** mit der RSVP-Methode
(Rapid Serial Visual Presentation): Wörter erscheinen einzeln an einer festen Position, der Fixationspunkt (ORP) ist markiert.

## Funktionen

- RSVP-Anzeige mit ORP, 50–1500 WPM (Regler 100–1000), 1–4 Wörter pro Anzeige, sanfter Start, „Satz bei Pause“
- Driftfreier Takt, automatische Pause, wenn der Tab verdeckt wird
- PDF: Text mit Zeilen-/Absatzerkennung, Entsilbung, Entfernung von Seitenzahlen
- PDF-Originalansicht: Die Seiten werden wie im Browser dargestellt (Layout, Bilder, Grafiken, Spalten). Das aktuelle RSVP-Wort wird im Seitenbild hervorgehoben und läuft mit; Klick auf ein Wort, Markieren (Start/Ende/Bereich), Zoom, Seitennavigation und Abdunkeln. Umschalter „Original | Text“ für die reine Wortliste
- ePub: Buchansicht mit mitlaufender Hervorhebung, Kapitelnavigation, Klick auf ein Wort springt dorthin
- Webseiten: Hauptinhalt oder markierter Text („Aktuelle Seite lesen“ im Popup)
- Lesebereich per Textauswahl (Start, Ende, Bereich), Sprung zu Satz/Absatz, Tastaturkürzel (Übersicht im Reader)
- Lesefortschritt je Dokument, Hell-/Dunkelmodus
- Oberfläche auf Englisch (Standard) und Deutsch, umschaltbar im Popup und im Reader
- Lange Wörter und mehrere Wörter pro Anzeige werden automatisch so skaliert, dass nichts abgeschnitten wird
- Dezente Spendenlinks (Ko-fi, Buy Me a Coffee) und ein gekennzeichneter, ausblendbarer Affiliate-Buchtipp im Popup (nur wenn im Build konfiguriert, siehe `.env.example` und `docs/PUBLISHING.md`)
- Optionale Werbe-Schnittstelle (im Standard-Build aus; nie während des Lesens, mit Ausblenden-Schalter) – siehe `docs/PUBLISHING.md`
- Datenschutz: keine Content Scripts, keine Host-Berechtigungen; alle Daten bleiben lokal

## Entwicklung

Voraussetzung: Node.js ≥ 20.

```bash
npm ci
npm run dev          # Vite-Dev-Server mit HMR (Erweiterung aus dist/ laden)
npm run check        # Typecheck + ESLint + Tests
npm run build        # Produktions-Build nach dist/
```

## Installation im Browser

1. `npm run build`
2. In Chrome `chrome://extensions` öffnen, **Entwicklermodus** aktivieren
3. **Entpackte Erweiterung laden** → Ordner `dist/` wählen

## Aufbau

Siehe [docs/REFACTORING.md](docs/REFACTORING.md) für Architektur, Ordnerstruktur und die Liste der behobenen Mängel.

```
src/background   Service Worker (Nachrichten, Seiten-Extraktion)
src/engine       Wiedergabe-Takt und Store
src/contexts     Reducer, Provider, Theme
src/hooks        Parser, Viewer, Fortschritt, Tastatur
src/utils        PDF-/HTML-Textextraktion, Storage, Messaging
src/i18n         Sprachschicht (en/de)
src/support      Spenden- und Affiliate-Konfiguration, Buchtipps
src/ads          Werbe-Schnittstelle
src/components   UI (RSVP, Viewer, Auswahl)
src/popup        Erweiterungs-Popup
src/reader       Reader-Tab
```

## Berechtigungen

| Berechtigung | Zweck |
|--------------|-------|
| `activeTab` + `scripting` | Text der aktuellen Seite lesen, nur nach Klick auf das Erweiterungssymbol |
| `storage` | Einstellungen und Lesefortschritt (lokal), Zwischenablage für Seiteninhalt (Session, 5 min) |

## Lizenz

Siehe Repository.
