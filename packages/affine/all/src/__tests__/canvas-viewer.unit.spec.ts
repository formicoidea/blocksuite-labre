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
import { Text } from '@labre/store';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { type CanvasViewer, mountCanvasViewer } from '../canvas-viewer';
import { openHeadless } from './utils/open-headless';

const VIEW_W = 800;
const VIEW_H = 600;

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
    store.addBlock(
      'affine:frame',
      { title: new Text('A frame'), xywh: '[500,0,300,200]' },
      surface
    );
  });
  return Y.encodeStateAsUpdate(doc);
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

async function mount(options?: Parameters<typeof mountCanvasViewer>[2]) {
  const host = document.createElement('div');
  document.body.append(host);
  const viewer = mountCanvasViewer(host, fixture(), options);
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
        viewport: { zoom: number; center: { x: number } };
      };
    };
  };
  return { host, viewer, container, editorHost };
}

describe('the canvas viewer', () => {
  test('mounts a read-only canvas page with no editor around it', async () => {
    const { container, editorHost } = await mount();
    expect(
      container.querySelector('affine-edgeless-root-preview')
    ).not.toBeNull();
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

  test('refuses a state with no page', () => {
    const host = document.createElement('div');
    expect(() => mountCanvasViewer(host, new Uint8Array([0, 0]))).toThrow();
    expect(host.children.length).toBe(0);
  });

  test('zooms with its buttons and with ctrl+wheel, pans with a drag', async () => {
    const { viewer, container, editorHost } = await mount();
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const viewport = editorHost.std.get(GfxControllerIdentifier).viewport;

    const before = viewport.zoom;
    viewer.zoomIn();
    expect(viewport.zoom).toBeGreaterThan(before);
    viewer.zoomOut();
    expect(viewport.zoom).toBeCloseTo(before);

    const wheel = new WheelEvent('wheel', {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    });
    // happy-dom's WheelEvent extends UIEvent, not MouseEvent: no modifier
    // keys and no pointer position unless they are set by hand.
    Object.defineProperties(wheel, {
      ctrlKey: { value: true },
      clientX: { value: VIEW_W / 2 },
      clientY: { value: VIEW_H / 2 },
    });
    container.dispatchEvent(wheel);
    expect(viewport.zoom).toBeGreaterThan(before);
    expect(wheel.defaultPrevented).toBe(true);

    const x = viewport.center.x;
    const down = { pointerId: 1, clientX: 100, clientY: 100, bubbles: true };
    container.dispatchEvent(new PointerEvent('pointerdown', down));
    container.dispatchEvent(
      new PointerEvent('pointermove', { ...down, clientX: 160 })
    );
    container.dispatchEvent(new PointerEvent('pointerup', down));
    expect(viewport.center.x).toBeLessThan(x);
  });

  test('a click on a page reference opens that page, a refused URL nothing', async () => {
    const onOpenDoc = vi.fn();
    const onLinkClick = vi.fn();
    const { container } = await mount({ onOpenDoc, onLinkClick });
    const reference = container.querySelector('affine-reference');
    expect(reference).not.toBeNull();
    reference!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpenDoc).toHaveBeenCalledWith('p-2');

    const anchor = document.createElement('a');
    anchor.href = 'javascript:alert(1)';
    container.append(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  test('dispose empties the host and can run twice', async () => {
    const { host, viewer } = await mount();
    viewer.dispose();
    expect(host.children.length).toBe(0);
    expect(() => viewer.dispose()).not.toThrow();
  });
});
