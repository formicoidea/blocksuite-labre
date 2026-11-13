/**
 * Runs inside the frame `canvas-viewer-csp.spec.ts` opens under Labre Sites'
 * Content-Security-Policy: builds a stored page, mounts the read-only canvas
 * viewer on it, waits until the shape is painted, then reports what got
 * painted and every report the policy raised.
 * Not a spec: the spec loads it with a `<script type="module" src>`, the only
 * script the policy lets in.
 */
import { mountCanvasViewer } from '@labre/affine/canvas-viewer';
import { StoreExtensionManager } from '@labre/affine/ext-loader';
import { getInternalStoreExtensions } from '@labre/affine/extensions/store';
import { Text, WorkspaceImpl } from '@labre/store';
import * as Y from 'yjs';

/** The fill of the shape the spec looks for, as `#rrggbb` and in RGB. */
export const SHAPE_FILL = '#ffd666';
const FILL_RGB = [0xff, 0xd6, 0x66] as const;

/** How far a painted pixel may be from the fill (anti-aliasing, blending). */
const COLOUR_TOLERANCE = 12;

/** Enough pixels of the shape's fill to be a painted 400×200 rectangle. */
export const PAINTED_MIN = 1000;

/** Sub-pixel rounding allowed when comparing two boxes. */
const BOX_SLOP_PX = 0.5;

/** The frame's stored title, which its badge shows. */
export const FRAME_TITLE = 'The map';

/** How long the viewer may take to paint, imports included. */
const PAINT_DEADLINE_MS = 60_000;

/** Frames the page stays quiet once painted, for late policy reports. */
const SETTLE_FRAMES = 10;

/** The editor's editing chrome, which the viewer leaves out (ADR 0051). */
const EDITING_CHROME = [
  'affine-toolbar-widget',
  'edgeless-toolbar-widget',
  'affine-edgeless-zoom-toolbar-widget',
  'affine-keyboard-toolbar-widget',
  'edgeless-selected-rect',
  'affine-drag-handle-widget',
];

export type PolicyReport = {
  directive: string;
  source: string;
  line: number;
  /** The element whose `style` attribute or `<style>` was refused. */
  target: string;
};

export type FrameReport = {
  painted: number;
  root: boolean;
  styleElements: number;
  /** The frame's title badge, when the editor drew one. */
  badge: {
    text: string;
    shown: boolean;
    /** The badge lies inside the viewer's box, so the reader sees it. */
    inside: boolean;
    /** Where it is, against the viewer, for a failing run. */
    box: string;
  } | null;
  /** Editing chrome found in the viewer, by tag. */
  chrome: string[];
  /** Font faces the document holds after the mount. */
  fonts: string[];
  violations: PolicyReport[];
};

const describeTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return String(target);
  const classes = [...target.classList].join('.');
  const style = target.getAttribute('style');
  return `${target.tagName.toLowerCase()}${classes ? `.${classes}` : ''}${
    style ? ` style="${style}"` : ''
  }`;
};

const violations: PolicyReport[] = [];
document.addEventListener('securitypolicyviolation', event => {
  violations.push({
    directive: event.violatedDirective,
    source: event.sourceFile,
    line: event.lineNumber,
    target: describeTarget(event.target),
  });
});

/**
 * A page: a frame holding a shape, a card linked to another page, a note of
 * formatted text and a note shown
 * in the page only (the editor draws nothing for it on the canvas), and a note
 * far outside the frame. What a published canvas commonly holds, so a block
 * that writes a `style` attribute shows up here.
 */
function storedPage(): Uint8Array {
  const workspace = new WorkspaceImpl({ id: 'csp-frame' });
  workspace.storeExtensions = new StoreExtensionManager(
    getInternalStoreExtensions()
  ).get('store');
  workspace.meta.initialize();
  const doc = workspace.createDoc('page');
  const store = doc.getStore();
  store.load();
  let surfaceId = '';
  store.transact(() => {
    const page = store.addBlock('affine:page', { title: new Text('A map') });
    surfaceId = store.addBlock('affine:surface', {}, page);
    store.addBlock(
      'affine:frame',
      { id: 'frame-1', title: new Text(FRAME_TITLE), xywh: '[0,0,600,400]' },
      surfaceId
    );
    const inside = store.addBlock(
      'affine:note',
      { xywh: '[100,320,400,60]' },
      page
    );
    store.addBlock(
      'affine:paragraph',
      {
        text: new Text([
          { insert: 'Bold', attributes: { bold: true } },
          { insert: ' and ' },
          { insert: 'a link', attributes: { link: 'https://example.com' } },
        ]),
      },
      inside
    );
    // A card linked to another page: the editor draws its icons.
    store.addBlock(
      'affine:embed-linked-doc',
      { pageId: 'another-page', xywh: '[320,10,248,80]' },
      surfaceId
    );
    const pageOnly = store.addBlock(
      'affine:note',
      { xywh: '[20,20,200,60]', displayMode: 'doc' },
      page
    );
    store.addBlock('affine:paragraph', { text: new Text('Page') }, pageOnly);
    const outside = store.addBlock(
      'affine:note',
      { xywh: '[2000,2000,300,100]' },
      page
    );
    store.addBlock('affine:paragraph', { text: new Text('Outside') }, outside);
  });
  const surface = store.getBlock(surfaceId)?.model as unknown as {
    addElement: (props: Record<string, unknown>) => string;
  };
  surface.addElement({
    type: 'shape',
    shapeType: 'rect',
    xywh: '[100,100,400,200]',
    fillColor: SHAPE_FILL,
    filled: true,
  });
  const state = Y.encodeStateAsUpdate(doc.spaceDoc);
  workspace.dispose();
  return state;
}

/** Pixels of every canvas in `root` within tolerance of the shape's fill. */
function paintedPixels(root: HTMLElement): number {
  return [...root.querySelectorAll('canvas')].reduce((count, canvas) => {
    if (!canvas.width || !canvas.height) return count;
    const data = canvas
      .getContext('2d')
      ?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return count;
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs((data[i] ?? 0) - FILL_RGB[0]) <= COLOUR_TOLERANCE &&
        Math.abs((data[i + 1] ?? 0) - FILL_RGB[1]) <= COLOUR_TOLERANCE &&
        Math.abs((data[i + 2] ?? 0) - FILL_RGB[2]) <= COLOUR_TOLERANCE &&
        (data[i + 3] ?? 0) > 0
      ) {
        hits++;
      }
    }
    return count + hits;
  }, 0);
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Resolves once `done()` holds, checked every frame, or at the deadline. */
async function until(done: () => boolean) {
  const deadline = performance.now() + PAINT_DEADLINE_MS;
  while (!done() && performance.now() < deadline) await nextFrame();
}

/** The frame's badge, read through the open shadow roots of the widgets. */
function badgeOf(host: HTMLElement): FrameReport['badge'] {
  const badge = host
    .querySelector('affine-frame-title-widget')
    ?.shadowRoot?.querySelector<HTMLElement>('affine-frame-title');
  if (!badge) return null;
  const box = badge.getBoundingClientRect();
  const frame = host.getBoundingClientRect();
  return {
    text: (badge.shadowRoot ?? badge).textContent?.trim() ?? '',
    shown: getComputedStyle(badge).display !== 'none' && box.height > 0,
    inside:
      box.top >= frame.top - BOX_SLOP_PX &&
      box.left >= frame.left - BOX_SLOP_PX &&
      box.bottom <= frame.bottom + BOX_SLOP_PX &&
      box.top < frame.bottom,
    box: [box.top, box.bottom, frame.top, frame.bottom]
      .map(Math.round)
      .join(' '),
  };
}

window.addEventListener('message', event => {
  const data = event.data as { type?: string; focus?: boolean } | null;
  if (data?.type !== 'mount') return;
  void mount(!!data.focus);
});

async function mount(focus: boolean) {
  const host = document.createElement('div');
  host.style.width = '800px';
  // A frozen frame takes its height from its proportions; a canvas page
  // fills its host.
  if (!focus) host.style.height = '600px';
  document.body.replaceChildren(host);
  const viewer = mountCanvasViewer(
    host,
    storedPage(),
    focus ? { focus: { kind: 'frame', id: 'frame-1' } } : {}
  );
  await until(
    () => paintedPixels(host) > PAINTED_MIN && (badgeOf(host)?.shown ?? false)
  );
  await Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
    previous => previous.then(nextFrame),
    Promise.resolve()
  );
  const report: FrameReport & { type: 'painted' } = {
    type: 'painted',
    painted: paintedPixels(host),
    root: host.querySelector('affine-edgeless-root') !== null,
    styleElements: document.querySelectorAll('style:not([data-vite-dev-id])')
      .length,
    badge: badgeOf(host),
    chrome: EDITING_CHROME.filter(tag => host.querySelector(tag)),
    fonts: [...document.fonts].map(
      face => `${face.family} ${face.weight} ${face.style}`
    ),
    violations: [...violations],
  };
  viewer.dispose();
  window.parent.postMessage(report, '*');
}

window.addEventListener('error', event => {
  window.parent.postMessage({ type: 'error', message: event.message }, '*');
});
window.addEventListener('unhandledrejection', event => {
  window.parent.postMessage(
    { type: 'error', message: String(event.reason) },
    '*'
  );
});

window.parent.postMessage({ type: 'ready' }, '*');
