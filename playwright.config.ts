import { defineConfig } from '@playwright/test';

/**
 * End-to-end checks in system Chrome against the production build served by
 * `vite preview` (port 4173; the dev server on 5180 is left alone). Functional
 * specs run in parallel; the performance specs (`*.perf.spec.ts`) run in their
 * own project, one at a time, so budgets are not measured under contention.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  workers: '50%',
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  projects: [
    { name: 'islevsel', testIgnore: '**/*.perf.spec.ts', fullyParallel: true },
    { name: 'performans', testMatch: '**/*.perf.spec.ts' },
  ],
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
