import { CD_SUBDOMAINS, TEAM_TOPOLOGIES } from '@labre/affine-gfx-ddd-shared';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

/**
 * The five dot presets' own `kind`, read off the shared table rather than
 * restated: a preset added there without a role here is a compile error.
 */
export type CdSubdomainKind = (typeof CD_SUBDOMAINS)[number]['kind'];

/** The three Team Topologies marker kinds, read off their table the same way. */
export type CdMarkerKind = (typeof TEAM_TOPOLOGIES)[number]['kind'];

/**
 * Core Domain Chart role vocabulary.
 *
 * Roles are the semantic identity of a chart artefact — no rule will ever look
 * at a shape type. They mirror the presets the user already picks in the
 * sub-menu — the five dots ({@link CD_SUBDOMAINS}) and the three Team
 * Topologies markers ({@link TEAM_TOPOLOGIES}) — plus the chart itself and the
 * typed MOVEMENT edge.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance: the five dots specialise
 * `core-domain:subdomain`, so a rule written on the parent covers all five for
 * free (see `roleIsA`), and a rule written on `-outsourced` touches that one
 * alone. The three markers form a SECOND family under `core-domain:marker`,
 * deliberately disjoint from the first: they annotate the chart, they are not
 * plotted on it, and no rule written on sub-domains must ever fall on one.
 *
 * ## No backfill, ever
 *
 * These values are written by the creation sites from today on. A chart drawn
 * before they existed carries dots with no role at all, and an element with no
 * role is never evaluated (proportionality, PRD principle 8) — so an old
 * document opens exactly as it always did and raises nothing. Same promise every
 * other framework's vocabulary made (#71).
 *
 * The vocabulary is registered from the ALWAYS-ON render extension
 * (`docs/adr/0009`): a role is written in the document, not in the tooling, and
 * what reads it back — the direction reveal of a typed edge, the inversion
 * command — has to keep working on a chart drawn while the flag was on and
 * opened while it is off.
 */

/** Every role this framework declares. */
export type CoreDomainRole =
  | 'chart'
  | 'subdomain'
  | 'subdomain-big-bet'
  | 'subdomain-platform'
  | 'subdomain-outsourced'
  | 'bc-current'
  | 'bc-future'
  | 'marker'
  | 'marker-collaboration'
  | 'marker-xaas'
  | 'marker-facilitating'
  | 'movement';

export type CoreDomainRoleId = `core-domain:${CoreDomainRole}`;

/**
 * Role ids, keyed by the `kind` the creation sites use — camelCased, exactly
 * like `CD_SUBDOMAINS[].kind`, so `commands.ts` can hand a preset's own kind
 * straight to this table.
 */
export const CORE_DOMAIN_ROLE = {
  chart: 'core-domain:chart',
  subdomain: 'core-domain:subdomain',
  bigBet: 'core-domain:subdomain-big-bet',
  platform: 'core-domain:subdomain-platform',
  outsourced: 'core-domain:subdomain-outsourced',
  bcCurrent: 'core-domain:bc-current',
  bcFuture: 'core-domain:bc-future',
  marker: 'core-domain:marker',
  collaboration: 'core-domain:marker-collaboration',
  xaas: 'core-domain:marker-xaas',
  facilitating: 'core-domain:marker-facilitating',
  movement: 'core-domain:movement',
} as const satisfies Record<
  | CdSubdomainKind
  | CdMarkerKind
  | 'chart'
  | 'subdomain'
  | 'marker'
  | 'movement',
  CoreDomainRoleId
>;

/** The role of one of the five dot presets. */
export function subdomainRole(kind: CdSubdomainKind): RoleId {
  return CORE_DOMAIN_ROLE[kind];
}

/** The role of one of the three Team Topologies markers. */
export function markerRole(kind: CdMarkerKind): RoleId {
  return CORE_DOMAIN_ROLE[kind];
}

const DEFS: readonly RoleDef[] = [
  // The chart itself: the frame of reference the other roles are positioned
  // against. A frame, not a sub-domain, so it specialises nothing — a rule
  // written on `core-domain:subdomain` must never match the chart it measures
  // against.
  {
    id: CORE_DOMAIN_ROLE.chart,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.chart',
    labelFallback: 'Core Domain Chart',
  },
  // The abstract artefact placed on the chart: a dot at a (differentiation,
  // complexity) position. Never created directly — the five below are what the
  // sub-menu offers — but the role a readability rule is written on.
  {
    id: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.subdomain',
    labelFallback: 'Sub-domain',
  },
  {
    id: CORE_DOMAIN_ROLE.bigBet,
    parent: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.subdomain-big-bet',
    labelFallback: 'Big-bet sub-domain',
  },
  {
    id: CORE_DOMAIN_ROLE.platform,
    parent: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.subdomain-platform',
    labelFallback: 'Platform sub-domain',
  },
  {
    id: CORE_DOMAIN_ROLE.outsourced,
    parent: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.subdomain-outsourced',
    labelFallback: 'Outsourced / purchased sub-domain',
  },
  // A bounded context, at the position it occupies TODAY. A sub-domain on the
  // chart like any other — it is placed and read the same way — hence the
  // parent; what makes it a `bc-current` is that a movement may start from it.
  {
    id: CORE_DOMAIN_ROLE.bcCurrent,
    parent: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.bc-current',
    labelFallback: 'Bounded context (current position)',
  },
  {
    id: CORE_DOMAIN_ROLE.bcFuture,
    parent: CORE_DOMAIN_ROLE.subdomain,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.bc-future',
    labelFallback: 'Bounded context (future position)',
  },
  /**
   * A Team Topologies interaction mode, written ON the chart beside the
   * sub-domains it concerns: "these two teams collaborate", "this one is
   * consumed as a service".
   *
   * It is NOT a sub-domain and specialises nothing, which is the whole point of
   * giving it a family of its own rather than hanging it off
   * `core-domain:subdomain`. A marker is an annotation about how work flows
   * between teams; a sub-domain is a thing plotted at a (differentiation,
   * complexity) position. `core-domain.overlapping-artefacts` pairs
   * `[subdomain, subdomain]`, so a marker parked against the dot it comments on
   * — which is exactly where a marker belongs — raises nothing, and neither
   * does `core-domain.off-legend-colour`, which is written on the dots' five
   * colours and has no business judging a green Collaboration square.
   *
   * What the role DOES buy, today, is the legend: detection is by role only, so
   * a marker with none was invisible to the button that lists what is drawn.
   */
  {
    id: CORE_DOMAIN_ROLE.marker,
    kind: 'node',
    labelKey: 'com.labre.core-domain.role.marker',
    labelFallback: 'Team interaction mode',
  },
  // The three modes, DERIVED from the preset table the palette draws them with:
  // both the id and the wording come from that one place, so a fourth mode added
  // there arrives here with its role — and, through the role, with its legend
  // row — and no edit. The colour stays where a colour belongs, in the preset.
  ...TEAM_TOPOLOGIES.map(
    (preset): RoleDef => ({
      id: CORE_DOMAIN_ROLE[preset.kind],
      parent: CORE_DOMAIN_ROLE.marker,
      kind: 'node',
      labelKey: `com.labre.core-domain.role.marker-${preset.kind}`,
      labelFallback: preset.label,
    })
  ),
  /**
   * The movement over time: "this context is moving there".
   *
   * Tier 2 of `docs/adr/0010`: the verb of this role is "is moving to", so its
   * SOURCE is where the context stands today and its TARGET where it is headed.
   * The gesture hint is what makes the direction a statement the user made
   * rather than a by-product of which end their finger landed on first — and it
   * is exactly what `core-domain.malformed-movement` reads back.
   */
  {
    id: CORE_DOMAIN_ROLE.movement,
    kind: 'edge',
    labelKey: 'com.labre.core-domain.role.movement',
    labelFallback: 'Movement over time',
    direction: {
      verbKey: 'com.labre.core-domain.role.movement.verb',
      verbFallback: 'is moving to',
      gestureHintKey: 'com.labre.core-domain.role.movement.gesture',
      gestureHintFallback:
        'Drag from the current position to the future one.',
    },
  },
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const CORE_DOMAIN_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
