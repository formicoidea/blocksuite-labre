import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import {
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
  wardleyPorterArrowSegments,
} from '@labre/affine-gfx-wardley';
import {
  ConnectorElementModel,
  GroupElementModel,
  PointStyle,
  StrokeStyle,
  TextElementModel,
  WardleyNodeElementModel,
} from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Porter's forces, drawn from the sub-menu into a real document.
 *
 * The unit suite owns the geometry, the presets and the losses the OWM export
 * reports. What only a real editor can answer is what a user actually gets:
 * that one click produces ONE object rather than five loose ones, that the
 * letter really is the circle's own text in the Y document (and not a string
 * that never became one), and that the four arrows landed where the notation
 * puts them — outside the rim, heads facing out, red and solid so nobody reads
 * them as an evolution.
 */
describe('drawing Porter’s forces from the Wardley sub-menu', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Run the command the way the sub-menu runs it, and return its group. */
  const drawPorter = async () => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'wardley.addPorter'
    );
    expect(command, 'wardley.addPorter').toBeDefined();
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

  const nodesOf = (group: GroupElementModel) =>
    group.childElements.filter(
      (child): child is WardleyNodeElementModel =>
        child instanceof WardleyNodeElementModel
    );

  const arrowsOf = (group: GroupElementModel) =>
    group.childElements.filter(
      (child): child is ConnectorElementModel =>
        child instanceof ConnectorElementModel
    );

  test('one click makes one object: a circle and its four arrows', async () => {
    const group = await drawPorter();

    expect(group.childElements).toHaveLength(5);
    expect(nodesOf(group)).toHaveLength(1);
    expect(arrowsOf(group)).toHaveLength(4);
    // No label anywhere: the letter is the notation, and a force is not
    // something the author names.
    expect(
      group.childElements.some(child => child instanceof TextElementModel)
    ).toBe(false);
  });

  test('the circle carries the porter role and the letter as its own text', async () => {
    const [circle] = nodesOf(await drawPorter());

    expect(circle.kind).toBe('porter');
    expect(circle.role).toBe(WARDLEY_ROLE.porter);
    // The point of writing it as shape text rather than as a label beside the
    // circle: it survives the trip into the Y document as a `Y.Text`, which is
    // what the native shape editor opens on a double-click.
    expect(circle.text?.toString()).toBe('R');
    // The canonical diameter, unmoved by the letter inside it.
    const [, , w, h] = circle.deserializedXYWH;
    expect([w, h]).toEqual([
      WARDLEY_NODE_SIZE.porter.w,
      WARDLEY_NODE_SIZE.porter.h,
    ]);
  });

  test('the arrows stand off the rim, solid red and headed outward', async () => {
    const group = await drawPorter();
    const [circle] = nodesOf(group);
    const [x, y, w, h] = circle.deserializedXYWH;
    const expected = wardleyPorterArrowSegments(x + w / 2, y + h / 2);

    const arrows = arrowsOf(group);
    for (const arrow of arrows) {
      // Role-less, exactly like the market's triangle: the glyph's own wiring,
      // not a relation the author drew — so W3 never has a composite report an
      // overlap with itself.
      expect(arrow.role).toBeUndefined();
      expect(arrow.strokeStyle).toBe(StrokeStyle.Solid);
      expect(arrow.frontEndpointStyle).toBe(PointStyle.None);
      expect(arrow.rearEndpointStyle).toBe(PointStyle.Triangle);
      // Free at both ends, so a resize of the circle cannot drag them askew.
      expect(arrow.source.id).toBeUndefined();
      expect(arrow.target.id).toBeUndefined();
    }

    // The four cardinal segments the shared helper describes, and no others.
    const drawn = arrows
      .map(arrow => [...arrow.source.position!, ...arrow.target.position!])
      .sort();
    expect(drawn).toEqual(
      expected.map(({ source, target }) => [...source, ...target]).sort()
    );
  });
});
