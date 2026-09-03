import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import {
  ShapeElementModel,
  type WardleyNodeElementModel,
} from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

/**
 * View for a Wardley node. Registering it ensures `gfx.view.get(model)` returns
 * a view (required so move / select / connector interactions work).
 *
 * ## Double-clicking edits the letter — on the ONE kind that has one
 *
 * Every other Wardley artefact wears its name as a SEPARATE canvas text element
 * grouped beside it, so a double-click on the circle has nothing of its own to
 * open: the words live next door and are edited by double-clicking them, which
 * is `TextElementView`'s job and not this one's. Those kinds are deliberately
 * left alone.
 *
 * The `porter` is the exception, and it is the notation that makes it one. A
 * Porter's-forces glyph carries a LETTER — R relative competition, L struggle
 * for survival, E struggle to establish — and that letter is the shape's own
 * inner text, because it is one character in the middle of the circle rather
 * than a name written alongside it. So the gesture everybody in this editor
 * already makes has to land: `mountShapeTextEditor`, the same call EDGY's and
 * BPMN's node views make on their own inner text.
 *
 * Found by the recette of #210: the view had no handler at all and the node
 * toolbar offers no "add text" action, which left the letter unreachable — a
 * glyph whose whole meaning is one character nobody could change. The four
 * arrows are polygons OUTSIDE the rim (`presets.ts`), so the double-click at
 * the centre reaches this circle rather than a connector's oversized head.
 */
export class WardleyNodeView extends GfxElementModelView<WardleyNodeElementModel> {
  static override type: string = 'wardleyNode';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      // Only the porter: on every other kind the name is the text element next
      // to the circle, and opening the shape's own editor here would write a
      // second, invisible name into a field that must stay empty.
      if (this.model.kind !== 'porter') return;

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
