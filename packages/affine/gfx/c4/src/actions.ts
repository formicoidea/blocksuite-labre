import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createAutoLegend } from '@labre/affine-gfx-ddd-shared';
import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  type C4BoundaryVariant,
  C4NodeElementModel,
  type C4NodeKind,
  ConnectorElementModel,
  ConnectorMode,
  FontFamily,
  FontStyle,
  FontWeight,
  GroupElementModel,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  TextElementModel,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type SurfaceBlockModel,
} from '@labre/std/gfx';

import { type C4TierBox, c4TierBoxes } from './component';
import {
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOUNDARY_LABEL,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  DESCRIPTION_FONT_SIZE,
  DESCRIPTION_PLACEHOLDER,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
  TITLE_FONT_SIZE,
  TYPE_FONT_SIZE,
} from './consts';
import { type C4ExportBoard, exportC4Mermaid } from './export';
import { C4_AUTO_LEGEND } from './legend';
import { C4_ROLE, C4_ROLE_OF_KIND } from './roles';
import { C4_TYPE_PLACEHOLDER } from './type-line';

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

/**
 * One of a component's two written tiers, as a canvas TEXT element.
 *
 * Every style prop is passed EXPLICITLY, and that is not belt and braces: both
 * creation APIs run the new props through `EditPropsStore.applyLastProps('text',
 * …)`, which merges whatever the user last set on a free text element
 * underneath — a 24px face, a colour from another diagram, a left alignment.
 * Explicit props win the merge, so the only ones that survive it are the ones
 * written here. A type line inheriting the colour of the last sticky note
 * somebody typed would be a notation set by accident.
 *
 * `hasMaxWidth` is what keeps a long sentence inside the element instead of
 * running out over the canvas: the box wraps at its own width and grows
 * downward, and the group grows with it, so a component always contains its own
 * words.
 */
function addTier(
  surface: SurfaceBlockModel,
  index: string,
  role: string,
  text: string,
  fontSize: number,
  fontWeight: FontWeight,
  color: string,
  box: C4TierBox
): string {
  return surface.addElement({
    type: 'text',
    role,
    text,
    index,
    color,
    fontFamily: FontFamily.Inter,
    fontSize,
    fontWeight,
    fontStyle: FontStyle.Normal,
    textAlign: TextAlign.Center,
    hasMaxWidth: true,
    xywh: new Bound(box.x, box.y, box.w, box.h).serialize(),
  });
}

/**
 * Create a C4 component centred on the viewport: the shape, its THREE written
 * tiers, and the GROUP that makes the four one thing.
 *
 * ## Five elements, and why the group is one of them
 *
 * The PO's recette of 28/08/2026 rejected the "Details" popover the type line
 * and the description used to be typed into: an architect writes on the picture.
 * Its follow-up went one further and took the NAME off the shape too — for one
 * iteration the name was the shape's native inner text and the other two tiers
 * were elements, which meant two kinds of text in one component, two editors,
 * two toolbars and two sets of rules for the same three lines.
 *
 * So the shape is created carrying NO text at all, and the three lines are three
 * canvas `text` elements. Which leaves the problem the popover did not have —
 * four elements have to move, copy and delete as one — and a native `group` is
 * the platform's own answer: one click selects the component, a second descends
 * into whichever tier was clicked, and every gesture the editor already knows
 * works on it.
 *
 * The group's `xywh` is DERIVED from its children. Its `index`, and the tiers',
 * are not layering statements but stability ones: the five elements are created
 * in painting order, the shape first and the words above it, because two
 * elements sharing an index sort by id — and an id is a nanoid.
 *
 * ## An empty shape is still a whole target
 *
 * A shape with no text would normally be hit only near its border and across the
 * few characters of its label, which is the AFFiNE behaviour `includesPoint`
 * implements. `C4NodeElementModel` overrides it to force the interior test, so
 * the body stays draggable, selectable and double-clickable across its whole
 * area with nothing written in it — the override that was added for the
 * glyph-bodied kinds now carries every kind.
 *
 * ## Placeholders, not values
 *
 * All three tiers exist from creation, carrying the stencil's own prompts: the
 * kind's label as the name, `[Container: technology]` under it and `description`
 * under that. The author meets three lines of stencil rather than an empty box.
 * The two lower prompts are read as "nothing stated" by the exporter; the NAME
 * is not, because an unnamed container really is a container (`component.ts`).
 *
 * The ROLE is stamped on the shape and on all three texts, and NOT on the group:
 * the rules, the facts and the export all key on the shape, and the wrapper
 * round a box is not a second box (`roles.ts`).
 */
export function createC4Node(std: BlockStdScope, kind: C4NodeKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const paint = NODE_PALETTE[kind];
  const glyphBody = GLYPH_BODY_KINDS.has(kind);

  const shapeId = surface.addElement({
    type: 'c4Node',
    index: gfx.layer.generateIndex(),
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
    // NO `text`, and that is the point of this iteration: the name is the
    // `c4:title` child below, so the shape is a body and nothing else. Its text
    // COLOUR is still seeded — an element drawn before this change carries its
    // name here, and the node view routes a double-click to that editor for
    // exactly those, so the words have to stay legible.
    color: paint.text,
    fontFamily: FontFamily.Inter,
    fontSize: TITLE_FONT_SIZE,
    textAlign: TextAlign.Center,
    xywh: new Bound(x, y, w, h).serialize(),
  });

  const boxes = c4TierBoxes(kind, x, y, w, h);
  const titleId = addTier(
    surface,
    gfx.layer.generateIndex(),
    C4_ROLE.title,
    // The kind's own label — `Person`, `Web app`. A name and a prompt at once,
    // which is why the exporter writes it through unchanged.
    NODE_LABEL[kind],
    TITLE_FONT_SIZE,
    // The one tier with weight on it: it is the heading of the box, and at 20px
    // against a 16px sentence the size alone does not carry that.
    FontWeight.SemiBold,
    paint.text,
    boxes.title
  );
  const typeLineId = addTier(
    surface,
    gfx.layer.generateIndex(),
    C4_ROLE['type-line'],
    C4_TYPE_PLACEHOLDER[kind],
    TYPE_FONT_SIZE,
    FontWeight.Regular,
    paint.text,
    boxes.typeLine
  );
  const descriptionId = addTier(
    surface,
    gfx.layer.generateIndex(),
    C4_ROLE.description,
    DESCRIPTION_PLACEHOLDER,
    DESCRIPTION_FONT_SIZE,
    FontWeight.Regular,
    paint.text,
    boxes.description
  );

  const groupId = surface.addElement({
    type: 'group',
    index: gfx.layer.generateIndex(),
    // A plain record is a legal `children`: the group's own `propsToY` takes the
    // KEYS and forces every value to `true`.
    children: {
      [shapeId]: true,
      [titleId]: true,
      [typeLineId]: true,
      [descriptionId]: true,
    },
    // No title, deliberately. The group renderer paints one only while the
    // component is selected, and a component announcing itself as "Group 3"
    // above its own name is a label nobody wrote.
  });

  // The GROUP is what the gesture produced, so the group is what is selected: a
  // click selects the component, a double-click descends into the tier under
  // the pointer. That is the whole recette in one selection.
  finish(gfx, groupId);
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
  const elements = gfxOf(std).surface?.elementModels ?? [];
  const nodes: C4NodeElementModel[] = [];
  const boundaries: C4BoundaryElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];
  // The two written tiers of every component, and the groups that say whose
  // words they are. Collected whole and unfiltered: `component.ts` resolves
  // them by membership, which is a question about the document rather than
  // about the board's geometry.
  const texts: TextElementModel[] = [];
  const groups: GroupElementModel[] = [];

  for (const element of elements) {
    if (element instanceof C4NodeElementModel) nodes.push(element);
    else if (element instanceof C4BoundaryElementModel)
      boundaries.push(element);
    else if (element instanceof ConnectorElementModel) connectors.push(element);
    else if (element instanceof TextElementModel) texts.push(element);
    else if (element instanceof GroupElementModel) groups.push(element);
  }

  return {
    boards: c4BoardsForExport(std),
    nodes,
    boundaries,
    connectors,
    texts,
    groups,
  };
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
 * The trailing `[. ]` trim is the Windows tail case, lifted from
 * `bpmnExportFilename` for the same reason it exists there: Windows strips
 * trailing dots and spaces from a name, so a board called "Context." would have
 * its EXTENSION eaten rather than its full stop.
 */
export function c4ExportFilename(std: BlockStdScope): string {
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const board = c4BoardsForExport(std)[0]?.name;
  const raw = (title || board || 'diagram').trim();
  const safe = raw
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || 'diagram';
}

/**
 * Serialize the selected board(s) as mermaid C4 and hand the file to the
 * browser.
 *
 * The three steps are deliberately three, exactly as `exportBpmnXmlFile`'s are:
 * read the surface, serialize (a pure function with no `std` in sight —
 * `export.ts`), download. Only the first and the last know what an editor is,
 * which is what makes the interesting half testable without one.
 *
 * A DOWNLOAD and not a clipboard copy, which is the one place this could have
 * diverged from #149. It does not, for three reasons: `.mmd` is the extension
 * the mermaid CLI and every editor plugin watch for; a multi-board export is
 * several documents and a clipboard holds one thing; and the file is what a
 * reader commits next to the code the diagram is about. `text/plain` because
 * mermaid has no registered media type, and an invented one is a file some
 * browsers refuse to save.
 */
export function exportC4MermaidFile(std: BlockStdScope): void {
  const name = c4ExportFilename(std);
  const source = exportC4Mermaid(c4ExportBoardOf(std));
  downloadBlob(
    new Blob([source], { type: 'text/plain;charset=utf-8' }),
    `${name}.mmd`
  );
}
