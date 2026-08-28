import type { C4NodeElementModel, C4NodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NODE_SIZE } from '../consts';
import { c4Node } from '../node/node-renderer';
import { c4TypeLine } from '../type-line';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The native shape body is somebody else's renderer (and its own tests): what
 * this file is about is the layer C4 adds on top of it — the five silhouettes a
 * rectangle cannot be, and the two text tiers under the title.
 *
 * So `shape` is stubbed to a no-op and every operation the recorder sees is one
 * this renderer made. The assertions are about WHAT was drawn and in what
 * PROPORTIONS of the node box, which is the form the reference stencil states
 * its own geometry in — never about absolute coordinates, which would make every
 * nudge to a glyph a test failure and would not survive a resize anyway.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

const STROKE = '#3d81c3';
const FILL = '#438dd5';

const TEXT = '#ffffff';

/** The model fields the glyph layer reads, and nothing else. */
function nodeModel(
  kind: C4NodeKind,
  rotate = 0,
  size: { w: number; h: number } = NODE_SIZE[kind],
  tiers: Tiers = {}
): C4NodeElementModel {
  return {
    kind,
    rotate,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: STROKE,
    fillColor: FILL,
    color: TEXT,
    strokeWidth: 2,
    fontSize: 20,
    // Where the native renderer MEASURED the title this frame — the anchor the
    // two painted tiers hang off. `null` by default because `shape` is stubbed
    // to a no-op here, which is also the state of a brand-new element on its
    // very first paint: the renderer's own fallback then applies.
    textBound: null,
    ...tiers,
  } as unknown as C4NodeElementModel;
}

interface Tiers {
  technology?: string;
  description?: string;
  /** A title block the native renderer would have measured, in MODEL units. */
  textBound?: { y: number; h: number } | null;
}

/**
 * A title laid out where a freshly created node puts it — top-aligned, one
 * line, ending about a third of the way down a standard box.
 */
const MEASURED_TITLE = { y: 30, h: 24 } as const;

/** A canvas renderer, reduced to the one method the glyph layer calls. */
const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof c4Node>[3];

beforeAll(() => {
  // The renderer composes its own element-local frame with `DOMMatrix`, which
  // the DOM stub does not carry a usable one of. Read at draw time, never at
  // import time, so replacing it here is early enough.
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = {
    fromMatrix: () => stubMatrix(),
  };
});

let rec: ReturnType<typeof recordingCtx>;

beforeEach(() => {
  rec = recordingCtx();
});

/** Draw one kind and hand back what the canvas saw. */
function draw(
  kind: C4NodeKind,
  rotate = 0,
  size?: { w: number; h: number },
  tiers?: Tiers
) {
  c4Node(
    nodeModel(kind, rotate, size, tiers),
    rec.ctx,
    stubMatrix(),
    rendererStub,
    // roughjs canvas and bounds: the glyph layer passes them straight through
    // to the (stubbed) shape renderer and never touches them.
    null as never,
    null as never
  );
  return rec;
}

const ALL_KINDS = [
  'person',
  'person-ext',
  'system',
  'system-ext',
  'container',
  'database',
  'mobile',
  'browser',
  'component',
] as const satisfies readonly C4NodeKind[];

/**
 * The kinds C4 draws BARE — a plain SQUARE-cornered rectangle and nothing on it.
 *
 * Four of the nine, which is the pack's whole shape: three of C4's four levels
 * are the same box, and what tells them apart is the COLOUR they are created in
 * plus the role stamped on them. A glyph here would be inventing a notation.
 */
const BARE = ['system', 'system-ext', 'container', 'component'] as const;

/**
 * The painting operations of the GLYPH, with the text tiers filtered out.
 *
 * The tiers are drawn on every kind — the type line is notation, not decoration
 * — so a bare kind is one that draws no SHAPE, not one that draws nothing.
 */
const glyphOps = (ops: readonly string[]) =>
  ops.filter(op => op !== 'fillText');

describe('the C4 node glyph layer', () => {
  it('draws a silhouette on five kinds and on no other', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { ops } = draw(kind);
      const expected = !(BARE as readonly string[]).includes(kind);
      expect(glyphOps(ops).length > 0, kind).toBe(expected);
    }
  });

  /**
   * An element can be dragged to nothing. The resize manager takes the absolute
   * value of the dragged extents but sets NO minimum size, so every glyph here
   * has to survive a node smaller than its own border — and `arc` / `ellipse`
   * throw `IndexSizeError` on a negative radius rather than clamping. Since the
   * surface render loop wraps no renderer in a `try`, one such throw does not
   * lose a shape: it aborts the rest of the frame and leaves the save stack
   * unbalanced.
   *
   * The stub throws the same way the browser does, so this is the real
   * invariant and not a paraphrase of it.
   */
  it('survives every degenerate size without asking for a negative radius', () => {
    const sizes = [
      { w: 1, h: 1 },
      { w: 2, h: 2 },
      { w: 1, h: 40 },
      { w: 40, h: 1 },
      { w: 0, h: 0 },
    ];
    for (const kind of ALL_KINDS) {
      for (const size of sizes) {
        rec = recordingCtx();
        const where = `${kind} ${size.w}x${size.h}`;
        expect(
          () => draw(kind, 0, size, { description: 'a sentence about it' }),
          where
        ).not.toThrow();
        for (const curve of rec.curves) {
          expect(curve.rx, where).toBeGreaterThanOrEqual(0);
          expect(curve.ry, where).toBeGreaterThanOrEqual(0);
        }
        for (const rect of rec.rects) {
          expect(rect.w, where).toBeGreaterThanOrEqual(0);
          expect(rect.h, where).toBeGreaterThanOrEqual(0);
        }
        for (const path of rec.paths) {
          expect(path.r, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('paints in the node’s own two colours and in no third one', () => {
    // Every colour is read off the MODEL, so a node the author recoloured keeps
    // ONE picture rather than a recoloured body with a stencil-blue band on it.
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { strokes, fills } = draw(kind);
      for (const stroke of strokes) {
        expect([STROKE, FILL], `${kind} stroke`).toContain(stroke);
      }
      for (const fill of fills) {
        expect([STROKE, FILL], `${kind} fill`).toContain(fill);
      }
    }
  });

  it('sets up the element-local frame, rotation included', () => {
    const { transform } = draw('database', 45);
    const { w, h } = NODE_SIZE.database;
    expect(transform).toEqual([
      ['translate', w / 2, h / 2],
      ['rotate', 45],
      ['translate', -w / 2, -h / 2],
    ]);
  });

  /**
   * The person, against the reference stencil's own path (`mID 1`).
   *
   * Its head arc runs between `x=37.41` and `x=68.89` on the body's top edge
   * with `rx=26.362` and `large-arc-flag=1`, about a centre 21.263 units ABOVE
   * that edge — so the head is a circle roughly half the box wide, its top flush
   * with the element's own top, standing clear of a body that opens at a little
   * under four tenths of the height. The overlap is deliberate and small: the
   * stencil's path runs the body's top edge INTO the arc and back out of it,
   * which is what makes shoulders rather than a lollipop.
   */
  it('draws both people as the stencil’s head-and-shoulders silhouette', () => {
    for (const kind of ['person', 'person-ext'] as const) {
      rec = recordingCtx();
      const { curves, ops, fills, paths } = draw(kind);
      const { w, h } = NODE_SIZE[kind];

      // One ROUND head, not an ellipse: it is the one thing about a C4 person
      // everybody recognises, and the reason the person keeps a box of its own.
      expect(curves, kind).toHaveLength(1);
      const [head] = curves;
      expect(head.rx, kind).toBe(head.ry);
      // …roughly half the box wide, as `rx=26.362` of a 106.3-wide box is.
      expect((head.rx * 2) / w, kind).toBeGreaterThan(0.45);
      expect((head.rx * 2) / w, kind).toBeLessThan(0.52);
      // Centred, its top flush with the element's own top edge.
      expect(head.x, kind).toBe(w / 2);
      expect(head.y - head.rx, kind).toBeLessThan(2);

      // One body, the full width, opening at a little under four tenths down…
      expect(paths, kind).toHaveLength(1);
      const [body] = paths;
      expect(body.y / h, kind).toBeGreaterThan(0.35);
      expect(body.y / h, kind).toBeLessThan(0.42);
      expect(body.w / w, kind).toBeGreaterThan(0.98);
      // …and reaching the bottom.
      expect(body.y + body.h, kind).toBeCloseTo(h - 1, 0);
      // Strongly rounded, as `19.842` of a 106.3-wide box is.
      expect(body.r / w, kind).toBeGreaterThan(0.17);

      // The head OVERLAPS the body's top edge rather than sitting on it, which
      // is what fuses the two into one silhouette.
      expect(head.y + head.rx, kind).toBeGreaterThan(body.y);

      // The head goes FIRST so the body covers its lower arc. Both are filled
      // AND outlined, because the silhouette is the glyph's own — the native
      // rect under it paints nothing.
      expect(glyphOps(ops), kind).toEqual(['fill', 'stroke', 'fill', 'stroke']);
      expect(fills.slice(0, 2), kind).toEqual([FILL, FILL]);
    }

    // The external person is drawn identically — only its colours differ, and
    // those are the model's.
    rec = recordingCtx();
    const person = draw('person').curves;
    rec = recordingCtx();
    expect(draw('person-ext').curves).toEqual(person);
  });

  it('draws the database as a filled cylinder with a visible lid', () => {
    const { curves, fills, ops } = draw('database');
    const { h } = NODE_SIZE.database;
    // Floor, front of the lid, and the lid's own far edge — the rim the stencil
    // draws as two extra arcs over the body path.
    expect(curves).toHaveLength(3);
    for (const curve of curves) expect(curve.rx).toBeGreaterThan(curve.ry);
    // `ry ≈ 9.97` of a 74.409-tall box: shallow enough to read as perspective.
    expect(curves[0].ry / h).toBeGreaterThan(0.11);
    expect(curves[0].ry / h).toBeLessThan(0.16);
    expect(fills.slice(0, 1)).toEqual([FILL]);
    expect(glyphOps(ops)).toEqual(['fill', 'stroke', 'stroke']);
  });

  /**
   * The phone, against `mID 6`: a DARK outer rectangle — the bezel — with a
   * lighter screen inset in it, a button in the left bezel column and a speaker
   * slot down the right one. Not a band painted over a body: the stencil's outer
   * rect IS the darker of the node's two colours, which is why the native shape
   * under it now paints nothing at all.
   */
  it('draws the mobile app as a screen inset in a bezel', () => {
    const { paths, curves, segments, fills } = draw('mobile');
    const { w, h } = NODE_SIZE.mobile;

    expect(paths).toHaveLength(2);
    const [bezel, screen] = paths;
    // The bezel is the whole element, in the DARKER colour…
    expect(bezel.w).toBeCloseTo(w - 2, 0);
    expect(bezel.h).toBeCloseTo(h - 2, 0);
    expect(fills[0]).toBe(STROKE);
    // …and the screen is inset in it, in the lighter one, with EQUAL bezel
    // columns left and right (`x=9.2126`, `w=87.874` of 106.3).
    expect(fills[1]).toBe(FILL);
    expect(screen.x).toBeCloseTo(w - (screen.x + screen.w), 2);
    expect(screen.w / w).toBeGreaterThan(0.8);
    expect(screen.h / h).toBeGreaterThan(0.9);

    // The button: one circle, in the LEFT bezel column, vertically centred.
    expect(curves).toHaveLength(1);
    const [button] = curves;
    expect(button.rx).toBe(button.ry);
    expect(button.x).toBeLessThan(screen.x);
    expect(button.y / h).toBeCloseTo(0.51, 1);

    // The speaker slot: one vertical segment down the RIGHT bezel column.
    expect(segments).toHaveLength(1);
    const [slot] = segments;
    expect(slot.x1).toBe(slot.x2);
    expect(slot.x1).toBeGreaterThan(screen.x + screen.w);
    expect(Math.abs(slot.y2 - slot.y1) / h).toBeCloseTo(0.198, 2);
  });

  /**
   * The browser window, against `mID 11`: a dark frame, a chrome band across the
   * top carrying three dots and an address bar, and the screen under it.
   */
  it('draws the web app as a chrome band over a screen', () => {
    const { paths, curves, fills } = draw('browser');
    const { w, h } = NODE_SIZE.browser;

    // Frame, screen, address bar.
    expect(paths).toHaveLength(3);
    const [frame, screen, bar] = paths;
    expect(frame.w).toBeCloseTo(w - 2, 0);
    expect(fills[0]).toBe(STROKE);
    expect(fills[1]).toBe(FILL);

    // The screen is anchored to the BOTTOM: what it leaves free at the top is
    // the chrome band (`9.214` of 74.409).
    expect(screen.y / h).toBeGreaterThan(0.1);
    expect(screen.y / h).toBeLessThan(0.15);
    expect((screen.y + screen.h) / h).toBeGreaterThan(0.96);

    // Three dots, at the LEFT of the band, all inside it.
    expect(curves).toHaveLength(3);
    for (const dot of curves) {
      expect(dot.rx).toBe(dot.ry);
      expect(dot.rx).toBeGreaterThan(0);
      expect(dot.y).toBeLessThan(screen.y);
      expect(dot.x).toBeLessThan(w / 4);
    }
    // …and the address bar to their right, in the same band.
    expect(bar.x).toBeGreaterThan(curves[2].x);
    expect(bar.y + bar.h).toBeLessThan(screen.y + 1);
    expect(bar.w / w).toBeGreaterThan(0.7);
  });
});

/* ── The three text tiers ─────────────────────────────────────────────── */

/**
 * The tiers the PO's third change request is about: the derived type line and
 * the author's description, painted under the title on EVERY kind.
 *
 * The title itself is the native shape's inner text and is somebody else's
 * renderer (stubbed to a no-op here), which is exactly the seam: this file
 * asserts what the C4 layer adds under it.
 */
describe('the C4 node text tiers', () => {
  it('writes the derived type line on every one of the nine kinds', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { texts } = draw(kind);
      expect(texts, kind).toHaveLength(1);
      expect(texts[0].text, kind).toBe(c4TypeLine(kind));
      // Centred, in the element's own text colour.
      expect(texts[0].align, kind).toBe('center');
      expect(texts[0].x, kind).toBe(NODE_SIZE[kind].w / 2);
      expect(texts[0].color, kind).toBe(TEXT);
    }
  });

  it('folds the author’s technology into that same line', () => {
    const { texts } = draw('container', 0, undefined, { technology: 'Java' });
    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe('[Container: Java]');
  });

  it('writes the description under it, in a larger face, when there is one', () => {
    const { texts } = draw('container', 0, undefined, {
      technology: 'Java',
      description: 'Delivers the banking functionality.',
    });
    expect(texts.length).toBeGreaterThan(1);
    const [type, ...description] = texts;
    expect(type.text).toBe('[Container: Java]');
    // Below the type line, and in a LARGER face than it: the stencil's own
    // 6 / 8, which is what keeps the type line reading as a subtitle.
    expect(description[0].y).toBeGreaterThan(type.y);
    expect(Number.parseFloat(description[0].font)).toBeGreaterThan(
      Number.parseFloat(type.font)
    );
    expect(description.map(line => line.text).join(' ')).toContain('Delivers');
  });

  it('hangs the tiers off wherever the title actually landed', () => {
    // The one anchor that cannot collide with the words above it: a canvas
    // renderer cannot MOVE the native title, so it reads where the native text
    // renderer just put it and starts underneath.
    rec = recordingCtx();
    const high = draw('system', 0, undefined, { textBound: MEASURED_TITLE });
    const highY = high.texts[0].y;
    rec = recordingCtx();
    const low = draw('system', 0, undefined, {
      textBound: { y: MEASURED_TITLE.y + 40, h: MEASURED_TITLE.h },
    });
    expect(low.texts[0].y).toBeCloseTo(highY + 40, 5);
    // …and it always clears the block, never overlaps it.
    expect(highY).toBeGreaterThan(MEASURED_TITLE.y + MEASURED_TITLE.h);
  });

  it('wraps a description to the node, and says so when it will not fit', () => {
    const { texts } = draw('component', 0, undefined, {
      textBound: MEASURED_TITLE,
      description:
        'A long sentence that cannot possibly fit inside one line of a ' +
        'component box, nor inside the four or five that a box this size has ' +
        'room for, and therefore has to be cut somewhere honest instead.',
    });
    const description = texts.slice(1);
    expect(description.length).toBeGreaterThan(1);
    // Every line stays inside the box…
    const { w, h } = NODE_SIZE.component;
    for (const line of description) {
      expect(line.y).toBeLessThanOrEqual(h);
      const size = Number.parseFloat(line.font);
      expect(line.text.length * (size / 2)).toBeLessThanOrEqual(w);
    }
    // …and the last one admits there was more.
    expect(description.at(-1)!.text.endsWith('…')).toBe(true);
  });

  it('writes no description tier for a field the author never filled', () => {
    for (const nothing of [undefined, '', '   ']) {
      rec = recordingCtx();
      const { texts } = draw('system', 0, undefined, { description: nothing });
      expect(texts, JSON.stringify(nothing)).toHaveLength(1);
    }
  });
});
