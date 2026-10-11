import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ViewerContextMenu, type WordRange } from '@/components/shared/ViewerContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';

describe('ViewerContextMenu', () => {
  const defaultProps = {
    position: { x: 100, y: 100 },
    selectedRange: { start: 5, end: 10 } as WordRange,
    onAction: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render menu with word range header', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    expect(screen.getByText('Wörter 6 - 11')).toBeInTheDocument();
  });

  it('should not render when selectedRange is null', () => {
    render(<ViewerContextMenu {...defaultProps} selectedRange={null} />);
    
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should render all action buttons', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    expect(screen.getByText('Auswahl im RSVP starten')).toBeInTheDocument();
    expect(screen.getByText('Von hier starten')).toBeInTheDocument();
    expect(screen.getByText('Hier enden')).toBeInTheDocument();
    expect(screen.getByText('Lesebereich setzen')).toBeInTheDocument();
  });

  it('should call onAction with "read" when RSVP button is clicked', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Auswahl im RSVP starten'));
    
    expect(defaultProps.onAction).toHaveBeenCalledWith('read');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onAction with "start" when start button is clicked', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Von hier starten'));
    
    expect(defaultProps.onAction).toHaveBeenCalledWith('start');
  });

  it('should call onAction with "end" when end button is clicked', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Hier enden'));
    
    expect(defaultProps.onAction).toHaveBeenCalledWith('end');
  });

  it('should call onAction with "range" when range button is clicked', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Lesebereich setzen'));
    
    expect(defaultProps.onAction).toHaveBeenCalledWith('range');
  });

  it('should hide word range when showWordRange is false', () => {
    render(<ViewerContextMenu {...defaultProps} showWordRange={false} />);
    
    expect(screen.queryByText('Wörter 6 - 11')).not.toBeInTheDocument();
  });

  it('should close on Escape key', () => {
    render(<ViewerContextMenu {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render custom actions when provided', () => {
    render(
      <ViewerContextMenu 
        {...defaultProps} 
        customActions={<button>Custom Action</button>}
      />
    );
    
    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });
});

describe('useContextMenu Hook', () => {
  it('should initialize with closed state', () => {
    const { result } = renderHook(() => useContextMenu());
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.range).toBeNull();
  });

  it('should open menu with showMenu', () => {
    const { result } = renderHook(() => useContextMenu());
    
    act(() => {
      result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.position).toEqual({ x: 100, y: 200 });
    expect(result.current.range).toEqual({ start: 5, end: 10 });
  });

  it('should close menu with hideMenu', () => {
    const { result } = renderHook(() => useContextMenu());
    
    act(() => {
      result.current.showMenu({ x: 100, y: 200 }, { start: 5, end: 10 });
    });
    
    act(() => {
      result.current.hideMenu();
    });
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.range).toBeNull();
  });
});
