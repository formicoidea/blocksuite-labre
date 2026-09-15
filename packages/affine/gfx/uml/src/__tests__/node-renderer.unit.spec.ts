import type { UmlNodeElementModel, UmlNodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UML_ACTOR_FIGURE,
  UML_CUBE_DEPTH,
  UML_PACKAGE_TAB,
  UML_SIGNAL_POINT,
  umlCompartmentBoxes,
  umlStackHeight,
} from '../component.js';
import {
  UML_LIFELINE_DASH,
  UML_LIFELINE_HEAD,
  UML_NODE_BOX,
} from '../consts.js';
import { umlNode } from '../node/node-renderer.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';
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
  'action',
  'initial',
  'activity-final',
  'flow-final',
  'decision',
  'fork',
  'object-node',
  'send-signal',
  'accept-event',
  'time-event',
  'state',
  'final-state',
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  'lifeline',
  'execution',
  'destruction',
] as const satisfies readonly UmlNodeKind[];

/**
 * The kinds the SHAPE LAYER draws whole, with nothing painted over them: the
 * native ellipse of §18.1.4, the native rounded rects of §15.3.4 and §14.2.4
 * (`action`; a `state`'s BODY, though its compartment rule is this layer's), the
 * native diamonds of §15.3.4 and §14.2.4, and the plain native rect of §15.4.4.
 */
const NO_GLYPH_KINDS = [
  'use-case',
  'action',
  'object-node',
  'decision',
  'choice',
  // §17.2.4's ExecutionSpecification: a thin FILLED rectangle on a lifeline's
  // spine, which is a native rect and nothing more.
  'execution',
] as const satisfies readonly UmlNodeKind[];

/** Half the stroke width — the inset every body is drawn inside. */
const INSET = 1;

describe('the UML node glyph layer', () => {
  /**
   * Six kinds have nothing drawn on them, and every one of them because the
   * SHAPE LAYER already draws the whole figure: the ellipse of §18.1.4, the
   * rounded rect of §15.3.4, the diamond, the plain rect of §15.4.4, and
   * §17.2.4's execution bar. Anything painted over one of them would be
   * inventing a notation. Every other kind gets a mark.
   *
   * A `state` is NOT among them although its body is a native rounded rect:
   * §14.2.4 rules it off between its name and its internal activities, and that
   * rule is this layer's.
   */
  it('draws something on thirty-two kinds, and nothing on the six the shape layer finishes', () => {
    const bare = new Set<UmlNodeKind>(NO_GLYPH_KINDS);
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { ops } = draw(kind);
      if (bare.has(kind)) expect(ops, kind).toEqual([]);
      else expect(ops.length, kind).toBeGreaterThan(0);
    }
    expect(ALL_KINDS.length - bare.size).toBe(32);
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
    // The cup is the BOTTOM half of the circle (0 → π), opening upward, so its
    // deepest point is where the stub below starts: the line meets the back of
    // the cup, not a horn (§10.4.4, the ball nests in the socket).
    expect(required.curves[0].start).toBe(0);
    expect(required.curves[0].end).toBe(Math.PI);
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

  /* ── The activity marks (§15.3.4, §16.3.4, §16.10.4) ──────────────────── */

  /**
   * §15.3.4: a flow begins at a FILLED disc. Ink-filled and not paper-filled,
   * which is the whole of what makes it read as a start rather than as an entry
   * point — and the ink is the MODEL's, so recolouring the node recolours it.
   */
  it('strikes the initial node as one ink-filled disc', () => {
    const { w, h } = UML_NODE_BOX.initial;
    const { ops, curves, fills } = draw('initial');
    expect(ops).toEqual(['fill', 'stroke']);
    expect(curves).toHaveLength(1);
    expect(curves[0].rx).toBe(curves[0].ry);
    expect(curves[0].x).toBe(w / 2);
    expect(curves[0].y).toBe(h / 2);
    // The element's STROKE colour, used as a fill: a solid mark is drawn in the
    // ink, and the paper is put back afterwards.
    expect(fills).toEqual([STROKE]);
  });

  /**
   * §15.3.4 and §14.2.4 draw the SAME bullseye for an activity final and a
   * final state — a ring with a solid bull in it. Two roles, one picture, and
   * the picture must not diverge: a reader who saw two proportions would look
   * for a meaning in the difference.
   */
  it.each(['activity-final', 'final-state'] as const)(
    'draws %s as a ring with an ink bull, rim first',
    kind => {
      const { w, h } = UML_NODE_BOX[kind];
      const { ops, curves, fills } = draw(kind);
      // Rim (paper, then outline), then bull (ink, then outline).
      expect(ops, kind).toEqual(['fill', 'stroke', 'fill', 'stroke']);
      expect(curves, kind).toHaveLength(2);
      const [rim, bull] = curves;
      expect(rim.x, kind).toBe(w / 2);
      expect(rim.y, kind).toBe(h / 2);
      expect(bull.x, kind).toBe(rim.x);
      expect(bull.rx, kind).toBeLessThan(rim.rx);
      // A moat between them: the bull is a touch over half the rim.
      expect(bull.rx / rim.rx, kind).toBeLessThan(0.7);
      expect(fills, kind).toEqual([FILL, STROKE]);
    }
  );

  it('draws the same bullseye for an activity final and a final state', () => {
    // Same footprint and same proportions — the two are one drawing.
    expect(UML_NODE_BOX['final-state']).toEqual(UML_NODE_BOX['activity-final']);
    const activity = draw('activity-final').curves.map(c => c.rx);
    rec = recordingCtx();
    const state = draw('final-state').curves.map(c => c.rx);
    expect(state).toEqual(activity);
  });

  /** §15.3.4: a flow final stops ONE flow — a circle with an X inside it. */
  it('draws the flow final as a circle with a cross in it', () => {
    const { w, h } = UML_NODE_BOX['flow-final'];
    const { ops, curves, segments } = draw('flow-final');
    expect(ops).toEqual(['fill', 'stroke', 'stroke', 'stroke']);
    expect(curves).toHaveLength(1);
    // Two strokes, crossing at the centre and inside the rim.
    expect(segments).toHaveLength(2);
    for (const arm of segments) {
      expect((arm.x1 + arm.x2) / 2).toBeCloseTo(w / 2);
      expect((arm.y1 + arm.y2) / 2).toBeCloseTo(h / 2);
      expect(Math.abs(arm.x2 - arm.x1) / 2).toBeLessThan(curves[0].rx);
    }
  });

  /**
   * §15.3.4: a fork and a join are the same BAR, told apart by how many edges
   * run in and out of it — so there is one drawing, and it is the whole
   * element: a bar dragged longer is how an author fits more flows onto it.
   */
  it('fills the fork bar edge to edge, in ink', () => {
    const { w, h } = UML_NODE_BOX.fork;
    const { ops, segments, fills } = draw('fork');
    expect(ops).toEqual(['fill', 'stroke']);
    expect(fills).toEqual([STROKE]);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({
      x1: INSET,
      y1: INSET,
      x2: w - INSET,
      y2: INSET,
    });
    // Degenerate in one dimension on purpose: §15.3.4 draws a line segment.
    expect(h).toBeLessThan(w / 4);
  });

  /**
   * §16.3.4: the two pentagons are the same shape TURNED — a tip that sticks
   * out to the right for a signal leaving, a notch that bites in from the left
   * for one arriving. Both drawn from the number `component.ts` pulls the label
   * back by, so a name can never run out through the point.
   */
  it('points the send signal right and notches the accept event on the left', () => {
    const { w, h } = UML_NODE_BOX['send-signal'];
    const point = w * UML_SIGNAL_POINT;

    const send = draw('send-signal');
    expect(send.ops).toEqual(['fill', 'stroke']);
    // Five vertices, so four recorded runs (the closing edge is `closePath`),
    // and the tip is the only thing reaching the right edge.
    expect(send.segments).toHaveLength(4);
    const tip = send.segments.find(s => s.x2 === w - INSET);
    expect(tip).toBeDefined();
    expect(tip!.y2).toBeCloseTo(h / 2);
    expect(tip!.x1).toBeCloseTo(w - INSET - point);

    rec = recordingCtx();
    const accept = draw('accept-event');
    expect(accept.ops).toEqual(['fill', 'stroke']);
    expect(accept.segments).toHaveLength(4);
    // The notch: a vertex on the LEFT, one point deep, halfway down.
    const notch = accept.segments.find(s => s.x2 === INSET + point);
    expect(notch).toBeDefined();
    expect(notch!.y2).toBeCloseTo(h / 2);
  });

  /**
   * §16.10.4: the hourglass. Two closed triangles meeting at a point rather
   * than one crossed path, because a single bow-tie fills by the even-odd rule
   * on some canvases and by the non-zero rule on others — and an hourglass that
   * is sometimes hollow is not a notation.
   */
  it('draws the time event as two triangles meeting at a waist', () => {
    const { w, h } = UML_NODE_BOX['time-event'];
    const { ops, segments } = draw('time-event');
    expect(ops).toEqual(['fill', 'stroke', 'fill', 'stroke']);
    // Three vertices each, so two recorded runs per triangle (the closing edge
    // is `closePath`).
    expect(segments).toHaveLength(4);
    // Both triangles touch the centre of the box — the waist they meet at.
    const waist = segments.filter(
      s =>
        (Math.abs(s.x2 - w / 2) < 0.001 && Math.abs(s.y2 - h / 2) < 0.001) ||
        (Math.abs(s.x1 - w / 2) < 0.001 && Math.abs(s.y1 - h / 2) < 0.001)
    );
    expect(waist).toHaveLength(2);
    // Tall and narrow, which is what an hourglass is.
    expect(h).toBeGreaterThan(w);
  });

  /* ── The state machine marks (§14.2.4) ────────────────────────────────── */

  /**
   * §14.2.4: a state is the native ROUNDED rect with one rule across it,
   * between its name and its internal activities — the object's own layout,
   * read from `umlCompartmentBoxes` so the rule sits exactly where the tiers
   * meet.
   */
  it('rules a state once, between its name and its behaviour', () => {
    const { w, h } = UML_NODE_BOX.state;
    const { splits } = umlCompartmentBoxes('state', 0, 0, w, h);
    expect(splits).toHaveLength(1);

    const { ops, segments } = draw('state');
    expect(ops).toEqual(['stroke']);
    expect(segments).toEqual([
      { x1: INSET, y1: splits[0], x2: w - INSET, y2: splits[0] },
    ]);
  });

  /** §14.2.4: a junction is the plainest mark in the pack — a small ink dot. */
  it('draws the junction as one small ink dot', () => {
    const { ops, curves, fills } = draw('junction');
    expect(ops).toEqual(['fill', 'stroke']);
    expect(curves).toHaveLength(1);
    expect(fills).toEqual([STROKE]);
    // Smaller than the initial disc it would otherwise be mistaken for.
    expect(UML_NODE_BOX.junction.w).toBeLessThan(UML_NODE_BOX.initial.w);
  });

  /**
   * §14.2.4: the two histories are a circle with a LETTER in it — `H` for
   * shallow, `H*` for deep, and the star is the entire difference on the page.
   */
  it('writes H in a shallow history and H* in a deep one', () => {
    const { w, h } = UML_NODE_BOX['shallow-history'];

    const shallow = draw('shallow-history');
    expect(shallow.ops).toEqual(['fill', 'stroke', 'fillText']);
    expect(shallow.curves).toHaveLength(1);
    expect(shallow.texts).toHaveLength(1);
    expect(shallow.texts[0].text).toBe('H');
    // Centred in the circle, in the element's ink.
    expect(shallow.texts[0].x).toBeCloseTo(w / 2);
    expect(shallow.texts[0].y).toBeCloseTo(h / 2);
    expect(shallow.texts[0].align).toBe('center');
    expect(shallow.texts[0].baseline).toBe('middle');
    expect(shallow.texts[0].color).toBe(STROKE);

    rec = recordingCtx();
    const deep = draw('deep-history');
    expect(deep.texts[0].text).toBe('H*');
  });

  /**
   * §14.2.4: an entry point is a hollow circle — a door — and an exit point the
   * same circle with a cross in it. A FILLED entry point would read as an
   * initial node, which is the mistake this pins.
   */
  it('leaves the entry point hollow and crosses the exit point', () => {
    const entry = draw('entry-point');
    expect(entry.ops).toEqual(['fill', 'stroke']);
    expect(entry.curves).toHaveLength(1);
    // The element's PAPER, never its ink: that is what makes it a door.
    expect(entry.fills).toEqual([FILL]);
    expect(entry.segments).toEqual([]);

    rec = recordingCtx();
    const exit = draw('exit-point');
    expect(exit.ops).toEqual(['fill', 'stroke', 'stroke', 'stroke']);
    expect(exit.curves).toHaveLength(1);
    expect(exit.fills).toEqual([FILL]);
    expect(exit.segments).toHaveLength(2);
  });

  /**
   * §14.2.4: a terminate is two crossed strokes and NOTHING else — no rim, no
   * box. A circle round them would make it an exit point.
   */
  it('draws the terminate as a bare X, corner to corner', () => {
    const { w, h } = UML_NODE_BOX.terminate;
    const { ops, curves, segments } = draw('terminate');
    expect(ops).toEqual(['stroke', 'stroke']);
    expect(curves).toEqual([]);
    expect(segments).toEqual([
      { x1: INSET, y1: INSET, x2: w - INSET, y2: h - INSET },
      { x1: w - INSET, y1: INSET, x2: INSET, y2: h - INSET },
    ]);
  });

  /**
   * Every solid mark puts the paper back when it is done.
   *
   * The one thing a fill swap can get wrong, and it shows up two shapes away
   * from its cause: a glyph that left `fillStyle` on the ink would paint the
   * next element's body black. Asserted on the bullseye, which is the only
   * glyph that draws a paper mark AFTER an ink one.
   */
  it('restores the paper after painting an ink mark', () => {
    const { fills } = draw('activity-final');
    expect(fills).toEqual([FILL, STROKE]);
    // …and a second draw on the same context starts from paper again.
    rec = recordingCtx();
    expect(draw('entry-point').fills).toEqual([FILL]);
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

/* ── Where the separators go once the tiers have moved ─────────────────── */

/**
 * `UmlCompartmentWatcher` grows a classifier whose attributes tier has
 * overflowed and moves the three texts to the boxes the taller stack yields. A
 * renderer still ruling the DEFAULT three-line stack would then draw its second
 * line straight through the fourth attribute — which is what this half of the
 * feature exists to prevent, and what these cases pin.
 *
 * The separators are read off the body tier's own box rather than recomputed
 * from a line count: cheaper (no `Y.Text` materialized per frame) and impossible
 * to disagree with, since a separator IS the boundary between two compartments.
 */
describe('the separators, read off the tiers', () => {
  /** A group whose children are the shape and the tier boxes given. */
  function grouped(
    kind: UmlNodeKind,
    tiers: { role: string; x: number; y: number; w: number; h: number }[]
  ) {
    const childElements = [
      { id: 'shape', role: UML_ROLE_OF_KIND[kind] },
      ...tiers.map((tier, index) => ({ id: `tier-${index}`, ...tier })),
    ];
    return {
      id: 'group',
      childIds: childElements.map(child => child.id),
      childElements,
    };
  }

  /** Draw one node that belongs to `group`, and hand back what was recorded. */
  function drawGrouped(
    kind: UmlNodeKind,
    size: { w: number; h: number },
    group: ReturnType<typeof grouped>,
    rotate = 0
  ) {
    const recorder = recordingCtx();
    const model = {
      ...nodeModel(kind, rotate, size),
      id: 'shape',
      group,
    } as unknown as UmlNodeElementModel;
    umlNode(
      model,
      recorder.ctx,
      stubMatrix(),
      rendererStub,
      null as never,
      null as never
    );
    return recorder;
  }

  /** The tier boxes a stack of `lines` attributes puts on a `height` box. */
  const tiersFor = (
    kind: UmlNodeKind,
    size: { w: number; h: number },
    lines: number
  ) => {
    const boxes = umlCompartmentBoxes(kind, 0, 0, size.w, size.h, {
      attributes: lines,
    });
    return [
      { role: UML_ROLE.name, ...boxes.name },
      { role: UML_ROLE.attributes, ...boxes.attributes! },
      { role: UML_ROLE.operations, ...boxes.operations! },
    ];
  };

  it('rules a grown classifier where its compartments now are', () => {
    // The box the watcher would leave behind for five attribute lines, and the
    // tiers it would leave in it.
    const size = { w: 200, h: umlStackHeight('class', { attributes: 5 })! };
    const tiers = tiersFor('class', size, 5);
    const { segments } = drawGrouped('class', size, grouped('class', tiers));

    const grown = umlCompartmentBoxes('class', 0, 0, size.w, size.h, {
      attributes: 5,
    });
    expect(segments).toEqual(
      grown.splits.map(y => ({ x1: INSET, y1: y, x2: size.w - INSET, y2: y }))
    );
    // …and emphatically NOT where the default three-line stack would put them.
    const stencil = umlCompartmentBoxes('class', 0, 0, size.w, size.h);
    expect(grown.splits[1]).not.toBe(stencil.splits[1]);
  });

  it('falls back to the default stack for a shape with no group', () => {
    const size = UML_NODE_BOX.class;
    const { splits } = umlCompartmentBoxes('class', 0, 0, size.w, size.h);
    expect(draw('class').segments).toEqual(
      splits.map(y => ({ x1: INSET, y1: y, x2: size.w - INSET, y2: y }))
    );
  });

  /**
   * ponytail's documented ceiling: the tiers are read in the node's own
   * UNROTATED frame, so a shape somebody rotated out of its group is ruled from
   * the default stack rather than from boxes that no longer line up with it.
   */
  it('falls back to the default stack on a rotated shape', () => {
    const size = { w: 200, h: umlStackHeight('class', { attributes: 5 })! };
    const tiers = tiersFor('class', size, 5);
    const { segments } = drawGrouped(
      'class',
      size,
      grouped('class', tiers),
      30
    );
    const { splits } = umlCompartmentBoxes('class', 0, 0, size.w, size.h);
    expect(segments.map(segment => segment.y1)).toEqual(splits);
  });

  /**
   * §9.8.4 gives an instance ONE separator, whatever its tiers say: how many
   * lines the notation draws is the kind's answer, and only where they go is the
   * tiers'.
   */
  it('keeps the notation in charge of how MANY lines are drawn', () => {
    const size = UML_NODE_BOX.object;
    const boxes = umlCompartmentBoxes('object', 0, 0, size.w, size.h, {
      name: 2,
    });
    const tiers = [
      { role: UML_ROLE.name, ...boxes.name },
      { role: UML_ROLE.attributes, ...boxes.attributes! },
    ];
    const { segments } = drawGrouped('object', size, grouped('object', tiers));

    // One split and one underline — never two splits.
    expect(segments).toHaveLength(2);
    expect(segments[0].y1).toBe(boxes.attributes!.y);
    // …and the underline follows the two-line name down, rather than sitting
    // where a one-line name used to end.
    expect(segments[1].y1).toBe(boxes.name.y + boxes.name.h);
  });
});

/**
 * The three interaction marks of phase 3 (§17.2.4, §17.3.4).
 *
 * The lifeline is the one glyph in the pack drawn OUTSIDE the element it
 * belongs to, so these assertions are about the two things that makes true:
 * where the head lands relative to a 16-unit column, and that the spine below it
 * is dashed.
 */
describe('the interaction marks', () => {
  /**
   * §17.3.4: a named head over a dashed spine. The head is 160 wide against a
   * 16-wide element, centred on it and flush with its top — so it overhangs by
   * 72 units on each side, which is exactly what the model's own
   * `elementBound` and `includesPoint` overrides exist to account for.
   */
  it('draws the lifeline head centred on the column and flush with its top', () => {
    const { w } = UML_NODE_BOX.lifeline;
    const { segments, ops } = draw('lifeline');

    const left = (w - UML_LIFELINE_HEAD.w) / 2;
    const right = left + UML_LIFELINE_HEAD.w;
    const bottom = UML_LIFELINE_HEAD.h;

    // The head, as a body: fill then stroke, which is what keeps an unfilled,
    // unstroked native rect from showing through (`presets.ts`).
    expect(ops.slice(0, 2)).toEqual(['fill', 'stroke']);
    // Three segments make the rect — the fourth side is `closePath`.
    expect(segments.slice(0, 3)).toEqual([
      { x1: left, y1: 0, x2: right, y2: 0 },
      { x1: right, y1: 0, x2: right, y2: bottom },
      { x1: right, y1: bottom, x2: left, y2: bottom },
    ]);
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(w);
  });

  /**
   * …and the spine: down the column's CENTRE, from the head's bottom edge to
   * the bottom of the element, dashed. The dash is the whole notation — an
   * unbroken line would read as a relationship rather than as the passage of
   * time.
   */
  it('drops a dashed spine down the column centre', () => {
    const { w, h } = UML_NODE_BOX.lifeline;
    const { segments, dashes } = draw('lifeline');

    expect(segments.at(-1)).toEqual({
      x1: w / 2,
      y1: UML_LIFELINE_HEAD.h,
      x2: w / 2,
      y2: h,
    });
    expect(dashes).toEqual([[...UML_LIFELINE_DASH]]);
  });

  /**
   * The spine's dash belongs to the SPINE and to nothing after it: a glyph that
   * left a pattern set would dash the next element the renderer paints.
   */
  it('puts the dash pattern back after the spine', () => {
    const { ctx, dashes } = draw('lifeline');
    expect(dashes).toHaveLength(1);
    expect(ctx.getLineDash()).toEqual([]);
  });

  /**
   * A lifeline dragged SHORTER than its own head keeps a head, cut down to what
   * there is — the degenerate case the model's hit test clamps too — and drops
   * the spine rather than drawing one upward.
   */
  it('clamps the head to a column shorter than it, and draws no spine', () => {
    const { segments } = draw('lifeline', 0, { w: 16, h: 30 });
    expect(segments).toHaveLength(3);
    expect(segments[1]).toMatchObject({ y1: 0, y2: 30 });
  });

  /**
   * §17.2.4: the destruction X — two crossing strokes and nothing else. Drawn
   * at 45°, centred, so the arms reach the corners of the square the mark is.
   */
  it('draws the destruction as two crossing strokes and no body', () => {
    const { w, h } = UML_NODE_BOX.destruction;
    const { segments, ops } = draw('destruction');

    expect(ops).toEqual(['stroke', 'stroke']);
    expect(segments).toHaveLength(2);

    const [cx, cy] = [w / 2, h / 2];
    for (const segment of segments) {
      // Both diagonals are centred on the mark…
      expect((segment.x1 + segment.x2) / 2).toBeCloseTo(cx);
      expect((segment.y1 + segment.y2) / 2).toBeCloseTo(cy);
      // …and both are diagonal, which is what makes the pair an X and not a
      // plus sign.
      expect(Math.abs(segment.x2 - segment.x1)).toBeCloseTo(
        Math.abs(segment.y2 - segment.y1)
      );
    }
    // The two run in opposite directions: one down-right, one down-left.
    expect(
      Math.sign(segments[0].x2 - segments[0].x1) *
        Math.sign(segments[1].x2 - segments[1].x1)
    ).toBe(-1);
  });

  /**
   * §17.2.4 draws an ExecutionSpecification as a thin filled rectangle, which
   * IS a native rect: the glyph layer paints nothing over it, exactly as it
   * paints nothing over an action or an object node.
   */
  it('leaves the execution bar entirely to the shape layer', () => {
    expect(draw('execution').ops).toEqual([]);
  });
});
