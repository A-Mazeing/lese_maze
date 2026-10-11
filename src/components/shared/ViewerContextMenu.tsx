import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';

/**
 * Word range for selection context
 */
export interface WordRange {
  start: number;
  end: number;
}

/**
 * Action types for context menu
 */
export type ContextMenuAction = 'start' | 'end' | 'range' | 'read';

interface ViewerContextMenuProps {
  /** Position of the menu */
  position: { x: number; y: number };
  /** Selected word range */
  selectedRange: WordRange | null;
  /** Callback when an action is selected */
  onAction: (action: ContextMenuAction) => void;
  /** Callback to close the menu */
  onClose: () => void;
  /** Optional custom actions */
  customActions?: ReactNode;
  /** Show word range in header */
  showWordRange?: boolean;
}

/**
 * Adjusts menu position to stay within viewport bounds.
 */
function adjustMenuPosition(x: number, y: number, menuWidth = 220, menuHeight = 200): { x: number; y: number } {
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);
  
  return {
    x: Math.max(10, adjustedX),
    y: Math.max(10, adjustedY),
  };
}

/**
 * Unified context menu for viewer components.
 * Provides consistent actions for text selection across PDF and ePub viewers.
 */
export function ViewerContextMenu({
  position,
  selectedRange,
  onAction,
  onClose,
  customActions,
  showWordRange = true,
}: ViewerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Position wird beim Rendern abgeleitet (kein State + Effekt nötig).
  const adjustedPosition = useMemo(() => adjustMenuPosition(position.x, position.y), [position.x, position.y]);

  // Schließen bei Klick außerhalb. Bewusst `mousedown` statt `click`: Das Menü öffnet sich
  // beim `mouseup` einer Auswahl, und das direkt danach folgende `click`-Ereignis würde es
  // sonst sofort wieder schließen.
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAction = useCallback((action: ContextMenuAction) => {
    onAction(action);
    onClose();
  }, [onAction, onClose]);

  if (!selectedRange) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl 
                 border border-gray-200 dark:border-gray-700 py-2 min-w-52"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Aktionen für die Textauswahl"
    >
      {/* Header with word range */}
      {showWordRange && (
        <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-b 
                        border-gray-200 dark:border-gray-700 mb-1">
          Wörter {selectedRange.start + 1} - {selectedRange.end + 1}
        </div>
      )}
      
      {/* Primary action - Start RSVP with selection */}
      <button
        onClick={() => handleAction('read')}
        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 
                   dark:hover:bg-blue-900/30 flex items-center gap-2 font-medium
                   text-blue-700 dark:text-blue-300"
        role="menuitem"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Auswahl im RSVP starten
      </button>
      
      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
      
      {/* Set start point */}
      <button
        onClick={() => handleAction('start')}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                   dark:hover:bg-gray-700 flex items-center gap-2"
        role="menuitem"
      >
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
        Von hier starten
      </button>
      
      {/* Set end point */}
      <button
        onClick={() => handleAction('end')}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                   dark:hover:bg-gray-700 flex items-center gap-2"
        role="menuitem"
      >
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
        Hier enden
      </button>
      
      {/* Set range */}
      <button
        onClick={() => handleAction('range')}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 
                   dark:hover:bg-gray-700 flex items-center gap-2"
        role="menuitem"
      >
        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Lesebereich setzen
      </button>

      {/* Custom actions slot */}
      {customActions}
    </div>
  );
}
