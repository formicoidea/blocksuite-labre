import {
  paletteColorAction,
  shapeToolbarConfig,
} from '@labre/affine-gfx-shape';
import { BpmnNodeElementModel } from '@labre/affine-model';
import {
  type ToolbarAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';

import { bpmnLabelMode } from '../consts.js';
import { BPMN_PALETTE_LIST } from './palette.js';

/**
 * The shape toolbar's actions a BPMN node keeps.
 *
 * A BPMN node IS a `ShapeElementModel`, so the shape actions (which target
 * `getSurfaceModelsByType(ShapeElementModel)`) operate on it directly — but
 * `renderToolbar` merges by flavour KEY, so none of them reach a node until a
 * module is registered on `affine:surface:bpmnNode`. This is that module, and
 * it keeps what Edgy keeps (the reference the PO cited):
 *
 * - `d.style` — the scribbled / general line style;
 * - `f.text` — "Add text", narrowed below to inscribed kinds;
 * - `f2.text-fit` and every `g.text-*` — they already hide themselves on a
 *   node with no inner text, which is every external kind drawn since R38.
 *
 * Dropped: `c.switch-type` (the KIND decides the native shape — a diamond is a
 * gateway because it is a gateway; turning it into an ellipse would paint a
 * start event's outline with a gateway's marker; "Change type" is the morph
 * module's job) and `f1.edit-vertices` (no BPMN symbol is a free polygon).
 */
const KEEP_FROM_SHAPE = (id: string) =>
  id === 'd.style' ||
  id === 'f.text' ||
  id === 'f2.text-fit' ||
  id.startsWith('g.text-');

/**
 * Every selected BPMN node wears its name INSIDE the shape.
 *
 * An event, a gateway or a data shape names itself with a grouped `bpmn:label`
 * text under the symbol (R38), so "Add text" on one would write a second,
 * inner name the notation never draws there. The gesture exists for the
 * inscribed kinds only — the same gate `bpmnNodeEditsInnerText` puts on the
 * double-click, minus the legacy exception: a legacy event's inner text is
 * already there, and "Add text" only ever shows on a node with none.
 */
export function bpmnSelectionIsInscribed(ctx: ToolbarContext): boolean {
  const models = ctx.getSurfaceModelsByType(BpmnNodeElementModel);
  return (
    models.length > 0 &&
    models.every(model => bpmnLabelMode(model.kind) === 'inscribed')
  );
}

/** Narrow a shape action's own `when` with {@link bpmnSelectionIsInscribed}. */
function inscribedOnly(action: ToolbarAction): ToolbarAction {
  const when = action.when;
  return {
    ...action,
    when: (ctx: ToolbarContext) =>
      bpmnSelectionIsInscribed(ctx) &&
      (typeof when === 'function' ? when(ctx) : when !== false),
  };
}

/**
 * Fill, stroke colour, stroke width and stroke style — the picker Edgy and
 * Wardley use, seeded with BPMN's two notation hues and the neutrals.
 * `paletteColorAction` and the shape's own `e.color` expose the same four
 * controls (both render `edgeless-shape-color-picker`, which carries the
 * width / style panel); the palette one is taken because it is Edgy's.
 *
 * On the glyph-bodied kinds (`dataObject`, `dataStore`, `textAnnotation`) the
 * native shape is born with `strokeStyle: None` and the renderer's glyph draws
 * the silhouette from `strokeColor` / `fillColor`. Picking a visible stroke
 * style there makes the native rectangle paint its outline around the glyph —
 * an honest result of the author's pick, so it is left to the author rather
 * than filtered out here.
 */
const bpmnColorAction = paletteColorAction('e.color', BPMN_PALETTE_LIST);

export const bpmnNodeToolbarConfig = {
  actions: [
    ...shapeToolbarConfig.actions
      .filter(action => KEEP_FROM_SHAPE(action.id))
      .map(action => (action.id === 'f.text' ? inscribedOnly(action) : action)),
    bpmnColorAction,
  ],
  when: shapeToolbarConfig.when,
} as ToolbarModuleConfig;

/**
 * The base shape features on a selected BPMN node, on the BARE flavour key.
 * Registered from the ALWAYS-ON view extension: recolouring or re-typesetting
 * a stored element is editing content, not tooling (`docs/adr/0009`). The
 * "Change type" morph, which IS tooling, takes an owner-suffixed key beside
 * it (`view.ts`).
 */
export const bpmnNodeToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('affine:surface:bpmnNode'),
  config: bpmnNodeToolbarConfig,
});
