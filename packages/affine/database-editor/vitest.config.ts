import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  // The database block this package extends styles itself with
  // vanilla-extract (`.css.ts`), which needs its plugin to load in a test.
  plugins: [vanillaExtractPlugin()],
  test: {
    root: './packages/affine/database-editor',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 2000,
    environment: 'happy-dom',
  },
});
