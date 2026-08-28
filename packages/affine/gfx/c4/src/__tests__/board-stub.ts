import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  type C4BoundaryVariant,
  C4NodeElementModel,
  type C4NodeKind,
  ConnectorElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import type { C4ExportBoard } from '../export';
import { C4_ROLE, C4_ROLE_OF_KIND } from '../roles';

/**
 * Plain element-model stubs for the export and interchange specs — models with
 * a prototype and own data properties, no Y.Map and no editor, which is
 * exactly the shape the pure serializer takes. Lifted out of
 * `export.unit.spec.ts` when the interchange spec arrived, the same move
 * BPMN's `board-stub.ts` made for the same reason: two specs, one fixture
 * vocabulary.
 */

export type Box = [number, number, number, number];

export function fakeBoard(id: string, bound: Box, name?: string) {
  const board = Object.create(C4BoardElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(board, {
    id: { value: id, enumerable: true },
    role: { value: C4_ROLE.board, enumerable: true },
    name: { value: name, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return board as unknown as C4BoardElementModel;
}

export function fakeBoundary(
  id: string,
  bound: Box,
  options: { name?: string; variant?: C4BoundaryVariant; role?: string } = {}
) {
  const boundary = Object.create(C4BoundaryElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(boundary, {
    id: { value: id, enumerable: true },
    role: {
      value: 'role' in options ? options.role : C4_ROLE.boundary,
      enumerable: true,
    },
    name: { value: options.name, enumerable: true },
    variant: { value: options.variant, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return boundary as unknown as C4BoundaryElementModel;
}

export function fakeNode(
  id: string,
  kind: C4NodeKind,
  bound: Box,
  options: {
    text?: string;
    role?: string;
    technology?: string;
    description?: string;
  } = {}
) {
  const node = Object.create(C4NodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(node, {
    id: { value: id, enumerable: true },
    kind: { value: kind, enumerable: true },
    role: {
      value: 'role' in options ? options.role : C4_ROLE_OF_KIND[kind],
      enumerable: true,
    },
    text: { value: options.text, enumerable: true },
    // Own properties, so the `@field()` accessors (which reach for a Y.Map this
    // detached object has none of) are shadowed. `undefined` is the honest
    // stand-in for a field a document never wrote.
    technology: { value: options.technology, enumerable: true },
    description: { value: options.description, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return node as unknown as C4NodeElementModel;
}

export function fakeConnector(
  id: string,
  role: string | undefined,
  ends: { source?: string; target?: string } = {},
  text?: string
) {
  const connector = Object.create(ConnectorElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(connector, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    text: { value: text, enumerable: true },
    source: {
      value: ends.source === undefined ? {} : { id: ends.source },
      enumerable: true,
    },
    target: {
      value: ends.target === undefined ? {} : { id: ends.target },
      enumerable: true,
    },
  });
  return connector as unknown as ConnectorElementModel;
}

export const surface = (partial: Partial<C4ExportBoard>): C4ExportBoard => ({
  boards: [],
  nodes: [],
  boundaries: [],
  connectors: [],
  ...partial,
});

/* ── The composed board ───────────────────────────────────────────────── */

/**
 * Every element the pack draws, a system boundary with a container boundary
 * inside it, three relationships, and two things that must NOT come out: a
 * connector with no role, and a shape carrying the C4 palette but no role at
 * all.
 *
 * Built once and read by several tests, because it is the case the export
 * exists for: anything simpler would leave a whole half of the format
 * unexercised.
 *
 * Geometry, for whoever has to move a box: the board's plot runs x 24…1376 and
 * y 56…876 (`BOARD_MARGIN`, `BOARD_TITLE_MARGIN`); the system boundary's runs
 * x 112…688, y 162…638 and the container boundary's x 162…438, y 212…428
 * (`BOUNDARY_MARGIN`). Everything below is attributed by its CENTRE against
 * those, most-nested first.
 */
export function composedBoard(): C4ExportBoard {
  const board = fakeBoard('b-1', [0, 0, 1400, 900], 'Internet banking');

  const outer = fakeBoundary('bd-outer', [100, 150, 600, 500], {
    name: 'Internet banking system',
    variant: 'system',
  });
  const inner = fakeBoundary('bd-inner', [150, 200, 300, 240], {
    name: 'API application',
    variant: 'container',
  });

  const nodes = [
    // A description on a PERSON: mermaid's `Person` has no `techn` slot at all,
    // so the sentence is the third argument here and the fourth on a container.
    fakeNode('n-customer', 'person', [900, 300, 60, 60], {
      text: 'Customer',
      description: 'A customer of the bank.',
    }),
    fakeNode('n-auditor', 'person-ext', [1000, 300, 60, 60], {
      text: 'External auditor',
    }),
    fakeNode('n-banking', 'system', [710, 700, 60, 60], {
      text: 'Internet Banking System',
    }),
    fakeNode('n-mainframe', 'system-ext', [1100, 600, 60, 60], {
      text: 'Mainframe Banking System',
    }),
    // Both fields set — the enriched case the whole change request is about.
    fakeNode('n-webapp', 'container', [200, 500, 80, 60], {
      text: 'Web Application',
      technology: 'Java and Spring MVC',
      description: 'Delivers the static content and the banking SPA.',
    }),
    fakeNode('n-spa', 'browser', [350, 500, 80, 60], {
      text: 'Single-Page App',
    }),
    fakeNode('n-mobile', 'mobile', [500, 500, 80, 60], { text: 'Mobile App' }),
    // A description and NO technology, on a macro that has a slot for both: the
    // one case that has to write an explicit empty `""` to hold the slot open.
    fakeNode('n-db', 'database', [200, 560, 80, 50], {
      text: 'Database',
      description: 'Stores user registration information.',
    }),
    fakeNode('n-signin', 'component', [200, 250, 80, 60], {
      text: 'Sign In Controller',
    }),
    fakeNode('n-security', 'component', [300, 250, 80, 60], {
      text: 'Security Component',
    }),
    // A box drawn with the C4 stencil and NO role — copied, pasted, restyled by
    // hand. It looks like a system and states nothing (`docs/adr/0010`).
    fakeNode('n-rogue', 'system', [780, 380, 60, 60], {
      text: 'Looks like a system',
      role: undefined,
    }),
    // …and a properly stamped system drawn OFF the board: a second diagram's
    // element, or a note parked on bare canvas.
    fakeNode('n-offboard', 'system', [2000, 300, 60, 60], {
      text: 'Somewhere else',
    }),
  ];

  const connectors = [
    fakeConnector(
      'c-1',
      C4_ROLE.relationship,
      { source: 'n-customer', target: 'n-spa' },
      'Uses'
    ),
    fakeConnector(
      'c-2',
      C4_ROLE.relationship,
      { source: 'n-spa', target: 'n-signin' },
      'Makes API calls to'
    ),
    fakeConnector(
      'c-3',
      C4_ROLE.relationship,
      { source: 'n-webapp', target: 'n-db' },
      'Reads from and writes to'
    ),
    // A NEUTRAL connector: an arrow the author drew and never typed. It relates
    // nothing, so it is not a relationship at all.
    fakeConnector('c-plain', undefined, {
      source: 'n-customer',
      target: 'n-banking',
    }),
    // A relationship whose far end is off the board — no alias in this document
    // to point at.
    fakeConnector(
      'c-away',
      C4_ROLE.relationship,
      { source: 'n-customer', target: 'n-offboard' },
      'Also uses'
    ),
    // …and one with a free end, which mermaid cannot express either.
    fakeConnector(
      'c-dangling',
      C4_ROLE.relationship,
      { source: 'n-customer' },
      'Wonders about'
    ),
    // An end on the BOUNDARY rather than on an element: a boundary is a frame,
    // not a participant in a sentence.
    fakeConnector(
      'c-frame',
      C4_ROLE.relationship,
      { source: 'n-customer', target: 'bd-outer' },
      'Trusts'
    ),
  ];

  return surface({
    boards: [board],
    nodes,
    boundaries: [outer, inner],
    connectors,
  });
}
