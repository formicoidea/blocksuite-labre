import { describe, expect, it } from 'vitest';

import {
  FrameworkBackgroundElementModel,
  ShapeElementModel,
  UML_DIAGRAM_KIND_TAG,
  UML_FRAME_BAND_HEIGHT,
  UmlDiagramElementModel,
  type UmlDiagramKind,
  UmlNodeElementModel,
  UmlSubjectElementModel,
} from '../index.js';

/**
 * The three UML element models — the RED ZONE half of the pack.
 *
 * `packages/affine/model` carries the document format, so what these assertions
 * are really about is compatibility: the persisted type strings a document
 * points at, the two `kind` discriminants reading back what was written, and
 * the heading staying DERIVED — computed from `kind` and `name`, never stored,
 * so a rename edits one field and a kind this build has never heard of still
 * shows on the sheet.
 *
 * Built detached rather than through a surface: a `@field()` accessor reads
 * `yMap` when the map has a doc and the element's preserved props otherwise, so
 * a bare object with those two is enough to exercise the real getters — and the
 * real `includesPoint` — without a workspace, a store or a Yjs document. Same
 * harness the C4 model spec and the framework-background hit-test spec use.
 */
function detached<T>(
  Ctor: new (...args: never[]) => T,
  props: Record<string, unknown> = {}
): T {
  const element = Object.create(Ctor.prototype) as Record<string, unknown>;
  element.yMap = { doc: null };
  element._preserved = new Map<string, unknown>(Object.entries(props));
  // The cache the derived `x` / `y` / `w` / `h` getters memoise into.
  element._local = new Map<string, unknown>();
  return element as unknown as T;
}

/** What a document would carry for this element — the props actually stored. */
const stored = (element: unknown) =>
  (element as { _preserved: Map<string, unknown> })._preserved;

/** What the picking path passes: ten screen pixels, at the current zoom. */
const PICK = { hitThreshold: 10, zoom: 1 };

describe('the UML element models', () => {
  it('declares the three persisted types the pack is built on', () => {
    expect(detached(UmlDiagramElementModel).type).toBe('umlDiagram');
    expect(detached(UmlNodeElementModel).type).toBe('umlNode');
    expect(detached(UmlSubjectElementModel).type).toBe('umlSubject');
  });

  /**
   * `xywh` is deliberately not asserted here. It is declared `@field()` with no
   * argument — the box is given by whoever places the element — so the class
   * initializer is a creation-time default the surface applies, not a value a
   * detached reader can see. Same call `C4BoardElementModel.xywh` makes.
   */
  it('gives every element its defaults, unwritten', () => {
    const diagram = detached(UmlDiagramElementModel);
    expect(diagram.name).toBe('Diagram');
    expect(diagram.kind).toBe('class');
    expect(diagram.resizeEnabled).toBe(true);
    expect(diagram.rotate).toBe(0);

    const subject = detached(UmlSubjectElementModel);
    expect(subject.name).toBe('Subject');
    expect(subject.resizeEnabled).toBe(true);
    expect(subject.rotate).toBe(0);

    const node = detached(UmlNodeElementModel);
    expect(node.kind).toBe('class');
    expect(node.centerAnchorOnly).toBe(true);
  });

  it('makes both frames passive canvases, and the node a native shape', () => {
    expect(UmlDiagramElementModel.prototype).toBeInstanceOf(
      FrameworkBackgroundElementModel
    );
    expect(UmlSubjectElementModel.prototype).toBeInstanceOf(
      FrameworkBackgroundElementModel
    );
    expect(UmlNodeElementModel.prototype).toBeInstanceOf(ShapeElementModel);

    // A connector must never snap to the sheet — nor to the system boundary
    // drawn on it. The subject is a background like any other (R12).
    expect(detached(UmlSubjectElementModel).connectable).toBe(false);
    expect(detached(UmlDiagramElementModel).connectable).toBe(false);
  });

  /**
   * The heading of UML 2.5.1 Annex A: `<kind> <name>`, in the cut-corner tag.
   *
   * Derived, so nothing here reaches the document and a rename writes `name`
   * alone. Asserting it is asserting the whole reason UML ships as ONE
   * framework with a kind on the board (ADR 0017): the four diagram families
   * share this heading and this sheet.
   */
  it('derives the frame heading from its kind and its name', () => {
    const diagram = detached(UmlDiagramElementModel);
    expect(diagram.heading).toBe('class Diagram');

    stored(diagram).set('kind', 'uc');
    stored(diagram).set('name', 'Login');
    expect(diagram.heading).toBe('uc Login');

    // Every phase-1 kind reads straight back off what a document carries, and
    // writes the tag the table names.
    for (const kind of ['class', 'pkg', 'obj', 'uc'] as UmlDiagramKind[]) {
      stored(diagram).set('kind', kind);
      expect(diagram.kind, kind).toBe(kind);
      expect(diagram.heading, kind).toBe(`${UML_DIAGRAM_KIND_TAG[kind]} Login`);
    }

    // Derived means derived: asking the question wrote nothing.
    expect(stored(diagram).has('heading')).toBe(false);
  });

  /**
   * The append-only promise `UmlDiagramKind` makes, seen from an OLDER client.
   *
   * Phase 2 appends `cmp | dep | act | stm` and phase 3 appends `sd`. A frame
   * carrying one of those, opened on a build that ships only phase 1, has no
   * entry in the tag table — and writes its kind VERBATIM rather than dropping
   * it or falling back to `class`. The document is not rewritten, and the sheet
   * still says what it is.
   */
  it('writes a kind it has never heard of verbatim in the heading', () => {
    const diagram = detached(UmlDiagramElementModel, {
      kind: 'stm',
      name: 'Order lifecycle',
    });

    expect(UML_DIAGRAM_KIND_TAG).not.toHaveProperty('stm');
    expect(diagram.heading).toBe('stm Order lifecycle');
  });

  /**
   * A frame is picked by its BORDER and by its HEADING BAND — the one carve-out
   * it keeps, the same one a C4 board makes (R9).
   *
   * Without the band the heading is unreachable: a background answers on its
   * border alone, so a single click on the words selects nothing at all.
   */
  it('picks the frame by its border and its heading band, never its middle', () => {
    const diagram = detached(UmlDiagramElementModel, {
      xywh: '[0,0,1400,900]',
      rotate: 0,
    });

    // The band, full width, from the top edge down to its own height.
    expect(diagram.includesPoint(700, 4, PICK)).toBe(true);
    expect(diagram.includesPoint(700, UML_FRAME_BAND_HEIGHT - 1, PICK)).toBe(
      true
    );
    expect(diagram.includesPoint(1390, UML_FRAME_BAND_HEIGHT - 1, PICK)).toBe(
      true
    );
    // …and it stops where it says it stops.
    expect(diagram.includesPoint(700, UML_FRAME_BAND_HEIGHT + 20, PICK)).toBe(
      false
    );

    // The border band still answers, all the way round.
    expect(diagram.includesPoint(5, 450, PICK)).toBe(true);
    expect(diagram.includesPoint(1396, 450, PICK)).toBe(true);
    expect(diagram.includesPoint(700, 896, PICK)).toBe(true);

    // The middle of the sheet is not the sheet: that is where the work goes,
    // and a click there belongs to whatever node is under the pointer.
    expect(diagram.includesPoint(700, 450, PICK)).toBe(false);
    expect(diagram.includesPoint(200, 800, PICK)).toBe(false);

    // Outside is still outside — the carve-out widens the target, it does not
    // move it.
    expect(diagram.includesPoint(700, -40, PICK)).toBe(false);
    expect(diagram.includesPoint(1600, 20, PICK)).toBe(false);
  });

  /**
   * The subject keeps the plain background hit test — border only, no band.
   *
   * Its name is written top-left INSIDE the rectangle rather than in a strip of
   * its own, so there is no band to carve out: §18.1.4 draws one rectangle and
   * nothing else.
   */
  it('picks the subject by its border alone', () => {
    const subject = detached(UmlSubjectElementModel, {
      xywh: '[0,0,520,360]',
      rotate: 0,
    });

    expect(subject.includesPoint(5, 180, PICK)).toBe(true);
    expect(subject.includesPoint(260, 4, PICK)).toBe(true);
    // Transparent on purpose: the use cases it encloses keep their clicks.
    expect(subject.includesPoint(260, 180, PICK)).toBe(false);
    expect(subject.includesPoint(260, 40, PICK)).toBe(false);
  });

  /**
   * A UML node is a BOX, and its whole area belongs to it.
   *
   * `rect.includesPoint` skips the interior test for an unfilled shape, which is
   * what made C4's glyph-bodied artefacts undraggable and impossible to
   * double-click into their text editor (PO, 27/08/2026). Several UML kinds are
   * exactly that: a package is a tabbed folder, a note a folded-corner
   * rectangle, an actor a stick figure — the glyph paints the body and the
   * native shape paints nothing.
   */
  it('is hit anywhere inside it, filled or not', () => {
    const node = detached(UmlNodeElementModel, {
      xywh: '[0,0,200,100]',
      shapeType: 'rect',
      filled: false,
      kind: 'package',
    });

    // Well inside the body, far from every edge — and deliberately OUTSIDE the
    // small central area an unfilled, untitled shape falls back to, which is
    // the part of the box that was already hittable and would prove nothing.
    expect(node.includesPoint(40, 25, PICK)).toBe(true);

    // …and a plain unfilled shape is NOT hit there, which is exactly the
    // behaviour the override changes.
    const plain = detached(ShapeElementModel, {
      xywh: '[0,0,200,100]',
      shapeType: 'rect',
      filled: false,
    });
    expect(plain.includesPoint(40, 25, PICK)).toBe(false);

    // Outside is still outside.
    expect(node.includesPoint(400, 50, PICK)).toBe(false);
  });

  /**
   * `kind` is the whole schema of a node, and it round-trips.
   *
   * The labels a classifier shows — its name, its attributes, its operations —
   * are grouped TEXT elements, not fields (R16). Asserted rather than left
   * implicit because the absence is the point: a second place to write the same
   * sentence is a place for it to go stale.
   */
  it('carries the node kind and nothing else', () => {
    const node = detached(UmlNodeElementModel);

    for (const kind of [
      'class',
      'interface',
      'enumeration',
      'object',
      'package',
      'note',
      'actor',
      'use-case',
    ]) {
      stored(node).set('kind', kind);
      expect(node.kind, kind).toBe(kind);
    }

    const carrier = node as unknown as Record<string, unknown>;
    expect('attributes' in carrier).toBe(false);
    expect('operations' in carrier).toBe(false);
    expect(stored(node).has('attributes')).toBe(false);
    expect(stored(node).has('operations')).toBe(false);
  });
});
