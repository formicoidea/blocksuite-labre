import { getAnchors } from '@labre/affine-gfx-connector';
import { BpmnNodeElementModel, type BpmnNodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { NODE_PRESETS } from '../presets';

/**
 * Why this spec exists: BPMN nodes were centre-only, so the connector tool
 * offered one anchor per node and a sequence flow could not be made to leave a
 * gateway by a chosen corner or a task by a chosen side. With the per-kind rule
 * (`BPMN_CENTRE_ANCHORED` in `affine-model`), the connector manager's own
 * anchors apply, cast from the centre to each outline: this pins that they
 * land where a BPMN reader expects them — the corners of a gateway's diamond,
 * the side midpoints of a task, the cardinal points of an event — and that a
 * group still offers its centre and nothing else.
 */

const X = 100;
const Y = 50;
const W = 120;
const H = 80;

function node(kind: BpmnNodeKind): BpmnNodeElementModel {
  const element = Object.create(BpmnNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  element.yMap = { doc: null };
  element._preserved = new Map<string, unknown>([
    ['kind', kind],
    ['shapeType', NODE_PRESETS[kind].shapeType],
    ['xywh', `[${X},${Y},${W},${H}]`],
    ['rotate', 0],
  ]);
  element._local = new Map<string, unknown>();
  return element as unknown as BpmnNodeElementModel;
}

/** Anchors as `[coord, absolute point]`, rounded so a float cannot flake. */
const anchorsOf = (kind: BpmnNodeKind) =>
  getAnchors(node(kind), false).map(({ coord, point }) => [
    coord.map(v => Math.round(v * 1000) / 1000),
    [Math.round(point[0]), Math.round(point[1])],
  ]);

/** Top, bottom, left, right — the order the manager casts its rays in. */
const CARDINAL = [
  [
    [0.5, 0],
    [X + W / 2, Y],
  ],
  [
    [0.5, 1],
    [X + W / 2, Y + H],
  ],
  [
    [0, 0.5],
    [X, Y + H / 2],
  ],
  [
    [1, 0.5],
    [X + W, Y + H / 2],
  ],
];

describe('the anchors a sequence flow can attach to', () => {
  it("puts a gateway's anchors on the corners of its diamond", () => {
    // A diamond's corners ARE the midpoints of its bounding box's sides.
    expect(anchorsOf('gatewayExclusive')).toEqual(CARDINAL);
    expect(anchorsOf('gatewayParallel')).toEqual(CARDINAL);
  });

  it("puts a task's anchors on the midpoints of its sides", () => {
    expect(anchorsOf('task')).toEqual(CARDINAL);
    expect(anchorsOf('subProcess')).toEqual(CARDINAL);
  });

  it("puts an event's anchors on the four cardinal points of its circle", () => {
    expect(anchorsOf('startEvent')).toEqual(CARDINAL);
    expect(anchorsOf('endEventTerminate')).toEqual(CARDINAL);
  });

  it('gives a group its centre and nothing else', () => {
    expect(anchorsOf('group')).toEqual([
      [
        [0.5, 0.5],
        [X + W / 2, Y + H / 2],
      ],
    ]);
  });
});
