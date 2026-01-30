import React from 'react';
import ReactDOM from 'react-dom/client';
import { Reader } from './Reader';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReaderProvider } from '@/contexts/ReaderContext';
import '../styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ReaderProvider>
        <Reader />
      </ReaderProvider>
    </ThemeProvider>
  </React.StrictMode>
);
