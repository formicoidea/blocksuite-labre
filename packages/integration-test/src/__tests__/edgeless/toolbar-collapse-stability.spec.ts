import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The toolbar holds still while the map moves** (PO review of 02/08/2026,
 * second pass, point 1).
 *
 * `toolbar-priority-collapse.spec.ts` owns what the row does when the room
 * changes. This one owns what it does WHILE the room is changing: nothing. A
 * zoom moves the selected element sixty times a second, and the room the row
 * has moves with it; a row that re-composes on every one of those frames is a
 * row that visibly hesitates between several widths — and, because its width
 * feeds the anchoring, between several positions.
 */

/** See `wardley-validation-bubble.spec.ts`: the viewport persists per doc id. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

describe('the contextual toolbar, while the viewport moves', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let unmount: (() => void) | null = null;

  const widget = () =>
    root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
      | { toolbar?: HTMLElement }
      | undefined;

  const toolbar = () => widget()?.toolbar ?? null;

  const entries = () => Array.from(toolbar()?.children ?? []) as HTMLElement[];

  /**
   * What the row is made of, right now.
   *
   * Every entry, in order, and how it reads: with its word, as an icon alone,
   * or — for the "⋮" — that it is there at all. This string changing IS the
   * glitch the PO saw.
   */
  const composition = () =>
    entries()
      .map(child => {
        const id = child.dataset.toolbarActionId;
        if (!id) return child.localName;
        return `${id}:${child.querySelector('.label') ? 'label' : 'icon'}`;
      })
      .join('|');

  /**
   * The entry the PO's recette of 25/08/2026 is about.
   *
   * It is the wordiest thing on a component's toolbar, so it is the first to
   * give way and the one whose mode the eye follows.
   */
  const READING = 'y1.element-reading';

  /**
   * How ONE entry reads, right now: its word, its icon alone, or a line of the
   * "⋮" menu. This value changing during a gesture IS the glitch — the row's
   * composition above says the same thing about the whole row, but the PO
   * pointed at this entry, so this is what is sampled frame by frame.
   */
  const modeOf = (id: string) => {
    const bar = toolbar();
    if (!bar) return 'gone';
    const node = bar.querySelector<HTMLElement>(
      `[data-toolbar-action-id="${id}"]`
    );
    if (!node) return 'gone';
    // Menu lines live in the toolbar's light DOM whether the menu is open or
    // not, so an entry that moved into the "⋮" is found here too.
    if (node.localName === 'editor-menu-action') return 'menu';
    return node.querySelector('.label') ? 'label' : 'icon';
  };

  /** Where the row is anchored, as the positioner last wrote it. */
  const anchor = () => toolbar()?.style.transform ?? '';

  /** How many lines the row occupies — the invariant of the first pass. */
  const lines = () => new Set(entries().map(child => child.offsetTop)).size;

  /** The cap `size()` wrote on the toolbar. */
  const capOf = () => Number.parseFloat(toolbar()!.style.maxWidth);

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  const settle = async () => {
    await wait(400);
    await root.updateComplete;
    await frames();
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  /** See `toolbar-priority-collapse.spec.ts`: pans until the row is tight. */
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

  const addComponent = () =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh: '[871,441,18,18]',
    });

  /**
   * A wheel zoom, frame by frame, the way a trackpad delivers one.
   *
   * `wheel` is what tells the viewport a gesture is under way, so this is the
   * gesture the widget sees — not a programmatic jump to a zoom level.
   */
  const zoomFrames = async (count: number, step = 1.04) => {
    const samples: { composition: string; anchor: string; lines: number }[] = [];
    for (let i = 0; i < count; i++) {
      service.viewport.setZoom(service.viewport.zoom * step, undefined, true);
      await frames(1);
      samples.push({
        composition: composition(),
        anchor: anchor(),
        lines: lines(),
      });
    }
    return samples;
  };

  /** Counts the times the row was rebuilt: one re-render, one mutation burst. */
  const countRenders = () => {
    const state = { count: 0 };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) state.count++;
    });
    observer.observe(toolbar()!, { childList: true, subtree: true });
    return {
      stop: () => {
        observer.takeRecords();
        observer.disconnect();
        return state.count;
      },
    };
  };

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

  test('a zoom that is running never re-composes the row', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    // A width where the row has already spent something, so every further
    // pixel is a candidate for another degradation — the worst case.
    await roomFor(320);

    const before = composition();
    const renders = countRenders();

    const samples = await zoomFrames(24);

    // The plan is frozen for the whole gesture: one composition, start to end.
    expect([...new Set(samples.map(s => s.composition))]).toEqual([before]);
    // And nothing was rebuilt to produce it.
    expect(renders.stop()).toBe(0);
    // The invariant of the first pass survives the gesture untouched.
    expect([...new Set(samples.map(s => s.lines))]).toEqual([1]);
  });

  test('the row is replanned once, when the viewport lands', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    await roomFor(320);

    const before = composition();
    const renders = countRenders();
    await zoomFrames(24);
    await settle();

    // One replan, at the accalmie. `ToolbarFitter` verifies its own plan, so a
    // round of confirmation is allowed — a per-frame replan is not.
    const count = renders.stop();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);

    // And it replanned for the width the gesture ENDED on, not the one it
    // started from: that room is now tiny, and nothing on the row keeps a word
    // it could have given up.
    expect(composition()).not.toBe(before);
    expect(composition()).not.toContain(':label');
    expect(lines()).toBe(1);
  });

  /**
   * The other half of the diagnosis, kept as a guard.
   *
   * The positioner was NOT the oscillator: the transform it writes moves once
   * per frame, steadily, in the direction of the zoom — it did so before the
   * plan was frozen and it does so after. What the eye read as the row
   * hesitating between anchor points was the row's own WIDTH changing under a
   * stable anchor: `top-start` pins the left edge, so every composition the
   * fitter tried moved the other three. Freeze the plan and the movement is the
   * zoom's alone. This test fails the day the anchoring itself starts to argue.
   */
  test('the anchor never goes back to a place it just left', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    await roomFor(320);

    const samples = await zoomFrames(24);
    const seen = samples.map(s => s.anchor);

    // A zoom moves the row steadily in one direction. A position that comes
    // back after another one was shown is the toolbar hesitating between two
    // anchor points, which is what the PO reported.
    const revisited = seen.filter(
      (value, index) => seen.indexOf(value) !== index && seen[index - 1] !== value
    );

    expect(revisited).toEqual([]);
  });

  /**
   * **The word never comes back** (PO recette of 25/08/2026).
   *
   * The freeze of the second pass covers the REPLANNING — the path that starts
   * from a room that changed. It does not cover the other path: the widget
   * re-renders the row from the registry whenever anything it watches moves,
   * and on the canvas that is a long list — an element updated anywhere, a
   * block updated, a selection re-emitted, something hovered. Any of those can
   * land on any frame of a gesture, and each one used to throw the plan away,
   * paint the undegraded row, and only then measure and degrade it again.
   *
   * What the PO saw is exactly that: "Read this component" reading its word
   * for a frame, then its icon, then a line of the "⋮", then its word again.
   * The three tests below sample the ENTRY, frame by frame, with those
   * re-renders happening during the gesture.
   */
  describe('and something else in the document changes while it moves', () => {
    /**
     * A write to an element the toolbar is not about.
     *
     * This is the production path, not a stand-in for it: `elementUpdated`
     * reaches the widget, which rebuilds the row from the registry. A
     * collaborator, a validation pass, a label edit finishing its debounce —
     * all of them arrive here.
     */
    const touchSomethingElse = (id: string, n: number) =>
      service.surface.updateElement(id, { xAxisTitle: `t${n}` });

    test('a re-render does not put the word back, not even for a frame', async () => {
      const map = addMap();
      const component = addComponent();
      await select(component);

      await roomFor(320);

      // The row is tight: this entry has already traded its word for its icon.
      expect(modeOf(READING)).toBe('icon');

      touchSomethingElse(map, 0);

      // Read synchronously: the widget rebuilds the row in this very tick, so
      // this is the frame the eye is given. It used to read `label` here.
      expect(modeOf(READING)).toBe('icon');

      await frames(1);
      expect(modeOf(READING)).toBe('icon');

      await settle();
      expect(modeOf(READING)).toBe('icon');
    });

    test('a zoom never changes how the entry reads, re-renders and all', async () => {
      const map = addMap();
      const component = addComponent();
      await select(component);

      await roomFor(320);

      const before = modeOf(READING);
      expect(before).not.toBe('gone');

      // Two samples per frame: the tick the re-render lands on, and the frame
      // it was painted in. A flash that lives inside one frame is still a
      // flash — it is what a 120Hz trackpad zoom shows.
      const modes: string[] = [];
      for (let i = 0; i < 24; i++) {
        service.viewport.setZoom(service.viewport.zoom * 1.04, undefined, true);
        if (i % 4 === 0) touchSomethingElse(map, i);
        modes.push(modeOf(READING));
        await frames(1);
        modes.push(modeOf(READING));
      }

      expect([...new Set(modes)]).toEqual([before]);
    });

    test('and the row is still replanned once the gesture lands', async () => {
      const map = addMap();
      const component = addComponent();
      await select(component);

      await roomFor(320);

      const renders = countRenders();
      for (let i = 0; i < 24; i++) {
        service.viewport.setZoom(service.viewport.zoom * 1.04, undefined, true);
        if (i % 4 === 0) touchSomethingElse(map, i);
        await frames(1);
      }
      await settle();

      // Holding the plan still is not the same as never planning again: the
      // accalmie spends one, for the width the gesture ended on, and the row
      // that was `icon` throughout has given up its place by then.
      expect(renders.stop()).toBeGreaterThan(0);
      expect(modeOf(READING)).toBe('menu');
      expect(composition()).not.toContain(':label');
      expect(lines()).toBe(1);
    });
  });

  test('a room that only trembles is a room that has not changed', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    await roomFor(320);

    const before = composition();
    const renders = countRenders();

    // Two measurements a hair apart are the same measurement. Alternating by a
    // pixel — rounding, a scrollbar, a subpixel zoom — must never re-compose.
    for (let i = 0; i < 6; i++) {
      service.viewport.applyDeltaCenter(i % 2 ? 1 : -1, 0);
      await settle();
      expect(composition()).toBe(before);
    }

    expect(renders.stop()).toBe(0);
  });
});
