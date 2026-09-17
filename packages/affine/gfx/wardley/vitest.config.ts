import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/gfx/wardley',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 1000,
    environment: 'happy-dom',
    // The `.svg` capability sanitizes with DOMPurify, which reads tag names
    // through `Node.prototype` — empty under happy-dom without this.
    setupFiles: ['../../../../scripts/vitest-node-name-setup.js'],
  },
});
