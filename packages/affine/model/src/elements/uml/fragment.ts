import type { SerializedXYWH } from '@labre/global/gfx';
import type { PointTestOptions } from '@labre/std/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';
import { umlInNameBand } from './band.js';

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
 * The INTERACTION OPERATOR of a combined fragment — the word written in its
 * pentagon, and the whole of what the fragment says (UML 2.5.1 §17.6.4).
 *
 * The twelve operators of §17.6.4 plus `ref`, and the thirteenth is the one
 * that is not an operator at all: §17.7.4's InteractionUse is a different
 * metaclass drawn as the same rectangle with the same pentagon, and every tool
 * offers it from the same menu. Keeping it here is what lets one element, one
 * renderer and one toolbar cover both — the alternative being a second
 * background that differs from this one by a string.
 *
 * Widened the way every other UML union is: appended, never reordered, and read
 * back as whatever string the document carries. A fragment whose operator this
 * build has never heard of still paints its rectangle and still writes its own
 * word in the tag.
 */
export type UmlFragmentOperator =
  // §17.6.4's own twelve, in the order the specification lists them.
  | 'alt'
  | 'opt'
  | 'loop'
  | 'par'
  | 'break'
  | 'critical'
  | 'seq'
  | 'strict'
  | 'neg'
  | 'assert'
  | 'ignore'
  | 'consider'
  // §17.7.4: the interaction USE — a reference to another interaction, drawn
  // as the same box with `ref` in the tag. See the header.
  | 'ref';

/**
 * One OPERAND of a combined fragment — a horizontal band of it, separated from
 * the next by a dashed line (§17.6.4).
 *
 * The shape of a `BackgroundInstanceZoneItem` in `@labre/affine-block-surface`,
 * and deliberately the same three fields as {@link BpmnLane}: the primitive
 * paints an instance partition from that structure, the audit reports it from
 * that structure, and an operand with a shape of its own would be a fourth
 * place the two have to agree.
 *
 * `name` is the operand's GUARD — `[x > 0]`, `[else]` — because that is the
 * only thing §17.6.4 writes in an operand's own corner. `size` is a relative
 * WEIGHT and not a height in model units: a fragment dragged taller
 * redistributes the space between its operands instead of leaving a gap under
 * the last one.
 */
export interface UmlFragmentOperand {
  /** Stable id, generated at creation. Never the guard: a guard is rewritten. */
  id: string;
  /** The operand's guard, written in its top-left corner. */
  name?: string;
  /** Relative weight — see above. Must be a finite number greater than zero. */
  size: number;
}

export type UmlFragmentProps = FrameworkBackgroundProps & {
  /** Which operator the pentagon writes. */
  operator?: UmlFragmentOperator;
  /** The first operand's guard, or a `ref`'s interaction name. */
  name?: string;
  /** The fragment's partition into operands. Absent until a second is added. */
  operands?: UmlFragmentOperand[];
};

/**
 * A COMBINED FRAGMENT — the rectangle drawn round part of a sequence diagram
 * with an operator in its corner (UML 2.5.1 §17.6.4), and, under the `ref`
 * operator, the InteractionUse of §17.7.4.
 *
 * A framework background, and a TRANSPARENT one, like
 * {@link UmlSubjectElementModel} and {@link UmlPartitionElementModel}: it is
 * drawn OVER lifelines and messages that are already there, and an opaque card
 * would hide the very conversation it is qualifying. Membership — which
 * messages are inside the `alt`, which lifelines it covers — is geometry at
 * read time (R11), never a stored list.
 *
 * ## Why the operator is a field and the operands are not elements
 *
 * The operator IS the fragment: `alt` and `loop` are the same rectangle saying
 * two entirely different things, and nothing in the picture distinguishes them
 * but the word. So it is stored, with `alt` as the default — the fragment an
 * architect reaches for first, and the one §17.6.4 opens with.
 *
 * The operands are bands of that one rectangle, and they follow the BPMN pool's
 * lanes exactly: an optional flat array, `undefined` rather than `[]` until the
 * first one is added, so a fragment with a single operand stays byte-identical
 * to one written before the field existed. The trade the pool's own note
 * states applies here unchanged — two peers reordering the operands at the same
 * moment resolve last-write-wins, one whole list winning over the other — and
 * it is stated so it is reviewed rather than discovered.
 *
 * What it LOOKS like is declared, not coded: see `UML_FRAGMENT_FRAME` in
 * `@labre/affine-gfx-uml`.
 */
export class UmlFragmentElementModel extends FrameworkBackgroundElementModel<UmlFragmentProps> {
  get type() {
    return 'umlFragment';
  }

  /**
   * The operator — REQUIRED, with `alt` as the default, for the reason
   * `UmlDiagramElementModel.kind` is required: it is part of the NOTATION
   * rather than a claim an author may decline to make. A fragment with no
   * operator has no word to write in its pentagon, and a pentagon with nothing
   * in it is a rectangle with a bitten corner.
   */
  @field('alt' as UmlFragmentOperator)
  accessor operator: UmlFragmentOperator = 'alt';

  /**
   * The first operand's guard, or — under `ref` — the name of the interaction
   * being referred to.
   *
   * Seeded EMPTY, unlike every other UML frame's name: §17.6.4 draws a guard
   * only where there is one to draw, and `[alt]` with an empty bracket under it
   * would be the notation inventing a condition the author has not written. An
   * empty string keeps the field in the document (the `@field` default is
   * written) without putting words on the page.
   */
  @field('')
  accessor name: string = '';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  /**
   * Wide enough to cover three lifelines at the 200-unit spacing a sequence
   * diagram is laid out on, and tall enough for three or four exchanges — the
   * size an `alt` is actually drawn round.
   */
  @field()
  accessor xywh: SerializedXYWH = '[0,0,600,260]';

  /**
   * The fragment's partition into operands, top to bottom.
   *
   * `undefined`, not `[]`, and for the three reasons `BpmnPoolElementModel
   * .lanes` states in full: `@field()` writes nothing for an undefined default,
   * so a fragment with a single operand — which is every `opt`, every `loop`
   * and every `ref` — is byte-identical to one created before this field
   * existed; the value is flat JSON because a list of operands is one atomic
   * choice about how one fragment is cut; and it is declared here rather than
   * on the base class because an operand is a subdivision of a combined
   * fragment and of nothing else.
   *
   * What it MEANS is declared, not coded: `UML_FRAGMENT_FRAME.instanceZones`
   * in `@labre/affine-gfx-uml` names this prop, and the framework-background
   * primitive paints the separators and the guards from it.
   */
  @field()
  accessor operands: UmlFragmentOperand[] | undefined = undefined;

  /**
   * Picked by its BORDER — and by its OPERATOR BAND, the one carve-out it
   * keeps.
   *
   * The same carve-out the diagram frame, the partition and the composite state
   * all make, and for the same reason: the band is the only part of the
   * fragment that is the FRAGMENT rather than the conversation drawn inside it.
   * Without it the pentagon would be unreachable, a background being picked by
   * its border alone — and a transparent fragment's border is a thin line round
   * a region full of other people's messages.
   *
   * Nothing below the band is claimed, which matters here as much as on a
   * partition: a fragment is drawn OVER lifelines, so every point that is not
   * its own furniture has to fall through to whatever is under the pointer.
   */
  override includesPoint(
    x: number,
    y: number,
    options?: PointTestOptions
  ): boolean {
    if (super.includesPoint(x, y, options)) return true;
    return umlInNameBand(this, 'top', UML_FRAGMENT_BAND, x, y);
  }
}
