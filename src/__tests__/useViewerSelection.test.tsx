import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useViewerSelection, adjustMenuPosition } from '@/hooks/useViewerSelection';
import { ReaderProvider } from '@/contexts/ReaderContext';

// Wrapper component with ReaderProvider
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ReaderProvider, null, children);
  };
}

describe('useViewerSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have context menu hidden initially', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      expect(result.current.showContextMenu).toBe(false);
      expect(result.current.selectedWordRange).toBeNull();
    });

    it('should have default menu position', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      expect(result.current.contextMenuPosition).toEqual({ x: 0, y: 0 });
    });
  });

  describe('showMenu', () => {
    it('should show context menu with position and range', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      expect(result.current.showContextMenu).toBe(true);
      expect(result.current.contextMenuPosition).toEqual({ x: 100, y: 200 });
      expect(result.current.selectedWordRange).toEqual({ start: 5, end: 10 });
    });
  });

  describe('hideMenu', () => {
    it('should hide context menu', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      expect(result.current.showContextMenu).toBe(true);

      act(() => {
        result.current.hideMenu();
      });

      expect(result.current.showContextMenu).toBe(false);
      expect(result.current.selectedWordRange).toBeNull();
    });
  });

  describe('handleContextMenuAction', () => {
    it('should handle "start" action', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      act(() => {
        result.current.handleContextMenuAction('start');
      });

      expect(result.current.showContextMenu).toBe(false);
    });

    it('should handle "end" action', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      act(() => {
        result.current.handleContextMenuAction('end');
      });

      expect(result.current.showContextMenu).toBe(false);
    });

    it('should handle "range" action', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      act(() => {
        result.current.handleContextMenuAction('range');
      });

      expect(result.current.showContextMenu).toBe(false);
    });

    it('should handle "read" action and call onStartReading', () => {
      const onStartReading = vi.fn();
      const { result } = renderHook(
        () => useViewerSelection({ onStartReading }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
      });

      act(() => {
        result.current.handleContextMenuAction('read');
      });

      expect(onStartReading).toHaveBeenCalledWith({ start: 5, end: 10 });
      expect(result.current.showContextMenu).toBe(false);
    });

    it('should do nothing if no range is selected', () => {
      const onStartReading = vi.fn();
      const { result } = renderHook(
        () => useViewerSelection({ onStartReading }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.handleContextMenuAction('read');
      });

      expect(onStartReading).not.toHaveBeenCalled();
    });
  });

  describe('mouse tracking', () => {
    it('should track mouse down state', () => {
      const { result } = renderHook(() => useViewerSelection(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isMouseDownRef.current).toBe(false);

      act(() => {
        result.current.handleMouseDown();
      });

      expect(result.current.isMouseDownRef.current).toBe(true);

      act(() => {
        result.current.handleMouseUp();
      });

      expect(result.current.isMouseDownRef.current).toBe(false);
    });
  });
});

describe('adjustMenuPosition', () => {
  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  it('should return position within viewport', () => {
    const result = adjustMenuPosition(100, 200);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('should adjust position if too close to right edge', () => {
    const result = adjustMenuPosition(900, 200, 220, 200);
    expect(result.x).toBeLessThan(900);
  });

  it('should adjust position if too close to bottom edge', () => {
    const result = adjustMenuPosition(100, 700, 220, 200);
    expect(result.y).toBeLessThan(700);
  });

  it('should not allow position less than 10px from left', () => {
    const result = adjustMenuPosition(5, 200);
    expect(result.x).toBe(10);
  });

  it('should not allow position less than 10px from top', () => {
    const result = adjustMenuPosition(100, 5);
    expect(result.y).toBe(10);
  });

  it('should use custom menu dimensions', () => {
    const result = adjustMenuPosition(950, 700, 100, 100);
    expect(result.x).toBeLessThanOrEqual(914); // 1024 - 100 - 10
    expect(result.y).toBeLessThanOrEqual(658); // 768 - 100 - 10
  });
});
