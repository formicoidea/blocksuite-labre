/**
 * Vite's `?raw` import suffix, typed.
 *
 * A browser-mode spec has no `node:fs`, so a fixture that lives on disk reaches
 * it the way every other asset in a Vite app does: imported as a string. The
 * unit suites next door read the same files with `readFileSync`, which is how
 * one corpus serves both without being checked in twice.
 *
 * Ambient on purpose — no top-level `import` or `export` in this file — so the
 * declaration is global rather than a module augmentation of a module that does
 * not exist.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
