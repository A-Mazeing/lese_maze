import { useEffect } from 'react';
import { useReaderDispatch, useReaderStore } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';

interface KeyboardShortcutsOptions {
  enabled?: boolean;
}

export type ShortcutScope = 'all' | 'no-activation' | 'playback' | 'none';

/**
 * Welche Tastenkürzel dürfen auf dem fokussierten Element greifen?
 *
 * - Texteingaben, Auswahllisten, bearbeitbare Bereiche, Menüs, Dialoge: keine.
 * - Buttons, Links, Checkboxen: alle außer der Leertaste (sie löst dort nativ einen Klick
 *   aus und würde sonst doppelt reagieren). Der Fokus bleibt nach einem Klick auf einem Button;
 *   Pfeiltasten und Co. sollen trotzdem funktionieren.
 * - Schieberegler: nur Leertaste/Esc. Die Pfeiltasten gehören dem Regler; ohne die Ausnahme
 *   für die Leertaste würde ein einmal bedienter Regler das Pausieren blockieren.
 */
export function getShortcutScope(target: EventTarget | null): ShortcutScope {
  if (!(target instanceof HTMLElement)) return 'all';
  if (target.isContentEditable) return 'none';
  if (target instanceof HTMLInputElement && target.type === 'range') return 'playback';
  if (target.closest('[role="slider"]')) return 'playback';
  if (target.closest('textarea, select, [role="menu"], [role="dialog"], [role="textbox"]')) return 'none';
  if (target instanceof HTMLInputElement) {
    return target.type === 'checkbox' || target.type === 'radio' || target.type === 'button' ? 'no-activation' : 'none';
  }
  if (target.closest('button, a[href], [role="button"]')) return 'no-activation';
  return 'all';
}

/**
 * Globale Tastenkürzel des Readers.
 *
 * - Leertaste: Wiedergabe starten/pausieren
 * - ← / →: vorheriger / nächster Satz (mit Shift: Absatz)
 * - ↑ / ↓ bzw. + / -: Geschwindigkeit ±50 WPM (mit Shift: ±100)
 * - Pos1 / Ende: zum Anfang / Ende des Lesebereichs
 * - Esc: pausieren
 *
 * Der Hook abonniert den Lesezustand nicht und rendert daher nicht bei jedem Wort neu.
 */
export function useKeyboardShortcuts({ enabled = true }: KeyboardShortcutsOptions = {}): void {
  const dispatch = useReaderDispatch();
  const store = useReaderStore();

  useEffect(() => {
    if (!enabled) return;

    const changeWpm = (delta: number) => {
      dispatch({ type: 'SET_WPM', payload: store.getState().wpm + delta });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const scope = getShortcutScope(event.target);
      if (scope === 'none') return;

      if (scope === 'no-activation' && event.code === 'Space') return;

      if (scope === 'playback') {
        if (event.code === 'Space') {
          event.preventDefault();
          if (!event.repeat) dispatch({ type: 'TOGGLE_PLAY' });
        } else if (event.code === 'Escape') {
          dispatch({ type: 'PAUSE' });
        }
        return;
      }

      // „+“ und „-“ layoutunabhängig über das erzeugte Zeichen: `event.code` wäre je nach
      // Tastaturbelegung eine andere physische Taste.
      if (event.key === '+') {
        event.preventDefault();
        changeWpm(50);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        changeWpm(-50);
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (!event.repeat) dispatch({ type: 'TOGGLE_PLAY' });
          break;
        case 'ArrowLeft':
          event.preventDefault();
          dispatch({ type: event.shiftKey ? 'GOTO_PREV_PARAGRAPH' : 'GOTO_PREV_SENTENCE' });
          break;
        case 'ArrowRight':
          event.preventDefault();
          dispatch({ type: event.shiftKey ? 'GOTO_NEXT_PARAGRAPH' : 'GOTO_NEXT_SENTENCE' });
          break;
        case 'ArrowUp':
          event.preventDefault();
          changeWpm(event.shiftKey ? 100 : 50);
          break;
        case 'ArrowDown':
          event.preventDefault();
          changeWpm(event.shiftKey ? -100 : -50);
          break;
        case 'Home':
          event.preventDefault();
          dispatch({ type: 'SET_INDEX', payload: store.getState().startIndex });
          break;
        case 'End':
          event.preventDefault();
          dispatch({ type: 'SET_INDEX', payload: getEffectiveEnd(store.getState()) });
          break;
        case 'Escape':
          dispatch({ type: 'PAUSE' });
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, dispatch, store]);
}
