import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initLanguage } from '@/i18n';
import App from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Wurzelelement #root fehlt.');

// Sprache vor dem ersten Rendern laden, damit nichts in der falschen Sprache aufblitzt.
void initLanguage().finally(() =>
  createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
  ),
);
