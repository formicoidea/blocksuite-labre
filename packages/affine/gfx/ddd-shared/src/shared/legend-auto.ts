import { translateKey } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type RoleDefs,
  type RoleId,
  roleIsA,
} from '@labre/std/gfx';

import {
  addLegend,
  type LegendRow,
  type LegendSection,
  measureLegend,
} from './prefabs';

/**
 * The AUTOMATIC legend, shared by the three DDD backgrounds.
 *
 * Wardley's `createWardleyLegend` is the gesture this replicates — select the
 * background, press one button, get a legend of what is actually drawn on it,
 * dropped bottom-left and grouped so it can be moved and edited like anything
 * else. Two things are deliberately NOT replicated:
 *
 * - **detection is by ROLE, never by `instanceof` or by fill colour.** A role is
 *   the semantic identity of an artefact (`framework/std`'s `role.ts`); a shape
 *   type is not, and a colour is a restyle away from lying. Reading roles also
 *   means a legend and a validation rule agree on what is on the board, because
 *   they read the same field;
 * - **the glyphs are the DDD house prefab** ({@link addLegend}), not hand-drawn
 *   element-by-element replicas of the artefacts. The three DDD frameworks
 *   already document themselves with swatch rows, and a second visual language
 *   for the same job would be one too many.
 *
 * A framework contributes nothing but a TABLE: which role puts which row in the
 * legend. Everything else — scanning the perimeter, resolving specialisations,
 * dropping empty sections, placing and grouping the box — happens here once.
 */

/**
 * One candidate row: `row` is listed only when `role` — or a role that
 * specialises it — is carried by an element inside the background's perimeter.
 */
export interface AutoLegendEntry {
  role: RoleId;
  row: LegendRow;
  /**
   * Match `role` and `role` ALONE, without the specialisation walk.
   *
   * The default — an entry lights up for any of its children — is what a legend
   * usually wants: one "Relation" row covers the twenty-two verbs, one
   * "Sub-domain" row would cover the five kinds. It is also what a validation
   * rule wants, and for the same reason: a statement about a family is a
   * statement about every member of it.
   *
   * A legend sometimes wants the opposite, because it documents what is DRAWN
   * rather than what is meant. EDGY's four base kinds are the case: Content
   * specialises Object, so an entry on `edgy:object` would put an "Object" row
   * on a board where nobody ever dropped a bare Object — the row would name a
   * white square that is nowhere on the diagram. `exact` makes the base and its
   * specialisations two separate statements, so each is listed when, and only
   * when, it is the thing the user actually put down.
   *
   * Reach for it when a row's swatch would be a lie on a board carrying only
   * children — a distinct colour, a distinct shape, a distinct wording. Leave it
   * off when the parent row is a fair summary of the whole family.
   */
  exact?: boolean;
  /**
   * Static prefix kept literal in front of the role's resolved wording — the
   * Context Map relationship abbreviation ("PS — Partnership"). Absent for
   * every other row, whose label IS the role's own wording and nothing else.
   */
  labelPrefix?: string;
}

export interface AutoLegendSectionSpec {
  /** Sub-title, dropped along with the section when none of its rows appear. */
  title?: string;
  /**
   * i18n key for {@link title}, resolved through the host's catalogue at
   * legend-build time when present. Absent for the sections whose title is
   * generic chrome rather than a framework's own word (`'Legend'`, `'Flow'`…),
   * which this lot leaves as they are.
   */
  titleKey?: string;
  entries: readonly AutoLegendEntry[];
}

export interface AutoLegendSpec {
  /**
   * Box title. Every framework with an automatic legend says "Legend" (PO
   * recette, 26/08/2026: the boxes used to be titled in French, which was the
   * one label in the library that was — identifiers and fallback wordings are
   * English here, and the day a host ships a locale pack it translates a key,
   * not a leftover).
   */
  title: string;
  /**
   * i18n key for {@link title}, resolved through the host's catalogue at
   * legend-build time — the same mechanism as
   * {@link AutoLegendSectionSpec.titleKey}, one level up. Every framework that
   * says "Legend" reuses `BOARD_LEGEND_TITLE`
   * (`@labre/affine-shared/services`), since it is the SAME word on every
   * board that has one — the three DDD boards, EDGY and C4 alike.
   */
  titleKey?: string;
  width?: number;
  /**
   * The framework's role vocabulary, so a present role is matched against an
   * entry's role THROUGH the specialisation chain: an entry written on a parent
   * role lists itself as soon as any of its children is on the board — unless
   * it asks for {@link AutoLegendEntry.exact}, which is the whole of the
   * exception.
   */
  roles: RoleDefs;
  sections: readonly AutoLegendSectionSpec[];
}

/**
 * The framework's OWN wording for a role, from the vocabulary that declares it.
 *
 * A legend row about `es:flow` says "Flow" because that is what the role def
 * says it is called — the table below never restates a label the vocabulary
 * already owns, so renaming a role renames its legend row.
 *
 * This is the FALLBACK half only — the English wording a spec bakes in at
 * declaration time, with no `std` in scope to ask a host's catalogue. The
 * catalogue is asked afterwards, once, when the legend is actually drawn: see
 * {@link autoLegendSections}.
 */
export function roleLabel(roles: RoleDefs, id: RoleId): string {
  return roles[id]?.labelFallback ?? id;
}

/**
 * Resolve one row's label through the host's catalogue, at legend-BUILD time
 * — the one point in this module that has a `std` to ask.
 *
 * A row's `label` is baked at spec-declaration time (module scope, no `std`)
 * as the exact English text a catalogue-less playground must keep showing —
 * see {@link roleLabel}. Here, if the row's own role carries a `labelKey`, that
 * baked text becomes the FALLBACK argument of `translateKey` rather than the
 * final word: a host with a catalogue entry for the key overrides it, and a
 * host with none gets back the identical string, letter for letter.
 *
 * `labelPrefix` rows (the Context Map relationship abbreviations, "PS —
 * Partnership") are the one case where the row's baked text is not what gets
 * handed to the catalogue: the role's own `labelFallback` is (the abbreviation
 * itself is never a translatable word), and the prefix is stitched back on
 * after translation.
 */
function resolveRowLabel(
  std: BlockStdScope,
  roles: RoleDefs,
  entry: AutoLegendEntry
): string {
  const def = roles[entry.role];
  if (!def?.labelKey) return entry.row.label;
  if (entry.labelPrefix) {
    const translated = translateKey(
      std,
      def.labelKey,
      def.labelFallback ?? entry.role
    );
    return `${entry.labelPrefix} — ${translated}`;
  }
  return translateKey(std, def.labelKey, entry.row.label);
}

/**
 * Resolve one section's title through the host's catalogue — see
 * {@link resolveRowLabel}. Absent {@link AutoLegendSectionSpec.titleKey} keeps
 * the section's title exactly as declared, unresolved: most section titles are
 * generic chrome ("Legend", "Flow") this lot leaves untranslated.
 */
function resolveSectionTitle(
  std: BlockStdScope,
  section: AutoLegendSectionSpec
): string | undefined {
  return section.titleKey && section.title !== undefined
    ? translateKey(std, section.titleKey, section.title)
    : section.title;
}

/**
 * Distance from the background's left edge / bottom edge, in model units.
 * Wardley's numbers, kept identical so the two gestures put the box in the same
 * place relative to their backgrounds.
 */
const INSET_X = 50;
const INSET_BOTTOM = 56;

/**
 * Every role carried by an element inside `bound`.
 *
 * Neutral elements (no role) contribute nothing, which is the whole
 * compatibility promise: a board drawn before the vocabularies existed produces
 * an empty set and therefore a legend with no rows, exactly like an empty board.
 */
export function rolesInBound(gfx: GfxController, bound: Bound): Set<RoleId> {
  const present = new Set<RoleId>();
  for (const el of gfx.getElementsByBound(bound, { type: 'canvas' })) {
    if (el.role !== undefined) present.add(el.role);
  }
  return present;
}

/**
 * The sections to draw for a given set of present roles: every entry whose role
 * is present (directly or through a specialisation, unless the entry asks for
 * {@link AutoLegendEntry.exact}), in declaration order, with empty sections —
 * sub-title included — dropped.
 *
 * When nothing is recognised the result is an EMPTY array, and the caller still
 * draws the box: that is Wardley's behaviour (an empty map yields a framed
 * "Legend" title and no rows), and it is the honest one — a legend of a board
 * with nothing on it lists nothing, rather than inventing the full notation the
 * user has not used.
 *
 * `std` resolves each surviving row's label — and each section's title, where
 * one carries a {@link AutoLegendSectionSpec.titleKey} — through the host's
 * catalogue (see {@link resolveRowLabel}); a spec whose entries carry no
 * `labelKey` at all renders byte-identical to what it always has.
 */
export function autoLegendSections(
  present: ReadonlySet<RoleId>,
  spec: AutoLegendSpec,
  std: BlockStdScope
): LegendSection[] {
  const sections: LegendSection[] = [];
  for (const section of spec.sections) {
    const rows = section.entries
      .filter(entry =>
        entry.exact
          ? present.has(entry.role)
          : [...present].some(role => roleIsA(role, entry.role, spec.roles))
      )
      .map(entry => ({
        ...entry.row,
        label: resolveRowLabel(std, spec.roles, entry),
      }));
    if (rows.length)
      sections.push({ title: resolveSectionTitle(std, section), rows });
  }
  return sections;
}

/**
 * Build the legend of what is drawn inside `background` and drop it bottom-left
 * of it, grouped and selected.
 *
 * Returns the group id, or `undefined` when there is no surface to draw on.
 */
export function createAutoLegend(
  std: BlockStdScope,
  background: { xywh: string },
  spec: AutoLegendSpec
): string | undefined {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return undefined;

  const bound = Bound.deserialize(background.xywh);
  const sections = autoLegendSections(rolesInBound(gfx, bound), spec, std);
  const title = spec.titleKey
    ? translateKey(std, spec.titleKey, spec.title)
    : spec.title;
  const { height } = measureLegend(sections, spec.width);

  std.store.captureSync();
  const id = addLegend(
    surface,
    std,
    bound.x + INSET_X,
    bound.y + bound.h - INSET_BOTTOM - height,
    { title, sections, width: spec.width }
  );
  gfx.selection.set({ elements: [id], editing: false });
  return id;
}
