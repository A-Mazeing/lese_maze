import { useMemo, useState } from 'react';
import { useLanguage, useT } from '@/i18n';
import {
  SUPPORT_CONFIG,
  buildShopLinks,
  hasAffiliateLinks,
  hasDonationLinks,
  pickBookTip,
} from '@/support/config';
import { useShowBookTips } from '@/support/supportStore';
import type { SupportConfig } from '@/support/types';

const LINK_CLASS = 'underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400';

interface SupportSectionProps {
  /** Nur für Tests: andere Konfiguration und feste Zeit. */
  config?: SupportConfig;
  now?: number;
}

/**
 * Dezenter Bereich im Popup: Spendenlinks (Ko-fi / Buy Me a Coffee) und ein gekennzeichneter
 * Buchtipp mit Affiliate-Links. Alles erscheint nur, wenn es im Build konfiguriert ist, und
 * der Buchtipp lässt sich ausblenden. Es werden keine Daten übertragen – die Links öffnen
 * erst auf Klick und sind als Affiliate-Links offengelegt.
 */
export function SupportSection({ config = SUPPORT_CONFIG, now }: SupportSectionProps) {
  const t = useT();
  const language = useLanguage();
  const { loaded, showTips, setShowTips } = useShowBookTips();

  const [mountedAt] = useState(() => now ?? Date.now());
  const book = useMemo(() => pickBookTip(mountedAt), [mountedAt]);
  const links = useMemo(() => buildShopLinks(config, book, language), [config, book, language]);

  const donations = hasDonationLinks(config);
  const affiliate = hasAffiliateLinks(config);
  if (!donations && !affiliate) return null;

  const tipVisible = affiliate && loaded && showTips;

  return (
    <section className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-3">
      {donations && (
        <p>
          {t('support.donate')}{' '}
          {config.kofiUrl && (
            <a href={config.kofiUrl} target="_blank" rel="noopener noreferrer" title={t('support.openLink')} className={LINK_CLASS}>
              Ko-fi
            </a>
          )}
          {config.kofiUrl && config.buyMeACoffeeUrl && ' · '}
          {config.buyMeACoffeeUrl && (
            <a href={config.buyMeACoffeeUrl} target="_blank" rel="noopener noreferrer" title={t('support.openLink')} className={LINK_CLASS}>
              Buy Me a Coffee
            </a>
          )}
        </p>
      )}

      {tipVisible && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1" data-testid="book-tip">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-wide text-[10px] font-semibold">{t('support.tipLabel')}</span>
            <button type="button" onClick={() => setShowTips(false)} className={LINK_CLASS}>
              {t('support.hideTips')}
            </button>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {t('support.tipBy', { title: book.title[language], author: book.author })}
          </p>
          <p>
            {t('support.findAt')}{' '}
            {links.map((link, i) => (
              <span key={link.shop}>
                {i > 0 && ' · '}
                <a
                  href={link.href}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  title={t('support.linkTitle', { shop: link.label })}
                  className={LINK_CLASS}
                >
                  {link.label}
                </a>
              </span>
            ))}
          </p>
          <p className="text-[10px] leading-snug">{t('support.disclosure')}</p>
          {links.some((link) => link.shop === 'amazon') && (
            <p className="text-[10px] leading-snug">{t('support.amazonStatement')}</p>
          )}
        </div>
      )}

      {affiliate && loaded && !showTips && (
        <button type="button" onClick={() => setShowTips(true)} className={LINK_CLASS}>
          {t('support.showTips')}
        </button>
      )}
    </section>
  );
}
