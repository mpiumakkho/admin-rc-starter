import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

/**
 * Unit tests next to the code (*.spec.ts, *.spec.tsx), in jsdom, with describe/it/expect as globals as in the Angular
 * app's tests: npm test.
 */
export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
}));
