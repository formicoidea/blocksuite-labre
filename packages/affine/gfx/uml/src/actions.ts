import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createAutoLegend } from '@labre/affine-gfx-ddd-shared';
import {
  ConnectorMode,
  TextAlign,
  type UmlDiagramKind,
  UmlDiagramElementModel,
  type UmlNodeKind,
} from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
  type SurfaceBlockModel,
} from '@labre/std/gfx';

import { type UmlBox, umlCompartmentBoxes } from './component.js';
import {
  UML_BODY_FONT_SIZE,
  UML_DIAGRAM_BOX,
  UML_EDGE_WIDTH,
  UML_INK,
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
  UML_SUBJECT_BOX,
} from './consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from './edge-styles.js';
import { umlSafeFilename } from './filename.js';
import { UML_PLANTUML_EXPORT, UML_XMI_EXPORT } from './interchange.js';
import {
  UML_ATTRIBUTES_SEED,
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_SLOTS_SEED,
} from './keywords.js';
import { UML_AUTO_LEGEND } from './legend.js';
import { umlNodeProps, umlTextProps } from './presets.js';
import { UML_ROLE, umlDiagramRoleKey, umlSubjectRoleKey } from './roles.js';

/**
 * Standalone creation/activation actions for the UML toolbox — the same shape
 * BPMN's and C4's `actions.ts` have, and for the same reason: the menu is a pure
 * renderer over the command registry, so what a button DOES lives here and
 * telemetry is emitted once, by `runCommand` (R29). Nothing in this file emits.
 */

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/** One compartment of a component, as a canvas TEXT element. */
function addTier(
  surface: SurfaceBlockModel,
  index: string,
  role: string,
  text: string,
  box: UmlBox,
  options: { fontSize: number; align: TextAlign; bold?: boolean }
): string {
  return surface.addElement({
    ...umlTextProps(role, box, options),
    text,
    index,
  });
}

/* ── The sheet and the frame on it ─────────────────────────────────────── */

/**
 * Create a UML diagram frame centred on the viewport — the sheet one diagram is
 * drawn on (Annex A).
 *
 * The KIND is written here and it is not optional: Annex A's heading is
 * `<kind> <name>`, so a frame with no kind has nothing to write in its tag. It
 * defaults to `class`, which is the diagram an architect reaches for first and
 * the only one Annex A gives no abbreviation for — and the kind picker on the
 * frame's own toolbar changes it afterwards.
 *
 * The NAME is seeded through the translation seam rather than left to the
 * model's default, so a diagram drawn in a French host does not start out called
 * "Diagram" (#183). The key is the diagram ROLE's: the two are the same noun,
 * and a second key would ask a host to word it twice. It is content from that
 * moment on — the heading is editable on a double-click — so it is asked for
 * once and never re-resolved.
 */
export function createUmlDiagram(
  std: BlockStdScope,
  kind: UmlDiagramKind = 'class'
) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = UML_DIAGRAM_BOX;
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'umlDiagram',
    // The FRAME the elements are drawn on, and a role of its own: a rule written
    // on the artefacts must never fall on the sheet holding them.
    role: UML_ROLE.diagram,
    name: translateKey(std, umlDiagramRoleKey, 'Diagram'),
    kind,
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/**
 * Create a use case SUBJECT centred on the viewport (§18.1.4) — the rectangle
 * drawn around the use cases a system offers, with the actors left outside it.
 *
 * No variant and no kind, unlike a C4 boundary: §18.1.4 draws ONE rectangle with
 * ONE name, so there is nothing for a discriminant to discriminate.
 */
export function createUmlSubject(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = UML_SUBJECT_BOX;
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = surface.addElement({
    type: 'umlSubject',
    role: UML_ROLE.subject,
    name: translateKey(std, umlSubjectRoleKey, 'Subject'),
    xywh: new Bound(cx - w / 2, cy - h / 2, w, h).serialize(),
  });
  finish(gfx, id);
}

/* ── The artefacts ─────────────────────────────────────────────────────── */

/**
 * The kinds drawn as a divided rectangle (§9.2.4, §9.8.4, §11.6.4, §19.3.4).
 *
 * Phase 2 adds two, and both are boxes rather than pictures for the reason the
 * first four are: a **component** is a Class (§11.6) drawn as a classifier
 * rectangle with the two-tab mark in its corner, and an **artifact** is a
 * classifier drawn as a rectangle with a document mark in the same corner and
 * `«artifact»` over the name (§19.3.4). Neither mark replaces the box — they
 * are stamped ON it — so both walk the compartment path and arrive with the
 * tiers their kind is worth.
 */
export type UmlClassifierKind =
  | 'class'
  | 'interface'
  | 'enumeration'
  | 'object'
  // Phase 2 — the two classifiers of a component and a deployment diagram.
  | 'component'
  | 'artifact';

/**
 * The kinds the notation draws as a picture rather than as a box.
 *
 * Phase 2 adds six, and each earns its place here by having no compartment to
 * divide: a **port** is a filled square on a border (§11.3.4), a **provided**
 * and a **required interface** are the ball and the socket on a stub (§10.4.4),
 * and a **node**, a **device** and an **execution environment** are the 3D box
 * of §19.4.4 — a drawing with a front face, a top and a side, not a rectangle
 * with lines across it.
 */
export type UmlGlyphKind =
  | 'package'
  | 'note'
  | 'actor'
  | 'use-case'
  // Phase 2 — components…
  | 'port'
  | 'provided-interface'
  | 'required-interface'
  // …and deployment.
  | 'node'
  | 'device'
  | 'execution-environment';

/**
 * The glyph kinds whose one tier is a `uml:name` rather than a `uml:label`.
 *
 * The line between the two is drawn by `roles.ts` and it is not about having a
 * rectangle: `uml:name` is the tier a KEYWORD may be written on and the grammar
 * reads back, `uml:label` is a name and nothing else. So:
 *
 *  - a **package** name is a namespace, parseable and qualified (§12.2.4), and a
 *    **note**'s text is what the exporter writes as the comment's body;
 *  - the three **deployment cubes** are named INSIDE their front face, over a
 *    keyword line — `«device»`, `«executionEnvironment»` (§19.4.4) — which is
 *    exactly what a name compartment is for. It is also load-bearing rather than
 *    tidy: the morph's `afterMorph` rewrites `uml:name` and only that, so a cube
 *    labelled instead of named would morph into a device that never said so.
 *
 * Everything else here carries a LABEL: a port's word sits beside a 16-unit
 * square and the two interface marks' beside a ball and a socket, none of them
 * inside anything, and none of them ever carrying a keyword.
 */
const NAMED_GLYPHS = new Set<UmlGlyphKind>([
  'package',
  'note',
  'node',
  'device',
  'execution-environment',
]);

/**
 * Where the viewport centre puts a node of this kind.
 *
 * Shared by the two creation functions so a class and a use case are centred by
 * the same arithmetic — the geometry is the only thing the two gestures have in
 * common, and it is worth not writing twice.
 */
function centredBox(gfx: GfxController, kind: UmlNodeKind) {
  const { w, h } = UML_NODE_BOX[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Create one of the SINGLE-LABEL artefacts — a package, a note, an actor, a use
 * case, and since phase 2 a port, the two interface marks and the three
 * deployment cubes — as the shape, its one word-bearing child, and the group
 * that makes the two one thing.
 *
 * ## Why three elements and not one shape carrying text
 *
 * R16: a label is a free text element grouped with the shape, never text ON the
 * shape. The pack has to obey it here even though these have only one tier,
 * because a classifier next door has three — and two mechanisms for "the words
 * on a UML artefact" would mean two editors, two toolbars and two sets of rules
 * for the same gesture. One click selects the artefact, a second descends into
 * its label.
 *
 * ## `uml:name` for five of them, `uml:label` for the rest
 *
 * See {@link NAMED_GLYPHS}: a package, a note and the three cubes carry a NAME
 * the grammar parses a keyword off; a port, a ball and a socket carry a LABEL.
 * Keeping them apart is what lets the exporter read a tier without first asking
 * what shape it is under.
 *
 * ## The label is where the notation puts it, and that is not this file's call
 *
 * The box comes out of {@link umlCompartmentBoxes}, which is where every
 * "beside the glyph" and "inside the front face" decision is written down: a
 * port's label sits next to the square rather than on it (the square is 16
 * units, and words do not fit in it), an interface mark's sits beside the ball
 * or the socket, and a cube's sits in its FRONT FACE, which is the only part of
 * a 3D box §19.4.4 writes in. Creation reads the answer; it does not have one.
 *
 * ## The alignments
 *
 * Centred, except the NOTE. A note holds a sentence rather than a title (Annex
 * A), and a centred paragraph of three lines is the one thing on a UML diagram
 * that reads as a poem.
 */
export function createUmlNode(std: BlockStdScope, kind: UmlGlyphKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { x, y, w, h } = centredBox(gfx, kind);

  const shapeId = surface.addElement({
    // Every prop the kind is worth, from the ONE table the morph also reads
    // (`presets.ts`). NO `text`: the words are the child below, and the shape is
    // a body and nothing else.
    ...umlNodeProps(kind, { xywh: new Bound(x, y, w, h).serialize() }),
    index: gfx.layer.generateIndex(),
  });

  const { name: box } = umlCompartmentBoxes(kind, x, y, w, h);
  const isLabel = !NAMED_GLYPHS.has(kind);
  const textId = addTier(
    surface,
    gfx.layer.generateIndex(),
    isLabel ? UML_ROLE.label : UML_ROLE.name,
    UML_NAME_SEED[kind],
    box,
    {
      fontSize: UML_NAME_FONT_SIZE,
      align: kind === 'note' ? TextAlign.Left : TextAlign.Center,
    }
  );

  // The group LAST, so it is written after everything it holds: the elements are
  // created in painting order — the shape first and the words above it — and the
  // group's own `xywh` is derived from its children.
  const groupId = surface.addElement({
    type: 'group',
    index: gfx.layer.generateIndex(),
    // A plain record is a legal `children`: the group's own `propsToY` takes the
    // KEYS and forces every value to `true`.
    children: { [shapeId]: true, [textId]: true },
    // No title, deliberately. The group renderer paints one only while the
    // artefact is selected, and a package announcing itself as "Group 3" above
    // its own name is a label nobody wrote.
  });

  finish(gfx, groupId);
}

/**
 * Create one of the COMPARTMENTED artefacts — a class, an interface, an
 * enumeration, an object, and since phase 2 a component or an artifact — as the
 * shape, its compartments, and the group.
 *
 * ## How many tiers is the LAYOUT's answer, not this file's
 *
 * The walk below writes a tier for each box `umlCompartmentBoxes` returns and
 * for no other, which is what lets two kinds be added to the notation without a
 * line changing here: a component and an artifact arrive with the name tier and
 * the one body tier §11.6.4 and §19.3.4 draw them with, because that is what the
 * layout hands over. The alternative — a table of tier counts in this file —
 * would be a second statement of the geometry, and the first one to drift.
 *
 * ## Four or five elements, and the object is the four
 *
 * A class, an interface and an enumeration arrive as shape + name + attributes +
 * operations + group. An OBJECT arrives with no operations compartment at all,
 * and that is §9.8.4 rather than an economy: an instance specification has
 * SLOTS — values its attributes hold — and no behaviour of its own. Its second
 * tier is stamped `uml:attributes` all the same, because a slot is what an
 * attribute is worth on an instance, and giving it a fifth role would make every
 * reader of the vocabulary handle two spellings of one idea.
 *
 * ## Seeded, not empty
 *
 * Every tier carries the stencil's own prompt from the moment the artefact is
 * drawn: the kind's name line (`«interface»\nInterface` for an interface —
 * §9.5.4's keyword, which is what tells the reader it is not a class),
 * `+ attribute : Type`, `+ operation() : Type`. The author meets a worked
 * example of the notation rather than an empty box, and the grammar can be read
 * back off it immediately.
 *
 * ## The name is the one bold tier, and the features are read LEFT
 *
 * A compartment of attributes is a LIST of signatures, and a list is read down
 * its left edge: centring `+ attribute : Type` over `+ operation() : Type` would
 * put the `+` of every line in a different column and cost the reader the one
 * visual cue UML gives for visibility (§9.5.4).
 */
export function createUmlClassifier(
  std: BlockStdScope,
  kind: UmlClassifierKind
) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { x, y, w, h } = centredBox(gfx, kind);

  const shapeId = surface.addElement({
    ...umlNodeProps(kind, { xywh: new Bound(x, y, w, h).serialize() }),
    index: gfx.layer.generateIndex(),
  });

  const boxes = umlCompartmentBoxes(kind, x, y, w, h);
  const children: Record<string, true> = { [shapeId]: true };

  children[
    addTier(
      surface,
      gfx.layer.generateIndex(),
      UML_ROLE.name,
      UML_NAME_SEED[kind],
      boxes.name,
      {
        fontSize: UML_NAME_FONT_SIZE,
        align: TextAlign.Center,
        bold: true,
      }
    )
  ] = true;

  if (boxes.attributes) {
    children[
      addTier(
        surface,
        gfx.layer.generateIndex(),
        UML_ROLE.attributes,
        kind === 'object' ? UML_SLOTS_SEED : UML_ATTRIBUTES_SEED,
        boxes.attributes,
        { fontSize: UML_BODY_FONT_SIZE, align: TextAlign.Left }
      )
    ] = true;
  }

  if (boxes.operations) {
    children[
      addTier(
        surface,
        gfx.layer.generateIndex(),
        UML_ROLE.operations,
        UML_OPERATIONS_SEED,
        boxes.operations,
        { fontSize: UML_BODY_FONT_SIZE, align: TextAlign.Left }
      )
    ] = true;
  }

  const groupId = surface.addElement({
    type: 'group',
    index: gfx.layer.generateIndex(),
    children,
  });

  finish(gfx, groupId);
}

/* ── The relationships ─────────────────────────────────────────────────── */

/**
 * The edges the toolbox arms, and the style each wears, are ONE table — and it
 * lives in `./edge-styles.js` so the morph that retypes a connector somebody
 * already drew reads the very rows this tool writes. Re-exported here because
 * the union is what {@link activateUmlEdge} takes, and a caller holding this
 * module should not have to know which file it was written in.
 */
export type { UmlEdgeRole };

/**
 * Arm the native connector tool, pre-styled for one UML relationship.
 *
 * ## One function for every edge, where C4 and BPMN wrote one each
 *
 * Because UML has twelve of them and they differ on three props out of a table
 * that is otherwise identical — the same mode, the same ink, the same weight. A
 * dozen near-identical functions would be a dozen places for a stroke width to
 * drift, and {@link UML_EDGE_STYLE} is the notation itself, which is the thing
 * worth reading. It is also what made phase 2 free: `deploy`, `manifest` and
 * `communication-path` arm through this function without a line changing in it.
 *
 * ## STRAIGHT, always
 *
 * A class diagram is a graph, not a process laid out in lanes: the elbows an
 * orthogonal router adds would read as a route through the diagram that nobody
 * drew. BPMN routes orthogonally because a sequence flow really does travel
 * through a layout; UML's lines state a relationship between two classifiers and
 * the shortest one says it best.
 *
 * The role is carried by the TOOL, so the connector is born with it rather than
 * acquiring one afterwards (`docs/adr/0010`) — and the look rides on the
 * activation, never through the last-props store: the plain connector tool must
 * keep the user's own style (#144 M1).
 */
export function activateUmlEdge(std: BlockStdScope, role: UmlEdgeRole) {
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: UML_ROLE[role],
    style: {
      stroke: UML_INK,
      strokeWidth: UML_EDGE_WIDTH,
      ...UML_EDGE_STYLE[role],
    },
  });
  // Keep the palette open (native sub-menu behaviour).
}

/* ── The legend ────────────────────────────────────────────────────────── */

/**
 * The diagram frames of the current selection, on an EDITABLE document.
 *
 * The read-only filter is here rather than delegated to the caller because it
 * belongs to what this list is FOR: generating a legend writes elements onto the
 * canvas, so it is offered only where writing is possible. The export's own
 * {@link umlDiagramsForExport} deliberately has no such filter — reading a
 * diagram and handing the reader a file is exactly what a published, read-only
 * document is for.
 */
export function umlDiagramsSelected(
  std: BlockStdScope
): UmlDiagramElementModel[] {
  if (std.store.readonly) return [];
  return gfxOf(std).selection.selectedElements.filter(
    (model): model is UmlDiagramElementModel =>
      model instanceof UmlDiagramElementModel
  );
}

/**
 * Draw the legend of what is actually on the selected frame, bottom-left of it.
 *
 * The FIRST selected frame and no other: a legend is placed relative to one
 * background, and two of them would put two boxes on top of whatever sits in
 * that corner. Everything about the gesture — the scan, the placement, the box —
 * is `createAutoLegend`'s; UML contributes {@link UML_AUTO_LEGEND}, a table.
 *
 * The one action in this file with no command behind it, exactly as in C4: the
 * legend is reached from the selected frame's contextual toolbar and from
 * nowhere else (PO arbitration, 27/08/2026 — see `toolbar/config.ts`). It is a
 * legend OF something you have in front of you, not an artefact to pick off a
 * palette. Kept here beside its siblings all the same, because it is the same
 * kind of thing — a gesture that writes elements — and because a unit test can
 * drive it without a toolbar.
 *
 * A legend earns its place in UML more than in most packs: the notation's dozen
 * relationships differ by a diamond's fill and a triangle's outline, and a
 * reader who is not fluent in §11.5.4 cannot tell a shared aggregation from a
 * composition without a key on the sheet.
 */
export function createUmlLegend(std: BlockStdScope): void {
  const diagram = umlDiagramsSelected(std)[0];
  if (!diagram) return;
  createAutoLegend(std, diagram, UML_AUTO_LEGEND);
}

/* ── Export (PlantUML, XMI 2.5.1) ──────────────────────────────────────── */

/**
 * The diagrams the export speaks about: the SELECTED ones, or every diagram on
 * the surface when nothing is selected.
 *
 * ## Why the fallback, where C4 has none
 *
 * `c4BoardsForExport` returns the selection and stops there, because a C4 board
 * is one LEVEL of one model and merging three of them produces the picture C4
 * exists to stop people drawing. UML is the opposite object: ADR 0017 ships the
 * four diagram kinds as ONE framework precisely because they are views of one
 * model — the classes in a class diagram are the classifiers the objects in the
 * object diagram instantiate — and both target formats are built to hold all of
 * them. An XMI `uml:Model` is a single model element holding every packaged
 * element; a `.puml` file is one document. So a document with four frames on it
 * and nothing selected exports as the model it is.
 *
 * Selecting a frame narrows it, which is the gesture an author makes when they
 * want one diagram out of a page of them.
 *
 * No read-only filter: an export WRITES nothing. A diagram published read-only
 * is precisely the one somebody wants to take away.
 */
export function umlDiagramsForExport(
  std: BlockStdScope
): UmlDiagramElementModel[] {
  const gfx = gfxOf(std);
  const selected = gfx.selection.selectedElements.filter(
    (model): model is UmlDiagramElementModel =>
      model instanceof UmlDiagramElementModel
  );
  if (selected.length > 0) return selected;

  return (gfx.surface?.elementModels ?? []).filter(
    (model): model is UmlDiagramElementModel =>
      model instanceof UmlDiagramElementModel
  );
}

/**
 * The elements the export speaks about, as ONE list the declared capability
 * takes: the diagrams in scope, then everything else on the surface in document
 * order.
 *
 * The scope is expressed by which DIAGRAMS are in the list — that is the
 * capability's contract for this framework (`interchange.ts`) — so an unselected
 * frame is the one thing left out, and the exporter's own geometric attribution
 * reads back exactly what {@link umlDiagramsForExport} says.
 *
 * Document order matters and is preserved for the same reason it does in BPMN
 * and C4: it is the tie-break attribution breaks on — a centre inside two
 * overlapping subjects goes to the first — and sorting here would make the file
 * disagree with the badge the user can see.
 *
 * The compartment texts and the groups that say whose words they are ride along
 * untouched: a tier belongs to its node through the GROUP rather than through
 * the geometry, so both lists cross the seam whole and unfiltered.
 */
export function umlExportElementsOf(
  std: BlockStdScope
): readonly GfxPrimitiveElementModel[] {
  const elements = gfxOf(std).surface?.elementModels ?? [];
  return [
    ...umlDiagramsForExport(std),
    ...elements.filter(element => !(element instanceof UmlDiagramElementModel)),
  ];
}

/**
 * What the downloaded file is called, minus the extension.
 *
 * The document's own title first — a diagram is what the file is OF — then the
 * name of the frame whose toolbar launched the export, then a last resort.
 * Making the answer safe to write to disk is {@link umlSafeFilename}'s job, so
 * the command and the interchange capability cannot name the same diagram
 * differently.
 */
export function umlExportFilename(std: BlockStdScope): string {
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const diagram = umlDiagramsForExport(std)[0]?.name;
  return umlSafeFilename(title || diagram);
}

/**
 * Serialize the diagrams in scope as PlantUML and hand the file to the browser.
 *
 * Three steps, and only the first and the last know what an editor is: read the
 * surface, run the DECLARED capability (`docs/adr/0012`), download what it
 * produced. The middle step is not re-implemented here — the document, the
 * filename and the content type all come out of `UML_PLANTUML_EXPORT.run`, so
 * the command and the registry cannot describe the same diagram differently.
 * There is one door; the registry is the label on it.
 */
export function exportUmlPlantumlFile(std: BlockStdScope): void {
  const { text, filename, mime } = UML_PLANTUML_EXPORT.run(
    umlExportElementsOf(std),
    { name: umlExportFilename(std) }
  );
  downloadBlob(new Blob([text], { type: mime }), filename);
}

/**
 * Serialize the diagrams in scope as XMI 2.5.1 and hand the file to the browser.
 *
 * The same three steps as {@link exportUmlPlantumlFile}, against the other
 * capability. Two formats because they answer different questions: PlantUML is
 * what a reader diffs and commits next to the code, XMI is what another UML tool
 * reads back — the OMG's own interchange format, and the reason this pack
 * implements 2.5.1 rather than a dialect.
 */
export function exportUmlXmiFile(std: BlockStdScope): void {
  const { text, filename, mime } = UML_XMI_EXPORT.run(
    umlExportElementsOf(std),
    {
      name: umlExportFilename(std),
    }
  );
  downloadBlob(new Blob([text], { type: mime }), filename);
}
