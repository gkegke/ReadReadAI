import { defineConfig, mergeConfig, defaultExclude } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Explicitly excludes Playwright E2E tests to prevent matcher collisions.
 */
export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      ...defaultExclude,
      'e2e/**',
      '**/node_modules/**',
    ],
    // Ensures CSS isn't processed in unit tests for speed
    css: false,
  },
}))
