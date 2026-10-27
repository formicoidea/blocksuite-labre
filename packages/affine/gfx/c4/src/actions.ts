import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import {
  C4BoardElementModel,
  type C4BoundaryVariant,
  type C4NodeKind,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
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
  boundaryLabelKey,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  DESCRIPTION_PLACEHOLDER,
  DESCRIPTION_PLACEHOLDER_KEY,
  NODE_LABEL,
  nodeLabelKey,
  NODE_SIZE,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
} from './consts';
import type { C4ExportBoard } from './export';
import { C4_MERMAID_EXPORT, c4BoardFrom, c4SafeFilename } from './interchange';
import { C4_BOUNDARY_ROLE, C4_ROLE, c4BoardRoleKey } from './roles';
import { c4BoardElement, c4BoundaryElement, c4NodeElements } from './toolbox';
import { c4TypePlaceholder } from './type-line';

/**
 * Standalone creation/activation actions for the C4 toolbox — the same shape
 * BPMN's `actions.ts` has, and for the same reason: the menu is a pure renderer
 * over the command registry, so what a button DOES lives here and telemetry is
 * emitted once, by `runCommand`.
 */

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
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

  // The five elements come from the ONE assembly a host with no editor also
  // calls (`toolbox.ts`, `docs/adr/0045`), so a component placed here and one
  // placed by a host are the same element. What only an editor has stays
  // here: the viewport centre, the seeds resolved in the host's language
  // (`docs/adr/0023`: a creation site writes the resolved value) and the layer
  // indexes. The indexes are stability statements, not layering ones: the
  // five are written in painting order, the shape first and the words above
  // it, because two elements sharing an index sort by nanoid.
  const elements = c4NodeElements(
    kind,
    { x: cx - w / 2, y: cy - h / 2 },
    {
      title: translateKey(std, nodeLabelKey(kind), NODE_LABEL[kind]),
      typeLine: c4TypePlaceholder(kind, std),
      description: translateKey(
        std,
        DESCRIPTION_PLACEHOLDER_KEY,
        DESCRIPTION_PLACEHOLDER
      ),
    }
  );
  const minted = new Map<string, string>();
  for (const { id: local, ...props } of elements) {
    if (props.type === 'group') {
      // A plain record is a legal `children`: the group's own `propsToY` takes
      // the KEYS and forces every value to `true`.
      props.children = Object.fromEntries(
        Object.keys(props.children as Record<string, true>).map(child => [
          minted.get(child) ?? child,
          true,
        ])
      );
    }
    minted.set(
      local as string,
      surface.addElement({ ...props, index: gfx.layer.generateIndex() })
    );
  }
  const groupId = minted.get(`${kind}:group`);
  if (!groupId) return;

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
  const { id: _local, ...props } = c4BoardElement(
    { x: cx - BOARD_REF_WIDTH / 2, y: cy - BOARD_REF_HEIGHT / 2 },
    // The sheet's own name, written HERE rather than left to the model's
    // default so that a board drawn in a translated host starts in that
    // language (#183). It is content from that moment on — the title is
    // editable on a double-click — so it is asked for once and never
    // re-resolved. The key is the BOARD ROLE's: the two are the same noun, and
    // a second key would ask a host to word "C4 diagram" twice.
    translateKey(std, c4BoardRoleKey, 'C4 diagram')
  );
  finish(gfx, surface.addElement(props));
}

/**
 * Create a C4 boundary centred on the viewport.
 *
 * The variant is WRITTEN on the element and it also decides the default name:
 * the two boundaries are the same dashed rectangle, and C4 tells them apart by
 * what is written under the corner ({@link BOUNDARY_LABEL}, and the note on
 * `variantProp` in `background.ts`). The name is document data from that moment
 * on — renaming a boundary never contradicts its variant.
 *
 * ## The role and the variant are written together, or not at all
 *
 * `c4BoundaryElement` (`toolbox.ts`) is the ONE place either field is written,
 * for this action and for a host with no editor, and it writes both from the same
 * argument: the `variant` the renderer and the exporter read, and the child ROLE
 * the zoom rules read ({@link C4_BOUNDARY_ROLE}). They are two spellings of one
 * fact — which level this frame is drawn at — and nothing downstream can tell
 * that they were ever separate, so a boundary whose role said "system" and whose
 * variant said "container" would paint one thing and be judged as another, with
 * nothing on screen to show which half was wrong. Anybody adding a second
 * creation site (a paste path, an importer, a template) writes both or writes
 * neither.
 */
export function createC4Boundary(
  std: BlockStdScope,
  variant: C4BoundaryVariant
) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;
  const { id: _local, ...props } = c4BoundaryElement(
    variant,
    { x: cx - BOUNDARY_REF_WIDTH / 2, y: cy - BOUNDARY_REF_HEIGHT / 2 },
    // Resolved HERE, once — the boundary's name is exported verbatim
    // (`export.ts`) with no placeholder comparison, so it is as safe to
    // translate as a component's title.
    translateKey(std, boundaryLabelKey(variant), BOUNDARY_LABEL[variant])
  );
  finish(gfx, surface.addElement(props));
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
  gfxOf(std).tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: C4_ROLE.relationship,
    // The relationship's look rides on the activation, never through the
    // last-props store: the plain connector tool must keep the user's own
    // style (#144 M1). A dashed grey edge with a filled head is the C4
    // stencil's, and it must not become the plain connector's costume.
    style: {
      stroke: RELATIONSHIP_STROKE,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: RELATIONSHIP_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
    },
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
 *
 * The two written tiers of every component and the groups that say whose words
 * they are ride along untouched, for the reason the picking gives: a tier
 * belongs to its node through the group rather than through the geometry, so
 * both lists cross the seam whole and unfiltered.
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
 * Which of the three it is, is the only thing this function decides; making the
 * answer safe to write to disk is {@link c4SafeFilename}, so the command and the
 * interchange capability cannot name the same board differently.
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
 * Three steps, and only the first and the last know what an editor is: read the
 * surface, run the DECLARED capability (`docs/adr/0012`), download what it
 * produced. The middle step is not re-implemented here — the document, the
 * filename and the content type all come out of `C4_MERMAID_EXPORT.run`, so the
 * command and the registry cannot describe the same board differently. There is
 * one door; the registry is the label on it.
 *
 * A plain import rather than a DI lookup, for the reason `exportBpmnXmlFile`
 * gives: the capability is a pure function and a value, and P3 is explicit that
 * the registry is the editor's view of these functions, not a gate in front of
 * them.
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
