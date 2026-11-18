/**
 * The read-only canvas viewer paints a published canvas in a real browser
 * under Labre Sites' exact Content-Security-Policy (ADR 0050, ADR 0051).
 *
 * The 3.5.0-rc.0 viewer mounted on Labre's site and drew nothing: every
 * light-DOM component and emotion wrote its styles into `<style>` elements and
 * the code highlighter compiled WebAssembly, which the page's policy refused.
 * rc.1 drew, but the frame inserted in a page raised 48 `style-src-attr`
 * reports on the site, and this spec, under a looser policy with
 * `style-src-attr 'unsafe-inline'`, could not see an attribute report. Here the viewer runs
 * in a frame under the site's own policy: no `'unsafe-inline'` anywhere, no
 * `style-src-attr`, no `'wasm-unsafe-eval'`, `default-src 'none'`.
 *
 * What it would catch:
 * - a viewer that mounts but paints no shape, on a whole canvas or on one
 *   frame frozen in a page;
 * - any `<style>` element, `style` attribute or WebAssembly the library asks
 *   the browser for (a policy report whose source is not Vite's own dev CSS
 *   injection or its socket, which only the test server performs);
 * - a frame inserted in a page that loses its title badge, or shows the
 *   editor's editing chrome;
 * - an `eval` the library asks for. zod 4 probes `new Function` when it
 *   builds its first object schema (ADR 0052): the frame loads first the one
 *   module a host under such a policy owns (`canvas-viewer-csp-host.ts`,
 *   zod's `jitless`), and a frame without it shows the report it prevents.
 * - a block that writes its style as a `style` text instead of through
 *   `styleMap` (#668): a constant text such as the table's
 *   `display: contents` is one report per template, and a text built from
 *   a value, such as the divider's `padding-left`, is refused and lost on
 *   screen, so the divider's children container is also measured.
 */
import { describe, expect, test } from 'vitest';

import {
  FRAME_TITLE,
  type FrameReport,
  PAINTED_MIN,
  type PolicyReport,
} from './canvas-viewer-csp-frame';

/** Labre Sites' policy, as the site sends it (its hashes cover its own CSS). */
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
].join('; ');

/** The divider's children container padding, `BLOCK_CHILDREN_CONTAINER_PADDING_LEFT`. */
const DIVIDER_PADDING = '24px';

/** Imports of the whole view graph through the dev server, then the paint. */
const REPORT_DEADLINE_MS = 180_000;

/** The test outlives the frame's own deadline, so that one reports first. */
const TEST_TIMEOUT_MS = REPORT_DEADLINE_MS + 10_000;

/**
 * What the test server does on its own: its CSS modules, its socket. The
 * pattern matches a source such as "/@vite/client", "x.css?direct" or
 * "x.css.ts.vanilla.css", never "/packages/affine/all/src/canvas-viewer.ts".
 */
const fromLibrary = (violation: PolicyReport) =>
  !/\/@vite\/client|\.css(\?|$)|\.vanilla\.css/.test(violation.source) &&
  violation.directive !== 'connect-src';

/**
 * The two reports the library still raises, with no effect on screen.
 *
 * - `@atlaskit/pragmatic-drag-and-drop` preloads, when `@labre/std`'s drag
 *   and drop module is imported, the 1×1 transparent `data:` gif it sets as
 *   the native drag image. Under `default-src 'none'` the image is refused;
 *   nothing is dragged on a read-only page, and a refused preload paints
 *   nothing.
 * - `@blocksuite/icons` binds `style="user-select:none;flex-shrink:0;"`, plus
 *   what its caller adds, on each icon as a string, which the policy refuses
 *   (`style-src-attr`): one report per icon drawn. The viewer's adopted sheet
 *   carries those declarations (`canvas-viewer.ts`, `adoptViewerStyles`), so
 *   only an icon whose refused declarations are all in {@link ICON_DECLARATIONS}
 *   is let through; a caller adding another one fails here.
 */
const isDragPreviewPreload = (violation: PolicyReport) =>
  violation.directive === 'img-src' &&
  violation.source.includes('disable-native-drag-preview');

/** The declarations icons ask for that the viewer's sheet stands in for. */
const ICON_DECLARATIONS = new Set([
  'user-select:none',
  'flex-shrink:0',
  'vertical-align:middle',
  'font-size:inherit',
  'margin-bottom:0.1em',
]);

const isIconStyle = (violation: PolicyReport) => {
  const style = /^svg style="([^"]*)"$/.exec(violation.target)?.[1];
  return (
    violation.directive === 'style-src-attr' &&
    style !== undefined &&
    style
      .split(';')
      .filter(Boolean)
      .every(declaration => ICON_DECLARATIONS.has(declaration.trim()))
  );
};

/** Every report, counted by directive, for the run's log. */
const tally = (report: FrameReport) =>
  report.violations.reduce<Record<string, number>>((counts, violation) => {
    const key = `${violation.directive}${fromLibrary(violation) ? '' : ' (dev server)'}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

/** Everything the library asked for that the policy refused, bar the above. */
const refused = (report: FrameReport) =>
  report.violations.filter(
    violation =>
      fromLibrary(violation) &&
      !isDragPreviewPreload(violation) &&
      !isIconStyle(violation)
  );

/** A document under {@link POLICY} running these module scripts, in order. */
function policyDocument(scripts: string[]): string {
  const tags = scripts
    .map(path => new URL(path, import.meta.url).href)
    .map(src => `<script type="module" src="${src}"></script>`)
    .join('');
  return (
    `<!doctype html><html><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${POLICY}">` +
    `</head><body>${tags}</body></html>`
  );
}

async function mountUnderPolicy(focus: boolean): Promise<FrameReport> {
  const frame = document.createElement('iframe');
  frame.style.width = '820px';
  frame.style.height = '640px';
  // The shim, then the host's own first module, then the viewer.
  frame.srcdoc = policyDocument([
    './canvas-viewer-csp-shim.ts',
    './canvas-viewer-csp-host.ts',
    './canvas-viewer-csp-frame.ts',
  ]);
  let stage = 'loading';
  const messages = new Promise<FrameReport>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the framed viewer never reported (${stage})`)),
      REPORT_DEADLINE_MS
    );
    window.addEventListener('message', function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string; message?: string };
      if (data.type === 'ready') {
        stage = 'mounting';
        frame.contentWindow?.postMessage({ type: 'mount', focus }, '*');
      }
      if (data.type === 'error') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error(`the framed viewer threw: ${data.message}`));
      }
      if (data.type === 'painted') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data as unknown as FrameReport);
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

describe('the canvas viewer under the site Content-Security-Policy', () => {
  test(
    'paints a whole canvas, with nothing refused',
    async () => {
      const report = await mountUnderPolicy(false);
      console.info(
        '[csp] whole canvas',
        JSON.stringify(tally(report)),
        JSON.stringify(report.badge)
      );
      expect(report.root).toBe(true);
      expect(report.painted).toBeGreaterThan(PAINTED_MIN);
      expect(report.styleElements).toBe(0);
      expect(refused(report)).toEqual([]);
      expect(report.dividerPadding).toBe(DIVIDER_PADDING);
      // The editor's own badge, without its editing chrome.
      expect(report.badge).toMatchObject({ text: FRAME_TITLE, shown: true });
      expect(report.chrome).toEqual([]);
    },
    TEST_TIMEOUT_MS
  );

  test(
    'paints one frame frozen in a page, its badge shown, with nothing refused',
    async () => {
      const report = await mountUnderPolicy(true);
      console.info(
        '[csp] frozen frame',
        JSON.stringify(tally(report)),
        JSON.stringify(report.badge)
      );
      expect(report.root).toBe(true);
      expect(report.painted).toBeGreaterThan(PAINTED_MIN);
      expect(report.styleElements).toBe(0);
      expect(refused(report)).toEqual([]);
      expect(report.dividerPadding).toBe(DIVIDER_PADDING);
      expect(report.badge).toMatchObject({
        text: FRAME_TITLE,
        shown: true,
        inside: true,
      });
      expect(report.chrome).toEqual([]);
    },
    TEST_TIMEOUT_MS
  );
});

/** The store's modules under {@link POLICY}, without the host's zod line. */
async function probeWithoutJitless(): Promise<PolicyReport[]> {
  const frame = document.createElement('iframe');
  frame.srcdoc = policyDocument([
    './canvas-viewer-csp-shim.ts',
    './canvas-viewer-csp-probe.ts',
  ]);
  const reports = new Promise<PolicyReport[]>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('the probe frame never reported')),
      REPORT_DEADLINE_MS
    );
    window.addEventListener('message', function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as {
        type?: string;
        message?: string;
        violations?: PolicyReport[];
      };
      if (data.type !== 'probed' && data.type !== 'error') return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (data.type === 'error') {
        reject(new Error(`the probe frame threw: ${data.message}`));
        return;
      }
      resolve(data.violations ?? []);
    });
  });
  document.body.append(frame);
  try {
    return await reports;
  } finally {
    frame.remove();
  }
}

describe("zod's eval probe under the site Content-Security-Policy", () => {
  test(
    'is reported when the host does not set jitless first',
    async () => {
      const violations = await probeWithoutJitless();
      console.info('[csp] without jitless', JSON.stringify(violations));
      // Chromium names a refused `new Function` with the blocked URI `eval`.
      expect(
        violations.some(
          violation =>
            violation.directive.startsWith('script-src') &&
            violation.target === 'eval'
        )
      ).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
