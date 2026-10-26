import { describe, expect, it } from 'vitest';

import { bpmnPool } from '../element-renderer';

/**
 * Why this spec exists: a pool's participant name and its lane names ran out
 * of their band. The name is written up a 28-unit band (a lane's in a 24-unit
 * strip) that holds ONE line, and the shared background primitive drew it with
 * a single `fillText`, so a long participant name crossed the frame and a long
 * lane name crossed into the next lane. The pool now declares
 * `fit: 'ellipsis'` on both, and this spec holds the cut with real Chromium text
 * metrics — the same metrics the SVG export measures with.
 */

const W = 560;
const H = 200;
const PAD = 4;

function paint(model: Record<string, unknown>) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const drawn: Array<{ text: string; font: string }> = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text: string, x: number, y: number) => {
    drawn.push({ text, font: ctx.font });
    fillText(text, x, y);
  };
  (bpmnPool as unknown as (m: unknown, c: unknown, x: unknown) => void)(
    {
      deserializedXYWH: [0, 0, W, H],
      rotate: 0,
      resizeEnabled: true,
      ...model,
    },
    ctx,
    new DOMMatrix()
  );
  const width = (text: string, font: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  return { drawn, width };
}

const LONG =
  'Group procurement, supplier onboarding and contract management office';

describe('a pool name cut to its band', () => {
  it('cuts a participant name longer than the pool, with an ellipsis', () => {
    const { drawn, width } = paint({ name: LONG });
    const [name] = drawn;

    expect(name.text.endsWith('…')).toBe(true);
    expect(LONG.startsWith(name.text.slice(0, -1))).toBe(true);
    // Centred up a band the height of the pool, a padding clear of each end.
    expect(width(name.text, name.font)).toBeLessThanOrEqual(H - 2 * PAD);
  });

  it('keeps a participant name that fits whole', () => {
    const { drawn } = paint({ name: 'Customer' });
    expect(drawn.map(d => d.text)).toEqual(['Customer']);
  });

  it('cuts a lane name to its own strip, and leaves a short one alone', () => {
    const { drawn, width } = paint({
      name: 'Customer',
      lanes: [
        { id: 'a', name: LONG, size: 1 },
        { id: 'b', name: 'Ops', size: 1 },
      ],
    });
    const [, long, short] = drawn;

    // Two lanes of equal weight share the 200-unit pool: 100 each.
    expect(long.text.endsWith('…')).toBe(true);
    expect(width(long.text, long.font)).toBeLessThanOrEqual(100 - 2 * PAD);
    expect(short.text).toBe('Ops');
  });
});
