/**
 * Canvas text decoration (ADR 0030 §3): the one helper the three canvas
 * renderers share, and the text renderer calling it.
 *
 * Three properties are pinned because no reader can check them by eye:
 *
 * - **An old document paints exactly as before.** A text with no
 *   `textDecoration` (or `none`) issues the same context calls it issued before
 *   the field existed — no `fillRect`, not even a `fillStyle` write.
 * - **Unknown tokens are skipped one at a time.** `'underline line-through'`
 *   still paints its underline; a value made only of unknown tokens paints
 *   nothing and throws nothing.
 * - **The line is measured, not boxed.** Its width is the run's advance, offset
 *   by the alignment the run was painted with, and its height comes from ratios
 *   of the painted size — numbers pinned here rather than tuned by eye.
 *
 * happy-dom has no 2D context, so the measuring canvas the renderer helpers
 * share is replaced by an arithmetic one: ten units per character, a 12-unit
 * ascent and a 4-unit descent.
 */
import { TextDecoration, TextElementModel } from '@labre/affine-model';
import { beforeAll, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { text as renderText } from '../element-renderer/index.js';
import {
  paintTextDecoration,
  parseTextDecoration,
  textDecorationLine,
  toggleTextDecoration,
} from '../element-renderer/utils.js';

const CHAR = 10;
const ASCENT = 12;
const DESCENT = 4;

beforeAll(() => {
  const measureCtx = {
    // Never equal to the font asked for, so `getFontMetrics` never caches a
    // plain object it could not scale.
    get font() {
      return '';
    },
    set font(_: string) {},
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    measureText(text: string) {
      return {
        width: text.length * CHAR,
        fontBoundingBoxAscent: ASCENT,
        fontBoundingBoxDescent: DESCENT,
        // Where the alphabetic baseline sits from the line asked for, up being
        // positive, as a real canvas reports it: a descent above the
        // ideographic line.
        alphabeticBaseline: this.textBaseline === 'ideographic' ? DESCENT : 0,
      };
    },
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    measureCtx) as unknown as HTMLCanvasElement['getContext'];
});

type Call = [string, ...unknown[]];

function recordingContext() {
  const calls: Call[] = [];
  let fillStyle = '';
  const ctx = {
    calls,
    canvas: { isConnected: true, dir: 'ltr', setAttribute() {} },
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      calls.push(['fillStyle', value]);
    },
    setTransform() {
      calls.push(['setTransform']);
    },
    fillText(str: string, x: number, y: number) {
      calls.push(['fillText', str, x, y]);
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push(['fillRect', x, y, w, h]);
    },
  };
  return ctx;
}

function fakeMatrix(): unknown {
  const matrix = {
    translateSelf: () => matrix,
    rotateSelf: () => matrix,
  };
  return matrix;
}

function buildText(words: string, decoration?: string) {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  elements.set('text-1', yMap);
  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: false },
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
    },
  };
  const model = new TextElementModel({
    id: 'text-1',
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  });
  model.xywh = '[0,0,200,40]';
  model.text = new Y.Text(words);
  if (decoration !== undefined) {
    model.textDecoration = decoration as TextDecoration;
  }
  return model;
}

function paint(model: TextElementModel) {
  const ctx = recordingContext();
  renderText(
    model,
    ctx as never,
    fakeMatrix() as never,
    { getColorValue: () => '#123456' } as never,
    {} as never,
    { x: 0, y: 0, w: 1000, h: 1000 }
  );
  return ctx.calls;
}

const rects = (calls: Call[]) => calls.filter(([name]) => name === 'fillRect');

describe('the stored token list', () => {
  test('is read token by token', () => {
    expect(parseTextDecoration(undefined)).toEqual({
      underline: false,
      overline: false,
    });
    expect(parseTextDecoration('none')).toEqual({
      underline: false,
      overline: false,
    });
    expect(parseTextDecoration('underline overline')).toEqual({
      underline: true,
      overline: true,
    });
    // A future token is skipped, not the whole value.
    expect(parseTextDecoration('underline line-through')).toEqual({
      underline: true,
      overline: false,
    });
    expect(parseTextDecoration('line-through')).toEqual({
      underline: false,
      overline: false,
    });
  });

  test('becomes a CSS line made of known tokens only', () => {
    expect(textDecorationLine(undefined)).toBe('none');
    expect(textDecorationLine('none')).toBe('none');
    expect(textDecorationLine('overline')).toBe('overline');
    expect(textDecorationLine('underline line-through overline')).toBe(
      'underline overline'
    );
  });

  test('a toggle writes the canonical value and keeps unknown tokens', () => {
    expect(toggleTextDecoration(undefined, 'underline', true)).toBe(
      'underline'
    );
    expect(toggleTextDecoration('overline', 'underline', true)).toBe(
      'underline overline'
    );
    // Off is `none`, never a cleared key (ADR 0030 §2).
    expect(toggleTextDecoration('underline', 'underline', false)).toBe('none');
    expect(
      toggleTextDecoration('underline line-through', 'overline', true)
    ).toBe('underline overline line-through');
  });
});

describe('paintTextDecoration', () => {
  const base = {
    lineText: 'Order',
    font: '16px Inter',
    x: 100,
    baselineY: 50,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    color: '#000',
  };

  test('paints nothing at all for an undecorated value', () => {
    for (const decoration of [undefined, 'none', 'line-through']) {
      const ctx = recordingContext();
      paintTextDecoration(ctx as never, { ...base, decoration });
      expect(ctx.calls).toEqual([]);
    }
  });

  test('an underline sits under the measured words, centred on x', () => {
    const ctx = recordingContext();
    ctx.textAlign = 'center';
    paintTextDecoration(ctx as never, { ...base, decoration: 'underline' });

    // Five characters, 50 units wide, centred on 100; 0.08 em below the
    // baseline, 1/16 em thick.
    expect(rects(ctx.calls)).toEqual([['fillRect', 75, 50 + 16 * 0.08, 50, 1]]);
  });

  test('an overline sits on the ascent, from x for a left-aligned run', () => {
    const ctx = recordingContext();
    ctx.textAlign = 'left';
    paintTextDecoration(ctx as never, {
      ...base,
      fontSize: 32,
      decoration: 'overline',
    });

    expect(rects(ctx.calls)).toEqual([['fillRect', 100, 50 - ASCENT, 50, 2]]);
  });

  test('a right-aligned run ends at x', () => {
    const ctx = recordingContext();
    ctx.textAlign = 'right';
    paintTextDecoration(ctx as never, {
      ...base,
      decoration: 'underline overline',
    });

    expect(rects(ctx.calls).map(([, x]) => x)).toEqual([50, 50]);
  });

  test('an unknown token beside a known one keeps the known one', () => {
    const ctx = recordingContext();
    paintTextDecoration(ctx as never, {
      ...base,
      decoration: 'underline line-through',
    });

    expect(rects(ctx.calls)).toHaveLength(1);
  });
});

describe('the text renderer', () => {
  test('an old text paints the same calls as one decorated none', () => {
    const before = paint(buildText('Order'));
    const none = paint(buildText('Order', TextDecoration.None));

    expect(rects(before)).toEqual([]);
    expect(none).toEqual(before);
    // Nothing but the transform, the one fill colour and the words.
    expect(before.map(([name]) => name)).toEqual([
      'setTransform',
      'fillStyle',
      'fillText',
    ]);
  });

  test('an underlined text strokes one line under its run', () => {
    const calls = paint(buildText('Order', TextDecoration.Underline));
    const [, , x, y] = calls.find(([name]) => name === 'fillText')!;

    // The renderer paints on the ideographic baseline; the line hangs off the
    // alphabetic one, a descent above it.
    expect(rects(calls)).toEqual([
      [
        'fillRect',
        (x as number) - 25,
        (y as number) - DESCENT + 16 * 0.08,
        50,
        1,
      ],
    ]);
  });

  test('a future token on a text does not throw and keeps the underline', () => {
    const calls = paint(buildText('Order', 'underline line-through'));

    expect(rects(calls)).toHaveLength(1);
  });
});
