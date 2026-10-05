/**
 * A connector label's text decoration (ADR 0030 §3).
 *
 * The decoration rides inside `labelStyle`, the one style object the centre
 * label and both end labels share (ADR 0020), so it reaches all three captions
 * at once. Two of the sites that must read it live here: the canvas label
 * renderer (through the shared `paintTextDecoration`) and the DOM renderer's
 * label `<div>` (as CSS). A connector stored before the field existed must
 * paint exactly the calls it did.
 *
 * @vitest-environment happy-dom
 */
import {
  ConnectorElementModel,
  PointStyle,
  TextDecoration,
} from '@labre/affine-model';
import { PointLocation } from '@labre/global/gfx';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import * as Y from 'yjs';

import { connectorDomRenderer } from '../element-renderer/connector-dom/index.js';
import { connector as renderConnector } from '../element-renderer/index.js';

const MIDDLE = 4.5;

beforeAll(() => {
  const measureCtx = {
    get font() {
      return '';
    },
    set font(_: string) {},
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    measureText(text: string) {
      return {
        width: text.length * 10,
        fontBoundingBoxAscent: 12,
        fontBoundingBoxDescent: 4,
        // A real canvas reports the alphabetic baseline BELOW the `middle`
        // line as a negative distance (half the x-height in Chromium).
        alphabeticBaseline: this.textBaseline === 'middle' ? -MIDDLE : 0,
      };
    },
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    measureCtx) as unknown as HTMLCanvasElement['getContext'];
});

let originalPath2D: unknown;
beforeEach(() => {
  originalPath2D = (globalThis as Record<string, unknown>).Path2D;
  (globalThis as Record<string, unknown>).Path2D = class {
    rect() {}
  };
});
afterEach(() => {
  (globalThis as Record<string, unknown>).Path2D = originalPath2D;
});

function buildConnector(decoration?: string) {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  elements.set('connector-1', yMap);
  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: false },
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
    },
  };
  const model = new ConnectorElementModel({
    id: 'connector-1',
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  });
  model.xywh = '[0,0,100,50]';
  model.path = [PointLocation.fromVec([0, 0]), PointLocation.fromVec([100, 0])];
  model.frontEndpointStyle = PointStyle.None;
  model.rearEndpointStyle = PointStyle.None;
  model.text = new Y.Text('owns');
  model.labelXYWH = [30, 20, 40, 20];
  model.sourceLabel = new Y.Text('1');
  model.sourceLabelXYWH = [-8, -20, 40, 20];
  if (decoration !== undefined) {
    model.labelStyle = {
      ...model.labelStyle,
      textDecoration: decoration as TextDecoration,
    };
  }
  return model;
}

type Call = [string, ...unknown[]];

function paint(model: ConnectorElementModel) {
  const calls: Call[] = [];
  const state: Record<string | symbol, unknown> = {
    canvas: { isConnected: true, setAttribute() {} },
  };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push([
          String(prop),
          ...args.map(arg =>
            typeof arg === 'object' && arg !== null ? typeof arg : arg
          ),
        ]);
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  const matrix = (): unknown => ({ translate: matrix });

  renderConnector(
    model,
    ctx as never,
    matrix() as never,
    { usePlaceholder: false, getColorValue: () => '#000' } as never,
    {} as never,
    { x: 0, y: 0, w: 1000, h: 1000 }
  );
  return calls;
}

const named = (calls: Call[], name: string) =>
  calls.filter(([call]) => call === name);

describe('the canvas label renderer', () => {
  test('an old connector paints the same calls as one decorated none', () => {
    const before = paint(buildConnector());
    const none = paint(buildConnector(TextDecoration.None));

    expect(named(before, 'fillRect')).toEqual([]);
    expect(none).toEqual(before);
  });

  test('one labelStyle decorates every caption, under its own words', () => {
    const calls = paint(buildConnector(TextDecoration.Underline));
    const texts = named(calls, 'fillText');
    const rects = named(calls, 'fillRect');

    // The centre label and the source end label: one line each.
    expect(texts.map(([, str]) => str)).toEqual(['owns', '1']);
    expect(rects.map(([, , , w]) => w)).toEqual([40, 10]);
    // Painted on the `middle` baseline: the alphabetic one is measured below
    // it, and the underline sits 0.08 em under that.
    const [, , , centreY] = texts[0];
    expect(rects[0][2]).toBe((centreY as number) + MIDDLE + 16 * 0.08);
  });

  test('a future token beside overline still paints the overline', () => {
    const calls = paint(buildConnector('overline line-through'));

    expect(named(calls, 'fillRect')).toHaveLength(2);
  });
});

describe('the DOM label renderer', () => {
  function labels(model: ConnectorElementModel) {
    const host = document.createElement('div');
    connectorDomRenderer(model, host, {
      viewport: { zoom: 1 },
      getColorValue: () => '#000',
    } as never);
    return Array.from(host.querySelectorAll('div'));
  }

  test('says none for an old connector', () => {
    expect(
      labels(buildConnector()).map(label => label.style.textDecorationLine)
    ).toEqual(['none', 'none']);
  });

  test('says the known tokens of the stored value', () => {
    expect(
      labels(buildConnector('underline line-through overline')).map(
        label => label.style.textDecorationLine
      )
    ).toEqual(['underline overline', 'underline overline']);
  });
});
