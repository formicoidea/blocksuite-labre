import { ConnectorMode, PointStyle } from '@labre/affine-model';
import { type IVec, PointLocation } from '@labre/global/gfx';
import { describe, expect, test } from 'vitest';

import { createArrowMarker } from '../element-renderer/connector-dom/index.js';
import {
  getArrowOptions,
  HOLLOW_HEAD_FILL,
  renderRoundedPolygon,
} from '../element-renderer/utils.js';
import {
  FRONT_ENDPOINT_STYLE_LIST,
  REAR_ENDPOINT_STYLE_LIST,
} from '../toolbar/config.js';

const STROKE = '#112233';

function fakeModel() {
  return {
    seed: 1,
    mode: ConnectorMode.Straight,
    rough: false,
    roughness: 1,
    strokeWidth: 2,
    path: [new PointLocation([0, 0]), new PointLocation([10, 10])],
  } as unknown as Parameters<typeof getArrowOptions>[1];
}

/** The two properties `renderRoundedPolygon` is asserted on. */
function fakeContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() {},
    stroke() {},
  } as unknown as CanvasRenderingContext2D;
}

describe('endpoint arrow options', () => {
  test('a solid head fills with its own stroke colour', () => {
    const options = getArrowOptions('Rear', fakeModel(), STROKE);

    expect(options.fillColor).toBe(STROKE);
    expect(options.fillColor).toBe(options.strokeColor);
  });

  test('a hollow head keeps the stroke and overrides the fill', () => {
    const options = getArrowOptions(
      'Rear',
      fakeModel(),
      STROKE,
      HOLLOW_HEAD_FILL
    );

    expect(options.strokeColor).toBe(STROKE);
    expect(options.fillColor).toBe(HOLLOW_HEAD_FILL);
    expect(options.fillColor).not.toBe(options.strokeColor);
  });
});

describe('renderRoundedPolygon', () => {
  const points: IVec[] = [
    [0, 0],
    [10, 0],
    [5, 10],
  ];

  test('paints fill and stroke with the same colour by default', () => {
    const ctx = fakeContext();

    renderRoundedPolygon(ctx, points, STROKE, 2);

    expect(ctx.fillStyle).toBe(STROKE);
    expect(ctx.strokeStyle).toBe(STROKE);
  });

  test('an explicit fillColor leaves the outline on the stroke colour', () => {
    const ctx = fakeContext();

    renderRoundedPolygon(ctx, points, STROKE, 2, true, HOLLOW_HEAD_FILL);

    expect(ctx.fillStyle).toBe(HOLLOW_HEAD_FILL);
    expect(ctx.strokeStyle).toBe(STROKE);
    expect(ctx.fillStyle).not.toBe(ctx.strokeStyle);
  });
});

describe('createArrowMarker', () => {
  function head(style: PointStyle) {
    const marker = createArrowMarker('x', style, STROKE, 2);
    return marker.firstElementChild;
  }

  test.each([
    [PointStyle.TriangleHollow, 'path'],
    [PointStyle.DiamondHollow, 'path'],
  ])('%s draws a hollow %s', (style, tag) => {
    const shape = head(style)!;

    expect(shape.tagName).toBe(tag);
    expect(shape.getAttribute('fill')).toBe(HOLLOW_HEAD_FILL);
    expect(shape.getAttribute('stroke')).toBe(STROKE);
    expect(shape.getAttribute('fill')).not.toBe(shape.getAttribute('stroke'));
  });

  test.each([PointStyle.Triangle, PointStyle.Diamond, PointStyle.Arrow])(
    '%s stays solid',
    style => {
      const shape = head(style)!;

      expect(shape.getAttribute('fill')).toBe(STROKE);
      expect(shape.getAttribute('stroke')).toBe(STROKE);
    }
  );

  test('a hollow head reuses the geometry of its solid twin', () => {
    expect(head(PointStyle.TriangleHollow)!.getAttribute('d')).toBe(
      head(PointStyle.Triangle)!.getAttribute('d')
    );
    expect(head(PointStyle.DiamondHollow)!.getAttribute('d')).toBe(
      head(PointStyle.Diamond)!.getAttribute('d')
    );
  });

  test('an unknown persisted style yields an empty marker, never a throw', () => {
    // The append-only contract: a build older than a `PointStyle` member paints
    // no head instead of failing to render the connector.
    const marker = createArrowMarker(
      'x',
      'FromTheFuture' as PointStyle,
      STROKE,
      2
    );

    expect(marker.childElementCount).toBe(0);
  });
});

describe('the endpoint toolbar menus', () => {
  // `renderCurrentMenuItemWith` renders a blank trigger for a value no list
  // carries, so every member — `None` included, both lists already list it —
  // has to appear in both.
  const every = Object.values(PointStyle);

  test.each([
    ['front', FRONT_ENDPOINT_STYLE_LIST],
    ['rear', REAR_ENDPOINT_STYLE_LIST],
  ] as const)('the %s list covers every PointStyle', (_, list) => {
    const listed = list.map(item => item.value);

    expect([...listed].sort()).toEqual([...every].sort());
  });
});
