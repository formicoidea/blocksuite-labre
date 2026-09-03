import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import {
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
} from '@labre/affine-gfx-wardley';
import {
  FontWeight,
  GroupElementModel,
  TextElementModel,
  WardleyNodeElementModel,
} from '@labre/affine/model';
import {
  getCommandsForSurface,
  getRegisteredCommands,
  runCommand,
  SENIOR_MENU_CAP,
  SENIOR_MENU_RANKED_SLOTS,
} from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The climate arrows, drawn from the sub-menu into a real document.
 *
 * The unit suite owns the outlines, the presets and the OWM round trip. What
 * only a real editor can answer is what a user actually gets: that one click
 * produces ONE object rather than two loose ones, that the polygon really
 * arrives as a polygon in the Y document (this framework's first — every other
 * Wardley kind is an ellipse or a rect), and that the name lands on the side
 * the arrow points FROM rather than always on the right.
 *
 * It also pins the other half of the PO's amendment of 2026-09-03 to ADR 0014
 * R4: the two new nominations do not widen the row. Wardley nominates
 * everything now, and the row is still thirteen arbitrated buttons plus "More
 * artefacts…", with both new artefacts reachable through the catalogue.
 */
describe('drawing accelerators and decelerators from the Wardley sub-menu', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Run one of the two commands the way the sub-menu runs it. */
  const draw = async (id: string) => {
    const command = getRegisteredCommands(edgeless.std).find(c => c.id === id);
    expect(command, id).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel =>
        model instanceof GroupElementModel && model.group === null
    );
    expect(groups).toHaveLength(1);
    return groups[0];
  };

  const arrowOf = (group: GroupElementModel) =>
    group.childElements.find(
      (child): child is WardleyNodeElementModel =>
        child instanceof WardleyNodeElementModel
    )!;

  const labelOf = (group: GroupElementModel) =>
    group.childElements.find(
      (child): child is TextElementModel => child instanceof TextElementModel
    )!;

  test.each([
    ['wardley.addAccelerator', 'accelerator'],
    ['wardley.addDecelerator', 'decelerator'],
  ] as const)(
    '%s makes one object: the arrow and its name',
    async (id, kind) => {
      const group = await draw(id);

      expect(group.childElements).toHaveLength(2);
      const arrow = arrowOf(group);
      const label = labelOf(group);

      expect(arrow.kind).toBe(kind);
      expect(arrow.role).toBe(WARDLEY_ROLE[kind]);
      expect(label.text.toString()).toBe(WARDLEY_NODE_LABEL[kind]);
      expect(label.role).toBe(WARDLEY_ROLE.label);
      expect(label.fontWeight).toBe(FontWeight.SemiBold);
    }
  );

  test.each([
    ['wardley.addAccelerator', 'accelerator'],
    ['wardley.addDecelerator', 'decelerator'],
  ] as const)(
    '%s draws a closed polygon at the canonical size',
    async (id, kind) => {
      const arrow = arrowOf(await draw(id));

      // A POLYGON in the Y document, which is what this framework had never
      // written before: seven normalized points and a `true`, not a path.
      expect(arrow.shapeType).toBe('polygon');
      expect(arrow.vertices).toHaveLength(7);
      expect(arrow.isClosed).toBe(true);
      // The tip is on the side the notation says: right for an accelerator,
      // left for a decelerator. This is the whole difference between them.
      const tip = (arrow.vertices as number[][])[3];
      expect(tip).toEqual(kind === 'accelerator' ? [1, 0.5] : [0, 0.5]);

      const [, , w, h] = arrow.deserializedXYWH;
      expect([w, h]).toEqual([
        WARDLEY_NODE_SIZE[kind].w,
        WARDLEY_NODE_SIZE[kind].h,
      ]);
      expect([w, h]).toEqual([48, 40]);
      // Flat grey under a thick dark rim — the canvas has no gradient fill, so
      // this is what reads as the reference's solid arrow.
      expect(arrow.fillColor).toBe('#bfbfbf');
      expect(arrow.strokeWidth).toBe(2);
      expect(arrow.filled).toBe(true);
    }
  );

  test('the accelerator wears its name on the right, the decelerator on the left', async () => {
    const forward = await draw('wardley.addAccelerator');
    const [ax, , aw] = arrowOf(forward).deserializedXYWH;
    const forwardLabel = labelOf(forward);
    const [lx] = forwardLabel.deserializedXYWH;
    expect(lx).toBeGreaterThanOrEqual(ax + aw);
    expect(forwardLabel.textAlign).toBe('left');
  });

  test('the decelerator’s words end against its shaft', async () => {
    const back = await draw('wardley.addDecelerator');
    const [bx] = arrowOf(back).deserializedXYWH;
    const label = labelOf(back);
    const [lx, , lw] = label.deserializedXYWH;
    // Right-aligned and ending before the arrow starts: the reading runs INTO
    // the shaft rather than across the head.
    expect(lx + lw).toBeLessThanOrEqual(bx);
    expect(label.textAlign).toBe('right');
  });

  /* ── The row is unchanged, which is the amendment's other half ─────── */

  test('both nominate the row without widening it', () => {
    const nominated = getCommandsForSurface(
      edgeless.std,
      'wardley',
      'senior-menu'
    ).map(c => c.id);
    expect(nominated).toContain('wardley.addAccelerator');
    expect(nominated).toContain('wardley.addDecelerator');

    // The row itself, read off a live component rather than off the registry:
    // `commands` is what `render()` maps one button per entry, and the
    // fourteenth button past the cap is the permanent "More artefacts…".
    const Ctor = customElements.get('edgeless-wardley-menu')!;
    const menu = new Ctor() as HTMLElement & {
      edgeless: unknown;
      commands: { id: string }[];
    };
    menu.edgeless = edgeless;
    expect(menu.commands).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
    expect(menu.commands.length + 1).toBe(SENIOR_MENU_CAP);
    // The arbitration ran, which is what makes thirteen the right number: the
    // catalogue is bigger than the row, so the row is a ranked selection.
    expect(
      getCommandsForSurface(edgeless.std, 'wardley', 'catalogue').length
    ).toBeGreaterThan(SENIOR_MENU_CAP);
  });

  test('the catalogue lists both, so neither is unreachable', () => {
    const catalogue = getCommandsForSurface(
      edgeless.std,
      'wardley',
      'catalogue'
    ).map(c => c.id);
    expect(catalogue).toContain('wardley.addAccelerator');
    expect(catalogue).toContain('wardley.addDecelerator');
  });
});
