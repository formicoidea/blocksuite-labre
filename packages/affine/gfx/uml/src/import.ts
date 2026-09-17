import type {
  InterchangeNote,
  SerializedElementProps,
} from '@labre/affine-block-surface';
import {
  connectorEndLabelBox,
  ConnectorMode,
  TextAlign,
  UML_FRAME_BAND_HEIGHT,
  UML_LIFELINE_HEAD,
  type UmlFragmentOperand,
  type UmlFragmentOperator,
  type UmlNodeKind,
} from '@labre/affine-model';
import { Bound, type IVec } from '@labre/global/gfx';
import type { ForeignInterchange } from '@labre/std/gfx';

import {
  type UmlBox,
  umlCompartmentBoxes,
  umlLabelRoleOf,
} from './component.js';
import {
  UML_BODY_FONT_SIZE,
  UML_DIAGRAM_BOX,
  UML_EDGE_WIDTH,
  UML_FRAGMENT_BOX,
  UML_INK,
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
  UML_PARTITION_BOX,
  UML_REGION_BOX,
  UML_SUBJECT_BOX,
} from './consts.js';
import { UML_EDGE_STYLE } from './edge-styles.js';
import {
  type UmlAssociationEnd,
  formatActivityEdgeLabel,
  formatEndLabel,
  formatTransitionLabel,
} from './grammar.js';
import { guillemets, UML_UNLABELLED_KINDS } from './keywords.js';
import {
  type UmlClassifier,
  umlGuardText,
  type UmlLifeline,
  type UmlModel,
  type UmlNodeBase,
  type UmlRelation,
  type UmlRelationKind,
  type UmlState,
} from './model.js';
import { umlNodeProps, umlTextProps } from './presets.js';
import { UML_ROLE } from './roles.js';

/**
 * The **one materializer** every UML importer ends on — a model in, the
 * serialized props of a board out (`docs/adr/0012`, P3).
 *
 * ## Why the pipeline forks at the PARSER and nowhere else
 *
 * Three formats read UML into Labre — PlantUML, XMI 2.5.1 and draw.io — and the
 * only thing they disagree about is how a file spells a class. What a class IS
 * on this canvas is five elements written in painting order, with three seeded
 * compartments, one role per tier and a group over them (`actions.ts`), and that
 * answer belongs to the pack rather than to any file format. Written three
 * times it would be wrong in three different ways, and a class imported from a
 * `.drawio` would not be the class the toolbox draws.
 *
 * So each parser produces a {@link UmlModel} — the same IR the two WRITERS
 * already take — and this file turns it into elements. The pivot is the phase-1
 * model and not a shape of its own, which is what makes the round trip
 * checkable: read our own export, materialize it, read the board back with
 * `umlModelFrom`, and the model is the one we started with.
 *
 * ## Never a size, never a colour, never a seed
 *
 * Every prop below comes out of {@link umlNodeProps}, {@link umlTextProps} and
 * {@link umlCompartmentBoxes} — the very three functions the creation site calls
 * (R17). Not one measurement is restated here, so an imported class and a drawn
 * one are the same element down to the stroke width, and a restyle that moves
 * the pack moves the import with it.
 *
 * ## The two names an element carries, and they are not the same name
 *
 * - `interchange[formatId].id` is the SOURCE file's id, verbatim: D3's fixed
 *   point, what an export prefers back, and what a support thread quotes.
 * - `id` is this reader's OWN provisional name — `uml-import-<n>`, minted in
 *   document order. `surface.addElement` overwrites it with a nanoid and is
 *   documented to, so it reaches no document: it exists so that a connector can
 *   say which shape it runs to and a group can say which tiers it holds, before
 *   the surface has minted an id for either. `materializeInterchangeImport`
 *   resolves both.
 *
 * A source id is NOT usable for the second job: a tier and a group are elements
 * Labre mints and no file ever named, two sheets may spell one class the same
 * way, and PlantUML's own identifiers are aliases rather than ids. Minting is
 * the only answer that is always available and always unique.
 *
 * ## Layout (D4)
 *
 * Geometry when the source carried some — `opts.layout.boxes` for a format that
 * reads coordinates out of the file (draw.io's `mxGeometry`, XMI's `umldi`), or
 * the `bounds` a parser already wrote onto the IR. Otherwise a layered layout is
 * INVENTED, in rows by generalization depth, and the caller says so with an
 * `invented-layout` note: D4 forbids claiming a position came from a file that
 * never had one.
 *
 * ## Pure
 *
 * Models in, props out. No `std`, no surface, no DOM, no clock, no randomness —
 * every id and every coordinate is a function of document order alone, so the
 * same file always lands the same board.
 */

/* ── The invented grid ────────────────────────────────────────────────── */

/**
 * One cell of the layered layout — the module a diagram nobody positioned is
 * measured in.
 *
 * Wider and shallower than a class box (200 × 120) on purpose: the gap has to
 * leave room for the name of the relationship drawn across it, and a row of
 * boxes packed edge to edge reads as one band rather than as five classifiers.
 */
export const UML_IMPORT_SLOT = { w: 240, h: 140 } as const;

/** The space between two slots, in both directions. */
export const UML_IMPORT_GUTTER = 60;

/** The margin between the drawing and the frame drawn round it. */
export const UML_IMPORT_MARGIN = 60;

/** The padding inside a container — a package, a subject, a lane, a region. */
const UML_IMPORT_CONTAINER_INSET = 40;

/**
 * The extra space a container keeps at the TOP, above whatever it holds.
 *
 * A package writes its name under a tab (§12.2.4), a subject writes its own in
 * the top-left corner (§18.1.4), a region writes it in a band (§14.2.4): all
 * three put words where a contained artefact would otherwise be drawn, and a
 * class laid over a package's tab is a class the reader cannot attribute.
 */
const UML_IMPORT_CONTAINER_HEADER = 48;

/* ── The invented SEQUENCE layout (§17.2.4) ───────────────────────────── */

/**
 * The distance between two lifeline SPINES on a sheet nobody positioned.
 *
 * Wide enough that a 160-unit head has 40 units of air on either side of it, and
 * that a message label written over the gap is legible. It is also comfortably
 * more than twice {@link UML_SPINE_TOLERANCE}, which is what stops a bar dropped
 * on one spine from being claimed by its neighbour.
 */
export const UML_SD_COLUMN_GAP = 200;

/**
 * The height of ONE SLOT — the vertical distance between two consecutive things
 * that happen.
 *
 * A slot per EVENT and not per message, and that is the whole trick of the
 * sequence importers: a `.puml` and an XMI fragment list state an ORDER and no
 * heights, the canvas states heights and no order, and `model.ts` reads the
 * order back off the heights. Giving every event — an arrow, the start of a bar,
 * the end of one, an `alt`, an `else`, an `end` — a slot of its own is what makes
 * that round trip exact: no two events tie, so nothing can come back reordered.
 */
export const UML_SD_EVENT_STEP = 40;

/** Where the first event sits: one slot below the bottom of the heads. */
export const UML_SD_FIRST_EVENT = UML_LIFELINE_HEAD.h + UML_SD_EVENT_STEP;

/** How far outside the spines it covers a combined fragment is drawn. */
export const UML_SD_FRAGMENT_PADDING = 20;

/**
 * A guard as the CANVAS spells it — §17.6.4's condition in the brackets the
 * notation prints it in.
 *
 * The mirror of `model.ts`'s {@link umlGuardText}, and the only place the three
 * readers add them: every parser produces a bare condition (`x > 0`), the board
 * holds the words the author would have typed (`[x > 0]`), and the reader back
 * off the board takes the pair off again. An unguarded operand stays unguarded —
 * a lone `[]` would be a condition nobody wrote.
 */
function umlGuardLabel(guard: string | undefined): string {
  const condition = umlGuardText(guard);
  return condition ? `[${condition}]` : '';
}

/** The height of the nth slot of an invented sequence layout. */
export function umlSequenceSlot(index: number): number {
  return UML_SD_FIRST_EVENT + index * UML_SD_EVENT_STEP;
}

/**
 * The COLUMN box of the nth lifeline — the narrow tall element, not the head.
 *
 * `UmlNodeElementModel` makes a lifeline the spine and paints the head across
 * the top of it, so what is laid out here is the spine: its centre is the line
 * the conversation is measured against, and the head overflows it on both sides
 * by the same amount.
 */
export function umlSequenceColumn(index: number, height: number): UmlBox {
  const { w } = UML_NODE_BOX.lifeline;
  return {
    x: index * UML_SD_COLUMN_GAP - w / 2,
    y: 0,
    w,
    h: Math.max(UML_NODE_BOX.lifeline.h, height),
  };
}

/** The bar §17.2.4 draws on a spine between two occurrences. */
export function umlSequenceExecution(
  column: UmlBox,
  y0: number,
  y1: number
): UmlBox {
  const { w } = UML_NODE_BOX.execution;
  // At least ONE slot tall: a bar that opened and closed on the same event is
  // still a bar the author drew, and a zero-height rectangle is invisible and
  // unclickable.
  return {
    x: column.x + column.w / 2 - w / 2,
    y: y0,
    w,
    h: Math.max(UML_SD_EVENT_STEP, y1 - y0),
  };
}

/** The cross §17.2.4 ends a lifeline with, centred on the spine. */
export function umlSequenceDestruction(column: UmlBox, y: number): UmlBox {
  const { w, h } = UML_NODE_BOX.destruction;
  return { x: column.x + column.w / 2 - w / 2, y: y - h / 2, w, h };
}

/**
 * The rectangle §17.6.4 draws round the spines a fragment covers.
 *
 * {@link UML_SD_FRAGMENT_PADDING} outside the outermost two, which is what makes
 * the box cover the spines rather than end on them — `model.ts` reads coverage
 * as "the spine runs through the box", and a rectangle whose edge lands exactly
 * on a spine is a coin toss.
 */
export function umlSequenceFragment(
  columns: readonly UmlBox[],
  y0: number,
  y1: number
): UmlBox {
  if (columns.length === 0) {
    return { x: 0, y: y0, w: UML_FRAGMENT_BOX.w, h: Math.max(1, y1 - y0) };
  }
  const centres = columns.map(column => column.x + column.w / 2);
  const left = Math.min(...centres) - UML_SD_FRAGMENT_PADDING;
  const right = Math.max(...centres) + UML_SD_FRAGMENT_PADDING;
  return { x: left, y: y0, w: right - left, h: Math.max(1, y1 - y0) };
}

/** What one artefact asks the layout for. */
export interface UmlLayoutNode {
  id: string;
  /** Its own footprint, before anything it contains is measured. */
  size: { w: number; h: number };
  /** What is drawn INSIDE it, in document order. Containers only. */
  children?: readonly string[];
}

/**
 * A layered layout for a diagram that carried no geometry (D4).
 *
 * ## Rows by generalization depth
 *
 * Because that is the one ordering a class diagram has of its own: §9.2.4 draws
 * the general classifier above the specific one, so a hierarchy read top to
 * bottom is a hierarchy drawn top to bottom, and a sheet laid out this way is
 * legible the moment it opens instead of being a grid somebody has to untangle.
 * A classifier that specializes nothing is a root and sits in the first row;
 * everything else sits one row below the deepest thing it specializes.
 *
 * Containers are laid out RECURSIVELY and sized to fit, because containment on
 * this canvas IS geometry: a class is in a package when it is drawn inside it
 * (`model.ts`, `plantuml.ts`, `xmi.ts` all read it that way), so a layout that
 * placed a package's contents outside it would lose the nesting the file stated.
 *
 * Deterministic by construction: document order within a row, document order
 * inside a container, and no measurement that depends on anything but the sizes
 * handed in.
 */
export function umlInventLayout(
  nodes: readonly UmlLayoutNode[],
  relations: readonly UmlRelation[] = []
): Map<string, UmlBox> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const contained = new Set<string>();
  for (const node of nodes) {
    for (const child of node.children ?? []) {
      if (byId.has(child) && child !== node.id) contained.add(child);
    }
  }

  /** The children a node really has — unknown ids and cycles dropped. */
  const childrenOf = (node: UmlLayoutNode): UmlLayoutNode[] =>
    (node.children ?? [])
      .filter(child => byId.has(child) && child !== node.id)
      .map(child => byId.get(child)!);

  /** How wide and deep a node is once everything inside it is measured. */
  const measured = new Map<string, { w: number; h: number }>();
  const measure = (node: UmlLayoutNode): { w: number; h: number } => {
    const known = measured.get(node.id);
    if (known) return known;
    // Written BEFORE the recursion so a container that somehow contains itself
    // measures as its own box rather than looping forever.
    measured.set(node.id, node.size);

    const children = childrenOf(node);
    if (children.length === 0) return node.size;

    const inner = children.map(measure);
    const columns = Math.ceil(Math.sqrt(children.length));
    const rows = Math.ceil(children.length / columns);
    const cellW = Math.max(...inner.map(box => box.w));
    const cellH = Math.max(...inner.map(box => box.h));
    const size = {
      w: Math.max(
        node.size.w,
        UML_IMPORT_CONTAINER_INSET * 2 +
          columns * cellW +
          (columns - 1) * UML_IMPORT_GUTTER
      ),
      h: Math.max(
        node.size.h,
        UML_IMPORT_CONTAINER_HEADER +
          UML_IMPORT_CONTAINER_INSET +
          rows * cellH +
          (rows - 1) * UML_IMPORT_GUTTER
      ),
    };
    measured.set(node.id, size);
    return size;
  };
  for (const node of nodes) measure(node);

  /** How many generalizations deep this artefact is. */
  const depth = new Map<string, number>(nodes.map(node => [node.id, 0]));
  const rises = relations.filter(
    relation =>
      relation.kind === 'generalization' || relation.kind === 'realization'
  );
  // One pass per node is enough for any acyclic hierarchy, and the cap is what
  // makes a cyclic one terminate instead of hanging the import.
  for (let round = 0; round < nodes.length; round++) {
    let moved = false;
    for (const relation of rises) {
      // The role table makes the SOURCE the specific classifier: it sits one
      // row below the general one it points at.
      const above = depth.get(relation.targetId);
      const below = depth.get(relation.sourceId);
      if (above === undefined || below === undefined) continue;
      if (below <= above) {
        depth.set(relation.sourceId, above + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }

  const boxes = new Map<string, UmlBox>();
  const place = (node: UmlLayoutNode, x: number, y: number) => {
    const size = measured.get(node.id) ?? node.size;
    boxes.set(node.id, { x, y, w: size.w, h: size.h });

    const children = childrenOf(node);
    if (children.length === 0) return;
    const columns = Math.ceil(Math.sqrt(children.length));
    const cellW = Math.max(
      ...children.map(child => (measured.get(child.id) ?? child.size).w)
    );
    const cellH = Math.max(
      ...children.map(child => (measured.get(child.id) ?? child.size).h)
    );
    children.forEach((child, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      place(
        child,
        x + UML_IMPORT_CONTAINER_INSET + column * (cellW + UML_IMPORT_GUTTER),
        y + UML_IMPORT_CONTAINER_HEADER + row * (cellH + UML_IMPORT_GUTTER)
      );
    });
  };

  const top = nodes.filter(node => !contained.has(node.id));
  const levels = [...new Set(top.map(node => depth.get(node.id) ?? 0))].sort(
    (a, b) => a - b
  );
  let y = 0;
  for (const level of levels) {
    const row = top.filter(node => (depth.get(node.id) ?? 0) === level);
    let x = 0;
    let tallest: number = UML_IMPORT_SLOT.h;
    for (const node of row) {
      const size = measured.get(node.id) ?? node.size;
      const cellW = Math.max(UML_IMPORT_SLOT.w, size.w);
      // Centred in its slot, so a 16-unit port and a 220-unit cube in the same
      // row still line up on one axis.
      place(node, x + (cellW - size.w) / 2, y);
      x += cellW + UML_IMPORT_GUTTER;
      tallest = Math.max(tallest, size.h);
    }
    y += tallest + UML_IMPORT_GUTTER;
  }
  return boxes;
}

/* ── The words a tier carries ─────────────────────────────────────────── */

/**
 * A name compartment, written back the way the grammar reads it.
 *
 * The exact inverse of `stereotypesOf`: the Annex C keywords on their own line
 * above the name — which is where §9.2.4 draws them and what the stencils seed —
 * and §9.2.4's `{abstract}` modifier after it, which is the alternative that
 * same clause allows a canvas with no italic name compartment. Read back, the
 * three facts come out exactly as they went in.
 */
export function umlNameTierText(node: UmlNodeBase): string {
  const lines: string[] = [];
  if (node.keywords.length > 0) {
    lines.push(node.keywords.map(guillemets).join(' '));
  }
  const named = node.isAbstract ? `${node.name} {abstract}`.trim() : node.name;
  if (named) lines.push(named);
  return lines.join('\n');
}

/** An instance is labelled `name : Type` — §11.6.4's underlined form. */
function classifierNameText(classifier: UmlClassifier): string {
  if (classifier.kind !== 'object' || !classifier.instanceOf) {
    return umlNameTierText(classifier);
  }
  // Composed into a local exactly as `umlLifelineHeadText` composes a
  // lifeline's head, and for the same reason: both halves are the FILE's own
  // words and the colon between them is §11.6.4's notation, so there is no
  // sentence here for a catalogue to translate.
  const stated = `${classifier.name} : ${classifier.instanceOf}`;
  return umlNameTierText({ ...classifier, name: stated });
}

/** A state's second compartment — §14.2.4.4's internal activities, in order. */
function stateBodyText(state: UmlState): string {
  return [
    ...state.entry.map(body => `entry / ${body}`),
    ...state.doActivity.map(body => `do / ${body}`),
    ...state.exit.map(body => `exit / ${body}`),
    ...state.lines,
  ].join('\n');
}

/* ── What a draft is ──────────────────────────────────────────────────── */

/**
 * The glyph kinds whose one tier is a `uml:name` rather than a `uml:label`.
 *
 * A transcription of `actions.ts`'s own `NAMED_GLYPHS`, kept here rather than
 * imported because that module reaches for the editor (`BlockStdScope`, the gfx
 * controller, the surface) and a reader must not: P3 is what lets labre-mcp call
 * this file with no DI in sight. `import.unit.spec.ts` re-runs the creation
 * commands against a recording surface and compares the tier roles, so the two
 * statements cannot drift in silence.
 */
const NAMED_GLYPH_KINDS: ReadonlySet<UmlNodeKind> = new Set<UmlNodeKind>([
  'package',
  'note',
  'node',
  'device',
  'execution-environment',
]);

/**
 * A glyph that is drawn AGAINST another artefact rather than laid out beside it.
 *
 * The two geometric readings `model.ts` makes — a port on its component's border
 * (§11.3.4) and a lollipop or socket touching the box it names an interface of
 * (§10.4.4) — are the whole reason this exists. Neither is a link the store
 * holds: the export resolves them by MEASURING, within
 * {@link UML_ATTACH_TOLERANCE}. So a materializer that laid a port out in the
 * grid like anything else would produce a board whose export drops every port's
 * owner and every component's contract — the file said it, the drawing lost it.
 */
interface UmlAnchor {
  /** The source id of the artefact this glyph is drawn on or against. */
  ownerId: string;
  /** Which edge of it — §11.3.4's border, §10.4.4's two stubs. */
  side: 'top' | 'left' | 'right';
  index: number;
  count: number;
}

/** What a materialized artefact is, before it has a position. */
interface UmlDraft {
  /** The IR record's id — the SOURCE file's, carried verbatim (D3). */
  sourceId: string;
  /** Which surface element the artefact IS. */
  element:
    | 'umlNode'
    | 'umlSubject'
    | 'umlPartition'
    | 'umlRegion'
    | 'umlFragment';
  /** The node kind, for `element === 'umlNode'`. */
  kind?: UmlNodeKind;
  /** The frame's own `name` prop, for the four background elements. */
  name?: string;
  /** Which way a partition's band runs, when it is not the default. */
  orientation?: 'vertical' | 'horizontal';
  /** A combined fragment's interaction operator (§17.6.4). */
  operator?: UmlFragmentOperator;
  /**
   * A combined fragment's operand bands, as WEIGHTS.
   *
   * Written only for a fragment with a second operand, because the model
   * declares the field `undefined` until one is added and a single-operand
   * fragment written with a one-entry list would not be byte-identical to the
   * one the toolbox draws.
   */
  operands?: UmlFragmentOperand[];
  /** The words of a node, by tier. `undefined` means "no such tier". */
  tiers?: { name: string; attributes?: string; operations?: string };
  size: { w: number; h: number };
  bounds?: UmlBox;
  /** Set when this glyph is drawn against another artefact, not beside it. */
  anchor?: UmlAnchor;
  /**
   * Whether a relation may resolve to this draft.
   *
   * False for the interface marks alone, and it is §10.4.4 rather than an
   * economy: a lollipop is not an element of the model, it is the NOTATION for a
   * realization between the interface it names and the box it touches. Nothing
   * in the file points at it, and `model.ts` deliberately keeps it out of
   * `artefactOf` for the same reason.
   */
  connectable?: boolean;
}

/** The four background frames, and the box each is created at. */
const FRAME_BOX = {
  umlSubject: UML_SUBJECT_BOX,
  umlPartition: UML_PARTITION_BOX,
  umlRegion: UML_REGION_BOX,
  umlFragment: UML_FRAGMENT_BOX,
} as const;

/** The role each background frame carries — one table, read once below. */
const FRAME_ROLE = {
  umlSubject: UML_ROLE.subject,
  umlPartition: UML_ROLE.partition,
  umlRegion: UML_ROLE.region,
  umlFragment: UML_ROLE.fragment,
} as const;

/** Every artefact one model draws, in the order a reader should meet them. */
function draftsOf(model: UmlModel): UmlDraft[] {
  const drafts: UmlDraft[] = [];

  const node = (
    record: UmlNodeBase,
    kind: UmlNodeKind,
    tiers: UmlDraft['tiers']
  ): void => {
    drafts.push({
      sourceId: record.id,
      element: 'umlNode',
      kind,
      tiers,
      size: UML_NODE_BOX[kind],
      ...(record.bounds ? { bounds: record.bounds } : {}),
    });
  };

  const frame = (
    record: UmlNodeBase,
    element: 'umlSubject' | 'umlPartition' | 'umlRegion' | 'umlFragment',
    orientation?: 'vertical' | 'horizontal'
  ): void => {
    drafts.push({
      sourceId: record.id,
      element,
      name: record.name,
      ...(orientation ? { orientation } : {}),
      size: FRAME_BOX[element],
      ...(record.bounds ? { bounds: record.bounds } : {}),
    });
  };

  for (const pkg of model.packages) {
    node(pkg, 'package', { name: umlNameTierText(pkg) });
  }
  for (const classifier of model.classifiers) {
    node(classifier, classifier.kind, {
      name: classifierNameText(classifier),
      attributes: classifier.lines.attributes.join('\n'),
      operations: classifier.lines.operations.join('\n'),
    });
  }
  for (const subject of model.subjects) frame(subject, 'umlSubject');
  for (const actor of model.actors) {
    node(actor, 'actor', { name: umlNameTierText(actor) });
  }
  for (const useCase of model.useCases) {
    node(useCase, 'use-case', { name: umlNameTierText(useCase) });
  }
  for (const component of model.components) {
    node(component, 'component', {
      name: umlNameTierText(component),
      // §11.6.4's body compartment: a component's parts, which this IR does not
      // model. Emitted EMPTY rather than skipped — the layout rules the
      // separator off whatever is written in it, and a component with three
      // elements where the toolbox draws four would not be the same artefact.
      attributes: '',
    });

    // ── The contracts, as the two marks §10.4.4 draws them ────────────
    //
    // `provided` and `required` are NAMES on the IR rather than references,
    // because on this canvas the glyph IS the interface: `model.ts` reads a
    // component's contracts by measuring which lollipops and sockets touch it.
    // So a materializer that wrote the names nowhere would import a component
    // diagram that exports as a row of bare boxes — the file said which
    // contracts the component offers, and the board would not.
    //
    // The ball on the LEFT and the socket on the RIGHT, stacked: §10.4.4 draws
    // each on a stub off the classifier's boundary and gives no side, and one
    // side per direction is what makes a wired-up sheet readable at a glance.
    for (const [names, kind, side] of [
      [component.provided, 'provided-interface', 'left'],
      [component.required, 'required-interface', 'right'],
    ] as const) {
      names.forEach((name, index) => {
        drafts.push({
          // Minted, not the file's: an interface NAME is all the IR carries,
          // and `payload()` writes nothing for an empty source id — which is
          // right, because no element of the file became this mark.
          sourceId: '',
          element: 'umlNode',
          kind,
          tiers: { name },
          size: UML_NODE_BOX[kind],
          connectable: false,
          anchor: {
            ownerId: component.id,
            side,
            index,
            count: names.length,
          },
        });
      });
    }
  }
  // The ports of one box, spread along its top edge rather than stacked on one
  // corner: §11.3.4 draws several ports on one boundary and a component with
  // three of them in the same 16-unit square is a drawing nobody can click.
  const portsOf = new Map<string, number>();
  for (const port of model.ports) {
    if (port.ownerId) {
      portsOf.set(port.ownerId, (portsOf.get(port.ownerId) ?? 0) + 1);
    }
  }
  const portSeat = new Map<string, number>();
  for (const port of model.ports) {
    const owner = port.ownerId;
    const seat = owner ? (portSeat.get(owner) ?? 0) : 0;
    if (owner) portSeat.set(owner, seat + 1);
    drafts.push({
      sourceId: port.id,
      element: 'umlNode',
      kind: 'port',
      tiers: { name: umlNameTierText(port) },
      size: UML_NODE_BOX.port,
      ...(port.bounds ? { bounds: port.bounds } : {}),
      // §11.3.4: "overlapping the boundary of the rectangle symbol denoting
      // that EncapsulatedClassifier". The square has to STRADDLE the border, or
      // the export — which reads ownership as a gap of at most
      // `UML_ATTACH_TOLERANCE` — gives the port back to nobody.
      ...(owner
        ? {
            anchor: {
              ownerId: owner,
              side: 'top' as const,
              index: seat,
              count: portsOf.get(owner) ?? 1,
            },
          }
        : {}),
    });
  }
  for (const artifact of model.artifacts) {
    node(artifact, 'artifact', {
      name: umlNameTierText(artifact),
      attributes: '',
    });
  }
  for (const cube of model.nodes) {
    node(cube, cube.kind, { name: umlNameTierText(cube) });
  }

  for (const activity of model.activities) {
    for (const partition of activity.partitions) {
      frame(partition, 'umlPartition', partition.orientation);
    }
    for (const step of activity.nodes) {
      node(step, step.kind, { name: umlNameTierText(step) });
    }
  }
  for (const machine of model.stateMachines) {
    for (const region of machine.regions) frame(region, 'umlRegion');
    for (const state of machine.states) {
      node(state, 'state', {
        name: umlNameTierText(state),
        attributes: stateBodyText(state),
      });
    }
    for (const final of machine.finalStates) {
      node(final, 'final-state', { name: umlNameTierText(final) });
    }
    for (const pseudo of machine.pseudostates) {
      node(pseudo, pseudo.kind, { name: umlNameTierText(pseudo) });
    }
  }

  // §17 — the sequence sheet. The FRAGMENTS come first, so they are written
  // under the conversation they qualify: a combined fragment is transparent and
  // drawn over the lifelines, and painting order is what decides which of two
  // overlapping backgrounds a click lands on.
  for (const interaction of model.interactions) {
    for (const fragment of interaction.fragments) {
      const split = fragment.operands.length > 1;
      drafts.push({
        sourceId: fragment.id,
        element: 'umlFragment',
        // §17.7.4's `ref` names an INTERACTION and not a condition, so it is
        // written as it is read. Every other operator's `name` is the guard of
        // the fragment's one operand, and the canvas spells a guard the way
        // §17.6.4 prints it — in brackets (`umlGuardText`).
        //
        // A SPLIT fragment writes no `name` at all: its guards live in
        // `operands` and the declared label is anchored in the very corner the
        // first band's is (`background.ts`), so writing both would paint the
        // condition twice.
        name:
          fragment.operator === 'ref'
            ? fragment.name
            : split
              ? ''
              : umlGuardLabel(fragment.operands[0]?.guard ?? fragment.name),
        operator: fragment.operator,
        // ONE operand is the model's `undefined` — see {@link UmlDraft.operands}.
        // The weights are the bands' own heights, which is what keeps a
        // re-export's operand boundaries where the file drew them.
        ...(split
          ? {
              operands: fragment.operands.map((operand, index) => ({
                id: `${fragment.id}-operand-${index + 1}`,
                ...(operand.guard
                  ? { name: umlGuardLabel(operand.guard) }
                  : {}),
                size: Math.max(1, operand.y1 - operand.y0),
              })),
            }
          : {}),
        size: FRAME_BOX.umlFragment,
        ...(fragment.bounds ? { bounds: fragment.bounds } : {}),
      });
    }
    for (const lifeline of interaction.lifelines) {
      node(lifeline, 'lifeline', { name: umlLifelineHeadText(lifeline) });
    }
    // The bar and the cross carry no words (`UML_UNLABELLED_KINDS`), so each is
    // a shape and nothing else — no tier, and therefore no group.
    for (const execution of interaction.executions) {
      node(execution, 'execution', undefined);
    }
    for (const destruction of interaction.destructions) {
      node(destruction, 'destruction', undefined);
    }
  }

  for (const note of model.notes) {
    node(note, 'note', { name: note.body });
  }

  return drafts;
}

/**
 * §17.3.4's `<name> [: <Type>]` — the one compartment a lifeline's head holds.
 *
 * The same line `keywords.ts` seeds a fresh head with and `parseLifelineIdent`
 * reads back, so a lifeline imported from a file and one drawn from the toolbox
 * hold the same text in the same tier.
 */
function umlLifelineHeadText(lifeline: UmlLifeline): string {
  const stated = lifeline.type
    ? `${lifeline.name} : ${lifeline.type}`
    : lifeline.name;
  return umlNameTierText({ ...lifeline, name: stated });
}

/* ── What is drawn inside what ────────────────────────────────────────── */

/**
 * Which container each artefact is drawn inside — the IR's own statements,
 * plus whatever the caller read out of the file.
 *
 * Containment on this canvas IS geometry: `model.ts`, `plantuml.ts` and
 * `xmi.ts` all decide "is this class in that package" by asking whether the
 * centre is inside the box. A file that states the nesting some other way — an
 * XMI `packagedElement`, an `ownedUseCase` — therefore has to have it turned
 * back into a POSITION, and the invented layout is the only thing that can.
 * Anything laid out flat loses the statement on the first export.
 *
 * Three of the four readings are on the IR already and are taken from it rather
 * than asked of the caller: a partition lists the nodes drawn in it
 * ({@link UmlPartition.nodeIds}), a vertex names its composite state
 * ({@link UmlState.regionId}) and a region names the one it is nested in
 * ({@link UmlRegion.parentId}). The fourth — a package's members, a subject's
 * cases — has no slot in the IR, which is why {@link UmlLayoutHints.containment}
 * exists.
 */
function containmentOf(
  model: UmlModel,
  hint: Readonly<Record<string, string>> | undefined
): Map<string, string> {
  const parent = new Map<string, string>();
  for (const [child, container] of Object.entries(hint ?? {})) {
    if (child && container && child !== container) parent.set(child, container);
  }
  for (const activity of model.activities) {
    for (const lane of activity.partitions) {
      for (const nodeId of lane.nodeIds) parent.set(nodeId, lane.id);
    }
  }
  for (const machine of model.stateMachines) {
    for (const region of machine.regions) {
      if (region.parentId) parent.set(region.id, region.parentId);
    }
    for (const vertex of [
      ...machine.states,
      ...machine.finalStates,
      ...machine.pseudostates,
    ]) {
      if (vertex.regionId) parent.set(vertex.id, vertex.regionId);
    }
  }
  return parent;
}

/* ── The edges a model draws ──────────────────────────────────────────── */

/**
 * The relationship kinds a BEHAVIOUR sheet is wired with — the three flows, and
 * phase 3's five messages.
 *
 * All eight are in the set for one reason: each is read off the canvas into
 * BOTH `relations` and the behaviour that owns it, and is read out of a file
 * into the behaviour alone. The dedupe below is what lets {@link umlDrawnEdges}
 * walk both without drawing anything twice.
 */
const BEHAVIOUR_KINDS = new Set<UmlRelationKind>([
  'control-flow',
  'object-flow',
  'transition',
  'message-sync',
  'message-async',
  'message-reply',
  'message-create',
  'message-delete',
]);

/** One line on the board: its role, its two ends and its three labels. */
export interface UmlDrawnEdge {
  kind: UmlRelationKind;
  sourceId: string;
  targetId: string;
  label?: string;
  /**
   * §11.5.4's adornments beside the source end, already SPELLED.
   *
   * A string rather than the {@link UmlAssociationEnd} record, because what the
   * connector holds is a label — one line of text an author goes on to edit by
   * hand. The printing is `formatEndLabel`'s, which is the same one the PlantUML
   * writer uses, so an association imported from XMI and one exported to a
   * `.puml` spell their ends identically.
   */
  sourceEnd?: string;
  /** The same, beside the target end. */
  targetEnd?: string;
  /**
   * The HEIGHT a message is drawn at (§17.4.4), for the five kinds that have
   * one.
   *
   * Present only for a message, and it is what makes a sequence diagram
   * readable at all: every other UML line is anchored at the centre of the two
   * boxes it joins, and a message anchored at the centre of a 600-unit spine
   * would put the whole conversation on one horizontal line. See
   * {@link messageAnchors}.
   */
  y?: number;
}

/**
 * Every line one model draws — `relations`, plus the behaviour edges that live
 * on the Activity and the StateMachine.
 *
 * ## Why there are two places to look, and neither can be dropped
 *
 * `umlModelFrom` reads a canvas and fills BOTH: a transition is a relation (one
 * pass over the connectors resolves every end) and it is projected onto the
 * machine, where the label grammar is parsed. The PlantUML reader mirrors that.
 * The XMI reader cannot: `<edge>` and `<transition>` are children of the
 * Activity and the StateMachine in the file, so it fills
 * {@link UmlActivity.edges} and {@link UmlStateMachine.transitions} and leaves
 * `relations` for the structural arrows. A materializer that walked only
 * `relations` imported every XMI activity and every state machine with ZERO
 * arrows on it — the defect this function exists to close.
 *
 * So: walk both, and DEDUPE, because a model may legitimately hold a line in
 * each. The dedupe is a count per (kind, source, target) rather than a set, so
 * two parallel transitions between one pair stay two — `relations` claims the
 * first, the machine's second one is drawn, and nothing is drawn twice.
 *
 * The labels are printed with `grammar.ts`'s own printers, which is what the
 * PlantUML writer uses: a guard imported from XMI and one exported to a `.puml`
 * are then spelled identically, and `parseTransition` reads back exactly what
 * was written.
 */
export function umlDrawnEdges(model: UmlModel): UmlDrawnEdge[] {
  const spelled = (end: UmlAssociationEnd | undefined): string =>
    end ? formatEndLabel(end) : '';
  const drawn: UmlDrawnEdge[] = model.relations.map(relation => {
    const sourceEnd = spelled(relation.sourceEnd);
    const targetEnd = spelled(relation.targetEnd);
    return {
      kind: relation.kind,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      ...(relation.label ? { label: relation.label } : {}),
      ...(sourceEnd ? { sourceEnd } : {}),
      ...(targetEnd ? { targetEnd } : {}),
    };
  });

  const key = (kind: string, source: string, target: string) =>
    `${kind} ${source} ${target}`;
  const claimed = new Map<string, number>();
  for (const relation of model.relations) {
    if (!BEHAVIOUR_KINDS.has(relation.kind)) continue;
    const at = key(relation.kind, relation.sourceId, relation.targetId);
    claimed.set(at, (claimed.get(at) ?? 0) + 1);
  }
  /** Has `relations` already drawn this one? Consumes the claim if so. */
  const alreadyDrawn = (at: string): boolean => {
    const outstanding = claimed.get(at) ?? 0;
    if (outstanding === 0) return false;
    claimed.set(at, outstanding - 1);
    return true;
  };

  for (const activity of model.activities) {
    for (const edge of activity.edges) {
      if (alreadyDrawn(key(edge.kind, edge.sourceId, edge.targetId))) continue;
      const label = formatActivityEdgeLabel(edge);
      drawn.push({
        kind: edge.kind,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        ...(label ? { label } : {}),
      });
    }
  }
  for (const machine of model.stateMachines) {
    for (const transition of machine.transitions) {
      const at = key('transition', transition.sourceId, transition.targetId);
      if (alreadyDrawn(at)) continue;
      const label = formatTransitionLabel(transition);
      drawn.push({
        kind: 'transition',
        sourceId: transition.sourceId,
        targetId: transition.targetId,
        ...(label ? { label } : {}),
      });
    }
  }
  for (const interaction of model.interactions) {
    for (const message of interaction.messages) {
      const at = key(message.kind, message.sourceId, message.targetId);
      // A message read off the CANVAS is in `relations` as well, exactly as a
      // transition is; one read out of a file is on the interaction alone. The
      // claim is consumed either way, so the arrow is drawn once.
      const claimedAlready = alreadyDrawn(at);
      const already = claimedAlready
        ? drawn.find(
            entry =>
              entry.kind === message.kind &&
              entry.sourceId === message.sourceId &&
              entry.targetId === message.targetId &&
              entry.y === undefined
          )
        : undefined;
      if (already) {
        // The relation pass drew it with no height. The height is the one thing
        // a message has and a relation does not, so it is filled in here rather
        // than the arrow being drawn a second time.
        already.y = message.y;
        continue;
      }
      if (claimedAlready) continue;
      drawn.push({
        kind: message.kind,
        sourceId: message.sourceId,
        targetId: message.targetId,
        ...(message.label ? { label: message.label } : {}),
        y: message.y,
      });
    }
  }
  return drawn;
}

/**
 * Where a message's two ends attach — §17.4.4's horizontal line at the height it
 * happens.
 *
 * On the FACING sides of the two columns, at the same relative height on each:
 * the arrow leaves the right edge of the participant on the left and lands on
 * the left edge of the one on the right, which is what every tool draws and what
 * keeps the line horizontal rather than cutting diagonally through a head.
 *
 * A self-message — an end that resolves to the same column, or one whose box is
 * unknown — leaves and lands on the same side, which is the loop §17.4.4 draws
 * back onto the sender's own lifeline.
 *
 * `y` and the two boxes are in ONE space — the sheet's, after the drawing has
 * been translated onto it. The caller does the translating; a height left in
 * the source's own space would divide against a column that had already moved.
 */
function messageAnchors(
  y: number,
  from: UmlBox | undefined,
  to: UmlBox | undefined
): { source: IVec; target: IVec } {
  /** Where on this box's own height the arrow sits, clamped to it. */
  const level = (box: UmlBox | undefined): number => {
    if (!box || !(box.h > 0)) return 0.5;
    return Math.min(1, Math.max(0, (y - box.y) / box.h));
  };
  const leftward = from && to ? from.x + from.w / 2 > to.x + to.w / 2 : false;
  const sameColumn =
    !from || !to || Math.abs(from.x + from.w / 2 - (to.x + to.w / 2)) < 1;
  if (sameColumn) {
    return { source: [1, level(from)], target: [1, level(to)] };
  }
  return leftward
    ? { source: [0, level(from)], target: [1, level(to)] }
    : { source: [1, level(from)], target: [0, level(to)] };
}

/* ── The materializer ─────────────────────────────────────────────────── */

/** Where a source that carried coordinates says its artefacts are drawn. */
export interface UmlLayoutHints {
  /**
   * Boxes by SOURCE id, in model units and in one coordinate space.
   *
   * Whatever the file drew, translated as a block so its top-left corner lands
   * at the frame's plot origin — the caller need not do the arithmetic, only
   * agree with itself about which corner is which.
   */
  boxes?: Readonly<Record<string, UmlBox>>;
  /**
   * What the file says is drawn INSIDE what — child source id → container
   * source id.
   *
   * For a format that states containment structurally and carries no geometry:
   * XMI's `packagedElement` and `ownedUseCase` are the cases, and without this
   * an imported package comes back empty and every class in it beside it. Read
   * only where {@link boxes} gave no box — a file that drew the nesting has
   * already said where everything is. See {@link containmentOf}.
   */
  containment?: Readonly<Record<string, string>>;
}

export interface UmlMaterializeOptions {
  /**
   * The interchange format whose payload key carries the source ids (D2) —
   * `'plantuml'`, `'xmi'`, `'drawio'`. The same string the capability's
   * {@link InterchangeFormat} declares, because
   * `materializeInterchangeImport` looks the ids back up under it.
   */
  formatId: string;
  layout?: UmlLayoutHints;
  /**
   * The top-left corner the first frame is drawn at. `(0, 0)` by default.
   *
   * An import is a NEW board beside whatever is already there, never a merge
   * (`interchange-import.ts`) — and a materializer that always started at the
   * origin made two imports into one heap. The caller knows what the surface
   * already holds; this is where it says so.
   *
   * `materializeInterchangeImport` does the same thing one layer up, for every
   * framework at once and out of the surface's own bounds, so a command need not
   * pass this. It is here for the callers that have no surface to ask — a
   * labre-mcp tool writing a document, a test — and so that the property is
   * checkable without one.
   */
  origin?: { x: number; y: number };
}

export interface UmlMaterializeResult {
  elements: SerializedElementProps[];
  /** What the materializer had to invent — D4's `invented-layout`, and only it. */
  notes: InterchangeNote[];
}

/** The provisional names this reader mints. See the module docblock. */
const importId = (n: number) => `uml-import-${n}`;

/**
 * The MATERIALIZER's own two remarks, as `[key, English]` pairs — raised by
 * {@link umlElementsFromModel} whichever reader produced the model, which is
 * why they are declared here rather than in any one reader's table.
 *
 * Same shape and same reasons as `UML_PLANTUML_REMARKS`
 * (`plantuml-import.ts`, where the contract is written out): one entry per
 * SHAPE of sentence, the `{{count}}` / `{{heading}}` holes filled at the call
 * site by `InterchangeNote.messageParams`, the English kept here as the
 * fallback so a report drawn with no host catalogue reads exactly as before.
 */
export const UML_LAYOUT_REMARKS = {
  allInvented: [
    'com.labre.uml.import.layout.all-invented',
    'This source carries no coordinates, so the {{count}} artefacts of "{{heading}}" were laid out by Labre, in rows by generalization depth. The positions are ours, not the file\'s.',
  ],
  someInvented: [
    'com.labre.uml.import.layout.some-invented',
    '{{count}} of the artefacts of "{{heading}}" were drawn nowhere in the source, so Labre laid them out below the rest. Their positions are ours, not the file\'s.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

/**
 * Every model as the elements of a board — one `umlDiagram` frame per model,
 * the artefacts drawn on it, and the connectors between them.
 *
 * The frames are stacked down the canvas rather than overlaid, because a UML
 * document with four diagrams in it is four sheets (ADR 0017) and two frames
 * sharing a box is two diagrams neither of which can be attributed.
 */
export function umlElementsFromModel(
  models: readonly UmlModel[],
  options: UmlMaterializeOptions
): UmlMaterializeResult {
  const { formatId, layout } = options;
  const origin = options.origin ?? { x: 0, y: 0 };
  const elements: SerializedElementProps[] = [];
  const notes: InterchangeNote[] = [];
  let minted = 0;
  const mint = () => importId(++minted);

  let frameTop = origin.y;

  for (const model of models) {
    const drafts = draftsOf(model);
    const invented = placeDrafts(drafts, model, layout);
    if (invented > 0) {
      notes.push({
        kind: 'invented-layout',
        sourceId: model.diagram.id,
        // Two SHAPES of sentence, so two keys — never one key whose wording
        // depends on a branch the host cannot see.
        messageKey:
          invented === drafts.length
            ? UML_LAYOUT_REMARKS.allInvented[0]
            : UML_LAYOUT_REMARKS.someInvented[0],
        message:
          invented === drafts.length
            ? `This source carries no coordinates, so the ${invented} artefacts of "${model.diagram.heading}" were laid out by Labre, in rows by generalization depth. The positions are ours, not the file's.`
            : `${invented} of the artefacts of "${model.diagram.heading}" were drawn nowhere in the source, so Labre laid them out below the rest. Their positions are ours, not the file's.`,
        messageParams: {
          count: invented,
          heading: model.diagram.heading,
        },
      });
    }

    // The frame is the union of what is drawn on it, which is the only size
    // that keeps every artefact ATTRIBUTABLE: `umlModelFrom` reads membership as
    // a centre inside the frame's plot, so a sheet smaller than its own drawing
    // would export less than it shows.
    const drawn = drafts
      .map(draft => draft.bounds)
      .filter((box): box is UmlBox => box !== undefined);
    const left = drawn.length > 0 ? Math.min(...drawn.map(box => box.x)) : 0;
    const top = drawn.length > 0 ? Math.min(...drawn.map(box => box.y)) : 0;
    const right =
      drawn.length > 0 ? Math.max(...drawn.map(box => box.x + box.w)) : 0;
    const bottom =
      drawn.length > 0 ? Math.max(...drawn.map(box => box.y + box.h)) : 0;
    const frame = {
      x: origin.x,
      y: frameTop,
      w: Math.max(UML_DIAGRAM_BOX.w, right - left + UML_IMPORT_MARGIN * 2),
      h: Math.max(
        UML_DIAGRAM_BOX.h,
        bottom -
          top +
          UML_FRAME_BAND_HEIGHT +
          UML_IMPORT_CONTAINER_INSET +
          UML_IMPORT_MARGIN
      ),
    };
    // What moves the whole drawing onto the sheet: the plot origin is under the
    // heading band, never over it (`umlSheetOf`).
    const dx = frame.x + UML_IMPORT_MARGIN - left;
    const dy =
      frame.y + UML_FRAME_BAND_HEIGHT + UML_IMPORT_CONTAINER_INSET - top;

    elements.push({
      type: 'umlDiagram',
      id: mint(),
      role: UML_ROLE.diagram,
      name: model.diagram.name,
      kind: model.diagram.kind,
      xywh: new Bound(frame.x, frame.y, frame.w, frame.h).serialize(),
      ...payload(formatId, model.diagram.id),
    });

    /** The provisional name a relation's end resolves to. */
    const shapeOf = new Map<string, string>();
    /** Where that shape ended up — what an end label's box is measured off. */
    const boxOf = new Map<string, UmlBox>();

    for (const draft of drafts) {
      const box = draft.bounds ?? { x: 0, y: 0, ...draft.size };
      const placed = {
        x: box.x + dx,
        y: box.y + dy,
        w: box.w,
        h: box.h,
      };
      const xywh = new Bound(
        placed.x,
        placed.y,
        placed.w,
        placed.h
      ).serialize();

      if (draft.element !== 'umlNode') {
        const id = mint();
        if (draft.sourceId) {
          shapeOf.set(draft.sourceId, id);
          boxOf.set(draft.sourceId, placed);
        }
        elements.push({
          type: draft.element,
          id,
          role: FRAME_ROLE[draft.element],
          name: draft.name ?? '',
          // The model defaults a band to vertical, and a creation that restated
          // the default would be a second place for it to be changed.
          ...(draft.orientation === 'horizontal'
            ? { orientation: 'horizontal' }
            : {}),
          // §17.6.4's operator and its operand bands. `alt` is the model's own
          // default and is written all the same: unlike an orientation, the
          // operator IS the fragment, and a document that left it out would be
          // one whose pentagon depends on a default nobody can see.
          ...(draft.operator ? { operator: draft.operator } : {}),
          ...(draft.operands ? { operands: draft.operands } : {}),
          xywh,
          ...payload(formatId, draft.sourceId),
        });
        continue;
      }

      const kind = draft.kind!;
      const shapeId = mint();
      // An interface MARK answers for nothing: §10.4.4 draws it as the notation
      // for a relationship rather than as an element, which is exactly why
      // `model.ts` keeps it out of `artefactOf`. A connector must never resolve
      // to a lollipop.
      if (draft.sourceId && draft.connectable !== false) {
        shapeOf.set(draft.sourceId, shapeId);
        boxOf.set(draft.sourceId, placed);
      }
      elements.push({
        ...umlNodeProps(kind, { xywh }),
        id: shapeId,
        ...payload(formatId, draft.sourceId),
      });

      const children: string[] = [shapeId];
      const boxes = umlCompartmentBoxes(
        kind,
        placed.x,
        placed.y,
        placed.w,
        placed.h
      );
      const tiers = draft.tiers ?? { name: '' };

      // A mark the notation draws no words on is the SHAPE and nothing else —
      // and therefore no group either, because a group of one element is a
      // wrapper a user would have to descend through (`actions.ts`).
      if (!UML_UNLABELLED_KINDS.has(kind)) {
        const compartmented = boxes.attributes !== undefined;
        const tierId = mint();
        children.push(tierId);
        elements.push({
          ...umlTextProps(
            compartmented || NAMED_GLYPH_KINDS.has(kind)
              ? UML_ROLE.name
              : // A lifeline's head is `uml:lifeline-ident`, every other single
                // word is `uml:label` — the creation path's own table, read
                // rather than restated (`component.ts`).
                umlLabelRoleOf(kind),
            boxes.name,
            {
              fontSize: UML_NAME_FONT_SIZE,
              // A note holds a sentence rather than a title (Annex A), and a
              // centred paragraph is the one thing on a UML diagram that reads
              // as a poem.
              align: kind === 'note' ? TextAlign.Left : TextAlign.Center,
              // The classifier's name is the heading of a divided box; a
              // glyph's one word is not.
              ...(compartmented ? { bold: true } : {}),
            }
          ),
          id: tierId,
          text: tiers.name,
        });

        for (const [role, box, words] of [
          [UML_ROLE.attributes, boxes.attributes, tiers.attributes],
          [UML_ROLE.operations, boxes.operations, tiers.operations],
        ] as const) {
          if (!box) continue;
          const bodyId = mint();
          children.push(bodyId);
          elements.push({
            ...umlTextProps(role, box, {
              fontSize: UML_BODY_FONT_SIZE,
              align: TextAlign.Left,
            }),
            id: bodyId,
            text: words ?? '',
          });
        }
      }

      if (children.length > 1) {
        // LAST, so it is written after everything it holds — and so the caller's
        // map already answers for every child by the time this row is created.
        elements.push({
          type: 'group',
          id: mint(),
          children: Object.fromEntries(children.map(child => [child, true])),
        });
      }
    }

    // `relations` AND the behaviour edges that live on the Activity and the
    // StateMachine — see {@link umlDrawnEdges} for why there are two places to
    // look and why walking one of them imported every XMI flow as a blank sheet.
    for (const edge of umlDrawnEdges(model)) {
      const source = shapeOf.get(edge.sourceId);
      const target = shapeOf.get(edge.targetId);
      // An end this sheet holds no artefact for: there is nothing to draw
      // between. The parser has already said so in a note of its own.
      if (!source || !target) continue;
      // §17.4.4: a message is drawn at the height it happens, on the facing
      // edges of the two columns. Everything else is anchored at the centre of
      // the two boxes, which is what a structural relationship means.
      //
      // TRANSLATED, by the very `dy` every box above was placed with: `boxOf`
      // holds the columns as they were PUT ON THE SHEET, and a height still in
      // the source's own space would be measured against them — putting every
      // message endpoint `dy` above the arrow the author is shown, and handing
      // a re-export a conversation in a different order.
      const anchors =
        edge.y === undefined
          ? undefined
          : messageAnchors(
              edge.y + dy,
              boxOf.get(edge.sourceId),
              boxOf.get(edge.targetId)
            );
      elements.push({
        type: 'connector',
        id: mint(),
        role: UML_ROLE[edge.kind],
        // STRAIGHT, always: UML's lines state a relationship between two
        // classifiers, and the elbows of an orthogonal router would read as a
        // route through the diagram that nobody drew (`actions.ts`).
        mode: ConnectorMode.Straight,
        stroke: UML_INK,
        strokeWidth: UML_EDGE_WIDTH,
        ...UML_EDGE_STYLE[edge.kind],
        source: { id: source, position: anchors?.source ?? [0.5, 0.5] },
        target: { id: target, position: anchors?.target ?? [0.5, 0.5] },
        ...(edge.label ? { text: edge.label } : {}),
        ...endLabelProps(
          edge,
          boxOf.get(edge.sourceId),
          boxOf.get(edge.targetId)
        ),
      });
    }

    frameTop = frame.y + frame.h + UML_IMPORT_GUTTER;
  }

  return { elements, notes };
}

/* ── The two end labels a connector is created with (ADR 0020) ─────────── */

/**
 * The box an imported end label is created with — one short line of text.
 *
 * A SIZE and not a measurement: nothing here can measure text (no DOM, and the
 * module says so), and an end label is `0..*`, `1` or a short role name. The
 * renderer re-measures the moment it paints, and the author drags it the moment
 * they disagree.
 */
const UML_END_LABEL_SIZE = { w: 60, h: 24 } as const;

/**
 * `sourceLabel` / `targetLabel` and their boxes, for a connector being created.
 *
 * ## Why a box has to be computed at all
 *
 * The connector's label boxes are PERSISTED (`labelXYWH` and the two ADR 0020
 * siblings): the model holds where the author dragged the label to, and the
 * renderer draws it there. A connector created with a label and no box would
 * have to be laid out by something, and nothing here is in a position to run the
 * router — the element does not exist yet, so it has no path, and the path is
 * what an end label is positioned along.
 *
 * ## The approximation, and why it is honest
 *
 * The straight segment between the two node CENTRES, handed to the SAME
 * function the renderer and the editor anchor an end label with
 * ({@link connectorEndLabelBox}) — so an imported label starts exactly where a
 * label created by hand on the same line would.
 *
 * The segment is an approximation of the routed path and a close one: every UML
 * connector this materializer creates is `ConnectorMode.Straight` (see the call
 * site's own note) with both ends attached at `[0.5, 0.5]`, so the path the
 * router produces is that segment clipped to the two boxes' perimeters — the
 * same line, shorter at each end. The box therefore lands a little further in
 * from the endpoint than the router would put it, which §11.5.4 still calls
 * "near the end of the line", and which the first re-route corrects.
 *
 * No box is written when either node has no placed box — an end whose artefact
 * this sheet never drew. The label text is still written, but a label with no
 * box is not painted (`hasEndLabel` wants both) until the first edit seeds
 * one; today the branch is unreachable, since an edge whose ends do not
 * resolve is skipped before this point.
 */
function endLabelProps(
  edge: UmlDrawnEdge,
  from: UmlBox | undefined,
  to: UmlBox | undefined
): Record<string, unknown> {
  if (!edge.sourceEnd && !edge.targetEnd) return {};

  const centre = (box: UmlBox): IVec => [box.x + box.w / 2, box.y + box.h / 2];
  const path = from && to ? [centre(from), centre(to)] : undefined;
  const boxAt = (end: 'source' | 'target') =>
    path ? connectorEndLabelBox(path, end, UML_END_LABEL_SIZE) : undefined;

  const sourceBox = edge.sourceEnd ? boxAt('source') : undefined;
  const targetBox = edge.targetEnd ? boxAt('target') : undefined;
  return {
    ...(edge.sourceEnd ? { sourceLabel: edge.sourceEnd } : {}),
    ...(sourceBox ? { sourceLabelXYWH: sourceBox } : {}),
    ...(edge.targetEnd ? { targetLabel: edge.targetEnd } : {}),
    ...(targetBox ? { targetLabelXYWH: targetBox } : {}),
  };
}

/** The foreign payload one element carries: its source id, and no more (D3). */
function payload(
  formatId: string,
  sourceId: string
): { interchange?: Record<string, ForeignInterchange> } {
  if (!sourceId) return {};
  return { interchange: { [formatId]: { id: sourceId } } };
}

/** How far a lollipop or a socket sits from the box it names a contract of. */
const UML_IMPORT_MARK_GAP = 12;

/**
 * Give every draft a box, and say how many of them Labre had to invent.
 *
 * Three sources, in order of authority: the caller's hints (a format that reads
 * coordinates out of the file), the `bounds` a parser already wrote onto the IR,
 * and — for what neither answered — the layered layout, laid out BELOW
 * everything the file did place so that nothing an author drew is covered by
 * something they did not.
 *
 * ANCHORED glyphs are none of the three: a port and the two interface marks are
 * drawn ON or AGAINST another artefact (§11.3.4, §10.4.4), so they are placed
 * last, out of the box their owner ended up in — see {@link UmlAnchor}.
 */
function placeDrafts(
  drafts: UmlDraft[],
  model: UmlModel,
  layout: UmlLayoutHints | undefined
): number {
  const hinted = layout?.boxes;
  for (const draft of drafts) {
    // `Object.hasOwn`, because the id is the FILE's: a drawing that names a
    // shape `toString` would otherwise be handed a function as its box, and
    // every coordinate computed off it is `NaN`. The readers hand over a bag
    // with no prototype; this is what holds for a caller that does not.
    const hint =
      draft.sourceId && hinted && Object.hasOwn(hinted, draft.sourceId)
        ? hinted[draft.sourceId]
        : undefined;
    if (hint) draft.bounds = hint;
  }

  const anchored = drafts.filter(
    draft => draft.anchor !== undefined && draft.bounds === undefined
  );
  const loose = drafts.filter(
    draft => draft.bounds === undefined && draft.anchor === undefined
  );

  if (loose.length > 0) {
    const placed = drafts
      .map(draft => draft.bounds)
      .filter((box): box is UmlBox => box !== undefined);
    const below =
      placed.length > 0
        ? Math.max(...placed.map(box => box.y + box.h)) + UML_IMPORT_GUTTER
        : 0;

    // Containment, so the invented layout draws the nesting the file stated:
    // a class in its package, a case in its subject, an action in its lane, a
    // state in its composite state. Only the drafts that are actually being laid
    // out here take part — a child the file DID place stays where the file put
    // it, and its container is sized by the same file.
    const inLayout = new Set(loose.map(draft => draft.sourceId));
    const children = new Map<string, string[]>();
    for (const [child, container] of containmentOf(
      model,
      layout?.containment
    )) {
      if (!inLayout.has(child) || !inLayout.has(container)) continue;
      const held = children.get(container);
      if (held) held.push(child);
      else children.set(container, [child]);
    }

    const boxes = umlInventLayout(
      loose.map(draft => {
        const held = children.get(draft.sourceId);
        return {
          id: draft.sourceId,
          size: draft.size,
          ...(held ? { children: held } : {}),
        };
      }),
      model.relations
    );
    for (const draft of loose) {
      const box = boxes.get(draft.sourceId);
      draft.bounds = box
        ? { x: box.x, y: box.y + below, w: box.w, h: box.h }
        : { x: 0, y: below, ...draft.size };
    }
  }

  const owners = new Map<string, UmlBox>();
  for (const draft of drafts) {
    if (draft.sourceId && draft.bounds)
      owners.set(draft.sourceId, draft.bounds);
  }
  for (const draft of anchored) {
    draft.bounds = anchoredBox(draft, owners.get(draft.anchor!.ownerId));
  }

  return loose.length + anchored.length;
}

/**
 * Where a glyph drawn against another artefact goes.
 *
 * The numbers are the notation's, and the tolerance is the export's: `model.ts`
 * gives a port its owner and a mark its component by measuring an edge-to-edge
 * GAP of at most {@link UML_ATTACH_TOLERANCE}, so a square that missed the
 * border by more than that would import a component whose ports belong to
 * nobody. A port therefore STRADDLES the top edge (§11.3.4's own preferred
 * drawing, gap zero), and the two marks sit one {@link UML_IMPORT_MARK_GAP} off
 * the side, which is well inside the tolerance and still reads as a stub.
 *
 * An owner that was never placed — a file naming a component it does not
 * declare — leaves the glyph at the origin of the sheet rather than nowhere:
 * it is on the drawing, it names nothing, and that is what the file said.
 */
function anchoredBox(draft: UmlDraft, owner: UmlBox | undefined): UmlBox {
  const { w, h } = draft.size;
  if (!owner) return { x: 0, y: 0, w, h };
  const { index, count, side } = draft.anchor!;

  if (side === 'top') {
    // Spread along the width, each at the centre of its own share of it, and
    // half the square above the line: §11.3.4 draws the port overlapping the
    // boundary rather than beside it.
    const step = owner.w / (count + 1);
    return {
      x: owner.x + step * (index + 1) - w / 2,
      y: owner.y - h / 2,
      w,
      h,
    };
  }

  // Stacked down the side, starting at the top of the box: the ball on the
  // left, the socket on the right (§10.4.4 draws each on a stub and names no
  // side; one side per direction is what makes a wired sheet readable).
  const stack = index * (h + UML_IMPORT_MARK_GAP);
  return {
    x:
      side === 'left'
        ? owner.x - w - UML_IMPORT_MARK_GAP
        : owner.x + owner.w + UML_IMPORT_MARK_GAP,
    y: owner.y + stack,
    w,
    h,
  };
}
