import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReaderProvider } from '@/contexts/ReaderContext';
import { Reader } from '@/reader/Reader';

/**
 * Main App Component.
 * Dies wird für die Entwicklung im Browser verwendet.
 * Die Extension verwendet separate Entry-Points (popup, reader).
 */
function App() {
  return (
    <ThemeProvider>
      <ReaderProvider>
        <Reader />
      </ReaderProvider>
    </ThemeProvider>
  );
}

export default App;
