/**
 * Loaded first in the policy frame of `canvas-viewer-csp.spec.ts`. Vitest's
 * browser mode rewrites every dynamic `import()` it serves into
 * `__vitest_browser_runner__.wrapDynamicImport(…)`, a global only its own test
 * frame defines: without it, the library's first lazy import throws in the
 * policy frame. A test-server artefact, never shipped.
 */
const runner = globalThis as unknown as {
  __vitest_browser_runner__?: {
    wrapDynamicImport: <T>(load: () => Promise<T>) => Promise<T>;
  };
};
runner.__vitest_browser_runner__ ??= { wrapDynamicImport: load => load() };

export {};
