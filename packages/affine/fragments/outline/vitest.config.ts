import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/fragments/outline',
    // Scoped on purpose: this package has no historical unit suite, so only
    // the spec added alongside the i18n fix runs here.
    include: ['src/__tests__/translations.unit.spec.ts'],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
