/**
 * The read-only canvas viewer paints a published canvas in a real browser
 * under a public page's strict Content-Security-Policy (ADR 0050, ADR 0051).
 *
 * The 3.5.0-rc.0 viewer mounted on Labre's site and drew nothing: every
 * light-DOM component and emotion wrote its styles into `<style>` elements and
 * the code highlighter compiled WebAssembly, which the page's policy refused.
 * Here the viewer runs in a frame whose policy is stricter than the site's
 * (no `'wasm-unsafe-eval'` either), on a page whose frame holds a shape.
 *
 * What it would catch:
 * - a viewer that mounts but paints no shape, on a whole canvas or on one
 *   frame frozen in a page;
 * - any `<style>` element, inline style element or WebAssembly the library
 *   asks the browser for (a policy report whose source is not Vite's own dev
 *   CSS injection, which only the test server performs).
 */
import { describe, expect, test } from 'vitest';

/** Labre's viewer-page policy, without `'wasm-unsafe-eval'`. */
const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
].join('; ');

/** Enough pixels of the shape's fill to be a painted 400×200 rectangle. */
const PAINTED_MIN = 1000;

type Report = {
  painted: number;
  root: boolean;
  styleElements: number;
  violations: { directive: string; source: string }[];
};

/** The dev server injects each CSS module itself: not the library's doing. */
const fromLibrary = (violation: { source: string }) =>
  !/\/@vite\/client|\.css(\?|$)|\.vanilla\.css/.test(violation.source);

async function mountUnderPolicy(focus: boolean): Promise<Report> {
  const shim = new URL('./canvas-viewer-csp-shim.ts', import.meta.url).href;
  const script = new URL('./canvas-viewer-csp-frame.ts', import.meta.url).href;
  const frame = document.createElement('iframe');
  frame.style.width = '820px';
  frame.style.height = '640px';
  frame.srcdoc =
    `<!doctype html><html><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${POLICY}">` +
    `</head><body><script type="module" src="${shim}"></script>` +
    `<script type="module" src="${script}"></script></body></html>`;
  const messages = new Promise<Report>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('the framed viewer never reported')),
      60_000
    );
    window.addEventListener('message', function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string } & Partial<Report>;
      if (data.type === 'ready') {
        frame.contentWindow?.postMessage({ type: 'mount', focus }, '*');
      }
      if (data.type === 'painted') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data as Report);
      }
    });
  });
  document.body.append(frame);
  try {
    return await messages;
  } finally {
    frame.remove();
  }
}

describe('the canvas viewer under a strict Content-Security-Policy', () => {
  test('paints a whole canvas, with nothing refused', async () => {
    const report = await mountUnderPolicy(false);
    expect(report.root).toBe(true);
    expect(report.painted).toBeGreaterThan(PAINTED_MIN);
    expect(report.styleElements).toBe(0);
    expect(report.violations.filter(fromLibrary)).toEqual([]);
  }, 90_000);

  test('paints one frame frozen in a page, with nothing refused', async () => {
    const report = await mountUnderPolicy(true);
    expect(report.root).toBe(true);
    expect(report.painted).toBeGreaterThan(PAINTED_MIN);
    expect(report.styleElements).toBe(0);
    expect(report.violations.filter(fromLibrary)).toEqual([]);
  }, 90_000);
});
