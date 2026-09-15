import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  type ToolbarContext,
  ToolbarModuleIdentifier,
} from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import {
  umlPartitionToolbarConfig,
  umlPartitionToolbarExtension,
  umlRegionToolbarConfig,
  umlRegionToolbarExtension,
} from '../toolbar/config.js';
import { fakePartition, fakeRegion } from './board-stub.js';

/**
 * The two phase-2 frames' contextual rows: what they offer, what they write,
 * and which element each of them belongs to.
 *
 * The integration suite drives the same two rows through a real editor
 * (`uml-behavior-2.spec.ts`); what is pinned HERE is what a live editor is bad
 * at showing — the exact patch each entry hands `EdgelessCRUDIdentifier`, and
 * the DI flavour each module is keyed under. A row registered on the wrong
 * flavour still renders, on the wrong element, and no screenshot says so.
 *
 * Both configs are ALWAYS-ON (`view.ts` registers them outside the flag test),
 * which is why this spec is about content affordances rather than about
 * tooling: every entry below has to keep working on a document opened with the
 * `uml` button switched off.
 */

/* ── The context these rows are handed ──────────────────────────────────── */

/** One write the toolbar asked the surface for. */
interface Write {
  id: string;
  props: Record<string, unknown>;
}

/**
 * A `ToolbarContext` reduced to what these two rows actually touch: the
 * selection, the undo checkpoint, and the CRUD seam.
 *
 * Deliberately not a real one. A `ToolbarContext` needs a mounted editor, and
 * everything this spec is about happens between the selection and
 * `updateElement` — so the stub IS the boundary under test, and a captured
 * write is the assertion.
 */
function contextFor(models: readonly unknown[]) {
  const writes: Write[] = [];
  let captures = 0;
  const crud = {
    updateElement: (id: string, props: Record<string, unknown>) => {
      writes.push({ id, props });
    },
  };
  const ctx = {
    std: {
      store: {
        captureSync: () => {
          captures += 1;
        },
      },
      get: (identifier: unknown) =>
        identifier === EdgelessCRUDIdentifier ? crud : undefined,
      getOptional: () => undefined,
    },
    getSurfaceModels: () => models,
    getSurfaceModelsByType: (
      klass: abstract new (...args: never[]) => unknown
    ) => models.filter(model => model instanceof klass),
  } as unknown as ToolbarContext;

  return { ctx, writes, captured: () => captures };
}

/** One entry of a config, by the id it sorts under. */
function entry(
  config: { actions: readonly unknown[] },
  id: string
): {
  active?: (ctx: ToolbarContext) => boolean;
  run?: (ctx: ToolbarContext) => void;
} {
  const found = (config.actions as { id: string }[]).find(
    action => action.id === id
  );
  expect(found, id).toBeDefined();
  return found as never;
}

/* ── The partition's own gesture ────────────────────────────────────────── */

describe('the activity partition row', () => {
  test('the orientation toggle turns the bands, and writes nothing else', () => {
    const partition = fakePartition('p-1', [0, 0, 400, 600], {
      orientation: 'vertical',
    });
    const { ctx, writes, captured } = contextFor([partition]);

    entry(umlPartitionToolbarConfig, 'b.orientation').run!(ctx);

    // ONE field. The flip is a statement about how the frame is drawn, and
    // §15.6.4 gives the two readings the same meaning — so the name, the box
    // and the resize gating are none of its business.
    expect(writes).toEqual([
      { id: 'p-1', props: { orientation: 'horizontal' } },
    ]);
    // …and one undo checkpoint, so one click is one Ctrl+Z.
    expect(captured()).toBe(1);
  });

  test('a partition already horizontal turns back', () => {
    const partition = fakePartition('p-1', [0, 0, 400, 600], {
      orientation: 'horizontal',
    });
    const { ctx, writes } = contextFor([partition]);

    entry(umlPartitionToolbarConfig, 'b.orientation').run!(ctx);

    expect(writes).toEqual([{ id: 'p-1', props: { orientation: 'vertical' } }]);
  });

  test('a mixed selection converges instead of alternating', () => {
    // The rule the resize toggle already follows: the click means "make them
    // all horizontal" unless they already all are. A per-element flip would
    // leave two partitions swapping places with every press.
    const vertical = fakePartition('p-1', [0, 0, 400, 600]);
    const horizontal = fakePartition('p-2', [400, 0, 400, 600], {
      orientation: 'horizontal',
    });
    const { ctx, writes } = contextFor([vertical, horizontal]);

    entry(umlPartitionToolbarConfig, 'b.orientation').run!(ctx);

    expect(writes.map(write => write.props.orientation)).toEqual([
      'horizontal',
      'horizontal',
    ]);
  });

  test('the button reads as pressed exactly when the bands are turned', () => {
    const active = entry(umlPartitionToolbarConfig, 'b.orientation').active!;

    // `vertical` is the default, so an untouched partition is the unpressed
    // state — otherwise every partition on the canvas would read as modified.
    expect(
      active(contextFor([fakePartition('p-1', [0, 0, 400, 600])]).ctx)
    ).toBe(false);
    expect(
      active(
        contextFor([
          fakePartition('p-1', [0, 0, 400, 600], {
            orientation: 'horizontal',
          }),
        ]).ctx
      )
    ).toBe(true);
    // A mixed selection is not "turned": `every`, so the button offers the
    // gesture that would make the selection agree with itself.
    expect(
      active(
        contextFor([
          fakePartition('p-1', [0, 0, 400, 600]),
          fakePartition('p-2', [400, 0, 400, 600], {
            orientation: 'horizontal',
          }),
        ]).ctx
      )
    ).toBe(false);
    // Nothing selected is nothing to report.
    expect(active(contextFor([]).ctx)).toBe(false);
  });

  test('the resize toggle flips the declared gating field', () => {
    const partition = fakePartition('p-1', [0, 0, 400, 600], {
      resizeEnabled: true,
    });
    const { ctx, writes } = contextFor([partition]);
    const toggle = entry(umlPartitionToolbarConfig, 'a.toggle-resize');

    expect(toggle.active!(ctx)).toBe(true);
    toggle.run!(ctx);
    expect(writes).toEqual([{ id: 'p-1', props: { resizeEnabled: false } }]);
  });
});

/* ── The region's row ───────────────────────────────────────────────────── */

describe('the composite state region row', () => {
  test('carries the resize toggle and nothing else', () => {
    // §14.2.4 puts the name compartment at the top of a region and nowhere
    // else, so there is no second reading to flip to — and an orientation
    // toggle here would be a button whose two states draw the same picture.
    expect(umlRegionToolbarConfig.actions.map(action => action.id)).toEqual([
      'a.toggle-resize',
    ]);

    const region = fakeRegion('r-1', [0, 0, 500, 400], {
      resizeEnabled: false,
    });
    const { ctx, writes, captured } = contextFor([region]);
    const toggle = entry(umlRegionToolbarConfig, 'a.toggle-resize');

    expect(toggle.active!(ctx)).toBe(false);
    toggle.run!(ctx);
    expect(writes).toEqual([{ id: 'r-1', props: { resizeEnabled: true } }]);
    expect(captured()).toBe(1);
  });
});

/* ── Which element each row belongs to ──────────────────────────────────── */

describe('the two rows are keyed to their own frames', () => {
  test('each config shows itself only for its own element type', () => {
    const partition = fakePartition('p-1', [0, 0, 400, 600]);
    const region = fakeRegion('r-1', [0, 0, 500, 400]);

    expect(umlPartitionToolbarConfig.when(contextFor([partition]).ctx)).toBe(
      true
    );
    // The two frames are drawn on the same sheet and are both banded
    // rectangles: a `when` reading the wrong class is a row that appears on the
    // wrong selection, which is exactly what `getSurfaceModelsByType` is for.
    expect(umlPartitionToolbarConfig.when(contextFor([region]).ctx)).toBe(
      false
    );
    expect(umlRegionToolbarConfig.when(contextFor([region]).ctx)).toBe(true);
    expect(umlRegionToolbarConfig.when(contextFor([partition]).ctx)).toBe(
      false
    );
    expect(umlPartitionToolbarConfig.when(contextFor([]).ctx)).toBe(false);
    expect(umlRegionToolbarConfig.when(contextFor([]).ctx)).toBe(false);
  });

  test('each module mounts under its own surface flavour', () => {
    // The DI half of the same claim, and the one no rendering test can make: a
    // module is bound by the flavour it hangs off, and the editor merges the
    // row from exactly those bindings. Both are the BARE flavour — the
    // always-on slot — because neither row has a flag-gated twin
    // (`docs/adr/0009`, and the long note in `toolbar/config.ts`).
    const container = new Container();
    umlPartitionToolbarExtension.setup(container);
    umlRegionToolbarExtension.setup(container);

    const variants = [
      ...container.provider().getAll(ToolbarModuleIdentifier).keys(),
    ];
    expect(variants).toContain('affine:surface:umlPartition');
    expect(variants).toContain('affine:surface:umlRegion');
    // …and neither claimed the diagram's slot on the way past.
    expect(variants).not.toContain('affine:surface:umlDiagram');
  });
});
