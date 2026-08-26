import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import type { RoleDef, RoleDefs } from '@labre/std/gfx';

/**
 * Event Storming role vocabulary (WS5).
 *
 * A role is the semantic identity of an artefact — no rule will ever look at a
 * shape type or at a fill colour. Three families:
 *
 * - the **board** (`es:board`), the paper roll the storm is run on;
 * - the **sticky** (`es:sticky`), parent of the nine kinds the notation has;
 * - the **flow** (`es:flow`), the edge that says one thing leads to another.
 *
 * ## Why a sticky PARENT
 *
 * Because two of the three rules are written on it and neither wants to know
 * about the nine. `es.overlapping-stickies` is a readability rule — any two
 * stickies on top of each other are unreadable, whichever kinds they are — and
 * the day a tenth kind lands it is covered without a line changing.
 * Specialisation is DATA (`parent`), read by `roleIsA`.
 *
 * ## The alphabet is smaller than the vocabulary
 *
 * All nine kinds get a role; only seven of them appear in the grammar
 * (`es.forbidden-arc`). The **hotspot** and the **constraint** are declared here
 * and cited by no triplet, deliberately: a hotspot is the workshop saying "we do
 * not know", and a flow drawn onto one is somebody parking a question, not
 * making a claim. Being outside the alphabet takes the whole edge out of the
 * conversation (see `RelationEndpointsDef.allowed`), which is exactly the
 * proportionality the family was built for.
 *
 * ## Compat
 *
 * Nothing is backfilled. Stickies placed before these roles existed carry none
 * and are never evaluated (promesse #71): they stay drawings, in the documents
 * they are in.
 */

/** The sticky kinds as used at the creation sites, hotspot included. */
export type EventStormingStickyKind =
  | (typeof ES_STICKIES)[number]['kind']
  | 'hotspot';

export type EventStormingRoleId = `es:${string}`;

/** camelCase → kebab-case, the WS2 derivation. */
const kebab = (kind: string): string =>
  kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/**
 * The one kind whose role id is not its kind kebab-cased.
 *
 * `system` is what the palette has called the sticky since the tool shipped and
 * what its telemetry emits; `external-system` is what Event Storming calls the
 * thing, and it is the word a rule and a hover reveal have to say. Renaming the
 * kind would move a telemetry value (ADR 0008 forbids it) and renaming the role
 * would make the grammar read `command → system`, which is not a sentence
 * anybody says. One entry in a table is the cost of keeping both right.
 */
const ROLE_SLUG: Partial<Record<string, string>> = { system: 'external-system' };

const slug = (kind: string): string => ROLE_SLUG[kind] ?? kebab(kind);

/**
 * Role id per sticky kind, DERIVED from the shared preset table rather than
 * restated — so the day a tenth sticky lands in `ES_STICKIES` it gets its role
 * here with no edit. The hotspot is appended because it lives in its own preset
 * (`ES_HOTSPOT`, a diamond rather than a square) and not in the table.
 */
export const ES_STICKY_ROLE = Object.fromEntries([
  ...ES_STICKIES.map(preset => [preset.kind, `es:${slug(preset.kind)}`]),
  ['hotspot', 'es:hotspot'],
]) as Record<EventStormingStickyKind, EventStormingRoleId>;

/** The three roles that are not a sticky kind, plus the nine that are. */
export const ES_ROLE = {
  board: 'es:board',
  sticky: 'es:sticky',
  flow: 'es:flow',
  ...ES_STICKY_ROLE,
} as const;

/** Human label per kind, from the same presets the palette renders. */
const STICKY_LABEL: Record<string, string> = {
  ...Object.fromEntries(ES_STICKIES.map(preset => [preset.kind, preset.label])),
  hotspot: ES_HOTSPOT.label,
};

const DEFS: readonly RoleDef[] = [
  // The board: a frame, not a sticky. It specialises nothing, so a rule written
  // on `es:sticky` can never fall on the roll its subjects are stuck to.
  {
    id: ES_ROLE.board,
    kind: 'node',
    labelKey: 'com.labre.event-storming.role.board',
    labelFallback: 'Event Storming board',
  },
  {
    id: ES_ROLE.sticky,
    kind: 'node',
    labelKey: 'com.labre.event-storming.role.sticky',
    labelFallback: 'Sticky',
  },
  ...Object.keys(STICKY_LABEL).map(
    (kind): RoleDef => ({
      id: ES_STICKY_ROLE[kind as EventStormingStickyKind],
      parent: ES_ROLE.sticky,
      kind: 'node',
      labelKey: `com.labre.event-storming.role.${slug(kind)}`,
      labelFallback: STICKY_LABEL[kind],
    })
  ),
  /**
   * The flow. Tier 1 of `docs/adr/0010`: the source is the subject of the verb,
   * so the source is what happens FIRST. Everything downstream of that sentence
   * — the tool hint, the hover reveal, the inversion command and
   * `es.against-timeline` — reads this one declaration and never a framework
   * name.
   */
  {
    id: ES_ROLE.flow,
    kind: 'edge',
    labelKey: 'com.labre.event-storming.role.flow',
    labelFallback: 'Flow',
    direction: {
      verbKey: 'com.labre.event-storming.role.flow.verb',
      verbFallback: 'leads to',
      gestureHintKey: 'com.labre.event-storming.role.flow.gesture',
      gestureHintFallback: 'Drag from what happens first to what follows.',
    },
  },
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const EVENT_STORMING_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
