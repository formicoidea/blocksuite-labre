import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  plugins: [vanillaExtractPlugin()],
  test: {
    root: './packages/affine/blocks/note',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 2000,
    environment: 'happy-dom',
  },
});
