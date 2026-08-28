import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createAutoLegend } from '@labre/affine-gfx-ddd-shared';
import {
  C4BoardElementModel,
  type C4BoundaryVariant,
  type C4NodeKind,
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextFitMode,
  TextVerticalAlign,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import {
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOUNDARY_LABEL,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  INNER_FONT_SIZE,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  PERSON_BODY_TOP,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
  TITLE_TOP_MARGIN,
} from './consts';
import type { C4ExportBoard } from './export';
import { C4_MERMAID_EXPORT, c4BoardFrom, c4SafeFilename } from './interchange';
import { C4_AUTO_LEGEND } from './legend';
import { C4_ROLE, C4_ROLE_OF_KIND } from './roles';

/**
 * Standalone creation/activation actions for the C4 toolbox — the same shape
 * BPMN's `actions.ts` has, and for the same reason: the menu is a pure renderer
 * over the command registry, so what a button DOES lives here and telemetry is
 * emitted once, by `runCommand`.
 */

/**
 * The kinds whose GLYPH draws the body, so the native shape underneath paints
 * nothing at all.
 *
 * Five of nine, and the renderer is the authority on which. A person is a head
 * fused into a rounded body and a database is a cylinder, neither of which a
 * native rect can be. `mobile` and `browser` joined them with the PO's recette
 * of 27/08/2026: the reference stencil paints their OUTER rectangle in the
 * node's darker colour — the bezel — and insets a lighter SCREEN in it, which is
 * the reverse of a band painted over a body, so there is nothing left for a
 * native rect to contribute. Same call BPMN makes for `dataObject` /
 * `dataStore`.
 *
 * They stay hit-testable across their whole area all the same:
 * `C4NodeElementModel.includesPoint` forces the interior test regardless of
 * `filled` — which is the fix for the PO's second report, that these nodes could
 * not be double-clicked into their text editor.
 */
const GLYPH_BODY_KINDS: ReadonlySet<C4NodeKind> = new Set<C4NodeKind>([
  'person',
  'person-ext',
  'database',
  'mobile',
  'browser',
]);

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/** Create a C4 element (native shape) centred on the viewport. */
export function createC4Node(std: BlockStdScope, kind: C4NodeKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const paint = NODE_PALETTE[kind];
  const glyphBody = GLYPH_BODY_KINDS.has(kind);
  // A person's words are laid out in its BODY, not in the silhouette: the head
  // stands clear above, and a title padded from the element's own top edge would
  // be written across it. Every other kind's body IS its box.
  const bodyTop =
    kind === 'person' || kind === 'person-ext' ? h * PERSON_BODY_TOP : 0;

  const id = surface.addElement({
    type: 'c4Node',
    kind,
    // Semantic identity, posted next to `kind` — which stays untouched and keeps
    // driving the rendering. The role is the authority on what the box MEANS,
    // and it is the only thing that can say so: three of the four levels are the
    // same rounded rectangle (see `./roles.ts`).
    role: C4_ROLE_OF_KIND[kind],
    shapeType: 'rect',
    // A glyph-bodied kind paints nothing natively: the head, the block and the
    // cylinder are drawn by the renderer, which reads `fillColor` /
    // `strokeColor` off this same model — so both stay editable from the shape
    // toolbar exactly like every other node's.
    filled: !glyphBody,
    fillColor: paint.fill,
    strokeColor: paint.border,
    strokeWidth: NODE_STROKE_WIDTH,
    strokeStyle: glyphBody ? StrokeStyle.None : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // Per kind, and mostly ZERO: the stencil draws the boxed levels as plain
    // square-cornered rectangles, and rounds only the two devices. Harmless on a
    // glyph-bodied kind, whose native shape is invisible.
    radius: NODE_RADIUS[kind],
    // Every kind carries words, unlike BPMN: the box is the same box at three of
    // the four levels, so a C4 element with nothing written in it says nothing.
    text: NODE_LABEL[kind],
    color: paint.text,
    fontFamily: FontFamily.Inter,
    fontSize: INNER_FONT_SIZE,
    textAlign: TextAlign.Center,
    // TOP-aligned, with the stencil's own top margin under the element's edge.
    //
    // The title is the native inner text and the two tiers under it are painted
    // by the renderer, hung off wherever the title landed — so top-aligning the
    // one is what puts the STACK where the reference model puts it (the name at
    // roughly three-tenths of the height, the type line under it, the sentence
    // under that). A centred title would push both tiers into the bottom third.
    //
    // A creation-time default like every other value here: the author can move
    // the title from the shape toolbar afterwards and the tiers follow it, and a
    // node drawn before this change keeps its centred title and simply carries
    // its tiers lower. Nothing needs migrating.
    textVerticalAlign: TextVerticalAlign.Top,
    padding: [bodyTop + (h - bodyTop) * TITLE_TOP_MARGIN, INNER_FONT_SIZE / 2],
    // The stencil's sizes are normative: a long name overflows rather than
    // deforming the element out of its row.
    textFitMode: TextFitMode.Overflow,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/** Create a C4 board (the sheet one diagram is drawn on) centred on the viewport. */
export function createC4Board(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'c4Board',
    // The FRAME the elements are drawn on, and a role of its own: a rule written
    // on the artefacts must never fall on the sheet holding them.
    role: C4_ROLE.board,
    xywh: new Bound(
      cx - BOARD_REF_WIDTH / 2,
      cy - BOARD_REF_HEIGHT / 2,
      BOARD_REF_WIDTH,
      BOARD_REF_HEIGHT
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Create a C4 boundary centred on the viewport.
 *
 * The variant is WRITTEN on the element and it also decides the default name:
 * the two boundaries are the same dashed rectangle, and C4 tells them apart by
 * what is written under the corner ({@link BOUNDARY_LABEL}, and the note on
 * `variantProp` in `background.ts`). The name is document data from that moment
 * on — renaming a boundary never contradicts its variant.
 */
export function createC4Boundary(
  std: BlockStdScope,
  variant: C4BoundaryVariant
) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'c4Boundary',
    role: C4_ROLE.boundary,
    name: BOUNDARY_LABEL[variant],
    variant,
    xywh: new Bound(
      cx - BOUNDARY_REF_WIDTH / 2,
      cy - BOUNDARY_REF_HEIGHT / 2,
      BOUNDARY_REF_WIDTH,
      BOUNDARY_REF_HEIGHT
    ).serialize(),
  });
  finish(gfx, id);
}

/**
 * Arm the native connector tool, pre-styled for a C4 relationship: STRAIGHT,
 * DASHED, grey, with a filled triangle head.
 *
 * Three deliberate choices, and all three are the stencil's:
 *
 *  - **dashed**, where BPMN's sequence flow is solid. Every line on a C4 diagram
 *    is a relationship, so the dash is not a distinction between two kinds of
 *    line but the house style of the one kind there is;
 *  - **straight**, where BPMN routes orthogonally. A C4 diagram is a graph, not
 *    a process laid out in lanes: the elbows a router adds would read as a route
 *    through the diagram that nobody drew;
 *  - **a filled head**, because the relationship is directed and says so — the
 *    verb is "uses", the source is the element with the need.
 *
 * The role is carried by the TOOL, so the connector is born with it rather than
 * acquiring one afterwards (`docs/adr/0010`).
 */
export function activateC4Relationship(std: BlockStdScope) {
  std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Straight,
    stroke: RELATIONSHIP_STROKE,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: RELATIONSHIP_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
  });
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: C4_ROLE.relationship,
  });
  // Keep the palette open (native sub-menu behaviour).
}

/* ── The legend ────────────────────────────────────────────────────────── */

/**
 * The boards of the current selection.
 *
 * No read-only filter and no lock filter, the same call `bpmnPoolsSelected`
 * makes for the export: generating a legend WRITES, so unlike that one it is
 * offered only on an editable document — which is why the read-only test is
 * here rather than delegated to the caller.
 */
export function c4BoardsSelected(std: BlockStdScope): C4BoardElementModel[] {
  if (std.store.readonly) return [];
  return gfxOf(std).selection.selectedElements.filter(
    (model): model is C4BoardElementModel =>
      model instanceof C4BoardElementModel
  );
}

/**
 * Draw the legend of what is actually on the selected board, bottom-left of it.
 *
 * The FIRST selected board and no other: a legend is placed relative to one
 * background, and two of them would put two boxes on top of whatever sits in
 * that corner. Everything about the gesture — the scan, the placement, the box —
 * is `createAutoLegend`'s; C4 contributes {@link C4_AUTO_LEGEND}, a table.
 *
 * The one action in this file with no command behind it: the legend is reached
 * from the selected board's contextual toolbar and from nowhere else (PO
 * arbitration, 27/08/2026 — see `toolbar/config.ts`). Kept here beside its
 * siblings all the same, because it is the same kind of thing — a gesture that
 * writes elements — and because a unit test can drive it without a toolbar.
 */
export function createC4Legend(std: BlockStdScope): void {
  const board = c4BoardsSelected(std)[0];
  if (!board) return;
  createAutoLegend(std, board, C4_AUTO_LEGEND);
}

/* ── Export (mermaid C4) ───────────────────────────────────────────────── */

/**
 * The boards of the current selection, WITHOUT the read-only filter
 * {@link c4BoardsSelected} applies.
 *
 * That one refuses a read-only document because it is about to WRITE a legend
 * onto the canvas. An export writes nothing: it reads the board and hands the
 * reader a file. A diagram published read-only is precisely the board somebody
 * wants to take away, and refusing it there would be a filter copied for the
 * shape of it rather than for the reason — the same call `bpmnPoolsSelected`
 * makes for `bpmn.exportXml`.
 */
export function c4BoardsForExport(std: BlockStdScope): C4BoardElementModel[] {
  return gfxOf(std).selection.selectedElements.filter(
    (model): model is C4BoardElementModel =>
      model instanceof C4BoardElementModel
  );
}

/**
 * Everything the exporter speaks about, in document order.
 *
 * Document order matters for the same reason it does in BPMN: it is the
 * tie-break attribution breaks on — a centre inside two overlapping boundaries
 * goes to the first — and the audit's `attribute()` breaks it the same way.
 * Sorting here would make the export disagree with the badge the user can see.
 *
 * `boards` is the SELECTION and not every board on the surface: a C4 board is
 * one level of one model, and merging three of them would produce the very
 * picture C4 exists to stop people drawing.
 */
export function c4ExportBoardOf(std: BlockStdScope): C4ExportBoard {
  return c4BoardFrom(c4ExportElementsOf(std));
}

/**
 * The elements the export speaks about, as ONE list the declared capability
 * takes: the selected boards, then everything else on the surface in document
 * order.
 *
 * The selection is expressed by which boards are IN the list — that is the
 * capability's contract for this framework (see `interchange.ts`) — so the
 * unselected boards are the one thing left out, and `c4BoardFrom` on the
 * result reads back exactly what {@link c4ExportBoardOf} says.
 */
function c4ExportElementsOf(
  std: BlockStdScope
): readonly GfxPrimitiveElementModel[] {
  const elements = gfxOf(std).surface?.elementModels ?? [];
  return [
    ...c4BoardsForExport(std),
    ...elements.filter(element => !(element instanceof C4BoardElementModel)),
  ];
}

/**
 * What the downloaded file is called, minus the extension.
 *
 * The document's own title first — a board is what the file is OF — then the
 * name of the board whose toolbar launched the export, then a last resort. Every
 * character a file system reserves becomes `-`, whitespace runs collapse, and
 * the result is capped: `diagram` is a better download than one a browser
 * silently refuses.
 *
 * Which of the three it is, is the only thing this function decides; making
 * the answer safe to write to disk is {@link c4SafeFilename}, so the command
 * and the interchange capability cannot name the same board differently.
 */
export function c4ExportFilename(std: BlockStdScope): string {
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const board = c4BoardsForExport(std)[0]?.name;
  return c4SafeFilename(title || board);
}

/**
 * Serialize the selected board(s) as mermaid C4 and hand the file to the
 * browser.
 *
 * Three steps, and only the first and the last know what an editor is: read
 * the surface, run the DECLARED capability (`docs/adr/0012`), download what it
 * produced. The middle step is not re-implemented here — the document, the
 * filename and the content type all come out of `C4_MERMAID_EXPORT.run`, so
 * the command and the registry cannot describe the same board differently.
 * There is one door; the registry is the label on it. A plain import rather
 * than a DI lookup, for the reason `exportBpmnXmlFile` gives: the capability
 * is a pure function and a value, and P3 is explicit that the registry is the
 * editor's view of these functions, not a gate in front of them.
 *
 * A DOWNLOAD and not a clipboard copy, which is the one place this could have
 * diverged from #149. It does not, for three reasons: `.mmd` is the extension
 * the mermaid CLI and every editor plugin watch for; a multi-board export is
 * several documents and a clipboard holds one thing; and the file is what a
 * reader commits next to the code the diagram is about.
 */
export function exportC4MermaidFile(std: BlockStdScope): void {
  const { text, filename, mime } = C4_MERMAID_EXPORT.run(
    c4ExportElementsOf(std),
    { name: c4ExportFilename(std) }
  );
  downloadBlob(new Blob([text], { type: mime }), filename);
}
