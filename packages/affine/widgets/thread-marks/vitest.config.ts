import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    root: './packages/affine/widgets/thread-marks',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
