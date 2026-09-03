import { WardleyNodeElementModel } from '@labre/affine-model';
import {
  ELEMENT_TAGS_FIELD,
  elementTagValues,
  InteractivityExtension,
  setElementTag,
} from '@labre/std/gfx';

import { WARDLEY_COMPETITION_TAG_ID } from '../natures';
import {
  competitionOfPorterLetter,
  porterLetterOfCompetition,
} from '../porter-competition';

/**
 * Keeps a Porter's-forces glyph saying ONE thing: the letter in the circle and
 * the `wardley:competition` tag on it are two spellings of the same statement,
 * and this watcher is what stops them drifting apart.
 *
 * ## Why there are two spellings at all
 *
 * The letter is the NOTATION — an architect reads `L` off the map and knows
 * what it says, and typing another letter is the whole of the edit
 * (`node-view.ts`). The tag is the FACT — the half a rule, a reading or a host
 * report can query, because nothing can ask "which forces does this map name?"
 * of a `Y.Text` holding one character. Dropping either would cost something
 * real, so both exist and neither is the master: whichever one the author is
 * looking at is the one they may change.
 *
 * ## The two seams, and why they are different seams
 *
 * **Letter → tag** is read off the SELECTION, exactly as `C4TypeLineWatcher`
 * reads its own commit and for exactly its reason: the canvas text editor binds
 * its inline editor straight onto the element's `Y.Text`, so "the text changed"
 * fires once per KEYSTROKE. Writing a tag on it would qualify the glyph as `R`
 * the instant somebody pressing `RL` got as far as the first character — and
 * then, through the other direction, rewrite the letter under their cursor. The
 * editor holds an EDITING selection while it is mounted and drops it when it
 * closes, so an id LEAVING that set is a commit and nothing else is.
 *
 * **Tag → letter** is read off `elementUpdated`, because a menu pick has no
 * intermediate states to protect: the value is written whole, once, by
 * `tag.set`. It is filtered on `local` for `EdgyRelationResolver`'s reason —
 * without it every peer on a shared board would rewrite the same letter the
 * moment it synced, giving N−1 of them an undo entry for a gesture they did not
 * make.
 *
 * ## Why the two cannot loop
 *
 * Neither direction writes when the two already agree, and each direction's
 * write lands in the shape the OTHER direction reads as agreement: a tag pick
 * writes the letter that value implies, and the resulting `elementUpdated`
 * finds the letter already right; a committed letter writes the value it
 * implies, and the resulting text is the one the tag names. One write per
 * gesture, one undo entry, and a fixed point after it. Pinned by the
 * idempotence tests in `porter-competition.unit.spec.ts`.
 *
 * ## Always-on, and it authors nothing
 *
 * Registered by the RENDER half rather than the flag-gated one
 * (`docs/adr/0009`): this creates no element, offers no button and adds no
 * artefact to any map. It keeps an element ALREADY in the document coherent
 * with itself, and a force drawn while the Wardley button was on must stay
 * coherent when it goes off — the tag written on it is read by nothing until
 * the flag comes back, which is precisely why keeping it true costs nothing.
 */
export class WardleyPorterWatcher extends InteractivityExtension {
  static override key = 'wardley-porter-watcher';

  private _selection: { unsubscribe(): void } | null = null;

  private _updated: { unsubscribe(): void } | null = null;

  private _disposeSurface: (() => void) | null = null;

  private _editing: ReadonlySet<string> = new Set();

  override mounted() {
    this._selection = this.gfx.selection.slots.updated.subscribe(selections => {
      const { editing, left } = wardleyEditingTransition(
        this._editing,
        selections
      );
      this._editing = editing;
      for (const id of left) this._writeTagFromLetter(id);
    });

    // The surface is a SIGNAL — null at mount on a document whose surface block
    // has not arrived yet, and replaced when it is. Subscribing to the signal
    // rather than reading it once is what `EdgyRelationResolver` does, and for
    // the same reason: a subscription taken against a surface that no longer
    // exists is a subscription to nothing.
    this._disposeSurface = this.gfx.surface$.subscribe(surface => {
      this._updated?.unsubscribe();
      this._updated = null;
      if (!surface) return;
      this._updated = surface.elementUpdated.subscribe(
        ({ id, props, local }) => {
          if (!local) return;
          // `observeTags` republishes the nested map under the field's own key,
          // so this is the one payload a qualification produces — and every
          // other prop (a drag, a restyle, the letter itself) must not reach the
          // rewrite below.
          if (!props || !(ELEMENT_TAGS_FIELD in props)) return;
          this._writeLetterFromTag(id);
        }
      );
    });
  }

  override unmounted() {
    this._selection?.unsubscribe();
    this._selection = null;
    this._updated?.unsubscribe();
    this._updated = null;
    this._disposeSurface?.();
    this._disposeSurface = null;
    this._editing = new Set();
    super.unmounted();
  }

  /** The porter this id names, when it is one this peer may rewrite. */
  private _porter(elementId: string): WardleyNodeElementModel | null {
    // A read-only document is READ: every write below would be refused, and
    // nobody can have typed a letter into it in the first place.
    if (this.std.store.readonly) return null;
    const element = this.gfx.surface?.getElementById(elementId);
    if (!(element instanceof WardleyNodeElementModel)) return null;
    if (element.kind !== 'porter') return null;
    if (element.isLocked()) return null;
    return element;
  }

  /** The letter just committed, written down as the fact it states. */
  private _writeTagFromLetter(elementId: string) {
    const element = this._porter(elementId);
    if (!element) return;

    const value = competitionOfPorterLetter(element.text?.toString());
    // Anything that is not one of the three — a second letter, a stray word, an
    // emptied circle — removes the tag. A glyph nobody can read must not be
    // reported as a force somebody named.
    const next = value ? [value] : [];
    const current = elementTagValues(element, WARDLEY_COMPETITION_TAG_ID);
    if (
      current.length === next.length &&
      current.every((v, i) => v === next[i])
    )
      return;

    // Owed BEFORE the write, like every other qualification site: the undo
    // manager is built with no `captureTimeout`, so without it the tag would be
    // undone together with whatever the author did in the previous 500 ms.
    this.std.store.captureSync();
    setElementTag(element, WARDLEY_COMPETITION_TAG_ID, next);
  }

  /** The value just picked, drawn as the letter it stands for. */
  private _writeLetterFromTag(elementId: string) {
    const element = this._porter(elementId);
    if (!element) return;

    const letter = porterLetterOfCompetition(
      elementTagValues(element, WARDLEY_COMPETITION_TAG_ID)[0]
    );
    // A CLEARED tag leaves the circle exactly as it is, and that asymmetry is
    // the design. Un-picking a value in the menu is a statement about the
    // qualification — "I no longer claim which force this is" — and not about
    // the drawing; blanking the glyph would delete a letter the author never
    // touched, from a map they are still reading. The same holds for a value
    // whose def has vanished: it has no letter, so there is nothing to draw.
    if (!letter) return;

    const text = element.text;
    if (!text) return;
    const raw = text.toString();
    if (raw === letter) return;

    this.std.store.captureSync();
    // Mutated IN PLACE rather than replaced, exactly as `C4TypeLineWatcher`
    // does: the `Y.Text` instance is what the element's change watcher and any
    // bound editor hold, and swapping it for a fresh one would leave both
    // pointing at a text nobody is editing. One transaction, so the rewrite is
    // one undo entry and not two.
    this.std.store.transact(() => {
      text.delete(0, text.length);
      text.insert(0, letter);
    });
  }
}

/**
 * Which ids just stopped being edited, and what is being edited now.
 *
 * A local copy of the seam `C4TypeLineWatcher` documents, and deliberately not
 * an import of it: the two frameworks are independent packages, and Wardley
 * reaching into C4 for four lines would make a change to C4's notation a
 * change to Wardley's. Split out as a pure function because it is the whole of
 * the seam's logic — an id that APPEARS in the new editing set has merely
 * started, an id in both is still going, and only one that has LEFT is a
 * commit. Total over an empty selection, which is what arrives when the editor
 * closes onto bare canvas.
 */
export function wardleyEditingTransition(
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
