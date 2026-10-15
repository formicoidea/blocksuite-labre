import type { SerializedXYWH } from '@labre/global/gfx';
import { rotatePoint } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import {
  UML_DIAGRAM_KIND_TAG,
  UML_FRAME_BAND_HEIGHT,
  type UmlDiagramKind,
} from './consts.js';

export type UmlDiagramProps = FrameworkBackgroundProps & {
  /** The diagram name, written in the heading tag — edited inline on dblclick. */
  name?: string;
  /** Which kind of UML diagram this frame draws. */
  kind?: UmlDiagramKind;
};

/**
 * The UML diagram frame: the sheet one diagram is drawn on — a class diagram, a
 * package diagram, an object diagram, a use case diagram, a component diagram, a
 * deployment diagram. A framework
 * background like every other one in the library: the user drops nodes on top
 * of it, and a connector never snaps to it.
 *
 * It carries a NAME and a KIND, and the two are written together in the
 * cut-corner tag at its top left, exactly as UML 2.5.1 Annex A draws it. That
 * shared frame notation is the whole reason UML ships as ONE framework with a
 * kind on the board rather than one framework per diagram family (ADR 0017):
 * the kinds share a sheet and a heading, and they mix on it.
 *
 * What it LOOKS like is declared, not coded: see `UML_DIAGRAM_BACKGROUND` in
 * `@labre/affine-gfx-uml`.
 */
export class UmlDiagramElementModel extends FrameworkBackgroundElementModel<UmlDiagramProps> {
  get type() {
    return 'umlDiagram';
  }

  @field('Diagram')
  accessor name: string = 'Diagram';

  /**
   * Which kind of diagram this frame draws — REQUIRED, unlike the C4 board's
   * `level`, which is optional.
   *
   * The difference is what the field is for. A C4 board's level is a claim
   * about the model an author may decline to make, so an absent one means "a
   * free sketch". A UML frame's kind is part of its NOTATION: Annex A's heading
   * is `<kind> <name>`, and a frame with no kind has no heading to draw. So it
   * has a default, and `class` is the one — the diagram an architect reaches
   * for first, and the only kind Annex A gives no abbreviation for.
   */
  @field('class' as UmlDiagramKind)
  accessor kind: UmlDiagramKind = 'class';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1400,900]';

  /**
   * The heading written in the cut-corner tag: `<kind> <name>`.
   *
   * DERIVED, not stored. Nothing here reaches the document: the two halves are
   * `kind` and `name`, and a rename edits `name` alone — so there is one place
   * a heading can be changed from, and nothing to keep in step with it.
   *
   * A kind this client does not know — a phase-2 value on a phase-1 build — is
   * written VERBATIM rather than dropped or replaced by the default. The tag
   * table is a spelling aid, not a gate: a newer document still shows its own
   * heading here, which is the visible half of the append-only promise
   * {@link UmlDiagramKind} makes.
   */
  get heading(): string {
    return `${UML_DIAGRAM_KIND_TAG[this.kind] ?? this.kind} ${this.name}`.trim();
  }

  /**
   * A frame is picked by its BORDER — and by its HEADING BAND, the one carve-out
   * it keeps.
   *
   * The same carve-out a C4 board makes, for the same reason and by the same
   * arithmetic: the band is the only part of the sheet that is the SHEET rather
   * than the diagram drawn on it. The heading is written there, nothing is ever
   * dropped there by convention, and the drawing below is where the work goes —
   * so a click there belongs to whatever node is under the pointer.
   *
   * Without this the heading would be unreachable, backgrounds being picked by
   * their border band alone: the only thing left answering would be the view's
   * double-click zone, which is the tight box of the DRAWN glyphs, and a single
   * click on the heading would select nothing at all.
   *
   * The band is the top margin, full width — one number
   * ({@link UML_FRAME_BAND_HEIGHT}), read from here by the framework
   * declaration, so what is painted is what is selectable.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    if (super.includesPoint(x, y, options)) return true;

    const [ex, ey, w, h] = this.deserializedXYWH;

    // Element-local coordinates, undoing the element rotation about its centre
    // — the band is axis-aligned inside the frame, not on the canvas.
    let lx = x - ex;
    let ly = y - ey;
    const rotate = this.rotate ?? 0;
    if (rotate) {
      const [ux, uy] = rotatePoint([x, y], [ex + w / 2, ey + h / 2], -rotate);
      lx = ux - ex;
      ly = uy - ey;
    }

    if (lx < 0 || lx > w || ly < 0) return false;

    // Clamped to a frame shorter than its own heading — the degenerate case the
    // renderer clamps too.
    return ly <= Math.min(UML_FRAME_BAND_HEIGHT, h);
  }
}
