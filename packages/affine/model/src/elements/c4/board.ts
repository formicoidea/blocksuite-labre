import type { SerializedXYWH } from '@labre/global/gfx';
import { field } from '@labre/std/gfx';

import type { FrameworkBackgroundProps } from '../framework-background/index.js';
import { FrameworkBackgroundElementModel } from '../framework-background/index.js';

/**
 * Which of C4's levels this board draws — the DECLARED fact, as opposed to the
 * title, which is free text and says whatever its author wants it to.
 *
 * **Four values, for the four C's the notation is named after**: Context,
 * Containers, Components, Code. The vocabulary is the model's, so it says all
 * of it.
 *
 * ## Why `code` is here although nothing draws it
 *
 * Because the two questions are not the same one. What the EDITOR can draw is a
 * fact about this tooling — there are no code-level artefacts in the pack today,
 * and C4 itself says to skip that diagram unless it is generated from the source
 * — while what a SHEET may declare is a fact about the author's intent. A board
 * an architect keeps for the class diagram they paste in from elsewhere is a
 * code-level board, and a vocabulary that refused to let them say so would be
 * this editor's limitation dressed up as the notation's.
 *
 * So the declaration is the author's to make, and no rule judges it: nothing in
 * the pack knows what a code diagram admits, and a rule with nothing to forbid
 * is data that can never fire (`rules.ts` says this at length, about `component`
 * and `code` together). The level is recorded, exported and readable; it is
 * simply not yet checked.
 *
 * ## Widening this union is additive
 *
 * A value added here is a value older clients have never seen, and they read it
 * back as the string it is — the same promise `C4NodeKind` and
 * `C4BoundaryVariant` make. No document is rewritten, no migration is owed, and
 * a rule that does not name a level evaluates nothing on a board carrying it.
 *
 * A board that states a level is a board a rule can judge — "a container has no
 * place on a context diagram" — where a board that states nothing is a free
 * sketch, which is what every C4 diagram ever drawn in this editor is.
 */
export type C4BoardLevel = 'context' | 'container' | 'component' | 'code';

export type C4BoardProps = FrameworkBackgroundProps & {
  /** The diagram title, written top-left — edited inline on dblclick. */
  name?: string;
  /** Which C4 level this sheet draws. Absent means a free sketch. */
  level?: C4BoardLevel;
};

/**
 * The C4 board: the sheet one diagram of the model is drawn on — a context
 * diagram, a container diagram, a component diagram. A framework background like
 * every other one in the library: the user drops nodes on top of it, and a
 * connector never snaps to it.
 *
 * It carries a NAME, and optionally the LEVEL it draws. A C4 diagram has no
 * frame of reference — a system drawn top left says nothing more than one drawn
 * bottom right — so there are no axes, no zones and no partition to declare.
 *
 * What it LOOKS like is declared, not coded: see `C4_BOARD_BACKGROUND` in
 * `@labre/affine-gfx-c4`.
 */
export class C4BoardElementModel extends FrameworkBackgroundElementModel<C4BoardProps> {
  get type() {
    return 'c4Board';
  }

  @field('C4 diagram')
  accessor name: string = 'C4 diagram';

  @field(true)
  accessor resizeEnabled: boolean = true;

  @field(0)
  accessor rotate: number = 0;

  @field()
  accessor xywh: SerializedXYWH = '[0,0,1400,900]';

  /**
   * Which C4 level this sheet draws — the only OPTIONAL field of this element,
   * and optional on purpose.
   *
   * `@field()`'s `init` writes nothing for an `undefined` default, so a board
   * that never states its level stays byte-identical to one created before this
   * value existed: no schema version bump, no migration, and every document
   * already on disk opens and paints exactly as it did. The same call
   * `C4BoundaryElementModel.variant` makes, for the same reason.
   *
   * ## Why there is no default to read, unlike the boundary's `variant`
   *
   * A boundary that says nothing still IS one of the two levels, and reading it
   * as `'system'` is the only answer a reader could give. A board that says
   * nothing is a different thing altogether: a free sketch, whose author has not
   * told the tool which of the three sheets they are drawing. Guessing would
   * hand every diagram already in existence a level nobody chose, and a rule
   * reading it would start indicting drawings on the strength of that guess.
   *
   * So absent stays absent, and the rules that read it evaluate nothing at all
   * on a board that declares none — no fact, no rule (PRD principle 8).
   */
  @field()
  accessor level: C4BoardLevel | undefined = undefined;
}
