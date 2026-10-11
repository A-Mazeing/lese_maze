# Datenschutzerklärung – Lese Maze (RSVP Speed Reader)

> Entwurf. Vor der Veröffentlichung Anbieter, Kontakt und Feed-Betreiber eintragen und rechtlich prüfen lassen.

**Anbieter:** [Name, Anschrift, E-Mail]

## Kurzfassung

Lese Maze verarbeitet die Texte, die du lesen willst, **ausschließlich auf deinem Gerät**. Es gibt kein Benutzerkonto, keine
Analyse- oder Tracking-Dienste und keine Weitergabe deiner Texte.

## Welche Daten verarbeitet die Erweiterung?

| Daten | Zweck | Wo | Weitergabe |
|-------|-------|----|-----------|
| Inhalt von PDF-/ePub-Dateien, die du öffnest | Anzeige und RSVP-Lesen | nur im Arbeitsspeicher des Browsers | keine |
| Text der aktuellen Webseite oder Markierung, wenn du auf „Seite lesen“ klickst | RSVP-Lesen | kurzzeitig im Browser-Speicher (Session) | keine |
| Einstellungen (Tempo, Design, …) | Komfort | `chrome.storage.local` | keine |
| Lesefortschritt (Titel, Position, Zeitpunkt; max. 50 Einträge) | Weiterlesen | `chrome.storage.local` | keine |
| Werbeeinstellung und Tageszähler | Werbung ausblenden/begrenzen | `chrome.storage.local` | keine |

Der Lesefortschritt enthält den Dateinamen bzw. Seitentitel, nicht den Text. Alle lokalen Daten löschst du durch Entfernen der
Erweiterung.

## Werbung

Die Erweiterung kann gekennzeichnete Anzeigen auf der Startseite und nach dem Lesen zeigen (nie während des Lesens).
Du kannst sie jederzeit über „Werbung ausblenden“ bzw. den Schalter „Werbung anzeigen“ abschalten.

Zum Anzeigen ruft die Erweiterung eine Anzeigenliste von **[Domain des Feeds]** ab (ohne Cookies und ohne Referrer). Dabei
erhält dieser Server technisch bedingt deine **IP-Adresse** und den Zeitpunkt der Anfrage. Es werden keine Texte, Dateinamen
oder Lesedaten übertragen. Beim Klick auf eine Anzeige öffnet sich die Seite des Werbetreibenden in einem neuen Tab; dort
gilt dessen Datenschutzerklärung. [Zusatz, falls Iframe-Anzeigen eines Netzwerks verwendet werden: Anbieter, Zweck, Rechtsgrundlage.]

## Rechtsgrundlagen und Rechte (DSGVO)

Verarbeitung der IP-Adresse beim Abruf der Anzeigenliste: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der
Finanzierung des kostenlosen Angebots. Du hast Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch und
Beschwerde bei einer Aufsichtsbehörde. Kontakt: [E-Mail].

## Berechtigungen

* `activeTab`, `scripting`: Text der aktuellen Seite nur nach deinem Klick lesen.
* `storage`: lokale Speicherung der oben genannten Daten.

Die Erweiterung verkauft keine Daten, nutzt sie nicht für Werbeprofile und lädt keinen fremden Programmcode nach.
