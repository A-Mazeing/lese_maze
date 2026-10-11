/** Stellen, an denen Werbung erscheinen darf. Nie während der Wiedergabe. */
export type AdPlacement = 'home' | 'finished';

export const AD_PLACEMENTS: readonly AdPlacement[] = ['home', 'finished'];

/** Native Anzeige: Text, optional Bild; wird von der Erweiterung selbst gezeichnet (kein Fremdcode). */
export interface NativeAd {
  kind: 'native';
  id: string;
  /** Name des Werbetreibenden. */
  sponsor: string;
  title: string;
  text: string;
  /** Beschriftung des Links, z. B. „Mehr erfahren“; leer = Standardtext der Oberfläche. */
  cta: string;
  /** Ziel (nur https). */
  href: string;
  /** Optionales Bild (nur https). */
  imageUrl?: string;
}

/**
 * Anzeige in einem Sandbox-Iframe auf einer eigenen https-Seite des Anbieters.
 * Der Chrome Web Store erlaubt fremden Code nur in solchen Iframes, nicht in der Erweiterung selbst.
 */
export interface FrameAd {
  kind: 'frame';
  id: string;
  sponsor: string;
  /** https-URL; ihr Ursprung muss in `AdConfig.frameOrigins` stehen. */
  src: string;
  /** Höhe in px (50–300). */
  height: number;
}

export type AdCreative = NativeAd | FrameAd;

export interface PlacementLimit {
  /** Höchstzahl der Einblendungen pro Kalendertag. */
  maxPerDay: number;
  /** Mindestabstand zwischen zwei Einblendungen (ms). */
  minIntervalMs: number;
}

export interface AdConfig {
  /** Hauptschalter. Standard: aus (Build-Variable `VITE_ADS_ENABLED=true`). */
  enabled: boolean;
  /** Optionaler JSON-Feed mit Anzeigen (https). Änderungen wirken ohne neue Store-Version. */
  feedUrl: string | null;
  /** Erlaubte Ursprünge für Iframe-Anzeigen, z. B. `https://ads.example.com`. */
  frameOrigins: readonly string[];
  /** Nur Entwicklung/Test: eine klar gekennzeichnete Beispielanzeige. */
  demo: boolean;
  feedTimeoutMs: number;
  limits: Record<AdPlacement, PlacementLimit>;
}

/** Gespeicherter Zustand (chrome.storage.local, Schlüssel `rsvp_ads`). */
export interface AdState {
  /** Vom Benutzer einstellbar: „Werbung anzeigen“. */
  enabled: boolean;
  /** Kalendertag der Zähler (YYYY-MM-DD, lokale Zeit). */
  day: string;
  counts: Partial<Record<AdPlacement, number>>;
  /** Zeitpunkt der letzten Einblendung je Platzierung (ms). */
  last: Partial<Record<AdPlacement, number>>;
}
