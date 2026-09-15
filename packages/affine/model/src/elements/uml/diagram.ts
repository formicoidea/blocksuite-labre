import type { SerializedXYWH } from '@labre/global/gfx';
import { rotatePoint } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

/**
 * Height of the diagram frame's heading band — the strip across the top of the
 * frame the `<kind> <name>` tag is written in, in model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-uml`
 * rather than the other way round, for the reason `C4_BOARD_TITLE_BAND_HEIGHT`
 * is: the frame's own hit test needs it (a diagram is clickable by its heading
 * band as well as by its border), and `affine-model` cannot reach into
 * `affine-block-surface` where the declaration is resolved. One number, owned
 * by the layer that both the declaration and the hit test can read.
 *
 * It is the frame's TOP MARGIN — the inset the drawing gives up so the heading
 * has somewhere to be written — so the strip that is painted, the strip that is
 * picked and the strip that opens the rename are one number rather than three.
 *
 * 44 is the height of the cut-corner tag UML 2.5.1 Annex A draws the heading
 * in: a 20-unit label with the rest as breathing room above and below.
 * Changing it moves the heading, so it is a visual decision and not a hit-test
 * one.
 */
export const UML_FRAME_BAND_HEIGHT = 44;

/**
 * Which kind of UML diagram this frame draws — the DECLARED fact, as opposed to
 * the name, which is free text and says whatever its author wants it to.
 *
 * ## Where the values come from
 *
 * UML 2.5.1 Annex A gives the normative frame kind names, each with the
 * abbreviation that may be written in its place:
 *
 *  - `activity` / `act`;
 *  - `class` — the one kind Annex A gives NO abbreviation for, so the word
 *    itself is the tag;
 *  - `component` / `cmp`;
 *  - `deployment` / `dep`;
 *  - `interaction` / `sd`;
 *  - `package` / `pkg`;
 *  - `state machine` / `stm`;
 *  - `use case` / `uc`.
 *
 * `obj` is NOT in that list. Annex A has no frame kind for the object diagram —
 * the standard treats it as a class diagram showing instances — but every tool
 * that draws one tags it `obj`, and an architect reading the sheet expects to
 * see it. So `obj` is kept as a TOOL CONVENTION, recorded as such here so that
 * nobody later "fixes" it against the spec without knowing it was a choice.
 *
 * ## Widening this union is additive
 *
 * Phase 1 shipped the first four kinds below; phase 2 APPENDED `cmp` and `dep`,
 * the two structural frames of §11.6.4 and §19.2.4, then `act` and `stm`, the
 * two behaviour frames of §15.2.4 and §14.2.4; phase 3 appends `sd`. Each
 * arrives as a new VALUE of the existing `kind`
 * string field — no new field, no schema change, no migration and no backfill.
 * The same promise `C4NodeKind` and `BpmnNodeKind` already make.
 *
 * Appended, never reordered: the union is read as a set of strings by every
 * consumer, and a document only ever stores one of them, so the ORDER below is a
 * reading aid. Keeping it chronological is what lets a reviewer see at a glance
 * which build a value arrived in.
 *
 * A value a client has never seen reads back as the string it is, and
 * {@link UmlDiagramElementModel.heading} writes it verbatim, so a document
 * created by a newer build still shows its own heading on an older one.
 */
export type UmlDiagramKind =
  // Phase 1 — the four structural frames the class family is drawn in.
  | 'class'
  | 'pkg'
  | 'obj'
  | 'uc'
  // Phase 2 — components (§11.6.4) and deployments (§19.2.4).
  | 'cmp'
  | 'dep'
  // Phase 2 — the two behaviour frames: activities (§15.2.4) and state
  // machines (§14.2.4). Both are Annex A frame kinds with Annex A's own
  // abbreviations.
  | 'act'
  | 'stm';

/**
 * The word written in the heading tag, per kind.
 *
 * A table rather than the raw value so that a kind whose stored discriminant
 * and whose printed tag ever diverge has one place to say so. Today they are
 * the same four strings, and that is worth stating rather than assuming.
 *
 * `Partial` on purpose: a frame read off a document carries whatever string was
 * written there, including a kind from a later phase this build has never heard
 * of. Typing the lookup as total would make {@link
 * UmlDiagramElementModel.heading}'s `?? this.kind` fallback look like dead
 * defensive code, when it is the whole of the append-only promise.
 */
export const UML_DIAGRAM_KIND_TAG: Partial<Record<UmlDiagramKind, string>> = {
  class: 'class',
  pkg: 'pkg',
  obj: 'obj',
  uc: 'uc',
  // Both are Annex A's own abbreviations, written exactly as the Annex writes
  // them — `cmp` for the component diagram, `dep` for the deployment diagram.
  cmp: 'cmp',
  dep: 'dep',
  // Annex A's own abbreviations again — `act` for the activity diagram, `stm`
  // for the state machine diagram. `stm` is the one tag in the table that is
  // NOT the kind spelled out: Annex A's frame kind is the two words `state
  // machine`, and `stm` is the abbreviation it gives in their place.
  act: 'act',
  stm: 'stm',
};

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
