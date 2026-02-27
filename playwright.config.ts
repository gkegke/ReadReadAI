import { defineConfig, devices } from '@playwright/test';

/**
 * [ARCHITECTURE] Playwright Configuration
 * Explicitly restricts Playwright to the E2E directory to prevent it from 
 * picking up Vitest unit tests and causing `expect` matcher collisions.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  
  projects:[
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // Optionally boot the dev server automatically for E2E runs
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});