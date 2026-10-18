import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { emulatedHosts } from './build/emulated-hosts.ts';
import { emulatedStyles } from './build/emulated-styles.ts';

// The React port of ../admin-ng-starter: the same pages, look and behaviour. It runs on 4300, so both apps can be open
// side by side (the Angular one on 4200); /api reaches the backend, such as ../admin-api-starter on port 8080.
export default defineConfig({
  // Components' hosts marked for their styles' boundaries (build/emulated-hosts.ts)
  plugins: [emulatedHosts(), react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    // Components' styles kept to them, as Angular's emulated encapsulation does (build/emulated-styles.ts)
    postcss: { plugins: [emulatedStyles()] },
    preprocessorOptions: {
      // As the Angular app: `@use 'assets/scss/fonts'` from src
      scss: { loadPaths: [fileURLToPath(new URL('./src', import.meta.url))] },
    },
  },
  server: {
    port: 4300,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:8080', secure: false, changeOrigin: false } },
  },
  preview: { port: 4300, strictPort: true },
});
