import { defineConfig } from 'vitest/config';

// The specs that run DOMPurify, which supports a real browser's DOM and not
// happy-dom's. Same setup as `blocks/surface`, whose parser they call.
export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    name: '@labre/affine-gfx-wardley-browser',
    browser: {
      enabled: true,
      headless: true,
      name: 'chromium',
      provider: 'playwright',
      isolate: false,
      providerOptions: {},
    },
    include: ['src/__tests__/**/*.browser.spec.ts'],
    testTimeout: 1000,
  },
});
