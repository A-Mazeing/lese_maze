import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportSection } from '@/components/support/SupportSection';
import { useFitToWidth } from '@/hooks/useFitToWidth';
import { resetLanguageForTests, setLanguage } from '@/i18n';
import { BOOK_TIPS } from '@/support/books';
import { buildShopLinks, pickBookTip, readSupportConfig } from '@/support/config';
import { resetSupportStoreForTests } from '@/support/supportStore';

const FULL = readSupportConfig({
  VITE_SUPPORT_KOFI_URL: 'https://ko-fi.com/leseMaze',
  VITE_SUPPORT_BMC_URL: 'https://www.buymeacoffee.com/leseMaze',
  VITE_AFFILIATE_AMAZON_TAG: 'lesemaze-21',
  VITE_AFFILIATE_THALIA_TEMPLATE: 'https://partner.example.com/c?id=1&ued={url}',
  VITE_AFFILIATE_BOOKBEAT_TEMPLATE: 'https://partner.example.com/b?id=2&q={query}',
});

beforeEach(() => {
  resetLanguageForTests('en');
  resetSupportStoreForTests();
});
afterEach(() => {
  resetLanguageForTests('en');
  resetSupportStoreForTests();
});

describe('readSupportConfig', () => {
  it('is empty without variables', () => {
    expect(readSupportConfig({})).toEqual({
      kofiUrl: null,
      buyMeACoffeeUrl: null,
      amazon: null,
      thaliaTemplate: null,
      bookbeatTemplate: null,
    });
  });

  it('accepts only https links on the expected donation hosts', () => {
    const c = readSupportConfig({
      VITE_SUPPORT_KOFI_URL: 'http://ko-fi.com/x',
      VITE_SUPPORT_BMC_URL: 'https://evil.example.com/buymeacoffee.com',
    });
    expect(c.kofiUrl).toBeNull();
    expect(c.buyMeACoffeeUrl).toBeNull();
    expect(FULL.kofiUrl).toBe('https://ko-fi.com/leseMaze');
    expect(FULL.buyMeACoffeeUrl).toBe('https://www.buymeacoffee.com/leseMaze');
  });

  it('rejects malformed Amazon settings and templates without a placeholder', () => {
    const c = readSupportConfig({
      VITE_AFFILIATE_AMAZON_TAG: 'bad tag&x=1',
      VITE_AFFILIATE_THALIA_TEMPLATE: 'https://partner.example.com/c?id=1',
      VITE_AFFILIATE_BOOKBEAT_TEMPLATE: 'http://partner.example.com/{query}',
    });
    expect(c.amazon).toBeNull();
    expect(c.thaliaTemplate).toBeNull();
    expect(c.bookbeatTemplate).toBeNull();
    expect(readSupportConfig({ VITE_AFFILIATE_AMAZON_TAG: 'ok-21', VITE_AFFILIATE_AMAZON_DOMAIN: 'evil.com' }).amazon).toBeNull();
  });
});

describe('buildShopLinks', () => {
  const book = BOOK_TIPS[0];

  it('builds plain, visible affiliate links for each configured shop', () => {
    const links = buildShopLinks(FULL, book, 'en');
    expect(links.map((l) => l.shop)).toEqual(['amazon', 'thalia', 'bookbeat']);
    const [amazon, thalia, bookbeat] = links;
    expect(amazon.href).toBe('https://www.amazon.de/s?k=Cal%20Newport%20Deep%20Work&tag=lesemaze-21');
    expect(thalia.href).toContain('ued=' + encodeURIComponent('https://www.thalia.de/suche?sq=Cal%20Newport%20Deep%20Work'));
    expect(bookbeat.href).toBe('https://partner.example.com/b?id=2&q=Cal%20Newport%20Deep%20Work');
  });

  it('uses the German title for German users and skips unconfigured shops', () => {
    const only = readSupportConfig({ VITE_AFFILIATE_AMAZON_TAG: 'lesemaze-21' });
    const links = buildShopLinks(only, book, 'de');
    expect(links).toHaveLength(1);
    expect(links[0].href).toContain(encodeURIComponent('Konzentriert arbeiten'));
  });
});

describe('pickBookTip', () => {
  it('is stable within a day and cycles through all tips', () => {
    const day = 20_000 * 86_400_000;
    expect(pickBookTip(day)).toBe(pickBookTip(day + 3_600_000));
    const seen = new Set(BOOK_TIPS.map((_, i) => pickBookTip(day + i * 86_400_000).id));
    expect(seen.size).toBe(BOOK_TIPS.length);
  });
});

describe('SupportSection', () => {
  it('renders nothing when nothing is configured', () => {
    const { container } = render(<SupportSection config={readSupportConfig({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows donation links that open safely in a new tab', () => {
    render(<SupportSection config={readSupportConfig({ VITE_SUPPORT_KOFI_URL: 'https://ko-fi.com/x' })} />);
    const link = screen.getByRole('link', { name: 'Ko-fi' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.queryByTestId('book-tip')).not.toBeInTheDocument();
  });

  it('labels the book tip as an ad, discloses affiliate links and can be hidden', async () => {
    render(<SupportSection config={FULL} now={0} />);
    const tip = await screen.findByTestId('book-tip');
    expect(tip).toHaveTextContent('Ad · Book tip');
    expect(tip).toHaveTextContent(/Affiliate links/);
    expect(tip).toHaveTextContent('As an Amazon Associate');
    for (const name of ['Amazon', 'Thalia', 'Bookbeat']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('rel')).toContain('sponsored');
      expect(link).toHaveAttribute('target', '_blank');
    }
    await act(async () => screen.getByRole('button', { name: 'Hide' }).click());
    expect(screen.queryByTestId('book-tip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show book tips' })).toBeInTheDocument();
  });

  it('remembers the hidden state', async () => {
    const first = render(<SupportSection config={FULL} now={0} />);
    await act(async () => (await screen.findByRole('button', { name: 'Hide' })).click());
    await vi.waitFor(() => expect(chrome.storage.local.set).toHaveBeenCalled());
    first.unmount();
    resetSupportStoreForTests();
    render(<SupportSection config={FULL} now={0} />);
    expect(await screen.findByRole('button', { name: 'Show book tips' })).toBeInTheDocument();
  });

  it('omits the Amazon statement without Amazon and speaks German on request', async () => {
    const noAmazon = readSupportConfig({ VITE_AFFILIATE_BOOKBEAT_TEMPLATE: 'https://partner.example.com/b?q={query}' });
    await setLanguage('de');
    render(<SupportSection config={noAmazon} now={0} />);
    const tip = await screen.findByTestId('book-tip');
    expect(tip).toHaveTextContent('Anzeige · Buchtipp');
    expect(tip).not.toHaveTextContent('Amazon-Partner');
  });
});

describe('useFitToWidth', () => {
  function Probe() {
    const { containerRef, contentRef } = useFitToWidth();
    useEffect(() => undefined);
    return (
      <div ref={containerRef} data-testid="container">
        <div ref={contentRef} data-testid="content" />
      </div>
    );
  }

  const define = (prop: 'clientWidth' | 'offsetWidth', value: number) =>
    vi.spyOn(HTMLElement.prototype, prop, 'get').mockReturnValue(value);

  afterEach(() => vi.restoreAllMocks());

  it('leaves content alone when it fits', () => {
    define('clientWidth', 400);
    define('offsetWidth', 300);
    render(<Probe />);
    expect(screen.getByTestId('content').style.transform).toBe('');
  });

  it('scales content down to the available width', () => {
    define('clientWidth', 400);
    define('offsetWidth', 800);
    render(<Probe />);
    expect(screen.getByTestId('content').style.transform).toBe('scale(0.5)');
  });

  it('never shrinks below the minimum scale', () => {
    define('clientWidth', 100);
    define('offsetWidth', 10_000);
    render(<Probe />);
    expect(screen.getByTestId('content').style.transform).toBe('scale(0.1)');
  });

  it('does nothing without layout information', () => {
    define('clientWidth', 0);
    define('offsetWidth', 0);
    render(<Probe />);
    expect(screen.getByTestId('content').style.transform).toBe('');
  });
});
