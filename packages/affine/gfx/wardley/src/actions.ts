import {
  backgroundSize,
  containingFrame,
  DefaultTool,
  indexOverBackgrounds,
  runInterchangeImportFile,
  type StackedElement,
} from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createGroupCommand } from '@labre/affine-gfx-group';
import { PolygonTool } from '@labre/affine-gfx-shape';
import {
  ConnectorMode,
  FontWeight,
  FrameworkBackgroundElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  type WardleyBgVariant,
} from '@labre/affine-model';
import {
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { WARDLEY_BACKGROUND } from './background';
import { WARDLEY_SVG_IMPORT } from './interchange';
import {
  type WardleyExportBoard,
  wardleyBoardFrom,
  wardleySafeFilename,
} from './export';
import { WARDLEY_OWM_EXPORT, WARDLEY_OWM_IMPORT } from './interchange';
import { INERTIA_SIZE, PORTER_DEFAULT_LETTER } from './node/consts';
import {
  type WardleyAreaShape,
  wardleyAreaBox,
  wardleyAreaProps,
  type WardleyArtefactKind,
  wardleyCanonicalBox,
  WARDLEY_EDGE_STYLE,
  wardleyHandleBox,
  wardleyHandleProps,
  wardleyInertiaProps,
  wardleyLabelBoxFor,
  wardleyLabelProps,
  wardleyMarketDotBoxes,
  wardleyMarketDotProps,
  wardleyMarketLinkPairs,
  wardleyMarketLinkProps,
  WARDLEY_NODE_LABEL,
  wardleyNodeLabelKey,
  wardleyNodeProps,
  wardleyPorterArrowProps,
  wardleyPorterArrows,
  wardleyPorterLetterProps,
} from './presets';
import { WARDLEY_ROLE } from './roles';

/**
 * Standalone creation/activation actions for the Wardley toolbox — the
 * BEHAVIOUR layer, shared by every surface. They only depend on the
 * {@link GfxController}.
 *
 * They no longer emit telemetry: since PF3 the single emission point is the
 * command registry's `runCommand` (`docs/adr/0008`), which is the only function
 * every surface goes through. `WardleyActionSource` is gone with it — the
 * segment/module discrimination it carried is now `CommandInvocation.surface`.
 */

/**
 * The three axis words a translated variant's background is seeded with —
 * declared once, so the resolver below and the manifest
 * (`../translations.ts`) read the very same fallback.
 */
export const WARDLEY_AXIS_SEED = {
  opportunity: {
    key: 'com.labre.wardley.seed.axis-opportunity',
    fallback: 'Opportunity',
  },
  benefit: {
    key: 'com.labre.wardley.seed.axis-benefit',
    fallback: 'Benefit',
  },
  investment: {
    key: 'com.labre.wardley.seed.axis-investment',
    fallback: 'Investment',
  },
} as const;

/**
 * Per-variant default label overrides applied at creation (all remain editable
 * afterwards via the inline editor / toggles). The gradient itself is driven by
 * `variant` in the renderer.
 *
 * Resolved through the translation seam since the i18n pass (#278): the ten
 * label props still default to `undefined` on the declaration itself, but
 * `opportunity` and `benefit` are the two variants whose Y axis is PROSE the
 * gesture bakes into the document at creation — `WARDLEY_AXIS_SEED` above is
 * what a host's catalogue is offered for the three words, resolved HERE, once,
 * exactly like every other seed in this file. `classic` and
 * `evolution-gradient` keep the classic labels (Value Chain / Uncharted /
 * Industrialized…), which are declaration `labelKey`s and were already fully
 * localisable — this function names no override for them.
 */
function backgroundVariantDefaults(
  gfx: GfxController
): Record<WardleyBgVariant, Record<string, unknown>> {
  const axis = (def: { key: string; fallback: string }) =>
    translateKey(gfx.std, def.key, def.fallback);
  return {
    classic: {},
    // The Y axis becomes "Opportunity"; phase labels keep the classic defaults.
    opportunity: {
      yAxisTitle: axis(WARDLEY_AXIS_SEED.opportunity),
      showVisibilityLabels: false,
      showCornerLabels: false,
    },
    // The Y axis splits into Benefit (top) / Investment (bottom) around a zero
    // line drawn by the renderer.
    benefit: {
      yAxisTitle: '',
      visibilityHigh: axis(WARDLEY_AXIS_SEED.benefit),
      visibilityLow: axis(WARDLEY_AXIS_SEED.investment),
      showCornerLabels: false,
    },
    // Keeps the classic labels (Value Chain / Uncharted / Industrialized…); only
    // the grey gradient differs.
    'evolution-gradient': {},
  };
}

type Surface = NonNullable<GfxController['surface']>;

/**
 * The single-circle node flavours: one connectable ellipse + a label to its
 * right, grouped. The glyph itself (anchor silhouette, ecosystem hatching,
 * method inner circle) is drawn by the node renderer from `kind`.
 *
 * A subset of {@link WardleyArtefactKind}, and named away from
 * `WardleyNodeKind` on purpose: the model declares a type of that name with
 * eleven values, and two homonyms of different cardinality — one of them the
 * source of the semantic vocabulary — is a trap. The market, the pipeline and
 * the Porter's-forces glyph are composites with creation functions of their
 * own; the accelerator and the decelerator are not circles at all and place
 * their label on the side their arrow points from
 * ({@link createWardleyAccelerator}); the area is a zone with no label element
 * at all ({@link createWardleyArea}); the handle is not an artefact.
 */
export type WardleySingleCircleKind = Exclude<
  WardleyArtefactKind,
  'market' | 'pipeline' | 'porter' | 'accelerator' | 'decelerator' | 'area'
>;

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // The wardley palette stays open (native sub-menu behaviour) so several
  // Wardley objects can be added in a row; the canvas stays selectable.
}

/** Group elements; returns the group id (or the first id if grouping failed). */
function group(gfx: GfxController, ids: string[]) {
  const [, result] = gfx.std.command.exec(createGroupCommand, {
    elements: ids,
  });
  return result.groupId || ids[0];
}

/**
 * Add a wardley node of one kind, at its canonical size, centred on (cx, cy).
 *
 * The APPEARANCE is {@link wardleyNodeProps}' and nothing else: the palette and
 * the "Change type" dropdown read that one description, so a market drawn here
 * and a component morphed into one are the same element (`presets.ts`).
 *
 * `extra` is for what a preset cannot carry — the Porter's-forces letter, which
 * is CONTENT the author then edits, not a look. `wardleyMorphProps` strips
 * `text` for exactly that reason, so a preset that wrote one would be a preset
 * the morph has to un-write.
 */
function addNode(
  surface: Surface,
  kind: WardleyArtefactKind,
  cx: number,
  cy: number,
  extra: Record<string, unknown> = {}
) {
  return surface.addElement({
    ...wardleyNodeProps(kind, { xywh: wardleyCanonicalBox(kind, cx, cy) }),
    ...extra,
  });
}

/** Add a native free-text label (same Inter family as the axis labels). */
function addLabel(
  surface: Surface,
  text: string,
  x: number,
  y: number,
  textAlign: 'left' | 'center' | 'right' = 'left',
  fontWeight: FontWeight = FontWeight.Regular
) {
  return surface.addElement(
    wardleyLabelProps(text, x, y, textAlign, fontWeight)
  );
}

/** Create a wardley map background of the given variant, viewport-centered. */
export function createWardleyBackground(
  gfx: GfxController,
  variant: WardleyBgVariant = 'classic'
) {
  if (!gfx.surface) return;

  // A second map matches the biggest one already on the board rather than
  // shrinking beside it. The reference size and the locked 16:9 proportion are
  // the declaration's (`geometry`), not this function's.
  let atLeastWidth = 0;
  let atLeastHeight = 0;
  for (const el of gfx.surface.getElementsByType('wardley')) {
    const [, , ew, eh] = el.deserializedXYWH;
    atLeastWidth = Math.max(atLeastWidth, ew);
    atLeastHeight = Math.max(atLeastHeight, eh);
  }
  const { width, height } = backgroundSize(
    WARDLEY_BACKGROUND,
    atLeastWidth,
    atLeastHeight
  );

  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: WARDLEY_BACKGROUND.type,
    // The map is a first-class role: validation rules position artefacts
    // against `wardley:map`, never against the `wardley` element type. The
    // declaration owns it, so a templated map and a hand-drawn one agree.
    role: WARDLEY_BACKGROUND.role,
    // A map is a frame you place things on, not a shape you nudge — the
    // declaration decides, and the toolbar toggle takes over from there.
    resizeEnabled: WARDLEY_BACKGROUND.geometry.resizable,
    variant,
    ...backgroundVariantDefaults(gfx)[variant],
    xywh: new Bound(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Create a single-circle node (component / anchor / ecosystem / method):
 * one connectable native ellipse + a label to its right, grouped so they
 * move together (enter the group to reposition / edit the label).
 */
export function createWardleyNode(
  gfx: GfxController,
  kind: WardleySingleCircleKind
) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  const nodeId = addNode(surface, kind, cx, cy);
  const { x, y, textAlign } = wardleyLabelBoxFor(kind, cx, cy);
  const labelId = addLabel(
    surface,
    // Resolved HERE, once — the prompt a node nobody has named still carries,
    // exactly like a BPMN node's caption. `gfx.std` is how this file reaches
    // the translation seam: these creation sites take `GfxController`, not
    // `BlockStdScope`, directly (`WardleyView` reads the same member).
    translateKey(gfx.std, wardleyNodeLabelKey(kind), WARDLEY_NODE_LABEL[kind]),
    x,
    y,
    textAlign
  );

  finish(gfx, group(gfx, [nodeId, labelId]));
}

/** Create an inertia bar (filled black rect). */
export function createWardleyInertia(gfx: GfxController) {
  if (!gfx.surface) return;

  const { w, h } = INERTIA_SIZE;
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement(
    wardleyInertiaProps({
      xywh: new Bound(centerX - w / 2, centerY - h / 2, w, h).serialize(),
    })
  );
  finish(gfx, id);
}

/**
 * Create a pipeline: a wide thin native rect body (white semi-transparent,
 * NON-connectable) + a node-sized square handle straddling its top edge (the
 * only connection point, center anchor) + a native text label. The handle and
 * label are grouped, then grouped again with the body so the whole pipeline
 * moves as one. Pure composition of native elements — no custom type / view.
 */
export function createWardleyPipeline(gfx: GfxController) {
  if (!gfx.surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  // Body: a WardleyNode rect, made non-connectable by `kind: 'pipeline'`.
  const bodyId = addNode(gfx.surface, 'pipeline', cx, cy);

  // Handle: a node-sized WardleyNode square straddling the top edge. Inherits
  // `centerAnchorOnly` so connectors attach to its center only.
  const handleId = gfx.surface.addElement(
    wardleyHandleProps({ xywh: wardleyHandleBox(cx, cy) })
  );

  // Label centered horizontally on the pipeline, sitting ABOVE the handle.
  const { x, y, textAlign } = wardleyLabelBoxFor('pipeline', cx, cy);
  const labelId = addLabel(
    gfx.surface,
    translateKey(
      gfx.std,
      wardleyNodeLabelKey('pipeline'),
      WARDLEY_NODE_LABEL.pipeline
    ),
    x,
    y,
    textAlign
  );

  // Nested groups: (handle + label), then (body + that group).
  const innerId = group(gfx, [handleId, labelId]);
  finish(gfx, group(gfx, [bodyId, innerId]));
}

/**
 * Create a market: a large thin-bordered circle (the connectable market node)
 * containing 3 small thick-bordered component nodes wired into a triangle by
 * native attached connectors (thin, dark, no arrows — they auto-route between
 * the node centers and follow on move/resize). A label sits to the right and
 * everything is grouped into one object.
 */
export function createWardleyMarket(gfx: GfxController) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  // Outer circle = the market node (connectable, center-only).
  const circleId = addNode(surface, 'market', cx, cy);

  // 3 inner component nodes (thick border, no label) at the triangle vertices.
  const dotIds = wardleyMarketDotBoxes(cx, cy).map(xywh =>
    surface.addElement(wardleyMarketDotProps({ xywh }))
  );

  // Triangle: 3 attached connectors (auto-route center-to-center, clipped).
  const connIds = wardleyMarketLinkPairs(dotIds).map(([a, b]) =>
    surface.addElement(wardleyMarketLinkProps(a, b))
  );

  const { x, y, textAlign } = wardleyLabelBoxFor('market', cx, cy);
  const labelId = addLabel(
    surface,
    translateKey(
      gfx.std,
      wardleyNodeLabelKey('market'),
      WARDLEY_NODE_LABEL.market
    ),
    x,
    y,
    textAlign
  );

  finish(gfx, group(gfx, [circleId, ...dotIds, ...connIds, labelId]));
}

/**
 * Create a Porter's-forces glyph: a white circle carrying ONE letter, pushed on
 * from the four cardinal directions by solid red arrows, all grouped as one
 * object.
 *
 * It marks an EXTERNAL competition force acting on the map — which is why the
 * circle carries `wardley:porter` and nothing under `wardley:component`: it is
 * not a link in the value chain, and no rule written about the chain has
 * anything to say about a pressure applied from outside it.
 *
 * No label, and that is the notation rather than an omission: the letter says
 * which force this is (R relative competition, L struggle for survival, E
 * struggle to establish) and it is the circle's OWN inner text, so a
 * double-click opens the native shape editor on it (`node/node-view.ts`). The
 * four arrows are the glyph's own wiring — role-less filled red polygons,
 * outside the rim — exactly as the market's triangle is its own.
 */
export function createWardleyPorter(gfx: GfxController) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  const circleId = addNode(
    surface,
    'porter',
    cx,
    cy,
    wardleyPorterLetterProps(PORTER_DEFAULT_LETTER)
  );

  const arrowIds = wardleyPorterArrows(cx, cy).map(arrow =>
    surface.addElement(wardleyPorterArrowProps(arrow))
  );

  finish(gfx, group(gfx, [circleId, ...arrowIds]));
}

/**
 * Create an accelerator or a decelerator: one fat native POLYGON and the words
 * that say what it is, grouped like every other artefact.
 *
 * Not a link in the value chain, and not a pressure on it either: an annotation
 * of the CLIMATE, saying that something is speeding evolution up (an arrow
 * pointing right, towards commodity) or holding it back (the mirror, pointing
 * left). Which way it points IS the notation, so the two are separate kinds
 * with outlines of their own rather than one kind with a `rotate`.
 *
 * ## Where the words go, and why it is not always the right
 *
 * Every other single artefact on this canvas wears its name on its right,
 * because a circle has no direction to disagree with. An arrow does. The
 * reference puts the words on the side the arrow's SHAFT is on — right of an
 * accelerator, left of a decelerator — so the reading runs into the arrow
 * rather than across it, and the label is aligned towards it (left-aligned on
 * the right, right-aligned on the left) so the words end against the shaft
 * whatever their length.
 *
 * SemiBold, which no other Wardley label is: these two are annotations laid
 * over a map that is already full of names, and the weight is what keeps the
 * word readable as a remark ABOUT the map rather than as one more component.
 */
export function createWardleyAccelerator(
  gfx: GfxController,
  kind: 'accelerator' | 'decelerator'
) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  const nodeId = addNode(surface, kind, cx, cy);

  // Which side, and which alignment, are the placement's answer: the
  // decelerator's mirrored label is one of the two rules `presets.ts` states.
  const { x, y, textAlign } = wardleyLabelBoxFor(kind, cx, cy);
  const labelId = addLabel(
    surface,
    translateKey(gfx.std, wardleyNodeLabelKey(kind), WARDLEY_NODE_LABEL[kind]),
    x,
    y,
    textAlign,
    FontWeight.SemiBold
  );

  finish(gfx, group(gfx, [nodeId, labelId]));
}

/**
 * Create an AREA: a translucent zone of the map, drawn as a rectangle or as a
 * polygon whose corners the author then moves.
 *
 * One element and no group, which makes it the plainest creation site in this
 * file — and the difference is the name. Every other artefact wears its name as
 * a text element beside it, so every other artefact is a group of two. A zone's
 * name belongs INSIDE the zone, so it is the shape's own inner text: created
 * empty, opened by a double-click on the zone (`node/node-view.ts`), and set in
 * a fit mode that never resizes the boundary around it.
 *
 * ## Why it is sent to the back
 *
 * A zone is drawn precisely OVER the components it groups, and the surface
 * paints in index order: an area added last would sit on top of everything it
 * surrounds — hiding it under a wash, and worse, intercepting every click meant
 * for a component inside it. So the element is lowered the moment it exists,
 * to the depth {@link wardleyAreaIndexOver} works out.
 */
export function createWardleyArea(gfx: GfxController, shape: WardleyAreaShape) {
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const xywh = wardleyAreaBox(shape, cx, cy);
  const id = surface.addElement(wardleyAreaProps(shape, { xywh }));

  lowerWardleyArea(gfx, id);

  finish(gfx, id);
}

/**
 * Arm the interactive polygon tool to draw a ZONE, corner by corner.
 *
 * The polygonal half of the kind is a TOOL and the rectangular half an artefact,
 * and the asymmetry is the gesture rather than an inconsistency: a rectangle has
 * one shape whatever its size, so placing one and dragging its handles is the
 * whole of drawing it — while a polygon IS its corners, and a prefabricated
 * pentagon parked in the middle of the map is never the outline anybody wanted
 * (PO decision of 2026-09-16). The author clicks each corner and closes on the
 * first one; Escape cancels and fewer than three corners draws nothing, both of
 * which the tool already decides.
 *
 * What comes back is a Wardley area and not a plain polygon, because the tool
 * creates the element from the props handed here — same fill, rim, role and
 * inner-text settings as {@link createWardleyArea} writes, from the same
 * description — and then lowers it the way that function does.
 */
export function activateWardleyAreaPolygon(gfx: GfxController) {
  const { centerX: cx, centerY: cy } = gfx.viewport;

  gfx.tool.setTool(PolygonTool, {
    // The box and the default pentagon in here are a placeholder: the tool
    // spreads this bag before the outline the author drew, so both are
    // overwritten. They are still stated rather than stripped, because what a
    // zone IS has exactly one description (`presets.ts`) and taking two keys
    // out of it here would be a second one.
    props: wardleyAreaProps('polygon', {
      xywh: wardleyAreaBox('polygon', cx, cy),
    }),
    // A zone is lowered the moment it exists, for the reason
    // {@link createWardleyArea} gives at length: drawn last it would paint over
    // every component it groups and intercept their clicks.
    onCreated: lowerWardleyArea,
  });
}

/**
 * Send one already-placed area to the depth it belongs at — see
 * {@link createWardleyArea} for why a zone is lowered at all.
 *
 * Extracted so the TEMPLATE can call it: a snapshot cannot express this, because
 * the depth is relative to whatever map is already on the board rather than to
 * anything inside the template.
 */
export function lowerWardleyArea(gfx: GfxController, id: string): void {
  const surface = gfx.surface;
  const model = surface?.getElementById(id);
  if (!surface || !model) return;

  const over = wardleyAreaIndexOver(
    stackedElementsOf(surface, id),
    Bound.deserialize(model.xywh)
  );
  // `null` is "nothing under it": the back of the surface, minted by the
  // layer itself so an empty board gets the layer's own initial index rather
  // than a key invented here.
  model.index = over ?? gfx.layer.getReorderedIndex(model, 'back');
}

/**
 * One already-placed element, as {@link wardleyAreaIndexOver} needs to read it.
 *
 * The Wardley name for the shared {@link StackedElement}, kept so this
 * framework's callers and tests keep reading in its own vocabulary.
 */
export type WardleyStackedElement = StackedElement;

/** The top-level canvas elements of a surface, minus the one being placed. */
function stackedElementsOf(
  surface: Surface,
  exclude: string
): WardleyStackedElement[] {
  return surface.elementModels
    .filter(model => model.id !== exclude && model.group === null)
    .map(model => ({
      index: model.index,
      xywh: model.xywh,
      isBackground: model instanceof FrameworkBackgroundElementModel,
    }));
}

/**
 * How deep a freshly drawn zone goes: just ABOVE the framework backgrounds it
 * covers, and below everything else. `null` means the back of the surface.
 *
 * The reasoning — and the recette of #213 that produced it — now lives with
 * {@link indexOverBackgrounds}, because a frame drawn on a map needs the very
 * same depth for the very same reason. This alias keeps the Wardley name for
 * the callers and tests written against it.
 */
export const wardleyAreaIndexOver = indexOverBackgrounds;

/**
 * Read an SVG the user picks as a SKETCH, and say what it cost.
 *
 * Wardley's first interchange command, and its whole implementation: the four
 * steps live in {@link runInterchangeImportFile} and the reading lives in the
 * declared capability, so this framework contributes a declaration and a
 * label rather than a pipeline (`docs/adr/0012`, P1 and P3).
 *
 * It takes a `BlockStdScope` and not the `GfxController` the rest of this file
 * runs on, because an import is not a drawing gesture: it opens a picker,
 * writes a whole board in one undo step, moves the viewport and notifies —
 * none of which a `GfxController` alone can do.
 */
export async function importWardleySvgFile(std: BlockStdScope): Promise<void> {
  await runInterchangeImportFile(std, WARDLEY_SVG_IMPORT);
}

/**
 * Activate the native connector tool, pre-styled for a Wardley link (grey,
 * solid, no arrow) or evolution arrow (red, dashed, FILLED triangle). The
 * user then draws from one node to another (endpoints attach to centers).
 */
export function activateWardleyConnector(
  gfx: GfxController,
  kind: 'link' | 'arrow'
) {
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    // The value-chain link IS the "depends on" edge of a Wardley map; the
    // change arrow is a movement annotation and gets a role OF ITS OWN
    // (PF13.4, reversing #71 — see `roles.ts`). Two roles, never one
    // specialising the other: W1 is about where an arrow points and must never
    // fall on a dependency.
    role: kind === 'link' ? WARDLEY_ROLE.dependency : WARDLEY_ROLE.changeArrow,
    // The look rides on the activation, never through the last-props store:
    // the plain connector tool must keep the user's own style (#144 M1). The
    // style itself is {@link WARDLEY_EDGE_STYLE}, so the legend row this tool
    // subscribes pictures the very line the tool draws.
    style: { ...WARDLEY_EDGE_STYLE[kind] },
  });
  // The wardley palette stays open (native sub-menu behaviour): it only
  // closes on re-click of the senior button, another senior tool, or Escape.
}

/* ── Interchange: the OWM DSL, out and in (`docs/adr/0012`) ───────────── */

/**
 * The one wording this file owns: what a WRITER could not say.
 *
 * The import's wordings live in the pipeline that writes them
 * (`affine-block-surface`, `extensions/interchange-import.ts`) — one set of
 * keys for every format, with the format's own name composed into them, so
 * "OWM file imported" needs no key of its own. An export's losses are the
 * capability's own sentences and have nowhere else to go.
 */
const EXPORT_WARNINGS_KEY = 'com.labre.commands.wardley.exportOwm.warnings';
const EXPORT_WARNINGS_FALLBACK = 'What this export could not write down';

/**
 * The Wardley maps in the SELECTION — what the export is offered against.
 *
 * No read-only filter, for `c4BoardsForExport`'s reason: an export writes
 * nothing, and a map published read-only is precisely the one somebody wants to
 * take away.
 */
export function wardleyMapsSelected(
  std: BlockStdScope
): WardleyBackgroundElementModel[] {
  return std
    .get(GfxControllerIdentifier)
    .selection.selectedElements.filter(
      (model): model is WardleyBackgroundElementModel =>
        model instanceof WardleyBackgroundElementModel
    );
}

/**
 * The elements the export speaks about, in DOCUMENT order: the selected map(s)
 * and what they wholly contain.
 *
 * Membership is `containingFrame` on the map's element bound — whole
 * containment, ties to the smaller id — which is the one answer the validation
 * engine and the legend already give (PF2.4). The candidates are EVERY map on
 * the surface and not just the selected ones, so an artefact inside two
 * overlapping maps is attributed here exactly as the engine attributes it.
 */
export function wardleyExportElementsOf(
  std: BlockStdScope
): GfxPrimitiveElementModel[] {
  const elements =
    std.get(GfxControllerIdentifier).surface?.elementModels ?? [];
  const allMaps = elements.filter(
    (model): model is WardleyBackgroundElementModel =>
      model instanceof WardleyBackgroundElementModel
  );
  const selected = new Set<GfxPrimitiveElementModel>(wardleyMapsSelected(std));

  return elements.filter(element => {
    if (element instanceof WardleyBackgroundElementModel) {
      return selected.has(element);
    }
    // ponytail: a label is the NAME of a node, not an artefact of its own, so it
    // crosses UNSCOPED. `matchLabels` (export.ts) only binds one within
    // LABEL_MATCH_TOLERANCE of a kept node and drops the rest, while a long name
    // beside a node near the right edge legitimately hangs over the map bound —
    // scoping labels by containment would export that node unnamed.
    if (
      element instanceof TextElementModel &&
      element.role === WARDLEY_ROLE.label
    ) {
      return true;
    }
    const map = containingFrame(
      element.elementBound,
      allMaps,
      candidate => candidate.elementBound
    );
    return map !== null && selected.has(map);
  });
}

/**
 * What the exporter speaks about, as a picked board.
 *
 * The half that needs an editor, and only that half: reading the surface and
 * scoping it to the selection. The picking is {@link wardleyBoardFrom}, which
 * the interchange capability calls with the same elements and no `std` at all
 * (`docs/adr/0012`, P3).
 */
export function wardleyBoardOf(std: BlockStdScope): WardleyExportBoard {
  return wardleyBoardFrom(wardleyExportElementsOf(std));
}

/**
 * Serialize the selected map as an OWM document and hand it to the browser.
 *
 * Three steps, and only the first and the last know what an editor is: read the
 * selected map's perimeter, run the DECLARED capability, download what it
 * produced. The middle step is not re-implemented here — the document, the
 * filename and the content type all come out of `WARDLEY_OWM_EXPORT.run`, so
 * the command and the registry cannot describe the same map differently.
 *
 * Selecting SEVERAL maps still produces one file: an OWM document is one map,
 * and `exportWardleyOwmWithWarnings` says so out loud in its warnings.
 */
export function exportOwmFile(std: BlockStdScope): void {
  const elements = wardleyExportElementsOf(std);
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const { text, filename, mime, warnings } = WARDLEY_OWM_EXPORT.run(elements, {
    name: wardleySafeFilename(title),
  });
  // The charset is the browser's business, not the format's: `mime` is what an
  // `.owm` IS, and this is how a blob is told to carry it.
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);

  // A warning is never an error: the file downloaded, and it is valid; what it
  // could not say is what this names. A board with two maps on it, a component
  // with no name, an evolution arrow that also climbs the value chain — each is
  // a sentence the format has no way to write down, and the person who clicked
  // Export is the one entitled to hear about it.
  if (!warnings || warnings.length === 0) return;
  std.getOptional(NotificationProvider)?.notify({
    title: translateKey(std, EXPORT_WARNINGS_KEY, EXPORT_WARNINGS_FALLBACK),
    message: warnings.join('\n'),
    accent: 'warning',
    duration: 8000,
  });
}

/**
 * Read an `.owm` the user picks, draw it, and say what it cost.
 *
 * The whole of the import glue, and it is one line: the generic pipeline picks
 * the file from the format's own declaration, runs the capability, mints the
 * surface ids and repairs the link endpoints that named the file's names,
 * brings the map into view and reports. Nothing in it is about Wardley except
 * the capability handed to it.
 */
export async function importOwmFile(std: BlockStdScope): Promise<void> {
  await runInterchangeImportFile(std, WARDLEY_OWM_IMPORT);
}
