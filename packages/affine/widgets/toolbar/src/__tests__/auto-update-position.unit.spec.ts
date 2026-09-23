import type {
  AutoUpdateOptions,
  ComputePositionConfig,
  Rect,
  ReferenceElement,
} from '@floating-ui/dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { calls, configs, updates, stage } = vi.hoisted(() => ({
  calls: [] as AutoUpdateOptions[],
  configs: [] as Partial<ComputePositionConfig>[],
  updates: [] as (() => void)[],
  /** The geometry the next `computePosition` is answered from, if any. */
  stage: { platform: undefined as object | undefined },
}));

vi.mock('@floating-ui/dom', async importOriginal => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    autoUpdate: (
      _reference: unknown,
      _floating: unknown,
      update: () => void,
      options: AutoUpdateOptions = {}
    ) => {
      calls.push(options);
      updates.push(update);
      return () => {};
    },
    // The real middleware chain, run against a stage instead of a layout —
    // happy-dom has no layout to run it against. Everything the widget passes
    // is passed through untouched, which is the point: what is measured here
    // is the configuration the widget builds.
    computePosition: (
      reference: never,
      floating: never,
      config: Partial<ComputePositionConfig>
    ) => {
      configs.push(config);
      return actual.computePosition(
        reference,
        floating,
        stage.platform
          ? { ...config, platform: stage.platform as never }
          : config
      );
    },
  };
});

import { autoUpdatePosition } from '../utils.js';

const reference = {
  getBoundingClientRect: () => new DOMRect(),
} as ReferenceElement;

const start = (
  flavour: string,
  options?: AutoUpdateOptions,
  // Only the `update` closure reads the toolbar, and the stub only runs it
  // when a test asks for it.
  toolbar: unknown = {}
) =>
  autoUpdatePosition(
    new AbortController().signal,
    toolbar as never,
    reference,
    flavour,
    'top',
    null,
    options
  );

beforeEach(() => {
  calls.length = 0;
  configs.length = 0;
  updates.length = 0;
  stage.platform = undefined;
});

describe('autoUpdatePosition', () => {
  test('does not poll every frame for a block anchor', () => {
    start('affine:paragraph');

    expect(calls[0].animationFrame).toBe(false);
    expect(calls[0].elementResize).toBe(false);
  });

  test('polls every frame for a canvas anchor', () => {
    start('affine:surface:shape');

    expect(calls[0].animationFrame).toBe(true);
  });

  test('an explicit option still wins', () => {
    start('affine:surface:shape', { animationFrame: false });

    expect(calls[0].animationFrame).toBe(false);
  });
});

/**
 * **The cap the row is planned from is the room the EDITOR has.**
 *
 * Would have caught the page-mode format bar collapsing at 1280px with a 320px
 * sidebar: an entry left for the "⋮" while 940px of editor column sat empty
 * beside it. The cap `size()` writes is the only number `ToolbarFitter` ever
 * sees, and it was being written before `shift()` had run — on an unaligned
 * placement floating-ui then answers with the row's own width less twice what
 * a row CENTRED on the selection would stick out by, which is not room at all,
 * and which collapses the moment the centred row would stick out by one pixel.
 */
describe('the room the positioner reports', () => {
  /** The editing column of a 1280px window with a 320px sidebar open. */
  const COLUMN: Rect = { x: 320, y: 0, width: 960, height: 720 };

  /** The format bar of a text selection, whole: ten entries and a "⋮". */
  const WHOLE_ROW = 404;

  /** The padding `size()` and `shift()` keep between the row and the edge. */
  const EDGE = 10;

  /** A row drawn `width: fit-content` under whatever cap is written on it. */
  function makeToolbar(naturalWidth: number) {
    const element = document.createElement('div');
    Object.assign(element, { updateComplete: Promise.resolve(true) });

    const drawn = () => {
      const cap = Number.parseFloat(element.style.maxWidth);
      return Number.isFinite(cap) ? Math.min(naturalWidth, cap) : naturalWidth;
    };

    return { element, drawn };
  }

  /**
   * A selection, a column, and a row — the three rects the chain needs.
   *
   * Deliberately the smallest platform `detectOverflow` accepts: every other
   * hook it reaches for is optional, and leaving them out keeps the arithmetic
   * under test readable.
   */
  function stageOn(
    column: Rect,
    selection: { x: number; width: number },
    toolbar: ReturnType<typeof makeToolbar>
  ) {
    const rect = { x: selection.x, y: 400, width: selection.width, height: 20 };
    const clientRect = {
      ...rect,
      top: rect.y,
      bottom: rect.y + rect.height,
      left: rect.x,
      right: rect.x + rect.width,
    };

    stage.platform = {
      getElementRects: () => ({
        reference: rect,
        floating: { x: 0, y: 0, width: toolbar.drawn(), height: 36 },
      }),
      getDimensions: () => ({ width: toolbar.drawn(), height: 36 }),
      getClippingRect: () => column,
      getClientRects: () => [clientRect],
    };
  }

  /** Runs the positioning loop once and waits for the cap to be written. */
  async function position(toolbar: ReturnType<typeof makeToolbar>) {
    updates[0]();
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (toolbar.element.style.maxWidth) return;
    }
  }

  const capOf = (toolbar: ReturnType<typeof makeToolbar>) =>
    Number.parseFloat(toolbar.element.style.maxWidth);

  test('`size` is asked last, after `shift` and after `flip`', async () => {
    const toolbar = makeToolbar(WHOLE_ROW);
    stageOn(COLUMN, { x: 340, width: 60 }, toolbar);

    start('affine:note', undefined, toolbar.element);
    await position(toolbar);

    // `undefined` where `inline()` is not wanted — the array is declarative,
    // and floating-ui drops the holes itself.
    const names = (configs[0].middleware ?? []).flatMap(middleware =>
      middleware ? [middleware.name] : []
    );

    // The order IS the fix: `size` answers with the clipping box only once
    // `shift` has declared it will slide the row along the x axis.
    expect(names).toContain('size');
    expect(names.indexOf('size')).toBeGreaterThan(names.indexOf('shift'));
    expect(names.indexOf('size')).toBeGreaterThan(names.indexOf('flip'));
  });

  test('a selection against the left edge still has the whole column', async () => {
    const toolbar = makeToolbar(WHOLE_ROW);
    // Three words selected at the very start of the line: the row, centred on
    // them, would begin 152px to the LEFT of the column. `shift` slides it
    // back in — nothing is missing, and nothing has to give way.
    stageOn(COLUMN, { x: 340, width: 60 }, toolbar);

    start('affine:note', undefined, toolbar.element);
    await position(toolbar);

    expect(capOf(toolbar)).toBe(COLUMN.width - 2 * EDGE);
    // The number the widget used to be given instead: the row's own width,
    // less twice its overhang. 80px of "room" inside a 960px column.
    expect(capOf(toolbar)).toBeGreaterThan(WHOLE_ROW);
  });

  test('and so does a selection in the middle of the line', async () => {
    const toolbar = makeToolbar(WHOLE_ROW);
    stageOn(COLUMN, { x: 700, width: 60 }, toolbar);

    start('affine:note', undefined, toolbar.element);
    await position(toolbar);

    // The room is a property of the COLUMN, not of where the caret is: the
    // same cap wherever the selection sits. Before, it swung by hundreds of
    // pixels from one selection to the next.
    expect(capOf(toolbar)).toBe(COLUMN.width - 2 * EDGE);
  });

  test('a column too narrow for any row still gets a readable one', async () => {
    const toolbar = makeToolbar(WHOLE_ROW);
    // A 100px column: the room is 80px, which is less than the "⋮" and the two
    // entries worth opening it for. The cap is floored there instead, so the
    // row is cut at its own background rather than crushed to nothing.
    stageOn(
      { x: 0, y: 0, width: 100, height: 720 },
      { x: 20, width: 40 },
      toolbar
    );

    start('affine:note', undefined, toolbar.element);
    await position(toolbar);

    expect(capOf(toolbar)).toBe(120);
  });
});
