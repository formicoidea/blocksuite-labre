import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import {
  type C4NodeElementModel,
  ShapeElementModel,
} from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

/**
 * View for a C4 node. Registering it ensures `gfx.view.get(model)` returns a
 * view (required so move / select / connector interactions work).
 *
 * C4 nodes are native shapes, so we reuse the shape inner-text editor: a
 * double-click mounts the editable text overlay (`mountShapeTextEditor`),
 * exactly like a native shape. That editor is the whole labelling story of this
 * pack — a C4 box is its words.
 *
 * Mirrors {@link BpmnNodeView}.
 */
export class C4NodeView extends GfxElementModelView<C4NodeElementModel> {
  static override type: string = 'c4Node';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      const edgeless = this.std.view.getBlock(this.std.store.root!.id);
      if (
        edgeless &&
        !this.model.isLocked() &&
        this.model instanceof ShapeElementModel
      ) {
        mountShapeTextEditor(this.model, edgeless);
      }
    });
  }
}
