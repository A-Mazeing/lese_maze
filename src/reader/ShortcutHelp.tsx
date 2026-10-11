const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['Leertaste', 'Wiedergabe / Pause'],
  ['←  →', 'Voriger / nächster Satz'],
  ['Shift + ←  →', 'Voriger / nächster Absatz'],
  ['↑  ↓  oder  +  -', 'Geschwindigkeit ±50 WPM'],
  ['Pos1', 'Zum Anfang'],
  ['Ende', 'Zum Ende'],
  ['Esc', 'Pause'],
];

/** Übersicht der Tastenkürzel. */
export function ShortcutHelp() {
  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-md">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tastaturkürzel</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        {SHORTCUTS.map(([keys, description]) => (
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
