import type { BpmnNodeElementModel, BpmnNodeKind } from '@labre/affine-model';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NODE_SIZE } from '../consts';
import { bpmnNode } from '../node/node-renderer';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The native shape body is somebody else's renderer (and its own tests): what
 * this file is about is the GLYPH layer on top of it — the markers that are the
 * only thing telling a message start from a plain one, a user task from a
 * service one, a data object from a rectangle.
 *
 * So `shape` is stubbed to a no-op and every operation the recorder sees is one
 * this renderer made. The assertions are about WHAT was drawn — how many
 * straight runs, how many round ones, whether anything was filled and in which
 * of the model's two (editable) colours — rather than about coordinates, which
 * are a matter of taste and would make every nudge to a glyph a test failure.
 * The one thing asserted per kind is what makes it recognisable: a clock has a
 * rim, a terminate end is solid, an annotation is not closed.
 */

vi.mock('@labre/affine-gfx-shape', () => ({ shape: vi.fn() }));

const STROKE = '#262626';
const FILL = '#ffffff';

/** The model fields the glyph layer reads, and nothing else. */
function nodeModel(
  kind: BpmnNodeKind,
  rotate = 0,
  size: { w: number; h: number } = NODE_SIZE[kind]
): BpmnNodeElementModel {
  return {
    kind,
    rotate,
    deserializedXYWH: [0, 0, size.w, size.h],
    strokeColor: STROKE,
    fillColor: FILL,
    strokeWidth: 2,
  } as unknown as BpmnNodeElementModel;
}

/** A canvas renderer, reduced to the one method the glyph layer calls. */
const rendererStub = {
  getColorValue: (color: string) => color,
} as unknown as Parameters<typeof bpmnNode>[3];

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
function draw(kind: BpmnNodeKind, rotate = 0, size?: { w: number; h: number }) {
  bpmnNode(
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
  'startEvent',
  'startEventMessage',
  'startEventTimer',
  'endEvent',
  'endEventMessage',
  'endEventTerminate',
  'task',
  'taskUser',
  'taskService',
  'subProcess',
  'callActivity',
  'gatewayExclusive',
  'gatewayParallel',
  'dataObject',
  'dataStore',
  'textAnnotation',
  'group',
] as const satisfies readonly BpmnNodeKind[];

/**
 * The kinds this renderer must not touch — a plain shape and nothing on it.
 *
 * `group` is here for a different reason from the other three. They carry no
 * marker in the notation at all; the group has a distinctive look — dashed,
 * rounded, unfilled — but every part of it is a native shape property, so the
 * glyph layer has nothing left to add. A stroke drawn here would be one the
 * shape toolbar could not edit.
 */
const UNDECORATED = ['startEvent', 'endEvent', 'task', 'group'] as const;

describe('the BPMN node glyph layer', () => {
  it('draws on every decorated kind and on no other', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { segments, curves, ops } = draw(kind);
      const drewSomething = segments.length + curves.length > 0;
      const expected = !(UNDECORATED as readonly string[]).includes(kind);
      expect(drewSomething, kind).toBe(expected);
      // An undecorated kind must not even touch the transform: it returns
      // before the glyph frame is set up.
      if (!expected) expect(ops, kind).toHaveLength(0);
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
   * invariant and not a paraphrase of it. `1x1` is the case that used to fail:
   * the data store's radii subtract the stroke width first, and a 2-unit stroke
   * on a 1-unit box is -0.5.
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
        expect(() => draw(kind, 0, size), where).not.toThrow();
        for (const curve of rec.curves) {
          expect(curve.rx, where).toBeGreaterThanOrEqual(0);
          expect(curve.ry, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('draws every glyph in the node’s own stroke colour', () => {
    for (const kind of ALL_KINDS) {
      rec = recordingCtx();
      const { strokes } = draw(kind);
      for (const stroke of strokes) expect(stroke, kind).toBe(STROKE);
    }
  });

  it('sets up the element-local frame, rotation included', () => {
    const { transform } = draw('gatewayParallel', 45);
    const { w, h } = NODE_SIZE.gatewayParallel;
    expect(transform).toEqual([
      ['translate', w / 2, h / 2],
      ['rotate', 45],
      ['translate', -w / 2, -h / 2],
    ]);
  });

  it('marks the two gateways with two crossing strokes each', () => {
    // The X and the `+` are the same two strokes turned 45°, which is exactly
    // why the marker must never be what a rule reads.
    for (const kind of ['gatewayExclusive', 'gatewayParallel'] as const) {
      rec = recordingCtx();
      const { segments, curves } = draw(kind);
      expect(segments, kind).toHaveLength(2);
      expect(curves, kind).toHaveLength(0);
    }
    // ...and they are not the SAME two strokes: the X is diagonal, the `+` is
    // axis-aligned.
    rec = recordingCtx();
    const x = draw('gatewayExclusive').segments.map(s => s.y1 !== s.y2);
    rec = recordingCtx();
    const plus = draw('gatewayParallel').segments.map(s => s.y1 !== s.y2);
    expect(x).toEqual([true, true]);
    expect(plus).toEqual([false, true]);
  });

  it('puts an envelope in both message events and nothing round', () => {
    for (const kind of ['startEventMessage', 'endEventMessage'] as const) {
      rec = recordingCtx();
      const { segments, curves, fills } = draw(kind);
      // Four sides and a two-stroke flap.
      expect(segments, kind).toHaveLength(6);
      expect(curves, kind).toHaveLength(0);
      // The spec fills the END event's envelope solid; both are hollow here and
      // the ring weight carries the distinction instead (see the renderer's
      // own note on the simplification).
      expect(fills, kind).toHaveLength(0);
    }
  });

  it('gives the timer start a rim and two hands', () => {
    const { segments, curves } = draw('startEventTimer');
    expect(curves).toHaveLength(1);
    const { w } = NODE_SIZE.startEventTimer;
    expect(curves[0].x).toBe(w / 2);
    expect(curves[0].rx).toBe(curves[0].ry);
    expect(segments).toHaveLength(2);
  });

  it('makes the terminate end solid, in the stroke colour', () => {
    const { curves, fills, ops } = draw('endEventTerminate');
    expect(curves).toHaveLength(1);
    // Filled, not outlined: nothing else in the process runs after this.
    expect(fills).toEqual([STROKE]);
    expect(ops).toEqual(['fill']);
  });

  it('marks the user task with a person and the service task with a gear', () => {
    const user = draw('taskUser');
    // A head and a pair of shoulders, and no straight line anywhere.
    expect(user.curves).toHaveLength(2);
    expect(user.segments).toHaveLength(0);

    rec = recordingCtx();
    const service = draw('taskService');
    // Body, hub and eight teeth.
    expect(service.curves).toHaveLength(2);
    expect(service.segments).toHaveLength(8);

    // Both markers sit in the same top-left corner box, so a column of tasks
    // reads as a column of markers.
    const { w, h } = NODE_SIZE.taskUser;
    for (const curve of [...user.curves, ...service.curves]) {
      expect(curve.x).toBeLessThan(w / 4);
      expect(curve.y).toBeLessThan(h / 2);
    }
  });

  it('gives the sub-process and the call activity the identical boxed +', () => {
    const sub = draw('subProcess');
    rec = recordingCtx();
    const call = draw('callActivity');
    // Four sides of the marker box, plus the two strokes of the `+`.
    expect(sub.segments).toHaveLength(6);
    expect(call.segments).toEqual(sub.segments);
    // On the bottom edge, horizontally centred — where a collapsed marker goes.
    const { w, h } = NODE_SIZE.subProcess;
    for (const s of sub.segments) {
      expect(s.y1).toBeGreaterThan(h / 2);
      expect(Math.abs(s.x1 - w / 2)).toBeLessThan(w / 4);
    }
  });

  it('draws the data object as a filled page with its corner turned down', () => {
    const { segments, fills, ops } = draw('dataObject');
    // Five sides of the page — the folded corner makes it five, not four —
    // plus the two strokes of the fold itself.
    expect(segments).toHaveLength(7);
    // The BODY is the glyph's, not the native rect's: it fills in the model's
    // own fill colour and outlines in its stroke colour, so both stay editable.
    expect(fills).toEqual([FILL]);
    expect(ops).toEqual(['fill', 'stroke', 'stroke']);
  });

  it('draws the data store as a filled cylinder with a visible lid', () => {
    const { curves, fills } = draw('dataStore');
    // Floor, front of the lid, and the lid's own far edge.
    expect(curves).toHaveLength(3);
    for (const curve of curves) expect(curve.rx).toBeGreaterThan(curve.ry);
    expect(fills).toEqual([FILL]);
  });

  it('leaves the text annotation open, and unfilled', () => {
    const { segments, fills } = draw('textAnnotation');
    // Three sides of a bracket: a note is attached to the picture, not framed
    // in it, and the missing fourth side is what says so.
    expect(segments).toHaveLength(3);
    expect(fills).toHaveLength(0);
    // All of it on the leading edge.
    const { w } = NODE_SIZE.textAnnotation;
    for (const s of segments) {
      expect(Math.max(s.x1, s.x2)).toBeLessThan(w / 2);
    }
  });
});
