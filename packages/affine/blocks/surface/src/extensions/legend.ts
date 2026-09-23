import {
  ConnectorMode,
  FontWeight,
  PointStyle,
  ShapeStyle,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  BOARD_LEGEND_TITLE,
  GROUP_SEED_NAME,
  translateKey,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import {
  CATALOGUE_CATEGORY_KEY_PREFIX,
  getRegisteredCommands,
  humanizeCategory,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandLegendBox,
  type CommandLegendEntry,
  type CommandLegendExtra,
  type CommandLegendRow,
  type CommandOwner,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  roleIsA,
  RoleVocabularyIdentifier,
  type GfxController,
  type GfxPrimitiveElementModel,
  type RoleDefs,
  type RoleId,
} from '@labre/std/gfx';

import { EdgelessCRUDIdentifier } from './crud-extension.js';

/**
 * The legend PLATFORM: one engine, one box, for every framework that documents
 * itself.
 *
 * Two things it deliberately does not do, and they are the whole design:
 *
 * - **detection is by ROLE, never by `instanceof` or by fill colour.** A role is
 *   the semantic identity of an artefact (`framework/std`'s `role.ts`); a shape
 *   type is not, and a colour is a restyle away from lying. Reading roles also
 *   means a legend and a validation rule agree on what is on the board, because
 *   they read the same field;
 * - **a framework writes no legend code.** {@link legendFromCommands} derives
 *   the whole thing from the commands it already declares — their order, their
 *   category, the role each stamps and the swatch each subscribes
 *   (`CommandDescriptor.legend`). Scanning the perimeter, resolving
 *   specialisations, dropping empty sections, placing and grouping the box all
 *   happen here, once.
 *
 * It lives in the surface block rather than with any framework bundle for the
 * reason `validation.ts` next door does: BPMN and Wardley must not take a
 * dependency on a DDD bundle to draw their own legend.
 *
 * See `docs/adr/0026`.
 */

type Surface = NonNullable<GfxController['surface']>;

/* ── The box, drawn ────────────────────────────────────────────────────── */

/** A {@link CommandLegendRow} with the label the engine resolved for it. */
export interface LegendRow extends CommandLegendRow {
  label: string;
}

export interface LegendSection {
  title?: string;
  rows: LegendRow[];
}

/** How the box is laid out, for a legend whose swatches are not 16-unit chips. */
export interface LegendLayout {
  width?: number;
  /** Row pitch; the swatch is drawn centred in it. Defaults to 28. */
  rowHeight?: number;
  /** Swatch box, defaults to a 16 × 16 chip. */
  swatchWidth?: number;
  swatchHeight?: number;
}

/** A block of the box that is not a row. See {@link CommandLegendBox.extras}. */
export type LegendExtra = CommandLegendExtra;

/**
 * The ink and the type a notation writes its labels in: this box's rows, and
 * the words the DDD prefabs set beside a dot or a marker.
 *
 * Declared HERE and re-exported by `@labre/affine-gfx-ddd-shared`, rather than
 * the other way round, because that bundle depends on this one and a legend
 * must not depend on a DDD bundle to be drawn.
 */
export const LABEL_COLOR = NOTATION_NEUTRALS.ink;
export const LABEL_FONT = 'blocksuite:surface:Inter';
export const LABEL_FONT_SIZE = 14;

const NO_STROKE = '#00000000';

/**
 * The box's geometry, in one place because two callers need it: the one that
 * DRAWS the box and the one that has to know how tall it will be before drawing
 * it (see {@link measureLegend}).
 */
const LEGEND_METRICS = {
  DEFAULT_W: 260,
  PAD: 16,
  TITLE_H: 32,
  SUB_H: 26,
  ROW_H: 28,
  /** Swatch side (a `line` swatch is this long). */
  SW: 16,
} as const;

/**
 * The minimal shape write this module needs — deliberately NOT the DDD
 * `dddShapeProps`, and deliberately without a `role` parameter.
 *
 * That absence is the invariant: a legend is drawn ON the board it describes
 * and the scan detects by role, so a glyph carrying one would list itself the
 * next time a legend was generated and would be counted by every validation
 * rule. Here it is not a rule to remember but a parameter that does not exist.
 */
function addShape(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    shapeType?: 'rect' | 'ellipse' | 'diamond';
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    radius?: number;
  }
): string {
  const {
    shapeType = 'rect',
    fill,
    stroke = NO_STROKE,
    strokeWidth = 0,
    radius = 0,
  } = opts;
  return surface.addElement({
    type: 'shape',
    shapeType,
    filled: true,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius,
    xywh: new Bound(x, y, w, h).serialize(),
  });
}

/** A left-aligned (or centred) line of text. No `role`, same reason as above. */
function addText(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  text: string,
  fontSize: number,
  textAlign: 'left' | 'center' = 'center',
  bold = false
): string {
  return surface.addElement({
    type: 'text',
    text,
    color: LABEL_COLOR,
    fontFamily: LABEL_FONT,
    fontSize,
    textAlign,
    fontWeight: bold ? FontWeight.SemiBold : FontWeight.Regular,
    xywh: new Bound(x, y, w, fontSize + 10).serialize(),
  });
}

/**
 * A swatch the FRAMEWORK described: its props, plus the geometry the layout
 * decides — and MINUS any `role`, stripped here so the invariant holds
 * structurally whatever a table says.
 *
 * Cast in one place because the props arrive as data — a table in a framework
 * module, not a literal this file can type — and the surface's own factory is
 * what validates them.
 */
function addSwatchElement(
  surface: Surface,
  props: Record<string, unknown>
): string {
  const { role: _role, ...neutral } = props;
  return surface.addElement(
    neutral as Parameters<Surface['addElement']>[0] & { type: string }
  );
}

/**
 * The role the legend's GROUP carries — the one thing on a generated legend
 * that says what it is.
 *
 * Its glyphs deliberately carry none (see {@link addShape}), which is what
 * keeps a legend out of the scan and out of every validation rule. But "made of
 * nothing in particular" is unreadable to anything that has to tell a legend
 * from a drawing, and something does: the `.bpmn` export counts what it left
 * behind inside a pool, and a legend's fourteen glyphs would be reported as
 * fourteen losses. The wrapper says so instead, once, structurally — no title
 * to match on, no framework name, no geometry.
 *
 * `core:` because it belongs to no framework: no `RoleDefs` declares it, so
 * `roleIsA` matches it against nothing, no rule evaluates it and no legend row
 * lights because of it. Nothing is backfilled, as ever — a legend drawn before
 * this shipped carries no role and is not recognised.
 */
export const LEGEND_ROLE = 'core:legend';

/**
 * Group the box's elements under one titled group, without
 * `@labre/affine-gfx-group`'s `createGroupCommand`: that package depends on
 * THIS one, so importing it would close a cycle. The twelve lines below are
 * that command's whole body, run against the same `EdgelessCRUDIdentifier` it
 * uses, so a legend group is what the gesture says a group is — plus the one
 * thing a plain group is not, {@link LEGEND_ROLE}.
 */
function groupLegendElements(std: BlockStdScope, ids: string[]): string {
  const gfx = std.get(GfxControllerIdentifier);
  const crud = std.get(EdgelessCRUDIdentifier);
  const groups = gfx.layer.canvasElements.filter(el => el.type === 'group');
  const groupId = crud.addElement('group', {
    children: Object.fromEntries(ids.map(id => [id, true])),
    // Translated HERE and once: the title is document content the moment it
    // lands (ADR 0023), so the host's catalogue is asked at placement and never
    // again — a renamed group keeps its name.
    title: translateKey(std, ...GROUP_SEED_NAME, { n: groups.length + 1 }),
    role: LEGEND_ROLE,
  });
  return groupId || ids[0];
}

/**
 * How big the box {@link addLegend} would draw for these sections is — without
 * drawing it. The engine needs the height to drop the box bottom-left of a
 * board, and measuring is the only honest way to get it: the box grows with the
 * number of sub-titles, rows and extras, which is exactly what the detection
 * pass decides.
 */
export function measureLegend(
  sections: readonly LegendSection[],
  layout: LegendLayout = {},
  extras: readonly LegendExtra[] = []
): { width: number; height: number } {
  const { DEFAULT_W, PAD, TITLE_H, SUB_H, ROW_H } = LEGEND_METRICS;
  let subs = 0;
  let rows = 0;
  for (const s of sections) {
    if (s.title) subs++;
    rows += s.rows.length;
  }
  return {
    width: layout.width ?? DEFAULT_W,
    height:
      PAD * 2 +
      TITLE_H +
      subs * SUB_H +
      rows * (layout.rowHeight ?? ROW_H) +
      extras.reduce((sum, extra) => sum + extra.height, 0),
  };
}

/**
 * A boxed legend: a bordered container with a bold title and bold section
 * sub-titles, each row a swatch + label, then whatever `extras` add below.
 * Returns the grouped id.
 */
export function addLegend(
  surface: Surface,
  std: BlockStdScope,
  x: number,
  y: number,
  opts: {
    title: string;
    sections: LegendSection[];
    extras?: readonly LegendExtra[];
  } & LegendLayout
): string {
  const { PAD, TITLE_H, SUB_H, SW } = LEGEND_METRICS;
  const ROW_H = opts.rowHeight ?? LEGEND_METRICS.ROW_H;
  /** The swatch COLUMN: as wide as the widest sample any row may draw. */
  const SWW = opts.swatchWidth ?? SW;
  const SWH = opts.swatchHeight ?? SW;
  const extras = opts.extras ?? [];
  const { width: W, height: H } = measureLegend(opts.sections, opts, extras);

  const ids: string[] = [
    addShape(surface, x, y, W, H, {
      fill: NOTATION_NEUTRALS.cardFill,
      stroke: NOTATION_NEUTRALS.legendBorder,
      strokeWidth: 1.5,
      radius: 8,
    }),
  ];
  let cy = y + PAD;
  ids.push(
    addText(surface, x + PAD, cy, W - PAD * 2, opts.title, 18, 'left', true)
  );
  cy += TITLE_H;
  for (const sec of opts.sections) {
    if (sec.title) {
      ids.push(
        addText(surface, x + PAD, cy, W - PAD * 2, sec.title, 14, 'left', true)
      );
      cy += SUB_H;
    }
    for (const row of sec.rows) {
      const sx = x + PAD;
      const midY = cy + ROW_H / 2;
      if (row.swatch === 'dot') {
        ids.push(
          addShape(surface, sx, midY - SW / 2, SW, SW, {
            shapeType: 'ellipse',
            fill: row.color,
            stroke: NOTATION_NEUTRALS.ink,
            strokeWidth: 1,
          })
        );
      } else if (row.swatch === 'square') {
        ids.push(
          addShape(surface, sx, midY - SW / 2, SW, SW, {
            fill: row.color,
            stroke: NOTATION_NEUTRALS.ink,
            strokeWidth: 1,
            radius: 3,
          })
        );
        if (row.letter)
          ids.push(addText(surface, sx, midY - 8, SW, row.letter, 11));
      } else if (row.swatch === 'glyph') {
        // The artefact itself, at swatch size. `size` wins when the framework
        // declares one — a gradation of sizes IS notation for Wardley, and
        // fitting every pastille to the same box would erase it; otherwise the
        // artefact's own aspect is fitted inside the box and centred, so a
        // portrait picture stays portrait.
        const aspect = row.aspect && row.aspect > 0 ? row.aspect : 1;
        const [gw, gh] = row.size ?? [
          Math.min(SWW, SWH * aspect),
          Math.min(SWW, SWH * aspect) / aspect,
        ];
        ids.push(
          addSwatchElement(surface, {
            ...row.props,
            xywh: new Bound(
              sx + (SWW - gw) / 2,
              midY - gh / 2,
              gw,
              gh
            ).serialize(),
          })
        );
      } else if (row.swatch === 'edge') {
        // A real connector across the swatch column, so the endpoint the
        // notation puts on the line — a hollow diamond, a hollow triangle, a
        // stick head — is drawn by the connector renderer rather than guessed at.
        ids.push(
          addSwatchElement(surface, {
            mode: ConnectorMode.Straight,
            stroke: row.color,
            strokeWidth: 1.5,
            frontEndpointStyle: PointStyle.None,
            rearEndpointStyle: PointStyle.None,
            ...row.props,
            type: 'connector',
            source: { position: [sx, midY] },
            target: { position: [sx + SWW, midY] },
          })
        );
      } else if (row.swatch === 'custom' && row.draw) {
        // A composite the framework draws itself, in the box we hand it. The
        // ids come back so the whole thing joins the group like any other row.
        ids.push(
          ...row.draw(
            surface,
            { x: sx, y: midY - SWH / 2, w: SWW, h: SWH },
            std
          )
        );
      } else if (row.dashed) {
        // Two 6-unit segments with a 4-unit gap: the same 16 units as a solid
        // bar, read as a dash.
        const seg = 6;
        ids.push(
          addShape(surface, sx, midY - 2, seg, 4, {
            fill: row.color,
            radius: 1,
          })
        );
        ids.push(
          addShape(surface, sx + SW - seg, midY - 2, seg, 4, {
            fill: row.color,
            radius: 1,
          })
        );
      } else {
        ids.push(
          addShape(surface, sx, midY - 2, SW, 4, { fill: row.color, radius: 1 })
        );
      }
      ids.push(
        addText(
          surface,
          sx + SWW + 10,
          midY - LABEL_FONT_SIZE / 2,
          W - PAD * 2 - SWW - 10,
          row.label,
          13,
          'left'
        )
      );
      cy += ROW_H;
    }
  }
  for (const extra of extras) {
    ids.push(...extra.draw(surface, std, x, cy, W));
    cy += extra.height;
  }
  return groupLegendElements(std, ids);
}

/* ── The scan ──────────────────────────────────────────────────────────── */

/**
 * Distance from the board's left edge / bottom edge, in model units. Wardley's
 * numbers, kept identical so every legend lands in the same place relative to
 * its board.
 */
const INSET_X = 50;
const INSET_BOTTOM = 56;

/**
 * Every role carried by an element inside `bound`.
 *
 * Neutral elements (no role) contribute nothing, which is the whole
 * compatibility promise: a board drawn before the vocabularies existed produces
 * an empty set and therefore a legend with no rows, exactly like an empty board.
 * It is also why a legend never lists itself: nothing it draws carries a role.
 */
export function rolesInBound(gfx: GfxController, bound: Bound): Set<RoleId> {
  return rolesOf(gfx.getElementsByBound(bound, { type: 'canvas' }));
}

/** {@link rolesInBound} over a perimeter already scanned. */
function rolesOf(elements: readonly GfxPrimitiveElementModel[]): Set<RoleId> {
  const present = new Set<RoleId>();
  for (const el of elements) {
    if (el.role !== undefined) present.add(el.role);
  }
  return present;
}

/**
 * The legends ALREADY drawn on this board — what turns the button's second
 * press into "regenerate" rather than a second stacked box (issue #391).
 *
 * The scan already sees them: a generated legend's wrapper carries
 * {@link LEGEND_ROLE}, so recognising one costs a filter over the elements the
 * perimeter pass returned, and nothing in the document format changes.
 *
 * CONTAINMENT rather than intersection, which is what `getElementsByBound`
 * answers with: two boards drawn edge to edge each overlap the other's corner,
 * and the press on one would eat the other's box. A legend is inset well inside
 * the board it documents, so asking for the whole box costs nothing here and
 * keeps the neighbour's.
 *
 * Two boxes it deliberately does not find: one the author dragged off the board
 * (it is no longer this board's legend, and a fresh one is drawn), and one
 * generated before {@link LEGEND_ROLE} shipped in 0.42 — that box carries no
 * role, so the old stacking survives on those documents. Nothing is backfilled,
 * as ever (ADR 0026).
 */
function legendsOn(
  elements: readonly GfxPrimitiveElementModel[],
  bound: Bound
): GfxPrimitiveElementModel[] {
  return elements.filter(
    el =>
      el.type === 'group' &&
      el.role === LEGEND_ROLE &&
      bound.contains(el.elementBound)
  );
}

/** Every registered vocabulary, merged — a role id is namespaced, so it is flat. */
function vocabularyOf(std: BlockStdScope): RoleDefs {
  const merged: RoleDefs = {};
  for (const defs of std.provider.getAll(RoleVocabularyIdentifier).values()) {
    Object.assign(merged, defs);
  }
  return merged;
}

/* ── The derivation: a framework's commands ARE its legend ─────────────── */

/** Section keys are resolved once; this is the bucket while they are collected. */
interface SectionDraft {
  key: string;
  title?: string;
  rows: LegendRow[];
}

function entriesOf(
  command: AnyCommandDescriptor
): readonly CommandLegendEntry[] {
  const { legend } = command;
  if (!legend) return [];
  return Array.isArray(legend) ? legend : [legend as CommandLegendEntry];
}

/**
 * One row's label, through the host's catalogue, in the order of who owns the
 * word:
 *
 * 1. the entry's own {@link CommandLegendEntry.labelWording} — a row that
 *    EXPLAINS the notation rather than naming it (Wardley's "Need / capability
 *    (activity, practice, data…)" against the role's bare "Component");
 * 2. the ROLE's wording, which is the usual case and the reason a table never
 *    restates a label: renaming a role renames its legend row;
 * 3. the COMMAND's wording, for a row whose role declares none.
 *
 * `labelPrefix` (the Context Map's "PS — ") is stitched back on AFTER
 * translation: an abbreviation is never a translatable word.
 */
function resolveRowLabel(
  std: BlockStdScope,
  roles: RoleDefs,
  command: AnyCommandDescriptor,
  entry: CommandLegendEntry
): string {
  const def = roles[entry.role];
  const text = entry.labelWording
    ? translateKey(std, ...entry.labelWording)
    : def?.labelKey
      ? translateKey(std, def.labelKey, def.labelFallback ?? entry.role)
      : (def?.labelFallback ??
        translateKey(
          std,
          command.labelKey,
          command.labelFallback ?? command.id
        ));
  return entry.labelPrefix ? `${entry.labelPrefix} — ${text}` : text;
}

/**
 * The sub-title a row files itself under: its own {@link
 * CommandLegendEntry.section} when it declares one, otherwise the command's
 * `category` through the catalogue's own header key — the same word the
 * artefact panel puts above the same group of commands, and therefore no new
 * i18n key.
 *
 * A row with neither goes into an untitled bucket, which is what a framework
 * with one flat notation wants.
 */
function resolveSection(
  std: BlockStdScope,
  command: AnyCommandDescriptor,
  entry: CommandLegendEntry
): { key: string; title?: string } {
  if (entry.section) {
    return {
      key: entry.section[0],
      title: translateKey(std, ...entry.section),
    };
  }
  const category = command.category;
  if (!category) return { key: '' };
  return {
    key: `${CATALOGUE_CATEGORY_KEY_PREFIX}${category}`,
    title: translateKey(
      std,
      `${CATALOGUE_CATEGORY_KEY_PREFIX}${category}`,
      humanizeCategory(category)
    ),
  };
}

/**
 * The legend of a board, derived from the commands of the framework that owns
 * it: every subscribed row whose role is present (directly or through a
 * specialisation, unless the entry asks for {@link CommandLegendEntry.exact}),
 * in command order, grouped under the section each declares — or under its
 * command's category — with empty sections dropped.
 *
 * The SUB-TITLES come out in the order the framework first declares them,
 * walking every command whether its row lights or not: a legend is a key to a
 * notation, so the same framework reads in the same order on every board, and
 * only the rows change.
 *
 * Rows are de-duplicated BY ROLE, first declaration winning: two commands draw
 * a Wardley area (a rectangle and a polygon) and the notation has one "Area".
 *
 * When nothing is recognised the result is an EMPTY array, and the caller still
 * draws the box: a legend of a board with nothing on it lists nothing, rather
 * than inventing the full notation the user has not used.
 */
export function legendFromCommands(
  std: BlockStdScope,
  owner: CommandOwner,
  present: ReadonlySet<RoleId>
): LegendSection[] {
  const roles = vocabularyOf(std);
  const commands = getRegisteredCommands(std)
    .filter(command => command.owner === owner && command.legend)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const drafts: SectionDraft[] = [];
  const seen = new Set<RoleId>();
  const presentRoles = [...present];

  for (const command of commands) {
    for (const entry of entriesOf(command)) {
      // The bucket is opened for EVERY declared row, lit or not, and emptied
      // ones are dropped at the end. That is what makes the order of the
      // sub-titles a property of the framework's declarations rather than of
      // what happens to be on this board: opening it only when a row lit put
      // BPMN's "Activities" after "Gateways" and "Flows" on a pool that had a
      // user task but no plain task, and the same pool with a plain task read
      // in a different order again.
      const { key, title } = resolveSection(std, command, entry);
      let draft = drafts.find(d => d.key === key);
      if (!draft) drafts.push((draft = { key, title, rows: [] }));

      const lit = entry.exact
        ? present.has(entry.role)
        : presentRoles.some(role => roleIsA(role, entry.role, roles));
      if (!lit || seen.has(entry.role)) continue;
      seen.add(entry.role);

      draft.rows.push({
        ...entry.row,
        label: resolveRowLabel(std, roles, command, entry),
      });
    }
  }

  return drafts
    .filter(draft => draft.rows.length > 0)
    .map(({ title, rows }) => ({ title, rows }));
}

/** The `legendBox` of the framework's BOARD command, if it declares one. */
function boardLegendBox(
  std: BlockStdScope,
  owner: CommandOwner
): CommandLegendBox | undefined {
  return getRegisteredCommands(std).find(
    command => command.owner === owner && command.legendBox
  )?.legendBox;
}

/**
 * Build the legend of what is drawn inside `board` and drop it bottom-left of
 * it, grouped and selected. THE gesture the shared toolbar button runs.
 *
 * REPLACES the board's own legend if it already has one, rather than stacking a
 * second box on the first (issue #391): the placement is derived from the board
 * alone, so every press landed at the same pixel and the copies were invisible
 * — one box to the eye, N groups and N × ~15 elements in the document. The
 * second press is therefore a REFRESH, which is what a user who has just added
 * three artefacts is asking for; the cost is that hand retouching of the box is
 * lost, and one undo brings it back (see {@link legendsOn} and ADR 0026).
 *
 * Returns the group id, or `undefined` when there is no surface to draw on.
 */
export function createBoardLegend(
  std: BlockStdScope,
  board: { xywh: string },
  owner: CommandOwner
): string | undefined {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  // The button already refuses on a readonly document; said again here because
  // this gesture now DELETES before it draws, and a refused delete followed by
  // a throwing draw is the one order that could lose a box.
  if (!surface || std.store.readonly) return undefined;

  const bound = Bound.deserialize(board.xywh);
  const inside = gfx.getElementsByBound(bound, { type: 'canvas' });
  const previous = legendsOn(inside, bound);
  // The box about to be drawn describes the DRAWING, never the box it replaces:
  // the outgoing wrapper is dropped from the scan so `core:legend` is not among
  // the roles the rows are derived from. Its glyphs carry no role at all.
  const outgoing = new Set<GfxPrimitiveElementModel>(previous);
  const present = rolesOf(inside.filter(el => !outgoing.has(el)));
  const sections = legendFromCommands(std, owner, present);
  const box = boardLegendBox(std, owner);
  const layout: LegendLayout = {
    width: box?.width,
    rowHeight: box?.rowHeight,
    swatchWidth: box?.swatchWidth,
    swatchHeight: box?.swatchHeight,
  };
  // Resolved ONCE, in front of the drawing: an extra states its height as a
  // value, so the box can be measured before it is placed.
  const extras = box?.extras?.({ std, board, present }) ?? [];
  const title = translateKey(std, ...(box?.titleWording ?? BOARD_LEGEND_TITLE));
  const { height } = measureLegend(sections, layout, extras);

  // ONE checkpoint, in front of BOTH halves of the replacement: a single
  // Ctrl+Z after a regenerate puts the previous box back whole, rather than
  // leaving the board with no legend at all.
  std.store.captureSync();
  if (previous.length > 0) {
    const crud = std.get(EdgelessCRUDIdentifier);
    // Cascades into the group's children (`crud-extension.ts`), so one call
    // per legend takes the whole box away.
    for (const legend of previous) crud.removeElement(legend.id);
  }
  const id = addLegend(
    surface,
    std,
    bound.x + INSET_X,
    bound.y + bound.h - INSET_BOTTOM - height,
    { title, sections, extras, ...layout }
  );
  gfx.selection.set({ elements: [id], editing: false });
  return id;
}
