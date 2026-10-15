/**
 * The UML element constants an interchange reader needs WITHOUT the element
 * classes: moved out of `diagram.ts`, `fragment.ts`, `partition.ts` and `region.ts`
 * unchanged, so the
 * model's headless entry (`@labre/affine-model/headless`) can export them with
 * no `@labre/std/gfx` behind it (ADR 0012, P3 as amended 2026-10-14). The
 * package index re-exports this file, so nothing an importer reads moved.
 */

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
  | 'stm'
  // Phase 3 — interactions (§17.2.4). Annex A's frame kind is the word
  // `interaction`, and `sd` is the abbreviation it gives in its place: the tag
  // every tool writes and every architect reads on a sequence diagram.
  | 'sd';

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
  // Annex A's abbreviation for the interaction frame, and the third tag in the
  // table that is not the kind spelled out: the frame kind is `interaction`.
  sd: 'sd',
};

/**
 * Height of a combined fragment's OPERATOR BAND — the strip across its top the
 * pentagon tag is drawn in, in model units.
 *
 * Owned by the model for the reason {@link UML_FRAME_BAND_HEIGHT} is: the
 * fragment's own hit test reads it (a fragment is clickable by its tag strip as
 * well as by its border), and `affine-model` cannot reach into
 * `affine-block-surface` where the declaration is resolved.
 *
 * The diagram frame's own 44, and deliberately: §17.6.4 draws the operator in
 * the very same cut-corner pentagon Annex A draws a frame heading in — it IS a
 * frame, nested in another one — and two numbers for one piece of furniture
 * would drift.
 */
export const UML_FRAGMENT_BAND = 44;

/**
 * Height of a partition's NAME BAND — the strip its name is written in, in
 * model units.
 *
 * Declared HERE, in the model, and re-exported by `@labre/affine-gfx-uml`, for
 * the reason {@link UML_FRAME_BAND_HEIGHT} is: the partition's own hit test
 * reads it (a swimlane is clickable by its header as well as by its border),
 * and `affine-model` cannot reach into `affine-block-surface` where the
 * declaration is resolved. One number, owned by the layer that both the
 * declaration and the hit test can read.
 *
 * It is the band's THICKNESS whichever edge the band is on — the top for a
 * vertical lane, the left for a horizontal one — because §15.6.4 draws one
 * header strip and turns it with the lane rather than resizing it.
 *
 * 36 against the diagram frame's 44: a partition header is a name and not a
 * `<kind> <name>` heading, and it is written inside a lane that already sits on
 * a sheet, so it reads as a subdivision rather than as a second sheet.
 */
export const UML_PARTITION_BAND = 36;

/**
 * Height of a region's NAME BAND — the strip its name is written in, in model
 * units.
 *
 * Owned by the model for the reason {@link UML_PARTITION_BAND} is: the region's
 * own hit test reads it, and `affine-model` cannot reach into the package where
 * the declaration is resolved. The same 36 the partition uses, and deliberately
 * so — the two are the same piece of furniture, a name written in a strip along
 * the top of a transparent frame, and two numbers would drift.
 */
export const UML_REGION_BAND = 36;
