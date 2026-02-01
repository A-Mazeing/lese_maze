import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useContextShortcuts, 
  useViewerShortcuts,
  getShortcutHelp,
} from '@/hooks/useContextShortcuts';

describe('useContextShortcuts', () => {
  const dispatchKeyDown = (code: string, modifiers: Partial<KeyboardEventInit> = {}) => {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    window.dispatchEvent(event);
    return event;
  };

  describe('RSVP Context', () => {
    it('should call toggle on Space in rsvp context', () => {
      const toggle = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { toggle }
      ));
      
      act(() => {
        dispatchKeyDown('Space');
      });
      
      expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('should call goToPrevSentence on ArrowLeft in rsvp context', () => {
      const goToPrevSentence = vi.fn();
      const goToPrevParagraph = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { goToPrevSentence, goToPrevParagraph }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowLeft');
      });
      
      expect(goToPrevSentence).toHaveBeenCalledTimes(1);
      expect(goToPrevParagraph).not.toHaveBeenCalled();
    });

    it('should call goToPrevParagraph on Shift+ArrowLeft in rsvp context', () => {
      const goToPrevSentence = vi.fn();
      const goToPrevParagraph = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { goToPrevSentence, goToPrevParagraph }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowLeft', { shiftKey: true });
      });
      
      expect(goToPrevParagraph).toHaveBeenCalledTimes(1);
    });

    it('should call increaseWpm on ArrowUp', () => {
      const increaseWpm = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { increaseWpm }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowUp');
      });
      
      expect(increaseWpm).toHaveBeenCalledWith(50);
    });

    it('should call increaseWpm with 100 on Shift+ArrowUp', () => {
      const increaseWpm = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { increaseWpm }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowUp', { shiftKey: true });
      });
      
      expect(increaseWpm).toHaveBeenCalledWith(100);
    });

    it('should call pause on Escape', () => {
      const pause = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { pause }
      ));
      
      act(() => {
        dispatchKeyDown('Escape');
      });
      
      expect(pause).toHaveBeenCalledTimes(1);
    });
  });

  describe('PDF Viewer Context', () => {
    it('should call goToPrevSentence on ArrowLeft in pdf-viewer context (sentence navigation)', () => {
      const goToPrevSentence = vi.fn();
      const goToPrevParagraph = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'pdf-viewer', enabled: true },
        { goToPrevSentence, goToPrevParagraph }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowLeft');
      });
      
      expect(goToPrevSentence).toHaveBeenCalledTimes(1);
    });

    it('should call goToNextSentence on ArrowRight in pdf-viewer context (sentence navigation)', () => {
      const goToNextSentence = vi.fn();
      const goToNextParagraph = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'pdf-viewer', enabled: true },
        { goToNextSentence, goToNextParagraph }
      ));
      
      act(() => {
        dispatchKeyDown('ArrowRight');
      });
      
      expect(goToNextSentence).toHaveBeenCalledTimes(1);
    });

    it('should call prevPage on PageUp', () => {
      const prevPage = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'pdf-viewer', enabled: true },
        { prevPage }
      ));
      
      act(() => {
        dispatchKeyDown('PageUp');
      });
      
      expect(prevPage).toHaveBeenCalledTimes(1);
    });

    it('should call zoomIn on Shift+Equal', () => {
      const zoomIn = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'pdf-viewer', enabled: true },
        { zoomIn }
      ));
      
      act(() => {
        dispatchKeyDown('Equal', { shiftKey: true });
      });
      
      expect(zoomIn).toHaveBeenCalledTimes(1);
    });

    it('should call zoomOut on Minus', () => {
      const zoomOut = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'pdf-viewer', enabled: true },
        { zoomOut }
      ));
      
      act(() => {
        dispatchKeyDown('Minus');
      });
      
      expect(zoomOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('Enabled/Disabled', () => {
    it('should not call handlers when disabled', () => {
      const toggle = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: false },
        { toggle }
      ));
      
      act(() => {
        dispatchKeyDown('Space');
      });
      
      expect(toggle).not.toHaveBeenCalled();
    });
  });

  describe('Custom Shortcuts', () => {
    it('should handle custom shortcuts', () => {
      const customHandler = vi.fn();
      
      renderHook(() => useContextShortcuts(
        { 
          context: 'rsvp', 
          enabled: true,
          shortcuts: [
            {
              key: 'KeyX',
              contexts: ['rsvp'],
              handler: customHandler,
              description: 'Custom action',
            }
          ]
        },
        {}
      ));
      
      act(() => {
        dispatchKeyDown('KeyX');
      });
      
      expect(customHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getShortcutsForContext', () => {
    it('should return shortcuts for given context', () => {
      const { result } = renderHook(() => useContextShortcuts(
        { context: 'rsvp', enabled: true },
        { toggle: vi.fn(), pause: vi.fn() }
      ));
      
      const shortcuts = result.current.getShortcutsForContext('rsvp');
      
      expect(shortcuts.length).toBeGreaterThan(0);
      expect(shortcuts.some(s => s.key === 'Space')).toBe(true);
    });
  });
});

describe('useViewerShortcuts', () => {
  const dispatchKeyDown = (code: string, modifiers: Partial<KeyboardEventInit> = {}) => {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...modifiers,
    });
    window.dispatchEvent(event);
    return event;
  };

  it('should call prevPage on PageUp for PDF viewer', () => {
    const prevPage = vi.fn();
    
    renderHook(() => useViewerShortcuts(
      { prevPage },
      'pdf-viewer',
      true
    ));
    
    act(() => {
      dispatchKeyDown('PageUp');
    });
    
    expect(prevPage).toHaveBeenCalledTimes(1);
  });

  it('should call nextPage on PageDown for ePub viewer', () => {
    const nextPage = vi.fn();
    
    renderHook(() => useViewerShortcuts(
      { nextPage },
      'epub-viewer',
      true
    ));
    
    act(() => {
      dispatchKeyDown('PageDown');
    });
    
    expect(nextPage).toHaveBeenCalledTimes(1);
  });

  it('should NOT call prevPage on ArrowLeft (now used for sentence navigation)', () => {
    const prevPage = vi.fn();
    
    renderHook(() => useViewerShortcuts(
      { prevPage },
      'pdf-viewer',
      true
    ));
    
    act(() => {
      dispatchKeyDown('ArrowLeft');
    });
    
    // ArrowLeft is no longer used for page navigation
    expect(prevPage).not.toHaveBeenCalled();
  });

  it('should not call zoomIn for ePub viewer', () => {
    const zoomIn = vi.fn();
    
    renderHook(() => useViewerShortcuts(
      { zoomIn },
      'epub-viewer',
      true
    ));
    
    act(() => {
      dispatchKeyDown('Equal', { shiftKey: true });
    });
    
    // Zoom is only for PDF
    expect(zoomIn).not.toHaveBeenCalled();
  });
});

describe('getShortcutHelp', () => {
  it('should return help text for rsvp context', () => {
    const help = getShortcutHelp('rsvp');
    
    expect(help).toContain('Leertaste');
    expect(help).toContain('Play/Pause');
  });

  it('should return help text for pdf-viewer context', () => {
    const help = getShortcutHelp('pdf-viewer');
    
    expect(help).toContain('Sätze');
    expect(help).toContain('Absätze');
    expect(help).toContain('Zoom');
  });

  it('should return help text for epub-viewer context', () => {
    const help = getShortcutHelp('epub-viewer');
    
    expect(help).toContain('Sätze');
    expect(help).toContain('Absätze');
  });

  it('should return empty string for unknown context', () => {
    const help = getShortcutHelp('global');
    
    expect(help).toBe('');
  });
});
