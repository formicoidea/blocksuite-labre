import type { WardleyNodeKind } from '@labre/affine-model';
import type { RoleDef, RoleDefs } from '@labre/std/gfx';

/**
 * Wardley role vocabulary (PF13.1).
 *
 * Roles are the semantic identity of a Wardley artefact — no rule will ever
 * look at a shape type. They mirror {@link WardleyNodeKind}, which the user
 * already picks when choosing the artefact in the toolbox, plus the typed
 * `dependency` EDGE carried by the Wardley link connector.
 *
 * Hierarchy is DATA (`parent`), never TS inheritance: `market` and `ecosystem`
 * specialise `component`, so a rule written on `wardley:component` applies to
 * them for free (see `roleIsA`). The `anchor` (user / need) is a role of its
 * own — a component with no need of its own — and is deliberately NOT a child
 * of `component`.
 */

/**
 * ## Revision of decision #71 (PF13.4, 01/08/2026)
 *
 * PF1 left three artefacts NEUTRAL — the evolution arrow ("a movement
 * annotation, not a dependency"), the inertia bar and the node labels — on the
 * ground that nothing was written on them yet. That was right while the only
 * rule was the pilot; it is wrong now that the framework has rules about them:
 * an element with no role is never evaluated (proportionality, PRD principle
 * 8), so leaving these neutral would have meant W1, W2 and W3 could not exist.
 *
 * The reversal writes new VALUES into the existing `role` field. No schema
 * change, no migration, and no backfill of documents already drawn: a map
 * authored before today carries arrows and bars with no role, so it raises
 * nothing — which is the same promise every earlier role made.
 */

/** Every role this framework declares. */
export type WardleyRole =
  | WardleyNodeKind
  | 'dependency'
  | 'map'
  | 'change-arrow'
  | 'inertia'
  | 'label';

export type WardleyRoleId = `wardley:${WardleyRole}`;

/**
 * How {@link WARDLEY_ROLE} is keyed: by the `kind` used at the creation sites,
 * camelCased where the role id is not a single word. Spelled out so the table
 * below stays exhaustive over {@link WardleyRole} — a role added to the union
 * and forgotten here is a compile error.
 */
type WardleyRoleKey = Exclude<WardleyRole, 'change-arrow'> | 'changeArrow';

/** Role ids, keyed by the `kind` used at the creation sites. */
export const WARDLEY_ROLE = {
  component: 'wardley:component',
  anchor: 'wardley:anchor',
  pipeline: 'wardley:pipeline',
  handle: 'wardley:handle',
  market: 'wardley:market',
  ecosystem: 'wardley:ecosystem',
  method: 'wardley:method',
  dependency: 'wardley:dependency',
  map: 'wardley:map',
  changeArrow: 'wardley:change-arrow',
  inertia: 'wardley:inertia',
  label: 'wardley:label',
} as const satisfies Record<WardleyRoleKey, WardleyRoleId>;

const DEFS: readonly RoleDef[] = [
  {
    id: WARDLEY_ROLE.component,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.component',
  },
  // A user / need: a component with no need of its own, hence its own role
  // rather than a specialisation of `component`.
  {
    id: WARDLEY_ROLE.anchor,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.anchor',
  },
  // The pipeline body. Connections go through its handle, never the body.
  {
    id: WARDLEY_ROLE.pipeline,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.pipeline',
  },
  {
    id: WARDLEY_ROLE.handle,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.handle',
  },
  {
    id: WARDLEY_ROLE.market,
    parent: WARDLEY_ROLE.component,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.market',
  },
  {
    id: WARDLEY_ROLE.ecosystem,
    parent: WARDLEY_ROLE.component,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.ecosystem',
  },
  {
    id: WARDLEY_ROLE.method,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.method',
  },
  // The value-chain link: "A depends on B".
  {
    id: WARDLEY_ROLE.dependency,
    kind: 'edge',
    labelKey: 'com.labre.wardley.role.dependency',
  },
  // The map itself: the axes frame the other roles are positioned against.
  // A frame, not a component, so it specialises nothing — a rule written on
  // `wardley:component` must never match the map it measures against.
  {
    id: WARDLEY_ROLE.map,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.map',
  },
  // The change (evolution) arrow: "this is where it is going". An EDGE, and
  // deliberately not a specialisation of `dependency` — it says nothing about
  // what depends on what, and W1 must not fall on a value-chain link.
  {
    id: WARDLEY_ROLE.changeArrow,
    kind: 'edge',
    labelKey: 'com.labre.wardley.role.change-arrow',
  },
  // The inertia bar: resistance to a movement, drawn ACROSS a dependency. A
  // plain filled rect on the canvas, which is exactly why it needs a role —
  // nothing about its shape says what it means.
  {
    id: WARDLEY_ROLE.inertia,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.inertia',
  },
  // The name written next to an artefact. A role of its own rather than a
  // property of the node it labels: on this canvas a label IS a separate free
  // text element, grouped with its node, and W3 is about where it lands.
  {
    id: WARDLEY_ROLE.label,
    kind: 'node',
    labelKey: 'com.labre.wardley.role.label',
  },
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const WARDLEY_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
