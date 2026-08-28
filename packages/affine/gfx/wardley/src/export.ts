import { backgroundPlot } from '@labre/affine-block-surface';
import {
  ConnectorElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  type WardleyNodeKind,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import type {
  ForeignInterchange,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { WARDLEY_BACKGROUND } from './background.js';
import { LABEL_FONT_SIZE, LABEL_GAP } from './node/consts.js';
import { WARDLEY_ROLE } from './roles.js';

/**
 * A Wardley map as an OnlineWardleyMaps (OWM) DSL document — models in, text
 * out (`docs/adr/0012`, P3).
 *
 * This is the function ADR 0012 records as owed: the Wardley serializer that
 * exists today in **labre-mcp**, outside this repo, and is the ADR's one named
 * violation of P3. It lands here so that both consumers — the editor command
 * and the MCP tool — call one implementation, tested once, and so that the
 * reader next door (`import.ts`) has a writer it agrees with about every
 * coordinate, name and carried line.
 *
 * ## Pure, like its BPMN sibling
 *
 * Element models in, a string out. No `BlockStdScope`, no surface, no DOM, no
 * clock, no randomness. `interchange.ts` is the thin adapter that names the
 * file; `actions.ts` is the thinner one that downloads it.
 *
 * ## The plot IS the coordinate
 *
 * A Wardley node carries **no** `visibility` and **no** `evolution` prop — its
 * position on the map's plot is the whole of what the map says about it. So the
 * writer inverts the projection the reader applied: a node's centre, measured
 * against the plot of the background it sits on, is the `[visibility,
 * evolution]` pair OWM spells. Both numbers are written to exactly **two
 * decimals**, and that stability is load-bearing rather than cosmetic: the
 * fixed point `export(import(export(board)))` is byte-identical only because a
 * value that survives one rounding survives every one after it. The reader
 * tolerates any precision a foreign file happens to use.
 *
 * ## A name is a separate element, so it has to be found
 *
 * On this canvas the name of an artefact is a free text element beside it, not
 * a prop on it (`roles.ts`, `WARDLEY_ROLE.label`). The writer therefore matches
 * each label to the node it names by comparing where the label IS with where a
 * label for that node WOULD be — see {@link matchLabels}, which is the one
 * heuristic in this module and is documented as one.
 *
 * ## v1 reads one map
 *
 * An OWM document is one map. A surface holding several Wardley backgrounds is
 * serialized against the FIRST in document order, and the export warns; the
 * other maps' artefacts are written against that first plot, which is the
 * honest behaviour (nothing is dropped) and is named in the warning so nobody
 * discovers it from a file.
 */

/* ── The format's own vocabulary ──────────────────────────────────────── */

/**
 * The format id, and therefore THE KEY foreign matter rides under on an element
 * (ADR 0012, D2) — `interchange.owm`. Declared here and re-exported by
 * `import.ts`, so a reader filing a fragment and a writer looking one up cannot
 * disagree about where it went.
 */
export const WARDLEY_OWM_FORMAT_ID = 'owm';

/**
 * OWM's scope vocabulary — where a carried line came off (D2).
 *
 * The DSL is a flat list of statements with no nesting and no ids, so it needs
 * exactly two `@`-prefixed role keys and never an element id:
 *
 * - `@document` — the whole file: the lines this reader has no artefact for,
 *   and the `title` it consumed. They ride on the map's background element,
 *   which is D6's stated asymmetry (delete the map and the residue goes with
 *   it) and is where `profileId` already lives for the same reason.
 * - `@self` — the line an element WAS. Used for the verbatim tail of a mapped
 *   line, i.e. everything the writer would otherwise drop: `label [x, y]`,
 *   `(build)`, `inertia`, a trailing comment.
 */
export const OWM_SCOPE = {
  document: '@document',
  self: '@self',
} as const;

/** Where a mapped line's un-modelled tail is filed, under `attrs['@self']`. */
export const OWM_TAIL_ATTR = 'tail';

/** Where the file's own `title` is filed, under `attrs['@document']`. */
export const OWM_TITLE_ATTR = 'title';

/**
 * Keywords a line may open on, none of which can be a bare component name.
 *
 * Two different parsers care. `BaseStrategyRunner` claims a line for a keyword
 * when the TRIMMED line opens on `"<keyword> "`, and `LinksExtractionStrategy`
 * refuses to read a line as a link when it opens on any of these — so a
 * component genuinely called `style` would silently stop being linkable. The
 * writer quotes such a name rather than betting nobody ever picks one.
 */
export const OWM_KEYWORDS = new Set([
  'accelerator',
  'anchor',
  'annotation',
  'annotations',
  'build',
  'buy',
  'component',
  'deaccelerator',
  'ecosystem',
  'evolution',
  'evolve',
  'market',
  'note',
  'outsource',
  'pioneers',
  'pipeline',
  'presentation',
  'settlers',
  'size',
  'style',
  'submap',
  'title',
  'townplanners',
  'url',
]);

/** A name that needs no quoting: one word of the characters OWM reads bare. */
const BARE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/**
 * A name as the DSL spells it — bare when it can be, quoted and escaped
 * otherwise.
 *
 * The escaping mirrors OWM's own `escapeComponentNameForMapText` /
 * `unescapeComponentNameFromMapText` pair character for character, which is
 * what makes `"Vente retail thés, accessoires, coffrets"` come back with its
 * commas and its accents intact.
 */
export function owmName(raw: string): string {
  return BARE_NAME.test(raw) && !opensOnKeyword(raw) ? raw : owmQuote(raw);
}

/**
 * Whether a bare name would be mistaken for a statement of another kind.
 *
 * A PREFIX test, not an equality one, because that is what the reference reader
 * does: `LinksExtractionStrategy.canProcessLine` refuses a line whose trimmed
 * text merely BEGINS with one of these (`element.trim().indexOf(keyword) === 0`),
 * and `BaseStrategyRunner` claims one the same way. So `urlShortener->Cache` is
 * not a link there, and a component genuinely called `urlShortener` silently
 * stops being linkable unless the writer quotes it.
 */
function opensOnKeyword(raw: string): boolean {
  for (const keyword of OWM_KEYWORDS) {
    if (raw.startsWith(keyword)) return true;
  }
  return false;
}

/** A name in quotes, escaped as OWM's `escapeComponentNameForMapText` does. */
export function owmQuote(raw: string): string {
  const escaped = raw
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]');
  return `"${escaped}"`;
}

/**
 * The `X -> Y` half of an `evolve` line, with BOTH names quoted whenever
 * either needs it.
 *
 * Not cosmetic, and not symmetry for its own sake — it is the only spelling the
 * reference reader understands. `setNameWithMaturity` has two branches, and
 * only the QUOTED one (`nameSection.startsWith('"')`) ever unquotes an override:
 * the legacy branch splits on `->` and takes `parts[1].trim()` verbatim, so
 * `evolve Kettle -> "Electric kettle" 0.75` gives an evolved component whose
 * name still has the quote characters in it, and onlinewardleymaps draws them.
 * Quoting the source name is what puts the reader in the branch that strips
 * them off the target.
 */
function evolvePair(was: string, becomes: string): string {
  const quoted = `${owmName(was)} -> ${owmName(becomes)}`;
  if (!quoted.includes('"')) return quoted;
  return `${owmQuote(was)} -> ${owmQuote(becomes)}`;
}

/**
 * A coordinate, to exactly two decimals — the whole of the fixed point's
 * arithmetic.
 *
 * `-0` is written as `0.00`, because `(-0).toFixed(2)` is `"-0.00"` and a
 * node dropped one pixel above the plot's top edge would otherwise produce a
 * file whose bytes depend on which side of zero a float landed on. A
 * non-finite value (an element with no geometry) is written as `0.00` rather
 * than as `NaN`, which no parser reads.
 */
export function owmNumber(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  const fixed = value.toFixed(2);
  return fixed === '-0.00' ? '0.00' : fixed;
}

/* ── The plot, and the projection both directions share ───────────────── */

/** The plot of a map, in ABSOLUTE surface units. */
export interface OwmPlot {
  /** Surface x of evolution `0`, and y of visibility `1`. */
  x0: number;
  y0: number;
  width: number;
  height: number;
}

/** The reference map an import lays out on, and an export falls back to. */
export const OWM_DEFAULT_MAP_WIDTH = WARDLEY_BACKGROUND.geometry.width;
export const OWM_DEFAULT_MAP_HEIGHT = WARDLEY_BACKGROUND.geometry.height;

/**
 * The plot of a background element, in absolute units — the declaration's
 * margins, never a hand-written inset.
 *
 * `templates/maps.ts` learned this the hard way: a plot copied as four numbers
 * drifted from the drawn one, and a rule measuring against the declaration then
 * judged nodes laid out against the copy. Both directions of this format read
 * the same function for the same reason.
 */
export function owmPlotOf(bound: {
  x: number;
  y: number;
  w: number;
  h: number;
}): OwmPlot {
  const plot = backgroundPlot(WARDLEY_BACKGROUND, bound.w, bound.h);
  return {
    x0: bound.x + plot.x0,
    y0: bound.y + plot.y0,
    width: plot.width,
    height: plot.height,
  };
}

/** The default plot: a reference map at the origin. */
export function owmDefaultPlot(): OwmPlot {
  return owmPlotOf({
    x: 0,
    y: 0,
    w: OWM_DEFAULT_MAP_WIDTH,
    h: OWM_DEFAULT_MAP_HEIGHT,
  });
}

/**
 * `[visibility, evolution]` → a surface point.
 *
 * Mind the inversion, which is the one thing about these axes that is easy to
 * get backwards and impossible to see in a test that only round-trips: OWM's
 * visibility `1.0` is the TOP of the value chain, and a canvas' y grows
 * downwards.
 */
export function owmPointOf(
  plot: OwmPlot,
  visibility: number,
  evolution: number
): [number, number] {
  return [
    plot.x0 + evolution * plot.width,
    plot.y0 + (1 - visibility) * plot.height,
  ];
}

/** A surface point → `[visibility, evolution]`. The exact inverse. */
export function owmCoordsOf(
  plot: OwmPlot,
  x: number,
  y: number
): { visibility: number; evolution: number } {
  return {
    visibility: 1 - (y - plot.y0) / plot.height,
    evolution: (x - plot.x0) / plot.width,
  };
}

/* ── The board the writer speaks about ────────────────────────────────── */

/**
 * The artefacts the writer speaks about, picked out of a surface's elements and
 * kept in the order they were given.
 *
 * Document order matters for the same reason it does in BPMN: it decides which
 * map is THE map when a board holds several, and it is the order every section
 * of the produced file is written in — so a file exported twice from an
 * untouched board is the same file, byte for byte.
 *
 * `notes` is every text element with NO role. That is a deliberate reading and
 * not a leak: an OWM `note` IS a free text at a position, so a text somebody
 * dropped on the map is written as one. Only a text carrying the `label` role
 * is a name, and only a name is resolved onto a node.
 */
export interface WardleyExportBoard {
  maps: WardleyBackgroundElementModel[];
  nodes: WardleyNodeElementModel[];
  labels: TextElementModel[];
  notes: TextElementModel[];
  connectors: ConnectorElementModel[];
}

export function wardleyBoardFrom(
  elements: readonly GfxPrimitiveElementModel[]
): WardleyExportBoard {
  const maps: WardleyBackgroundElementModel[] = [];
  const nodes: WardleyNodeElementModel[] = [];
  const labels: TextElementModel[] = [];
  const notes: TextElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];

  for (const element of elements) {
    if (element instanceof WardleyBackgroundElementModel) maps.push(element);
    else if (element instanceof WardleyNodeElementModel) nodes.push(element);
    else if (element instanceof ConnectorElementModel) connectors.push(element);
    else if (element instanceof TextElementModel) {
      if (element.role === WARDLEY_ROLE.label) labels.push(element);
      else if (element.role === undefined) notes.push(element);
    }
  }

  return { maps, nodes, labels, notes, connectors };
}

/**
 * A name a file system will accept, minus the extension. BPMN's sanitizer,
 * verbatim in behaviour and different only in its fallback — `map`, because
 * that is what an OWM document is.
 */
export function wardleySafeFilename(raw: string | undefined): string {
  const safe = (raw ?? '')
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || 'map';
}

/* ── Matching a name to the artefact it names ─────────────────────────── */

/** How far a label may sit from where this node's label belongs, in units. */
const LABEL_MATCH_TOLERANCE = 24;

/** The label box an import writes, and the width a prediction assumes. */
export const OWM_LABEL_WIDTH = 200;
export const OWM_LABEL_HEIGHT = LABEL_FONT_SIZE + 8;

type Box = { x: number; y: number; w: number; h: number };

const boxOf = (element: {
  elementBound: { x: number; y: number; w: number; h: number };
}): Box => {
  const { x, y, w, h } = element.elementBound;
  return { x, y, w, h };
};

/**
 * Where a label for this node would be written, under each of the three
 * conventions this library actually uses.
 *
 * `actions.ts` writes a name to the RIGHT of the circle it names;
 * `templates/maps.ts` writes some to the left and some centred above; this
 * reader writes to the right, and above for a pipeline. All four are the same
 * two numbers — the node's own half-size plus {@link LABEL_GAP} — so the
 * prediction is computed from the node rather than tabulated, and a node of any
 * size (a market is 30 units across, an ecosystem 40) is predicted correctly
 * without a table to keep in step.
 */
function labelAnchors(node: Box, label: Box): [number, number][] {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const rx = node.w / 2;
  const ry = node.h / 2;
  return [
    // To the right, vertically centred — the toolbox's own gesture.
    [cx + rx + LABEL_GAP, cy - label.h / 2],
    // To the left, vertically centred.
    [cx - rx - LABEL_GAP - label.w, cy - label.h / 2],
    // Centred above.
    [cx - label.w / 2, cy - ry - LABEL_GAP - label.h],
  ];
}

/**
 * Which label names which node — the one heuristic in this module.
 *
 * A name is a separate element on this canvas, so "which node is this the name
 * of" is a question the document does not answer directly and the writer has to
 * ask of the geometry. The naive answer — nearest node to the label box — is
 * WRONG on a real map and provably so: two components 60 units apart
 * horizontally and 17 apart vertically (which is nothing on a 1530-wide plot,
 * and is exactly what the tea-shop corpus holds) put the lower one's centre
 * INSIDE the upper one's label box, so it wins by a distance of half a unit and
 * steals the name.
 *
 * What is asked instead is: how far is this label from where a label for this
 * node WOULD have been written? A wrong node's answer is a whole node spacing;
 * the right node's is the few units between one convention and another. Pairs
 * within {@link LABEL_MATCH_TOLERANCE} are then assigned greedily, closest
 * first, ties broken by document order — so the assignment is a function of the
 * document and not of the iteration order.
 *
 * A pipeline HANDLE never claims a label: it sits on the body's top edge, right
 * under the name the body owns, and would win every pipeline's name from it.
 */
function matchLabels(
  nodes: readonly WardleyNodeElementModel[],
  labels: readonly TextElementModel[]
): Map<string, string> {
  type Pair = { distance: number; node: number; label: number };
  const pairs: Pair[] = [];

  nodes.forEach((node, nodeIndex) => {
    // A handle sits on the pipeline body's top edge, directly under the name
    // the BODY owns, and would win it from the body every time. A roleless node
    // is a glyph's own wiring (a market's three inner dots) and names nothing.
    if (node.kind === 'handle' || node.role === undefined) return;
    const nodeBox = boxOf(node);
    labels.forEach((label, labelIndex) => {
      const labelBox = boxOf(label);
      const distance = Math.min(
        ...labelAnchors(nodeBox, labelBox).map(([x, y]) =>
          Math.hypot(labelBox.x - x, labelBox.y - y)
        )
      );
      if (distance <= LABEL_MATCH_TOLERANCE) {
        pairs.push({ distance, node: nodeIndex, label: labelIndex });
      }
    });
  });

  pairs.sort(
    (a, b) => a.distance - b.distance || a.node - b.node || a.label - b.label
  );

  const byNode = new Map<string, string>();
  const takenLabels = new Set<number>();
  const takenNodes = new Set<number>();
  for (const pair of pairs) {
    if (takenNodes.has(pair.node) || takenLabels.has(pair.label)) continue;
    takenNodes.add(pair.node);
    takenLabels.add(pair.label);
    byNode.set(nodes[pair.node].id, textOf(labels[pair.label]));
  }
  return byNode;
}

/** A text element's string, whether it is a `Y.Text` or a test's plain one. */
export function textOf(element: { text?: unknown }): string {
  const text = element.text;
  return text === undefined || text === null ? '' : String(text);
}

/* ── What a node is, in OWM's vocabulary ──────────────────────────────── */

/**
 * The keyword each drawn kind is written under.
 *
 * `method` is the one that is not a mapping: OWM has no `method` ELEMENT — a
 * method is the `(build)` / `(buy)` / `(outsource)` decorator on a component
 * line — so a Labre method node is written as a component and the export warns
 * that the method itself could not be said. `pipeline` and `handle` are absent
 * because a pipeline is written from its BODY, in its own section.
 */
const OWM_KEYWORD_OF_KIND: Partial<Record<WardleyNodeKind, string>> = {
  component: 'component',
  anchor: 'anchor',
  market: 'market',
  ecosystem: 'ecosystem',
  method: 'component',
};

/** What one element carried from the file it came out of, if anything. */
function carriedOf(
  element: GfxPrimitiveElementModel
): ForeignInterchange | undefined {
  return element.interchange?.[WARDLEY_OWM_FORMAT_ID];
}

/** The verbatim tail of the line this element was, or the empty string. */
function tailOf(element: GfxPrimitiveElementModel): string {
  return carriedOf(element)?.attrs?.[OWM_SCOPE.self]?.[OWM_TAIL_ATTR] ?? '';
}

/* ── The writer ───────────────────────────────────────────────────────── */

export interface WardleyOwmExportOptions {
  /** The board's own title, already sanitized by the caller. */
  name?: string;
}

/**
 * The board as an OWM document, plus what the format could not say.
 *
 * Sections in a fixed order — title, nodes, pipelines, notes, evolutions,
 * links, carried lines — and DOCUMENT order inside each. That pairing is what
 * makes the fixed point hold: the reader creates elements in the order it meets
 * them, so a file's sections come back as a document whose order re-sections
 * identically.
 */
export function exportWardleyOwmWithWarnings(
  board: WardleyExportBoard,
  options: WardleyOwmExportOptions = {}
): { text: string; warnings: string[] } {
  const warnings: string[] = [];

  const map = board.maps[0];
  if (board.maps.length > 1) {
    warnings.push(
      `This board holds ${board.maps.length} Wardley maps and an OWM file holds one. Everything was measured against the first map in the document; the others' coordinates are read against it too.`
    );
  }
  if (!map) {
    warnings.push(
      'No Wardley map background was found, so there is no plot to measure against. Coordinates were read against a default 1600 × 900 map at the origin.'
    );
  }
  const plot = map ? owmPlotOf(boxOf(map)) : owmDefaultPlot();

  const carried = map ? carriedOf(map) : undefined;
  const titleAttr = carried?.attrs?.[OWM_SCOPE.document]?.[OWM_TITLE_ATTR];
  // A name of nothing but spaces is a name the caller does not have, and this
  // is a PUBLIC entry point (P3: labre-mcp calls it directly, with whatever it
  // has). `title ` with a trailing space and no title after it is not a
  // statement any reader can do anything with — and the reference one would
  // give the map the empty string as its name.
  const named =
    options.name !== undefined && options.name.trim().length > 0
      ? options.name
      : undefined;
  // The FILE's title wins, and the caller's name is the fallback — D3's rule
  // applied to the one thing this format has an identity for besides a
  // component's name: record what we were given, never reconstruct what we
  // think we sent. It is the same precedence `interchange.<fmt>.id` already has
  // on every element, and it was the other way round until a browser recette
  // caught it: a tea-shop map imported under its own title
  // ("Tea Shop moderne 2026 …") left again as "BlockSuite Playground", because
  // the host's document name is what the command passes as `context.name` and
  // it was overriding the title the file actually carried.
  //
  // The unit suite could not see it, and that is worth saying: a fixed-point
  // test passes the SAME `name` through both halves, so the two candidates
  // agree in every round trip and the precedence between them is unobservable.
  // The assertion shape that catches it is an import whose file has a title
  // followed by an export under a DIFFERENT name.
  const title = titleAttr ?? named;
  if (titleAttr !== undefined && named !== undefined && titleAttr !== named) {
    warnings.push(
      `This map came from a file titled "${titleAttr}", and that is the title written out — not "${named}", which is what the board is called here. Rename the map inside the file if you want the exported title to change.`
    );
  }

  /* Names, resolved once and read by every section. */
  const nameByNode = matchLabels(board.nodes, board.labels);
  const unnamed: WardleyNodeElementModel[] = [];
  // MEMOIZED, and it is not an optimization: a node is asked for its name once
  // per section it appears in — its own line, and every link that ends on it —
  // and an unnamed one would otherwise be counted twice and christened twice,
  // so one artefact would leave under two names and the links would disagree
  // with the components.
  const resolved = new Map<string, string>();
  const nameOf = (node: WardleyNodeElementModel): string => {
    const already = resolved.get(node.id);
    if (already !== undefined) return already;

    const matched = nameByNode.get(node.id);
    const carriedHere = carriedOf(node);
    let name: string;
    if (matched !== undefined && matched.trim().length > 0) {
      name = matched;
    } else if (
      // A carried id is what the FILE called this thing (D3) — but only when it
      // is one. A handle this reader minted so a composite's own wiring could
      // resolve says `element`, and is not a name anybody wrote.
      carriedHere?.element === undefined &&
      carriedHere?.id !== undefined &&
      carriedHere.id.length > 0
    ) {
      name = carriedHere.id;
    } else {
      unnamed.push(node);
      name = `Component ${unnamed.length}`;
    }
    resolved.set(node.id, name);
    return name;
  };

  /* Which nodes are not components: pipeline parts, and evolved twins. */
  const twins = new Set<string>();
  for (const connector of board.connectors) {
    if (connector.role !== WARDLEY_ROLE.changeArrow) continue;
    const target = connector.target?.id;
    if (target !== undefined) twins.add(target);
  }

  const nodeById = new Map(board.nodes.map(node => [node.id, node]));
  const centreOf = (node: WardleyNodeElementModel) => {
    const box = boxOf(node);
    return owmCoordsOf(plot, box.x + box.w / 2, box.y + box.h / 2);
  };

  const offPlot: string[] = [];
  const pair = (node: WardleyNodeElementModel, name: string) => {
    const { visibility, evolution } = centreOf(node);
    if (visibility < 0 || visibility > 1 || evolution < 0 || evolution > 1) {
      offPlot.push(name);
    }
    return `[${owmNumber(visibility)}, ${owmNumber(evolution)}]`;
  };

  /* ── Sections ─────────────────────────────────────────────────────── */

  const nodeLines: string[] = [];
  const pipelineLines: string[] = [];
  const methodNodes: string[] = [];

  for (const node of board.nodes) {
    if (node.role === undefined) continue; // a glyph's own wiring, not an artefact
    if (node.kind === 'handle') continue;
    if (twins.has(node.id)) continue; // written by its `evolve` line

    const name = nameOf(node);

    if (node.kind === 'pipeline') {
      const box = boxOf(node);
      const left = owmCoordsOf(plot, box.x, box.y).evolution;
      const right = owmCoordsOf(plot, box.x + box.w, box.y).evolution;
      pipelineLines.push(
        `pipeline ${owmName(name)} [${owmNumber(left)}, ${owmNumber(right)}]${tailOf(node)}`
      );
      continue;
    }

    const keyword = OWM_KEYWORD_OF_KIND[node.kind];
    if (keyword === undefined) continue;
    if (node.kind === 'method') methodNodes.push(name);
    nodeLines.push(
      `${keyword} ${owmName(name)} ${pair(node, name)}${tailOf(node)}`
    );
  }

  const noteLines = board.notes.map(note => {
    const box = boxOf(note);
    const { visibility, evolution } = owmCoordsOf(
      plot,
      box.x + box.w / 2,
      box.y + box.h / 2
    );
    return `note ${owmName(textOf(note))} [${owmNumber(visibility)}, ${owmNumber(evolution)}]${tailOf(note)}`;
  });

  const evolveLines: string[] = [];
  const linkLines: string[] = [];
  const looseArrows: string[] = [];
  const looseLinks: string[] = [];
  const movedTwins: string[] = [];

  for (const connector of board.connectors) {
    const role = connector.role;
    if (role !== WARDLEY_ROLE.dependency && role !== WARDLEY_ROLE.changeArrow) {
      continue;
    }
    const from = connector.source?.id;
    const to = connector.target?.id;
    const source = from === undefined ? undefined : nodeById.get(from);
    const target = to === undefined ? undefined : nodeById.get(to);

    if (role === WARDLEY_ROLE.changeArrow) {
      if (!source || !target) {
        looseArrows.push(connector.id);
        continue;
      }
      const was = nameOf(source);
      const becomes = nameOf(target);
      const here = centreOf(source);
      const there = centreOf(target);
      // OWM's `evolve` moves a component along the evolution axis and says
      // nothing about the value chain, so a twin drawn at a different height is
      // a sentence the format has no way to write down.
      if (
        Math.abs(
          owmNumberValue(here.visibility) - owmNumberValue(there.visibility)
        ) > 0
      ) {
        movedTwins.push(was);
      }
      evolveLines.push(
        becomes === was
          ? `evolve ${owmName(was)} ${owmNumber(there.evolution)}${tailOf(target)}`
          : `evolve ${evolvePair(was, becomes)} ${owmNumber(there.evolution)}${tailOf(target)}`
      );
      continue;
    }

    if (!source || !target) {
      looseLinks.push(connector.id);
      continue;
    }
    // `source` is the CONSUMER and `target` is what it needs — the verb of
    // `wardley:dependency` (ADR 0010, and `reading.ts`). Never inverted here:
    // the arrow the user drew is the statement, and a writer that flipped it
    // would publish the opposite of what the board says.
    linkLines.push(`${owmName(nameOf(source))}->${owmName(nameOf(target))}`);
  }

  // NOT deduplicated. Two identical lines in a file — `// same` twice, two
  // `pioneers` blocks — are two lines the reader carried and counted as two,
  // and collapsing them here would lose one of them against a report that said
  // it was kept. D1's whole promise is that a carried line comes back; "unless
  // it looked like another one" is not a clause it has.
  const carriedLines = carried?.children?.[OWM_SCOPE.document] ?? [];

  /* ── Warnings the writer owes the person who clicked Export ───────── */

  if (unnamed.length > 0) {
    warnings.push(
      `${unnamed.length} artefact${unnamed.length === 1 ? ' has' : 's have'} no name on the map and ${unnamed.length === 1 ? 'was' : 'were'} written as "Component 1", "Component 2"… — an OWM component is identified by its name.`
    );
  }
  const duplicates = duplicateNames([...nodeLines, ...pipelineLines]);
  if (duplicates.length > 0) {
    warnings.push(
      `${duplicates.join(', ')} ${duplicates.length === 1 ? 'is the name of' : 'are the names of'} more than one artefact. OWM identifies a component by its name, so every link naming one of these means the first.`
    );
  }
  if (offPlot.length > 0) {
    warnings.push(
      `${offPlot.length} artefact${offPlot.length === 1 ? '' : 's'} sit outside the map's plot, so their coordinates fall outside 0…1 and other tools will draw them off the map: ${offPlot.slice(0, 5).join(', ')}${offPlot.length > 5 ? '…' : ''}.`
    );
  }
  if (methodNodes.length > 0) {
    warnings.push(
      `${methodNodes.length} component${methodNodes.length === 1 ? ' carries' : 's carry'} a method (build / buy / outsource). OWM writes a method as a decorator this export cannot tell apart, so ${methodNodes.length === 1 ? 'it was' : 'they were'} written as plain components.`
    );
  }
  if (looseLinks.length > 0) {
    warnings.push(
      `${looseLinks.length} link${looseLinks.length === 1 ? ' has an end' : 's have ends'} that is loose or attached to something that is not a Wardley artefact. A link names two components, so ${looseLinks.length === 1 ? 'it was' : 'they were'} left out.`
    );
  }
  if (looseArrows.length > 0) {
    // Two losses, not one, and the second is the one nobody would guess: the
    // node an evolution arrow points AT is written by the `evolve` line rather
    // than as a component of its own, so when the arrow cannot be written the
    // twin has no line either and leaves the file altogether.
    warnings.push(
      `${looseArrows.length} evolution arrow${looseArrows.length === 1 ? ' has an end' : 's have ends'} that is loose or attached to something that is not a Wardley artefact, so ${looseArrows.length === 1 ? 'it was' : 'they were'} left out — and so ${looseArrows.length === 1 ? 'was the evolved component it points at, which is written by its `evolve` line and has no line of its own' : 'were the evolved components they point at, which are written by their `evolve` lines and have no lines of their own'}.`
    );
  }
  if (movedTwins.length > 0) {
    warnings.push(
      `${movedTwins.length} evolution arrow${movedTwins.length === 1 ? '' : 's'} ends at a different height on the value chain (${movedTwins.slice(0, 5).join(', ')}). OWM's \`evolve\` moves a component along the evolution axis only, so the change of visibility was not written.`
    );
  }

  /* ── The document ─────────────────────────────────────────────────── */

  const sections = [
    title === undefined ? [] : [`title ${title}`],
    nodeLines,
    pipelineLines,
    noteLines,
    evolveLines,
    linkLines,
    carriedLines,
  ].filter(section => section.length > 0);

  const text = sections.map(section => section.join('\n')).join('\n\n') + '\n';
  return { text, warnings };
}

/** The value a coordinate is WRITTEN as, so a comparison agrees with the file. */
function owmNumberValue(value: number): number {
  return Number(owmNumber(value));
}

/** The names two artefacts share, in first-seen order. */
function duplicateNames(lines: readonly string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const line of lines) {
    // `<keyword> <name> [` — the name is everything between the two.
    const match = /^\S+\s+(.*?)\s+\[/.exec(line);
    if (!match) continue;
    const name = match[1];
    if (seen.has(name)) twice.add(name);
    seen.add(name);
  }
  return [...twice];
}

/**
 * The board as an OWM document — models in, text out, and nothing else.
 *
 * The signature P3 names: exported from this package's index so that labre-mcp
 * calls THIS function rather than keeping the copy ADR 0012 records as the one
 * violation of it.
 */
export function exportWardleyOwm(
  board: WardleyExportBoard,
  options: WardleyOwmExportOptions = {}
): string {
  return exportWardleyOwmWithWarnings(board, options).text;
}
