import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  createSvgContext,
  runWithRecordingPath2D,
} from '../extensions/export-svg/svg-context.js';
import {
  exportBoundOf,
  selectBoardElements,
} from '../extensions/export-svg/render.js';
import { taggedPath2D } from '../extensions/export-svg/tagged-path.js';

/* ── Stubs ────────────────────────────────────────────────────────────── */

/**
 * Prototype-grafted stubs rather than real element models: the two pure
 * functions under test read nothing but `xywh` and the model's class, so
 * nothing here needs a surface, a store or a canvas. Same arrangement as
 * `gfx/wardley/src/__tests__/owm-board-stub.ts`.
 */
function fakeBackground(xywh: string): FrameworkBackgroundElementModel {
  const model = Object.create(FrameworkBackgroundElementModel.prototype);
  Object.defineProperty(model, 'xywh', { value: xywh });
  return model as FrameworkBackgroundElementModel;
}

function fakeElement(xywh: string): GfxPrimitiveElementModel {
  const model = Object.create(GfxPrimitiveElementModel.prototype);
  Object.defineProperty(model, 'xywh', { value: xywh });
  return model as GfxPrimitiveElementModel;
}

/* ── The SVG context ──────────────────────────────────────────────────── */

describe('createSvgContext', () => {
  test('records shapes and text as SVG nodes', () => {
    const { ctx, serialize } = createSvgContext(200, 100);

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 20, 30, 40);
    ctx.font = '16px sans-serif';
    ctx.fillText('Wardley', 5, 90);

    const svg = serialize();

    expect(svg).toMatch(/<(rect|path)\b/);
    expect(svg).toContain('<text');
    expect(svg).toContain('Wardley');
  });

  test('the root svg carries a viewBox, px sizes and the namespace', () => {
    const svg = createSvgContext(640, 480).serialize();

    expect(svg).toContain('viewBox="0 0 640 480"');
    expect(svg).toContain('width="640px"');
    expect(svg).toContain('height="480px"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('the canvas handed to RoughCanvas resolves back to the context', () => {
    const { ctx, canvas } = createSvgContext(10, 10);

    expect(canvas.getContext('2d')).toBe(ctx);
  });
});

/* ── The Path2D shim ──────────────────────────────────────────────────── */

describe('runWithRecordingPath2D', () => {
  test('a Path2D built from a `d` string is painted verbatim', () => {
    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      ctx.fillStyle = '#00ff00';
      ctx.fill(new Path2D('M0 0 L10 0 L10 10 Z'));
      return serialize();
    });

    expect(svg).toMatch(/<path[^>]*\bd="M0 0 L10 0 L10 10 Z"/);
  });

  test('a recorded path is a real Path2D, usable on a real canvas', () => {
    // A renderer may memoise the paths it builds, so an instance made while the
    // shim is up can outlive the export and reach a real canvas context later.
    const NativePath2D = globalThis.Path2D;

    runWithRecordingPath2D(() => {
      const path = new Path2D('M0 0 L10 0');
      expect(path).toBeInstanceOf(NativePath2D);
      const real = document
        .createElement('canvas')
        .getContext('2d') as CanvasRenderingContext2D;
      expect(() => real.stroke(path)).not.toThrow();
    });
  });

  test('clip(path, "evenodd") yields a clipPath carrying the rule', () => {
    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      const path = new Path2D();
      path.rect(0, 0, 50, 50);
      path.rect(10, 10, 10, 10);
      ctx.clip(path, 'evenodd');
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, 50, 50);
      return serialize();
    });

    expect(svg).toContain('<clipPath');
    const clipPath = svg.slice(
      svg.indexOf('<clipPath'),
      svg.indexOf('</defs>')
    );
    expect(clipPath).toContain('clip-rule="evenodd"');
    expect(clipPath).toMatch(/\bd="M 0 0 L 50 0[^"]*M 10 10\b/);
  });

  test('fill(path, "evenodd") yields fill-rule on the path', () => {
    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      const path = new Path2D();
      path.rect(0, 0, 50, 50);
      ctx.fill(path, 'evenodd');
      return serialize();
    });

    expect(svg).toMatch(/<path[^>]*fill-rule="evenodd"/);
  });

  test('an injected path carries the current matrix as a transform', () => {
    // svgcanvas bakes the matrix into the coordinates it emits itself; an
    // injected `d` did not go through that, so the matrix must ride along.
    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      ctx.translate(10, 20);
      ctx.fillStyle = '#000000';
      ctx.fill(new Path2D('M0 0 L1 0'));
      return serialize();
    });

    expect(svg).toMatch(/<path[^>]*transform="matrix\(1 0 0 1 10 20\)"/);
  });

  test('a stroked injected path keeps its unscaled stroke width', () => {
    // svgcanvas pre-multiplies `lineWidth` by the matrix scale; with the matrix
    // now on the node, that would scale the stroke twice.
    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      ctx.scale(2, 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.stroke(new Path2D('M0 0 L10 0'));
      return serialize();
    });

    expect(svg).toMatch(/<path[^>]*stroke-width="3"/);
  });

  test('an untagged Path2D is dropped, not painted stale', () => {
    // A native Path2D is a black box; nothing can read its geometry back.
    const opaque = new Path2D('M0 0 L10 10');

    const svg = runWithRecordingPath2D(() => {
      const { ctx, serialize } = createSvgContext(50, 50);
      ctx.fillStyle = '#000000';
      ctx.fill(new Path2D('M0 0 L1 0'));
      ctx.fill(opaque);
      return serialize();
    });

    expect(svg).toContain('d="M0 0 L1 0"');
    expect(svg).not.toContain('M0 0 L10 10');
  });

  test('a path unsupported by the recorder fails loudly', () => {
    expect(() =>
      runWithRecordingPath2D(() => new Path2D().arc(0, 0, 1, 0, 1))
    ).toThrow(/not recorded/);
  });

  test('the global Path2D is restored, including when the render throws', () => {
    const original = globalThis.Path2D;

    runWithRecordingPath2D(() => {
      expect(globalThis.Path2D).not.toBe(original);
    });
    expect(globalThis.Path2D).toBe(original);

    expect(() =>
      runWithRecordingPath2D(() => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(globalThis.Path2D).toBe(original);
  });
});

describe('taggedPath2D', () => {
  test('a tagged native Path2D is painted, shim or no shim', () => {
    // The case that matters: a renderer memoises its curves on an ordinary
    // canvas paint, long before any export, and hands that memo over later.
    const memoised = taggedPath2D('M0 0 L10 10 L20 0');

    for (const paint of [
      (fn: () => string) => fn(),
      (fn: () => string) => runWithRecordingPath2D(fn),
    ]) {
      const svg = paint(() => {
        const { ctx, serialize } = createSvgContext(50, 50);
        ctx.strokeStyle = '#000000';
        ctx.stroke(memoised);
        return serialize();
      });

      expect(svg).toContain('d="M0 0 L10 10 L20 0"');
    }
  });

  test('is a real Path2D a real canvas still accepts', () => {
    const real = document
      .createElement('canvas')
      .getContext('2d') as CanvasRenderingContext2D;

    const path = taggedPath2D('M0 0 L10 0');

    expect(path).toBeInstanceOf(Path2D);
    expect(() => real.stroke(path)).not.toThrow();
  });
});

/* ── What goes into a board's picture ─────────────────────────────────── */

describe('selectBoardElements', () => {
  test('keeps the board and drops a neighbouring background', () => {
    const board = fakeBackground('[0,0,100,100]');
    const neighbour = fakeBackground('[90,0,100,100]');
    const node = fakeElement('[10,10,20,20]');

    const kept = selectBoardElements(board, [board, node, neighbour]);

    expect(kept).toContain(board);
    expect(kept).toContain(node);
    expect(kept).not.toContain(neighbour);
  });

  test('preserves the query order, which is the canvas z-order', () => {
    const board = fakeBackground('[0,0,100,100]');
    const first = fakeElement('[0,0,10,10]');
    const second = fakeElement('[0,0,10,10]');

    expect(selectBoardElements(board, [board, first, second])).toEqual([
      board,
      first,
      second,
    ]);
  });

  test('puts the board under everything when the query missed it', () => {
    const board = fakeBackground('[0,0,100,100]');
    const node = fakeElement('[10,10,20,20]');

    expect(selectBoardElements(board, [node])).toEqual([board, node]);
  });
});

describe('exportBoundOf', () => {
  test('is the board frame when nothing overhangs it', () => {
    const board = fakeBackground('[0,0,100,100]');
    const node = fakeElement('[10,10,20,20]');

    const bound = exportBoundOf(board, [board, node]);

    expect([bound.x, bound.y, bound.w, bound.h]).toEqual([0, 0, 100, 100]);
  });

  test('widens to hold a label overhanging the frame', () => {
    const board = fakeBackground('[0,0,100,100]');
    const label = fakeElement('[90,-10,40,20]');

    const bound = exportBoundOf(board, [board, label]);

    expect([bound.x, bound.y, bound.w, bound.h]).toEqual([0, -10, 130, 110]);
  });
});
