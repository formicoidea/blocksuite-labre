/**
 * The two connector renderers painting THREE captions — the centre name and
 * the two end labels of ADR 0020.
 *
 * `connectorDomRenderer` builds real nodes, so this file needs a DOM; the
 * canvas half runs happily in the same environment.
 *
 * @vitest-environment happy-dom
 */
import { ConnectorElementModel, PointStyle } from '@labre/affine-model';
import { PointLocation } from '@labre/global/gfx';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { connectorDomRenderer } from '../element-renderer/connector-dom/index.js';
import { connector as renderConnector } from '../element-renderer/index.js';

/**
 * A connector on a real `Y.Doc`.
 *
 * The same harness the model spec uses, and for the same reason: a `Y.Text`
 * only reports a `length` once integrated, and every `hasLabel()` /
 * `hasEndLabel()` the renderers consult is a question about that length.
 */
function buildConnector(id = 'connector-1') {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  elements.set(id, yMap);

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

  model.xywh = '[0,0,100,50]';
  model.path = [PointLocation.fromVec([0, 0]), PointLocation.fromVec([100, 0])];
  // Keeps the fakes below down to what a label needs: no head is painted.
  model.frontEndpointStyle = PointStyle.None;
  model.rearEndpointStyle = PointStyle.None;

  return model;
}

function withCenterLabel(model: ConnectorElementModel) {
  model.text = new Y.Text('owns');
  model.labelXYWH = [30, 20, 40, 20];
  return model;
}

function withEndLabels(model: ConnectorElementModel) {
  model.sourceLabel = new Y.Text('1');
  model.sourceLabelXYWH = [-8, -20, 40, 20];
  model.targetLabel = new Y.Text('0..*');
  model.targetLabelXYWH = [68, -20, 40, 20];
  return model;
}

/** Every rect handed to the one `Path2D` the renderer clips with. */
let clipRects: number[][] = [];
let originalPath2D: unknown;

class RecordingPath2D {
  rect(x: number, y: number, w: number, h: number) {
    clipRects.push([x, y, w, h]);
  }
}

beforeEach(() => {
  clipRects = [];
  originalPath2D = (globalThis as Record<string, unknown>).Path2D;
  (globalThis as Record<string, unknown>).Path2D = RecordingPath2D;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).Path2D = originalPath2D;
});

/** The calls the assertions below read back off the canvas context. */
function fakeContext() {
  const placeholders: number[][] = [];
  const transforms: unknown[] = [];

  const ctx = {
    placeholders,
    transforms,
    canvas: { isConnected: true, setAttribute() {} },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    setTransform(matrix: unknown) {
      transforms.push(matrix);
    },
    clip() {},
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    setLineDash() {},
    stroke() {},
    fill() {},
    fillRect(x: number, y: number, w: number, h: number) {
      placeholders.push([x, y, w, h]);
    },
    fillText() {},
  };

  return ctx;
}

/**
 * A matrix that records what it was translated by, which is the only thing the
 * renderer asks of it — happy-dom's `DOMMatrix` has the name but not the
 * geometry.
 */
function fakeMatrix(dx = 0, dy = 0) {
  return {
    dx,
    dy,
    translate(tx: number, ty: number) {
      return fakeMatrix(dx + tx, dy + ty);
    },
  };
}

/** Paints with the placeholder path, which is one `fillRect` per label. */
function paint(model: ConnectorElementModel) {
  const ctx = fakeContext();

  renderConnector(
    model,
    ctx as never,
    fakeMatrix() as never,
    { usePlaceholder: true, getColorValue: () => '#000' } as never,
    {} as never,
    { x: 0, y: 0, w: 1000, h: 1000 }
  );

  return ctx;
}

describe('the canvas renderer', () => {
  test('paints nothing extra when the connector has no label', () => {
    const ctx = paint(buildConnector());

    expect(ctx.placeholders).toHaveLength(0);
    // No caption, no clip: the stroke runs the whole path.
    expect(clipRects).toHaveLength(0);
  });

  test('a centre label alone is one pass and one subtracted rect', () => {
    const ctx = paint(withCenterLabel(buildConnector()));

    expect(ctx.placeholders).toHaveLength(1);
    // The element's own rect, plus the one label's.
    expect(clipRects).toHaveLength(2);
  });

  test('three labels are three passes', () => {
    const ctx = paint(withEndLabels(withCenterLabel(buildConnector())));

    expect(ctx.placeholders).toHaveLength(3);
    expect(ctx.placeholders).toEqual([
      [0, 0, 40, 20],
      [0, 0, 40, 20],
      [0, 0, 40, 20],
    ]);
  });

  test('the clip path subtracts every present box', () => {
    paint(withEndLabels(withCenterLabel(buildConnector())));

    // The element rect first, then one per caption: centre, source, target.
    expect(clipRects).toHaveLength(4);
    expect(clipRects.slice(1)).toEqual([
      // Each box, relative to the element origin, grown by the same 3-unit
      // bleed the centre label has always used.
      [30 - 3.5, 20 - 3.5, 47, 27],
      [-8 - 3.5, -20 - 3.5, 47, 27],
      [68 - 3.5, -20 - 3.5, 47, 27],
    ]);
  });

  test('each label is painted at its own box', () => {
    const ctx = paint(withEndLabels(withCenterLabel(buildConnector())));

    // The line's own transform comes first; the three captions follow, each
    // translated to its box relative to the element origin.
    const translations = ctx.transforms
      .slice(1)
      .map(matrix => [
        (matrix as { dx: number }).dx,
        (matrix as { dy: number }).dy,
      ]);

    expect(translations).toEqual([
      [30, 20],
      [-8, -20],
      [68, -20],
    ]);
  });

  test('an end label that is being edited is not painted twice', () => {
    const model = withEndLabels(withCenterLabel(buildConnector()));
    model.endLabelEditing = 'target';

    const ctx = paint(model);

    expect(ctx.placeholders).toHaveLength(2);
    expect(clipRects).toHaveLength(3);
  });
});

describe('the DOM renderer', () => {
  function paintDom(model: ConnectorElementModel) {
    const host = document.createElement('div');

    connectorDomRenderer(model, host, {
      viewport: { zoom: 1 },
      getColorValue: () => '#000',
    } as never);

    return host;
  }

  test('renders one div per present caption', () => {
    const host = paintDom(withEndLabels(withCenterLabel(buildConnector())));

    const labels = Array.from(host.querySelectorAll('div'));

    expect(labels).toHaveLength(3);
    expect(labels.map(label => label.textContent)).toEqual([
      'owns',
      '1',
      '0..*',
    ]);
  });

  test('places each end label at its own box', () => {
    const host = paintDom(withEndLabels(buildConnector()));

    const [source, target] = Array.from(host.querySelectorAll('div'));

    expect(source.style.left).toBe('-8px');
    expect(source.style.top).toBe('-20px');
    expect(target.style.left).toBe('68px');
    expect(target.style.top).toBe('-20px');
  });

  test('drops the node of a caption that goes away', () => {
    const model = withEndLabels(withCenterLabel(buildConnector()));
    const host = document.createElement('div');
    const renderer = {
      viewport: { zoom: 1 },
      getColorValue: () => '#000',
    } as never;

    connectorDomRenderer(model, host, renderer);
    expect(host.querySelectorAll('div')).toHaveLength(3);

    model.targetLabel = new Y.Text();
    connectorDomRenderer(model, host, renderer);

    const remaining = Array.from(host.querySelectorAll('div'));
    expect(remaining.map(label => label.textContent)).toEqual(['owns', '1']);
  });

  test('the endpoint markers are unaffected by the extra labels', () => {
    const model = withEndLabels(withCenterLabel(buildConnector()));
    model.rearEndpointStyle = PointStyle.Arrow;

    const host = paintDom(model);

    expect(host.querySelectorAll('marker')).toHaveLength(1);
  });
});
