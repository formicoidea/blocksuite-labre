import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/gfx/bpmn',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 1000,
    environment: 'happy-dom',
    // DOMPurify reads `nodeName` off `Node.prototype`; happy-dom needs telling.
    setupFiles: ['../../blocks/surface/src/__tests__/happy-dom-node-name.ts'],
  },
});
