import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { READING_PROPOSAL_WIDGET } from '@labre/affine/blocks/surface';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The toolbar never wraps** (PO arbitration of 02/08/2026), in a real editor.
 *
 * The unit suite owns the arithmetic — which entry gives way, and how many have
 * to. This one owns what only a browser can answer: that the row is measured at
 * all, that it stays ONE line at every width, that an entry pushed into the "⋮"
 * still does what it did, and that widening the room brings it back.
 *
 * The row is narrowed the way a user narrows it: by panning the map so the
 * selected element sits near the right edge of the window, which is exactly
 * what leaves `size()` little room to give — no test-only knob, no forced
 * style. `capOf` reads back the cap that middleware writes.
 */

/** Native-shaped click: composed, so it crosses the widget's shadow boundary. */
function clickElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
    pointerId: 1,
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

/** See `wardley-validation-bubble.spec.ts`: the viewport persists per doc id. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

/** The entry the PO named: wordy, and the one that must go icon-only first. */
const READING = 'y1.element-reading';

describe('the contextual toolbar, on one line', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let unmount: (() => void) | null = null;

  const widget = () =>
    root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
      | { toolbar?: HTMLElement }
      | undefined;

  const toolbar = () => widget()?.toolbar ?? null;

  const entries = () =>
    Array.from(toolbar()?.children ?? []) as HTMLElement[];

  /** The entry as it sits on the ROW, or `null` when it is not there. */
  const onRow = (id: string) =>
    entries().find(child => child.dataset.toolbarActionId === id) ?? null;

  const moreMenu = () =>
    toolbar()?.querySelector<HTMLElement & { show(force?: boolean): void }>(
      'editor-menu-button[aria-label="More menu"]'
    ) ?? null;

  /** The entry as an entry of the "⋮" menu, or `null`. */
  const inMenu = (id: string) =>
    moreMenu()?.querySelector<HTMLElement>(`[data-toolbar-action-id="${id}"]`) ??
    null;

  /**
   * Where one entry stands: on the row with its word, on the row as an icon, or
   * in the menu. The whole arbitration is an order between these three.
   */
  const stateOf = (id: string): 'label' | 'icon' | 'menu' | 'gone' => {
    const row = onRow(id);
    if (row) return row.querySelector('.label') ? 'label' : 'icon';
    return inMenu(id) ? 'menu' : 'gone';
  };

  /** How many lines the row occupies — the number this whole branch is about. */
  const lines = () => new Set(entries().map(child => child.offsetTop)).size;

  /** The cap `size()` wrote on the toolbar. */
  const capOf = () => Number.parseFloat(toolbar()!.style.maxWidth);

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  const settle = async () => {
    await wait(150);
    await root.updateComplete;
    await frames();
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  /**
   * Pans until the row has about `target` pixels to work with.
   *
   * Moving the map left moves the selected element right, and the toolbar is
   * anchored to the element's left edge — so the room `size()` computes shrinks
   * by exactly what we pan. Read back rather than assumed: `capOf` is the real
   * number the middleware wrote.
   */
  const roomFor = async (target: number) => {
    service.viewport.applyDeltaCenter(-(capOf() - target), 0);
    await settle();
  };

  const addMap = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  /** A component whose centre sits in the "Product" phase. */
  const addComponent = () =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh: '[871,441,18,18]',
    });

  const readingPanel = () =>
    root.widgetComponents[READING_PROPOSAL_WIDGET]?.shadowRoot?.querySelector(
      '[data-testid="reading-panel"]'
    ) ?? null;

  beforeEach(async () => {
    forgetStoredViewport();
    unmount = await setupEditor('edgeless');
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
    service.viewport.setZoom(1);
    service.viewport.setCenter(880, 450);
    return () => {
      unmount?.();
      unmount = null;
    };
  });
  afterEach(() => forgetStoredViewport());

  test('an entry gives up its word before it gives up its place', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    // Whole row, all the room in the world: the entry reads as words.
    expect(stateOf(READING)).toBe('label');

    // Squeeze it shut, one bite at a time, and record what the entry does.
    const seen: string[] = [stateOf(READING)];
    for (let room = capOf() - 60; room > 140; room -= 60) {
      await roomFor(room);

      // The invariant, checked at EVERY width — this is the regression the
      // arbitration is about: the "⋮" alone on a second line.
      expect(lines()).toBe(1);

      const state = stateOf(READING);
      if (state !== seen[seen.length - 1]) seen.push(state);
    }

    // Icon only comes BEFORE the menu, never the other way round, and the
    // entry is never simply dropped.
    expect(seen).toEqual(['label', 'icon', 'menu']);
  });

  test('the row keeps its height while the room runs out', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    const whole = toolbar()!.getBoundingClientRect().height;

    for (let room = capOf() - 80; room > 140; room -= 80) {
      await roomFor(room);
      expect(toolbar()!.getBoundingClientRect().height).toBe(whole);
    }
  });

  test('an entry in the "⋮" keeps its word and still does its job', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    await roomFor(150);
    expect(stateOf(READING)).toBe('menu');

    const entry = inMenu(READING)!;
    // Moved, not abbreviated: a menu has room for the whole sentence.
    expect(entry.querySelector('.label')?.textContent).toContain(
      'Read this component'
    );

    moreMenu()!.show(true);
    await settle();
    clickElement(entry);
    await settle();

    // The gesture the PO cares about, driven from where the entry ended up.
    expect(readingPanel()).not.toBeNull();
  });

  test('the room comes back, and so does the entry', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    const whole = capOf();

    await roomFor(150);
    expect(stateOf(READING)).toBe('menu');

    await roomFor(whole);
    // Reversible: nothing about the collapse is written down anywhere.
    expect(stateOf(READING)).toBe('label');
    expect(lines()).toBe(1);
  });

  test('a plain shape at a normal width is left exactly as it was', async () => {
    const shape = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[860,440,60,60]',
    });
    await select(shape);

    const row = entries();
    expect(row.length).toBeGreaterThan(0);
    expect(lines()).toBe(1);

    // Nothing has given way: no entry is wearing the icon-only fallback, and
    // the row still holds everything it holds today.
    expect(
      row.filter(child => child.dataset.iconOnly === 'true')
    ).toHaveLength(0);
    expect(toolbar()!.scrollWidth).toBeLessThanOrEqual(
      toolbar()!.clientWidth + 1
    );
  });
});
