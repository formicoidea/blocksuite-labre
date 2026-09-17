import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { BlockFlags } from '@labre/affine/flags';
import { ConnectorMode, type ShapeElementModel } from '@labre/affine/model';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * ADR 0027 end to end: the palette header a contextual colour picker draws
 * above its swatch grid — a drop-down of the pages, still paged by a wheel.
 *
 * The unit suites own the origin rule, the builder and the header component in
 * isolation. This one is the RECETTE — it owns what only a mounted editor can
 * answer: that a real toolbar, serving a real selection, hands the picker a
 * carousel at all; that the page it opens on is the framework the document says
 * the element belongs to; that paging leaves the menu open and swaps the grid;
 * that a swatch taken from a framework page is what ends up in the model; and
 * that the page the user paged to never leaks onto the next selection.
 */

/** The base palette's page name, and Wardley's — the English fallbacks. */
const BASE_LABEL = 'Default';
const WARDLEY_LABEL = 'Wardley map';
/** Wardley's lead swatch, as `resolvePaletteLabel` prints it. */
const WARDLEY_SWATCH = 'Wonder';

/** See `wardley-validation-bubble.spec.ts`: the viewport persists per doc id. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

type ColorButton = HTMLElement & { color: string; label?: string };
type MenuButton = HTMLElement & { show(force?: boolean): void };
type CarouselHost = HTMLElement & {
  paletteGroups: readonly { key: string; label: string }[];
  activeGroupKey: string | undefined;
};

describe("the colour pickers' palette carousel", () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let unmount: (() => void) | null = null;

  /** A Wardley map board: a `FrameworkBackgroundElementModel` with a role. */
  const addMap = (xywh = '[0,0,1600,900]') =>
    service.surface.addElement({ type: 'wardley', role: 'wardley:map', xywh });

  const addNode = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  /** A NEUTRAL shape — no role of its own, so only its bound can speak for it. */
  const addShape = (xywh: string) =>
    service.surface.addElement({ type: 'shape', shapeType: 'rect', xywh });

  /** A plain connector: no role, so only its two ends can speak for it. */
  const addConnector = (sourceId: string, targetId: string) =>
    service.surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: sourceId },
      target: { id: targetId },
    });

  const shapeModel = (id: string) =>
    service.surface.getElementById(id) as ShapeElementModel;

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await wait(0);
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  /** The shape toolbar's single colour entry — one header, two grids. */
  const shapePicker = () =>
    (toolbar()?.querySelector('edgeless-shape-color-picker') ??
      null) as CarouselHost | null;

  /** The connector toolbar's stroke entry. */
  const connectorPicker = () =>
    (toolbar()?.querySelector('edgeless-color-picker-button.stroke-color') ??
      null) as CarouselHost | null;

  const menuOf = (host: Element) =>
    (host.shadowRoot?.querySelector('editor-menu-button') ??
      null) as MenuButton | null;

  /**
   * Open the picker the way a user does — a click on the toolbar trigger.
   *
   * Not decoration: `editor-menu-content` is `display: none` until the popper
   * shows it, and, more to the point here, `createButtonPopper` closes the menu
   * on any click whose composed path misses the TRIGGER. A menu that was never
   * opened cannot show that paging keeps it open.
   */
  const openPicker = async (host: Element) => {
    const menu = menuOf(host);
    expect(menu).not.toBeNull();
    if (menu!.dataset.open !== 'true') {
      const trigger = menu!.shadowRoot?.querySelector(
        'editor-icon-button'
      ) as HTMLElement | null;
      expect(trigger).not.toBeNull();
      trigger!.click();
      await settle();
    }
    expect(menu!.dataset.open).toBe('true');
    return menu!;
  };

  const carouselBox = (host: Element) =>
    (host.shadowRoot?.querySelector('.palette-carousel-name') ??
      null) as HTMLSelectElement | null;

  const carouselName = (host: Element) =>
    Array.from(carouselBox(host)?.options ?? [])
      .find(item => item.selected)
      ?.textContent?.trim() ?? null;

  /** Pick a page from the drop-down, the way the browser reports a choice. */
  const choosePage = async (host: Element, label: string) => {
    const select = carouselBox(host);
    expect(select).not.toBeNull();
    const option = Array.from(select!.options).find(
      item => item.textContent?.trim() === label
    );
    expect(option).toBeDefined();
    select!.value = option!.value;
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };

  /** A flick of the wheel over the header — one page, wrapping round. */
  const wheelPage = async (host: Element, deltaY: number) => {
    const header = host.shadowRoot?.querySelector('.palette-carousel');
    expect(header).not.toBeNull();
    header!.dispatchEvent(
      new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
    );
    // `settle()` waits 250ms, longer than the header's own wheel throttle.
    await settle();
  };

  /**
   * One grid of the picker. The shape picker draws two (fill and border) under
   * a single header; the connector picker draws one.
   */
  const panel = (host: Element, ariaLabel?: string) =>
    host.shadowRoot?.querySelector(
      ariaLabel
        ? `edgeless-color-panel[aria-label="${ariaLabel}"]`
        : 'edgeless-color-panel'
    ) ?? null;

  const swatches = (grid: Element) =>
    Array.from(
      grid.shadowRoot?.querySelectorAll('edgeless-color-button') ?? []
    ) as ColorButton[];

  const swatchLabels = (grid: Element) =>
    swatches(grid).map(button => button.label);

  const mount = async (flags?: BlockFlags) => {
    forgetStoredViewport();
    unmount = await setupEditor(
      'edgeless',
      undefined,
      flags ? { flags } : undefined
    );
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
  };

  beforeEach(async () => {
    await mount();
    return () => {
      unmount?.();
      unmount = null;
    };
  });
  afterEach(() => forgetStoredViewport());

  test('a neutral shape on the bare canvas opens on the base palette', async () => {
    // Far from any board, so nothing but the editor's own palette is true of
    // it — and the header is still drawn, because the frameworks are on and
    // their pages are one click away (ADR 0027, "the base palette is page one").
    const shape = addShape('[4000,4000,100,100]');
    await select(shape);

    const picker = shapePicker();
    expect(picker).not.toBeNull();
    await openPicker(picker!);

    expect(
      picker!.shadowRoot?.querySelector('.palette-carousel')
    ).not.toBeNull();
    expect(carouselName(picker!)).toBe(BASE_LABEL);
    // One option per page, the arrows of the first cut replaced by the list.
    expect(carouselBox(picker!)?.options.length).toBe(
      picker!.paletteGroups.length
    );
    expect(
      picker!.shadowRoot?.querySelector('.palette-carousel-nav')
    ).toBeNull();
    // Eight frameworks ship hues, plus the base page that is never hidden.
    expect(picker!.paletteGroups.map(group => group.key)).toEqual([
      'default',
      'wardley',
      'edgy',
      'cynefin-estuarine',
      'bpmn',
      'c4',
      'ddd-event-storming',
      'ddd-core-domain',
      'ddd-context-map',
    ]);
  });

  test('a neutral shape dropped on a Wardley map opens on Wardley', async () => {
    addMap();
    const shape = addShape('[400,300,100,100]');
    await select(shape);

    const picker = shapePicker();
    expect(picker).not.toBeNull();
    await openPicker(picker!);

    // Tier three of the origin rule: the shape stamps no role, the board it
    // sits inside does.
    expect(carouselName(picker!)).toBe(WARDLEY_LABEL);

    const fill = panel(picker!, 'Fill color');
    expect(fill).not.toBeNull();
    expect(swatchLabels(fill!)).toContain(WARDLEY_SWATCH);
  });

  test('a wheel over the header swaps the grid and leaves the menu open', async () => {
    addMap();
    const shape = addShape('[400,300,100,100]');
    await select(shape);

    const picker = shapePicker()!;
    const menu = await openPicker(picker);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);

    const before = swatchLabels(panel(picker, 'Fill color')!);
    await wheelPage(picker, 1);

    expect(carouselName(picker)).not.toBe(WARDLEY_LABEL);
    expect(swatchLabels(panel(picker, 'Fill color')!)).not.toEqual(before);
    // The header lives inside an open menu; paging must not close it.
    expect(menu.dataset.open).toBe('true');

    // …and back, because the pages are a ring.
    await wheelPage(picker, -1);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);
    expect(menu.dataset.open).toBe('true');
  });

  test('the drop-down jumps straight to a page, and the menu stays open', async () => {
    addMap();
    const shape = addShape('[400,300,100,100]');
    await select(shape);

    const picker = shapePicker()!;
    const menu = await openPicker(picker);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);

    const before = swatchLabels(panel(picker, 'Fill color')!);
    // The base page is page one, whatever the origin — a name away, not a
    // count of clicks away.
    await choosePage(picker, BASE_LABEL);

    expect(carouselName(picker)).toBe(BASE_LABEL);
    expect(swatchLabels(panel(picker, 'Fill color')!)).not.toEqual(before);
    expect(menu.dataset.open).toBe('true');

    // …and back to the framework page by its own name.
    await choosePage(picker, WARDLEY_LABEL);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);
    expect(swatchLabels(panel(picker, 'Fill color')!)).toEqual(before);
    expect(menu.dataset.open).toBe('true');
  });

  test('a swatch taken from the Wardley page is what the model ends up with', async () => {
    addMap();
    const shape = addShape('[400,300,100,100]');
    await select(shape);

    const picker = shapePicker()!;
    await openPicker(picker);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);

    const wonder = swatches(panel(picker, 'Fill color')!).find(
      button => button.label === WARDLEY_SWATCH
    );
    expect(wonder).toBeDefined();
    const hex = wonder!.color;
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);

    wonder!.click();
    await settle();

    // A picked swatch is a plain stored colour value and nothing else — no new
    // field, no migration owed (ADR 0027, decision 7).
    expect(shapeModel(shape).fillColor).toBe(hex);
  });

  test('a plain connector between two Wardley nodes opens on Wardley', async () => {
    // Tier two: the link stamps no role of its own and belongs to what it
    // links. No board here at all, so only the ends can answer.
    const source = addNode('[4000,4000,60,60]');
    const target = addNode('[4300,4000,60,60]');
    const connector = addConnector(source, target);
    await select(connector);

    const picker = connectorPicker();
    expect(picker).not.toBeNull();
    await openPicker(picker!);

    expect(carouselName(picker!)).toBe(WARDLEY_LABEL);
    expect(swatchLabels(panel(picker!)!)).toContain(WARDLEY_SWATCH);
  });

  test('a new selection re-opens on ITS origin, forgetting the page paged to', async () => {
    addMap();
    const onMap = addShape('[400,300,100,100]');
    const offMap = addShape('[4000,4000,100,100]');

    await select(onMap);
    const picker = shapePicker()!;
    await openPicker(picker);
    expect(carouselName(picker)).toBe(WARDLEY_LABEL);
    // Somewhere that is neither Wardley nor the base page, so the assertions
    // below cannot pass by accident.
    await wheelPage(picker, 1);
    const pagedTo = carouselName(picker);
    expect(pagedTo).not.toBe(WARDLEY_LABEL);
    expect(pagedTo).not.toBe(BASE_LABEL);

    // The toolbar now serves an element on no board at all.
    await select(offMap);
    const bare = shapePicker()!;
    // The very element that was paged away from: lit reuses it across
    // selections, which is precisely why the page has to be FORGOTTEN rather
    // than left to a fresh mount. Without this, the assertion below would pass
    // on a new component and prove nothing.
    expect(bare).toBe(picker);
    await openPicker(bare);
    expect(carouselName(bare)).toBe(BASE_LABEL);

    // …and going back re-opens on the map's page, not on the one paged to.
    await select(onMap);
    const again = shapePicker()!;
    expect(again).toBe(picker);
    await openPicker(again);
    expect(carouselName(again)).toBe(WARDLEY_LABEL);
  });

  describe('with the Wardley flag off', () => {
    beforeEach(async () => {
      unmount?.();
      unmount = null;
      await mount({ wardley: false } as BlockFlags);
    });

    test('the map keeps its colours, and the carousel loses its page', async () => {
      // Offering hues is TOOLING (ADR 0009): the board still loads and paints,
      // and only the shelf that offers more Wardley hues goes away.
      addMap();
      const shape = addShape('[400,300,100,100]');
      await select(shape);

      const picker = shapePicker();
      expect(picker).not.toBeNull();
      await openPicker(picker!);

      expect(picker!.paletteGroups.map(group => group.key)).not.toContain(
        'wardley'
      );
      // No Wardley page to open on, so the origin rule falls back to page one.
      expect(carouselName(picker!)).toBe(BASE_LABEL);
      expect(swatchLabels(panel(picker!, 'Fill color')!)).not.toContain(
        WARDLEY_SWATCH
      );
    });
  });
});
