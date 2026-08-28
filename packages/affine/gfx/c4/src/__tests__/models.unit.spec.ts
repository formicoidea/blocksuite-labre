import { CanvasElementType } from '@labre/affine-block-surface';
import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  C4NodeElementModel,
  FrameworkBackgroundElementModel,
  ShapeElementModel,
} from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from '../background';

/**
 * The three element models — the RED ZONE half of this pack.
 *
 * `packages/affine/model` carries the document format, so what these assertions
 * are really about is compatibility: the persisted type strings a document
 * points at, the `kind` discriminant reading back what was written, and the one
 * OPTIONAL field of the pack staying `undefined` by default — which is what lets
 * it ship with no schema version bump and no migration (`@field()`'s `init`
 * writes nothing for an `undefined` default).
 *
 * Built detached rather than through a surface: a `@field()` accessor reads
 * `yMap` when the map has a doc and the element's preserved props otherwise, so
 * a bare object with those two is enough to exercise the real getter without a
 * workspace, a store or a Yjs document.
 */
function detached<T>(Ctor: new (...args: never[]) => T): T {
  const element = Object.create(Ctor.prototype) as Record<string, unknown>;
  element.yMap = { doc: null };
  element._preserved = new Map<string, unknown>();
  return element as unknown as T;
}

/** What a document would carry for this element — the props actually stored. */
const stored = (element: unknown) =>
  (element as { _preserved: Map<string, unknown> })._preserved;

describe('the C4 element models', () => {
  it('declares the three persisted types the declarations name', () => {
    expect(detached(C4NodeElementModel).type).toBe('c4Node');
    expect(detached(C4BoardElementModel).type).toBe('c4Board');
    expect(detached(C4BoundaryElementModel).type).toBe('c4Boundary');

    // The renderer, the interaction gating and the audit all key off these, so
    // the declarations must name the very same strings.
    expect(C4_BOARD_BACKGROUND.type).toBe(CanvasElementType.C4BOARD);
    expect(C4_BOUNDARY_BACKGROUND.type).toBe(CanvasElementType.C4BOUNDARY);
    expect(CanvasElementType.C4NODE).toBe('c4Node');
  });

  it('makes a node a native shape, anchored at its centre', () => {
    expect(C4NodeElementModel.prototype).toBeInstanceOf(ShapeElementModel);
    // Everything a shape can do — editable colours, inner text, native resize,
    // the shape toolbar — comes with that, for free.
    const node = detached(C4NodeElementModel);
    expect(node.centerAnchorOnly).toBe(true);
  });

  it('round-trips the node kind, and defaults to a software system', () => {
    const node = detached(C4NodeElementModel);
    expect(node.kind).toBe('system');
    // What a document carries reads straight back through the field.
    stored(node).set('kind', 'database');
    expect(node.kind).toBe('database');
  });

  it('makes both frames passive canvases with a name', () => {
    expect(C4BoardElementModel.prototype).toBeInstanceOf(
      FrameworkBackgroundElementModel
    );
    expect(C4BoundaryElementModel.prototype).toBeInstanceOf(
      FrameworkBackgroundElementModel
    );

    const frames = [
      detached(C4BoardElementModel),
      detached(C4BoundaryElementModel),
    ];
    for (const frame of frames) {
      // A connector must never snap to the sheet its nodes are drawn on.
      expect(frame.connectable).toBe(false);
      expect(frame.resizeEnabled).toBe(true);
      expect(frame.name).toBeTruthy();
      stored(frame).set('name', 'Internet banking');
      expect(frame.name).toBe('Internet banking');
    }
  });

  it('leaves the boundary variant absent, and writes nothing for it', () => {
    const boundary = detached(C4BoundaryElementModel);
    // Optional, `undefined`, and NOT in the stored props: a boundary that never
    // states its level stays byte-identical to one created before the field
    // existed — no schema bump, no migration, every document still opens.
    expect(boundary.variant).toBeUndefined();
    expect(stored(boundary).has('variant')).toBe(false);

    stored(boundary).set('variant', 'container');
    expect(boundary.variant).toBe('container');
  });
});
