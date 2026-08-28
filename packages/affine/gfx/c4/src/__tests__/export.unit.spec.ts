import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  type C4BoundaryVariant,
  C4NodeElementModel,
  type C4NodeKind,
  ConnectorElementModel,
} from '@labre/affine-model';
import {
  ActionPlacement,
  type ToolbarActionGenerator,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import {
  c4BoardsForExport,
  c4BoardsSelected,
  c4ExportFilename,
} from '../actions';
import { c4Commands } from '../commands';
import {
  C4_MERMAID_OF_KIND,
  type C4ExportBoard,
  exportC4Mermaid,
  toMermaidAlias,
  toMermaidText,
} from '../export';
import { C4_ROLE, C4_ROLE_OF_KIND } from '../roles';
import { c4BoardToolbarConfig } from '../toolbar/config';

/**
 * The mermaid C4 export.
 *
 * Plain stubs and no editor, because the serializer is a pure function and the
 * whole point of putting it in a module of its own was that this file could
 * exist.
 *
 * Unlike BPMN's XML spec, this one asserts EXACT BYTES. The two formats are not
 * comparable on that point: an XML document is a tree whose whitespace carries
 * nothing, so a golden string there would fail on every reformat and pass on
 * every structural change — exactly backwards. mermaid is a LINE-oriented
 * language where the indentation, the argument order and the position of every
 * `Rel` are the format, and where the only oracle that matters is whether
 * mermaid.live draws the picture. A golden document is therefore the honest
 * assertion here: it is what a reviewer pastes into the renderer.
 */

/* ── Stubs ────────────────────────────────────────────────────────────── */

type Box = [number, number, number, number];

function fakeBoard(id: string, bound: Box, name?: string) {
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

function fakeBoundary(
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

function fakeNode(
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

function fakeConnector(
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

const surface = (partial: Partial<C4ExportBoard>): C4ExportBoard => ({
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
function composedBoard(): C4ExportBoard {
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

/** The document the fixture above must serialize to, byte for byte. */
const COMPOSED = `C4Component
  title Internet banking
  Person(customer, "Customer", "A customer of the bank.")
  Person_Ext(external_auditor, "External auditor")
  System(internet_banking_system, "Internet Banking System")
  System_Ext(mainframe_banking_system, "Mainframe Banking System")
  System_Boundary(internet_banking_system_2, "Internet banking system") {
    Container(web_application, "Web Application", "Java and Spring MVC", "Delivers the static content and the banking SPA.")
    Container(single_page_app, "Single-Page App", "web browser")
    Container(mobile_app, "Mobile App", "mobile app")
    ContainerDb(database, "Database", "", "Stores user registration information.")
    Container_Boundary(api_application, "API application") {
      Component(sign_in_controller, "Sign In Controller")
      Component(security_component, "Security Component")
    }
  }
  Rel(customer, single_page_app, "Uses")
  Rel(single_page_app, sign_in_controller, "Makes API calls to")
  Rel(web_application, database, "Reads from and writes to")
`;

describe('a whole C4 board, as mermaid', () => {
  const source = exportC4Mermaid(composedBoard());

  it('serializes to exactly the document a reader pastes into mermaid', () => {
    expect(source).toBe(COMPOSED);
  });

  it('says nothing the author did not declare', () => {
    // The neutral connector, the shape with no role, and the element on another
    // sheet. Each is on the canvas; none of them is a C4 statement.
    expect(source).not.toContain('Looks like a system');
    expect(source).not.toContain('Somewhere else');
    expect(source).not.toContain('Also uses');
    expect(source).not.toContain('Wonders about');
    expect(source).not.toContain('Trusts');
    // Three relationships drawn, three written: the other four are dropped
    // rather than rewritten into something mermaid could hold.
    expect(source.match(/^ {2}Rel\(/gm)).toHaveLength(3);
  });

  it('nests the boundaries the way they are drawn', () => {
    // The container boundary is inside the system boundary on the canvas, so it
    // is inside it here — attributed by the centre against the SMALLEST plot
    // that holds it, which is the rule every framework in this library shares.
    const lines = source.split('\n');
    const outer = lines.findIndex(line => line.includes('System_Boundary('));
    const inner = lines.findIndex(line => line.includes('Container_Boundary('));
    expect(outer).toBeGreaterThan(-1);
    expect(inner).toBeGreaterThan(outer);
    expect(lines[inner].startsWith('    ')).toBe(true);
    expect(lines[inner + 1]).toBe(
      '      Component(sign_in_controller, "Sign In Controller")'
    );
  });

  it('writes every relationship after every element', () => {
    const firstRel = source.indexOf('  Rel(');
    const lastElement = source.lastIndexOf('Component(');
    expect(firstRel).toBeGreaterThan(lastElement);
  });
});

/* ── Technology and description ───────────────────────────────────────── */

/**
 * The two optional fields, and mermaid's POSITIONAL argument lists.
 *
 * The whole risk here is one thing: a later argument written without the
 * earlier one. `Container(alias, label, techn, descr)` read with a description
 * in the third slot renders that sentence as the technology — a wrong statement
 * in a file somebody is about to paste into a renderer, and one nothing
 * downstream can detect.
 */
describe('what a node says about itself', () => {
  const oneNode = (
    kind: C4NodeKind,
    options: { technology?: string; description?: string }
  ) =>
    exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'B')],
        nodes: [
          fakeNode('n', kind, [700, 400, 60, 60], { text: 'X', ...options }),
        ],
      })
    );

  it('writes neither when the author stated neither', () => {
    expect(oneNode('container', {})).toContain('Container(x, "X")\n');
    expect(oneNode('system', {})).toContain('System(x, "X")\n');
    expect(oneNode('person', {})).toContain('Person(x, "X")\n');
  });

  it('writes the technology in the slot the macro has for it', () => {
    expect(oneNode('container', { technology: 'Java' })).toContain(
      'Container(x, "X", "Java")'
    );
    expect(oneNode('component', { technology: 'Spring MVC' })).toContain(
      'Component(x, "X", "Spring MVC")'
    );
    expect(oneNode('database', { technology: 'PostgreSQL' })).toContain(
      'ContainerDb(x, "X", "PostgreSQL")'
    );
  });

  it('holds the technology slot open when only a description was stated', () => {
    // The empty `""` is the point: without it the sentence would be read as the
    // technology by mermaid's own grammar.
    expect(oneNode('container', { description: 'Does things.' })).toContain(
      'Container(x, "X", "", "Does things.")'
    );
  });

  it('puts a description third on the macros that have no technology', () => {
    // `Person` and `System` take `descr` in the third slot — there is no `techn`
    // to hold open, and an empty one would BE the description.
    expect(oneNode('person', { description: 'A customer.' })).toContain(
      'Person(x, "X", "A customer.")'
    );
    expect(
      oneNode('system-ext', { description: 'Somebody else’s.' })
    ).toContain('System_Ext(x, "X", "Somebody else’s.")');
    // …and a technology typed on one of them is drawn on the canvas and simply
    // has nowhere to go here. Documented rather than invented a slot for.
    expect(oneNode('person', { technology: 'ignored' })).toContain(
      'Person(x, "X")\n'
    );
  });

  it('lets the author’s technology win over the picture’s default', () => {
    // `mobile` and `browser` carry a default `techn` because their picture means
    // something the macro cannot otherwise say. An author who typed "Flutter"
    // has said it better.
    expect(oneNode('mobile', {})).toContain('Container(x, "X", "mobile app")');
    expect(oneNode('mobile', { technology: 'Flutter' })).toContain(
      'Container(x, "X", "Flutter")'
    );
    expect(oneNode('browser', { technology: 'React' })).toContain(
      'Container(x, "X", "React")'
    );
  });

  it('sanitizes both fields exactly as it sanitizes a label', () => {
    // A quote ENDS a quoted argument in this grammar, `%%` opens a comment
    // wherever it appears, and a macro call is one line.
    const source = oneNode('container', {
      technology: 'a "quoted"\ntechnology',
      description: 'a %%commented%% one\ttoo',
    });
    expect(source).toContain(
      `Container(x, "X", "a 'quoted' technology", "a %commented% one too")`
    );
    expect(
      source.split('\n').filter(line => line.includes('Container('))
    ).toHaveLength(1);
  });
});

/* ── The kind table ───────────────────────────────────────────────────── */

describe('the kind → macro table', () => {
  it('gives every kind the pack draws a macro to be written as', () => {
    // Total by its type, so this only fails if a kind is added to the MODEL
    // without one — which is the build failure this table exists to be.
    for (const [kind, mapping] of Object.entries(C4_MERMAID_OF_KIND)) {
      expect(mapping.macro, kind).toBeTruthy();
      expect(mapping.level, kind).toBeTruthy();
    }
  });

  it('writes the two picture containers as containers with a technology', () => {
    // Neither is a level of its own: a phone app and a single-page app are
    // containers, and what the picture MEANT goes in mermaid's `techn` slot.
    expect(C4_MERMAID_OF_KIND.mobile).toEqual({
      macro: 'Container',
      techn: 'mobile app',
      level: 'container',
    });
    expect(C4_MERMAID_OF_KIND.browser).toEqual({
      macro: 'Container',
      techn: 'web browser',
      level: 'container',
    });
  });

  it('keeps the two external variants at the level of their own kind', () => {
    // Grey means "somebody else owns this", not "a different sort of thing", so
    // an external system must never push a context diagram to a container one.
    expect(C4_MERMAID_OF_KIND['person-ext'].level).toBe('context');
    expect(C4_MERMAID_OF_KIND['system-ext'].level).toBe('context');
  });
});

/* ── Diagram type inference ───────────────────────────────────────────── */

describe('the diagram type', () => {
  const withKinds = (...kinds: C4NodeKind[]) =>
    exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'Level')],
        nodes: kinds.map((kind, index) =>
          fakeNode(`n-${index}`, kind, [200 + index * 100, 400, 60, 60], {
            text: `E${index}`,
          })
        ),
      })
    ).split('\n')[0];

  it('is a context diagram when only people and systems are drawn', () => {
    expect(withKinds('person', 'system', 'system-ext')).toBe('C4Context');
  });

  it('is a container diagram as soon as one container-level box appears', () => {
    expect(withKinds('person', 'container')).toBe('C4Container');
    expect(withKinds('person', 'database')).toBe('C4Container');
    expect(withKinds('person', 'mobile')).toBe('C4Container');
    expect(withKinds('person', 'browser')).toBe('C4Container');
  });

  it('is a component diagram as soon as one component appears', () => {
    // The DEEPEST level wins: a component drawn beside a person is still a
    // component diagram, whatever else is on the sheet.
    expect(withKinds('person', 'container', 'component')).toBe('C4Component');
    expect(withKinds('component')).toBe('C4Component');
  });

  it('is a context diagram when nothing is drawn at all', () => {
    expect(withKinds()).toBe('C4Context');
  });
});

/* ── Text ─────────────────────────────────────────────────────────────── */

describe('what a label survives', () => {
  it('joins a multi-line label into one line', () => {
    expect(toMermaidText('Internet\nBanking\r\nSystem')).toBe(
      'Internet Banking System'
    );
  });

  it('turns a double quote into an apostrophe', () => {
    // The C4 grammar has no escape for it: the first `"` ENDS the argument, and
    // everything after it is read as syntax.
    expect(toMermaidText('The "core" system')).toBe("The 'core' system");
  });

  it('collapses a run of percent signs, which would open a comment', () => {
    expect(toMermaidText('99%% uptime')).toBe('99% uptime');
    expect(toMermaidText('a %%%% b')).toBe('a % b');
    // One is not a comment and is left alone.
    expect(toMermaidText('99% uptime')).toBe('99% uptime');
  });

  it('leaves accents, CJK and emoji exactly as they were written', () => {
    expect(toMermaidText('Système de paiement 決済 💳')).toBe(
      'Système de paiement 決済 💳'
    );
  });

  it('carries a quoted, multi-line name through a whole document', () => {
    const source = exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'Ledger "v2"\nrewrite')],
        nodes: [
          fakeNode('n', 'system', [600, 400, 60, 60], {
            text: 'The "core"\nledger',
          }),
        ],
      })
    );
    expect(source).toBe(
      `C4Context
  title Ledger 'v2' rewrite
  System(the_core_ledger, "The 'core' ledger")
`
    );
  });

  it('names an unnamed thing "?" rather than pretending it has one', () => {
    const source = exportC4Mermaid(
      surface({
        // A board with no title gets no `title` line at all: an empty one
        // renders as a blank heading.
        boards: [fakeBoard('b', [0, 0, 1400, 900], '   ')],
        nodes: [fakeNode('n', 'system', [600, 400, 60, 60], { text: '  ' })],
        boundaries: [fakeBoundary('bd', [200, 200, 400, 300])],
        connectors: [
          fakeConnector('c', C4_ROLE.relationship, {
            source: 'n',
            target: 'n',
          }),
        ],
      })
    );
    expect(source).toBe(
      `C4Context
  System(e, "?")
  System_Boundary(e_2, "?") {
  }
  Rel(e, e, "?")
`
    );
  });
});

/* ── Aliases ──────────────────────────────────────────────────────────── */

describe('the alias a name is written as', () => {
  it('folds a name to a bare lowercase identifier', () => {
    expect(toMermaidAlias('Internet Banking System')).toBe(
      'internet_banking_system'
    );
    expect(toMermaidAlias('Single-Page App')).toBe('single_page_app');
    // Runs collapse and the edges are trimmed, so punctuation does not leave a
    // trail of underscores behind it.
    expect(toMermaidAlias('  E-mail // system!  ')).toBe('e_mail_system');
  });

  it('never opens on a digit', () => {
    // A bare identifier that starts with one is a lexer error.
    expect(toMermaidAlias('3rd party')).toBe('e_3rd_party');
    expect(toMermaidAlias('2FA')).toBe('e_2fa');
  });

  it('folds a non-ASCII name rather than emitting an identifier mermaid cannot read', () => {
    // Lossy on purpose, and the reason the minter exists: the LABEL keeps the
    // accents, the alias is a bare word.
    expect(toMermaidAlias('Système de paiement')).toBe('syst_me_de_paiement');
    expect(toMermaidAlias('決済')).toBe('e');
  });

  it('deduplicates identical names with a counting suffix', () => {
    const source = exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'Duplicates')],
        nodes: [
          fakeNode('n1', 'system', [200, 400, 60, 60], { text: 'Billing' }),
          fakeNode('n2', 'system', [400, 400, 60, 60], { text: 'billing' }),
          fakeNode('n3', 'system', [600, 400, 60, 60], { text: 'BILLING!' }),
        ],
        connectors: [
          fakeConnector(
            'c',
            C4_ROLE.relationship,
            { source: 'n1', target: 'n3' },
            'Replaces'
          ),
        ],
      })
    );
    expect(source).toBe(
      `C4Context
  title Duplicates
  System(billing, "Billing")
  System(billing_2, "billing")
  System(billing_3, "BILLING!")
  Rel(billing, billing_3, "Replaces")
`
    );
  });
});

/* ── Several boards ───────────────────────────────────────────────────── */

describe('several boards at once', () => {
  const twoBoards = () =>
    surface({
      boards: [
        fakeBoard('b1', [0, 0, 1400, 900], 'Context'),
        fakeBoard('b2', [2000, 0, 1400, 900], 'Containers'),
      ],
      nodes: [
        fakeNode('n1', 'person', [600, 400, 60, 60], { text: 'Customer' }),
        fakeNode('n2', 'container', [2600, 400, 60, 60], { text: 'Customer' }),
      ],
      connectors: [
        // Across two boards: two diagrams, and a line between them is a
        // sentence neither of them can hold.
        fakeConnector(
          'c',
          C4_ROLE.relationship,
          { source: 'n1', target: 'n2' },
          'Uses'
        ),
      ],
    });

  it('writes one complete document per board, each announced', () => {
    // mermaid renders ONE diagram per document, so the alternative is a file no
    // renderer accepts. Each is complete on its own — note that both boards mint
    // `customer`, because a document is where an alias means something.
    expect(exportC4Mermaid(twoBoards())).toBe(
      `%% ── Context
C4Context
  title Context
  Person(customer, "Customer")

%% ── Containers
C4Container
  title Containers
  Container(customer, "Customer")
`
    );
  });

  it('leaves the signpost off a single document', () => {
    const one = surface({
      boards: [fakeBoard('b', [0, 0, 1400, 900], 'Context')],
      nodes: [
        fakeNode('n', 'person', [600, 400, 60, 60], { text: 'Customer' }),
      ],
    });
    expect(exportC4Mermaid(one)).not.toContain('%%');
  });
});

describe('a selection holding no board', () => {
  it('is the smallest valid document, which says nothing', () => {
    // Not an error and not an empty string: a selection nobody made a statement
    // with still has to serialize to something a renderer accepts.
    expect(exportC4Mermaid(surface({}))).toBe('C4Context\n');
  });
});

/* ── The command ──────────────────────────────────────────────────────── */

/**
 * A `std` holding just enough for the export guard: a selection, and an empty
 * answer for every optional service — a command registry it does not have, a
 * translation catalogue it does not have.
 */
function fakeStd(selected: unknown[], options: { readonly?: boolean } = {}) {
  const gfx = { selection: { selectedElements: selected } };
  return {
    store: {
      readonly: options.readonly === true,
      id: 'doc-1',
      workspace: { meta: { getDocMeta: () => undefined } },
    },
    get: () => gfx,
    getOptional: () => undefined,
    provider: { getAll: () => new Map() },
  } as unknown as BlockStdScope;
}

describe('the export command', () => {
  const descriptor = c4Commands.find(c => c.id === 'c4.exportMermaid');

  it('declares itself as a selection-scoped action on the board', () => {
    expect(descriptor).toBeDefined();
    expect(descriptor!.kind).toBe('action');
    expect(descriptor!.owner).toBe('c4');
    expect(descriptor!.scope).toBe('edgeless');
    expect(descriptor!.category).toBe('diagrams');
    expect(descriptor!.availability).toBe('selection');
    expect(descriptor!.iconKey).toBe('c4.export-mermaid');
    expect(descriptor!.telemetry).toEqual({
      framework: 'c4',
      element: 'board:export-mermaid',
    });
  });

  it('stays out of the senior sub-menu and lives in the "⋮"', () => {
    // It draws nothing, so it is not what the sub-menu is for; it stays in the
    // catalogue because the catalogue is the TOTAL surface (`registry.unit`).
    expect(descriptor!.surfaces).not.toContain('senior-menu');
    expect(descriptor!.surfaces).toEqual([
      'catalogue',
      'contextual-toolbar',
      'palette',
      'agent',
    ]);
  });

  it('offers itself when a board is selected, and only then', () => {
    expect(descriptor!.when?.(fakeStd([]))).toBe(false);
    expect(
      descriptor!.when?.(
        fakeStd([fakeNode('n', 'system', [0, 0, 60, 60], { text: 'S' })])
      )
    ).toBe(false);
    expect(
      descriptor!.when?.(fakeStd([fakeBoard('b', [0, 0, 1400, 900], 'B')]))
    ).toBe(true);
  });

  it('is offered on a READ-ONLY document, where the legend is not', () => {
    // The whole reason `c4BoardsForExport` exists beside `c4BoardsSelected`: an
    // export reads, and a diagram published read-only is precisely the board
    // somebody wants to take away.
    const std = fakeStd([fakeBoard('b', [0, 0, 1400, 900], 'B')], {
      readonly: true,
    });
    expect(descriptor!.when?.(std)).toBe(true);
    // The legend is a toolbar BUTTON rather than a command since the PO's
    // arbitration of 27/08/2026, so the contrast is asserted on the selector it
    // still runs through: `c4BoardsSelected` refuses the read-only document that
    // `c4BoardsForExport` accepts, on the very same selection.
    expect(c4BoardsForExport(std)).toHaveLength(1);
    expect(c4BoardsSelected(std)).toHaveLength(0);
  });

  it('sits in the board toolbar’s "⋮" and invokes the command by id', () => {
    // Not a primary button: it is the rarest thing anybody does to a board, and
    // `ActionPlacement.More` is the single flag `renderToolbar` partitions the
    // row on. Typed as a generator entry, which is what it declares itself to
    // be: the config's `actions` is a heterogeneous tuple, and the narrowing a
    // `find` gives back is the union of everything on the row.
    const entry = c4BoardToolbarConfig.actions.find(
      action => action.id === 'z.export-mermaid'
    ) as unknown as ToolbarActionGenerator | undefined;
    expect(entry).toBeDefined();
    expect(entry!.placement).toBe(ActionPlacement.More);

    // A menu line is drawn from `label`, not from a tooltip: the "⋮" is already
    // words, and a tooltip repeating them would be the same sentence twice.
    const std = fakeStd([fakeBoard('b', [0, 0, 1400, 900], 'B')]);
    const generated = entry!.generate({ std } as never) as unknown as {
      label: string;
      tooltip?: string;
    };
    expect(generated.label).toBe('Export as mermaid');
    expect(generated.tooltip).toBeUndefined();
  });
});

describe('what the file is called', () => {
  const named = (title: string | undefined, board?: string) =>
    c4ExportFilename({
      store: {
        readonly: false,
        id: 'doc-1',
        workspace: { meta: { getDocMeta: () => ({ title }) } },
      },
      get: () => ({
        selection: {
          selectedElements: [fakeBoard('b', [0, 0, 1400, 900], board)],
        },
      }),
    } as unknown as BlockStdScope);

  it('prefers the document title, then the board, then a last resort', () => {
    expect(named('Order to cash')).toBe('Order to cash');
    expect(named(undefined, 'Context')).toBe('Context');
    expect(named(undefined, undefined)).toBe('diagram');
  });

  it('replaces what a file system reserves', () => {
    expect(named('Billing: v2 / draft?')).toBe('Billing- v2 - draft-');
  });

  it('trims the trailing dot Windows would eat the extension for', () => {
    // `.mmd` is how a file arrives called `Context.mmd`… or `Context`,
    // depending on who is doing the stripping.
    expect(named('Context.')).toBe('Context');
    expect(named('...')).toBe('diagram');
  });
});
