import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        knn: resolve(__dirname, 'knn/index.html'),
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
