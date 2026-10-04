/**
 * A shape's text decoration on the canvas (ADR 0030 §3).
 *
 * The shape renderer is one of the three sites that must call the shared
 * `paintTextDecoration`; this spec holds it to that, and to the guarantee that
 * a shape stored before the field existed paints exactly the calls it did.
 *
 * happy-dom has no 2D context, so the measuring canvas is an arithmetic one
 * (ten units per character) and the painting context is a recorder that
 * accepts any call.
 *
 * @vitest-environment happy-dom
 */
import { ShapeElementModel, TextDecoration } from '@labre/affine-model';
import { beforeAll, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { shape as renderShape } from '../element-renderer/shape/index.js';

const CHAR = 10;

beforeAll(() => {
  const measureCtx = {
    get font() {
      return '';
    },
    set font(_: string) {},
    measureText: (text: string) => ({
      width: text.length * CHAR,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
    }),
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    measureCtx) as unknown as HTMLCanvasElement['getContext'];
});

type Call = [string, ...unknown[]];

/** Records every method call; plain properties are stored as written. */
function recordingContext() {
  const calls: Call[] = [];
  const state: Record<string | symbol, unknown> = {
    canvas: { isConnected: true, dir: 'ltr', setAttribute() {} },
  };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'getTransform') return fakeMatrix;
      return (...args: unknown[]) => {
        // Matrices and paths are fresh objects on every paint: recorded by
        // kind, so two paints compare by what they drew.
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
  return { ctx, calls };
}

function fakeMatrix(): unknown {
  const matrix = {
    a: 1,
    translateSelf: () => matrix,
    rotateSelf: () => matrix,
  };
  return matrix;
}

function buildShape(words: string, decoration?: string) {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  elements.set('shape-1', yMap);
  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: false },
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
    },
  };
  const model = new ShapeElementModel({
    id: 'shape-1',
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  });
  model.xywh = '[0,0,200,100]';
  model.text = new Y.Text(words);
  if (decoration !== undefined) {
    model.textDecoration = decoration as TextDecoration;
  }
  return model;
}

function paint(model: ShapeElementModel) {
  const { ctx, calls } = recordingContext();
  renderShape(
    model,
    ctx as never,
    fakeMatrix() as never,
    { getColorValue: () => '#123456' } as never,
    {} as never,
    { x: 0, y: 0, w: 1000, h: 1000 }
  );
  return calls;
}

const named = (calls: Call[], name: string) =>
  calls.filter(([call]) => call === name);

describe('the shape renderer', () => {
  test('an old shape paints the same calls as one decorated none', () => {
    const before = paint(buildShape('Order'));
    const none = paint(buildShape('Order', TextDecoration.None));

    expect(named(before, 'fillRect')).toEqual([]);
    expect(none).toEqual(before);
  });

  test('an underline runs under the measured words, not the shape', () => {
    const calls = paint(buildShape('Order', TextDecoration.Underline));
    const [[, , x, y]] = named(calls, 'fillText');

    // Centred text: 50 units of words centred on the fillText x, 0.08 em under
    // the alphabetic baseline the shape already paints on, at its 20px size.
    expect(named(calls, 'fillRect')).toEqual([
      ['fillRect', (x as number) - 25, (y as number) + 20 * 0.08, 50, 20 / 16],
    ]);
  });

  test('both lines for underline overline, and a future token is skipped', () => {
    expect(
      named(
        paint(buildShape('Order', TextDecoration.UnderlineOverline)),
        'fillRect'
      )
    ).toHaveLength(2);
    expect(
      named(paint(buildShape('Order', 'line-through overline')), 'fillRect')
    ).toHaveLength(1);
  });
});
