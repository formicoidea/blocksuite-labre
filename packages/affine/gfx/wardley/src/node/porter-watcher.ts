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
 * the `wardley:competition` tag on it are two spellings of the same statement.
 *
 * ## Why there are two spellings at all
 *
 * The letter is the NOTATION — an architect reads `L` off the map and knows
 * what it says, and typing another letter is the whole of the edit
 * (`node-view.ts`). The tag is the FACT — the half a rule, a reading or a host
 * report can query, because nothing can ask "which forces does this map name?"
 * of a `Y.Text` holding one character. Dropping either would cost something
 * real, so both exist.
 *
 * ## The invariant: the tag is DERIVED from the letter
 *
 * The two are not symmetric, and the recette of #211 is what made the asymmetry
 * necessary. The letter is what the author writes; the tag is a reading of it,
 * recomputed on EVERY local change of the text and written as a consequence of
 * that change rather than as a step of its own. So `tag = f(text)` holds at
 * every instant, including at every instant an undo or a redo passes through.
 *
 * That is the fix for the defect the recette found. Reconciling only when the
 * editor closed left the two able to disagree: the inline editor writes a
 * select-all-and-retype as several Yjs operations, each its own undo entry,
 * while the tag was one further entry captured after all of them. Undoing then
 * landed on an intermediate text — `RR` — carrying the tag of the text that
 * came after it, and redoing past the tag's own entry re-ran the reconciliation
 * against a text that had already moved on, so the document never returned to
 * where it started.
 *
 * The reading is taken on a MICROTASK after the change, and written UNTRACKED
 * (`Store.withoutTransact`, an origin the undo manager ignores). So the undo
 * stack holds the author's keystrokes and nothing else, and whatever text a
 * step lands on — `E`, the intermediate `RR`, the original `R` — the tag is
 * recomputed from it a tick later. There is no entry to get out of order,
 * because the qualification is not an entry.
 *
 * ## Tag → letter, and why it is the quiet direction
 *
 * A menu pick is the one gesture that starts from the tag, so it — and only it
 * — redraws the letter. Two guards keep that from becoming a second author:
 *
 * - It compares the two SEMANTICALLY (`competitionOfPorterLetter(raw)`), never
 *   character by character. A circle reading `e` already says "struggle to
 *   establish", so a tag derived from it must not turn round and rewrite it to
 *   `E`. Without this the two directions would trade writes on every keystroke.
 * - It never runs while the id is in the EDITING set. That is C4's lesson
 *   (`C4TypeLineWatcher`): rewriting the text an author has their caret in
 *   throws that caret, and no letter is worth it.
 *
 * The one deliberate asymmetry: a CLEARED tag leaves the circle alone. Removing
 * a value from the menu is a statement about the qualification — "I no longer
 * claim which force this is" — and not about a map somebody is still reading.
 * The tie is re-tied by the next edit of the letter, which is the only gesture
 * that ever asserts one.
 *
 * ## `local`, and always-on
 *
 * Both directions are LOCAL-only, for `EdgyRelationResolver`'s reason: without
 * it every peer on a shared board would derive the same tag the moment a letter
 * synced, giving N−1 of them an entry for a gesture they did not make.
 *
 * Registered by the RENDER half rather than the flag-gated one
 * (`docs/adr/0009`): this creates no element, offers no button and adds no
 * artefact to any map. It keeps an element ALREADY in the document coherent
 * with itself, which a force drawn while the Wardley button was on must stay
 * when the button goes off.
 */
export class WardleyPorterWatcher extends InteractivityExtension {
  static override key = 'wardley-porter-watcher';

  private _selection: { unsubscribe(): void } | null = null;

  private _updated: { unsubscribe(): void } | null = null;

  private _disposeSurface: (() => void) | null = null;

  private _editing: ReadonlySet<string> = new Set();

  private _pending = new Set<string>();

  private _scheduled = false;

  private _mounted = false;

  override mounted() {
    this._mounted = true;
    // The editing set is tracked for ONE purpose: to know whose caret is where,
    // so the tag→letter direction never rewrites a circle somebody is inside.
    this._selection = this.gfx.selection.slots.updated.subscribe(selections => {
      this._editing = wardleyEditingIds(selections);
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
          if (!local || !props) return;
          // `watchText` bridges the nested `Y.Text` under this key, so this is
          // every change of the letter — a keystroke, an undo, a redo alike.
          if ('text' in props) this._scheduleDerive(id);
          // `observeTags` republishes the nested map under the field's own key,
          // so this is the one payload a qualification produces.
          if (ELEMENT_TAGS_FIELD in props) this._drawLetterFromTag(id);
        }
      );
    });
  }

  override unmounted() {
    this._mounted = false;
    this._pending.clear();
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

  /**
   * Queue a re-reading of the letter, for the end of the current task.
   *
   * A MICROTASK, and it is load-bearing rather than cosmetic. `watchText` fires
   * from inside the Yjs transaction that changed the text, and at that instant
   * the element's own `Y.Map` observer may not have run yet — so `element.tags`
   * can still resolve, through `_preserved`, to a nested map the very same
   * transaction has just deleted. A tag written into that map goes nowhere at
   * all: the recette of #211 saw exactly that, as an undo landing on a letter
   * whose force had silently failed to follow it.
   *
   * Deferring past the transaction settles two things at once. The document is
   * consistent when the reading is taken, and the write lands OUTSIDE any
   * tracked transaction — so {@link Store.withoutTransact} really does keep it
   * off the undo stack, and the tag becomes what it claims to be: a pure
   * function of the text, recomputed after every change of it, in either
   * direction of history, and never a step an author has to undo.
   */
  private _scheduleDerive(elementId: string) {
    this._pending.add(elementId);
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      const ids = [...this._pending];
      this._pending.clear();
      if (!this._mounted) return;
      for (const id of ids) this._deriveTagFromText(id);
    });
  }

  /** The letter as it now stands, written down as the fact it states. */
  private _deriveTagFromText(elementId: string) {
    const element = this._porter(elementId);
    if (!element) return;

    const value = competitionOfPorterLetter(element.text?.toString());
    // Anything that is not one of the three — a half-typed `RR`, a stray word,
    // an emptied circle — carries no tag. A glyph nobody can read must not be
    // reported as a force somebody named, and an INTERMEDIATE state an undo
    // stops on is exactly such a glyph.
    const next = value ? [value] : [];
    const current = elementTagValues(element, WARDLEY_COMPETITION_TAG_ID);
    if (
      current.length === next.length &&
      current.every((v, i) => v === next[i])
    )
      return;

    // No `captureSync`, and UNTRACKED. The tag is a consequence of the letter,
    // never a step of its own: `withoutTransact` writes with an origin the undo
    // manager ignores, so an author undoes the letter they typed and the
    // reading of it simply follows, in either direction, for ever.
    this.std.store.withoutTransact(() => {
      setElementTag(element, WARDLEY_COMPETITION_TAG_ID, next);
    });
  }

  /** The value just picked from the menu, drawn as the letter it stands for. */
  private _drawLetterFromTag(elementId: string) {
    const element = this._porter(elementId);
    if (!element) return;
    // Never into a circle somebody has their caret in (`C4TypeLineWatcher`).
    if (this._editing.has(elementId)) return;

    const value = elementTagValues(element, WARDLEY_COMPETITION_TAG_ID)[0];
    const letter = porterLetterOfCompetition(value);
    // A cleared tag — and a value whose def has vanished, which has no letter
    // either — leaves the circle exactly as it is. See the class comment: this
    // is the one deliberate asymmetry.
    if (!letter) return;

    const text = element.text;
    if (!text) return;
    const raw = text.toString();
    // SEMANTICALLY, not character by character: a circle reading `e` already
    // says this value, and rewriting it to `E` would be this watcher answering
    // its own derivation on every keystroke.
    if (competitionOfPorterLetter(raw) === value) return;

    // No `captureSync` either: this only ever runs as a consequence of the tag
    // write that caused it, and it nests into that write's transaction — so a
    // menu pick costs exactly one undo entry, redrawing included.
    //
    // Mutated IN PLACE rather than replaced, as `C4TypeLineWatcher` does: the
    // `Y.Text` instance is what the element's change watcher and any bound
    // editor hold, and swapping it for a fresh one would leave both pointing at
    // a text nobody is editing.
    this.std.store.transact(() => {
      text.delete(0, text.length);
      text.insert(0, letter);
    });
  }
}

/**
 * The ids currently being EDITED, out of a selection update.
 *
 * A pure function because it is the whole of what the watcher needs to know
 * about the selection: a text editor holds an editing selection for as long as
 * it is mounted and drops it when it closes, so this set is "whose caret is in
 * something right now" and nothing else. Total over an empty selection, which
 * is what arrives when an editor closes onto bare canvas.
 */
export function wardleyEditingIds(
  selections: readonly { elements: readonly string[]; editing?: boolean }[]
): Set<string> {
  const editing = new Set<string>();
  for (const selection of selections) {
    if (!selection.editing) continue;
    for (const id of selection.elements) editing.add(id);
  }
  return editing;
}
