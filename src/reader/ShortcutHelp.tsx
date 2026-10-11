import { useT } from '@/i18n';

/** Übersicht der Tastenkürzel. */
export function ShortcutHelp() {
  const t = useT();
  const shortcuts: ReadonlyArray<readonly [string, string]> = [
    [t('shortcuts.space'), t('shortcuts.playPause')],
    ['←  →', t('shortcuts.sentence')],
    ['Shift + ←  →', t('shortcuts.paragraph')],
    [t('shortcuts.speedKeys'), t('shortcuts.speed')],
    [t('shortcuts.homeKey'), t('shortcuts.toStart')],
    [t('shortcuts.endKey'), t('shortcuts.toEnd')],
    ['Esc', t('shortcuts.pause')],
  ];
  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-md">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('shortcuts.title')}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        {shortcuts.map(([keys, description]) => (
          <div key={keys} className="contents">
            <dt>
              <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{keys}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
