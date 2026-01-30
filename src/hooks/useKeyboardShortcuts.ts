import { useEffect, useCallback } from 'react';
import { useRSVP } from './useRSVP';

interface KeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Hook für Keyboard Shortcuts.
 * 
 * Shortcuts:
 * - Space: Play/Pause
 * - Left Arrow: 5 Wörter zurück
 * - Right Arrow: 5 Wörter vor
 * - Up Arrow / +: Geschwindigkeit erhöhen
 * - Down Arrow / -: Geschwindigkeit verringern
 * - Home: Zum Anfang
 * - End: Zum Ende
 * - Escape: Pause
 */
export function useKeyboardShortcuts({ enabled = true }: KeyboardShortcutsOptions = {}) {
  const {
    toggle,
    pause,
    skipForward,
    skipBackward,
    goToStart,
    goToEnd,
    increaseWpm,
    decreaseWpm,
  } = useRSVP();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignoriere Tastatureingaben in Input-Feldern
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        toggle();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        skipBackward(event.shiftKey ? 20 : 5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        skipForward(event.shiftKey ? 20 : 5);
        break;
      case 'ArrowUp':
      case 'NumpadAdd':
        event.preventDefault();
        increaseWpm(event.shiftKey ? 100 : 50);
        break;
      case 'ArrowDown':
      case 'NumpadSubtract':
        event.preventDefault();
        decreaseWpm(event.shiftKey ? 100 : 50);
        break;
      case 'Home':
        event.preventDefault();
        goToStart();
        break;
      case 'End':
        event.preventDefault();
        goToEnd();
        break;
      case 'Escape':
        event.preventDefault();
        pause();
        break;
      case 'Equal': // + auf deutscher Tastatur
        if (event.shiftKey) {
          event.preventDefault();
          increaseWpm(50);
        }
        break;
      case 'Minus':
        event.preventDefault();
        decreaseWpm(50);
        break;
    }
  }, [toggle, pause, skipForward, skipBackward, goToStart, goToEnd, increaseWpm, decreaseWpm]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
