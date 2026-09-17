import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import {
  exportWardleyOwm,
  WARDLEY_BACKGROUND,
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
  wardleyBoardFrom,
  wardleyCanonicalBox,
  wardleyExportElementsOf,
  wardleyNodeProps,
} from '@labre/affine-gfx-wardley';
import {
  TextElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine/model';
import {
  ActionPlacement,
  ToolbarContext,
  type ToolbarActionGenerator,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import { getRegisteredCommands } from '@labre/affine/std';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The OWM export, scoped to the map the user selected (R5 of
 * `docs/add-a-framework/02-framework-rules.md`).
 *
 * The unit suite owns the writer and the scoping over plain stubs. What only a
 * real editor can answer is the other half of the ruling: that the command is
 * offered where a user actually reaches it — the selected map's "⋮" — and that
 * the file it produces on a REAL surface, with real element bounds and a real
 * selection, holds the components of that map and of no other one beside it.
 *
 * Two maps side by side is the whole fixture, because one map proves nothing: a
 * board with a single map exports the same bytes whether the scoping works or
 * not.
 */
describe('exporting the selected Wardley map', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  const MAP_W = 1600;
  const MAP_H = 900;

  /** A Wardley map background at `x`, the size the toolbox draws one. */
  const addMap = (x: number) =>
    surfaceModel().addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(x, 0, MAP_W, MAP_H).serialize(),
    });

  /**
   * A named component: the circle, and the free text that names it.
   *
   * The name is a separate element on this canvas, and the writer matches it to
   * its node by geometry (`matchLabels`), so the label is re-centred on the
   * node's middle once it exists — a text element sizes its box to its words,
   * and the vertical anchor is only right against the box it actually got.
   */
  const addNamed = async (name: string, cx: number, cy: number) => {
    const surface = surfaceModel();
    const nodeId = surface.addElement(
      wardleyNodeProps('component', {
        xywh: wardleyCanonicalBox('component', cx, cy),
      })
    );
    const labelId = surface.addElement({
      type: 'text',
      text: name,
      role: WARDLEY_ROLE.label,
      xywh: new Bound(
        cx + WARDLEY_NODE_SIZE.component.w / 2 + 8,
        cy - 13,
        120,
        26
      ).serialize(),
    });
    await wait();

    const label = surface.getElementById(labelId);
    expect(label).toBeInstanceOf(TextElementModel);
    const box = label!.elementBound;
    label!.xywh = new Bound(
      cx + WARDLEY_NODE_SIZE.component.w / 2 + 8,
      cy - box.h / 2,
      box.w,
      box.h
    ).serialize();
    await wait();
    return { nodeId, labelId };
  };

  /** The two maps, each with one named component wholly inside it. */
  const twoMaps = async () => {
    const mapA = addMap(0);
    const mapB = addMap(2000);
    await wait();
    await addNamed('Alpha', 200, 400);
    await addNamed('Bravo', 2200, 400);
    return { mapA, mapB };
  };

  const exportCommand = () => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'wardley.exportOwm'
    );
    expect(command, 'wardley.exportOwm is not registered').toBeDefined();
    return command!;
  };

  /** What the shipped command would write, for the selection in force. */
  const exported = () =>
    exportWardleyOwm(wardleyBoardFrom(wardleyExportElementsOf(edgeless.std)));

  const WARDLEY_FLAVOUR = 'affine:surface:wardley';

  /**
   * The toolbar context a click on the map would carry.
   *
   * The registry's two signals are written here rather than waited for: they
   * are what the toolbar widget sets when the selection changes, and driving
   * them keeps this about WHICH ACTION is offered rather than about the
   * widget's render timing.
   */
  const select = (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    const models = ids
      .map(id => surfaceModel().getElementById(id))
      .filter(
        (model): model is WardleyBackgroundElementModel =>
          model instanceof WardleyBackgroundElementModel
      );
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    registry.flavour$.value = WARDLEY_FLAVOUR;
    registry.elementsMap$.value = new Map([[WARDLEY_FLAVOUR, models]]);
    return new ToolbarContext(edgeless.std);
  };

  test('the command needs a selected map, and writes that map alone', async () => {
    const { mapA, mapB } = await twoMaps();
    const command = exportCommand();

    // Nothing selected: the entry withdraws rather than greying.
    edgeless.gfx.selection.clear();
    expect(command.when?.(edgeless.std)).toBe(false);

    edgeless.gfx.selection.set({ elements: [mapA], editing: false });
    expect(command.when?.(edgeless.std)).toBe(true);

    const fromA = exported();
    expect(fromA).toContain('Alpha');
    expect(fromA).not.toContain('Bravo');

    // The other map, on the very same board: the selection is the scope, so
    // the file changes with it and nothing else does.
    edgeless.gfx.selection.set({ elements: [mapB], editing: false });
    const fromB = exported();
    expect(fromB).toContain('Bravo');
    expect(fromB).not.toContain('Alpha');
  });

  test('the selected map’s "⋮" offers it, and an empty canvas does not', async () => {
    const { mapA } = await twoMaps();

    const config = edgeless.std
      .get(ToolbarRegistryIdentifier)
      .getModuleBy(WARDLEY_FLAVOUR);
    expect(config, WARDLEY_FLAVOUR).toBeTruthy();
    // Typed as the generator entry it declares itself to be: the config's
    // `actions` is a heterogeneous tuple, and what a `find` narrows to is the
    // union of everything on the row.
    const entry = config!.actions.find(
      action => action.id === 'z.export-owm'
    ) as ToolbarActionGenerator | undefined;
    expect(entry, 'z.export-owm is not on the map row').toBeDefined();
    // Not a primary button: it is the rarest thing anybody does to a map, and
    // `ActionPlacement.More` is the single flag `renderToolbar` partitions the
    // row on.
    expect(entry!.placement).toBe(ActionPlacement.More);

    const offered = (ctx: ToolbarContext) => {
      const when = entry!.when;
      return typeof when === 'function' ? when(ctx) : when !== false;
    };

    expect(offered(select(mapA))).toBe(true);

    edgeless.gfx.selection.clear();
    expect(offered(new ToolbarContext(edgeless.std))).toBe(false);
  });
});
