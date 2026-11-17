/**
 * Runs inside the frame `canvas-viewer-page-title.spec.ts` opens: builds a
 * stored page whose first note is the page's note, mounts the read-only
 * canvas viewer on it, then reports the head of that note (the document
 * title) and every custom element left undefined in the viewer.
 * Not a spec: a frame of its own gives the viewer a fresh custom element
 * registry, which the suite's shared page (`isolate: false`) does not, since
 * an editor mounted by an earlier spec defines `<doc-title>` there.
 */
import { mountCanvasViewer } from '@labre/affine/canvas-viewer';
import { StoreExtensionManager } from '@labre/affine/ext-loader';
import { getInternalStoreExtensions } from '@labre/affine/extensions/store';
import { Text, WorkspaceImpl } from '@labre/store';
import * as Y from 'yjs';

/** The page's stored title, which the head of its note shows. */
export const PAGE_TITLE = 'A published map';

/** How long the viewer may take to draw the page's note, imports included. */
const PAINT_DEADLINE_MS = 60_000;

/** Frames the page settles once the note is there, for late definitions. */
const SETTLE_FRAMES = 120;

export type TitleReport = {
  /** `<edgeless-page-block-title>` is in the viewer. */
  head: boolean;
  docTitle: {
    present: boolean;
    defined: boolean;
    text: string;
    height: number;
  };
  titleBand: { present: boolean; defined: boolean };
  /** Custom elements in the viewer (open shadow roots included) left undefined. */
  undefinedElements: string[];
  /** Block views drawn in the viewer, by tag, for a failing run. */
  blocks: string[];
  /** Blocks the stored page could not be given (a flavour's props refused). */
  skipped: string[];
};

/**
 * A page whose first note is shown in the page and on the canvas, so the
 * editor draws it as the page's note, with its title at its head; plus the
 * blocks and elements a published canvas commonly holds, so a component one
 * of them draws that the viewer never defines shows up.
 */
function storedPage(skipped: string[]): Uint8Array {
  const workspace = new WorkspaceImpl({ id: 'page-title' });
  workspace.storeExtensions = new StoreExtensionManager(
    getInternalStoreExtensions()
  ).get('store');
  workspace.meta.initialize();
  const doc = workspace.createDoc('page');
  const store = doc.getStore();
  store.load();
  const attempt = (name: string, add: () => unknown) => {
    try {
      add();
    } catch (error) {
      skipped.push(`${name}: ${String(error)}`);
    }
  };
  let surfaceId = '';
  store.transact(() => {
    const page = store.addBlock('affine:page', { title: new Text(PAGE_TITLE) });
    surfaceId = store.addBlock('affine:surface', {}, page);
    const note = store.addBlock('affine:note', { xywh: '[0,0,500,600]' }, page);
    store.addBlock('affine:paragraph', { text: new Text('Body') }, note);
    attempt('list', () =>
      store.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text('Item') },
        note
      )
    );
    attempt('code', () =>
      store.addBlock(
        'affine:code',
        { text: new Text('const a = 1;'), language: 'typescript' },
        note
      )
    );
    attempt('callout', () => {
      const callout = store.addBlock('affine:callout', {}, note);
      store.addBlock('affine:paragraph', { text: new Text('Note') }, callout);
    });
    attempt('divider', () => store.addBlock('affine:divider', {}, note));
    attempt('latex', () =>
      store.addBlock('affine:latex', { latex: 'a^2+b^2' }, note)
    );
    attempt('database', () => store.addBlock('affine:database', {}, note));
    attempt('table', () => store.addBlock('affine:table', {}, note));
    attempt('frame', () =>
      store.addBlock(
        'affine:frame',
        { title: new Text('The frame'), xywh: '[700,0,600,400]' },
        surfaceId
      )
    );
    attempt('edgeless-text', () => {
      const text = store.addBlock(
        'affine:edgeless-text',
        { xywh: '[700,500,200,50]' },
        surfaceId
      );
      store.addBlock('affine:paragraph', { text: new Text('Free') }, text);
    });
    attempt('embed-linked-doc', () =>
      store.addBlock(
        'affine:embed-linked-doc',
        { pageId: 'another-page', xywh: '[1000,500,248,80]' },
        surfaceId
      )
    );
    const second = store.addBlock(
      'affine:note',
      { xywh: '[0,800,300,100]' },
      page
    );
    store.addBlock('affine:paragraph', { text: new Text('Second') }, second);
  });
  const surface = store.getBlock(surfaceId)?.model as unknown as {
    addElement: (props: Record<string, unknown>) => string;
  };
  attempt('shape', () =>
    surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[750,50,200,100]',
      text: new Text('Shape'),
    })
  );
  const state = Y.encodeStateAsUpdate(doc.spaceDoc);
  workspace.dispose();
  return state;
}

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function until(
  done: () => boolean,
  deadline = performance.now() + PAINT_DEADLINE_MS
): Promise<void> {
  if (done() || performance.now() >= deadline) return;
  await nextFrame();
  return until(done, deadline);
}

/** Every element under `root`, through open shadow roots. */
function allElements(root: ParentNode): Element[] {
  return [...root.querySelectorAll('*')].flatMap(element => [
    element,
    ...(element.shadowRoot ? allElements(element.shadowRoot) : []),
  ]);
}

window.addEventListener('message', event => {
  const data = event.data as { type?: string } | null;
  if (data?.type !== 'mount') return;
  void mount();
});

async function mount() {
  const host = document.createElement('div');
  host.style.width = '800px';
  host.style.height = '600px';
  document.body.replaceChildren(host);
  const skipped: string[] = [];
  const viewer = mountCanvasViewer(host, storedPage(skipped));
  await until(() => host.querySelector('edgeless-page-block-title') !== null);
  await Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
    previous => previous.then(nextFrame),
    Promise.resolve()
  );
  const docTitle = host.querySelector<HTMLElement>('doc-title');
  const report: TitleReport & { type: 'painted' } = {
    type: 'painted',
    head: host.querySelector('edgeless-page-block-title') !== null,
    docTitle: {
      present: docTitle !== null,
      defined: customElements.get('doc-title') !== undefined,
      text: docTitle?.textContent?.trim() ?? '',
      height: docTitle?.getBoundingClientRect().height ?? 0,
    },
    titleBand: {
      present: host.querySelector('labre-title-band') !== null,
      defined: customElements.get('labre-title-band') !== undefined,
    },
    undefinedElements: [
      ...new Set(
        allElements(host)
          .map(element => element.localName)
          .filter(name => name.includes('-') && !customElements.get(name))
      ),
    ].sort(),
    blocks: [
      ...new Set(
        allElements(host)
          .map(element => element.localName)
          .filter(name =>
            /^affine-.*(block|database|table|latex|code|callout|divider|list|paragraph|note|frame|text|embed)/.test(
              name
            )
          )
      ),
    ].sort(),
    skipped,
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
