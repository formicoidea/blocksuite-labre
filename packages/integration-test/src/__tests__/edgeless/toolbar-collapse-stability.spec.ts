import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ValidationManager } from '@labre/affine/blocks/surface';
import { TOOLBAR_ROOM_HYSTERESIS } from '@labre/affine/shared/services';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { GfxPrimitiveElementModel } from '@labre/affine/std/gfx';
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

  /**
   * How far the row is sticking out of the room it was given, in pixels.
   *
   * The cap `size()` writes is a `max-width`, so a row that has not given up
   * enough does not push its neighbours aside or wrap — it OVERFLOWS, and the
   * entries past the cap are the ones under the cursor's own scrollbar-less
   * edge. Zero is the invariant; anything else is the row spilling.
   */
  const spill = () => {
    const bar = toolbar();
    if (!bar) return 0;
    return bar.scrollWidth - bar.clientWidth;
  };

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
   * The other half of the diagnosis, kept as a guard — and vindicated.
   *
   * On a COMPONENT's row the positioner was steady: what the eye read as
   * hesitation was the row's own width changing under a stable `top-start`
   * anchor, and freezing the plan cured it. The anchoring itself only started
   * to argue on the one selection this test does not use — the map BACKGROUND,
   * whose reference dwarfs the screen (PO recette of 25/08/2026, third video;
   * `flip`'s alignment arbitration, fixed in the positioner). This test keeps
   * the component's half of the claim; the background's is the test below.
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
   * The same guard, on the toolbar the PO's recette of 25/08/2026 (third
   * video) is about: the MAP BACKGROUND's own row.
   *
   * The background is the one selection whose reference is far bigger than the
   * viewport — under zoom its ideal anchor leaves the screen and the
   * positioner's `shift` clamp is what keeps the row visible. That clamped
   * position must be as steady as the unclamped one: the video shows the row
   * teleporting between the clamped anchor and a second, unrelated one, frame
   * after frame, while its composition never changes.
   */
  test('the background row never hesitates between two anchors', async () => {
    const map = addMap();
    addComponent();
    await select(map);

    const samples = await zoomFrames(24);

    // Composition steady — the fitter is not the suspect here.
    expect([...new Set(samples.map(s => s.composition))]).toHaveLength(1);

    const seen = samples.map(s => s.anchor);
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

  /**
   * **The same glitch, on the background's row** (PO recette of 25/08/2026,
   * second point).
   *
   * The second pass froze the plan across re-renders, and the PO confirmed it
   * on a selected COMPONENT: the word stopped coming back. On the row of the
   * map's BACKGROUND — the one carrying the display toggles, the "Validation"
   * dropdown and its level of requirement — the toolbar kept flapping, and his
   * question was the right one: was the answer ever generalised?
   *
   * It was not, and the reason is what the two rows are made of. A component's
   * row is entries the WIDGET draws: an id, a word, an icon. List them and you
   * have described the row completely — two renders with the same list are two
   * renders of the same widths, which is exactly what the second pass relies
   * on. The background's row is mostly entries the widget does NOT draw: a
   * framework groups its toggles behind one entry, and the level of requirement
   * is a dropdown that NAMES the profile in force on its own trigger. For that
   * row the list of entries says nothing at all about what the row costs:
   *
   * - `Sketch` and `Strict` are the same entry, ten pixels apart;
   * - a map given a gradient variant grows a sixth toggle inside the same
   *   grouped entry — one whole button, same list.
   *
   * So the row could change by thirty pixels while its plan, and the
   * measurements the plan was arithmetic on, went on describing the row it used
   * to be. The tests below are that gap, from both sides: a row that says
   * something new is re-measured where it stands, and a row that says the same
   * thing twice is still free.
   */
  describe('and one of its own entries starts saying something else', () => {
    const backgroundOf = (id: string) =>
      service.surface.getElementById(id) as unknown as GfxPrimitiveElementModel;

    /**
     * A gradient variant, which is what makes the "show / hide the gradient"
     * toggle relevant — and therefore present, inside the grouped entry the
     * framework declares. The production path: the same write the variant
     * picker makes.
     */
    const setVariant = (id: string, variant: string) =>
      service.surface.updateElement(id, { variant });

    /** The level of requirement, switched the way the dropdown switches it. */
    const setProfile = (id: string, profileId: string) =>
      service.std
        .getOptional(ValidationManager)
        ?.setProfile(backgroundOf(id), profileId);

    /** Pans until the row has `extra` pixels of room and no more. */
    const roomJustAbove = async (extra: number) => {
      const width = toolbar()!.offsetWidth;
      for (let i = 0; i < 8 && capOf() > width + extra + 4; i++) {
        await roomFor(width + extra);
      }
    };

    test('a row that says something new is measured again, where it stands', async () => {
      const map = addMap();
      await select(map);

      // A room that fits this row with ten pixels to spare — and does not fit
      // the row it is about to become.
      await roomJustAbove(10);

      expect(spill()).toBeLessThanOrEqual(1);
      expect(composition()).toContain('b.lock');

      // One more toggle inside the grouped entry: same entries, wider row.
      setVariant(map, 'opportunity');
      await settle();

      // The row was re-measured and spent a step. Before, nothing was measured
      // at all — the entries had not changed, so the row was declared the row
      // already on screen and kept a plan made for a row thirty pixels
      // narrower. It simply overflowed.
      expect(spill()).toBeLessThanOrEqual(1);
      expect(lines()).toBe(1);
      expect(composition()).toContain('b.5-gradient');
      expect(composition()).not.toContain('b.lock');
    });

    test('and it is measured without ever being shown whole', async () => {
      const map = addMap();
      await select(map);
      await roomJustAbove(10);

      const renders = countRenders();
      const samples: number[] = [];

      setVariant(map, 'opportunity');
      // The tick the rebuild lands in, then the frames it is measured and
      // corrected in. A row that had to be drawn undegraded to be measured
      // would be caught spilling in one of them.
      samples.push(spill());
      for (let i = 0; i < 6; i++) {
        await frames(1);
        samples.push(spill());
      }
      await settle();
      samples.push(spill());

      expect(Math.max(...samples)).toBeLessThanOrEqual(1);
      // One correction, plus the round of verification the fitter allows
      // itself. Not a row rebuilt from nothing.
      expect(renders.stop()).toBeLessThanOrEqual(3);
    });

    test('the row never spills, through a zoom that keeps writing to it', async () => {
      const map = addMap();
      await select(map);
      await roomJustAbove(10);

      // The room the plan on screen was made for. A gesture FREEZES the plan
      // (first pass), so the row is allowed to end up outside its room by as
      // much as the room has shrunk under it since — and by not one pixel
      // more, because every other pixel would be the row itself having grown.
      const roomAtPlan = capOf();

      // The PO's gesture: a zoom, with the map being written to under it — a
      // variant picked, a collaborator, a validation pass. Sampled twice per
      // frame, because a row that spills for one frame spills.
      const samples: { spill: number; owed: number; lines: number }[] = [];
      for (let i = 0; i < 24; i++) {
        service.viewport.setZoom(service.viewport.zoom * 1.002, undefined, true);
        if (i % 4 === 0)
          setVariant(map, i % 8 === 0 ? 'classic' : 'opportunity');
        const sample = () =>
          samples.push({
            spill: spill(),
            owed: Math.max(0, roomAtPlan - capOf()),
            lines: lines(),
          });
        sample();
        await frames(1);
        sample();
      }
      await settle();

      // Never wider than the row it is, only ever than the room it has — to
      // within the hysteresis, which is the width below which this toolbar
      // considers two measurements to be the same measurement anyway.
      expect(
        samples.filter(s => s.spill > s.owed + TOOLBAR_ROOM_HYSTERESIS)
      ).toEqual([]);
      expect([...new Set(samples.map(s => s.lines))]).toEqual([1]);
      // And once the gesture lands, the row is inside its room outright.
      expect(spill()).toBeLessThanOrEqual(1);
      expect(lines()).toBe(1);
    });

    test('the level of requirement, switched mid-zoom, changes the row once', async () => {
      const map = addMap();
      await select(map);
      await roomJustAbove(10);

      const seen: string[] = [];
      for (let i = 0; i < 24; i++) {
        service.viewport.setZoom(service.viewport.zoom * 1.002, undefined, true);
        // `Sketch` becomes `Strict` on the dropdown's own trigger: a real
        // change, and the only one of the gesture.
        if (i === 8) setProfile(map, 'wardley.strict');
        seen.push(composition());
        await frames(1);
        seen.push(composition());
      }
      await settle();

      // At most one composition after the one it started with — and never a
      // composition coming back after another was shown, which is the row
      // oscillating.
      expect(new Set(seen).size).toBeLessThanOrEqual(2);
      const revisited = seen.filter(
        (value, index) =>
          seen.indexOf(value) !== index && seen[index - 1] !== value
      );
      expect(revisited).toEqual([]);
    });

    test('and saying the same thing twice is still free', async () => {
      const map = addMap();
      const component = addComponent();
      await select(map);
      await roomJustAbove(10);

      const before = composition();
      const renders = countRenders();

      // The second pass' own gesture, on this row: a write to an element the
      // toolbar is not about, landing on every fourth frame of a zoom. Each of
      // them rebuilds the row from the registry, and each of them resolves the
      // dropdown's template afresh — a new object every time, saying exactly
      // the same thing. Nothing may come of it.
      const seen: string[] = [];
      for (let i = 0; i < 24; i++) {
        service.viewport.setZoom(service.viewport.zoom * 1.002, undefined, true);
        if (i % 4 === 0)
          service.surface.updateElement(component, {
            xywh: `[${871 + i},441,18,18]`,
          });
        seen.push(composition());
        await frames(1);
        seen.push(composition());
      }

      expect([...new Set(seen)]).toEqual([before]);
      expect(renders.stop()).toBe(0);
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
