import type { ConnectorElementModel } from '@labre/affine-model';
import { PointStyle } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { midpointOf, targetAnchorOf } from '../direction/direction-reveal';
import { invertEdge } from '../direction/invert-direction';

/**
 * M2 and M3 of `docs/adr/0010`, at the level where they are pure: where the
 * reveal's mark goes, and what an inversion writes.
 *
 * The wiring — hover, selection, the overlay, the undo step, the routed path of
 * a curved connector — is covered by the integration spec, which has a real
 * editor to hover in. What is here is what a unit test can state exactly.
 */

/**
 * A stand-in for the model: `invertEdge` reads four props and writes them back
 * through `surface.updateElement`, exactly like a real element does. Applying
 * the write onto the same object is what a `@field()` accessor would do.
 */
function fakeEdge(props: Record<string, unknown>) {
  const edge: Record<string, unknown> = {
    id: 'c1',
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
    ...props,
  };
  let writes = 0;
  edge.surface = {
    updateElement: (_id: string, next: Record<string, unknown>) => {
      writes++;
      Object.assign(edge, next);
    },
  };
  return {
    model: edge as unknown as ConnectorElementModel,
    writes: () => writes,
  };
}

describe('inverting a typed edge (M3)', () => {
  it('swaps the two ends and the two endpoint styles', () => {
    const { model } = fakeEdge({
      source: { id: 'a' },
      target: { id: 'b' },
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
    });

    invertEdge(model);

    expect(model.source).toEqual({ id: 'b' });
    expect(model.target).toEqual({ id: 'a' });
    // The mark follows the relation: leaving the styles behind is what
    // `b.flip-direction` does, and it is why that entry lies about a typed edge.
    expect(model.frontEndpointStyle).toBe(PointStyle.Arrow);
    expect(model.rearEndpointStyle).toBe(PointStyle.None);
  });

  it('is an INVOLUTION — twice is the identity, styles included', () => {
    const { model, writes } = fakeEdge({
      source: { id: 'a' },
      target: { position: [10, 20] },
      frontEndpointStyle: PointStyle.Triangle,
      rearEndpointStyle: PointStyle.None,
    });

    invertEdge(model);
    invertEdge(model);

    expect(model.source).toEqual({ id: 'a' });
    expect(model.target).toEqual({ position: [10, 20] });
    expect(model.frontEndpointStyle).toBe(PointStyle.Triangle);
    expect(model.rearEndpointStyle).toBe(PointStyle.None);
    // One write per inversion: the gesture is a single update, which is what
    // lets one `captureSync` cover it whatever the selection holds.
    expect(writes()).toBe(2);
  });

  it('copies each end instead of moving it', () => {
    // The two accessors must never end up sharing one object: a later write to
    // `source.position` would silently move `target` too.
    const source = { id: 'a', position: [0, 0] as [number, number] };
    const { model } = fakeEdge({ source, target: { id: 'b' } });

    invertEdge(model);

    expect(model.target).not.toBe(source);
    expect(model.target).toEqual({ id: 'a', position: [0, 0] });
  });

  it('writes nothing else — `curveControlPoint` is left exactly alone', () => {
    // It is an ABSOLUTE pass-through point at t = 0.5 and the tangent formulas
    // are symmetric under a P0 ↔ P3 exchange, so swapping the ends leaves the
    // same curve. "Mirroring" it would visibly move the curve: a bug, not a fix.
    const control = { x: 5, y: 5 };
    const { model } = fakeEdge({
      source: { id: 'a' },
      target: { id: 'b' },
      curveControlPoint: control,
    });

    invertEdge(model);

    expect((model as unknown as { curveControlPoint: unknown }).curveControlPoint)
      .toBe(control);
  });
});

describe('where the reveal puts its mark (M2)', () => {
  const edgeWith = (path: [number, number][]) =>
    ({ absolutePath: path }) as unknown as ConnectorElementModel;

  it('anchors on the TARGET end, pointing the way the path arrives', () => {
    const anchor = targetAnchorOf(
      edgeWith([
        [0, 0],
        [100, 0],
      ])
    );

    expect(anchor?.at).toEqual([100, 0]);
    expect(anchor?.heading).toEqual([1, 0]);
  });

  it('reads the LAST segment of an elbowed path, not its chord', () => {
    const anchor = targetAnchorOf(
      edgeWith([
        [0, 0],
        [100, 0],
        [100, 100],
      ])
    );

    expect(anchor?.at).toEqual([100, 100]);
    expect(anchor?.heading).toEqual([0, 1]);
  });

  it('skips a repeated final point rather than dividing by zero', () => {
    const anchor = targetAnchorOf(
      edgeWith([
        [0, 0],
        [50, 0],
        [50, 0],
      ])
    );

    expect(anchor?.at).toEqual([50, 0]);
    expect(anchor?.heading).toEqual([1, 0]);
  });

  it('says nothing about an edge with no direction to show', () => {
    // No path at all (attached at both ends and never laid out), and a path
    // whose ends coincide: silence, not a guess.
    expect(targetAnchorOf({} as unknown as ConnectorElementModel)).toBeNull();
    expect(
      targetAnchorOf(
        edgeWith([
          [10, 10],
          [10, 10],
        ])
      )
    ).toBeNull();
    expect(midpointOf({} as unknown as ConnectorElementModel)).toBeNull();
  });

  it('moves to the other end once the edge is reversed', () => {
    // The two mechanisms, composed: reversing the relation moves the only
    // visible sign of it, so the picture and the data cannot disagree.
    const { model } = fakeEdge({
      source: { position: [0, 0] },
      target: { position: [100, 0] },
      absolutePath: [
        [0, 0],
        [100, 0],
      ],
    });
    expect(targetAnchorOf(model)?.at).toEqual([100, 0]);

    invertEdge(model);
    // The routed path is recomputed by the connector manager on a live canvas;
    // here it is stated, which is what makes the assertion about the ANCHOR
    // rather than about the routing.
    (model as unknown as { absolutePath: [number, number][] }).absolutePath = [
      [100, 0],
      [0, 0],
    ];

    expect(targetAnchorOf(model)?.at).toEqual([0, 0]);
    expect(targetAnchorOf(model)?.heading).toEqual([-1, 0]);
  });
});
