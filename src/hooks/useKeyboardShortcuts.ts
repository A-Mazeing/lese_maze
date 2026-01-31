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
 * - Left Arrow: Zum vorherigen Satz
 * - Right Arrow: Zum nächsten Satz
 * - Shift + Left Arrow: Zum vorherigen Absatz
 * - Shift + Right Arrow: Zum nächsten Absatz
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
    goToStart,
    goToEnd,
    increaseWpm,
    decreaseWpm,
    goToPrevSentence,
    goToNextSentence,
    goToPrevParagraph,
    goToNextParagraph,
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
        if (event.shiftKey) {
          goToPrevParagraph();
        } else {
          goToPrevSentence();
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (event.shiftKey) {
          goToNextParagraph();
        } else {
          goToNextSentence();
        }
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
  }, [toggle, pause, goToStart, goToEnd, increaseWpm, decreaseWpm, 
      goToPrevSentence, goToNextSentence, goToPrevParagraph, goToNextParagraph]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
