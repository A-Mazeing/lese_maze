import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  NavigationButtons,
  PageIndicator,
  StartReadingButton,
  ViewerToolbar,
  ReadingRangeInfo,
  ViewerInstructions,
} from '@/components/shared/ViewerToolbar';

describe('ViewerToolbar Components', () => {
  describe('NavigationButtons', () => {
    it('should render prev and next buttons', () => {
      render(
        <NavigationButtons 
          onPrev={vi.fn()} 
          onNext={vi.fn()} 
        />
      );
      
      expect(screen.getByLabelText('Zurück')).toBeInTheDocument();
      expect(screen.getByLabelText('Weiter')).toBeInTheDocument();
    });

    it('should call onPrev when prev button is clicked', () => {
      const onPrev = vi.fn();
      render(<NavigationButtons onPrev={onPrev} onNext={vi.fn()} />);
      
      fireEvent.click(screen.getByLabelText('Zurück'));
      
      expect(onPrev).toHaveBeenCalledTimes(1);
    });

    it('should call onNext when next button is clicked', () => {
      const onNext = vi.fn();
      render(<NavigationButtons onPrev={vi.fn()} onNext={onNext} />);
      
      fireEvent.click(screen.getByLabelText('Weiter'));
      
      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('should disable prev button when prevDisabled is true', () => {
      render(
        <NavigationButtons 
          onPrev={vi.fn()} 
          onNext={vi.fn()} 
          prevDisabled={true}
        />
      );
      
      expect(screen.getByLabelText('Zurück')).toBeDisabled();
    });

    it('should disable next button when nextDisabled is true', () => {
      render(
        <NavigationButtons 
          onPrev={vi.fn()} 
          onNext={vi.fn()} 
          nextDisabled={true}
        />
      );
      
      expect(screen.getByLabelText('Weiter')).toBeDisabled();
    });
  });

  describe('PageIndicator', () => {
    it('should display current and total pages', () => {
      render(<PageIndicator current={5} total={100} />);
      
      expect(screen.getByText('5 / 100')).toBeInTheDocument();
    });

    it('should render input when editable is true', () => {
      render(
        <PageIndicator 
          current={5} 
          total={100} 
          editable={true}
          onPageChange={vi.fn()}
        />
      );
      
      expect(screen.getByLabelText('Seitennummer')).toBeInTheDocument();
    });

    it('should call onPageChange when form is submitted', () => {
      const onPageChange = vi.fn();
      render(
        <PageIndicator 
          current={5} 
          total={100} 
          editable={true}
          onPageChange={onPageChange}
        />
      );
      
      const input = screen.getByLabelText('Seitennummer');
      fireEvent.change(input, { target: { value: '42' } });
      fireEvent.submit(input.closest('form')!);
      
      expect(onPageChange).toHaveBeenCalledWith(42);
    });
  });

  describe('StartReadingButton', () => {
    it('should render with default label', () => {
      render(<StartReadingButton onClick={vi.fn()} />);
      
      expect(screen.getByText('Lesen starten')).toBeInTheDocument();
    });

    it('should render with custom label', () => {
      render(<StartReadingButton onClick={vi.fn()} label="Start now" />);
      
      expect(screen.getByText('Start now')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      render(<StartReadingButton onClick={onClick} />);
      
      fireEvent.click(screen.getByText('Lesen starten'));
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
      render(<StartReadingButton onClick={vi.fn()} disabled={true} />);
      
      expect(screen.getByText('Lesen starten')).toBeDisabled();
    });
  });

  describe('ViewerToolbar', () => {
    const defaultNavigation = {
      onPrev: vi.fn(),
      onNext: vi.fn(),
    };

    it('should render navigation buttons', () => {
      render(<ViewerToolbar navigation={defaultNavigation} />);
      
      expect(screen.getByLabelText('Zurück')).toBeInTheDocument();
      expect(screen.getByLabelText('Weiter')).toBeInTheDocument();
    });

    it('should render page info when provided', () => {
      render(
        <ViewerToolbar 
          navigation={defaultNavigation}
          pageInfo={{ current: 5, total: 100 }}
        />
      );
      
      expect(screen.getByText('5 / 100')).toBeInTheDocument();
    });

    it('should render start reading button when onStartReading is provided', () => {
      render(
        <ViewerToolbar 
          navigation={defaultNavigation}
          onStartReading={vi.fn()}
        />
      );
      
      expect(screen.getByText('Lesen starten')).toBeInTheDocument();
    });

    it('should render children in center section', () => {
      render(
        <ViewerToolbar navigation={defaultNavigation}>
          <span>Custom Control</span>
        </ViewerToolbar>
      );
      
      expect(screen.getByText('Custom Control')).toBeInTheDocument();
    });
  });

  describe('ReadingRangeInfo', () => {
    it('should not render when at default range (start=0, end=null)', () => {
      const { container } = render(
        <ReadingRangeInfo 
          startIndex={0}
          endIndex={null}
          totalWords={1000}
          onReset={vi.fn()}
        />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('should render when start index is not 0', () => {
      render(
        <ReadingRangeInfo 
          startIndex={10}
          endIndex={null}
          totalWords={1000}
          onReset={vi.fn()}
        />
      );
      
      expect(screen.getByText(/Lesebereich: Wort 11/)).toBeInTheDocument();
    });

    it('should render when end index is set', () => {
      render(
        <ReadingRangeInfo 
          startIndex={0}
          endIndex={500}
          totalWords={1000}
          onReset={vi.fn()}
        />
      );
      
      expect(screen.getByText(/bis 501/)).toBeInTheDocument();
    });

    it('should call onReset when reset button is clicked', () => {
      const onReset = vi.fn();
      render(
        <ReadingRangeInfo 
          startIndex={10}
          endIndex={100}
          totalWords={1000}
          onReset={onReset}
        />
      );
      
      fireEvent.click(screen.getByText('Zurücksetzen'));
      
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('ViewerInstructions', () => {
    it('should render instruction text', () => {
      render(<ViewerInstructions text="Press Enter to continue" />);
      
      expect(screen.getByText('Press Enter to continue')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(<ViewerInstructions text="Instructions" className="custom-class" />);
      
      const element = container.firstChild;
      expect(element).toHaveClass('custom-class');
    });
  });
});
