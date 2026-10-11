import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: { '@': srcDir },
  },
  build: {
    target: 'chrome110',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Der Reader wird per chrome.tabs.create geöffnet und steht deshalb nicht im
      // Manifest. Popup und Service Worker erkennt @crxjs automatisch.
      input: {
        reader: fileURLToPath(new URL('./src/reader/index.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules/epubjs') || id.includes('node_modules/jszip')) return 'epub';
          if (id.includes('node_modules/react-virtuoso')) return 'virtuoso';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
