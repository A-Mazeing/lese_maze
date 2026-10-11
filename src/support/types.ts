import type { Language } from '@/i18n';

/** Läden mit Affiliate-Programm. */
export type ShopId = 'amazon' | 'thalia' | 'bookbeat';

export interface SupportConfig {
  /** Spendenlinks (nur https auf ko-fi.com bzw. buymeacoffee.com), sonst `null`. */
  kofiUrl: string | null;
  buyMeACoffeeUrl: string | null;
  amazon: { tag: string; domain: string } | null;
  /** URL-Vorlagen der Partnerprogramme. `{query}` = Suchbegriff, `{url}` = kodierter Ziel-Link. */
  thaliaTemplate: string | null;
  bookbeatTemplate: string | null;
}

export interface BookTip {
  id: string;
  author: string;
  title: Record<Language, string>;
  /** Suchbegriff je Sprache (deutscher Titel für deutsche Shops). */
  query: Record<Language, string>;
}

export interface ShopLink {
  shop: ShopId;
  label: string;
  href: string;
}
