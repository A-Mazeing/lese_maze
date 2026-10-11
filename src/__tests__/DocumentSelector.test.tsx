import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentSelector } from '@/components/shared/DocumentSelector';
import { PDF_CONFIG, EPUB_CONFIG } from '@/components/shared/documentConfigs';

describe('DocumentSelector', () => {
  const mockOnLoadFile = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State (Drop Zone)', () => {
    it('should render drop zone for PDF', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Drag a PDF file here or click to choose')).toBeInTheDocument();
    });

    it('should render drop zone for ePub', () => {
      render(
        <DocumentSelector
          config={EPUB_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Drag a ePub file here or click to choose')).toBeInTheDocument();
    });

    it('should display error message when error is present', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: 'Test error', fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner with default message for PDF', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: true, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Loading PDF file…')).toBeInTheDocument();
    });

    it('should show custom loading progress message', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ 
            isLoading: true, 
            error: null, 
            fileName: null, 
            loadingProgress: 'Loading page 5 of 10...'
          }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Loading page 5 of 10...')).toBeInTheDocument();
    });
  });

  describe('File Loaded State', () => {
    it('should show file info when file is loaded', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: 'test.pdf' }}
          metadata={{ title: 'Test Document', subtitle: '10 Seiten' }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Test Document')).toBeInTheDocument();
      expect(screen.getByText('10 Seiten')).toBeInTheDocument();
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    it('should call onReset when remove button is clicked', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: 'test.pdf' }}
          metadata={{ title: 'Test Document', subtitle: '10 Seiten' }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      fireEvent.click(screen.getByText('Remove'));
      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should show error in loaded state', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: 'Parsing error', fileName: 'test.pdf' }}
          metadata={{ title: 'Test Document', subtitle: '10 Seiten' }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      expect(screen.getByText('Parsing error')).toBeInTheDocument();
    });
  });

  describe('File Handling', () => {
    it('should call onLoadFile when valid PDF is dropped', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      const dropZone = screen.getByText('Drag a PDF file here or click to choose').parentElement!;
      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [pdfFile] }
      });

      expect(mockOnLoadFile).toHaveBeenCalledWith(pdfFile);
    });

    it('should call onLoadFile when valid ePub is dropped', () => {
      render(
        <DocumentSelector
          config={EPUB_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      const dropZone = screen.getByText('Drag a ePub file here or click to choose').parentElement!;
      const epubFile = new File(['content'], 'test.epub', { type: 'application/epub+zip' });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [epubFile] }
      });

      expect(mockOnLoadFile).toHaveBeenCalledWith(epubFile);
    });

    it('should show an inline error for an invalid file type', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      const dropZone = screen.getByText('Drag a PDF file here or click to choose').parentElement!;
      const wrongFile = new File(['content'], 'test.txt', { type: 'text/plain' });

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [wrongFile] }
      });

      expect(screen.getByRole('alert')).toHaveTextContent('Please choose a PDF file.');
      expect(alertSpy).not.toHaveBeenCalled(); // kein blockierendes window.alert
      expect(mockOnLoadFile).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });
  });

  describe('Drag Events', () => {
    it('should apply drag over styling on dragOver', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      const dropZone = screen.getByText('Drag a PDF file here or click to choose').parentElement!;
      
      fireEvent.dragOver(dropZone);
      
      // Check that green color classes are applied (PDF uses green)
      expect(dropZone).toHaveClass('border-green-500');
    });

    it('should remove drag over styling on dragLeave', () => {
      render(
        <DocumentSelector
          config={PDF_CONFIG}
          state={{ isLoading: false, error: null, fileName: null }}
          onLoadFile={mockOnLoadFile}
          onReset={mockOnReset}
        />
      );

      const dropZone = screen.getByText('Drag a PDF file here or click to choose').parentElement!;
      
      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);
      
      expect(dropZone).not.toHaveClass('border-green-500');
    });
  });

  describe('Pre-configured Configs', () => {
    it('PDF_CONFIG should have correct properties', () => {
      expect(PDF_CONFIG.type).toBe('pdf');
      expect(PDF_CONFIG.mimeType).toBe('application/pdf');
      expect(PDF_CONFIG.extension).toBe('.pdf');
      expect(PDF_CONFIG.color).toBe('green');
      expect(PDF_CONFIG.label).toBe('PDF file');
    });

    it('EPUB_CONFIG should have correct properties', () => {
      expect(EPUB_CONFIG.type).toBe('epub');
      expect(EPUB_CONFIG.mimeType).toBe('application/epub+zip');
      expect(EPUB_CONFIG.extension).toBe('.epub');
      expect(EPUB_CONFIG.color).toBe('purple');
      expect(EPUB_CONFIG.label).toBe('ePub file');
    });
  });
});
