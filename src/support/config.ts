import type { Language } from '@/i18n';
import { BOOK_TIPS } from './books';
import type { BookTip, ShopLink, SupportConfig } from './types';

const text = (env: Record<string, unknown>, key: string): string =>
  typeof env[key] === 'string' ? (env[key] as string).trim() : '';

/** Akzeptiert nur https-URLs auf den angegebenen Hosts (inkl. `www.`). */
function pickHttpsUrl(value: string, hosts: readonly string[]): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./, '');
    return hosts.includes(host) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Vorlage muss eine https-URL sein und `{query}` oder `{url}` enthalten, sonst wäre es kein Suchlink. */
function pickTemplate(value: string): string | null {
  if (!value.startsWith('https://')) return null;
  return value.includes('{query}') || value.includes('{url}') ? value : null;
}

/**
 * Liest Spenden- und Affiliate-Konfiguration aus Build-Variablen (`VITE_SUPPORT_*`,
 * `VITE_AFFILIATE_*`). Was nicht gesetzt oder ungültig ist, wird nicht angezeigt.
 */
export function readSupportConfig(env: Record<string, unknown>): SupportConfig {
  const tag = text(env, 'VITE_AFFILIATE_AMAZON_TAG');
  const domain = text(env, 'VITE_AFFILIATE_AMAZON_DOMAIN') || 'amazon.de';
  return {
    kofiUrl: pickHttpsUrl(text(env, 'VITE_SUPPORT_KOFI_URL'), ['ko-fi.com']),
    buyMeACoffeeUrl: pickHttpsUrl(text(env, 'VITE_SUPPORT_BMC_URL'), ['buymeacoffee.com']),
    amazon: /^[\w-]{3,40}$/.test(tag) && /^amazon\.[a-z]{2,3}(\.[a-z]{2})?$/.test(domain) ? { tag, domain } : null,
    thaliaTemplate: pickTemplate(text(env, 'VITE_AFFILIATE_THALIA_TEMPLATE')),
    bookbeatTemplate: pickTemplate(text(env, 'VITE_AFFILIATE_BOOKBEAT_TEMPLATE')),
  };
}

export const SUPPORT_CONFIG: SupportConfig = readSupportConfig(import.meta.env as Record<string, unknown>);

/** Such-Seiten der Läden; das Partnerprogramm leitet per `{url}` darauf weiter. */
const THALIA_SEARCH = 'https://www.thalia.de/suche?sq=';
const BOOKBEAT_SEARCH = 'https://www.bookbeat.de/suche?query=';

function fillTemplate(template: string, searchBase: string, query: string): string {
  const target = `${searchBase}${encodeURIComponent(query)}`;
  return template.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{query}', encodeURIComponent(query));
}

export function hasAffiliateLinks(config: SupportConfig): boolean {
  return Boolean(config.amazon || config.thaliaTemplate || config.bookbeatTemplate);
}

export function hasDonationLinks(config: SupportConfig): boolean {
  return Boolean(config.kofiUrl || config.buyMeACoffeeUrl);
}

/** Offene, sichtbare Links – nur für konfigurierte Läden, ohne Weiterleitung über Dritte außer dem Partnerprogramm. */
export function buildShopLinks(config: SupportConfig, book: BookTip, language: Language): ShopLink[] {
  const query = book.query[language];
  const links: ShopLink[] = [];
  if (config.amazon) {
    const { domain, tag } = config.amazon;
    links.push({
      shop: 'amazon',
      label: 'Amazon',
      href: `https://www.${domain}/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`,
    });
  }
  if (config.thaliaTemplate) {
    links.push({ shop: 'thalia', label: 'Thalia', href: fillTemplate(config.thaliaTemplate, THALIA_SEARCH, query) });
  }
  if (config.bookbeatTemplate) {
    links.push({ shop: 'bookbeat', label: 'Bookbeat', href: fillTemplate(config.bookbeatTemplate, BOOKBEAT_SEARCH, query) });
  }
  return links;
}

/** Tipp des Tages: wechselt täglich, ist aber für alle Seiten am selben Tag gleich (kein Zufall, keine Nutzerdaten). */
export function pickBookTip(now: number, books: readonly BookTip[] = BOOK_TIPS): BookTip {
  const dayNumber = Math.floor(now / 86_400_000);
  return books[((dayNumber % books.length) + books.length) % books.length];
}
