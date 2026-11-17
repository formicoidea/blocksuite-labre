/**
 * The read-only canvas viewer draws the document title at the head of the
 * page's note, as the editor does (issue #668).
 *
 * 3.5.0 mounted the viewer as the editor's view registry minus its tooling
 * (ADR 0051) and filed `DocTitleViewExtension` with the panels: its provider
 * is what defines `<doc-title>` and `<labre-title-band>`, which the page
 * note's head (`edgeless-page-block-title`) renders. The elements stayed
 * undefined, so the published canvas lost its page title, which 3.4.0 drew.
 * The unit guard (`read-only-view.unit.spec.ts`) only looks for block views
 * and canvas renderers, never for a custom element a kept view renders.
 *
 * Here the viewer runs in a frame of its own, so a `<doc-title>` defined by
 * an earlier spec's editor in the suite's shared page cannot mask the gap.
 *
 * What it would catch:
 * - a page note whose head renders a title element nobody defined, or no
 *   visible title;
 * - any other custom element the viewer's kept views render but whose
 *   defining provider sits in `READ_ONLY_EXCLUDED_VIEW_EXTENSIONS`.
 */
import { describe, expect, test } from 'vitest';

import { PAGE_TITLE, type TitleReport } from './canvas-viewer-page-title-frame';

/** Imports of the whole view graph through the dev server, then the paint. */
const REPORT_DEADLINE_MS = 180_000;

/** The test outlives the frame's own deadline, so that one reports first. */
const REPORT_MARGIN_MS = 10_000;
const TEST_TIMEOUT_MS = REPORT_DEADLINE_MS + REPORT_MARGIN_MS;

async function mountInFrame(): Promise<TitleReport> {
  const shim = new URL('./canvas-viewer-csp-shim.ts', import.meta.url).href;
  const script = new URL('./canvas-viewer-page-title-frame.ts', import.meta.url)
    .href;
  const frame = document.createElement('iframe');
  frame.style.width = '820px';
  frame.style.height = '640px';
  frame.srcdoc =
    `<!doctype html><html><head></head><body>` +
    `<script type="module" src="${shim}"></script>` +
    `<script type="module" src="${script}"></script></body></html>`;
  const messages = new Promise<TitleReport>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('the framed viewer never reported')),
      REPORT_DEADLINE_MS
    );
    window.addEventListener('message', function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string; message?: string };
      if (data.type === 'ready') {
        frame.contentWindow?.postMessage({ type: 'mount' }, '*');
      }
      if (data.type === 'error') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error(`the framed viewer threw: ${data.message}`));
      }
      if (data.type === 'painted') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data as unknown as TitleReport);
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

describe('the canvas viewer draws the page title', () => {
  test(
    'at the head of the page note, with every custom element defined',
    async () => {
      const report = await mountInFrame();
      expect(report.head).toBe(true);
      expect(report.docTitle).toMatchObject({
        present: true,
        defined: true,
        text: PAGE_TITLE,
      });
      expect(report.docTitle.height).toBeGreaterThan(0);
      expect(report.titleBand).toMatchObject({ present: true, defined: true });
      expect(report.undefinedElements).toEqual([]);
    },
    TEST_TIMEOUT_MS
  );
});
