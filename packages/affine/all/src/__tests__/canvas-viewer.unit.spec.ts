/**
 * The read-only canvas viewer (ADR 0050) mounts from a stored Y.Doc state with
 * no editor, moves, follows a link and goes away cleanly. Labre Sites mounts it
 * as the island of a published canvas page.
 *
 * happy-dom paints nothing (no 2d context, so the surface gets a recording
 * stub): this holds the wiring, not the pixels; painting, pan and zoom on a
 * real canvas belong to the integration suite.
 *
 * What it would have caught:
 * - a mount that needs an editor around it, edits the store or throws on a
 *   page with a canvas;
 * - zoom buttons, ctrl+wheel or a drag that move nothing;
 * - an inline page reference that does not reach `onOpenDoc`, or a refused
 *   scheme that navigates;
 * - a dispose that leaves the container, its listeners or the workspace.
 */
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import { Bound } from '@labre/global/gfx';
import { Text } from '@labre/store';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import {
  type CanvasViewer,
  type CanvasViewerOptions,
  mountCanvasViewer,
} from '../canvas-viewer';
import { openHeadless } from './utils/open-headless';

const VIEW_W = 800;
const VIEW_H = 600;
const CENTRE_X = 400;
const CENTRE_Y = 300;
/** Long enough for the editor's microtasks and first frame to land. */
const SETTLE_MS = 50;
/** One wheel notch, in pixels. */
const WHEEL_NOTCH = 100;
/** Farther than the drag threshold. */
const DRAG_DISTANCE = 30;

beforeAll(() => {
  // Every 2d call is a no-op returning a no-op: the surface renders blind.
  const noop: unknown = new Proxy(() => noop, {
    get: (_, prop) =>
      prop === 'canvas' ? document.createElement('canvas') : noop,
  });
  HTMLCanvasElement.prototype.getContext = (() =>
    noop) as unknown as HTMLCanvasElement['getContext'];
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, VIEW_W, VIEW_H)
  );
});

let mounted: CanvasViewer[] = [];
afterEach(() => {
  mounted.forEach(viewer => viewer.dispose());
  mounted = [];
  document.body.innerHTML = '';
});

/** A page with a canvas: a note whose text links to another page, a frame. */
function fixture(): Uint8Array {
  const { store, doc } = openHeadless(null);
  store.transact(() => {
    const page = store.addBlock('affine:page', { title: new Text('A map') });
    const surface = store.addBlock('affine:surface', {}, page);
    const note = store.addBlock('affine:note', { xywh: '[0,0,400,100]' }, page);
    store.addBlock(
      'affine:paragraph',
      {
        text: new Text<AffineTextAttributes>([
          { insert: 'See ' },
          {
            insert: ' ',
            attributes: { reference: { type: 'LinkedPage', pageId: 'p-2' } },
          },
        ]),
      },
      note
    );
    // A link stored without a scheme, as an import or a connector writes it.
    store.addBlock(
      'affine:bookmark',
      {
        id: 'bm-1',
        url: 'example.com',
        title: 'Example',
        description: 'A site',
      },
      note
    );
    store.addBlock(
      'affine:frame',
      { title: new Text('A frame'), xywh: '[500,0,300,200]' },
      surface
    );
  });
  return Y.encodeStateAsUpdate(doc);
}

const settle = () => new Promise(resolve => setTimeout(resolve, SETTLE_MS));

async function mount(
  options?: CanvasViewerOptions,
  state: Uint8Array = fixture()
) {
  const host = document.createElement('div');
  document.body.append(host);
  const viewer = mountCanvasViewer(host, state, options);
  mounted.push(viewer);
  await settle();
  const container = host.querySelector<HTMLElement>(
    '[data-labre-canvas-viewer]'
  );
  if (!container) throw new Error('the viewer mounted no container');
  const editorHost = container.querySelector('editor-host') as HTMLElement & {
    std: {
      store: { readonly: boolean };
      get: (id: unknown) => {
        viewport: {
          zoom: number;
          center: { x: number };
          viewportBounds: Bound;
        };
      };
      view: { getBlock: (id: string) => unknown };
    };
  };
  return { host, viewer, container, editorHost };
}

describe('the canvas viewer', () => {
  test('mounts the edgeless editor itself on a read-only store', async () => {
    // ADR 0051: the viewer is the editor, not a picture of it.
    const { container, editorHost } = await mount();
    expect(container.querySelector('affine-edgeless-root')).not.toBeNull();
    expect(editorHost.std.store.readonly).toBe(true);
    // The light theme, on the viewer's container only.
    expect(
      container.style.getPropertyValue('--affine-background-primary-color')
    ).not.toBe('');
    expect(
      document.documentElement.style.getPropertyValue(
        '--affine-background-primary-color'
      )
    ).toBe('');
  });

  test('mounts with nothing a strict Content-Security-Policy blocks', async () => {
    // The published site sends style-src without 'unsafe-inline' and
    // script-src without 'wasm-unsafe-eval': no <style> element, no inline
    // style the viewer writes, and code highlighted by the JS regex engine.
    const { container, editorHost } = await mount();
    const { CodeBlockConfigExtension } = await import(
      '@labre/affine-block-code'
    );
    expect(container.querySelector('style')).toBeNull();
    expect(
      (
        editorHost.std as unknown as {
          getOptional: (id: unknown) => { engine?: string } | null;
        }
      ).getOptional(CodeBlockConfigExtension.identifier)?.engine
    ).toBe('javascript');
    // Nothing is dropped on a read-only page: no file drop indicator.
    expect(document.querySelector('affine-drop-indicator')).toBeNull();
  });

  test('names the other pages it is given, as a page reference shows them', async () => {
    const { container } = await mount({ docTitles: { 'p-2': 'Next page' } });
    expect(container.querySelector('affine-reference')?.textContent).toContain(
      'Next page'
    );
  });

  test('a synced doc of a named page settles instead of loading forever', async () => {
    const { store, doc } = openHeadless(null);
    store.transact(() => {
      const page = store.addBlock('affine:page', { title: new Text('A map') });
      store.addBlock('affine:surface', {}, page);
      store.addBlock(
        'affine:embed-synced-doc',
        { id: 'synced', pageId: 'p-2', xywh: '[0,0,400,200]' },
        page
      );
    });
    const { container } = await mount(
      { docTitles: { 'p-2': 'Next page' } },
      Y.encodeStateAsUpdate(doc)
    );
    const card = container.querySelector('affine-embed-synced-doc-block') as
      | (HTMLElement & { syncedDoc?: { root?: unknown } | null })
      | null;
    expect(card).not.toBeNull();
    // A root to render, so the card is not waiting for one that never comes.
    expect(card?.syncedDoc?.root).toBeTruthy();
  });

  test('a click on a note covering a card follows nothing', async () => {
    // The elements under the pointer run from the note's own text down to a
    // bookmark the note hides: only the top block counts.
    const onLinkClick = vi.fn();
    const { container } = await mount({ onLinkClick });
    const card = container.querySelector('[data-block-id="bm-1"]')!;
    const text = container.querySelector('affine-paragraph')!;
    // happy-dom has no hit testing: the stack a browser would return.
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => [text, card],
    });
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLinkClick).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, 'elementsFromPoint');
  });

  test('refuses a state with no page', () => {
    const host = document.createElement('div');
    expect(() => mountCanvasViewer(host, new Uint8Array([0, 0]))).toThrow();
    expect(host.children.length).toBe(0);
  });

  test('zooms with its buttons and, through the editor, with ctrl+wheel', async () => {
    const { viewer, editorHost } = await mount();
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const viewport = editorHost.std.get(GfxControllerIdentifier).viewport;

    const before = viewport.zoom;
    viewer.zoomIn();
    expect(viewport.zoom).toBeGreaterThan(before);
    viewer.zoomOut();
    expect(viewport.zoom).toBeCloseTo(before);

    const wheel = new WheelEvent('wheel', {
      deltaY: -WHEEL_NOTCH,
      bubbles: true,
      cancelable: true,
    });
    // happy-dom's WheelEvent extends UIEvent, not MouseEvent: no modifier
    // keys and no pointer position unless they are set by hand.
    Object.defineProperties(wheel, {
      ctrlKey: { value: true },
      clientX: { value: CENTRE_X },
      clientY: { value: CENTRE_Y },
    });
    // The editor's own wheel handler, which listens on its host.
    editorHost.dispatchEvent(wheel);
    expect(viewport.zoom).toBeGreaterThan(before);
    expect(wheel.defaultPrevented).toBe(true);
  });

  test('a click on a page reference opens that page, a refused URL nothing', async () => {
    const onOpenDoc = vi.fn();
    const onLinkClick = vi.fn();
    const { container } = await mount({ onOpenDoc, onLinkClick });
    const reference = container.querySelector('affine-reference');
    expect(reference).not.toBeNull();
    reference!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpenDoc).toHaveBeenCalledWith('p-2');

    const card = container.querySelector('[data-block-id="bm-1"]');
    expect(card).not.toBeNull();
    card!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Normalised as the bookmark block opens it, never a path on the site.
    expect(onLinkClick).toHaveBeenCalledWith(
      // Accepts "https://example.com" and "https://example.com/", rejects
      // "/example.com" (https://regex101.com/?regex=%5Ehttps%3A%5C%2F%5C%2Fexample%5C.com%5C%2F%3F%24).
      expect.stringMatching(/^https:\/\/example\.com\/?$/)
    );
    onLinkClick.mockClear();

    const anchor = document.createElement('a');
    anchor.href = 'javascript:alert(1)';
    container.append(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  test('a drag that ends on a link pans and follows nothing', async () => {
    const onOpenDoc = vi.fn();
    const { container } = await mount({ onOpenDoc });
    const reference = container.querySelector('affine-reference')!;
    const at = {
      pointerId: 1,
      clientX: CENTRE_X,
      clientY: CENTRE_Y,
      bubbles: true,
    };
    reference.dispatchEvent(new PointerEvent('pointerdown', at));
    reference.dispatchEvent(
      new PointerEvent('pointermove', {
        ...at,
        clientX: CENTRE_X + DRAG_DISTANCE,
      })
    );
    // A mouse click carries its count (`detail` 1); a keyboard one, 0.
    reference.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1 })
    );
    expect(onOpenDoc).not.toHaveBeenCalled();
    // The drag is over: the link, activated from the keyboard, opens.
    reference.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpenDoc).toHaveBeenCalledWith('p-2');
  });

  test('a key typed while the pointer rests on the canvas reaches the page, not the editor', async () => {
    // The editor's keymap wakes on hover: `v` would switch to selection and
    // `Mod-a` would take the page's own select-all.
    const { editorHost } = await mount();
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const std = editorHost.std as unknown as {
      event: { active: boolean };
      get: (id: unknown) => { tool: { currentToolName$: { peek(): string } } };
    };
    const tool = () =>
      std.get(GfxControllerIdentifier).tool.currentToolName$.peek();
    const before = tool();
    std.event.active = true;
    const key = new KeyboardEvent('keydown', {
      key: 'v',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(key);
    expect(tool()).toBe(before);
    expect(key.defaultPrevented).toBe(false);
    // Resumed after the key: the pointer still pans.
    expect(std.event.active).toBe(true);
  });

  test('dispose empties the host and can run twice', async () => {
    const { host, viewer } = await mount();
    viewer.dispose();
    expect(host.children.length).toBe(0);
    expect(() => viewer.dispose()).not.toThrow();
  });
});

/**
 * A frame inserted in a page, as the PO's acceptance asks it: the view shows
 * the frame and nothing beyond it, like the surface reference block.
 */
const FRAME = '[0,0,400,300]';
const OUTSIDE = '[2000,2000,300,100]';

function framedPage(): Uint8Array {
  const { store, doc } = openHeadless(null);
  store.transact(() => {
    const page = store.addBlock('affine:page', { title: new Text('A page') });
    const surface = store.addBlock('affine:surface', {}, page);
    store.addBlock(
      'affine:frame',
      { id: 'frame-1', title: new Text('The map'), xywh: FRAME },
      surface
    );
    store.addBlock(
      'affine:note',
      { id: 'inside', xywh: '[50,50,300,100]' },
      page
    );
    store.addBlock('affine:note', { id: 'outside', xywh: OUTSIDE }, page);
  });
  return Y.encodeStateAsUpdate(doc);
}

describe('the canvas viewer on one frame', () => {
  const frame = { kind: 'frame', id: 'frame-1' } as const;

  test('shows the frame alone, in its proportions, without its border', async () => {
    const { container, editorHost } = await mount(
      { focus: frame },
      framedPage()
    );
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const shown = editorHost.std.get(GfxControllerIdentifier).viewport
      .viewportBounds;

    expect(container.style.aspectRatio).toBe('400 / 300');
    expect(shown.contains(Bound.deserialize(FRAME))).toBe(true);
    expect(shown.isOverlapWithBound(Bound.deserialize(OUTSIDE))).toBe(false);
    expect(
      (editorHost.std.view.getBlock('frame-1') as { showBorder?: boolean })
        ?.showBorder
    ).toBe(false);
  });

  test('frozen by default: the page keeps the wheel, a click or Enter expands', async () => {
    const onExpand = vi.fn();
    const { container, editorHost } = await mount(
      { focus: frame, onExpand },
      framedPage()
    );
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const viewport = editorHost.std.get(GfxControllerIdentifier).viewport;
    const zoom = viewport.zoom;

    const wheel = new WheelEvent('wheel', {
      deltaY: WHEEL_NOTCH,
      cancelable: true,
    });
    container.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(viewport.zoom).toBe(zoom);

    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    const clickThenEnter = 2;
    expect(onExpand).toHaveBeenCalledTimes(clickThenEnter);
    expect(container.getAttribute('role')).toBe('button');
    expect(container.getAttribute('aria-label')).toBe('The map');
    // One button: nothing inside it takes focus or keys.
    expect((editorHost as HTMLElement & { inert: boolean }).inert).toBe(true);
  });

  test('interactive on demand: it fills the host and zooms', async () => {
    const { viewer, container, editorHost } = await mount(
      { focus: frame, interactive: true },
      framedPage()
    );
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const viewport = editorHost.std.get(GfxControllerIdentifier).viewport;

    expect(container.style.height).toBe('100%');
    const zoom = viewport.zoom;
    viewer.zoomIn();
    expect(viewport.zoom).toBeGreaterThan(zoom);
    viewer.fit();
    expect(viewport.zoom).toBeCloseTo(zoom);
  });

  test('refuses an id that is not a frame, or a frame asked as a group', () => {
    const host = document.createElement('div');
    expect(() =>
      mountCanvasViewer(host, framedPage(), {
        focus: { kind: 'frame', id: 'inside' },
      })
    ).toThrow();
    expect(() =>
      mountCanvasViewer(host, framedPage(), {
        focus: { kind: 'group', id: 'frame-1' },
      })
    ).toThrow();
    expect(host.children.length).toBe(0);
  });
});
