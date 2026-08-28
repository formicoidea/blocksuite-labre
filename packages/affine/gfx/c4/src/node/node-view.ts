import { mountTextElementEditor } from '@labre/affine-gfx-text';
import {
  type C4NodeElementModel,
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import { GfxElementModelView } from '@labre/std/gfx';

import { c4ComponentSiblings } from '../component';
import { C4_ROLE } from '../roles';

/**
 * View for a C4 node. Registering it ensures `gfx.view.get(model)` returns a
 * view (required so move / select / connector interactions work).
 *
 * ## Double-clicking the body edits the NAME — which is not on this element
 *
 * Since the PO's follow-up to the recette of 28/08/2026 a C4 element's name is a
 * canvas `text` child stamped `c4:title`, grouped with the shape, and the shape
 * itself carries no text at all. Which leaves a gesture with nowhere obvious to
 * go: the body is the biggest target in the component, double-clicking a shape
 * is how everybody in this editor starts typing, and the shape's own inline
 * editor would write into the one field that must stay empty. A "shadow" name,
 * invisible under the real one, disagreeing with it, exported by neither.
 *
 * So the gesture is ROUTED: a double-click on the body opens the title child's
 * own editor, `mountTextElementEditor` — the very same call `TextElementView`
 * makes when you double-click those words directly. The author gets one editor
 * for one name whichever half of the component they aimed at, and the shape's
 * text path is never entered.
 *
 * The seam is cheap because the platform already had both halves: the title is
 * found through the group (`c4ComponentSiblings`, the same pure resolution the
 * exporter uses) and opened through the text package's own public mount. No new
 * editor, no new selection handling, no reimplementation of anything.
 *
 * ## …except on an element that has no title child
 *
 * One drawn before this change keeps its name in the shape's inner text, which
 * is where that iteration put it, and `mountShapeTextEditor` is then exactly
 * right — it is still that element's name. The same test the exporter makes
 * (`c4StatedName`), so the words a double-click edits are the words the file
 * comes out with. A node whose group was released and whose title was deleted
 * lands here too, and gets the old behaviour rather than nothing at all.
 *
 * Hit testing is `C4NodeElementModel.includesPoint`'s doing: an empty unfilled
 * shape would normally be a target only near its border, and the override forces
 * the interior test, so the whole body answers this gesture on all nine kinds.
 */
export class C4NodeView extends GfxElementModelView<C4NodeElementModel> {
  static override type: string = 'c4Node';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      const edgeless = this.std.view.getBlock(this.std.store.root!.id);
      if (!edgeless || this.model.isLocked()) return;

      const title = this.#title();
      if (title) {
        if (!title.isLocked()) mountTextElementEditor(title, edgeless);
        return;
      }
      // No title child: the name really is the shape's own text.
      if (this.model instanceof ShapeElementModel) {
        mountShapeTextEditor(this.model, edgeless);
      }
    });
  }

  /** The `c4:title` text grouped with this shape, if there is one. */
  #title(): TextElementModel | null {
    const surface = this.gfx.surface;
    if (!surface) return null;
    const groups = surface.elementModels.filter(
      (element): element is GroupElementModel =>
        element instanceof GroupElementModel
    );
    for (const siblingId of c4ComponentSiblings(this.model.id, groups)) {
      const sibling = surface.getElementById(siblingId);
      if (
        sibling instanceof TextElementModel &&
        sibling.role === C4_ROLE.title
      ) {
        return sibling;
      }
    }
    return null;
  }
}
