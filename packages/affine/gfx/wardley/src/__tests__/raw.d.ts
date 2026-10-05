/**
 * Vite's `?raw` import suffix, typed — the same declaration the integration
 * suite carries (`integration-test/src/__tests__/raw.d.ts`).
 *
 * The SVG corpus is read by browser-mode specs (DOMPurify needs a real DOM),
 * and a browser-mode spec has no `node:fs`, so a fixture on disk reaches it
 * imported as a string.
 *
 * Ambient on purpose — no top-level `import` or `export` in this file — so the
 * declaration is global rather than a module augmentation.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
