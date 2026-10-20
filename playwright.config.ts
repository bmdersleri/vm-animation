import { defineConfig } from '@playwright/test';

/**
 * End-to-end checks in system Chrome against the production build served by
 * `vite preview` (port 4173; the dev server on 5180 is left alone). Tests run
 * one at a time so the performance budgets are not measured under contention.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // keep rAF and timers at full rate for the smoothness measurements
      args: [
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/knn/',
    // always build and serve a fresh copy of the current sources
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
