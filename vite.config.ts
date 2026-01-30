import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './public/manifest.json'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        reader: resolve(__dirname, 'src/reader/index.html'),
      },
      output: {
        manualChunks: {
          'pdf-worker': ['pdfjs-dist'],
          'epub': ['epubjs'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'epubjs'],
  },
})
