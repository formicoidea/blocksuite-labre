import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  type C4BoundaryVariant,
  C4NodeElementModel,
  type C4NodeKind,
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import type { C4ComponentGroup, C4TierElement } from '../component';
import { DESCRIPTION_PLACEHOLDER } from '../consts';
import type { C4ExportBoard } from '../export';
import { C4_ROLE, C4_ROLE_OF_KIND } from '../roles';
import { C4_TYPE_PLACEHOLDER } from '../type-line';

/**
 * The C4 board fixtures, shared by the export spec and the interchange spec.
 *
 * Extracted for the reason BPMN's `board-stub.ts` was: the declared interchange
 * capability (`docs/adr/0012`) is handed the SAME board the exporter is, and a
 * second copy of a three-hundred-line fixture is a second board that drifts.
 *
 * Every fake is an `Object.create(<Model>.prototype)` carrying its own
 * properties, and that is load-bearing rather than decorative: the capability
 * and the command both pick their artefacts out of a FLAT element list with
 * `instanceof`, so a plain record would be invisible to them. Which is why the
 * two written tiers and the group joining them to a shape are `TextElementModel`
 * and `GroupElementModel` fakes here, where the export spec — calling the pure
 * serializer, which asks a tier for an id, a role and whatever it says — used to
 * get away with plain records.
 */

/* ── Stubs ────────────────────────────────────────────────────────────── */

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
    elementBound: { value: new Bound(...bound) },
  });
  return node as unknown as C4NodeElementModel;
}

/**
 * A component's words, as the elements they actually are.
 *
 * Since the PO's recette of 28/08/2026 a C4 element's technology and its
 * description are canvas TEXT elements grouped with the shape rather than two
 * fields on it, so the fixtures below build what the creation site builds: a
 * text per tier carrying its ROLE, and a group joining them to the node.
 *
 * Detached `TextElementModel`s and a detached `GroupElementModel` rather than
 * plain records, and the difference only shows up one seam away: the exporter
 * asks a tier for exactly three things — an id, a role, and whatever it says,
 * read through `String(…)` — which any object can answer, but the command and
 * the declared capability both PICK these elements out of a flat surface list
 * with `instanceof`. A plain record is a component whose words vanish on the
 * way in. Properties are defined on the instance, so nothing here touches a
 * Y.Text and nothing here tests Yjs.
 */
export class Components {
  readonly texts: C4TierElement[] = [];
  readonly groups: C4ComponentGroup[] = [];

  /** Group a node with its own words, and hand the node straight back. */
  with(
    node: C4NodeElementModel,
    tiers: { title?: string; typeLine?: string; description?: string }
  ): C4NodeElementModel {
    const childIds = [node.id];
    if (tiers.title !== undefined) {
      const id = `${node.id}-title`;
      this.texts.push(fakeTier(id, C4_ROLE.title, tiers.title));
      childIds.push(id);
    }
    if (tiers.typeLine !== undefined) {
      const id = `${node.id}-type`;
      this.texts.push(fakeTier(id, C4_ROLE['type-line'], tiers.typeLine));
      childIds.push(id);
    }
    if (tiers.description !== undefined) {
      const id = `${node.id}-descr`;
      this.texts.push(fakeTier(id, C4_ROLE.description, tiers.description));
      childIds.push(id);
    }
    this.groups.push(fakeGroup(`${node.id}-group`, childIds));
    return node;
  }
}

/** One written tier, as the canvas `text` element it is. */
export function fakeTier(
  id: string,
  role: string,
  text: string
): C4TierElement {
  const tier = Object.create(TextElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(tier, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    text: { value: text, enumerable: true },
  });
  return tier as unknown as C4TierElement;
}

/** The group that makes a shape and its words one component. */
export function fakeGroup(
  id: string,
  childIds: readonly string[]
): C4ComponentGroup {
  const group = Object.create(GroupElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(group, {
    id: { value: id, enumerable: true },
    childIds: { value: childIds, enumerable: true },
  });
  return group as unknown as C4ComponentGroup;
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
  const components = new Components();

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
    // Its type line is the untouched placeholder, which is what a person that
    // nobody typed a technology on actually carries — and which the export must
    // read as "nothing stated" rather than as a technology called "technology".
    // Its NAME is a `c4:title` child and the shape carries no text at all,
    // which is what every element drawn today looks like.
    components.with(fakeNode('n-customer', 'person', [900, 300, 60, 60]), {
      title: 'Customer',
      typeLine: C4_TYPE_PLACEHOLDER.person,
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
    // Both tiers written — the enriched case the whole change request is about,
    // and the one that proves the technology is read back OUT of the line the
    // author typed rather than out of a field.
    components.with(fakeNode('n-webapp', 'container', [200, 500, 80, 60]), {
      title: 'Web Application',
      typeLine: '[Container: Java and Spring MVC]',
      description: 'Delivers the static content and the banking SPA.',
    }),
    // A BARE node — no group, no words, its name in the SHAPE's own inner text.
    // Which is both an ungrouped element and an element drawn before the title
    // became a child, and the fallback that has to hold for either: the name is
    // read off the shape, the picture's own default technology still applies,
    // and nothing is invented.
    fakeNode('n-spa', 'browser', [350, 500, 80, 60], {
      text: 'Single-Page App',
    }),
    fakeNode('n-mobile', 'mobile', [500, 500, 80, 60], { text: 'Mobile App' }),
    // A description and NO technology, on a macro that has a slot for both: the
    // one case that has to write an explicit empty `""` to hold the slot open.
    // The type line is there and says `[Container]` — the author cleared it.
    components.with(fakeNode('n-db', 'database', [200, 560, 80, 50]), {
      title: 'Database',
      typeLine: '[Container]',
      description: 'Stores user registration information.',
    }),
    // A component whose description was left at the stencil's own prompt — the
    // state of every element five seconds after it is drawn.
    components.with(fakeNode('n-signin', 'component', [200, 250, 80, 60]), {
      title: 'Sign In Controller',
      typeLine: C4_TYPE_PLACEHOLDER.component,
      description: DESCRIPTION_PLACEHOLDER,
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
    texts: components.texts,
    groups: components.groups,
  });
}
