import type { UmlNodeElementModel, UmlNodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { umlStackHeight } from '../component.js';
import { UML_NODE_BOX } from '../consts.js';
import { umlNode } from '../node/node-renderer.js';
import { recordingCtx, stubMatrix } from './canvas-stub.js';

/**
 * The glyph layer AT LEGEND SCALE — a `umlNode` drawn 34 units wide instead of
 * 200, which is what a legend row is.
 *
 * The PO's recette of 2026-09-15 is the reason this file exists: « les
 * pictogrammes de la légende ne sont pas correctement importés. Il n'y a que
 * des rectangles pour class et actors alors qu'ils ont des pictos bien
 * particuliers ». The legend now draws each row with the pack's own preset
 * (`legend.ts`) so the picture is painted by the renderer under test here, and
 * the one thing that could still turn a class into a bare rectangle is the
 * LAYOUT: `umlCompartmentBoxes` is written in absolute units — an 8-unit
 * margin, a 22-unit name line, three 18-unit attribute lines — and on a 20-unit
 * swatch every separator it computes lands past the bottom edge, where
 * `paintGlyph` clips it.
 *
 * `umlNodeCompartments` squeezes the stencil stack into a box too short to hold
 * it for exactly that reason, and these are the assertions that keep it true.
 * Nothing here restates a coordinate: the separators are asserted to be INSIDE
 * the body and in the right order, which is the whole of what "the picture is a
 * divided box" means.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

const STROKE = '#1f2328';
const FILL = '#ffffff';

/** A swatch box: the legend's 34 × 24 column, with the kind's own aspect. */
function swatch(kind: UmlNodeKind): { w: number; h: number } {
  const box = UML_NODE_BOX[kind];
  const aspect = box.w / box.h;
  const w = Math.min(34, 24 * aspect);
  return { w, h: w / aspect };
}

function nodeModel(
  kind: UmlNodeKind,
  size: { w: number; h: number }
): UmlNodeElementModel {
  return {
    kind,
    rotate: 0,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: STROKE,
    fillColor: FILL,
    // A legend swatch is drawn at the preset's own stroke width; it is the
    // inset every glyph is measured from.
    strokeWidth: 2,
  } as unknown as UmlNodeElementModel;
}

const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof umlNode>[3];

beforeAll(() => {
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = {
    fromMatrix: () => stubMatrix(),
  };
});

let rec: ReturnType<typeof recordingCtx>;
beforeEach(() => {
  rec = recordingCtx();
});

function draw(kind: UmlNodeKind, size = swatch(kind)) {
  umlNode(
    nodeModel(kind, size),
    rec.ctx,
    stubMatrix(),
    rendererStub,
    null as never,
    null as never
  );
  return { rec, size };
}

describe('a classifier keeps its compartments at swatch size', () => {
  it('is far shorter than the stack its absolutes ask for', () => {
    // The premise, stated so the test below cannot pass by accident: without a
    // squeeze there is no room for a single separator.
    expect(swatch('class').h).toBeLessThan(umlStackHeight('class', {})!);
  });

  it('rules a class twice, inside its own body', () => {
    const { rec: drawn, size } = draw('class');
    // Full-width horizontal rules — the compartment separators of §11.4.4.
    const rules = drawn.segments.filter(
      s => s.y1 === s.y2 && Math.abs(s.x2 - s.x1) > size.w / 2
    );
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.y1).toBeGreaterThan(0);
      expect(rule.y1).toBeLessThan(size.h);
    }
    // …and in order: the name compartment closes above the attributes one.
    expect(rules[0].y1).toBeLessThan(rules[1].y1);
  });

  it('rules a component once, and an artifact once', () => {
    // §11.6.4 and §19.3.4 draw a name over a single body tier, so one rule and
    // not two — the same walk, one split.
    for (const kind of ['component', 'artifact'] as const) {
      rec = recordingCtx();
      const { rec: drawn, size } = draw(kind);
      const rules = drawn.segments.filter(
        s => s.y1 === s.y2 && Math.abs(s.x2 - s.x1) > size.w / 2
      );
      expect(rules.length, kind).toBeGreaterThanOrEqual(1);
      expect(rules[0].y1, kind).toBeGreaterThan(0);
      expect(rules[0].y1, kind).toBeLessThan(size.h);
    }
  });

  it('draws a class at its own size exactly as it always did', () => {
    // The squeeze is a floor, not a restyle: at or above the natural stack the
    // separators are the absolutes `component.ts` computes, untouched.
    const { rec: drawn } = draw('class', UML_NODE_BOX.class);
    const rules = drawn.segments.filter(
      s => s.y1 === s.y2 && Math.abs(s.x2 - s.x1) > 100
    );
    expect(rules).toHaveLength(2);
    // 8 (margin) + 22.4 (name line) + 6 (gap) — the stencil's own first split.
    expect(rules[0].y1).toBeCloseTo(36.4, 5);
  });
});

describe('an actor is a stick figure at swatch size, not a rectangle', () => {
  it('draws a head and the four limbs', () => {
    const { rec: drawn, size } = draw('actor');

    // The head: one circle, inside the swatch and round.
    expect(drawn.curves).toHaveLength(1);
    const head = drawn.curves[0];
    expect(head.rx).toBe(head.ry);
    expect(head.rx).toBeGreaterThan(0);
    expect(head.x).toBeCloseTo(size.w / 2, 5);

    // The spine, the arms and the two legs — §18.1.4's figure, four segments.
    expect(drawn.segments).toHaveLength(4);
    const [spine, arms, leftLeg, rightLeg] = drawn.segments;
    // The spine is vertical and on the centre line.
    expect(spine.x1).toBeCloseTo(spine.x2, 5);
    expect(spine.x1).toBeCloseTo(size.w / 2, 5);
    expect(spine.y2).toBeGreaterThan(spine.y1);
    // The arms are horizontal and reach out on both sides of it.
    expect(arms.y1).toBeCloseTo(arms.y2, 5);
    expect(arms.x1).toBeLessThan(size.w / 2);
    expect(arms.x2).toBeGreaterThan(size.w / 2);
    // The legs leave the hips for opposite corners.
    expect(leftLeg.x2).toBeLessThan(size.w / 2);
    expect(rightLeg.x2).toBeGreaterThan(size.w / 2);
    // …and the whole figure stays inside the swatch.
    for (const s of drawn.segments) {
      expect(s.y1).toBeGreaterThanOrEqual(0);
      expect(s.y2).toBeLessThanOrEqual(size.h);
    }
  });

  it('is drawn PORTRAIT, which is what makes it read as a figure', () => {
    const box = swatch('actor');
    expect(box.h).toBeGreaterThan(box.w);
  });
});

describe('the other silhouettes survive the scale', () => {
  it('folds the note’s corner', () => {
    // Annex A's note: a five-sided body, then the two strokes of the fold.
    const { rec: drawn } = draw('note');
    expect(drawn.ops).toContain('fill');
    expect(drawn.segments.length).toBeGreaterThanOrEqual(2);
  });

  it('draws the package as a tab over a body', () => {
    // §12.2.4: two closed paths, the tab painted before the body whose top edge
    // closes the join — the paint ORDER is the silhouette.
    const { rec: drawn } = draw('package');
    expect(drawn.ops.filter(op => op === 'fill')).toHaveLength(2);
    expect(drawn.ops.filter(op => op === 'stroke')).toHaveLength(2);
  });

  it('draws the use case as nothing at all', () => {
    // §18.1.4's ellipse IS the native shape, and the glyph layer must keep its
    // hands off it — at any size.
    const { rec: drawn } = draw('use-case');
    expect(drawn.segments).toHaveLength(0);
    expect(drawn.curves).toHaveLength(0);
  });
});
