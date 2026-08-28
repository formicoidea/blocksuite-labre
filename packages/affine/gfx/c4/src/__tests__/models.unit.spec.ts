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
  // The derived-value cache `x` / `y` / `w` / `h` memoise a deserialized `xywh`
  // into. Only the geometry assertions reach it, and only through the real
  // getters — which is the point of exercising them rather than a paraphrase.
  element._local = new Map<string, unknown>();
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

  /**
   * The PO's recette of 28/08/2026, seen from the document format.
   *
   * A C4 element's technology and its description were briefly two fields on
   * this model, edited in a "Details" popover. The recette rejected the
   * mechanism — an architect writes ON the picture — so both are canvas TEXT
   * elements grouped with the shape, and the model is back to the one field it
   * had. Asserted rather than left implicit because the absence is the point:
   * a second place to write the same sentence is a place for it to go stale, and
   * nothing may re-introduce one without this failing.
   *
   * `kind` is the whole schema, and it round-trips.
   */
  it('carries the node kind and nothing else, and defaults to a software system', () => {
    const node = detached(C4NodeElementModel);
    expect(node.kind).toBe('system');
    // What a document carries reads straight back through the field.
    stored(node).set('kind', 'database');
    expect(node.kind).toBe('database');

    // The two tiers are elements, not fields. No accessor, and nothing a
    // document could carry for them.
    const carrier = node as unknown as Record<string, unknown>;
    expect('technology' in carrier).toBe(false);
    expect('description' in carrier).toBe(false);
    expect(stored(node).has('technology')).toBe(false);
    expect(stored(node).has('description')).toBe(false);
  });

  /**
   * The PO's SECOND change request, at its root.
   *
   * `rect.includesPoint` skips the interior test for an unfilled shape and falls
   * back to the stroke plus the tight box of the text run — which is what made
   * a person, a database, a phone and a browser window (all created unfilled,
   * their body drawn by the glyph) undraggable, unselectable and, most visibly,
   * impossible to double-click into their own text editor anywhere but on the
   * few characters of their label.
   *
   * The override says the one thing true of every C4 artefact: it is a box, and
   * its whole area belongs to it. Asserted through the REAL geometry rather than
   * by comparing method identities, because what broke was a point test.
   */
  it('is hit anywhere inside it, filled or not', () => {
    const node = detached(C4NodeElementModel);
    stored(node).set('xywh', '[0,0,200,100]');
    stored(node).set('shapeType', 'rect');
    stored(node).set('filled', false);

    const options = { hitThreshold: 1, zoom: 1 };
    // Well inside the body, far from every edge — and deliberately OUTSIDE the
    // small central area an unfilled, untitled shape falls back to, which is the
    // part of the box that was already hittable and would prove nothing.
    expect(node.includesPoint(40, 25, options)).toBe(true);

    // …and a plain unfilled shape is NOT hit there, which is exactly the
    // behaviour the override changes and the bug the PO could see.
    const plain = detached(ShapeElementModel);
    stored(plain).set('xywh', '[0,0,200,100]');
    stored(plain).set('shapeType', 'rect');
    stored(plain).set('filled', false);
    expect(plain.includesPoint(40, 25, options)).toBe(false);

    // Outside is still outside: the override widens the target, it does not
    // remove it.
    expect(node.includesPoint(400, 50, options)).toBe(false);
  });

  /**
   * The LEVEL slice's one model change, seen from the document format.
   *
   * Same shape and same promise as the boundary's `variant` below: optional,
   * `undefined` by default, and therefore absent from what a document carries.
   * Every C4 board ever saved stays byte-identical, and the two rules that read
   * the field evaluate nothing on one — which is what makes the whole slice
   * additive with no schema bump and no migration.
   *
   * And, unlike `variant`, there is NO derived default to read: a board that
   * says nothing is a free sketch, not a context diagram we guessed at.
   */
  it('leaves the board level absent, and writes nothing for it', () => {
    const board = detached(C4BoardElementModel);
    expect(board.level).toBeUndefined();
    expect(stored(board).has('level')).toBe(false);

    stored(board).set('level', 'container');
    expect(board.level).toBe('container');

    // No `levelOrDefault`, deliberately — the absence is a value, and reading
    // one would hand every diagram already on disk a level nobody chose.
    expect('levelOrDefault' in (board as unknown as object)).toBe(false);
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

  /**
   * …and the derived reading of it, which is what the declaration gates its
   * bracket line on.
   *
   * A raw optional `variant` cannot be a `variantProp`: an unstated one
   * stringifies to `"undefined"`, matches no declared variant, and the label
   * would be painted on NO boundary already on disk. Reading the documented
   * default here is what lets the frame write `[Software System]` under a name
   * the author never told it anything about.
   */
  it('reads an unstated boundary level as a system, without storing one', () => {
    const boundary = detached(C4BoundaryElementModel);
    expect(boundary.variantOrDefault).toBe('system');
    // Derived, so asking the question wrote nothing.
    expect(stored(boundary).has('variant')).toBe(false);

    stored(boundary).set('variant', 'container');
    expect(boundary.variantOrDefault).toBe('container');
  });
});
