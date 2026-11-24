import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

const TEST_TIMEOUT_MS = 10_000;

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  // config.ts reaches the note block, whose styles are vanilla-extract `.css.ts`.
  plugins: [vanillaExtractPlugin()],
  test: {
    root: './packages/affine/widgets/keyboard-toolbar',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: TEST_TIMEOUT_MS,
    environment: 'happy-dom',
  },
});
