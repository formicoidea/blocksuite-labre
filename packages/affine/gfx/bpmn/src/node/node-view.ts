import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import {
  type BpmnNodeElementModel,
  ShapeElementModel,
} from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { bpmnLabelMode } from '../consts.js';

/**
 * Whether a double-click on this node opens the shape's own inner-text editor.
 *
 * An INSCRIBED kind (activities, annotation, group) wears its name inside the
 * shape, so the gesture lands there, exactly like a native shape.
 *
 * An EXTERNAL kind (events, gateways, data shapes) wears its name as a separate
 * `bpmn:label` text grouped under it (R38), which is edited by double-clicking
 * that text — `TextElementView`'s job, not this one's. The symbol itself has
 * nothing to open, the same answer Wardley's node view gives its circles: an
 * editor mounted here would write a second, invisible name into a field that
 * must stay empty. No redirect to the label either: Wardley does not redirect,
 * and the label is one click away inside the group.
 *
 * The one exception is a LEGACY node: an event drawn before R38 may carry inner
 * text (nothing is migrated, `BPMN_EXTERNAL_LABEL_KINDS`). That text is still
 * painted, so it must still be editable — hence "already has text" reopens
 * the editor, and emptying it closes the door behind it.
 */
export function bpmnNodeEditsInnerText(model: BpmnNodeElementModel): boolean {
  if (bpmnLabelMode(model.kind) === 'inscribed') return true;
  return (model.text?.length ?? 0) > 0;
}

/**
 * View for a BPMN flow-object node. Registering it ensures `gfx.view.get(model)`
 * returns a view (required so move / select / connector interactions work).
 *
 * BPMN nodes are native shapes, so an inscribed kind reuses the shape
 * inner-text editor: a double-click mounts the editable text overlay
 * (`mountShapeTextEditor`), exactly like a native shape. Which kinds do is
 * {@link bpmnNodeEditsInnerText}'s call.
 *
 * Mirrors {@link EdgyNodeView}.
 */
export class BpmnNodeView extends GfxElementModelView<BpmnNodeElementModel> {
  static override type: string = 'bpmnNode';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      const edgeless = this.std.view.getBlock(this.std.store.root!.id);
      if (
        edgeless &&
        !this.model.isLocked() &&
        this.model instanceof ShapeElementModel &&
        bpmnNodeEditsInnerText(this.model)
      ) {
        mountShapeTextEditor(this.model, edgeless);
      }
    });
  }
}
