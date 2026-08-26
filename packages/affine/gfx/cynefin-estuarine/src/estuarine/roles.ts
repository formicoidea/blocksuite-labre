import type { RoleDef, RoleDefs } from '@labre/std/gfx';

/**
 * Estuarine role vocabulary (WS4).
 *
 * Two roles, and deliberately only two: the MAP — the axes and the three
 * reference curves an Estuarine session is read against — and the CONSTRAINT
 * hexagon the group drops onto it. Everything else on such a board (the
 * captions, the stickies, a free arrow drawn to link two hexagons) is a plain
 * drawing and stays neutral, because nothing in this framework has anything to
 * say about it.
 *
 * ## Cynefin declares NO role, and never will
 *
 * The two frameworks share this package and share nothing else here. The PO's
 * arbitration of 26/08/2026 is that Cynefin is out of the validation perimeter
 * for good: its four domains are a sense-making device, not a notation with
 * rules, so giving its background a role would advertise tooling — a profile
 * picker, a quality checklist — over a framework that has nothing to check.
 * A role with no consumer is a promise the product does not keep.
 *
 * ## What a role buys Estuarine, which ships no rule either
 *
 * The map role is what makes the map a ROOT INSTANCE: it is handed to
 * `ValidationFrameworkExtension` so the engine can answer "is this element
 * somebody's frame?" and offer the Map quality checklist on it. That gate used
 * to be derived from the registered rules alone, which is exactly why WS0.3
 * gave it a second, explicit source — see `ValidationFrameworkDef`.
 *
 * The constraint role earns its keep on its own: a hexagon is a plain polygon
 * shape on the canvas, so nothing about its geometry says what it means, and
 * the first rule this framework ever writes will be written against this role
 * rather than against `shapeType === 'polygon'`.
 *
 * ## Compatibility
 *
 * No backfill (promise #71): maps and hexagons drawn before today carry no
 * role, are nobody's frame, and go on painting exactly as they did. They simply
 * offer no checklist until they are redrawn.
 */

/** Every role this framework declares. */
export type EstuarineRole = 'map' | 'constraint';

export type EstuarineRoleId = `estuarine:${EstuarineRole}`;

/** Role ids, keyed by the name used at the creation sites. */
export const ESTUARINE_ROLE = {
  map: 'estuarine:map',
  constraint: 'estuarine:constraint',
} as const satisfies Record<EstuarineRole, EstuarineRoleId>;

const DEFS: readonly RoleDef[] = [
  // The map itself: the e / t axes and the three curves everything else is
  // positioned against. A frame, so it specialises nothing — a rule written on
  // `estuarine:constraint` must never match the map it is measured against.
  {
    id: ESTUARINE_ROLE.map,
    kind: 'node',
    labelKey: 'com.labre.estuarine.role.map',
    labelFallback: 'Estuarine map',
  },
  // The hexi constraint. A `node`: it is measured by its bounds, which is
  // exactly what an Estuarine reading is about — where on the energy/time
  // plane the group placed this constraint.
  {
    id: ESTUARINE_ROLE.constraint,
    kind: 'node',
    labelKey: 'com.labre.estuarine.role.constraint',
    labelFallback: 'Constraint',
  },
];

// Null prototype: a lookup table keyed by ids that may one day come from
// host-supplied packs, so `defs['toString']` must not resolve.
export const ESTUARINE_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
