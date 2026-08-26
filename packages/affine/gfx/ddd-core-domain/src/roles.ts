import { CD_SUBDOMAINS } from '@labre/affine-gfx-ddd-shared';
import type { RoleDef, RoleDefs, RoleId } from '@labre/std/gfx';

/**
 * The five dot presets' own `kind`, read off the shared table rather than
 * restated: a preset added there without a role here is a compile error.
 */
export type CdSubdomainKind = (typeof CD_SUBDOMAINS)[number]['kind'];

/**
 * Core Domain Chart role vocabulary.
 *
 * Roles are the semantic identity of a chart artefact — no rule will ever look
 * at a shape type. They mirror the five dot presets the user already picks in
 * the sub-menu ({@link CD_SUBDOMAINS}), plus the chart itself and the typed
 * MOVEMENT edge.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance: the five dots specialise
 * `core-domain:subdomain`, so a rule written on the parent covers all five for
 * free (see `roleIsA`), and a rule written on `-outsourced` touches that one
 * alone.
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
  movement: 'core-domain:movement',
} as const satisfies Record<
  CdSubdomainKind | 'chart' | 'subdomain' | 'movement',
  CoreDomainRoleId
>;

/** The role of one of the five dot presets. */
export function subdomainRole(kind: CdSubdomainKind): RoleId {
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
