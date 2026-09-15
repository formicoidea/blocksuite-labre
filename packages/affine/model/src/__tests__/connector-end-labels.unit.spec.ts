import { Bound, PointLocation } from '@labre/global/gfx';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  connectorEndLabelBox,
  ConnectorElementModel,
  DEFAULT_CONNECTOR_END_LABEL_DISTANCE,
} from '../index.js';

/**
 * Connector end labels — the RED ZONE half of ADR 0020.
 *
 * `packages/affine/model` carries the document format, so the assertion that
 * matters most here is the NEGATIVE one: a connector that has no end label
 * must persist exactly the keys it persisted before the four fields existed.
 * That is what makes the change migration-free, and it is a property of the
 * `@field()` `undefined` contract, not something the reader can verify by
 * eye — hence the pinned key list below.
 *
 * Built on a real `Y.Doc`, unlike the detached harness the other model specs
 * use: a `Y.Text` only reports a `length` once it is integrated into a
 * document, and `hasEndLabel()` is precisely a question about that length.
 */
function connector(id = 'connector-1') {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  // Integrated BEFORE the model is built, so every `@field()` write lands in a
  // real document and every nested `Y.Text` behaves like a stored one.
  elements.set(id, yMap);

  // The two things a surface owes an element model: somewhere to transact, and
  // the decorator state `@field()` / `@derive()` read on every write.
  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: false },
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
    },
  };

  const model = new ConnectorElementModel({
    id,
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  });

  return { doc, model, yMap };
}

/** The keys a connector actually writes into the document. */
const storedKeys = (yMap: Y.Map<unknown>) =>
  Array.from(yMap.keys()).sort((a, b) => a.localeCompare(b));

describe('the four end-label fields', () => {
  test('default to undefined, and the connector reports no end label', () => {
    const { model } = connector();

    expect(model.sourceLabel).toBeUndefined();
    expect(model.sourceLabelXYWH).toBeUndefined();
    expect(model.targetLabel).toBeUndefined();
    expect(model.targetLabelXYWH).toBeUndefined();

    expect(model.hasSourceLabel()).toBe(false);
    expect(model.hasTargetLabel()).toBe(false);
    expect(model.endLabelBoxes()).toEqual([]);
  });

  test('a connector without end labels stores exactly what it always did', () => {
    // The byte-identity pin. A connector created by this build and one created
    // before ADR 0020 deserialise to the same map: four absent keys, no
    // schema version, no migration. If a future field starts writing a
    // default, this list is where it shows up.
    const { yMap } = connector();

    expect(storedKeys(yMap)).toEqual([
      'curveControlPoint',
      'index',
      'mode',
      'roughness',
      'seed',
      'source',
      'stroke',
      'strokeStyle',
      'strokeWidth',
      'target',
    ]);
  });

  test('writing one end label leaves the other absent', () => {
    const { model, yMap } = connector();

    model.sourceLabel = new Y.Text('0..*');
    model.sourceLabelXYWH = [10, 10, 40, 20];

    expect(storedKeys(yMap)).toContain('sourceLabel');
    expect(storedKeys(yMap)).toContain('sourceLabelXYWH');
    expect(storedKeys(yMap)).not.toContain('targetLabel');
    expect(storedKeys(yMap)).not.toContain('targetLabelXYWH');

    expect(model.hasSourceLabel()).toBe(true);
    expect(model.hasTargetLabel()).toBe(false);
  });

  test('an empty text is not a label, box or no box', () => {
    const { model } = connector();

    model.sourceLabel = new Y.Text();
    model.sourceLabelXYWH = [10, 10, 40, 20];

    expect(model.hasSourceLabel()).toBe(false);
  });

  test('a text without a box is not painted yet', () => {
    const { model } = connector();

    model.targetLabel = new Y.Text('1');

    expect(model.hasTargetLabel()).toBe(false);
  });

  test('labelDisplay hides every caption, ends included', () => {
    const { model } = connector();

    model.sourceLabel = new Y.Text('1');
    model.sourceLabelXYWH = [10, 10, 40, 20];
    model.labelDisplay = false;

    expect(model.hasSourceLabel()).toBe(false);
  });

  test('editing one end hides that label only', () => {
    const { model } = connector();

    model.sourceLabel = new Y.Text('1');
    model.sourceLabelXYWH = [10, 10, 40, 20];
    model.targetLabel = new Y.Text('0..*');
    model.targetLabelXYWH = [80, 10, 40, 20];

    model.endLabelEditing = 'source';

    expect(model.hasSourceLabel()).toBe(false);
    expect(model.hasTargetLabel()).toBe(true);
  });
});

describe('geometry', () => {
  function withBothEnds() {
    const { model } = connector();

    model.xywh = '[0,0,100,50]';
    model.sourceLabel = new Y.Text('1');
    model.sourceLabelXYWH = [-20, -20, 40, 20];
    model.targetLabel = new Y.Text('0..*');
    model.targetLabelXYWH = [200, 120, 40, 20];

    return model;
  }

  test('elementBound unites both end boxes', () => {
    const model = withBothEnds();

    const bound = model.elementBound;

    expect(bound.x).toBe(-20);
    expect(bound.y).toBe(-20);
    // From x = -20 to the right edge of the target box at 240.
    expect(bound.w).toBe(260);
    // From y = -20 to the bottom edge of the target box at 140.
    expect(bound.h).toBe(160);
  });

  test('elementBound ignores an end box that is not painted', () => {
    const model = withBothEnds();
    model.targetLabel = new Y.Text();

    const bound = model.elementBound;

    expect(bound.w).toBe(100 + 20);
    expect(bound.h).toBe(50 + 20);
  });

  test('includesPoint hits an end box', () => {
    const model = withBothEnds();

    // Inside the source box, and nowhere near the (empty) path.
    expect(model.includesPoint(-10, -10)).toBe(true);
    expect(model.sourceLabelIncludesPoint([-10, -10])).toBe(true);
    expect(model.targetLabelIncludesPoint([-10, -10])).toBe(false);

    // Inside the target box.
    expect(model.includesPoint(220, 130)).toBe(true);
    expect(model.targetLabelIncludesPoint([220, 130])).toBe(true);

    // Between the two, on nothing.
    expect(model.includesPoint(150, 300)).toBe(false);
  });

  test('moving the connector carries both end boxes', () => {
    const model = withBothEnds();

    model.moveTo(new Bound(10, 5, 100, 50));

    expect(model.sourceLabelXYWH).toEqual([-10, -15, 40, 20]);
    expect(model.targetLabelXYWH).toEqual([210, 125, 40, 20]);
  });
});

describe('connectorEndLabelBox', () => {
  const size = { w: 40, h: 20 };
  const horizontal = [
    PointLocation.fromVec([0, 0]),
    PointLocation.fromVec([100, 0]),
  ];

  test('anchors each label its own distance from its own endpoint', () => {
    expect(connectorEndLabelBox(horizontal, 'source', size)).toEqual([
      // Centred on x = 12 (the default distance along the path from the start)
      // and pushed half a height above the line.
      -8, -20, 40, 20,
    ]);
    expect(connectorEndLabelBox(horizontal, 'target', size)).toEqual([
      // Centred on x = 88, i.e. 12 back from the end.
      68, -20, 40, 20,
    ]);
    expect(DEFAULT_CONNECTOR_END_LABEL_DISTANCE).toBe(12);
  });

  test('puts both ends on the SAME side of the line', () => {
    const [, sourceY] = connectorEndLabelBox(horizontal, 'source', size);
    const [, targetY] = connectorEndLabelBox(horizontal, 'target', size);

    expect(sourceY).toBe(targetY);
  });

  test('honours an explicit distance', () => {
    const [x] = connectorEndLabelBox(horizontal, 'source', size, 30);

    expect(x).toBe(30 - size.w / 2);
  });

  test('walks a bent path segment by segment', () => {
    // 10 units right, then down: the default 12 lands 2 units into the second
    // segment, where the tangent points down and the normal points right.
    const bent = [
      PointLocation.fromVec([0, 0]),
      PointLocation.fromVec([10, 0]),
      PointLocation.fromVec([10, 100]),
    ];

    expect(connectorEndLabelBox(bent, 'source', size)).toEqual([
      10 + size.h / 2 - size.w / 2,
      2 - size.h / 2,
      40,
      20,
    ]);
  });

  test('a path shorter than the distance anchors at its far end', () => {
    const stub = [PointLocation.fromVec([0, 0]), PointLocation.fromVec([4, 0])];

    const [x] = connectorEndLabelBox(stub, 'source', size);

    expect(x).toBe(4 - size.w / 2);
  });

  test('a degenerate path still returns a box', () => {
    expect(connectorEndLabelBox([], 'source', size)).toEqual([
      -20, -10, 40, 20,
    ]);
    expect(
      connectorEndLabelBox([PointLocation.fromVec([5, 5])], 'target', size)
    ).toEqual([5 - 20, 5 - 10 - 10, 40, 20]);
  });
});
