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

/** Every role this framework declares. */
export type WardleyRole = WardleyNodeKind | 'dependency';

export type WardleyRoleId = `wardley:${WardleyRole}`;

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
} as const satisfies Record<WardleyRole, WardleyRoleId>;

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
];

export const WARDLEY_ROLES: RoleDefs = Object.fromEntries(
  DEFS.map(def => [def.id, def])
);
