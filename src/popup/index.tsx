import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Popup } from './Popup';
import '../styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Wurzelelement #root fehlt.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  </StrictMode>,
);
