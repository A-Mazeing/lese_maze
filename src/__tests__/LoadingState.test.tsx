import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  LoadingState,
  LoadingOverlay,
  ErrorDisplay,
  ErrorBanner,
  EmptyState,
} from '@/components/shared/LoadingState';

describe('LoadingState Components', () => {
  describe('LoadingState', () => {
    it('should render spinner without message', () => {
      render(<LoadingState />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render spinner with message', () => {
      render(<LoadingState message="Loading..." />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should apply correct color class', () => {
      render(<LoadingState color="purple" />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-purple-500');
    });

    it('should apply correct size class', () => {
      render(<LoadingState size="lg" />);
      
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-12');
      expect(spinner).toHaveClass('w-12');
    });

    it('should apply custom className', () => {
      render(<LoadingState className="custom-class" />);
      
      const container = document.querySelector('.custom-class');
      expect(container).toBeInTheDocument();
    });
  });

  describe('LoadingOverlay', () => {
    it('should not render when show is false', () => {
      render(<LoadingOverlay show={false} message="Loading..." />);
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should render when show is true', () => {
      render(<LoadingOverlay show={true} message="Loading..." />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should have overlay styling', () => {
      render(<LoadingOverlay show={true} />);
      
      const overlay = document.querySelector('.absolute.inset-0');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('ErrorDisplay', () => {
    it('should render error message', () => {
      render(<ErrorDisplay message="An error occurred" />);
      
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });

    it('should render error icon', () => {
      render(<ErrorDisplay message="Error" />);
      
      const icon = document.querySelector('svg.text-red-500');
      expect(icon).toBeInTheDocument();
    });

    it('should render action button when provided', () => {
      const handleClick = vi.fn();
      render(
        <ErrorDisplay 
          message="Error" 
          action={{ label: 'Retry', onClick: handleClick }}
        />
      );
      
      const button = screen.getByText('Retry');
      expect(button).toBeInTheDocument();
      
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should render as overlay when overlay prop is true', () => {
      render(<ErrorDisplay message="Error" overlay />);
      
      const overlay = document.querySelector('.absolute.inset-0');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('ErrorBanner', () => {
    it('should render error message', () => {
      render(<ErrorBanner message="Warning message" />);
      
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should render dismiss button when onDismiss is provided', () => {
      const handleDismiss = vi.fn();
      render(<ErrorBanner message="Error" onDismiss={handleDismiss} />);
      
      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton).toBeInTheDocument();
      
      fireEvent.click(dismissButton);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not render dismiss button when onDismiss is not provided', () => {
      render(<ErrorBanner message="Error" />);
      
      expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    it('should render default title', () => {
      render(<EmptyState />);
      
      expect(screen.getByText('Keine Daten')).toBeInTheDocument();
    });

    it('should render custom title', () => {
      render(<EmptyState title="No items found" />);
      
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(<EmptyState description="Try adding some items" />);
      
      expect(screen.getByText('Try adding some items')).toBeInTheDocument();
    });

    it('should render custom icon when provided', () => {
      render(
        <EmptyState 
          icon={<span data-testid="custom-icon">Custom Icon</span>} 
        />
      );
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });
});
