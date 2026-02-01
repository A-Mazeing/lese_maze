import { useEffect, useCallback, useRef } from 'react';

/**
 * Shortcut context types for different views/modes.
 */
export type ShortcutContext = 
  | 'rsvp'           // RSVP reader active
  | 'pdf-viewer'     // PDF viewer active
  | 'epub-viewer'    // ePub viewer active
  | 'preview'        // Content preview active
  | 'global';        // Always active (fallback)

/**
 * Modifier keys state
 */
export interface ModifierKeys {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  /** Key code (e.g., 'Space', 'ArrowLeft') */
  key: string;
  /** Contexts where this shortcut is active */
  contexts: ShortcutContext[];
  /** Handler function */
  handler: (modifiers: ModifierKeys) => void;
  /** Optional description for help text */
  description?: string;
  /** Whether to prevent default */
  preventDefault?: boolean;
  /** Required modifiers */
  modifiers?: Partial<ModifierKeys>;
}

/**
 * Configuration for the keyboard shortcuts hook.
 */
export interface KeyboardShortcutsConfig {
  /** Current active context */
  context: ShortcutContext;
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Additional custom shortcuts */
  shortcuts?: ShortcutDefinition[];
}

/**
 * Handlers for RSVP shortcuts
 */
export interface RSVPShortcutHandlers {
  toggle?: () => void;
  pause?: () => void;
  goToStart?: () => void;
  goToEnd?: () => void;
  increaseWpm?: (amount?: number) => void;
  decreaseWpm?: (amount?: number) => void;
  goToPrevSentence?: () => void;
  goToNextSentence?: () => void;
  goToPrevParagraph?: () => void;
  goToNextParagraph?: () => void;
}

/**
 * Handlers for viewer shortcuts
 */
export interface ViewerShortcutHandlers {
  prevPage?: () => void;
  nextPage?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  goToPage?: (page: number) => void;
}

/**
 * Combined handlers for all shortcut types
 */
export interface AllShortcutHandlers extends RSVPShortcutHandlers, ViewerShortcutHandlers {}

/**
 * Check if event target is an input element where shortcuts should be disabled
 */
function isInputElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Check if modifiers match requirements
 */
function matchesModifiers(
  event: KeyboardEvent, 
  required?: Partial<ModifierKeys>
): boolean {
  if (!required) return true;
  
  if (required.shift !== undefined && event.shiftKey !== required.shift) return false;
  if (required.ctrl !== undefined && event.ctrlKey !== required.ctrl) return false;
  if (required.alt !== undefined && event.altKey !== required.alt) return false;
  if (required.meta !== undefined && event.metaKey !== required.meta) return false;
  
  return true;
}

/**
 * Create default RSVP shortcuts
 */
function createRSVPShortcuts(handlers: RSVPShortcutHandlers): ShortcutDefinition[] {
  const shortcuts: ShortcutDefinition[] = [];
  
  if (handlers.toggle) {
    shortcuts.push({
      key: 'Space',
      contexts: ['rsvp', 'preview', 'global'],
      handler: handlers.toggle,
      description: 'Play/Pause',
      preventDefault: true,
    });
  }
  
  if (handlers.goToPrevSentence && handlers.goToPrevParagraph) {
    shortcuts.push({
      key: 'ArrowLeft',
      contexts: ['rsvp', 'pdf-viewer', 'epub-viewer', 'preview'],
      handler: (mods) => {
        if (mods.shift) {
          handlers.goToPrevParagraph?.();
        } else {
          handlers.goToPrevSentence?.();
        }
      },
      description: 'Previous sentence (Shift: paragraph)',
      preventDefault: true,
    });
  }
  
  if (handlers.goToNextSentence && handlers.goToNextParagraph) {
    shortcuts.push({
      key: 'ArrowRight',
      contexts: ['rsvp', 'pdf-viewer', 'epub-viewer', 'preview'],
      handler: (mods) => {
        if (mods.shift) {
          handlers.goToNextParagraph?.();
        } else {
          handlers.goToNextSentence?.();
        }
      },
      description: 'Next sentence (Shift: paragraph)',
      preventDefault: true,
    });
  }
  
  if (handlers.increaseWpm) {
    shortcuts.push(
      {
        key: 'ArrowUp',
        contexts: ['rsvp', 'global'],
        handler: (mods) => handlers.increaseWpm?.(mods.shift ? 100 : 50),
        description: 'Increase speed',
        preventDefault: true,
      },
      {
        key: 'NumpadAdd',
        contexts: ['rsvp', 'global'],
        handler: () => handlers.increaseWpm?.(50),
        description: 'Increase speed',
        preventDefault: true,
      },
      {
        key: 'Equal',
        contexts: ['rsvp', 'global'],
        handler: () => handlers.increaseWpm?.(50),
        description: 'Increase speed',
        preventDefault: true,
        modifiers: { shift: true },
      }
    );
  }
  
  if (handlers.decreaseWpm) {
    shortcuts.push(
      {
        key: 'ArrowDown',
        contexts: ['rsvp', 'global'],
        handler: (mods) => handlers.decreaseWpm?.(mods.shift ? 100 : 50),
        description: 'Decrease speed',
        preventDefault: true,
      },
      {
        key: 'NumpadSubtract',
        contexts: ['rsvp', 'global'],
        handler: () => handlers.decreaseWpm?.(50),
        description: 'Decrease speed',
        preventDefault: true,
      },
      {
        key: 'Minus',
        contexts: ['rsvp', 'global'],
        handler: () => handlers.decreaseWpm?.(50),
        description: 'Decrease speed',
        preventDefault: true,
      }
    );
  }
  
  if (handlers.goToStart) {
    shortcuts.push({
      key: 'Home',
      contexts: ['rsvp', 'global'],
      handler: handlers.goToStart,
      description: 'Go to start',
      preventDefault: true,
    });
  }
  
  if (handlers.goToEnd) {
    shortcuts.push({
      key: 'End',
      contexts: ['rsvp', 'global'],
      handler: handlers.goToEnd,
      description: 'Go to end',
      preventDefault: true,
    });
  }
  
  if (handlers.pause) {
    shortcuts.push({
      key: 'Escape',
      contexts: ['rsvp', 'global'],
      handler: handlers.pause,
      description: 'Pause',
      preventDefault: true,
    });
  }
  
  return shortcuts;
}

/**
 * Create default viewer shortcuts (PDF/ePub)
 * Note: ArrowLeft/ArrowRight are handled by RSVP shortcuts for sentence/paragraph navigation.
 * Viewers only use PageUp/PageDown for page navigation.
 */
function createViewerShortcuts(
  handlers: ViewerShortcutHandlers, 
  viewerType: 'pdf-viewer' | 'epub-viewer'
): ShortcutDefinition[] {
  const shortcuts: ShortcutDefinition[] = [];
  
  if (handlers.prevPage) {
    shortcuts.push({
      key: 'PageUp',
      contexts: [viewerType],
      handler: handlers.prevPage,
      description: 'Previous page',
      preventDefault: true,
    });
  }
  
  if (handlers.nextPage) {
    shortcuts.push({
      key: 'PageDown',
      contexts: [viewerType],
      handler: handlers.nextPage,
      description: 'Next page',
      preventDefault: true,
    });
  }
  
  // Zoom only for PDF
  if (viewerType === 'pdf-viewer') {
    if (handlers.zoomIn) {
      shortcuts.push(
        {
          key: 'Equal',
          contexts: ['pdf-viewer'],
          handler: handlers.zoomIn,
          description: 'Zoom in',
          preventDefault: true,
          modifiers: { shift: true },
        },
        {
          key: 'NumpadAdd',
          contexts: ['pdf-viewer'],
          handler: handlers.zoomIn,
          description: 'Zoom in',
          preventDefault: true,
        }
      );
    }
    
    if (handlers.zoomOut) {
      shortcuts.push({
        key: 'Minus',
        contexts: ['pdf-viewer'],
        handler: handlers.zoomOut,
        description: 'Zoom out',
        preventDefault: true,
      });
    }
  }
  
  return shortcuts;
}

/**
 * Context-aware keyboard shortcuts hook.
 * 
 * Manages keyboard shortcuts based on the current context (RSVP, PDF viewer, etc.)
 * and prevents conflicts between different views.
 */
export function useContextShortcuts(
  config: KeyboardShortcutsConfig,
  handlers: AllShortcutHandlers = {}
) {
  const { context, enabled = true, shortcuts: customShortcuts = [] } = config;
  const shortcutsRef = useRef<ShortcutDefinition[]>([]);
  
  // Build shortcuts list based on context and handlers
  useEffect(() => {
    const allShortcuts: ShortcutDefinition[] = [];
    
    // Add RSVP shortcuts
    allShortcuts.push(...createRSVPShortcuts(handlers));
    
    // Add viewer shortcuts based on context
    if (context === 'pdf-viewer') {
      allShortcuts.push(...createViewerShortcuts(handlers, 'pdf-viewer'));
    } else if (context === 'epub-viewer') {
      allShortcuts.push(...createViewerShortcuts(handlers, 'epub-viewer'));
    }
    
    // Add custom shortcuts
    allShortcuts.push(...customShortcuts);
    
    shortcutsRef.current = allShortcuts;
  }, [handlers, context, customShortcuts]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore inputs
    if (isInputElement(event.target)) {
      return;
    }
    
    // Find matching shortcuts for current context
    const matchingShortcuts = shortcutsRef.current.filter(shortcut => {
      // Check key match
      if (shortcut.key !== event.code) return false;
      
      // Check context match
      const matchesContext = shortcut.contexts.includes(context) || 
                            shortcut.contexts.includes('global');
      if (!matchesContext) return false;
      
      // Check modifier requirements
      if (!matchesModifiers(event, shortcut.modifiers)) return false;
      
      return true;
    });
    
    // Priority: exact context match over global
    const contextSpecific = matchingShortcuts.find(s => s.contexts.includes(context));
    const shortcut = contextSpecific || matchingShortcuts.find(s => s.contexts.includes('global'));
    
    if (shortcut) {
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
      }
      
      shortcut.handler({
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
      });
    }
  }, [context]);
  
  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
  
  // Return helper for getting shortcut descriptions
  return {
    getShortcutsForContext: useCallback((ctx: ShortcutContext): ShortcutDefinition[] => {
      return shortcutsRef.current.filter(s => 
        s.contexts.includes(ctx) || s.contexts.includes('global')
      );
    }, []),
  };
}

/**
 * Simple hook for viewer-specific shortcuts.
 * Use this in PDF/ePub viewers for page navigation and zoom.
 * Note: ArrowLeft/ArrowRight are handled by useKeyboardShortcuts for sentence/paragraph navigation.
 */
export function useViewerShortcuts(
  handlers: ViewerShortcutHandlers,
  viewerType: 'pdf-viewer' | 'epub-viewer',
  enabled = true
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (isInputElement(event.target)) return;
    
    switch (event.code) {
      case 'PageUp':
        if (handlers.prevPage) {
          event.preventDefault();
          handlers.prevPage();
        }
        break;
      case 'PageDown':
        if (handlers.nextPage) {
          event.preventDefault();
          handlers.nextPage();
        }
        break;
      case 'Equal':
        if (event.shiftKey && handlers.zoomIn && viewerType === 'pdf-viewer') {
          event.preventDefault();
          handlers.zoomIn();
        }
        break;
      case 'NumpadAdd':
        if (handlers.zoomIn && viewerType === 'pdf-viewer') {
          event.preventDefault();
          handlers.zoomIn();
        }
        break;
      case 'Minus':
        if (handlers.zoomOut && viewerType === 'pdf-viewer') {
          event.preventDefault();
          handlers.zoomOut();
        }
        break;
    }
  }, [handlers, viewerType]);
  
  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Get keyboard shortcut help text based on context.
 */
export function getShortcutHelp(context: ShortcutContext): string {
  switch (context) {
    case 'rsvp':
      return 'Tastenkürzel: Leertaste Play/Pause, ← → Sätze, Shift+← → Absätze, ↑ ↓ Geschwindigkeit';
    case 'pdf-viewer':
      return 'Tastenkürzel: ← → Sätze, Shift+← → Absätze, PageUp/Down Seiten, +/- Zoom';
    case 'epub-viewer':
      return 'Tastenkürzel: ← → Sätze, Shift+← → Absätze, PageUp/Down Seiten';
    case 'preview':
      return 'Tastenkürzel: Leertaste Start';
    default:
      return '';
  }
}
