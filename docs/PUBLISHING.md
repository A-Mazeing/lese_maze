# Veröffentlichung im Chrome Web Store

Stand der Richtlinien: Oktober 2026. Die Regeln ändern sich – vor dem Einreichen die offiziellen Seiten prüfen
(<https://developer.chrome.com/docs/webstore/program-policies>). Dies ist keine Rechtsberatung.

## 1. Was vor der Veröffentlichung noch fehlt

### Pflicht (sonst Ablehnung oder Rechtsrisiko)

| Punkt | Stand | Aufgabe |
|-------|-------|---------|
| Entwicklerkonto | offen | Einmalig 5 USD, Verifizierung. Öffentliche Kontakt-E-Mail festlegen. Mit Werbung gilt man in der EU meist als „Trader“: Name, Anschrift, Telefon, E-Mail werden im Store angezeigt. |
| Datenschutzerklärung (öffentliche URL) | Entwurf in `docs/PRIVACY.md` | Auf eine Webseite stellen (z. B. GitHub Pages) und im Dashboard verlinken. Anbieter und Feed-Domain eintragen. |
| Impressum / Gewerbe / Steuer | offen | Mit Werbeeinnahmen ist das Angebot in Deutschland in der Regel gewerblich (Impressumspflicht, Gewerbeanmeldung, Einkommensteuer). Das Impressum gehört auf dieselbe Webseite wie die Datenschutzerklärung. |
| Store-Eintrag | offen | Siehe Abschnitt 2. |
| Angaben zur Datennutzung (Dashboard → „Privacy“) | Vorlage in Abschnitt 2 | Ehrlich ausfüllen; sie müssen zur Datenschutzerklärung passen. |
| Lizenz und Hinweise zu Drittsoftware | offen | `LICENSE` für den eigenen Code festlegen. pdf.js (Apache-2.0), epub.js (BSD-2), React (MIT) u. a. verlangen, dass ihre Lizenztexte beiliegen (z. B. `THIRD_PARTY_NOTICES.md`; Hilfsmittel: `npx license-checker --production`). |
| Name und Marke | prüfen | „RSVP Speed Reader“ ist generisch und kollidiert evtl. mit vorhandenen Erweiterungen; Namen im Store suchen. Keine fremden Marken im Namen. |

### Sehr empfehlenswert

* ~~Englische Oberfläche~~ – erledigt: Englisch ist Standard, Deutsch wählbar (`src/i18n/`, `public/_locales/`; siehe Abschnitt 3b).
* **Erste Schritte:** kurzer Willkommenshinweis beim ersten Start (Quelle wählen, Leertaste, Tastenkürzel).
* **Tastenkürzel und Kontextmenü:** `commands` (z. B. Alt+R: Seite lesen) und „Mit RSVP lesen“ für markierten Text
  (`contextMenus`-Berechtigung; im Store begründen).
* **Support-Adresse** (Issue-Tracker oder E-Mail) im Listing.
* **Tests auf Windows, macOS, Chrome Stable/Beta**, mit großen PDFs (> 500 Seiten) und passwortgeschützten Dateien.
* **Edge Add-ons:** dasselbe Paket lässt sich dort kostenlos einreichen.

## 2. Store-Eintrag

* Icon 128×128 (vorhanden), mindestens 1 Screenshot 1280×800 (besser 4–5: Startseite, Original-Ansicht mit Hervorhebung,
  RSVP-Ansicht, Dunkelmodus, „Seite lesen“), kleine Werbekachel 440×280, optional 1400×560.
* Kurzbeschreibung (max. 132 Zeichen), Beschreibung ohne Keyword-Spam, Kategorie „Productivity“.
* **Einzelzweck:** „Texte aus PDF, ePub und Webseiten mit der RSVP-Methode lesen.“
* **Begründung der Berechtigungen:**
  * `activeTab` + `scripting`: liest nur auf Klick den Text der aktuellen Seite bzw. die Markierung; keine dauerhaften Host-Berechtigungen.
  * `storage`: speichert Einstellungen, Lesefortschritt und den Werbeschalter lokal.
* Kein Remote-Code (alles liegt im Paket; Werbung nur als Daten bzw. im Sandbox-Iframe, siehe Abschnitt 3).
* **Angaben zur Datennutzung:** verarbeitet wird „Website-Inhalt“ (Text der gelesenen Seite) ausschließlich lokal, keine Übertragung,
  kein Verkauf, keine Nutzung für Werbung oder Kreditwürdigkeit. Wird der Werbe-Feed aktiviert, wird beim Anzeigen eine
  Anfrage (IP-Adresse) an dessen Server gesendet – in der Datenschutzerklärung nennen.

Paket: Inhalt von `dist/` zippen, sodass `manifest.json` im Zip-Stamm liegt (kein Unterordner). Version in `package.json` erhöhen
(wird ins Manifest übernommen). Windows: `Compress-Archive -Path dist\* -DestinationPath lese-maze.zip`.

## 3. Werbung

### Was der Store erlaubt (Richtlinien „Ads“ und Manifest V3)

* **AdSense darf in Erweiterungen nicht verwendet werden.** Skripte anderer Werbenetzwerke lassen sich ebenfalls nicht einbinden,
  denn Code von fremden Servern darf nicht geladen werden (alle Logik muss im Paket liegen).
* Erlaubt: **Daten** von einem Server (JSON mit Text, Link, Bild) und **Code in Sandbox-Iframes** auf einer eigenen https-Seite.
* Anzeigen müssen als solche erkennbar sein, dürfen keine Systemmeldungen imitieren, dürfen nicht zum Klicken zwingen und
  **müssen sich in den Einstellungen abschalten lassen oder durch Deinstallation verschwinden**.
* Die Anzeigen zählen zum Produkt: Inhalte müssen den Inhaltsrichtlinien entsprechen. Für Affiliate-Links gibt es eine eigene
  Richtlinie („Affiliate Ads“): Offenlegung, und die Erweiterung muss auch ohne die Links Nutzen bieten.

### Was die App jetzt mitbringt (`src/ads/`)

Eine **anbieterneutrale Schnittstelle**. Im normalen Build ist sie **aus**: kein Netzwerkzugriff, keine Anzeige, kein Schalter.

* **Platzierungen** (bewusst nur Momente ohne Lesefluss):
  1. `home`: Startseite unter der Quellenwahl.
  2. `finished`: nach dem Ende des Lesens, unter der RSVP-Anzeige.
  Nie während der Wiedergabe, nie als Overlay/Zwischenseite, nie im Popup. Beim Start der Wiedergabe verschwindet sie sofort.
* **Begrenzung** (`src/ads/config.ts`): Startseite höchstens 20×/Tag; „Ende des Lesens“ höchstens 3×/Tag mit 10 Min. Abstand.
* **Kennzeichnung** „Anzeige · Name des Werbetreibenden“ und Knopf **„Werbung ausblenden“**; dauerhafter Schalter
  „Werbung anzeigen“ am unteren Rand (Pflicht laut Richtlinie, zugleich Komfort).
* **Datenschutz:** keine Cookies, kein Referrer, kein Tracking; Zähler (Tageslimit) nur lokal. Links öffnen mit
  `rel="noopener noreferrer sponsored nofollow"`.
* **Sicherheit:** Der Feed wird streng geprüft (nur https, Längenlimits, keine Zugangsdaten in URLs, max. 64 KB, max. 20 Anzeigen,
  4 s Zeitlimit; Fehler → einfach keine Anzeige). Iframe-Anzeigen laufen mit `sandbox` **ohne** `allow-same-origin`
  und nur von freigegebenen Ursprüngen.
* **Geprüft in Chromium:** Anzeige auf Startseite und am Ende, keine während der Wiedergabe, Ausblenden/Einschalten bleibt
  nach Neuladen erhalten, Feed-Abruf ohne Cookies/Referrer, Iframe-Anzeige läuft im Sandbox und hat keinen Zugriff auf die Erweiterung.

### Einschalten (nur im Store-Build)

Datei `.env.production` (nicht einchecken) oder Umgebungsvariablen beim Build:

```
VITE_ADS_ENABLED=true
VITE_ADS_FEED_URL=https://ads.deine-domain.de/feed.json
VITE_ADS_FRAME_ORIGINS=https://ads.deine-domain.de      # nur für Iframe-Anzeigen
```

`VITE_ADS_DEMO=true` zeigt eine gekennzeichnete Beispielanzeige (nur Entwicklung/Test, nie im Store-Build).

Feed (`feed.json`); er ändert Anzeigen ohne neue Store-Version:

```json
{
  "ads": [
    {
      "id": "buchshop-2026-10",
      "sponsor": "Buchshop GmbH",
      "title": "E-Books ab 0,99 €",
      "text": "Stöbere in über 100.000 Titeln und lies sie direkt mit Lese Maze.",
      "cta": "Zum Angebot",
      "href": "https://buchshop.example/aktion?utm_source=lesemaze",
      "imageUrl": "https://buchshop.example/img/aktion.png"
    },
    { "kind": "frame", "id": "netz-1", "sponsor": "Netzwerk X", "src": "https://ads.deine-domain.de/slot.html", "height": 90 }
  ]
}
```

Server-Anforderungen: HTTPS, `Access-Control-Allow-Origin: *`, `Content-Type: application/json; charset=utf-8` (bei HTML-Seiten
für Iframes ebenfalls `charset=utf-8`); Iframe-Seiten dürfen nicht per `X-Frame-Options` gesperrt sein. Bei mehreren Anzeigen
wird reihum gewechselt.

### Wo sich Werbung noch anbietet (ohne zu nerven)

* **Direkt vermittelte oder eigene Anzeigen** (Buchshops, Lern- und Leseangebote, Hörbücher): hohe Relevanz, kein Netzwerk nötig.
  Mit dieser Schnittstelle sofort möglich.
* **Affiliate-Links zu E-Books**: umgesetzt als gekennzeichneter Buchtipp im Popup (Abschnitt 3a).
* **Werbenetzwerke** nur über eine eigene Webseite im Sandbox-Iframe (`kind: "frame"`) und nur, wenn deren Bedingungen
  Erweiterungen zulassen – vorher beim Anbieter nachfragen (bei AdSense nicht möglich).
* Nicht empfehlenswert: Popup, Anzeigen während des Lesens, Zwischenseiten, Anzeigen auf fremden Webseiten (Risiko eines Richtlinienverstoßes).

### Alternativen und Ergänzungen zur Werbung

* Spendenlink (Ko-fi, Buy Me a Coffee): umgesetzt im Popup (Abschnitt 3a); zusätzlich im Store-Eintrag erwähnbar.
* **Pro-Version / werbefrei** per Einmalkauf: Der Store hat sein eigenes Bezahlsystem eingestellt; üblich sind Stripe, Lemon
  Squeezy oder Dienste wie ExtensionPay. Ein Lizenzstatus lässt sich zentral in `src/ads/policy.ts` einbinden
  (z. B. `config.enabled && state.enabled && !licensed`).

## 3a. Spenden und Affiliate-Buchtipps im Popup

Beides liegt in `src/support/` bzw. `src/components/support/SupportSection.tsx` und erscheint **nur, wenn es im Build
konfiguriert ist** (ohne Variablen bleibt das Popup unverändert). Die Variablen stehen in `.env.example`.

| Variable | Wirkung |
|----------|---------|
| `VITE_SUPPORT_KOFI_URL`, `VITE_SUPPORT_BMC_URL` | Spendenlinks. Nur `https://ko-fi.com/…` bzw. `https://(www.)buymeacoffee.com/…` werden akzeptiert. |
| `VITE_AFFILIATE_AMAZON_TAG`, `VITE_AFFILIATE_AMAZON_DOMAIN` | Amazon-Partner-ID und Marktplatz (Standard `amazon.de`). Link: `https://www.amazon.de/s?k=<Titel>&tag=<ID>`. |
| `VITE_AFFILIATE_THALIA_TEMPLATE`, `VITE_AFFILIATE_BOOKBEAT_TEMPLATE` | Deeplink-Vorlage des Partnerprogramms (meist über Awin). `{url}` wird durch die kodierte Suchseite des Shops ersetzt, `{query}` durch den kodierten Suchbegriff. Ohne gültige Vorlage erscheint der Shop nicht (ohne Partner-ID wäre es auch kein Affiliate-Link). |

**Transparenz (bewusst eingebaut, nicht abschalten):**

* Der Buchtipp ist als „Anzeige · Buchtipp“ (en: „Ad · Book tip“) gekennzeichnet und enthält den Hinweis, dass bei einem Kauf eine
  Provision anfällt und der Preis gleich bleibt. Bei Amazon steht zusätzlich der vorgeschriebene Satz „Als Amazon-Partner verdiene ich
  an qualifizierenden Verkäufen.“ Links tragen `rel="sponsored noopener noreferrer"`, haben sichtbare Shop-Namen und öffnen erst auf Klick
  in einem neuen Tab. Es wird nichts vorgeladen, kein Link auf Webseiten verändert, kein Cookie gesetzt.
* Die Auswahl ist handverlesen (`src/support/books.ts`, ein Tipp pro Tag) und nutzt keine Lesedaten – es wird nichts übertragen.
* „Ausblenden“ entfernt den Tipp dauerhaft (lokal gespeichert, jederzeit wieder einblendbar). Die Spendenlinks sind keine Werbung.

**Vor dem Einsatz klären:**

1. Bei den Programmen anmelden (Amazon PartnerNet, Thalia und Bookbeat meist über Awin) und die Erweiterung dort als Werbefläche
   angeben. Die Programmbedingungen ausdrücklich lesen: Amazon beschränkt, wo Links stehen dürfen (Webseiten und genehmigte Apps),
   und verlangt Kennzeichnung sowie ein Konto mit tatsächlicher Webseite. Eine Erweiterung ist ein Grenzfall – am besten
   die Webseite zur Erweiterung (mit Datenschutzerklärung) im Konto hinterlegen und den Support fragen. Die Standardziele der
   Suchseiten (`THALIA_SEARCH`, `BOOKBEAT_SEARCH` in `src/support/config.ts`) vor dem Einsatz prüfen und bei Bedarf anpassen.
2. Chrome Web Store: Affiliate-Links sind erlaubt, wenn sie offengelegt sind und die Erweiterung ihren Hauptzweck behält; keine
   Veränderung von Links auf fremden Seiten (ist hier ausgeschlossen). Im Eintrag „Enthält Werbung / Affiliate-Links“ erwähnen.
3. Deutschland: Als Werbung kennzeichnen (erfüllt), Impressum und Datenschutzerklärung auf der Projektseite, Einnahmen sind steuerpflichtig.
4. Spendenanbieter prüfen (Ko-fi und Buy Me a Coffee sind externe Seiten mit eigener Datenschutzerklärung; beim Klick verlässt der Nutzer die App).

## 3b. Sprache

Englisch ist die Standardsprache, Deutsch ist über den Umschalter („EN | DE“) im Popup und im Reader wählbar. Die Wahl wird unter
`rsvp_language` gespeichert und wirkt sofort in allen offenen Erweiterungsseiten (auch Fehlermeldungen des Service Workers).
Texte: `src/i18n/en.ts` (Quelle, definiert die Schlüssel) und `src/i18n/de.ts` (vom Typ her vollständig; ein Test prüft Schlüssel
und Platzhalter). Name, Beschreibung und Symbol-Tooltip des Stores liegen in `public/_locales/{en,de}/messages.json` (folgen der
Chrome-Sprache). Weitere Sprache: Datei ergänzen, `Language`/`LANGUAGES`/`MESSAGES` in `src/i18n/index.ts` erweitern.

## 4. Checkliste vor dem Einreichen

- [ ] `npm run check` und `npm run build` fehlerfrei; Version erhöht
- [ ] Store-Build mit den gewünschten `VITE_ADS_*`-, `VITE_SUPPORT_*`- und `VITE_AFFILIATE_*`-Variablen, ohne `VITE_ADS_DEMO`
- [ ] Affiliate-Programme angemeldet, Bedingungen gelesen, Links einmal von Hand getestet (Provision wird getrackt)
- [ ] Datenschutzerklärung und Impressum online, URL im Dashboard
- [ ] Datennutzung, Einzelzweck und Berechtigungs-Begründungen ausgefüllt
- [ ] Screenshots, Kachel, Beschreibungen (de/en)
- [ ] Lizenz- und Drittsoftware-Hinweise im Repo
- [ ] Auf frischem Chrome-Profil als „Entpackte Erweiterung“ getestet (PDF, ePub, Seite lesen, Werbung ein/aus)
- [ ] Zip mit `manifest.json` im Stamm hochgeladen; zuerst „Nicht gelistet“ zum Testen möglich
