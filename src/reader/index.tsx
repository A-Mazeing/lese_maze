import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReaderProvider } from '@/contexts/ReaderContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Reader } from './Reader';
import '../styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Wurzelelement #root fehlt.');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <ReaderProvider>
          <Reader />
        </ReaderProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
