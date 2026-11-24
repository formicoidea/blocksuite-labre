/**
 * Where a dragged connector endpoint lands inside a frame or a board (issue #740,
 * upstream toeverything/AFFiNE#15917, commit f0e5009).
 *
 * `ConnectionOverlay.renderConnector` walks every connectable element whose
 * expanded bound holds the pointer, and its anchor loop ALWAYS records the
 * nearest anchor (the shortest distance starts at infinity), so the
 * "inside the element" branch is never reached for an element with anchors:
 * anywhere inside an `affine:frame` the endpoint snaps to one of the frame's
 * four edge anchors and cannot be left free. The first block failed before
 * the fix for exactly that reason; its last two cases pin the 8-unit reach of
 * the border (`OUTLINE_SNAP_DISTANCE`).
 *
 * The second block is a guard, green today: a framework board
 * (`FrameworkBackgroundElementModel` and every subclass) declares
 * `connectable === false`, so `_findConnectablesInViews` drops it before any
 * geometry is read, and its border-only hit test (PR #197) never takes part.
 * An endpoint inside a board stays free unless it is over a node drawn on it.
 * A fix for frames must not change that silently.
 *
 * happy-dom: the rotated-bound helpers build a `DOMRect`.
 *
 * @vitest-environment happy-dom
 */
import {
  BpmnPoolElementModel,
  C4BoardElementModel,
  C4BoundaryElementModel,
  ContextMapBoardElementModel,
  CoreDomainChartElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EstuarineElementModel,
  EventStormingBoardElementModel,
  FrameBlockModel,
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine-model';
import type { IVec } from '@labre/global/gfx';
import {
  Bound,
  linePolygonIntersects,
  polygonNearestPoint,
} from '@labre/global/gfx';
import { describe, expect, test } from 'vitest';

import { ConnectionOverlay } from '../connector-manager';

const FRAME_XYWH = '[0,0,400,400]';
const NODE_XYWH = '[150,150,100,100]';
/** Inside the frame, 60 units from its left edge and from any node. */
const INSIDE_EMPTY: IVec = [60, 200];
/** On the frame's left edge, at its anchor. */
const ON_BORDER: IVec = [0, 200];
/** Inside the frame, 7 units from its left edge: within reach of the border. */
const NEAR_BORDER: IVec = [7, 100];
/** Inside the frame, 8 units from its left edge: out of reach. */
const JUST_OUT_OF_REACH: IVec = [8, 100];
/** The centre of the node drawn in the frame. */
const ON_NODE: IVec = [200, 200];
/** A viewport wide enough to hold every element of the scene. */
const VIEWPORT = Bound.deserialize('[-1000,-1000,3000,3000]');

/** A real `FrameBlockModel` prototype: the upstream fix tests `instanceof`. */
function frameAt(xywh: string) {
  const frame = Object.create(FrameBlockModel.prototype) as FrameBlockModel;
  Object.defineProperties(frame, {
    id: { value: 'frame' },
    props: { value: { xywh } },
    connectable: { value: true },
  });
  return frame;
}

/** A plain rectangle node, connectable like any shape. */
function nodeAt(xywh: string) {
  const bound = Bound.deserialize(xywh);
  return {
    id: 'shape',
    xywh,
    rotate: 0,
    connectable: true,
    getNearestPoint: (point: IVec) => polygonNearestPoint(bound.points, point),
    getLineIntersections: (start: IVec, end: IVec) =>
      linePolygonIntersects(start, end, bound.points),
    includesPoint: (x: number, y: number) => bound.isPointInBound([x, y]),
  };
}

/** The overlay over a canvas holding `elements`, in paint order, at zoom 1. */
function overlayOver(elements: object[]) {
  const overlay = Object.create(
    ConnectionOverlay.prototype
  ) as ConnectionOverlay;
  Object.assign(overlay, {
    gfx: {
      viewport: {
        viewportBounds: VIEWPORT,
        toViewCoord: (x: number, y: number) => [x, y],
      },
      getElementsByBound: () => elements,
      std: { getOptional: () => null, host: {} },
    },
    points: [],
    highlightPoint: null,
  });
  return overlay;
}

describe('a connector endpoint inside an affine:frame (#740)', () => {
  test.each<{ name: string; point: IVec; target?: 'frame' | 'shape' }>([
    { name: 'stays free inside the frame', point: INSIDE_EMPTY },
    { name: 'attaches to the frame border', point: ON_BORDER, target: 'frame' },
    {
      name: 'attaches to a shape in the frame',
      point: ON_NODE,
      target: 'shape',
    },
    {
      name: 'attaches to the frame within 8 units of its border',
      point: NEAR_BORDER,
      target: 'frame',
    },
    { name: 'stays free 8 units inside the border', point: JUST_OUT_OF_REACH },
  ])('$name', ({ point, target }) => {
    const overlay = overlayOver([frameAt(FRAME_XYWH), nodeAt(NODE_XYWH)]);

    const connection = overlay.renderConnector(point);

    expect(connection.id).toBe(target);
  });
});

const BOARDS = {
  BpmnPoolElementModel,
  C4BoardElementModel,
  C4BoundaryElementModel,
  ContextMapBoardElementModel,
  CoreDomainChartElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EstuarineElementModel,
  EventStormingBoardElementModel,
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
  WardleyBackgroundElementModel,
};

describe('a connector endpoint inside a framework board (guard, #740)', () => {
  test.each(Object.entries(BOARDS))(
    '%s never captures the endpoint',
    (_name, Board) => {
      const board = Object.create(Board.prototype) as { connectable: boolean };
      Object.defineProperty(board, 'id', { value: 'board' });
      expect(board.connectable).toBe(false);

      const overlay = overlayOver([board, nodeAt(NODE_XYWH)]);

      // Inside the board, away from its node: free.
      expect(overlay.renderConnector(INSIDE_EMPTY).id).toBeUndefined();
      // On the board's border: still free, a board is never a target.
      expect(overlay.renderConnector(ON_BORDER).id).toBeUndefined();
      // On the node drawn on it: the node.
      expect(overlay.renderConnector(ON_NODE).id).toBe('shape');
    }
  );
});
