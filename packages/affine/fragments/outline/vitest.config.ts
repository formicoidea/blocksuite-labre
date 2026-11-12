import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/fragments/outline',
    // Scoped on purpose: this package has no historical unit suite, so only
    // the specs added since (the i18n fix, the settings switch) run here.
    include: [
      'src/__tests__/translations.unit.spec.ts',
      'src/__tests__/outline-setting-menu.unit.spec.ts',
    ],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
