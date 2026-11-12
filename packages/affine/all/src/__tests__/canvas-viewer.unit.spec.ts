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
 * - a mount, a zoom or a click that writes anything into the document shown
 *   (its Y.Doc's state vector moves);
 * - text left in a fallback face when the page's own fonts arrive late, or a
 *   listener on `document.fonts` left behind by `dispose`;
 * - a frozen view whose button has no accessible name (a frame with no
 *   title);
 * - a key stopped inside the editor that leaves the dispatcher paused, so
 *   the wheel and the drag are dead and the page scrolls instead;
 * - a mount that throws when a host provider registers nothing for the
 *   canvas scope;
 * - a page the host left out of `docTitles` named "deleted" instead of
 *   "Access denied", or opened on a click;
 * - a host's link preview or image proxy, given in `viewExtensions`, that
 *   does not reach the blocks (they would call the public defaults).
 * - zoom buttons, ctrl+wheel or a drag that move nothing;
 * - an inline page reference that does not reach `onOpenDoc`, or a refused
 *   scheme that navigates;
 * - a middle click (`auxclick`) that follows an `<a href>` the canvas
 *   renders past `isSafeLinkUrl`, `onLinkClick` and `docTitles`, or that
 *   follows anything at all in a frozen view;
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

  test('a page the host left out is "Access denied" and opens nothing', async () => {
    const { store, doc } = openHeadless(null);
    store.transact(() => {
      const page = store.addBlock('affine:page', { title: new Text('A map') });
      const surface = store.addBlock('affine:surface', {}, page);
      const note = store.addBlock(
        'affine:note',
        { xywh: '[0,0,400,100]' },
        page
      );
      store.addBlock(
        'affine:paragraph',
        {
          text: new Text<AffineTextAttributes>([
            {
              insert: ' ',
              attributes: {
                reference: { type: 'LinkedPage', pageId: 'private' },
              },
            },
          ]),
        },
        note
      );
      store.addBlock(
        'affine:embed-linked-doc',
        { id: 'card', pageId: 'private', xywh: '[0,200,248,80]' },
        surface
      );
    });
    const onOpenDoc = vi.fn();
    const { container } = await mount(
      { onOpenDoc, docTitles: { shared: 'Shared page' } },
      Y.encodeStateAsUpdate(doc)
    );

    const reference = container.querySelector('affine-reference');
    expect(reference?.textContent).toContain('Access denied');
    expect(reference?.textContent).not.toContain('Deleted');
    reference!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const card = container.querySelector('[data-block-id="card"]');
    expect(card?.textContent).toContain('Access denied');
    expect(card?.textContent).not.toMatch(/deleted/i);
    card!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOpenDoc).not.toHaveBeenCalled();
  });

  test("a host's providers that skip the canvas scope still mount, translated or not", async () => {
    // A seam provider that registers for the page view only (the ext-loader
    // README's own pattern) once made the viewer throw before it mounted.
    const { ViewExtensionProvider } = await import('@labre/affine-ext-loader');
    const { TranslationExtension } = await import(
      '@labre/affine-shared/services'
    );
    type Context = Parameters<
      InstanceType<typeof ViewExtensionProvider>['setup']
    >[0];
    const french = TranslationExtension({
      t: key =>
        key === 'com.labre.canvas-viewer.access-denied'
          ? 'Accès refusé'
          : undefined,
    });
    class PageOnly extends ViewExtensionProvider {
      override name = 'host-page-only';
      override setup(context: Context) {
        super.setup(context);
        if (context.scope === 'page') context.register(french);
      }
    }
    class Translated extends ViewExtensionProvider {
      override name = 'host-translation';
      override setup(context: Context) {
        super.setup(context);
        context.register(french);
      }
    }
    const reference = async (
      viewExtensions: (typeof ViewExtensionProvider)[]
    ) => {
      const { container } = await mount({ viewExtensions });
      return container.querySelector('affine-reference')?.textContent ?? '';
    };
    expect(await reference([PageOnly])).toContain('Access denied');
    expect(await reference([Translated])).toContain('Accès refusé');
  });

  test("a host's link preview and image proxy reach the blocks through viewExtensions", async () => {
    const { ViewExtensionProvider } = await import('@labre/affine-ext-loader');
    const { LinkPreviewServiceIdentifier } = await import(
      '@labre/affine-shared/services'
    );
    const { ImageProxyService } = await import('@labre/affine-shared/adapters');
    const { LifeCycleWatcher } = await import('@labre/std');
    const query = vi.fn((_url: string, _signal?: AbortSignal) =>
      Promise.resolve({
        title: 'From the host',
        icon: 'https://example.org/icon.png',
      })
    );
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('no network in this test'));
    // The image proxy is a store extension: a watcher of the host's sets it.
    class HostImageProxy extends LifeCycleWatcher {
      static override key = 'host-image-proxy';
      override created() {
        this.std.store
          .get(ImageProxyService)
          .setImageProxyURL('https://host.example/proxy');
      }
    }
    class HostServices extends ViewExtensionProvider {
      override name = 'host-services';
      override setup(
        context: Parameters<
          InstanceType<typeof ViewExtensionProvider>['setup']
        >[0]
      ) {
        super.setup(context);
        context.register([
          {
            setup: di => {
              di.override(LinkPreviewServiceIdentifier, () => ({
                query,
                setEndpoint: () => {},
                endpoint: 'https://host.example/preview',
              }));
            },
          },
          HostImageProxy,
        ]);
      }
    }
    const { store, doc } = openHeadless(null);
    store.transact(() => {
      const page = store.addBlock('affine:page', { title: new Text('A map') });
      store.addBlock('affine:surface', {}, page);
      const note = store.addBlock(
        'affine:note',
        { xywh: '[0,0,400,200]' },
        page
      );
      // No stored metadata: the bookmark asks for a preview on mount.
      store.addBlock(
        'affine:bookmark',
        { url: 'https://example.org/article' },
        note
      );
    });
    try {
      const { container } = await mount(
        { viewExtensions: [HostServices] },
        Y.encodeStateAsUpdate(doc)
      );
      await settle();
      expect(query).toHaveBeenCalledWith(
        'https://example.org/article',
        expect.anything()
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      const images = (root: ParentNode): HTMLImageElement[] => [
        ...root.querySelectorAll('img'),
        ...[...root.querySelectorAll('*')].flatMap(element =>
          element.shadowRoot ? images(element.shadowRoot) : []
        ),
      ];
      const sources = images(container).map(image => image.src);
      expect(sources).not.toEqual([]);
      sources.forEach(source =>
        expect(source.startsWith('https://host.example/proxy?url=')).toBe(true)
      );
    } finally {
      fetchSpy.mockRestore();
    }
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

  test('names the canvas text faces from its own entry', async () => {
    // A public page serves the faces itself and reads the list here.
    const entry = await import('../canvas-viewer');
    const { CommunityCanvasTextFonts } = await import(
      '@labre/affine-shared/services'
    );
    expect(entry.CommunityCanvasTextFonts).toBe(CommunityCanvasTextFonts);
    expect(entry.CommunityCanvasTextFonts.length).toBeGreaterThan(0);
  });

  test('writes nothing into the document it shows', async () => {
    const state = fixture();
    const shown = new Y.Doc();
    Y.applyUpdate(shown, state);
    const { viewer, container, editorHost } = await mount(
      { onOpenDoc: () => {}, onLinkClick: () => {} },
      state
    );
    viewer.zoomIn();
    viewer.fit();
    container.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: CENTRE_X,
        clientY: CENTRE_Y,
      })
    );
    await settle();
    const spaceDoc = (editorHost.std.store as unknown as { spaceDoc: Y.Doc })
      .spaceDoc;
    expect(Y.encodeStateVector(spaceDoc)).toEqual(Y.encodeStateVector(shown));
  });

  test("paints again when the page's fonts finish loading, until disposed", async () => {
    // happy-dom has no font set to fire: a stand-in for `document.fonts`.
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', {
      value: fonts,
      configurable: true,
    });
    try {
      const { viewer, editorHost } = await mount();
      const { getSurfaceComponent } = await import(
        '@labre/affine-block-surface'
      );
      const surface = getSurfaceComponent(
        editorHost.std as unknown as Parameters<typeof getSurfaceComponent>[0]
      );
      if (!surface) throw new Error('no surface mounted');
      const refresh = vi.spyOn(surface, 'refresh');

      fonts.dispatchEvent(new Event('loadingdone'));
      expect(refresh).toHaveBeenCalledTimes(1);

      viewer.dispose();
      fonts.dispatchEvent(new Event('loadingdone'));
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
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
    const { container } = await mount({
      onOpenDoc,
      onLinkClick,
      docTitles: { 'p-2': 'Next page' },
    });
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
    const { container } = await mount({
      onOpenDoc,
      docTitles: { 'p-2': 'Next page' },
    });
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

  test('a middle click follows a link as a click does, through the same checks', async () => {
    const onOpenDoc = vi.fn();
    const onLinkClick = vi.fn();
    const { container } = await mount({ onOpenDoc, onLinkClick });
    const middle = () =>
      new MouseEvent('auxclick', {
        bubbles: true,
        cancelable: true,
        button: 1,
        detail: 1,
      });

    // A page the host did not name opens nothing, with any button.
    const reference = container.querySelector('affine-reference')!;
    reference.dispatchEvent(middle());
    expect(onOpenDoc).not.toHaveBeenCalled();

    const card = container.querySelector('[data-block-id="bm-1"]')!;
    card.dispatchEvent(middle());
    expect(onLinkClick).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/example\.com\/?$/)
    );
    onLinkClick.mockClear();

    // The browser's own new tab is cancelled: a refused URL opens nothing.
    const anchor = document.createElement('a');
    anchor.href = 'javascript:alert(1)';
    container.append(anchor);
    const event = middle();
    anchor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onLinkClick).not.toHaveBeenCalled();

    // Any other button follows nothing.
    const right = new MouseEvent('auxclick', {
      bubbles: true,
      cancelable: true,
      button: 2,
    });
    card.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(true);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  test('a middle click on a named page opens it; without onLinkClick, a link opens in a new tab', async () => {
    const onOpenDoc = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => {});
    try {
      const { container } = await mount({
        onOpenDoc,
        docTitles: { 'p-2': 'Next page' },
      });
      const middle = { bubbles: true, cancelable: true, button: 1, detail: 1 };
      container
        .querySelector('affine-reference')!
        .dispatchEvent(new MouseEvent('auxclick', middle));
      expect(onOpenDoc).toHaveBeenCalledWith('p-2');

      container
        .querySelector('[data-block-id="bm-1"]')!
        .dispatchEvent(new MouseEvent('auxclick', middle));
      expect(open).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/example\.com\/?$/),
        '_blank',
        'noopener,noreferrer'
      );
      expect(assign).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
      assign.mockRestore();
    }
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

  test('a key the editor stops still gives the canvas back its wheel', async () => {
    // The pause on a key is lifted on the next task, not only in the key's
    // bubble phase, which a listener calling stopPropagation never reaches.
    const { editorHost } = await mount();
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const std = editorHost.std as unknown as { event: { active: boolean } };
    const viewport = editorHost.std.get(GfxControllerIdentifier).viewport;
    // The pointer rests on the canvas: the dispatcher is awake.
    std.event.active = true;
    const stop = (event: Event) => event.stopPropagation();
    editorHost.addEventListener('keydown', stop);
    editorHost.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    );
    editorHost.removeEventListener('keydown', stop);
    // Paused for the key, and its bubble phase never came.
    expect(std.event.active).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(std.event.active).toBe(true);

    const before = viewport.zoom;
    const wheel = new WheelEvent('wheel', {
      deltaY: -WHEEL_NOTCH,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperties(wheel, {
      ctrlKey: { value: true },
      clientX: { value: CENTRE_X },
      clientY: { value: CENTRE_Y },
    });
    editorHost.dispatchEvent(wheel);
    expect(viewport.zoom).toBeGreaterThan(before);
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

  test('shows the frame alone, in its proportions, without its border, under its badge', async () => {
    const { container, editorHost } = await mount(
      { focus: frame },
      framedPage()
    );
    const { GfxControllerIdentifier } = await import('@labre/std/gfx');
    const shown = editorHost.std.get(GfxControllerIdentifier).viewport
      .viewportBounds;

    // The frame's proportions plus the strip of its title badge (28px over
    // a view 800px wide, 14 model units at that width), as the editor draws
    // the badge above the frame's top edge.
    expect(container.style.aspectRatio).toBe('400 / 314');
    expect(shown.contains(Bound.deserialize(FRAME))).toBe(true);
    expect(shown.y).toBeLessThan(Bound.deserialize(FRAME).y);
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

    // A picture follows no link, not even with the middle button.
    const anchor = document.createElement('a');
    anchor.href = 'https://example.com/';
    container.append(anchor);
    const middle = new MouseEvent('auxclick', {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    anchor.dispatchEvent(middle);
    expect(middle.defaultPrevented).toBe(true);
    expect(onExpand).toHaveBeenCalledTimes(clickThenEnter);
    expect(container.getAttribute('role')).toBe('button');
    expect(container.getAttribute('aria-label')).toBe('Open canvas: The map');
    // One button: nothing inside it takes focus or keys.
    expect((editorHost as HTMLElement & { inert: boolean }).inert).toBe(true);
  });

  test('a frozen frame with no title still names its button', async () => {
    const { store, doc } = openHeadless(null);
    store.transact(() => {
      const page = store.addBlock('affine:page', { title: new Text('A page') });
      const surface = store.addBlock('affine:surface', {}, page);
      store.addBlock(
        'affine:frame',
        { id: 'untitled', title: new Text(''), xywh: FRAME },
        surface
      );
    });
    const { container } = await mount(
      { focus: { kind: 'frame', id: 'untitled' }, onExpand: () => {} },
      Y.encodeStateAsUpdate(doc)
    );
    // No host translation: the English fallback of its `com.labre.*` key.
    expect(container.getAttribute('role')).toBe('button');
    expect(container.getAttribute('aria-label')).toBe('Open canvas');
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
