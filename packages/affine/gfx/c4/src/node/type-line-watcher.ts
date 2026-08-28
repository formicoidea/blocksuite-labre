import {
  C4NodeElementModel,
  type C4NodeKind,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { InteractivityExtension } from '@labre/std/gfx';

import { c4ComponentSiblings } from '../component';
import { C4_ROLE } from '../roles';
import { normalizeC4TypeLine } from '../type-line';

/**
 * Keeps a component's type line SEMI-DERIVED: the author owns the technology,
 * the notation owns the word.
 *
 * ## The rule, and where it is applied
 *
 * `[Container: Java]` is two statements in one line. Which of the four levels
 * this box is, is the diagram's — it comes from `kind`, it is what the renderer
 * paints and what the exporter maps, and an author retyping it would let the
 * words disagree with the picture. What it is built with is theirs, and it is
 * the only half the notation leaves to them (PO arbitration, 28/08/2026).
 *
 * Since the tier is a real canvas text element that half is typed IN PLACE, on
 * the picture, with nothing standing between the keyboard and the document. So
 * this watcher reads back what was typed, keeps the technology, and rewrites the
 * canonical line: `Java` becomes `[Container: Java]`, `[Person: Java]` on a
 * container becomes `[Container: Java]`, an emptied line becomes `[Container]`.
 *
 * ## Why the seam is the SELECTION and not `elementUpdated`
 *
 * The obvious hook is `surface.elementUpdated` filtered on `props.text`, which
 * is how every other reaction in this library is wired. It is the wrong one
 * here, and visibly so: a canvas text editor binds its inline editor straight
 * onto the element's `Y.Text`, so that signal fires once per KEYSTROKE. A
 * normalizer on it would rewrite the line under the cursor while somebody was
 * still typing into it — an author who has got as far as `[Container: Ja` would
 * have their caret thrown by a rewrite of the very text they are editing.
 *
 * "The edit committed" is therefore read where the editor actually says so: the
 * text editor holds an EDITING selection for as long as it is mounted and drops
 * it when it closes, so an id leaving the editing set is a commit and nothing
 * else is. One rewrite per edit, after the editor is gone, and a single undo
 * entry for it.
 *
 * ## Always-on, and local-only
 *
 * Registered by the RENDER half, not the flag-gated one (`docs/adr/0009`): this
 * does not author anything: it keeps an element that is ALREADY in the document
 * readable while somebody edits it, and a diagram drawn while the C4 button was
 * on must stay editable when it goes off. It is also inherently local — a
 * selection is this peer's own, so there is no fleet of observers to filter out
 * the way `EdgyRelationResolver` has to.
 */
export class C4TypeLineWatcher extends InteractivityExtension {
  static override key = 'c4-type-line-watcher';

  private _subscription: { unsubscribe(): void } | null = null;

  private _editing: ReadonlySet<string> = new Set();

  override mounted() {
    this._subscription = this.gfx.selection.slots.updated.subscribe(
      selections => {
        const { editing, left } = c4EditingTransition(
          this._editing,
          selections
        );
        this._editing = editing;
        for (const id of left) this._normalize(id);
      }
    );
  }

  override unmounted() {
    this._subscription?.unsubscribe();
    this._subscription = null;
    this._editing = new Set();
    super.unmounted();
  }

  /** The kind of the C4 shape this element is grouped with, if there is one. */
  private _kindOf(elementId: string): C4NodeKind | null {
    const surface = this.gfx.surface;
    if (!surface) return null;
    const groups = surface.elementModels.filter(
      (element): element is GroupElementModel =>
        element instanceof GroupElementModel
    );
    for (const siblingId of c4ComponentSiblings(elementId, groups)) {
      const sibling = surface.getElementById(siblingId);
      if (sibling instanceof C4NodeElementModel) return sibling.kind;
    }
    return null;
  }

  private _normalize(elementId: string) {
    // A read-only document is READ: every write below would be refused, and the
    // author cannot have typed anything to normalize in the first place.
    if (this.std.store.readonly) return;
    const surface = this.gfx.surface;
    if (!surface) return;

    const element = surface.getElementById(elementId);
    if (!(element instanceof TextElementModel)) return;
    if (element.role !== C4_ROLE['type-line']) return;
    if (element.isLocked()) return;

    const kind = this._kindOf(elementId);
    // A type line whose shape is gone — the node deleted, the group released
    // and the text dragged away — has no kind to derive a word from. Left
    // exactly as the author typed it: guessing at a level would be this watcher
    // asserting something nobody drew.
    if (!kind) return;

    const raw = element.text.toString();
    const canonical = normalizeC4TypeLine(kind, raw);
    if (canonical === raw) return;

    this.std.store.captureSync();
    // Mutated IN PLACE rather than replaced: the `Y.Text` instance is what the
    // element's own change watcher and any bound view hold, and swapping it for
    // a fresh one would leave both pointing at a text nobody is editing. One
    // transaction, so the rewrite is one undo entry and not two.
    this.std.store.transact(() => {
      element.text.delete(0, element.text.length);
      element.text.insert(0, canonical);
    });
  }
}

/**
 * Which ids just stopped being edited, and what is being edited now.
 *
 * Split out as a pure function because it is the whole of the seam's logic and
 * the only part of it worth being wrong about: an id that appears in the new
 * editing set has merely started, an id in both is still going, and only one
 * that has LEFT is a commit. Kept total over an empty selection, which is what
 * arrives when the editor closes onto bare canvas.
 */
export function c4EditingTransition(
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
