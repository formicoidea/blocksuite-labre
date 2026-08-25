import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/components',
    // Scoped on purpose: this package has no historical unit suite, so only
    // the specs added alongside a harness-aware component run here.
    include: [
      'src/__tests__/icon-picker*.unit.spec.ts',
      'src/__tests__/context-menu*.unit.spec.ts',
    ],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
