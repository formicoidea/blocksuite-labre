import {
  backgroundPlot,
  type FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import type {
  C4BoardElementModel,
  C4BoundaryElementModel,
  C4NodeElementModel,
  C4NodeKind,
  ConnectorElementModel,
} from '@labre/affine-model';
import type { Bound } from '@labre/global/gfx';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background';
import {
  type C4ComponentGroup,
  c4ComponentTiers,
  c4StatedDescription,
  c4StatedName,
  c4StatedTechnology,
  type C4TierElement,
} from './component';
import { C4_ROLE, C4_ROLE_OF_KIND } from './roles';

/**
 * The board, as a **mermaid C4 diagram** (https://mermaid.js.org/syntax/c4.html).
 *
 * ## Pure by construction
 *
 * Element models in, string out. No `BlockStdScope`, no surface, no DOM, no
 * clock and no randomness — the same discipline `bpmn/export.ts` holds itself
 * to, and for the same three reasons: a host can call it, a test can call it
 * with plain stubs, and the same board always serializes to the same bytes. The
 * command that downloads the file is the only thing that knows what a canvas is.
 *
 * ## What it says, and what it refuses to say
 *
 * The export speaks the author's STATEMENTS and nothing else. A connector
 * carrying no C4 role relates nothing — `docs/adr/0010` is explicit that the
 * role is the statement — so it is not a relationship that happens to be
 * untyped, it is not a relationship at all, and it is absent. A plain rectangle
 * drawn on a board is likewise not an unnamed system. Guessing would put words
 * in an architect's mouth in a file they are about to paste into a renderer.
 *
 * ## Why the BOARD is the scope, where BPMN took the whole surface
 *
 * A BPMN document is a process, and half a process is not a smaller process —
 * so `exportBpmnXml` serializes every pool on the surface whatever launched it.
 * A C4 board is the opposite object: it is one LEVEL of one model (a context, a
 * container or a component diagram), and the whole point of drawing three of
 * them side by side on one canvas is that they are three separate diagrams.
 * Merging them would produce a picture C4 explicitly tells you not to draw.
 *
 * So the scope is the SELECTED board, and an element belongs to it by the same
 * arithmetic every framework in this library attributes with: its centre inside
 * the frame's plot (`bpmn/facts.ts`, and the audit's own `attribute()`).
 * Selecting several boards yields several documents, one per board, each
 * complete and each announced by a `%%` comment — mermaid renders ONE diagram
 * per document, so the alternative would be a file no renderer accepts.
 */

/* ── Kind → mermaid macro ─────────────────────────────────────────────── */

/**
 * Which of the three C4 diagram types a document is, and the ladder that
 * decides it.
 *
 * mermaid asks for the type on the FIRST line, and it is not decoration: the
 * macros it accepts are gated on it (`Component` is not a `C4Context` word).
 * The type is therefore inferred from the deepest level actually drawn rather
 * than asked of the author — a board holding a component is a component
 * diagram, whatever its title says.
 */
type C4Level = 'context' | 'container' | 'component';

const LEVEL_RANK: Record<C4Level, number> = {
  context: 0,
  container: 1,
  component: 2,
};

const DIAGRAM_OF_LEVEL: Record<C4Level, string> = {
  context: 'C4Context',
  container: 'C4Container',
  component: 'C4Component',
};

export interface C4MermaidMapping {
  /** The mermaid macro this kind is written as. */
  macro:
    | 'Person'
    | 'Person_Ext'
    | 'System'
    | 'System_Ext'
    | 'Container'
    | 'ContainerDb'
    | 'Component';
  /**
   * mermaid's third positional argument (`techn`), for the two kinds that are a
   * container with a picture rather than a container flavour of their own.
   */
  techn?: string;
  /** The lowest diagram type that admits this kind. */
  level: C4Level;
}

/**
 * The whole notation, kind by kind — the table this module is really about.
 *
 * `Record<C4NodeKind, …>` and therefore COMPILE-TOTAL: a kind added to the pack
 * without a mermaid macro to serialize it as fails the build here, which is the
 * only place that failure is cheap. A kind that reached a document and had no
 * mapping would be an artefact the author drew, saved, and then silently lost on
 * export.
 *
 * Three entries do not map one-for-one and the reasons are C4's own:
 *
 * - `mobile` and `browser` have no macro of their own, because they are not a
 *   level: they are a CONTAINER with a picture (`roles.ts` says the same thing
 *   about their role). What the picture meant is written into mermaid's `techn`
 *   slot, which is where a reader of the file looks for it;
 * - `database` becomes `ContainerDb` rather than `Container`, which is the one
 *   specialisation the notation itself draws — the cylinder;
 * - `person-ext` / `system-ext` take the `_Ext` macros, so mermaid paints them
 *   grey exactly as the canvas does. The external variants are the same LEVEL,
 *   which is why they never move the diagram type.
 */
export const C4_MERMAID_OF_KIND: Record<C4NodeKind, C4MermaidMapping> = {
  person: { macro: 'Person', level: 'context' },
  'person-ext': { macro: 'Person_Ext', level: 'context' },
  system: { macro: 'System', level: 'context' },
  'system-ext': { macro: 'System_Ext', level: 'context' },
  container: { macro: 'Container', level: 'container' },
  database: { macro: 'ContainerDb', level: 'container' },
  mobile: { macro: 'Container', techn: 'mobile app', level: 'container' },
  browser: { macro: 'Container', techn: 'web browser', level: 'container' },
  component: { macro: 'Component', level: 'component' },
};

/**
 * Which macros have a `techn` slot at all — mermaid's own grammar, and the
 * reason the emission cannot be one `args.push` for everybody.
 *
 * The C4 macros take their optional arguments POSITIONALLY, and the position of
 * `descr` is not the same in both families: `Person(alias, label, descr)` and
 * `System(alias, label, descr)` have no technology (a person is not built with
 * one, and a software system's is a level down), while
 * `Container(alias, label, techn, descr)` and `Component(…)` do. Emitting a
 * description in the third slot of a `Container` would render it as the
 * technology — a wrong statement in a file somebody pastes into a renderer, and
 * the exact reason this is a table rather than a conditional.
 *
 * The consequence for a `person` the author typed a technology on: it is drawn
 * in the type line on the canvas (`c4TypeLine` writes whatever it is given) and
 * it does not survive the export, because mermaid has nowhere to put it. Better
 * than the alternative, which is inventing a slot or shifting the description.
 */
const MACRO_TAKES_TECHN: Record<C4MermaidMapping['macro'], boolean> = {
  Person: false,
  Person_Ext: false,
  System: false,
  System_Ext: false,
  Container: true,
  ContainerDb: true,
  Component: true,
};

/** The two boundary macros, keyed by the variant the element declares. */
const BOUNDARY_MACRO = {
  system: 'System_Boundary',
  container: 'Container_Boundary',
} as const;

/**
 * What an unnamed thing is called.
 *
 * mermaid's macros take the label positionally and an empty string renders as a
 * shape with nothing written in it — which is exactly the box the author is
 * looking at, and exactly the box nobody can read. `"?"` is the honest
 * placeholder: it says "this one has no name" rather than pretending it does,
 * and it survives the round trip to whoever has to fix it.
 */
const UNNAMED = '?';

/* ── Text ─────────────────────────────────────────────────────────────── */

/**
 * A label, as something mermaid's C4 parser can carry inside `"…"`.
 *
 * Four transformations, and every one of them is a thing the grammar cannot
 * express rather than a preference:
 *
 * - **line breaks and control characters become a space.** A macro call is one
 *   line, and a canvas label routinely is not — it is how a system name fits in
 *   its box. Written raw, the second line would be a statement mermaid cannot
 *   parse; joined with a space, the whole label survives.
 * - **`"` becomes `'`.** The C4 grammar has no escape for a double quote inside
 *   a quoted argument: the first one ENDS the string, and everything after it is
 *   read as syntax. A straight apostrophe is the closest character that is not a
 *   parse error.
 * - **a run of `%` collapses to one.** `%%` opens a comment wherever it appears
 *   on a line, quoted or not, so a label containing it would silently truncate
 *   the rest of the statement.
 * - **whitespace runs collapse and the result is trimmed**, which is what makes
 *   a two-line label read as one sentence rather than as one with a gap in it.
 *
 * Nothing else is touched. Accents, CJK and emoji all go through unharmed —
 * they are text, mermaid carries text, and folding them would be this exporter
 * rewriting somebody's diagram.
 */
export function toMermaidText(raw: string): string {
  return raw
    .replaceAll(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replaceAll('"', "'")
    .replaceAll(/%{2,}/g, '%')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * An alias — the identifier every macro takes first and every `Rel` refers back
 * to.
 *
 * Derived from the NAME rather than from the surface id, because an alias is
 * READ: a `Rel(customer, internet_banking, "uses")` says what it relates, and
 * `Rel(_x7fQa, _9bTz1, "uses")` says nothing at all to the human who opens the
 * file. The transformation is deliberately lossy — ASCII only, because the
 * grammar's identifier is a bare word and a unicode one is a lexer error where
 * a folded one is merely uglier — which is what {@link AliasMinter} is for.
 */
export function toMermaidAlias(raw: string): string {
  let out = '';
  for (const char of raw.toLowerCase()) {
    out += /[a-z0-9_]/.test(char) ? char : '_';
  }
  out = out.replaceAll(/_{2,}/g, '_').replace(/^_+/, '').replace(/_+$/, '');
  if (out.length === 0) return 'e';
  // An identifier may not open on a digit. `e_` — for "element" — rather than a
  // bare `_`, so two names one digit apart stay one character apart.
  return /^[0-9]/.test(out) ? `e_${out}` : out;
}

/**
 * Mints document-unique aliases, and remembers what it minted.
 *
 * Uniqueness is settled by a counting suffix rather than by a hash, the same
 * call `bpmn/export.ts`'s `IdMinter` makes: `customer` and `customer_2` are both
 * readable in a diagram somebody is about to debug, which is where a human will
 * actually meet them.
 */
class AliasMinter {
  readonly #taken = new Set<string>();

  mint(name: string): string {
    const base = toMermaidAlias(name);
    if (!this.#taken.has(base)) {
      this.#taken.add(base);
      return base;
    }
    let n = 2;
    while (this.#taken.has(`${base}_${n}`)) n++;
    const unique = `${base}_${n}`;
    this.#taken.add(unique);
    return unique;
  }
}

/* ── Geometry ─────────────────────────────────────────────────────────── */

/**
 * A bound's centre, as ratios of a frame's PLOT — `null` for a degenerate plot.
 *
 * Ratios of the plot and not of the element box, for the reason `bpmn/facts.ts`
 * gives: the margin between the two is where the frame writes its own words, and
 * an element laid over the board's title is not on the sheet's drawing area.
 */
function plotRatios(
  def: FrameworkBackgroundDef,
  frame: Bound,
  bound: Bound
): readonly [number, number] | null {
  const plot = backgroundPlot(def, frame.w, frame.h);
  if (!(plot.width > 0) || !(plot.height > 0)) return null;
  return [
    (bound.x + bound.w / 2 - frame.x - plot.x0) / plot.width,
    (bound.y + bound.h / 2 - frame.y - plot.y0) / plot.height,
  ];
}

/** Inclusive containment of the centre in the plot, exactly as `zoneAt` tests it. */
function centreInPlot(
  def: FrameworkBackgroundDef,
  frame: Bound,
  bound: Bound
): boolean {
  const at = plotRatios(def, frame, bound);
  return at !== null && at[0] >= 0 && at[0] <= 1 && at[1] >= 0 && at[1] <= 1;
}

/** The plot's area — what "the SMALLEST containing boundary" is measured on. */
function plotArea(def: FrameworkBackgroundDef, frame: Bound): number {
  const plot = backgroundPlot(def, frame.w, frame.h);
  return Math.max(0, plot.width) * Math.max(0, plot.height);
}

/* ── Input ────────────────────────────────────────────────────────────── */

/**
 * The surface, split by what each element is.
 *
 * `boards` is the SELECTION — the boards the author asked for — while the other
 * three lists are everything on the surface, because what belongs to a board is
 * decided here by geometry rather than by the caller. Document order throughout:
 * it is the tie-break attribution breaks on, and sorting would make the export
 * disagree with the badge the user can see.
 */
export interface C4ExportBoard {
  boards: readonly C4BoardElementModel[];
  nodes: readonly C4NodeElementModel[];
  boundaries: readonly C4BoundaryElementModel[];
  connectors: readonly ConnectorElementModel[];
  /**
   * Every canvas TEXT element on the surface, and every GROUP.
   *
   * The two written tiers of a component — its type line and its description —
   * are real text elements grouped with the shape since the PO's recette of
   * 28/08/2026, so this is where the exporter reads the technology and the
   * sentence it used to read off two model fields. `component.ts` does the
   * resolving; both lists arrive unfiltered and in document order, exactly as
   * the other three do.
   *
   * OPTIONAL, and the absence is not a degraded case: a host that hands over
   * nodes alone gets an export of nodes alone, with every technology and every
   * description empty. Which is also what a node whose group was released or
   * whose words were deleted resolves to — see {@link c4ComponentTiers}.
   */
  texts?: readonly C4TierElement[];
  groups?: readonly C4ComponentGroup[];
}

/* ── The plan ─────────────────────────────────────────────────────────── */

interface PlannedNode {
  model: C4NodeElementModel;
  mapping: C4MermaidMapping;
  alias: string;
  name: string;
  /** The `techn` argument, already sanitized. Empty means "not stated". */
  techn: string;
  /** The `descr` argument, already sanitized. Empty means "not stated". */
  descr: string;
  /** Index into the document's boundary list, or -1 for the top level. */
  parent: number;
}

interface PlannedBoundary {
  model: C4BoundaryElementModel;
  macro: (typeof BOUNDARY_MACRO)[keyof typeof BOUNDARY_MACRO];
  alias: string;
  name: string;
  /** Index into the document's boundary list, or -1 for the top level. */
  parent: number;
}

/** The text an element carries, as a plain string mermaid can hold. */
function labelOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  return toMermaidText(String(value));
}

/**
 * The role an element must carry to be exported at all.
 *
 * Read off the element rather than off its `kind`, and the difference is the
 * whole of `docs/adr/0010`: the kind says which glyph to paint, the ROLE is the
 * author's statement that this box is a system. A shape drawn with the C4
 * palette by hand — copied, pasted, restyled — carries no role and is therefore
 * not a C4 element, however much it looks like one.
 */
function isC4Node(model: C4NodeElementModel): boolean {
  return model.role === C4_ROLE_OF_KIND[model.kind];
}

/* ── The serializer ───────────────────────────────────────────────────── */

/**
 * Serialize the selected C4 board(s) as mermaid C4 source.
 *
 * ## The shape of one document
 *
 * ```
 * C4Container
 *   title Internet banking
 *   Person(customer, "Customer")
 *   System_Boundary(internet_banking, "Internet banking") {
 *     Container(spa, "Single-page app", "web browser")
 *     ContainerDb(database, "Database")
 *   }
 *   Rel(customer, spa, "uses")
 * ```
 *
 * Elements first, nested in the boundaries they are drawn inside, then every
 * relationship — mermaid resolves a `Rel` by alias, so an element declared after
 * the line referring to it renders as an empty box on some versions and not at
 * all on others. Boundaries are laid out by geometric containment, attributed to
 * the SMALLEST frame whose plot holds the centre, so a container boundary drawn
 * inside a system boundary nests inside it here too.
 *
 * ## What is dropped, and why it is not a bug
 *
 * A relationship with an end that is dangling, that lands on something with no
 * C4 role, or that lands on an element of ANOTHER board. mermaid has no way to
 * say "and this points off the page", and inventing an anchor would be the
 * export asserting a link the author never drew. The picture keeps them; the
 * file cannot carry them.
 */
export function exportC4Mermaid(board: C4ExportBoard): string {
  // No board is not an error, it is a selection nobody made a statement with:
  // the honest answer is the smallest valid document, which says nothing.
  if (board.boards.length === 0) return 'C4Context\n';

  const many = board.boards.length > 1;
  return board.boards.map(frame => oneBoard(frame, board, many)).join('\n');
}

/** One board, as one complete mermaid document (trailing newline included). */
function oneBoard(
  frame: C4BoardElementModel,
  board: C4ExportBoard,
  announce: boolean
): string {
  const bound = frame.elementBound;
  const inScope = (element: { elementBound: Bound }) =>
    centreInPlot(C4_BOARD_BACKGROUND, bound, element.elementBound);

  /* ── Who is on this sheet ────────────────────────────────────────── */

  const nodes = board.nodes.filter(model => isC4Node(model) && inScope(model));
  const boundaries = board.boundaries.filter(
    model => model.role === C4_ROLE.boundary && inScope(model)
  );

  /* ── Aliases ─────────────────────────────────────────────────────── */

  // Minted per DOCUMENT, so each one is self-contained: two boards may both
  // hold a "Customer", and neither is the other's. Nodes before boundaries, in
  // model order, which is what makes a collision suffix stable.
  const minter = new AliasMinter();

  const areaOf = (model: C4BoundaryElementModel) =>
    plotArea(C4_BOUNDARY_BACKGROUND, model.elementBound);

  /**
   * The smallest boundary whose plot holds this centre — the most-nested one
   * wins, which is the only reading that lets a container boundary drawn inside
   * a system boundary mean what it draws.
   *
   * `skip` is the boundary asking about ITSELF: a frame contains its own centre,
   * and a boundary is not its own parent. Equal areas are broken by document
   * order so that two boundaries drawn on top of each other cannot each claim
   * the other — the relation stays a strict order, and the walk below cannot
   * loop.
   */
  const parentOf = (target: Bound, skip: number): number => {
    let best = -1;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const [index, candidate] of boundaries.entries()) {
      if (index === skip) continue;
      const area = areaOf(candidate);
      if (skip >= 0) {
        const own = areaOf(boundaries[skip]);
        if (area < own || (area === own && index > skip)) continue;
      }
      if (
        !centreInPlot(C4_BOUNDARY_BACKGROUND, candidate.elementBound, target)
      ) {
        continue;
      }
      if (area < bestArea) {
        best = index;
        bestArea = area;
      }
    }
    return best;
  };

  // The two written tiers are elements now, so what they say is read off the
  // canvas rather than off the model. Unfiltered and in document order, because
  // a tier belongs to its node through the GROUP and not through the geometry:
  // an author who dragged a description half out of the board has still written
  // it on that component.
  const texts = board.texts ?? [];
  const groups = board.groups ?? [];

  const plannedNodes: PlannedNode[] = nodes.map(model => {
    const mapping = C4_MERMAID_OF_KIND[model.kind];
    const tiers = c4ComponentTiers(model.id, groups, texts);
    // The NAME comes off the `c4:title` tier, and off the shape's own inner text
    // only for an element drawn before the title became a child. Verbatim, with
    // no placeholder reading: an unnamed container really is a container, so
    // `Container(x, "Container")` is true where `Container(x, "?")` throws away
    // what little the author has said.
    const name = labelOf(c4StatedName(tiers, model.text)) || UNNAMED;
    return {
      model,
      mapping,
      alias: minter.mint(name),
      name,
      // The author's own technology WINS over the kind's default: `mobile` and
      // `browser` carry one because their picture means something the macro has
      // no other way to say, and a container the author has typed "Flutter" on
      // is not a "mobile app" that happens to be written in Flutter.
      techn: labelOf(c4StatedTechnology(tiers.typeLine)) || mapping.techn || '',
      descr: labelOf(c4StatedDescription(tiers.description)),
      parent: parentOf(model.elementBound, -1),
    };
  });

  const plannedBoundaries: PlannedBoundary[] = boundaries.map(
    (model, index) => {
      const name = labelOf(model.name) || UNNAMED;
      return {
        model,
        // An unstated variant reads as a SYSTEM boundary, which is the default
        // the model itself documents and the one a reader draws first.
        macro: BOUNDARY_MACRO[model.variant ?? 'system'],
        alias: minter.mint(name),
        name,
        parent: parentOf(model.elementBound, index),
      };
    }
  );

  /* ── The relationships ───────────────────────────────────────────── */

  const aliasOfModel = new Map(
    plannedNodes.map(node => [node.model.id, node.alias])
  );

  /**
   * …and so does every other part of the component it is drawn in.
   *
   * A C4 component is a group of four elements and every one of them is
   * `connectable`: a native group is, and so is a canvas text. The connector
   * tool's own search walks every connectable element whose bound holds the
   * pointer and keeps the last one, so an arrow dragged onto a component records
   * the id of the group, of the type line or of the description about as often
   * as the shape's. All four look identical on the canvas — the words are drawn
   * inside the box and the group's outline IS the box — and the difference would
   * be silently fatal here, because a `Rel` is written by alias and only the
   * shape has one: every relationship an author drew would be dropped from the
   * file with no sign that it had been.
   *
   * So each part of a component answers for its shape. Only where the group
   * holds exactly ONE C4 element, and not the first of several: a component
   * grouped together with a second component is a lasso somebody drew round two
   * boxes, and an arrow landing on it points at neither in particular. Guessing
   * there would put a sentence in the file that nobody drew, which is the one
   * thing this exporter refuses to do anywhere else.
   */
  for (const group of groups) {
    const inside = plannedNodes.filter(node =>
      group.childIds.includes(node.model.id)
    );
    if (inside.length !== 1) continue;
    const { alias } = inside[0];
    aliasOfModel.set(group.id, alias);
    for (const childId of group.childIds) {
      // Never over an element that already speaks for itself: a second C4 node
      // is excluded above, and a shape is its own answer.
      if (!aliasOfModel.has(childId)) aliasOfModel.set(childId, alias);
    }
  }

  const relations: string[] = [];
  for (const connector of board.connectors) {
    // A NEUTRAL connector states nothing (`docs/adr/0010`): not a relationship.
    if (connector.role !== C4_ROLE.relationship) continue;
    const from = connector.source?.id;
    const to = connector.target?.id;
    if (!from || !to) continue;
    const source = aliasOfModel.get(from);
    const target = aliasOfModel.get(to);
    // An end on a boundary, on a sticky note, or on an element of another
    // board: there is no alias in THIS document to point at.
    if (!source || !target) continue;
    relations.push(
      `Rel(${source}, ${target}, "${labelOf(connector.text) || UNNAMED}")`
    );
  }

  /* ── The diagram type ────────────────────────────────────────────── */

  let level: C4Level = 'context';
  for (const node of plannedNodes) {
    if (LEVEL_RANK[node.mapping.level] > LEVEL_RANK[level]) {
      level = node.mapping.level;
    }
  }

  /* ── The document ────────────────────────────────────────────────── */

  const lines: string[] = [];
  const name = labelOf(frame.name);
  // Only when there are several: a single document needs no signpost, and a
  // comment nobody asked for is a line to scroll past.
  if (announce) lines.push(`%% ── ${name || UNNAMED}`);
  lines.push(DIAGRAM_OF_LEVEL[level]);
  // `title` is a C4 statement in mermaid, not a front-matter directive, and it
  // takes the rest of the line unquoted — so the sanitizer's one-line guarantee
  // is what keeps it from swallowing the next macro. An unnamed board simply has
  // no title: an empty `title` line renders as a blank heading.
  if (name) lines.push(`  title ${name}`);

  const emit = (parent: number, indent: string) => {
    for (const node of plannedNodes) {
      if (node.parent !== parent) continue;
      const args = [node.alias, `"${node.name}"`];
      // Positional, so a later argument is NEVER emitted without the earlier
      // one: a container with a description and no technology writes an explicit
      // empty `""` to hold the slot open, which is what mermaid's grammar
      // requires and what keeps the description from being read as a technology.
      if (MACRO_TAKES_TECHN[node.mapping.macro] && (node.techn || node.descr)) {
        args.push(`"${node.techn}"`);
      }
      if (node.descr) args.push(`"${node.descr}"`);
      lines.push(`${indent}${node.mapping.macro}(${args.join(', ')})`);
    }
    for (const [index, boundary] of plannedBoundaries.entries()) {
      if (boundary.parent !== parent) continue;
      lines.push(
        `${indent}${boundary.macro}(${boundary.alias}, "${boundary.name}") {`
      );
      emit(index, `${indent}  `);
      lines.push(`${indent}}`);
    }
  };
  emit(-1, '  ');

  // Every relationship at the diagram level, after every element: mermaid
  // resolves a `Rel` by alias, and one written inside a boundary block is not
  // scoped to it anyway — putting them together is what makes the file readable.
  for (const relation of relations) lines.push(`  ${relation}`);

  return `${lines.join('\n')}\n`;
}
