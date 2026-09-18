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
      'src/__tests__/toggle-button*.unit.spec.ts',
      'src/__tests__/resolve-palette-label*.unit.spec.ts',
      'src/__tests__/framework-palette*.unit.spec.ts',
      'src/__tests__/palette-carousel*.unit.spec.ts',
      'src/__tests__/resource-controller*.unit.spec.ts',
    ],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
