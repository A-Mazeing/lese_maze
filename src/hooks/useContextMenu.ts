import { useCallback, useState } from 'react';
import type { WordRange } from '@/components/shared/ViewerContextMenu';

/**
 * Hook to manage context menu state.
 */
export function useContextMenu() {
  const [menuState, setMenuState] = useState<{
    position: { x: number; y: number };
    range: WordRange | null;
  } | null>(null);

  const showMenu = useCallback((position: { x: number; y: number }, range: WordRange) => {
    setMenuState({ position, range });
  }, []);

  const hideMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  return {
    isOpen: menuState !== null,
    position: menuState?.position ?? { x: 0, y: 0 },
    range: menuState?.range ?? null,
    showMenu,
    hideMenu,
  };
}
