import type { ConnectorElementModel } from '@labre/affine-model';
import { PointStyle } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { labelAnchorOf } from '../direction/direction-reveal';
import {
  invertEdge,
  invertEdgeDirectionParams,
} from '../direction/invert-direction';
import { endpointNamesOf } from '../direction/typed-edge';

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

describe('the parameter contract of the inversion', () => {
  /**
   * "No arguments" is the shape EVERY in-library call site produces — the
   * contextual toolbar, the palette and the keymap handler all reach
   * `runCommand(std, command, invocation)` with nothing after it. The command
   * parses `params ?? {}` for exactly this reason; the assertions below are the
   * two halves of that sentence, so a future edit cannot make the no-argument
   * call fall into the error branch again and turn the whole affordance into a
   * silent no-op.
   */
  it('rejects `undefined` on its own, and accepts the empty object', () => {
    // What `runCommand` forwards when a caller passes nothing…
    const noArguments: unknown = undefined;
    expect(invertEdgeDirectionParams.safeParse(noArguments).success).toBe(false);
    // …and what `run` parses instead, which is the whole of the fix.
    expect(invertEdgeDirectionParams.safeParse(noArguments ?? {}).success).toBe(
      true
    );
    expect(invertEdgeDirectionParams.safeParse({}).success).toBe(true);
  });

  it('accepts an explicit target list, and refuses a malformed one', () => {
    expect(
      invertEdgeDirectionParams.safeParse({ elementIds: ['a', 'b'] }).success
    ).toBe(true);
    expect(
      invertEdgeDirectionParams.safeParse({ elementIds: 'a' }).success
    ).toBe(false);
  });
});

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

/**
 * The PO's acceptance of 02/08/2026, point 5: the sentence is laid ALONG the
 * link, and one end of its box is a point aimed at the provider. What that
 * costs geometrically is a midpoint, an angle and a side, and all three are
 * pure — so all three are stated here rather than eyeballed on a canvas.
 */
describe('where the reveal lays its sentence (M2)', () => {
  const edgeWith = (path: [number, number][]) =>
    ({ absolutePath: path }) as unknown as ConnectorElementModel;

  /** Radians, to within floating-point noise. */
  const degrees = (radians: number | undefined) =>
    radians === undefined ? undefined : Math.round((radians * 180) / Math.PI);

  it('centres the label on the MIDDLE of the link, never on its tip', () => {
    // The bug the PO photographed: the label was put on `path[length / 2]`,
    // which on a two-point path is the target endpoint — so the box sat on the
    // tip of the link, on top of the chevron it was meant to complement.
    const anchor = labelAnchorOf(
      edgeWith([
        [0, 0],
        [100, 0],
      ])
    );

    expect(anchor?.at).toEqual([50, 0]);
    expect(degrees(anchor?.angle)).toBe(0);
    expect(anchor?.flipped).toBe(false);
  });

  it('turns onto a DIAGONAL link, at the angle of the segment it sits on', () => {
    const anchor = labelAnchorOf(
      edgeWith([
        [0, 0],
        [100, 100],
      ])
    );

    expect(anchor?.at).toEqual([50, 50]);
    // Model y grows downward and so does CSS's rotation sense: a link running
    // down-and-right is a label turned +45°.
    expect(degrees(anchor?.angle)).toBe(45);
    expect(anchor?.flipped).toBe(false);

    const upward = labelAnchorOf(
      edgeWith([
        [0, 100],
        [100, 0],
      ])
    );
    expect(degrees(upward?.angle)).toBe(-45);
    expect(upward?.flipped).toBe(false);
  });

  it('turns a right-to-left link by 180° so the words stay upright', () => {
    // Raw, this segment is at -135°: text on its head. Turned, it reads at
    // +45° — the SAME line, walked the other way.
    const anchor = labelAnchorOf(
      edgeWith([
        [100, 100],
        [0, 0],
      ])
    );

    expect(anchor?.at).toEqual([50, 50]);
    expect(degrees(anchor?.angle)).toBe(45);
    expect(anchor?.flipped).toBe(true);
  });

  it('keeps the readable half-turn on both sides of vertical', () => {
    // Every angle the widget can be handed is one a reader can hold their head
    // still for. Straight down and straight up are the boundary and are left
    // alone; anything past them is turned back.
    for (const [path, expected, flipped] of [
      [[[0, 0], [0, 100]], 90, false],
      [[[0, 100], [0, 0]], -90, false],
      [[[100, 0], [0, 0]], 0, true],
      [[[100, 0], [0, 100]], -45, true],
    ] as [[number, number][], number, boolean][]) {
      const anchor = labelAnchorOf(edgeWith(path));
      expect(degrees(anchor?.angle)).toBe(expected);
      expect(anchor?.flipped).toBe(flipped);
      expect(Math.abs(anchor!.angle)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });

  it('walks an elbowed path by ARC LENGTH, and sits on its median segment', () => {
    // Arms of 40 and 100: half of 140 falls 30 into the second one. The middle
    // VERTEX would have been the corner, and the angle the chord's — neither of
    // which is where this link is at its middle.
    const anchor = labelAnchorOf(
      edgeWith([
        [0, 0],
        [40, 0],
        [40, 100],
      ])
    );

    expect(anchor?.at).toEqual([40, 30]);
    expect(degrees(anchor?.angle)).toBe(90);

    // Two EQUAL arms put the middle exactly on the corner, where two angles are
    // both true. The arm the path arrives by wins — an arbitrary tie-break, but
    // a stated one, so the label cannot flicker between them on a repaint.
    const onTheCorner = labelAnchorOf(
      edgeWith([
        [0, 0],
        [100, 0],
        [100, 100],
      ])
    );
    expect(onTheCorner?.at).toEqual([100, 0]);
    expect(degrees(onTheCorner?.angle)).toBe(0);
  });

  it('steps over a repeated point rather than dividing by zero', () => {
    const anchor = labelAnchorOf(
      edgeWith([
        [0, 0],
        [0, 0],
        [100, 0],
      ])
    );

    expect(anchor?.at).toEqual([50, 0]);
    expect(degrees(anchor?.angle)).toBe(0);
  });

  it('says nothing about an edge with no direction to show', () => {
    // No path at all (attached at both ends and never laid out), and a path
    // whose points all coincide: silence, not a guess.
    expect(labelAnchorOf({} as unknown as ConnectorElementModel)).toBeNull();
    expect(
      labelAnchorOf(
        edgeWith([
          [10, 10],
          [10, 10],
        ])
      )
    ).toBeNull();
  });

  it('flips the POINT when the edge is reversed (M2 × M3)', () => {
    // The two mechanisms, composed. Reversing the relation does not move the
    // label — it is the same line and the same middle — it turns the box over,
    // so the point that named the provider now names the other end. The
    // picture and the data cannot disagree.
    const { model } = fakeEdge({
      source: { position: [0, 0] },
      target: { position: [100, 0] },
      absolutePath: [
        [0, 0],
        [100, 0],
      ],
    });
    expect(labelAnchorOf(model)?.flipped).toBe(false);

    invertEdge(model);
    // The routed path is recomputed by the connector manager on a live canvas;
    // here it is stated, which is what makes the assertion about the ANCHOR
    // rather than about the routing.
    (model as unknown as { absolutePath: [number, number][] }).absolutePath = [
      [100, 0],
      [0, 0],
    ];

    const after = labelAnchorOf(model);
    expect(after?.at).toEqual([50, 0]);
    // Still horizontal, still readable — and the point has moved to the other
    // end of the box, which is the whole of the visible change.
    expect(degrees(after?.angle)).toBe(0);
    expect(after?.flipped).toBe(true);
  });
});

/**
 * The names the sentence is made of. Read from the DOCUMENT — never invented,
 * never i18n'd: only the verb comes from the role vocabulary.
 */
describe('naming the two ends of a typed edge', () => {
  const ROLES = [{ 'demo:label': { id: 'demo:label', kind: 'text' } }] as never;

  /** A surface holding elements by id, as the real one answers. */
  const edgeOn = (
    elements: Record<string, unknown>,
    ends: { source?: string; target?: string }
  ) =>
    ({
      source: ends.source ? { id: ends.source } : {},
      target: ends.target ? { id: ends.target } : {},
      surface: { getElementById: (id: string) => elements[id] ?? null },
    }) as unknown as ConnectorElementModel;

  it('reads the text an element carries itself', () => {
    const names = endpointNamesOf(
      ROLES,
      edgeOn(
        { a: { id: 'a', text: 'Kettle' }, b: { id: 'b', text: ' Power  ' } },
        { source: 'a', target: 'b' }
      )
    );

    expect(names).toEqual({ source: 'Kettle', target: 'Power' });
  });

  it('falls back to the grouped LABEL sibling, found by role kind alone', () => {
    // A Wardley component is a circle with a free text beside it, the two held
    // in one group. No framework role id is named here: `kind: 'text'` is the
    // whole test the reveal applies, so any framework composed the same way
    // gets its names read for free.
    const label = { id: 'l', role: 'demo:label', text: 'Electricity' };
    const decoration = { id: 'd', role: 'demo:bar', text: 'inertia' };
    const node: Record<string, unknown> = { id: 'b' };
    node.group = { childElements: [node, decoration, label] };

    const names = endpointNamesOf(
      ROLES,
      edgeOn(
        { a: { id: 'a', text: 'Kettle' }, b: node },
        { source: 'a', target: 'b' }
      )
    );

    expect(names).toEqual({ source: 'Kettle', target: 'Electricity' });
  });

  it('answers "" for an end with no name, and never throws', () => {
    // `group` is a getter that walks the surface, so on a detached element it
    // throws. A label that crashes the widget is worse than a half-sentence.
    const detached = {
      id: 'b',
      get group(): never {
        throw new Error('detached');
      },
    };

    expect(
      endpointNamesOf(
        ROLES,
        edgeOn({ b: detached }, { source: 'missing', target: 'b' })
      )
    ).toEqual({ source: '', target: '' });
    // And an edge with no surface behind it at all.
    expect(
      endpointNamesOf(ROLES, {
        source: { id: 'a' },
        target: { id: 'b' },
      } as unknown as ConnectorElementModel)
    ).toEqual({ source: '', target: '' });
  });
});
