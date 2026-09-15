import { mountShapeTextEditor } from '@labre/affine-gfx-shape';
import { mountTextElementEditor } from '@labre/affine-gfx-text';
import {
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
  type UmlNodeElementModel,
} from '@labre/affine-model';
import { GfxElementModelView } from '@labre/std/gfx';

import { umlComponentSiblings, umlGroupOf } from '../component.js';

/**
 * View for a UML node. Registering it ensures `gfx.view.get(model)` returns a
 * view (required so move / select / connector interactions work).
 *
 * ## Double-clicking the body edits the NAME — which is not on this element
 *
 * A UML artefact is a GROUP: the shape, plus the canvas TEXT elements that carry
 * its words, every one of them edited in place exactly like any other words on
 * the canvas (R16, and the same arrangement C4's recette of 28/08/2026 settled).
 * The shape itself carries no text at all. Which leaves a gesture with nowhere
 * obvious to go: the body is the biggest target in the component, double-clicking
 * a shape is how everybody in this editor starts typing, and the shape's own
 * inline editor would write into the one field that must stay empty — a "shadow"
 * name, invisible under the real one, disagreeing with it, exported by neither.
 *
 * So the gesture is ROUTED: a double-click on the body opens the NAME child's
 * own editor, `mountTextElementEditor` — the very same call `TextElementView`
 * makes when you double-click those words directly. The author gets one editor
 * for one name whichever half of the component they aimed at.
 *
 * ## `uml:name`, `uml:label` or `uml:lifeline-ident`, and why all three
 *
 * A compartmented artefact's first tier is `uml:name` — it is the NAME
 * COMPARTMENT of §11.4.4, a rectangle with a rule under it. An actor's and a use
 * case's single word is `uml:label`: the same tier, named differently because
 * there is no compartment for it to be a compartment OF. A lifeline's head is
 * `uml:lifeline-ident`, a third time: §17.3.4 prints a grammar for what goes in
 * it and the validation pack reads that grammar and no other (`roles.ts`). The
 * gesture is one gesture, so it accepts any of the three and takes whichever the
 * group holds — the kind is not consulted, which means an artefact regrouped by
 * hand still opens on the words it actually has.
 *
 * ## …except on an element that has no text child
 *
 * A node whose group was released and whose texts were deleted lands on
 * `mountShapeTextEditor` and gets the native behaviour rather than nothing at
 * all. Same fallback C4's node view keeps, and for the same reason: a gesture
 * that silently does nothing reads as a broken editor.
 *
 * Hit testing is `UmlNodeElementModel.includesPoint`'s doing: the glyph-bodied
 * kinds are created unfilled, and an empty unfilled shape would normally be a
 * target only near its border. The override forces the interior test, so the
 * whole body answers this gesture on all eight kinds.
 */
export class UmlNodeView extends GfxElementModelView<UmlNodeElementModel> {
  static override type: string = 'umlNode';

  override onCreated(): void {
    super.onCreated();
    this.on('dblclick', () => {
      const edgeless = this.std.view.getBlock(this.std.store.root!.id);
      if (!edgeless || this.model.isLocked()) return;

      const name = this.#name();
      if (name) {
        if (!name.isLocked()) mountTextElementEditor(name, edgeless);
        return;
      }
      // No text child: the words really are the shape's own inner text.
      if (this.model instanceof ShapeElementModel) {
        mountShapeTextEditor(this.model, edgeless);
      }
    });
  }

  /**
   * The `uml:name` (or `uml:label`, or `uml:lifeline-ident`) text grouped with
   * this shape, if any.
   */
  #name(): TextElementModel | null {
    const surface = this.gfx.surface;
    if (!surface) return null;
    const groups = surface.elementModels.filter(
      (element): element is GroupElementModel =>
        element instanceof GroupElementModel
    );
    const group = umlGroupOf(this.model.id, groups);
    if (!group) return null;

    // The same pure resolution the exporter uses — group membership, then roles
    // — so the words this gesture opens are the words the file comes out with.
    const component = umlComponentSiblings(group, surface.elementModels);
    const tier = component.name ?? component.label ?? component.ident;
    const element = tier && surface.getElementById(tier.id);
    return element instanceof TextElementModel ? element : null;
  }
}
