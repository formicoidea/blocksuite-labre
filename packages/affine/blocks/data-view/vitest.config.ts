import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  plugins: [vanillaExtractPlugin()],
  test: {
    root: './packages/affine/blocks/data-view',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    // The data source pulls the database block and the data-view views: on a
    // cold transform cache the first import costs seconds, not milliseconds.
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
