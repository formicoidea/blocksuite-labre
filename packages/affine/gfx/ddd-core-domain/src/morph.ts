import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  CD_SUBDOMAINS,
  dddShapeProps,
  dotShapeOpts,
  markerShapeOpts,
  type ShapeOpts,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import {
  GroupElementModel,
  ShapeElementModel,
  TextElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { coreDomainCommandIcons, coreDomainCommands } from './commands.js';
import {
  type CdMarkerKind,
  type CdSubdomainKind,
  CORE_DOMAIN_ROLE,
  markerRole,
  subdomainRole,
} from './roles.js';

/**
 * What a Core Domain artefact may BECOME — the declaration behind the "Change
 * type" dropdown on a selected dot's or marker's contextual toolbar.
 *
 * ## Two families, and nothing between them
 *
 * A big bet and a platform sub-domain are the same artefact said differently:
 * both are a dot plotted at a (differentiation, complexity) position, and
 * realising halfway through a chart that this one is really a platform is
 * modelling rather than a mistake. The two bounded contexts are in that family
 * too — `roles.ts` already parents all five on `core-domain:subdomain`, because
 * a bounded context is placed and read exactly like the other three and what
 * makes it a `bc-current` is only that a movement may start from it.
 *
 * The three Team Topologies markers are the second family and the two never
 * meet. That is the same disjunction `roles.ts` draws: a marker is an
 * ANNOTATION about how work flows between teams, a sub-domain is a thing
 * plotted on the chart, and no rule written on one may ever fall on the other.
 * Turning a dot into a square would move an artefact from the picture to the
 * commentary about it, which is not "the same thing, said more precisely". The
 * generic module refuses a mixed selection on its own (the two kinds are in no
 * common family), so this stays a statement of data rather than a check.
 *
 * The chart background and the movement edge are in NO family: the chart is the
 * frame of reference the others are measured against, and the movement is an
 * edge whose morph would be a different gesture entirely (`docs/adr/0010`).
 */
export const CORE_DOMAIN_MORPH_FAMILIES: readonly (readonly CdMorphKind[])[] = [
  // Derived from the shared preset tables rather than restated, so declaration
  // order is MENU order and the menu reads in the order the senior sub-menu
  // offers them — a sixth dot preset arrives in the dropdown with no edit here.
  CD_SUBDOMAINS.map(preset => preset.kind),
  TEAM_TOPOLOGIES.map(preset => preset.kind),
];

/** Everything that morphs in this framework: the five dots and the three markers. */
export type CdMorphKind = CdSubdomainKind | CdMarkerKind;

/** A kind's own role — the id the patch writes and the telemetry reports. */
function roleOf(kind: CdMorphKind): string {
  return CORE_DOMAIN_ROLE[kind];
}

/**
 * Role → kind, the inverse of {@link CORE_DOMAIN_ROLE} restricted to the eight
 * morphable kinds.
 *
 * The kind of a Core Domain artefact has nowhere else to live: a dot is a
 * native `shape` and a marker is a native `shape`, so unlike a `bpmnNode` or a
 * `c4Node` there is no `kind` field to read — the role IS the kind, which is the
 * arrangement `commands.ts` has stamped since the roles landed.
 *
 * An element carrying no role is therefore an element with no kind, and it is
 * REFUSED rather than guessed at. A chart drawn before the vocabulary existed
 * carries role-less dots, and the promise `roles.ts` makes about them is that
 * nothing infers anything from their colour: no backfill, ever (#71). Such a dot
 * opens, paints and round-trips exactly as it always did; it just is not offered
 * a menu that would have to invent what it is first.
 *
 * Null prototype, like the vocabulary itself: this is a lookup keyed by strings
 * read off a document, so `KIND_OF_ROLE['toString']` must not resolve.
 */
const KIND_OF_ROLE: Record<string, CdMorphKind | undefined> = Object.assign(
  Object.create(null),
  Object.fromEntries(
    CORE_DOMAIN_MORPH_FAMILIES.flat().map(kind => [roleOf(kind), kind])
  )
);

/** Whether a kind is one of the three markers — the family with a glyph. */
function isMarkerKind(kind: CdMorphKind): kind is CdMarkerKind {
  return kind in MARKER_LETTER;
}

/* ── The patch one kind is worth ───────────────────────────────────────── */

/**
 * The box {@link coreDomainMorphProps} hands the shared builder and then throws
 * away. Never written to a document: a morph keeps the geometry the element
 * already has, and this exists only because the one builder takes a box.
 */
const DISCARDED_BOX = [0, 0, 0, 0] as const;

/** What a morph must never rewrite: identity, geometry, and the user's words. */
const NOT_A_MORPH = ['type', 'xywh', 'text'] as const;

/**
 * What each kind IS, as shape options — the very objects `addDot` and
 * `addMarker` build their artefact from ({@link dotShapeOpts},
 * {@link markerShapeOpts}).
 */
const SHAPE_OPTS: Record<CdMorphKind, ShapeOpts> = Object.assign(
  Object.create(null) as Record<CdMorphKind, ShapeOpts>,
  Object.fromEntries([
    ...CD_SUBDOMAINS.map(preset => [
      preset.kind,
      dotShapeOpts(preset.fill, subdomainRole(preset.kind)),
    ]),
    ...TEAM_TOPOLOGIES.map(preset => [
      preset.kind,
      markerShapeOpts(preset.fill, markerRole(preset.kind)),
    ]),
  ])
);

/**
 * What a kind is worth to a shape that ALREADY EXISTS — the creation preset
 * minus the three things a morph has no business touching.
 *
 * ## Why the whole preset, and not `{role, fillColor}`
 *
 * Because it is insurance, and it is free. Every member of a family shares its
 * stroke, its stroke width, its silhouette and — inside the markers — its corner
 * radius today, so all but `role` and `fillColor` are inert on this table. That
 * is exactly the state BPMN's families were in before `subProcess` /
 * `callActivity` gained a border weight that mattered: a family is DATA and
 * grows by declaration, with no code change to prompt anyone to check the
 * presets. Derived from the creation builder, the palette and the morph cannot
 * drift apart whatever is added, and a morphed dot is byte-for-byte a dot
 * freshly placed from the sub-menu.
 */
export function coreDomainMorphProps(
  kind: CdMorphKind
): Record<string, unknown> {
  const props: Record<string, unknown> = dddShapeProps(
    ...DISCARDED_BOX,
    SHAPE_OPTS[kind]
  );
  for (const key of NOT_A_MORPH) delete props[key];
  return props;
}

/**
 * Every key ANY kind's props may carry — the union over both families.
 *
 * Computed rather than listed, so a preset that starts spreading a key
 * conditionally is covered on the day it is added rather than on the day
 * somebody notices.
 */
const EVERY_MORPH_KEY = new Set(
  CORE_DOMAIN_MORPH_FAMILIES.flat().flatMap(kind =>
    Object.keys(coreDomainMorphProps(kind))
  )
);

/**
 * The fields to DELETE after morphing to `kind` — the keys some other kind
 * writes and this one does not.
 *
 * EMPTY for every kind today: `dddShapeProps` writes one fixed key set whatever
 * the options say, and the label branch it does spread conditionally is never
 * taken here (a dot's caption is a sibling text element, not the shape's own
 * words). Derived rather than hard-coded to `[]` for the reason C4's equivalent
 * is: a patch cannot express absence, and the day one preset stops writing a key
 * the previous kind's value would otherwise stay in the Y.Map, silently in
 * force.
 */
export function coreDomainMorphClears(kind: CdMorphKind): readonly string[] {
  const present = new Set(Object.keys(coreDomainMorphProps(kind)));
  return [...EVERY_MORPH_KEY].filter(key => !present.has(key));
}

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * The dot or the marker square a selected GROUP is built round — `undefined`
 * when the group is not one of ours.
 *
 * Both artefacts are composites: a dot is `group[ellipse, caption]` and a marker
 * is `group[square, letter, caption]`, so what a click selects is the group and
 * what carries the role is the shape inside it. This is the whole of the
 * indirection and it is also the gate: a plain group somebody lassoed round
 * three rectangles, a C4 component, a legend box and a group of two dots all
 * answer `undefined`, so none of them is ever offered the menu.
 *
 * TWO artefacts is a refusal rather than a first-wins pick, for the reason
 * `c4NodeOfComponent` gives: morphing "it" would mean choosing one of them by
 * document order, and the honest answer to an ambiguous selection is nothing.
 */
export function coreDomainArtefactOf(
  model: GfxPrimitiveElementModel
): ShapeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: ShapeElementModel | undefined;
  for (const child of model.childElements) {
    if (!(child instanceof ShapeElementModel)) continue;
    if (kindOfArtefact(child) === undefined) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/** The kind a shape carries, read off its role. */
function kindOfArtefact(
  model: GfxPrimitiveElementModel
): CdMorphKind | undefined {
  if (!(model instanceof ShapeElementModel)) return undefined;
  return model.role ? KIND_OF_ROLE[model.role] : undefined;
}

/* ── The words the composite owes the change ───────────────────────────── */

/** A kind's creation caption, both families in one table. */
const KIND_LABEL: Record<CdMorphKind, string> = Object.fromEntries([
  ...CD_SUBDOMAINS.map(preset => [preset.kind, preset.label]),
  ...TEAM_TOPOLOGIES.map(preset => [preset.kind, preset.label]),
]) as Record<CdMorphKind, string>;

/** The glyph each marker wears — C, X, F. */
const MARKER_LETTER: Record<CdMarkerKind, string> = Object.fromEntries(
  TEAM_TOPOLOGIES.map(preset => [preset.kind, preset.letter])
) as Record<CdMarkerKind, string>;

/**
 * The caption an artefact should carry once it has morphed — or `null` when the
 * words are the AUTHOR's and must not be touched.
 *
 * The C4 title rule, applied to the one caption these artefacts have: exactly
 * one case rewrites, the caption being the source kind's own creation prompt
 * letter for letter, which is what a dot nobody has named still says. Everything
 * else — a name typed over it, the prompt with a word added, another kind's
 * prompt, a cleared caption — is content, and content survives a morph
 * untouched.
 *
 * It is the tier a user sees go wrong: every one of the eight kinds prompts with
 * a different word, so a fresh "Big-bet sub-domain" morphed to a platform would
 * otherwise be a blue dot captioned "Big-bet sub-domain" — a picture flatly
 * contradicting its own name.
 *
 * Pure and total over every string, like `c4MorphedTitle`: the input is a canvas
 * text element somebody may have typed anything into.
 */
export function coreDomainMorphedCaption(
  from: CdMorphKind,
  to: CdMorphKind,
  rawText: string | null | undefined
): string | null {
  return (rawText ?? '').trim() === KIND_LABEL[from] ? KIND_LABEL[to] : null;
}

/**
 * The two texts of a composite, told apart by WHERE they sit.
 *
 * The letter is centred ON the square and the caption stands beside the
 * artefact, which is the notation's own arrangement rather than a detail of the
 * builder: geometry survives a restyle, a re-word and a font change, where
 * `textAlign`, a font size or "the text is one character long" would each stop
 * being true the moment a user edits the thing they describe. A dot has no glyph
 * at all and simply answers `undefined` for it.
 *
 * Either half is taken only when it is the ONE candidate. A group somebody has
 * added a second caption to is a group where "the caption" is a guess, and this
 * would rather leave both alone than rewrite the wrong one.
 */
function wordsOf(group: GroupElementModel, artefact: ShapeElementModel) {
  const texts = group.childElements.filter(
    (child): child is TextElementModel => child instanceof TextElementModel
  );
  const on = (text: TextElementModel) => {
    const cx = text.x + text.w / 2;
    const cy = text.y + text.h / 2;
    return (
      cx >= artefact.x &&
      cx <= artefact.x + artefact.w &&
      cy >= artefact.y &&
      cy <= artefact.y + artefact.h
    );
  };
  const only = (found: TextElementModel[]) =>
    found.length === 1 ? found[0] : undefined;
  return {
    glyph: only(texts.filter(on)),
    caption: only(texts.filter(text => !on(text))),
  };
}

/**
 * Write one text, in place, if the decision says to.
 *
 * `rewriteTier`'s contract, and its reasons: the comparison is against the
 * TRIMMED text — the same string `decide` was given — so padding is never
 * rewritten away for nothing, and the `Y.Text` instance is mutated rather than
 * replaced because it is what any bound editor holds. Inside the caller's
 * `captureSync`, so it is part of the same single ctrl+z as the role that made
 * it necessary.
 */
function rewriteText(
  text: TextElementModel | undefined,
  decide: (current: string) => string | null
) {
  if (!text || text.isLocked()) return;

  const current = text.text.toString().trim();
  const next = decide(current);
  if (next === null || next === current) return;

  text.surface.store.transact(() => {
    text.text.delete(0, text.text.length);
    text.text.insert(0, next);
  });
}

/**
 * Keep the artefact's own words saying what it now is — the `afterMorph` half of
 * the spec.
 *
 * Two texts and two DIFFERENT rules, because they are two different kinds of
 * thing:
 *
 * - **The caption** is content, or a prompt standing in for content. Timid:
 *   placeholder→placeholder and nothing else ({@link coreDomainMorphedCaption}).
 *   A dot somebody called "Billing" is called that whatever it becomes.
 * - **The letter** is NOTATION. C, X and F are not words anybody wrote, they are
 *   Team Topologies' own glyphs for the three interaction modes, and a square
 *   that has become an X-as-a-Service while still showing a C is not "a label
 *   the author owns" — it is the picture lying about itself. So it is rewritten
 *   ALWAYS, whatever it currently says, which is the only rule that also
 *   repairs a glyph a previous edit left wrong.
 */
function rewriteWords(
  model: GfxPrimitiveElementModel,
  from: CdMorphKind,
  to: CdMorphKind
) {
  if (!(model instanceof GroupElementModel)) return;
  const artefact = coreDomainArtefactOf(model);
  if (!artefact) return;

  const { glyph, caption } = wordsOf(model, artefact);
  rewriteText(caption, text => coreDomainMorphedCaption(from, to, text));
  if (isMarkerKind(to)) rewriteText(glyph, () => MARKER_LETTER[to]);
}

/* ── The menu's own wording ────────────────────────────────────────────── */

/**
 * The creation command that places each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`subdomain:platform`, `team-topology:xaas`) and is documented as a
 * historical value that must not be renamed. Deriving rather than restating is
 * what stops a second table of labels and icons drifting from the one the
 * sub-menu and the catalogue read.
 */
const ARTEFACT_PREFIXES = ['subdomain:', 'team-topology:'] as const;

const ARTEFACT_COMMANDS = new Map(
  coreDomainCommands.flatMap(command => {
    const element = command.telemetry?.element ?? '';
    const prefix = ARTEFACT_PREFIXES.find(candidate =>
      element.startsWith(candidate)
    );
    return prefix ? [[element.slice(prefix.length), command] as const] : [];
  })
);

/** A kind's wording: the creation command's own key and English. */
function labelOf(kind: CdMorphKind): MorphLabel {
  const command = ARTEFACT_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? KIND_LABEL[kind],
  };
}

/** A kind's icon: the creation command's own swatch, reused rather than redrawn. */
function iconOf(kind: CdMorphKind): TemplateResult {
  const iconKey = ARTEFACT_COMMANDS.get(kind)?.iconKey;
  return (
    (iconKey && coreDomainCommandIcons[iconKey]) ||
    coreDomainCommandIcons['ddd-core-domain.chart']
  );
}

/**
 * The Core Domain morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `modelType` is the native `GroupElementModel` and not `ShapeElementModel`,
 * because both artefacts are composites and the group is what a click on one
 * selects. Everything that makes that safe is in {@link coreDomainArtefactOf}:
 * the toolbar's own homogeneity test only proves that every selected element is
 * A group, and the resolution proves that every one of them is one of ours.
 *
 * Every shipped creation path builds the group — `commands.ts` always passes a
 * caption, so `addDot`'s bare-ellipse branch is unreachable from the palette,
 * the templates and the agent alike. A dot that somehow arrives ungrouped is
 * simply not offered the menu, which is the same refusal a role-less dot gets
 * and for the same reason: nothing is inferred, nothing is repaired behind the
 * user's back.
 */
export const CORE_DOMAIN_MORPH_SPEC: MorphSpec<CdMorphKind> = {
  framework: 'ddd-core-domain',
  families: CORE_DOMAIN_MORPH_FAMILIES,
  modelType: GroupElementModel,
  resolveTarget: coreDomainArtefactOf,
  kindOf: kindOfArtefact,
  roleOf,
  propsOf: coreDomainMorphProps,
  clearOf: coreDomainMorphClears,
  afterMorph: rewriteWords,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
