import { Bound } from '@labre/global/gfx';
import type {
  GfxPrimitiveElementModel,
  RoleDefs,
  SurfaceBlockModel,
} from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  resolveViolationAnchors,
  VIOLATION_BADGE_SIZE,
  VIOLATION_MARK_PADDING,
  type Violation,
} from '../extensions/validation.js';

/**
 * WHERE the persistent badge of a finding is pinned (PO recce, 02/08).
 *
 * The capture that opened this: an amber dot at the top-right corner of a
 * diagonal link's bounding box — a point on empty paper, a hundred units from
 * the trait it was accusing. A box is marked on its corner; a LINK is marked in
 * its middle, and this suite asserts the coordinate rather than the rendering,
 * because the coordinate is the whole decision.
 *
 * The vocabulary is this suite's own, exactly like the other engine suites: the
 * library knows `kind`, never a framework's roles.
 */

const ROLES: RoleDefs = {
  'test:node': { id: 'test:node', kind: 'node' },
  'test:edge': { id: 'test:edge', kind: 'edge' },
};

/** The gap the corner badge sits outside the bounds by. */
const CORNER = VIOLATION_MARK_PADDING + VIOLATION_BADGE_SIZE / 2;

function element(
  id: string,
  xywh: [number, number, number, number],
  extra: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  return {
    id,
    ...extra,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** A surface holding exactly these elements, and no groups. */
function surfaceOf(elements: GfxPrimitiveElementModel[]): SurfaceBlockModel {
  const byId = new Map(elements.map(el => [el.id, el]));
  return {
    getElementById: (id: string) => byId.get(id) ?? null,
    getGroups: () => [],
  } as unknown as SurfaceBlockModel;
}

const violationOn = (ids: string[]): Violation => ({
  ruleId: 'test.rule',
  elementIds: ids,
  severity: 'warning',
  messageKey: 'com.labre.test.rule',
});

const anchorsOf = (
  elements: GfxPrimitiveElementModel[],
  vocabularies: readonly RoleDefs[] = [ROLES]
) =>
  resolveViolationAnchors(
    [violationOn(elements.map(el => el.id))],
    surfaceOf(elements),
    vocabularies
  );

describe('a node is marked on its corner', () => {
  it('sits outside the top-right corner by the mark gap plus half a badge', () => {
    const [anchor] = anchorsOf([
      element('n1', [100, 200, 40, 20], { role: 'test:node' }),
    ]);

    expect(anchor.kind).toBe('node');
    expect(anchor.markAt).toEqual([140 + CORNER, 200 - CORNER]);
  });

  it('is what an element carrying no role at all gets', () => {
    // A generalist square is not an edge, so nothing changes for it.
    const [anchor] = anchorsOf([element('n1', [0, 0, 10, 10])]);

    expect(anchor.kind).toBe('node');
    expect(anchor.markAt).toEqual([10 + CORNER, -CORNER]);
  });
});

describe('a link is marked in its middle', () => {
  it('takes the midpoint of the drawn path', () => {
    // The PO's capture: a diagonal link whose bounding-box corner is nowhere
    // near the trait. The middle of the trait is (500, 500).
    const [anchor] = anchorsOf([
      element('e1', [0, 0, 1000, 1000], {
        role: 'test:edge',
        absolutePath: [
          [0, 0],
          [1000, 1000],
        ],
      }),
    ]);

    expect(anchor.kind).toBe('edge');
    expect(anchor.markAt).toEqual([500, 500]);
  });

  it('measures by arc length, not by the middle of the point array', () => {
    // An elbowed connector: three points, the bend at 90 % of the run. The
    // middle of the ARRAY is the bend; the middle of the LINK is halfway along
    // what the user can see — total length 900 + 100, so 500 units in.
    const [anchor] = anchorsOf([
      element('e1', [0, 0, 900, 100], {
        role: 'test:edge',
        absolutePath: [
          [0, 0],
          [900, 0],
          [900, 100],
        ],
      }),
    ]);

    expect(anchor.markAt).toEqual([500, 0]);
  });

  it('reads a connector by its GEOMETRY when it carries no role', () => {
    // A generalist connector — no role, or a role no loaded framework
    // declares. Its ends still say it runs from here to there.
    const [anchor] = anchorsOf(
      [
        element('e1', [0, 0, 200, 100], {
          source: { position: [0, 0] },
          target: { position: [200, 100] },
        }),
      ],
      []
    );

    expect(anchor.kind).toBe('edge');
    expect(anchor.markAt).toEqual([100, 50]);
  });

  it('falls back to the intersection of the diagonals with no path', () => {
    // A typed edge the layout has not routed and whose ends are both attached:
    // no path to walk, so the centre of the rectangle — which is where its two
    // diagonals cross.
    const [anchor] = anchorsOf([
      element('e1', [100, 100, 400, 200], { role: 'test:edge' }),
    ]);

    expect(anchor.kind).toBe('edge');
    expect(anchor.markAt).toEqual([300, 200]);
  });

  it('keeps the endpoint of a link drawn on itself', () => {
    // A zero-length edge has no middle to find and no corner worth pointing
    // at; the mark lands on it rather than nowhere.
    const [anchor] = anchorsOf([
      element('e1', [50, 50, 0, 0], {
        role: 'test:edge',
        absolutePath: [
          [50, 50],
          [50, 50],
        ],
      }),
    ]);

    expect(anchor.markAt).toEqual([50, 50]);
  });
});

describe('one anchor per element, whatever it is', () => {
  it('marks a link and the nodes it links in three different places', () => {
    // What `relative-order-along-axis` indicts: two nodes and the edge that
    // states the relation. Each gets the mark its own kind calls for.
    const from = element('n1', [0, 0, 20, 20], { role: 'test:node' });
    const to = element('n2', [300, 0, 20, 20], { role: 'test:node' });
    const edge = element('e1', [20, 10, 280, 0], {
      role: 'test:edge',
      absolutePath: [
        [20, 10],
        [300, 10],
      ],
    });

    const anchors = anchorsOf([from, to, edge]);
    const kinds = Object.fromEntries(anchors.map(a => [a.id, a.kind]));
    const marks = Object.fromEntries(anchors.map(a => [a.id, a.markAt]));

    expect(kinds).toEqual({ n1: 'node', n2: 'node', e1: 'edge' });
    expect(marks.n1).toEqual([20 + CORNER, -CORNER]);
    expect(marks.e1).toEqual([160, 10]);
  });
});
