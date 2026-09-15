import { InteractivityExtension } from '@labre/std/gfx';

import { UML_ROLE } from '../roles.js';
import { type UmlFitSurface, umlFitComponent } from './fit.js';

/**
 * The four tier roles an edit can commit into.
 *
 * `uml:lifeline-ident` is deliberately NOT among them, and it is the one tier
 * this set leaves out: §17.3.4's head is painted at a fixed size across the top
 * of a 16-wide column (`consts.ts`, `UML_LIFELINE_HEAD`), so no amount of typing
 * in it can change the element's box — a lifeline resizes in HEIGHT and that is
 * the spine's length, not the words'. Accepting it as a trigger would mean
 * asking `umlStackHeight` a question it answers `null` to on every keystroke,
 * which is the work this set exists to avoid.
 */
const TIER_ROLES: ReadonlySet<string> = new Set([
  UML_ROLE.name,
  UML_ROLE.attributes,
  UML_ROLE.operations,
  // A glyph's single word. Accepted as a TRIGGER and almost always rejected a
  // step later: a label belongs to a picture — an actor, a use case, a port —
  // and `umlStackHeight` answers `null` for every one of them. It is in the set
  // so a hand-built group (a label regrouped with a class box) is asked the
  // question rather than silently skipped.
  UML_ROLE.label,
]);

/**
 * Keeps a classifier's BOX big enough for the words in it.
 *
 * ## The overflow, and why a pure layout cannot fix it
 *
 * `umlCompartmentBoxes` lays a divided rectangle out from the rectangle alone:
 * a margin, the name, a gap, THE LINE, three lines of attributes, THE SECOND
 * LINE, and the operations take the rest (§11.4.4). Three attribute lines is
 * what a fresh 200 × 120 class is sized for, and it is right until somebody
 * types a fourth — at which point the fourth line is drawn over the separator
 * under it, the fifth over the operations, and the box says nothing about it.
 * Nothing in a rectangle can say otherwise: how many lines a tier holds is a
 * fact about the TEXT.
 *
 * So the text is measured once, when an edit commits, and the two facts that
 * follow from it are written: the node grows to the height the stack now needs
 * (`umlStackHeight`), and the tiers move to the boxes that height yields. The
 * separators follow for free — the renderer reads them off the tiers
 * (`node-renderer.ts`), so the rule is drawn between the compartments as they
 * ARE rather than where a default-sized stack would have put them. The measuring
 * and the writing are {@link umlFitComponent}'s, shared with the morph.
 *
 * ## Why the seam is the SELECTION and not `elementUpdated`
 *
 * The same reason `C4TypeLineWatcher` gives, and it bites harder here. A canvas
 * text editor binds its inline editor straight onto the element's `Y.Text`, so
 * `surface.elementUpdated` fires once per KEYSTROKE: a re-layout on it would
 * move the box under the caret on the way to the fourth line and again on the
 * way back from it. The text editor holds an EDITING selection for as long as
 * it is mounted and drops it when it closes, so an id LEAVING that set is a
 * commit and nothing else is. One re-layout per edit, after the editor is gone,
 * and a single undo entry for it.
 *
 * It is also the seam that puts the tier BACK. The canvas text editor
 * shrink-wraps the element it is mounted on while the author types — it measures
 * the rich text on every render and writes the element's `xywh` from it — so a
 * tier left to itself ends an edit as a box the size of its words rather than as
 * a compartment. Writing the layout after the editor has closed is what makes
 * the compartment the last word.
 *
 * ## It grows, and never shrinks
 *
 * A box an author has dragged taller has dragged it taller FOR the operations
 * (`component.ts`), and §11.4.4 hands the bottom compartment whatever is left on
 * purpose — an author leaves themselves room to type. A watcher that reclaimed
 * it the moment a line was deleted would be undoing a gesture nobody asked it to
 * judge, and it would do so while the author was still working. So the height
 * only ever goes UP; deleting lines moves the separators up (the tiers are
 * re-laid either way) and leaves the box where it was put.
 *
 * ## Always-on, and local-only
 *
 * Registered by the RENDER half, not the flag-gated one (`docs/adr/0009`): it
 * authors nothing — no element created, no field added — it keeps words that are
 * ALREADY in the document readable, and a diagram drawn while the UML button was
 * on must stay editable when it goes off.
 *
 * It is also inherently local, which is what stands in for the `local` guard
 * every `elementUpdated` cascade needs (`docs/contribute/07-dev-practices.md`):
 * the only input is THIS peer's selection. A remote peer typing five lines into
 * a tier moves no editing selection here, so no re-layout is attempted on their
 * behalf and the fleet cannot re-apply one write each. An undo is the same story
 * from the other side: it mounts no editor and closes none, so nothing leaves
 * the editing set and the restored box stays restored.
 */
export class UmlCompartmentWatcher extends InteractivityExtension {
  static override key = 'uml-compartment-watcher';

  private _subscription: { unsubscribe(): void } | null = null;

  private _editing: ReadonlySet<string> = new Set();

  override mounted() {
    this._subscription = this.gfx.selection.slots.updated.subscribe(
      selections => {
        const { editing, left } = umlEditingTransition(
          this._editing,
          selections
        );
        this._editing = editing;
        for (const id of left) this._fit(id);
      }
    );
  }

  override unmounted() {
    this._subscription?.unsubscribe();
    this._subscription = null;
    this._editing = new Set();
    super.unmounted();
  }

  /**
   * Re-fit the classifier the committed tier belongs to.
   *
   * This is the TRIGGER and nothing else: what was committed has to be one of
   * the tiers a classifier's stack is made of, or there is nothing about the
   * layout for an edit to have changed. Everything past that — resolving the
   * component, measuring the words, growing the box — is {@link umlFitComponent},
   * which the morph reaches for too (`morph.ts`) so a keyword line written by a
   * "Change type" lands in a compartment as surely as a typed one does.
   */
  private _fit(elementId: string) {
    const surface = this.gfx.surface;
    if (!surface) return;

    const tier = surface.getElementById(elementId) as {
      type?: string;
      role?: string;
    } | null;
    if (!tier || tier.type !== 'text') return;
    if (tier.role === undefined || !TIER_ROLES.has(tier.role)) return;

    umlFitComponent(
      surface as unknown as UmlFitSurface,
      this.std.store,
      elementId
    );
  }
}

/**
 * Which ids just stopped being edited, and what is being edited now.
 *
 * Deliberately a copy of `c4EditingTransition` rather than a shared helper: the
 * framework packs are independent by design (`docs/adr/0015`), this is nine
 * lines of set arithmetic, and a framework module importing another framework
 * module for it would be the first such edge in the library. If a third pack
 * needs it, `std/gfx` is where it moves — not into whichever pack wrote it
 * first.
 *
 * Pure, and exported, because it is the whole of the seam's logic and the only
 * part of it worth being wrong about: an id that appears in the new editing set
 * has merely STARTED, an id in both is still going, and only one that has LEFT
 * is a commit. Total over an empty selection, which is what arrives when the
 * editor closes onto bare canvas.
 */
export function umlEditingTransition(
  previous: ReadonlySet<string>,
  selections: readonly { elements: readonly string[]; editing?: boolean }[]
): { editing: Set<string>; left: string[] } {
  const editing = new Set<string>();
  for (const selection of selections) {
    if (!selection.editing) continue;
    for (const id of selection.elements) editing.add(id);
  }
  const left: string[] = [];
  for (const id of previous) if (!editing.has(id)) left.push(id);
  return { editing, left };
}
