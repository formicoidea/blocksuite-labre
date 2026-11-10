/**
 * Runs inside the frame `canvas-viewer-csp.spec.ts` opens under a strict
 * Content-Security-Policy: builds a stored page, mounts the read-only canvas
 * viewer on it, then reports what got painted and what the policy refused.
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

const violations: { directive: string; source: string }[] = [];
document.addEventListener('securitypolicyviolation', event => {
  violations.push({
    directive: event.violatedDirective,
    source: event.sourceFile,
  });
});

/** A page: a frame holding a shape, and a note far outside the frame. */
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
      { id: 'frame-1', title: new Text('The map'), xywh: '[0,0,600,400]' },
      surfaceId
    );
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

const frames = (n: number) =>
  new Promise<void>(resolve => {
    const step = (left: number) =>
      left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
    step(n);
  });

window.addEventListener('message', event => {
  const data = event.data as { type?: string; focus?: boolean } | null;
  if (data?.type !== 'mount') return;
  const host = document.createElement('div');
  host.style.width = '800px';
  // A frozen frame takes its height from its proportions; a canvas page
  // fills its host.
  if (!data.focus) host.style.height = '600px';
  document.body.replaceChildren(host);
  const viewer = mountCanvasViewer(
    host,
    storedPage(),
    data.focus ? { focus: { kind: 'frame', id: 'frame-1' } } : {}
  );
  void frames(30)
    .then(() => new Promise(resolve => setTimeout(resolve, 500)))
    .then(() => {
      const painted = paintedPixels(host);
      const report = {
        type: 'painted',
        painted,
        root: host.querySelector('affine-edgeless-root') !== null,
        styleElements: document.querySelectorAll(
          'style:not([data-vite-dev-id])'
        ).length,
        violations: [...violations],
      };
      viewer.dispose();
      window.parent.postMessage(report, '*');
    });
});

window.parent.postMessage({ type: 'ready' }, '*');
