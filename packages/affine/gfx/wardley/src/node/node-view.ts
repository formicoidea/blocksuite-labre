import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import {
  ShapeElementModel,
  type WardleyNodeElementModel,
} from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { WARDLEY_ROLE } from '../roles.js';

/**
 * The kinds whose NAME is the shape's own inner text, each paired with the role
 * an element of that kind carries when it is the artefact itself.
 *
 * A pair and not a list, because `kind` alone admits too much: the porter's
 * four arrows are `wardleyNode`s of kind `porter` carrying no role at all, and
 * a gate on the kind would hand each of them an editor for text they must never
 * have. Anything not in this table is a kind that wears its name as a text
 * element beside it, and its own inner text must stay empty.
 */
const NAMES_ITSELF: Partial<Record<string, string>> = {
  porter: WARDLEY_ROLE.porter,
  area: WARDLEY_ROLE.area,
};

/**
 * View for a Wardley node. Registering it ensures `gfx.view.get(model)` returns
 * a view (required so move / select / connector interactions work).
 *
 * ## Double-clicking edits the inner text — on the TWO kinds that have one
 *
 * Every other Wardley artefact wears its name as a SEPARATE canvas text element
 * grouped beside it, so a double-click on the circle has nothing of its own to
 * open: the words live next door and are edited by double-clicking them, which
 * is `TextElementView`'s job and not this one's. Those kinds are deliberately
 * left alone.
 *
 * The `porter` is the first exception, and it is the notation that makes it
 * one. A Porter's-forces glyph carries a LETTER — R relative competition, L
 * struggle for survival, E struggle to establish — and that letter is the
 * shape's own inner text, because it is one character in the middle of the
 * circle rather than a name written alongside it. So the gesture everybody in
 * this editor already makes has to land: `mountShapeTextEditor`, the same call
 * EDGY's and BPMN's node views make on their own inner text.
 *
 * Found by the recette of #210: the view had no handler at all and the node
 * toolbar offers no "add text" action, which left the letter unreachable — a
 * glyph whose whole meaning is one character nobody could change. The four
 * arrows are polygons OUTSIDE the rim (`presets.ts`), so the double-click at
 * the centre reaches this circle rather than a connector's oversized head.
 *
 * The `area` is the second, and for a different reason: a zone's name belongs
 * INSIDE the zone rather than beside it — a label parked outside a boundary
 * would name whatever else happens to be there. It is created with no text at
 * all, so the double-click opens the editor on an empty line and the first
 * thing typed is the zone's name (`mountShapeTextEditor` mints the `Y.Text`).
 *
 * ## …and only on the artefact, never on its wiring
 *
 * The four arrows are `wardleyNode`s too — `kind: 'porter'`, ROLE-LESS, the
 * market's three inner dots exactly — so `kind` alone would hand each of them
 * the same editor. The role is what separates the artefact the author placed
 * from the glyph's own wiring, so it is the second half of the gate, and it is
 * the half that also makes the gate safe to extend: a kind is admitted with the
 * role that proves the element is the artefact rather than a part of one.
 *
 * That pair is also why they are `wardleyNode`s at all. Recette v2 found them
 * as plain shapes, and `ShapeElementView` gives EVERY plain shape a
 * double-click that mounts the inner-text editor: an arrow grew from 24 units
 * high to 44 the moment one was opened, and the deformation survived Escape. An
 * arrow is not a thing you write in, and this view is where that is said.
 */
export class WardleyNodeView extends GfxElementModelView<WardleyNodeElementModel> {
  static override type: string = 'wardleyNode';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      // Only the porter CIRCLE and the area. The kind alone is not enough: the
      // porter's four arrows share its kind and are told apart by carrying no
      // role, exactly as the market's inner dots are — hence a table of
      // kind → the role the ARTEFACT carries, and an element that fails to
      // match is either a glyph's own wiring or a kind whose name is the text
      // element beside it. Opening the shape's own editor on those would write
      // a second, invisible name into a field that must stay empty.
      const named = NAMES_ITSELF[this.model.kind];
      if (named === undefined || this.model.role !== named) return;

      const edgeless = this.std.view.getBlock(this.std.store.root!.id);
      if (
        edgeless &&
        !this.std.store.readonly &&
        !this.model.isLocked() &&
        this.model instanceof ShapeElementModel
      ) {
        mountShapeTextEditor(this.model, edgeless);
      }
    });
  }
}
