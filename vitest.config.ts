import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * [STABILITY: CRITICAL] Migrated to Standard Vite 6.
 * Standardizes resolution logic and removes experimental Rolldown workarounds.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    
    // Ensure Dexie and project DB are processed by Vitest
    server: {
      deps: {
        inline: [
          'dexie',
          /src\/shared\/db/
        ],
      }
    },
    
    pool: 'threads',
  },
});