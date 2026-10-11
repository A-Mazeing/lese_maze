import { LANGUAGES, setLanguage, useLanguage, useT } from '@/i18n';

/** Sprachwahl (Englisch ist Standard, Deutsch wählbar). Wirkt sofort und wird gespeichert. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const t = useT();
  const language = useLanguage();

  return (
    <div role="group" aria-label={t('lang.label')} className={`flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 ${className}`}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={language === code}
          title={label}
          aria-label={label}
          onClick={() => void setLanguage(code)}
          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
            language === code ? 'bg-white dark:bg-gray-600 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
