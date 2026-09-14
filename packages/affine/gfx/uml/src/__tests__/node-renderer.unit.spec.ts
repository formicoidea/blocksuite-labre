import type { UmlNodeElementModel, UmlNodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UML_ACTOR_FIGURE,
  UML_CUBE_DEPTH,
  UML_PACKAGE_TAB,
  umlCompartmentBoxes,
} from '../component.js';
import { UML_NODE_BOX } from '../consts.js';
import { umlNode } from '../node/node-renderer.js';
import { recordingCtx, stubMatrix } from './canvas-stub.js';

/**
 * The native shape body is somebody else's renderer (and its own tests): what
 * this file is about is the layer UML adds on top of it — the compartment
 * separators, the instance underline, and the three silhouettes a rectangle
 * cannot be.
 *
 * So `shape` is stubbed to a no-op and every operation the recorder sees is one
 * this renderer made. The assertions are about WHAT was drawn and WHERE against
 * the layout `component.ts` owns — never about absolute coordinates this file
 * chose, which would make every nudge a test failure and would not survive a
 * resize anyway.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

const STROKE = '#1f2328';
const FILL = '#ffffff';

/** The model fields the glyph layer reads, and nothing else. */
function nodeModel(
  kind: UmlNodeKind,
  rotate = 0,
  size: { w: number; h: number } = UML_NODE_BOX[kind]
): UmlNodeElementModel {
  return {
    kind,
    rotate,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: STROKE,
    fillColor: FILL,
    strokeWidth: 2,
  } as unknown as UmlNodeElementModel;
}

/** A canvas renderer, reduced to the one method the glyph layer calls. */
const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof umlNode>[3];

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
function draw(kind: UmlNodeKind, rotate = 0, size?: { w: number; h: number }) {
  umlNode(
    nodeModel(kind, rotate, size),
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
  'class',
  'interface',
  'enumeration',
  'object',
  'package',
  'note',
  'actor',
  'use-case',
  'component',
  'port',
  'provided-interface',
  'required-interface',
  'artifact',
  'node',
  'device',
  'execution-environment',
] as const satisfies readonly UmlNodeKind[];

/** Half the stroke width — the inset every body is drawn inside. */
const INSET = 1;

describe('the UML node glyph layer', () => {
  /**
   * The use case is the one kind with nothing drawn on it: §18.1.4 draws a use
   * case as a plain ellipse, and anything painted over it would be inventing a
   * notation. Every other kind gets a mark.
   */
  it('draws something on fifteen kinds, and nothing on the ellipse', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { ops } = draw(kind);
      if (kind === 'use-case') expect(ops, kind).toEqual([]);
      else expect(ops.length, kind).toBeGreaterThan(0);
    }
  });

  /**
   * §11.4.4: a classifier is a rectangle divided into compartments. The
   * separators are read from `umlCompartmentBoxes` — the same pure layout the
   * creation site places the text tiers with — so a rule is drawn exactly
   * between two compartments and not near where they were.
   */
  it.each(['class', 'interface', 'enumeration'] as const)(
    'rules %s across its two compartment splits, edge to edge',
    kind => {
      const { w, h } = UML_NODE_BOX[kind];
      const { splits } = umlCompartmentBoxes(kind, 0, 0, w, h);
      expect(splits).toHaveLength(2);

      const { segments, ops } = draw(kind);
      expect(segments).toEqual(
        splits.map(y => ({ x1: INSET, y1: y, x2: w - INSET, y2: y }))
      );
      // Stroke only: a separator is a line, and a filled one would be a band.
      expect(ops).toEqual(['stroke', 'stroke']);
    }
  );

  /**
   * §9.8.4: an instance specification is a name compartment over a SLOT
   * compartment — one split, not two — with the name UNDERLINED, which is the
   * one mark that tells an object from the class it instantiates.
   */
  it('gives the object one split and underlines its name', () => {
    const { w, h } = UML_NODE_BOX.object;
    const boxes = umlCompartmentBoxes('object', 0, 0, w, h);
    expect(boxes.splits).toHaveLength(1);

    const { segments } = draw('object');
    expect(segments).toHaveLength(2);
    const [split, underline] = segments;

    expect(split).toEqual({
      x1: INSET,
      y1: boxes.splits[0],
      x2: w - INSET,
      y2: boxes.splits[0],
    });
    // Under the NAME box and only as wide as it, so it reads as a rule under
    // the words rather than as a second compartment line.
    expect(underline).toEqual({
      x1: boxes.name.x,
      y1: boxes.name.y + boxes.name.h,
      x2: boxes.name.x + boxes.name.w,
      y2: boxes.name.y + boxes.name.h,
    });
    expect(underline.x2 - underline.x1).toBeLessThan(split.x2 - split.x1);
  });

  /**
   * §12.2.4: a tabbed folder. The tab is painted FIRST so the body's top edge,
   * drawn over it, closes the join on the right of the tab and nowhere else.
   */
  it('draws the package as a tab over a body, tab first', () => {
    const { w, h } = UML_NODE_BOX.package;
    const { ops, segments } = draw('package');
    expect(ops).toEqual(['fill', 'stroke', 'fill', 'stroke']);

    // The body's top edge is the line `component.ts` puts the name compartment
    // under — one number, so a label can never sit on a fold.
    const tabBottom = h * UML_PACKAGE_TAB;
    expect(segments[3]).toEqual({
      x1: INSET,
      y1: tabBottom,
      x2: w - INSET,
      y2: tabBottom,
    });
    // …and the tab is a fraction of the width, never the whole of it: its top
    // edge and its right edge stop well short of the box.
    expect(segments[1].x2).toBeGreaterThan(INSET);
    expect(segments[1].x2).toBeLessThan(w / 2 + INSET);
    expect(segments[2]).toEqual({
      x1: segments[1].x2,
      y1: INSET,
      x2: segments[1].x2,
      y2: tabBottom,
    });
  });

  /** Annex A: a rectangle with its top-right corner turned down. */
  it('turns down the note’s corner, and draws the fold as two lines', () => {
    const { w, h } = UML_NODE_BOX.note;
    const { ops, segments } = draw('note');
    // Body filled and stroked, then the fold stroked over it — never filled: a
    // shaded flap would claim a light source the notation has none of.
    expect(ops).toEqual(['fill', 'stroke', 'stroke']);

    const fold = Math.min(w - INSET * 2, h - INSET * 2) * 0.22;
    // The body's top edge stops short of the right-hand corner…
    expect(segments[0]).toEqual({
      x1: INSET,
      y1: INSET,
      x2: w - INSET - fold,
      y2: INSET,
    });
    // …and the bevel runs down to the fold's own depth.
    expect(segments[1]).toEqual({
      x1: w - INSET - fold,
      y1: INSET,
      x2: w - INSET,
      y2: INSET + fold,
    });
    expect(segments).toHaveLength(6);
  });

  /**
   * §18.1.4: a stick figure over its own name. The figure stops at the line
   * `component.ts` puts the label below (`UML_ACTOR_FIGURE`), so a head can
   * never overlap the words under it.
   */
  it('draws the actor as a round head over four strokes, clear of its label', () => {
    const { w, h } = UML_NODE_BOX.actor;
    const { ops, curves, segments } = draw('actor');

    expect(ops).toEqual([
      'fill',
      'stroke',
      'stroke',
      'stroke',
      'stroke',
      'stroke',
    ]);
    // One head, and it is a CIRCLE — the one thing about a UML actor everybody
    // recognises, and the one thing a squeezed ellipse would get wrong.
    expect(curves).toHaveLength(1);
    expect(curves[0].rx).toBe(curves[0].ry);
    expect(curves[0].x).toBe(w / 2);

    // Spine, arms, and two legs — every one of them above the label line.
    expect(segments).toHaveLength(4);
    const figureBottom = h * UML_ACTOR_FIGURE;
    for (const segment of segments) {
      expect(Math.max(segment.y1, segment.y2)).toBeLessThanOrEqual(
        figureBottom
      );
    }
    expect(umlCompartmentBoxes('actor', 0, 0, w, h).name.y).toBe(figureBottom);
  });

  /**
   * §11.6.4: a component is the class rectangle with the two-tabbed icon in its
   * top-right corner — the icon being what MAKES it a component, which is why
   * its name seed writes no `«component»` keyword.
   */
  it('rules the component once and drops its two-tabbed icon in the corner', () => {
    const { w, h } = UML_NODE_BOX.component;
    const { splits } = umlCompartmentBoxes('component', 0, 0, w, h);
    // A name over one body tier (§11.6.4), so ONE separator — a component is
    // laid out like an object, not like a class.
    expect(splits).toHaveLength(1);

    const { ops, segments } = draw('component');
    expect(segments[0]).toEqual({
      x1: INSET,
      y1: splits[0],
      x2: w - INSET,
      y2: splits[0],
    });
    // The separator, then three little BODIES — the icon and its two tabs, each
    // filled and stroked with the element's own colours, so recolouring the
    // component recolours them with it.
    expect(ops).toEqual([
      'stroke',
      'fill',
      'stroke',
      'fill',
      'stroke',
      'fill',
      'stroke',
    ]);

    // Every stroke of it in the top-right corner, above the separator: the icon
    // shares the name compartment and must not land on the words.
    const icon = segments.slice(1);
    expect(icon).toHaveLength(9);
    for (const segment of icon) {
      expect(Math.min(segment.x1, segment.x2)).toBeGreaterThan(w / 2);
      expect(Math.max(segment.y1, segment.y2)).toBeLessThan(splits[0]);
    }
  });

  /**
   * §19.3.4: an artifact is the same rectangle with a DOCUMENT icon — a sheet
   * of paper with its corner turned down, the fold drawn as two lines exactly
   * as the note's is.
   */
  it('gives the artifact a folded-corner document in its corner', () => {
    const { w, h } = UML_NODE_BOX.artifact;
    const { splits } = umlCompartmentBoxes('artifact', 0, 0, w, h);
    expect(splits).toHaveLength(1);

    const { ops, segments } = draw('artifact');
    // The separator, the little page (filled, then outlined), and the fold
    // stroked over it — never filled, for the note's own reason.
    expect(ops).toEqual(['stroke', 'fill', 'stroke', 'stroke']);

    const icon = segments.slice(1);
    // Four sides of a page with a corner cut off, then the two lines of the
    // fold.
    expect(icon).toHaveLength(6);
    for (const segment of icon) {
      expect(Math.min(segment.x1, segment.x2)).toBeGreaterThan(w / 2);
      expect(Math.max(segment.y1, segment.y2)).toBeLessThan(splits[0]);
    }
    // The bevel: the page's top edge stops short, and the cut runs down and
    // right to the fold's own depth.
    expect(icon[1].x2).toBeGreaterThan(icon[1].x1);
    expect(icon[1].y2).toBeGreaterThan(icon[1].y1);
  });

  /**
   * §11.3.4: a port is a small SQUARE. Square whatever the element's aspect
   * ratio, because a port dragged into a rectangle is still a port — and
   * centred, so the name written beside it lines up with it.
   */
  it('draws the port as a centred square, at any aspect ratio', () => {
    const { ops, segments } = draw('port');
    expect(ops).toEqual(['fill', 'stroke']);
    expect(segments).toHaveLength(3);
    const [top, right] = segments;
    expect(top.x2 - top.x1).toBeCloseTo(right.y2 - right.y1);

    // Dragged wide: the glyph takes the shorter side and sits in the middle.
    rec = recordingCtx();
    const wide = draw('port', 0, { w: 60, h: 16 });
    const [wideTop] = wide.segments;
    expect(wideTop.x2 - wideTop.x1).toBeCloseTo(16 - INSET * 2);
    expect(wideTop.x1 - INSET).toBeCloseTo(60 - INSET - wideTop.x2);
  });

  /**
   * §10.4.4: the ball and the socket. One offers a service and the other needs
   * one, and the difference on the page is that a lollipop is a CLOSED filled
   * circle and a socket an open arc.
   */
  it('fills the lollipop’s ball and leaves the socket an open arc', () => {
    const provided = draw('provided-interface');
    expect(provided.ops).toEqual(['fill', 'stroke', 'stroke']);
    expect(provided.curves).toHaveLength(1);
    // Round at any aspect ratio, like the actor's head, and centred across the
    // glyph so the stub below it is vertical.
    expect(provided.curves[0].rx).toBe(provided.curves[0].ry);
    expect(provided.curves[0].x).toBe(UML_NODE_BOX['provided-interface'].w / 2);

    rec = recordingCtx();
    const required = draw('required-interface');
    // Never filled: a filled half-disc would read as a ball cut in two.
    expect(required.ops).toEqual(['stroke', 'stroke']);
    expect(required.curves).toHaveLength(1);
  });

  /** Both hang off a STUB — the short line that runs to the component. */
  it('hangs both interface glyphs on a vertical stub below the curve', () => {
    for (const kind of ['provided-interface', 'required-interface'] as const) {
      rec = recordingCtx();
      const { curves, segments } = draw(kind);
      expect(segments, kind).toHaveLength(1);
      const [stub] = segments;
      const [ball] = curves;
      // Straight down, from the bottom of the curve to the bottom of the box.
      expect(stub.x1, kind).toBeCloseTo(ball.x);
      expect(stub.x2, kind).toBeCloseTo(ball.x);
      expect(stub.y1, kind).toBeCloseTo(ball.y + ball.ry);
      expect(stub.y2, kind).toBeCloseTo(UML_NODE_BOX[kind].h - INSET);
    }
  });

  /**
   * §19.4.4: a node, a device and an execution environment are ONE drawing —
   * the 3-D cube — told apart by the keyword written in the front face. The
   * front face is painted LAST, so it closes every join that should not be
   * seen, and it is the rectangle `component.ts` writes the name inside.
   */
  it('draws the three deployment targets as one cube, name in the front face', () => {
    for (const kind of ['node', 'device', 'execution-environment'] as const) {
      rec = recordingCtx();
      const { w, h } = UML_NODE_BOX[kind];
      const { ops, segments } = draw(kind);

      // Three faces, each filled and outlined: the top, the right, the front.
      expect(ops, kind).toEqual([
        'fill',
        'stroke',
        'fill',
        'stroke',
        'fill',
        'stroke',
      ]);
      expect(segments, kind).toHaveLength(9);

      const depth = Math.min(w, h) * UML_CUBE_DEPTH;
      // The front face's top edge: the full width of the box less the depth the
      // solid is turned by, one depth down from the top.
      expect(segments[6], kind).toEqual({
        x1: INSET,
        y1: INSET + depth,
        x2: w - INSET - depth,
        y2: INSET + depth,
      });

      // …and the name sits INSIDE that face, never on the roof. One number
      // (`UML_CUBE_DEPTH`) owned by `component.ts` is what makes that true.
      const { name } = umlCompartmentBoxes(kind, 0, 0, w, h);
      expect(name.y, kind).toBeGreaterThanOrEqual(depth);
      expect(name.y + name.h, kind).toBeLessThanOrEqual(h);
      expect(name.x + name.w, kind).toBeLessThanOrEqual(w - depth);
    }
  });

  /**
   * Colours come off the MODEL, never off a table: a node's colours are
   * editable from the shape toolbar like any other shape's, and a glyph that
   * painted the pack's own ink would silently ignore the user's choice.
   */
  it('paints with the element’s own colours', () => {
    const { fills, strokes } = draw('note');
    expect(fills).toEqual([FILL]);
    expect(strokes).toEqual([STROKE, STROKE]);
  });

  /**
   * The glyph is drawn in the element-local frame captured BEFORE the shape
   * renderer mutates the matrix — rotate about the centre, draw, and never
   * compose on a frame that has already been rotated once.
   */
  it('draws in its own rotated frame', () => {
    const { w, h } = UML_NODE_BOX.class;
    const { transform } = draw('class', 30);
    expect(transform).toEqual([
      ['translate', w / 2, h / 2],
      ['rotate', 30],
      ['translate', -w / 2, -h / 2],
    ]);
  });

  /**
   * An element can be dragged to nothing: the resize manager sets no minimum
   * size, and every dimension here has the stroke width subtracted from it
   * first. `arc` throws `IndexSizeError` on a negative radius rather than
   * clamping, and the surface render loop wraps no renderer in a `try`, so one
   * such throw aborts the rest of the frame with an unbalanced save stack.
   */
  it('survives an element dragged smaller than its own border', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      expect(() => draw(kind, 0, { w: 1, h: 1 }), kind).not.toThrow();
    }
  });
});
