import {
  type PivotSnapshot,
  queryPivotProperties,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';
import type { Bound } from '@labre/global/gfx';
import { LifeCycleWatcher, type BlockStdScope, type FrameworkId } from '@labre/std';
import type { RoleDefs, RoleId, SurfaceBlockModel } from '@labre/std/gfx';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
  isPivotBound,
  readElementTags,
  roleIsA,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { effect, signal } from '@preact/signals-core';

// Straight at the two leaf modules rather than at the barrel, for the reason
// `validation.ts` states: `index.js` also re-exports the RENDERER, and a
// reading is a one-way read of pure declaration data that must never pull a
// canvas in.
import { backgroundPlot, type FrameworkBackgroundDef } from '../framework-background/def.js';
import { backgroundTransitionBands } from '../framework-background/facts.js';

/**
 * **The reversed reading** (MF3): what the tool can say about a component the
 * user has drawn, as a PROPOSAL — never as a write.
 *
 * The five readings are all functions of data that is already in the document
 * and already declared by a framework: the `role` vocabulary (PF1), the level-3
 * tags (ADR 0007), the typed edges (ADR 0010), and the framework background's
 * own zones and bands (PF5.15/16). Nothing here derives a value the user did not
 * state — the whole point of the PO's arbitration of 01/08/2026 is that a
 * reading is an OFFER:
 *
 * > the reversed reading is triggered on a click (never by automatic
 * > validation) and writes nothing without confirmation.
 *
 * So this module is pure on the way in ({@link readElement} takes elements and a
 * declaration, and returns a value object) and empty-handed on the way out: the
 * only writes in the whole feature are the two EXISTING commands a user may
 * choose to invoke from the panel — `tag.set` and `pivot.bind`.
 *
 * ## What is generic and what is declared
 *
 * Nothing in this file names Wardley, a nature, a phase or a dependency. A
 * framework declares a {@link ReadingProfile} — the same shape of contract as a
 * `ValidationRule`: data, comparable, reviewable, registered from the
 * FLAG-GATED view extension, because reading a map is tooling and a board whose
 * framework is switched off must simply stop being read (ADR 0009).
 */

/**
 * How a name is expected to read, for ONE value of the nature tag.
 *
 * A convention is a MOTIF, not a grammar: one case-insensitive regular
 * expression the name is expected to match, plus the sentence that says why.
 * Deliberately small — the library has no business shipping a linguist, and a
 * naming rule that a user cannot predict is worse than none.
 *
 * It is never blocking and never a violation: a reading says "this name does
 * not read like an activity", offers the wording, and stops there.
 */
export interface ReadingNamingConvention {
  /** The nature value id this convention describes, e.g. `wardley:nature/data`. */
  valueId: string;
  /**
   * `RegExp` SOURCE (not a literal), matched case-insensitively against the
   * element's name. A source string rather than a `RegExp` object so a profile
   * stays plain, serialisable data like every other declaration in this repo.
   */
  pattern: string;
  /** i18n key of the suggestion shown when the name does not match. */
  hintKey: string;
  /** English default, for a host that ships no catalogue. */
  hintFallback: string;
}

/**
 * One framework's reading contract. Every section is optional: a framework that
 * declares only `appliesTo` gets the node-type line and nothing else, which is
 * exactly what a framework with no tags, no typed edges and no background
 * should get.
 */
export interface ReadingProfile {
  /** Stable id; one profile per framework today. */
  id: string;
  framework: FrameworkId;
  /** The framework's role vocabulary — hierarchy is resolved against it. */
  roles: RoleDefs;
  /**
   * The subject role. An element carrying it, or a specialisation of it, can be
   * read; anything else has no reading and the panel does not stand up.
   */
  appliesTo: RoleId;
  /**
   * The role of the element that NAMES the subject, when the name is a separate
   * element grouped with it — which is what a Wardley component is (a circle
   * and a free text). Absent, only the subject's own text is read.
   */
  labelRole?: RoleId;
  /** The type-3 tag carrying the subject's nature, and its naming conventions. */
  nature?: {
    tagId: string;
    conventions: readonly ReadingNamingConvention[];
  };
  /** The typed edge whose two ends the relation reading walks. */
  relation?: {
    edgeRole: RoleId;
  };
  /** The frame the phase is read from. */
  frame?: {
    backgroundRole: RoleId;
    /** The declaration itself, carried as data exactly like `roles` is. */
    background: FrameworkBackgroundDef;
    /** Which plot axis the zones are laid along. */
    axis: 'x' | 'y';
  };
  /**
   * Which properties of the PIVOT RECORD the reading may compare itself
   * against — the host's own keys, because the library does not name a
   * property of somebody else's document.
   *
   * Absent, or absent from the host's `hoverFields`, means no comparison is
   * possible: the panel shows the local reading and the drift trigger stays
   * silent. Silence, never a guess.
   */
  recordKeys?: {
    nature?: string;
    phase?: string;
  };
}

/** Where the other end of a typed edge sits, relative to the subject. */
export type ReadingRelationSide = 'consumer' | 'supplier';

/** One typed edge touching the subject, read with the ADR 0010 convention. */
export interface ReadingRelation {
  /** The edge element. */
  edgeId: string;
  /** The element at the other end. */
  otherId: string;
  /** Its name, when it has one — for the panel, which must not print ids. */
  otherName: string;
  /**
   * What the OTHER element is to the subject. ADR 0010 § 2 tier 2: on a
   * `wardley:dependency`, `source` is the consumer and `target` is what it
   * needs. So an edge leaving the subject names a SUPPLIER, and an edge
   * arriving at it names a CONSUMER.
   */
  side: ReadingRelationSide;
  /**
   * The declaration and the drawing disagree.
   *
   * A consumer is drawn ABOVE what it needs — the visibility axis IS the
   * statement of dependency order (ADR 0010 § 5). When the persisted direction
   * says one thing and the two positions say the other, the reading says so
   * rather than picking a winner: that is W4 seen from the record's side, and
   * the user is the one who decides which of the two was the mistake.
   */
  contradictsGeometry: boolean;
}

/** Where the subject sits along the frame's phase axis. */
export interface ReadingPhase {
  /** The declared zone id, e.g. `product`. */
  zoneId: string;
  labelKey?: string;
  labelFallback?: string;
  /**
   * The subject sits in the band around a zone transition — Wardley's zone of
   * punctuated equilibrium, declared by the background as
   * `transitionBandWidth`.
   */
  inTransitionBand: boolean;
  /** Which frontier, `custom-built|product`. Present only inside a band. */
  bandId?: string;
}

/** Whether the subject's name reads the way its nature says it should. */
export interface ReadingNaming {
  name: string;
  conforms: boolean;
  hintKey: string;
  hintFallback: string;
}

/** The subject's semantic identity: its role, and the roles it specialises. */
export interface ReadingNodeType {
  roleId: RoleId;
  labelKey?: string;
  /** The `parent` chain, nearest first. Empty for a root role. */
  specialises: RoleId[];
}

/**
 * One element, as the tool reads it. A value object: no element references, no
 * signals, nothing to dispose — and nothing that has been written anywhere.
 */
export interface ElementReading {
  elementId: string;
  nodeType: ReadingNodeType;
  /**
   * The type-3 values the element CARRIES. `undefined` when it carries none —
   * and that is the whole of the reading: no nature is derived from the shape,
   * from the name or from the position. An empty proposal is the honest one.
   */
  nature: { tagId: string; valueIds: string[] } | undefined;
  relations: readonly ReadingRelation[];
  /** `undefined` off any frame: a component on a blank canvas has no phase. */
  phase: ReadingPhase | undefined;
  /** `undefined` with no nature, no convention for it, or no name to judge. */
  naming: ReadingNaming | undefined;
}

/** Deepest role chain reported by {@link ReadingNodeType.specialises}. */
const MAX_ROLE_DEPTH = 32;

/** Numeric slack on the two geometry comparisons. Model units. */
const GEOMETRY_EPSILON = 1e-6;

/** Complain once per malformed declaration: a reading can be asked for often. */
const warned = new Set<string>();

function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[reading] ${reason}`);
}

/**
 * Compiled convention patterns, keyed by source. A profile is a module-level
 * constant, so this cache holds one entry per declared convention for the life
 * of the process — and a broken pattern is compiled (and complained about)
 * once rather than on every render of the panel.
 */
const patterns = new Map<string, RegExp | null>();

function compile(pattern: string): RegExp | null {
  const cached = patterns.get(pattern);
  if (cached !== undefined) return cached;

  let compiled: RegExp | null = null;
  try {
    compiled = new RegExp(pattern, 'iu');
  } catch (error) {
    warnOnce(
      `naming convention /${pattern}/ does not compile (${String(error)}) — ` +
        `the naming line is dropped rather than reported as a mismatch.`
    );
  }
  patterns.set(pattern, compiled);
  return compiled;
}

/** The text an element carries itself, `''` when it carries none. */
function ownText(element: GfxPrimitiveElementModel): string {
  const text: unknown = (element as { text?: unknown }).text;
  if (typeof text === 'string') return text.trim();
  if (text && typeof (text as { toString?: unknown }).toString === 'function') {
    return String(text).trim();
  }
  return '';
}

/**
 * The members of the group holding this element, or `null` when it is not
 * grouped — or when asking cannot be done safely.
 *
 * `group` is a getter that walks the element's SURFACE, so on an element that
 * is not attached to one it throws. A reading must never throw: a panel that
 * crashes on an odd element is worse than one that has nothing to say about its
 * name, and the caller's fallback (no name, therefore no naming line) is the
 * same silence every other unreadable field produces.
 */
function groupMembers(
  element: GfxPrimitiveElementModel
): GfxPrimitiveElementModel[] | null {
  let group: unknown;
  try {
    group = (element as { group?: unknown }).group;
  } catch {
    return null;
  }
  const children = (group as { childElements?: unknown } | null)?.childElements;
  return Array.isArray(children)
    ? (children as GfxPrimitiveElementModel[])
    : null;
}

/**
 * The subject's NAME.
 *
 * Its own text first, then — because a framework artefact on this canvas is a
 * composite — the text of the sibling carrying the profile's label role. That
 * is the same fact `tags-toolbar.ts` works around from the other direction: one
 * click selects the group, the role lives on the circle, and the name lives on
 * a free text beside it.
 */
function readName(
  element: GfxPrimitiveElementModel,
  profile: ReadingProfile
): string {
  const own = ownText(element);
  if (own) return own;

  const labelRole = profile.labelRole;
  if (!labelRole) return '';

  const children = groupMembers(element);
  if (children === null) return '';

  for (const child of children) {
    if (!(child instanceof GfxPrimitiveElementModel)) continue;
    if (child.id === element.id) continue;
    if (!roleIsA(child.role, labelRole, profile.roles)) continue;
    const text = ownText(child);
    if (text) return text;
  }
  return '';
}

/** The role chain above `roleId`, nearest first, bounded like `roleIsA` is. */
function specialisationChain(roleId: RoleId, roles: RoleDefs): RoleId[] {
  const chain: RoleId[] = [];
  let current = roles[roleId]?.parent;
  for (let hops = 0; current !== undefined && hops < MAX_ROLE_DEPTH; hops++) {
    chain.push(current);
    current = roles[current]?.parent;
  }
  return chain;
}

/** Centre of a bound. Reading a position is reading where the thing IS. */
const centreOf = (bound: Bound): [number, number] => [
  bound.x + bound.w / 2,
  bound.y + bound.h / 2,
];

/**
 * The frame the subject sits ON — containment of its CENTRE, and nothing else.
 *
 * Deliberately not the "nearest map" attribution the validation engine uses: a
 * finding has to be filed against some map even when the subject is off in the
 * margin, whereas a phase read off a map the component is not on would be an
 * invented fact. A component beside the map has no phase, and the panel says
 * nothing rather than something plausible.
 *
 * The centre, not the whole bound: a node overhanging the edge of the map is
 * still on it to every reader.
 */
function frameOf(
  element: GfxPrimitiveElementModel,
  elements: readonly GfxPrimitiveElementModel[],
  profile: ReadingProfile
): GfxPrimitiveElementModel | null {
  const frame = profile.frame;
  if (!frame) return null;

  const [cx, cy] = centreOf(element.elementBound);
  for (const candidate of elements) {
    if (candidate.id === element.id) continue;
    if (candidate.role === undefined) continue;
    if (!roleIsA(candidate.role, frame.backgroundRole, profile.roles)) continue;
    const bound = candidate.elementBound;
    if (
      cx >= bound.x &&
      cx <= bound.x + bound.w &&
      cy >= bound.y &&
      cy <= bound.y + bound.h
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * The phase, read from the position and the frame's DECLARED zones.
 *
 * Two facts, both taken from the declaration and never from a number in this
 * file: which zone the subject's centre falls in, and whether it is inside the
 * band around a transition. The second is the "zone of punctuated equilibrium"
 * — the frontier is a region, not a coordinate — and a component sitting in one
 * is a different statement from a component sitting in a phase.
 */
function readPhase(
  element: GfxPrimitiveElementModel,
  elements: readonly GfxPrimitiveElementModel[],
  profile: ReadingProfile
): ReadingPhase | undefined {
  const frame = profile.frame;
  if (!frame) return undefined;

  const background = frameOf(element, elements, profile);
  if (!background) return undefined;

  const def = frame.background;
  const bound = background.elementBound;
  const plot = backgroundPlot(def, bound.w, bound.h);
  const [cx, cy] = centreOf(element.elementBound);

  const along = frame.axis === 'x' ? cx : cy;
  const origin = frame.axis === 'x' ? bound.x + plot.x0 : bound.y + plot.y0;
  const span = frame.axis === 'x' ? plot.width : plot.height;
  if (!(span > 0)) return undefined;

  const ratio = (along - origin) / span;
  // Inside the card but outside the PLOT — on the margin the axes are drawn in.
  // No zone covers it, and inventing the nearest one would put a component in a
  // phase it is visibly not in.
  if (ratio < 0 || ratio > 1) return undefined;

  const zone = (def.zones ?? []).find(({ rect }) => {
    const start = frame.axis === 'x' ? rect.x : rect.y;
    const size = frame.axis === 'x' ? rect.w : rect.h;
    // Half-open, so a component exactly on a divider reads as the phase it is
    // entering — the same side the band below reports as the frontier.
    return ratio >= start && (ratio < start + size || start + size >= 1);
  });
  if (!zone) return undefined;

  const bands = backgroundTransitionBands(def, bound)[frame.axis];
  const band = bands.find(({ min, max }) => along >= min && along <= max);

  return {
    zoneId: zone.id,
    ...(zone.label?.labelKey !== undefined
      ? { labelKey: zone.label.labelKey }
      : {}),
    ...(zone.label?.fallback !== undefined
      ? { labelFallback: zone.label.fallback }
      : {}),
    inTransitionBand: band !== undefined,
    ...(band !== undefined ? { bandId: band.id } : {}),
  };
}

/** The two ends of a connector, when both are bound to an element. */
function endpointsOf(
  element: GfxPrimitiveElementModel
): { source: string; target: string } | null {
  const source = (element as { source?: { id?: unknown } }).source;
  const target = (element as { target?: { id?: unknown } }).target;
  if (typeof source?.id !== 'string' || typeof target?.id !== 'string') {
    return null;
  }
  if (!source.id || !target.id) return null;
  return { source: source.id, target: target.id };
}

/**
 * Every typed edge touching the subject, read as a relation.
 *
 * An edge with an unbound end is skipped, exactly as ADR 0010 requires of W4:
 * releasing the link tool over empty canvas produces one, and a stroke that
 * links nothing states nothing.
 */
function readRelations(
  element: GfxPrimitiveElementModel,
  elements: readonly GfxPrimitiveElementModel[],
  profile: ReadingProfile
): ReadingRelation[] {
  const relation = profile.relation;
  if (!relation) return [];

  const byId = new Map(elements.map(el => [el.id, el]));
  const [, subjectY] = centreOf(element.elementBound);
  const relations: ReadingRelation[] = [];

  for (const edge of elements) {
    if (edge.role === undefined) continue;
    if (!roleIsA(edge.role, relation.edgeRole, profile.roles)) continue;

    const ends = endpointsOf(edge);
    if (!ends) continue;

    const isSource = ends.source === element.id;
    const isTarget = ends.target === element.id;
    // A self-loop states nothing about an order and would report the subject as
    // its own supplier.
    if (isSource === isTarget) continue;

    const otherId = isSource ? ends.target : ends.source;
    const other = byId.get(otherId);
    if (!other) continue;

    const side: ReadingRelationSide = isSource ? 'supplier' : 'consumer';
    const [, otherY] = centreOf(other.elementBound);
    // `y` grows downwards, so "higher on the map" is a SMALLER y. A supplier is
    // expected below the subject, a consumer above it.
    const contradictsGeometry =
      side === 'supplier'
        ? otherY < subjectY - GEOMETRY_EPSILON
        : otherY > subjectY + GEOMETRY_EPSILON;

    relations.push({
      edgeId: edge.id,
      otherId,
      otherName: readName(other, profile),
      side,
      contradictsGeometry,
    });
  }
  return relations;
}

/** The naming line, when there is a single nature and a convention for it. */
function readNaming(
  element: GfxPrimitiveElementModel,
  profile: ReadingProfile,
  valueIds: readonly string[]
): ReadingNaming | undefined {
  const nature = profile.nature;
  if (!nature || valueIds.length !== 1) return undefined;

  const convention = nature.conventions.find(c => c.valueId === valueIds[0]);
  if (!convention) return undefined;

  const name = readName(element, profile);
  // Nothing to judge. An unnamed component is an unfinished drawing, not a
  // naming mistake, and the panel has a better thing to say about it: nothing.
  if (!name) return undefined;

  const pattern = compile(convention.pattern);
  if (!pattern) return undefined;

  return {
    name,
    conforms: pattern.test(name),
    hintKey: convention.hintKey,
    hintFallback: convention.hintFallback,
  };
}

/**
 * Read one element. Pure: same elements and same profile, same answer, and no
 * write anywhere on any path through this function.
 *
 * `null` when the element does not carry the profile's subject role — the
 * caller has nothing to show, which is what keeps the panel off every neutral
 * rectangle on the board.
 */
export function readElement(
  element: GfxPrimitiveElementModel,
  elements: readonly GfxPrimitiveElementModel[],
  profile: ReadingProfile
): ElementReading | null {
  const roleId = element.role;
  if (roleId === undefined) return null;
  if (!roleIsA(roleId, profile.appliesTo, profile.roles)) return null;

  const tagId = profile.nature?.tagId;
  const carried = tagId ? (readElementTags(element)[tagId] ?? []) : [];
  const labelKey = profile.roles[roleId]?.labelKey;

  return {
    elementId: element.id,
    nodeType: {
      roleId,
      ...(labelKey !== undefined ? { labelKey } : {}),
      specialises: specialisationChain(roleId, profile.roles),
    },
    nature:
      tagId !== undefined && carried.length > 0
        ? { tagId, valueIds: carried }
        : undefined,
    relations: readRelations(element, elements, profile),
    phase: readPhase(element, elements, profile),
    naming: readNaming(element, profile, carried),
  };
}

/** The profile governing an element, or `null` — the first match wins. */
export function readingProfileFor(
  element: GfxPrimitiveElementModel,
  profiles: readonly ReadingProfile[]
): ReadingProfile | null {
  const roleId = element.role;
  if (roleId === undefined) return null;
  return (
    profiles.find(profile =>
      roleIsA(roleId, profile.appliesTo, profile.roles)
    ) ?? null
  );
}

/**
 * What the LINKED RECORD says about the two fields a reading can compare
 * itself against. Bounded by construction: the profile names at most two host
 * property keys, and the provider is asked for nothing else.
 */
export interface RecordReading {
  pivotDocId: string;
  /** The record's nature value ids, when it carries the property. */
  nature?: string[];
  /** The record's phase, as the host spells it. */
  phase?: string;
}

/** One field on which the drawing and the record disagree. */
export interface ReadingDriftField {
  field: 'nature' | 'phase';
  /** What the board says. */
  read: string;
  /** What the record says. */
  record: string;
}

/** A bound element whose drawing has moved away from its confirmed record. */
export interface ReadingDrift {
  elementId: string;
  pivotDocId: string;
  fields: readonly ReadingDriftField[];
}

/** A record property flattened to the strings a comparison can work on. */
function propertyStrings(snapshot: PivotSnapshot, key: string): string[] {
  const property = snapshot.properties.find(p => p.key === key);
  if (!property) return [];
  const { value } = property;
  switch (value.kind) {
    case 'text':
      return value.value ? [value.value] : [];
    case 'tags':
      return value.value.filter(entry => entry.length > 0);
    default:
      // Every other kind is a value this comparison has no business
      // interpreting. Unknown means silent, never "different".
      return [];
  }
}

/**
 * The record's side of the comparison, read through the guarded seam.
 *
 * `undefined` on every degraded path — no binding, no provider, no configured
 * fields, a dangling record, a still-loading one — and the caller shows the
 * local reading alone. That is the `queryPivotProperties` contract: "this
 * editor has no host data layer" is not an error to put in front of a user.
 */
export function readRecord(
  std: BlockStdScope,
  element: GfxPrimitiveElementModel,
  profile: ReadingProfile
): RecordReading | undefined {
  if (!isPivotBound(element)) return undefined;
  const keys = profile.recordKeys;
  if (!keys?.nature && !keys?.phase) return undefined;

  const state = queryPivotProperties(std, element.pivotDocId);
  if (!state) return undefined;

  const current = state.value;
  if (current.status !== 'ready') return undefined;

  const nature = keys.nature
    ? propertyStrings(current.snapshot, keys.nature)
    : [];
  const phase = keys.phase ? propertyStrings(current.snapshot, keys.phase) : [];

  return {
    pivotDocId: element.pivotDocId,
    ...(nature.length ? { nature } : {}),
    ...(phase.length ? { phase: phase[0] } : {}),
  };
}

/**
 * Where the drawing and the record disagree.
 *
 * A field the record does not carry is never a disagreement: the record simply
 * has not been filled in, and calling that "drift" would turn an empty property
 * into a permanent complaint. A field the BOARD cannot read is not one either —
 * a component dragged off the map has no phase to be in conflict with.
 *
 * The phase comparison accepts either the zone id or the zone's own wording,
 * because a host is free to store "Product" where the declaration says
 * `product`, and neither spelling is more correct than the other.
 */
export function compareReading(
  reading: ElementReading,
  record: RecordReading
): ReadingDriftField[] {
  const fields: ReadingDriftField[] = [];

  const recorded = record.nature ?? [];
  if (recorded.length) {
    const read = reading.nature?.valueIds ?? [];
    const same =
      read.length === recorded.length &&
      read.every(value => recorded.includes(value));
    if (!same) {
      fields.push({
        field: 'nature',
        read: read.join(', '),
        record: recorded.join(', '),
      });
    }
  }

  if (record.phase && reading.phase) {
    const spellings = [
      reading.phase.zoneId,
      reading.phase.labelFallback ?? '',
    ].map(value => value.toLowerCase());
    if (!spellings.includes(record.phase.toLowerCase())) {
      fields.push({
        field: 'phase',
        read: reading.phase.labelFallback ?? reading.phase.zoneId,
        record: record.phase,
      });
    }
  }

  return fields;
}

/** A framework registers its reading profile here; nothing else registers one. */
export const ReadingProfileIdentifier =
  createIdentifier<ReadingProfile>('ReadingProfile');

/**
 * Register a framework's reading profile. Call it from the FLAG-GATED view
 * extension, beside the rules and the profiles: reading a map is tooling, and a
 * board whose framework is switched off keeps every one of its elements and
 * simply stops being read (ADR 0009).
 *
 * ```ts
 * context.register(ReadingProfileExtension(WARDLEY_READING));
 * ```
 */
export function ReadingProfileExtension(
  profile: ReadingProfile
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(ReadingProfileIdentifier(profile.id), () => profile);
    },
  };
}

/**
 * How the host picks a pivot record, for the ONE affordance that needs one: the
 * panel's "link to a record" action.
 *
 * The library cannot choose a document — it does not know what a pivot record
 * is (ADR 0005 § 3), which is why `pivot.bind` takes the id as a parameter. A
 * host that runs a picker registers it here and the action appears; a host that
 * does not gets no action at all, rather than a button that opens nothing.
 * Same rule as `PivotPropertiesProvider`: **no noop default is registered**,
 * because absence is a meaningful state and the degraded path has to stay
 * honest.
 *
 * It lives beside the reading rather than in `affine-shared/services` because
 * it exists for exactly one affordance in exactly one panel. The day a second
 * consumer wants it, it moves next to the rest of the pivot seam.
 */
export interface PivotRecordPicker {
  /**
   * Resolve to a record id, or to `null` when the user cancels. MUST NOT
   * throw; a rejection is swallowed by the caller and treated as a cancel.
   */
  pick(std: BlockStdScope, elementId: string): Promise<string | null>;
}

export const PivotRecordPickerProvider =
  createIdentifier<PivotRecordPicker>('LabrePivotRecordPicker');

export function PivotRecordPickerExtension(
  picker: PivotRecordPicker
): ExtensionType {
  return {
    setup: di => {
      di.override(PivotRecordPickerProvider, () => picker);
    },
  };
}

/**
 * Debounce of the drift trigger, in ms.
 *
 * Comfortably above a frame: the trigger is the one part of this feature that
 * runs without being asked, so it stays off the critical path by construction —
 * a drag of a bound component emits dozens of updates and must cost one check,
 * after the hand has stopped. Longer than the validation engine's 120 ms
 * because nothing here is a verdict: a record that is out of date can wait a
 * fifth of a second longer than a rule can.
 */
export const READING_DRIFT_DELAY_MS = 200;

/** Props whose change can move a reading away from a confirmed record. */
const DRIFT_PROPS = new Set(['xywh', 'rotate', 'tags', 'role', 'pivotDocId']);

const touchesReading = (payload: {
  props?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
}) => {
  const { props, oldValues } = payload;
  if (!props && !oldValues) return true;
  return (
    Object.keys(props ?? {}).some(key => DRIFT_PROPS.has(key)) ||
    Object.keys(oldValues ?? {}).some(key => DRIFT_PROPS.has(key))
  );
};

/**
 * Owns the OPEN panel and the drift signal. It owns no reading: a reading is
 * recomputed on demand from the document, so it can never be stale and can
 * never be a second source of truth.
 *
 * Inert until a framework registers a {@link ReadingProfile} — a board with no
 * framework enabled pays one empty-map check at mount and subscribes to
 * nothing.
 */
export class ReadingManager extends LifeCycleWatcher {
  static override readonly key = 'reading-manager';

  /**
   * The element whose proposal is open, or `null`. Session state, set by the
   * `element.read` command and by nothing else: the panel NEVER opens itself,
   * which is the whole of the PO's arbitration.
   */
  readonly open$ = signal<string | null>(null);

  /**
   * The last drift observed, or `null`. Informative and non-blocking: nothing
   * anywhere refuses a gesture because of it.
   */
  readonly drift$ = signal<ReadingDrift | null>(null);

  private _profiles: readonly ReadingProfile[] | null = null;

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _disposeSurfaceEffect: (() => void) | null = null;

  private _pending: ReturnType<typeof setTimeout> | null = null;

  private readonly _dirty = new Set<string>();

  /** Registered profiles, resolved once. Empty when every flag is off. */
  get profiles(): readonly ReadingProfile[] {
    this._profiles ??= Array.from(
      this.std.provider.getAll(ReadingProfileIdentifier).values()
    );
    return this._profiles;
  }

  override mounted() {
    if (this.profiles.length === 0) return;

    // The surface is a SIGNAL, not a fact: it can be null at mount and arrive
    // later, and it is replaced if the surface block is.
    this._disposeSurfaceEffect = effect(() => {
      this._resubscribe(this.std.get(GfxControllerIdentifier).surface$.value);
    });
  }

  override unmounted() {
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._unsubscribe();
    this.open$.value = null;
    this.drift$.value = null;
    super.unmounted();
  }

  /** Open the proposal for one element. Reads nothing yet, writes nothing ever. */
  open(elementId: string) {
    this.open$.value = elementId;
  }

  close() {
    this.open$.value = null;
  }

  /** The current surface, or `null` before one arrives. */
  private get _surface(): SurfaceBlockModel | null {
    return this.std.get(GfxControllerIdentifier).surface$.value;
  }

  /**
   * The reading of one element, recomputed from the document every time it is
   * asked for. Cheap enough to be called from a render: one pass over the
   * surface for the relations, one containment test per frame.
   */
  reading(elementId: string): ElementReading | null {
    const surface = this._surface;
    const element = surface?.getElementById(elementId);
    if (!surface || !element) return null;

    const profile = readingProfileFor(element, this.profiles);
    if (!profile) return null;

    return readElement(element, surface.elementModels, profile);
  }

  /** The profile governing an element, for the panel's confirmation actions. */
  profileOf(elementId: string): ReadingProfile | null {
    const element = this._surface?.getElementById(elementId);
    return element ? readingProfileFor(element, this.profiles) : null;
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
    if (this._pending) {
      clearTimeout(this._pending);
      this._pending = null;
    }
    this._dirty.clear();
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    // A new surface is a new document: a drift observed on the last one says
    // nothing about this one.
    this.drift$.value = null;
    this.open$.value = null;
    if (!surface) return;

    this._subscriptions.push(
      surface.elementUpdated.subscribe(payload => {
        // Local only, for the reason the materiality publisher documents:
        // `local` partitions the fleet into one watcher and N−1 silent
        // observers, with no leader election — and a colleague's drag is their
        // drift to notice, not ours.
        if (!payload.local) return;
        if (!touchesReading(payload)) return;
        this._schedule(payload.id);
      })
    );
    this._subscriptions.push(
      surface.elementRemoved.subscribe(({ id }) => {
        this._dirty.delete(id);
        if (this.drift$.value?.elementId === id) this.drift$.value = null;
        if (this.open$.value === id) this.open$.value = null;
      })
    );
  }

  /**
   * Never in the same tick, and never in the same frame.
   *
   * The whole trigger is one timer: a drag emits an update per pointer move,
   * and each one pushes the single pending check further away, so the work
   * happens once, after the hand has stopped, and the 16 ms budget of the drag
   * itself is untouched by construction rather than by measurement.
   */
  private _schedule(id: string) {
    this._dirty.add(id);
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => {
      this._pending = null;
      const ids = [...this._dirty];
      this._dirty.clear();
      for (const dirty of ids) this._check(dirty);
    }, READING_DRIFT_DELAY_MS);
  }

  private _check(elementId: string) {
    const surface = this._surface;
    const element = surface?.getElementById(elementId);
    if (!surface || !element) return;
    // Only a LINKED element can drift: without a record there is nothing to
    // disagree with, and the reading is just a reading.
    if (!isPivotBound(element)) {
      if (this.drift$.value?.elementId === elementId) this.drift$.value = null;
      return;
    }

    const profile = readingProfileFor(element, this.profiles);
    if (!profile) return;

    const reading = readElement(element, surface.elementModels, profile);
    if (!reading) return;

    const record = readRecord(this.std, element, profile);
    if (!record) {
      if (this.drift$.value?.elementId === elementId) this.drift$.value = null;
      return;
    }

    const fields = compareReading(reading, record);
    if (fields.length === 0) {
      if (this.drift$.value?.elementId === elementId) this.drift$.value = null;
      return;
    }

    this.drift$.value = {
      elementId,
      pivotDocId: record.pivotDocId,
      fields,
    };
  }
}
