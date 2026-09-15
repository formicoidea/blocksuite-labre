import { beforeAll, describe, expect, it } from 'vitest';

import {
  FrameworkBackgroundElementModel,
  ShapeElementModel,
  UML_DIAGRAM_KIND_TAG,
  UML_FRAME_BAND_HEIGHT,
  UML_PARTITION_BAND,
  UML_REGION_BAND,
  UmlDiagramElementModel,
  type UmlDiagramKind,
  UmlNodeElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
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

/**
 * The 2-D affine pair `getPointsFromBoundWithRotation` composes a rotation
 * with.
 *
 * happy-dom ships `DOMMatrix` / `DOMPoint` as names without geometry —
 * `matrixTransform` is simply absent — so the rotation branch of the shared
 * helper cannot run under the test environment. These are the three operations
 * it uses and nothing more; the browser's own implementations do the same
 * arithmetic, which is what makes asserting rotation here worth anything. Same
 * harness the framework-background hit-test spec installs.
 */
class StubMatrix {
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public e = 0,
    public f = 0
  ) {}

  translateSelf(tx: number, ty: number) {
    this.e += this.a * tx + this.c * ty;
    this.f += this.b * tx + this.d * ty;
    return this;
  }

  rotateSelf(deg: number) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const { a, b, c, d } = this;
    this.a = a * cos + c * sin;
    this.b = b * cos + d * sin;
    this.c = c * cos - a * sin;
    this.d = d * cos - b * sin;
    return this;
  }
}

class StubPoint {
  constructor(
    public x = 0,
    public y = 0
  ) {}

  matrixTransform(m: StubMatrix) {
    return {
      x: m.a * this.x + m.c * this.y + m.e,
      y: m.b * this.x + m.d * this.y + m.f,
    };
  }
}

beforeAll(() => {
  const global = globalThis as Record<string, unknown>;
  global.DOMMatrix = StubMatrix;
  global.DOMPoint = StubPoint;
});

/** What the picking path passes: ten screen pixels, at the current zoom. */
const PICK = { hitThreshold: 10, zoom: 1 };

describe('the UML element models', () => {
  it('declares the five persisted types the pack is built on', () => {
    expect(detached(UmlDiagramElementModel).type).toBe('umlDiagram');
    expect(detached(UmlNodeElementModel).type).toBe('umlNode');
    expect(detached(UmlSubjectElementModel).type).toBe('umlSubject');
    // Appended by phase 2's behaviour families: the swimlane of §15.6.4 and
    // the composite state of §14.2.4.
    expect(detached(UmlPartitionElementModel).type).toBe('umlPartition');
    expect(detached(UmlRegionElementModel).type).toBe('umlRegion');
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

    const partition = detached(UmlPartitionElementModel);
    expect(partition.name).toBe('Partition');
    // Vertical by default: a column is the lane nearly every activity diagram
    // anybody draws is laid out in (§15.6.4).
    expect(partition.orientation).toBe('vertical');
    expect(partition.resizeEnabled).toBe(true);
    expect(partition.rotate).toBe(0);

    const region = detached(UmlRegionElementModel);
    // `State`, not `Region`: this element IS the composite state on the page.
    expect(region.name).toBe('State');
    expect(region.resizeEnabled).toBe(true);
    expect(region.rotate).toBe(0);

    const node = detached(UmlNodeElementModel);
    expect(node.kind).toBe('class');
    expect(node.centerAnchorOnly).toBe(true);
  });

  it('makes every frame a passive canvas, and the node a native shape', () => {
    for (const Ctor of [
      UmlDiagramElementModel,
      UmlSubjectElementModel,
      UmlPartitionElementModel,
      UmlRegionElementModel,
    ]) {
      expect(Ctor.prototype).toBeInstanceOf(FrameworkBackgroundElementModel);
    }
    expect(UmlNodeElementModel.prototype).toBeInstanceOf(ShapeElementModel);

    // A connector must never snap to the sheet — nor to the system boundary
    // drawn on it, nor to a swimlane, nor to a composite state. Every one of
    // them is a background like any other (R12).
    expect(detached(UmlSubjectElementModel).connectable).toBe(false);
    expect(detached(UmlDiagramElementModel).connectable).toBe(false);
    expect(detached(UmlPartitionElementModel).connectable).toBe(false);
    expect(detached(UmlRegionElementModel).connectable).toBe(false);
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

    // Every kind the build ships reads straight back off what a document
    // carries, and writes the tag the table names — the phase-1 four and the
    // two Annex A frames phase 2 appended (`cmp`, §11.6.4; `dep`, §19.2.4).
    for (const kind of [
      'class',
      'pkg',
      'obj',
      'uc',
      'cmp',
      'dep',
      // …and the two behaviour frames phase 2 appended after them (`act`,
      // §15.2.4; `stm`, §14.2.4).
      'act',
      'stm',
    ] as UmlDiagramKind[]) {
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
   * Phase 2 appended `cmp | dep` and then `act | stm`; phase 3 appends `sd`. A
   * frame carrying one this build does not ship — `sd` here, the interaction
   * frame — has no entry in the tag table, and writes its kind VERBATIM rather
   * than dropping it or falling back to `class`. The document is not rewritten,
   * and the sheet still says what it is.
   *
   * The echo used to be spelled with `stm`, which this build now ships: the
   * test moved on to the next unshipped kind rather than being deleted, because
   * what it pins is the FALLBACK and not any particular string.
   */
  it('writes a kind it has never heard of verbatim in the heading', () => {
    const diagram = detached(UmlDiagramElementModel, {
      kind: 'sd',
      name: 'Order lifecycle',
    });

    expect(UML_DIAGRAM_KIND_TAG).not.toHaveProperty('sd');
    expect(diagram.heading).toBe('sd Order lifecycle');
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
   * …and the band follows the frame round when the frame is ROTATED.
   *
   * The band is axis-aligned INSIDE the frame, not on the canvas, so the hit
   * test undoes the element rotation about the centre before measuring. This is
   * the case that executes that unwind: without it the strip would stay pinned
   * to the top of the screen while the heading it is meant to pick moved away.
   */
  it('turns the heading band with a rotated frame', () => {
    // A 400 × 200 frame turned a quarter turn about its centre (200, 100): it
    // now measures 200 × 400, so it spans x ∈ [100, 300], y ∈ [-100, 300] and
    // its heading runs UP the right-hand side.
    const diagram = detached(UmlDiagramElementModel, {
      xywh: '[0,0,400,200]',
      rotate: 90,
    });

    // The middle of the band — element-local (200, 20), which the quarter turn
    // carries to (280, 100). Twenty units in from the rotated right edge, so
    // the border band is not what answers here.
    expect(diagram.includesPoint(280, 100, PICK)).toBe(true);

    // Where the UNrotated band used to be there is now nothing: element-local
    // (120, 100) is 100 units below the heading, and 100 from the nearest edge.
    expect(diagram.includesPoint(200, 20, PICK)).toBe(false);
  });

  /**
   * A frame shorter than its own heading — the degenerate case the renderer
   * clamps too.
   *
   * `Math.min(UML_FRAME_BAND_HEIGHT, h)` is what stops the band hanging BELOW a
   * squashed frame and picking it from empty canvas. Asserted because the
   * failure is invisible: the strip is not painted there, so only a point test
   * can catch it.
   */
  it('clamps the band to a frame shorter than its own heading', () => {
    const diagram = detached(UmlDiagramElementModel, {
      xywh: '[0,0,400,20]',
      rotate: 0,
    });

    // Inside the 20-unit frame: picked, as it always was.
    expect(diagram.includesPoint(200, 10, PICK)).toBe(true);

    // Twenty units BELOW its bottom edge, and out of reach of the border band.
    // Unclamped, the 44-unit strip would still claim this point.
    expect(diagram.includesPoint(200, 40, PICK)).toBe(false);
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
      // Appended by phase 2 — the component artefacts (§11.6.4, §11.3.4,
      // §10.4.4) and the deployment ones (§19.3.4, §19.4.4). Same field, same
      // schema, new values.
      'component',
      'port',
      'provided-interface',
      'required-interface',
      'artifact',
      'node',
      'device',
      'execution-environment',
      // …and the behaviour artefacts appended after them: the activity family
      // (§15.3.4, §15.4.4, §16.3.4, §16.10.4)…
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
      // …and the state machine one (§14.2.4).
      'state',
      'final-state',
      'choice',
      'junction',
      'shallow-history',
      'deep-history',
      'entry-point',
      'exit-point',
      'terminate',
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

  /**
   * A partition is picked by its BORDER and by its NAME BAND — the same
   * carve-out the diagram frame makes, on whichever edge its orientation puts
   * it (§15.6.4).
   *
   * It matters more here than on the sheet: a swimlane is TRANSPARENT, so its
   * header is the only wide part of it a user can take hold of at all.
   */
  it('picks a vertical partition by its border and its top band', () => {
    const lane = detached(UmlPartitionElementModel, {
      xywh: '[0,0,360,900]',
      rotate: 0,
      orientation: 'vertical',
    });

    // The band, full width, from the top edge down to its own height.
    expect(lane.includesPoint(180, 4, PICK)).toBe(true);
    expect(lane.includesPoint(180, UML_PARTITION_BAND - 1, PICK)).toBe(true);
    expect(lane.includesPoint(350, UML_PARTITION_BAND - 1, PICK)).toBe(true);
    // …and it stops where it says it stops, which is what lets the actions
    // drawn in the lane keep their clicks.
    expect(lane.includesPoint(180, UML_PARTITION_BAND + 20, PICK)).toBe(false);
    expect(lane.includesPoint(180, 450, PICK)).toBe(false);

    // The border band still answers, all the way round.
    expect(lane.includesPoint(4, 450, PICK)).toBe(true);
    expect(lane.includesPoint(356, 450, PICK)).toBe(true);
    expect(lane.includesPoint(180, 896, PICK)).toBe(true);

    // Outside is still outside.
    expect(lane.includesPoint(180, -40, PICK)).toBe(false);
    expect(lane.includesPoint(500, 20, PICK)).toBe(false);
  });

  /**
   * …and a HORIZONTAL lane wears its band down the LEFT edge instead.
   *
   * The one thing `orientation` changes about the hit test, and the case that
   * executes the `'left'` branch: without it a row's header would be picked
   * across its top, where §15.6.4 writes nothing at all.
   */
  it('moves the band to the left edge of a horizontal partition', () => {
    const lane = detached(UmlPartitionElementModel, {
      xywh: '[0,0,900,360]',
      rotate: 0,
      orientation: 'horizontal',
    });

    // The band, full height, from the left edge across to its own width.
    expect(lane.includesPoint(4, 180, PICK)).toBe(true);
    expect(lane.includesPoint(UML_PARTITION_BAND - 1, 180, PICK)).toBe(true);
    expect(lane.includesPoint(UML_PARTITION_BAND - 1, 350, PICK)).toBe(true);
    // …and nothing past it.
    expect(lane.includesPoint(UML_PARTITION_BAND + 20, 180, PICK)).toBe(false);
    expect(lane.includesPoint(450, 180, PICK)).toBe(false);

    // Across the top, where a VERTICAL lane wears its band and this one wears
    // nothing — well clear of the border band, which would answer for a reason
    // that has nothing to do with the header.
    expect(lane.includesPoint(450, 20, PICK)).toBe(false);
  });

  /**
   * The band turns with a rotated lane, and clamps to one dragged smaller than
   * its own header — the two cases the shared unwind exists for, asserted on
   * the frame that has two edges to get them wrong on.
   */
  it('turns and clamps the partition band', () => {
    // A 400 × 200 lane turned a quarter turn about its centre (200, 100): it
    // now spans x ∈ [100, 300], y ∈ [-100, 300], and its header runs UP the
    // right-hand side.
    const turned = detached(UmlPartitionElementModel, {
      xywh: '[0,0,400,200]',
      rotate: 90,
      orientation: 'vertical',
    });
    // Element-local (200, 18) — the middle of the band — which the quarter turn
    // carries to (282, 100). Eighteen units in from the rotated right edge, so
    // the border band is not what answers here.
    expect(turned.includesPoint(282, 100, PICK)).toBe(true);
    // Where the UNrotated band used to be there is now nothing.
    expect(turned.includesPoint(200, 18, PICK)).toBe(false);

    // Squashed shorter than its own header: unclamped, the 36-unit strip would
    // claim points below the lane's own bottom edge.
    const squashed = detached(UmlPartitionElementModel, {
      xywh: '[0,0,400,20]',
      rotate: 0,
      orientation: 'vertical',
    });
    expect(squashed.includesPoint(200, 10, PICK)).toBe(true);
    expect(squashed.includesPoint(200, 40, PICK)).toBe(false);
  });

  /**
   * The composite state carves out the same band, always across the top:
   * §14.2.4 writes a state's name there and nowhere else, so unlike a partition
   * it has no orientation to turn.
   */
  it('picks a composite state by its border and its top band', () => {
    const region = detached(UmlRegionElementModel, {
      xywh: '[0,0,520,320]',
      rotate: 0,
    });

    expect(region.includesPoint(260, 4, PICK)).toBe(true);
    expect(region.includesPoint(260, UML_REGION_BAND - 1, PICK)).toBe(true);
    expect(region.includesPoint(260, UML_REGION_BAND + 20, PICK)).toBe(false);
    // Transparent below the band, so the sub-machine drawn inside keeps its
    // clicks.
    expect(region.includesPoint(260, 160, PICK)).toBe(false);
    // The border, all the way round.
    expect(region.includesPoint(4, 160, PICK)).toBe(true);
    expect(region.includesPoint(516, 160, PICK)).toBe(true);
    expect(region.includesPoint(260, 316, PICK)).toBe(true);
    // Outside is still outside.
    expect(region.includesPoint(260, -40, PICK)).toBe(false);
  });
});
