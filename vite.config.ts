import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM config: no __dirname
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        knn: resolve(root, 'knn/index.html'),
        'karar-agaci': resolve(root, 'karar-agaci/index.html'),
        'naive-bayes': resolve(root, 'naive-bayes/index.html'),
        'iqr-aykiri': resolve(root, 'iqr-aykiri/index.html'),
        'olcekleme': resolve(root, 'olcekleme/index.html'),
        'pca': resolve(root, 'pca/index.html'),
        'ozellik-secimi': resolve(root, 'ozellik-secimi/index.html'),
        'karmasiklik-matrisi': resolve(root, 'karmasiklik-matrisi/index.html'),
        'roc-esik': resolve(root, 'roc-esik/index.html'),
        'capraz-dogrulama': resolve(root, 'capraz-dogrulama/index.html'),
        'k-means': resolve(root, 'k-means/index.html'),
        'k-secimi': resolve(root, 'k-secimi/index.html'),
        'dbscan': resolve(root, 'dbscan/index.html'),
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
