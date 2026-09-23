import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { LEGEND_ROLE } from '@labre/affine/blocks/surface';
// Straight off the framework packages, as the neighbouring board specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import { C4_ROLE } from '@labre/affine-gfx-c4';
import {
  WARDLEY_BACKGROUND,
  wardleyCanonicalBox,
  wardleyNodeProps,
} from '@labre/affine-gfx-wardley';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
  type ToolbarAction,
} from '@labre/affine/shared/services';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Generating a legend twice (issue #391).
 *
 * The unit suite owns the engine over stubs. What only a real editor can
 * answer is the claim the fix rests on: that the box the FIRST press wrote is
 * still there, in the document, carrying {@link LEGEND_ROLE} on its wrapper and
 * sitting inside the board's perimeter, when the second press goes looking for
 * it — and that removing it takes its fifteen glyphs with it, in one undo step.
 *
 * Two frameworks rather than one, because the button is a shared factory
 * (ADR 0026 §4): if Wardley's press replaces and C4's stacks, the factory is
 * not what is under test.
 */
describe('generating a board legend twice', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  const elements = () => surfaceModel().elementModels;

  /** The legend groups the document holds, whoever drew them. */
  const legends = () =>
    elements().filter(el => el.type === 'group' && el.role === LEGEND_ROLE);

  /**
   * The press a click on the board's toolbar performs: the registry's two
   * signals are written here rather than waited for, exactly as
   * `board-svg-export.spec.ts` does, so this stays about WHAT the action
   * writes rather than about the widget's render timing.
   */
  const press = async (flavour: string, actionId: string, boardId: string) => {
    const board = surfaceModel().getElementById(boardId);
    expect(board, boardId).not.toBeNull();
    edgeless.gfx.selection.set({ elements: [boardId], editing: false });
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    registry.flavour$.value = flavour;
    registry.elementsMap$.value = new Map([[flavour, [board!]]]);

    let action: ToolbarAction | undefined;
    for (const module of registry.modulesFor(`custom:${flavour}`)) {
      const found = (module.config.actions ?? []).find(
        one => one.id === actionId
      );
      if (found) action = found;
    }
    expect(action, `${actionId} is not offered on ${flavour}`).toBeDefined();
    action!.run?.(new ToolbarContext(edgeless.std));
    await wait();
  };

  /** A Wardley map with one component on it, so the box has a row to draw. */
  const wardleyMap = async () => {
    const surface = surfaceModel();
    const id = surface.addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(0, 0, 1600, 900).serialize(),
    });
    surface.addElement(
      wardleyNodeProps('component', {
        xywh: wardleyCanonicalBox('component', 300, 400),
      })
    );
    await wait();
    return id;
  };

  test('a second press replaces the box instead of stacking a second one', async () => {
    const map = await wardleyMap();
    const before = elements().length;

    await press('affine:surface:wardley', 'd.legend', map);
    expect(legends()).toHaveLength(1);
    const first = legends()[0].id;
    const withLegend = elements().length;
    expect(withLegend).toBeGreaterThan(before);

    await press('affine:surface:wardley', 'd.legend', map);

    // One box on the board, and it is a NEW one: the old group and every glyph
    // it held went with it, so the element count is back where one legend put
    // it rather than at twice the box.
    expect(legends()).toHaveLength(1);
    expect(legends()[0].id).not.toBe(first);
    expect(surfaceModel().getElementById(first)).toBeNull();
    expect(elements().length).toBe(withLegend);
  });

  test('the shared factory covers another framework the same way', async () => {
    const surface = surfaceModel();
    const board = surface.addElement({
      type: 'c4Board',
      role: C4_ROLE.board,
      xywh: new Bound(0, 0, 1400, 900).serialize(),
    });
    surface.addElement({
      type: 'c4Node',
      kind: 'person',
      role: C4_ROLE.person,
      xywh: new Bound(200, 200, 160, 120).serialize(),
    });
    await wait();

    await press('affine:surface:c4Board', 'b.legend', board);
    const first = legends()[0].id;
    await press('affine:surface:c4Board', 'b.legend', board);

    expect(legends()).toHaveLength(1);
    expect(legends()[0].id).not.toBe(first);
  });

  /**
   * The checkpoint is taken in FRONT of the removal, so "replace" is one step:
   * a user who pressed twice by accident gets his box back with one Ctrl+Z,
   * not an empty board first and the old box on a second undo.
   */
  test('one undo after the second press brings the first legend back whole', async () => {
    const map = await wardleyMap();

    await press('affine:surface:wardley', 'd.legend', map);
    const first = legends()[0].id;
    const withLegend = elements().length;

    await press('affine:surface:wardley', 'd.legend', map);
    expect(legends()[0].id).not.toBe(first);

    window.doc.undo();
    await wait();

    expect(legends()).toHaveLength(1);
    expect(legends()[0].id).toBe(first);
    expect(elements().length).toBe(withLegend);
  });

  /**
   * `getElementsByBound` answers with everything that OVERLAPS, so two maps
   * drawn close together each reach into the other's corner. Each press must
   * refresh its own board's box and leave the neighbour's standing.
   */
  test('each of two boards side by side keeps its own legend', async () => {
    const surface = surfaceModel();
    const left = await wardleyMap();
    const right = surface.addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(1500, 0, 1600, 900).serialize(),
    });
    surface.addElement(
      wardleyNodeProps('component', {
        xywh: wardleyCanonicalBox('component', 1800, 400),
      })
    );
    await wait();

    await press('affine:surface:wardley', 'd.legend', left);
    await press('affine:surface:wardley', 'd.legend', right);
    expect(legends()).toHaveLength(2);
    const rightLegend = legends().find(one => one.elementBound.x > 1500)!;

    // A third press, on the LEFT map: its own box is replaced, the right
    // map's is untouched.
    await press('affine:surface:wardley', 'd.legend', left);

    expect(legends()).toHaveLength(2);
    expect(surfaceModel().getElementById(rightLegend.id)).not.toBeNull();
  });
});
