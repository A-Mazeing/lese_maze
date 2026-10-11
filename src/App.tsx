import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReaderProvider } from '@/contexts/ReaderContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Reader } from '@/reader/Reader';

/**
 * Entwicklungs-Einstieg im normalen Browser (`npm run dev`, ohne Erweiterungs-API).
 * Die Erweiterung selbst nutzt die Einstiegspunkte unter src/popup und src/reader.
 */
function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <ReaderProvider>
          <Reader />
        </ReaderProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
