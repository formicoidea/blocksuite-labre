import { type C4NodeKind } from '@labre/affine-model';
import {
  ActionPlacement,
  type ToolbarActionGenerator,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import {
  c4BoardsForExport,
  c4BoardsSelected,
  c4ExportFilename,
} from '../actions';
import { c4Commands } from '../commands';
import type { C4ComponentGroup } from '../component';
import { DESCRIPTION_PLACEHOLDER, NODE_LABEL } from '../consts';
import {
  C4_MERMAID_OF_KIND,
  exportC4Mermaid,
  toMermaidAlias,
  toMermaidText,
} from '../export';
import { C4_ROLE } from '../roles';
import { c4BoardToolbarConfig } from '../toolbar/config';
import { C4_TYPE_PLACEHOLDER, C4_TYPE_WORD } from '../type-line';
import {
  Components,
  composedBoard,
  fakeBoard,
  fakeBoundary,
  fakeConnector,
  fakeNode,
  surface,
} from './board-stub';

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
 *
 * The fixtures themselves live in `./board-stub`, shared with the interchange
 * spec so that the declared capability and the command are handed the same
 * board rather than two copies of it that drift.
 */

/** The document `composedBoard()` must serialize to, byte for byte. */
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
  /**
   * One component, and what it serializes to.
   *
   * `technology` is written the way an author writes it — INTO the type line —
   * so the fixture states the line and the exporter is left to read the one half
   * of it that is the author's. Passing nothing at all builds a bare node with
   * no words under it, which is what an ungrouped element resolves to.
   */
  const oneNode = (
    kind: C4NodeKind,
    tiers: { typeLine?: string; description?: string } = {}
  ) => {
    const components = new Components();
    const node = fakeNode('n', kind, [700, 400, 60, 60], { text: 'X' });
    const nodes = [
      Object.keys(tiers).length > 0 ? components.with(node, tiers) : node,
    ];
    return exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'B')],
        nodes,
        texts: components.texts,
        groups: components.groups,
      })
    );
  };

  /** The same, with the technology stated rather than the whole line. */
  const withTechnology = (kind: C4NodeKind, technology: string) =>
    oneNode(kind, { typeLine: `[${C4_TYPE_WORD[kind]}: ${technology}]` });

  it('writes neither when the component has no words under it at all', () => {
    // The bare-node fallback: no group, no tiers, nothing stated. Which is also
    // what a released group and a deleted tier resolve to.
    expect(oneNode('container')).toContain('Container(x, "X")\n');
    expect(oneNode('system')).toContain('System(x, "X")\n');
    expect(oneNode('person')).toContain('Person(x, "X")\n');
  });

  it('writes neither when both tiers are still the stencil’s prompts', () => {
    // Every tier exists from the moment a component is drawn, so an untouched
    // element carries a literal `[Container: technology]` and a literal
    // `description`. Exporting those as data would put the word "technology" in
    // the technology slot of a file somebody is about to paste into a renderer.
    const source = oneNode('container', {
      typeLine: C4_TYPE_PLACEHOLDER.container,
      description: DESCRIPTION_PLACEHOLDER,
    });
    expect(source).toContain('Container(x, "X")\n');
    expect(source).not.toContain('technology');
  });

  it('writes the technology in the slot the macro has for it', () => {
    expect(withTechnology('container', 'Java')).toContain(
      'Container(x, "X", "Java")'
    );
    expect(withTechnology('component', 'Spring MVC')).toContain(
      'Component(x, "X", "Spring MVC")'
    );
    expect(withTechnology('database', 'PostgreSQL')).toContain(
      'ContainerDb(x, "X", "PostgreSQL")'
    );
  });

  it('reads the technology out of whatever shape the line was left in', () => {
    // The author types on the picture, so the exporter meets every form the
    // in-place editor can leave behind — not a validated field.
    for (const line of [
      '[Container: Java]',
      'Container: Java',
      '  [container:   Java]  ',
      'Java',
    ]) {
      expect(oneNode('container', { typeLine: line }), line).toContain(
        'Container(x, "X", "Java")'
      );
    }
    // …and a line reduced to the bare notation word states no technology.
    expect(oneNode('container', { typeLine: '[Container]' })).toContain(
      'Container(x, "X")\n'
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
    expect(withTechnology('person', 'ignored')).toContain('Person(x, "X")\n');
  });

  it('lets the author’s technology win over the picture’s default', () => {
    // `mobile` and `browser` carry a default `techn` because their picture means
    // something the macro cannot otherwise say. An author who typed "Flutter"
    // has said it better.
    expect(oneNode('mobile')).toContain('Container(x, "X", "mobile app")');
    expect(withTechnology('mobile', 'Flutter')).toContain(
      'Container(x, "X", "Flutter")'
    );
    expect(withTechnology('browser', 'React')).toContain(
      'Container(x, "X", "React")'
    );
  });

  it('sanitizes both tiers exactly as it sanitizes a label', () => {
    // A quote ENDS a quoted argument in this grammar, `%%` opens a comment
    // wherever it appears, and a macro call is one line.
    const source = oneNode('container', {
      typeLine: 'a "quoted"\ntechnology stack',
      description: 'a %%commented%% one\ttoo',
    });
    expect(source).toContain(
      `Container(x, "X", "a 'quoted' technology stack", "a %commented% one too")`
    );
    expect(
      source.split('\n').filter(line => line.includes('Container('))
    ).toHaveLength(1);
  });
});

/* ── The name ─────────────────────────────────────────────────────────── */

/**
 * Where an element's NAME comes from, since the PO's follow-up moved it off the
 * shape and onto a `c4:title` child.
 *
 * Two paths, and the second is the whole compatibility story: the tier when
 * there is one, the shape's own inner text when there is not.
 */
describe('the name an element exports under', () => {
  const named = (
    tiers: { title?: string } | null,
    shapeText?: string
  ): string => {
    const components = new Components();
    const node = fakeNode('n', 'container', [700, 400, 60, 60], {
      text: shapeText,
    });
    return exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'B')],
        nodes: [tiers ? components.with(node, tiers) : node],
        texts: components.texts,
        groups: components.groups,
      })
    );
  };

  it('reads the title tier, in preference to anything on the shape', () => {
    expect(named({ title: 'Web Application' })).toContain(
      'Container(web_application, "Web Application")'
    );
    // A shape that still carries stale text loses to the tier that is drawn.
    expect(named({ title: 'Web Application' }, 'Old Name')).not.toContain(
      'Old Name'
    );
  });

  it('falls back to the shape’s own text for an element drawn before', () => {
    // No title child at all — an ungrouped element, or one from the iteration
    // where the name WAS the shape's inner text. Nothing is migrated for it.
    expect(named(null, 'Legacy System')).toContain(
      'Container(legacy_system, "Legacy System")'
    );
    // …and the same holds for a grouped element whose title was deleted.
    expect(named({}, 'Legacy System')).toContain(
      'Container(legacy_system, "Legacy System")'
    );
  });

  it('writes the creation prompt through verbatim, unlike the other tiers', () => {
    // An unnamed container IS a container, and `Container(x, "Container")` says
    // so. Suppressing it the way the technology prompt is suppressed would hand
    // the reader `?` instead — less information, not more honesty.
    expect(named({ title: NODE_LABEL.container })).toContain(
      'Container(container, "Container")'
    );
  });

  it('names a thing with no words anywhere "?" rather than pretending', () => {
    expect(named({ title: '   ' })).toContain('Container(e, "?")');
    expect(named(null)).toContain('Container(e, "?")');
  });
});

/* ── Which words belong to which box ──────────────────────────────────── */

/**
 * The resolution the whole arrangement rests on.
 *
 * Two containers side by side both have a `[Container: …]` under them, and only
 * the GROUP says which is which; a group holds a shape and two texts, and only
 * the ROLE says which text is the type line. Get either wrong and the export
 * silently attributes one architect's technology to another's box.
 */
describe('which words belong to which box', () => {
  const twoContainers = (build: (components: Components) => void) => {
    const components = new Components();
    const left = fakeNode('n-left', 'container', [300, 400, 80, 60], {
      text: 'Left',
    });
    const right = fakeNode('n-right', 'container', [600, 400, 80, 60], {
      text: 'Right',
    });
    build(components);
    return exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'B')],
        nodes: [left, right],
        texts: components.texts,
        groups: components.groups,
      })
    );
  };

  it('gives each node the words grouped with it, and no others', () => {
    const source = twoContainers(components => {
      components.texts.push(
        { id: 't-left', role: C4_ROLE['type-line'], text: '[Container: Java]' },
        { id: 't-right', role: C4_ROLE['type-line'], text: '[Container: Go]' }
      );
      components.groups.push(
        { id: 'g-left', childIds: ['n-left', 't-left'] },
        { id: 'g-right', childIds: ['n-right', 't-right'] }
      );
    });
    expect(source).toContain('Container(left, "Left", "Java")');
    expect(source).toContain('Container(right, "Right", "Go")');
  });

  it('tells the two tiers apart by their role, not by their order', () => {
    // The description is written into the group FIRST here. Position in
    // `children` is an implementation detail a reorder, a copy or a regroup
    // rewrites; the role is written on the element and travels with it.
    const source = twoContainers(components => {
      components.texts.push(
        { id: 't-descr', role: C4_ROLE.description, text: 'A sentence.' },
        { id: 't-type', role: C4_ROLE['type-line'], text: '[Container: Java]' }
      );
      components.groups.push({
        id: 'g-left',
        childIds: ['t-descr', 't-type', 'n-left'],
      });
    });
    expect(source).toContain('Container(left, "Left", "Java", "A sentence.")');
  });

  it('ignores a text in the group that carries no C4 role', () => {
    // A sticky note somebody grouped with the component. It is words on the
    // canvas; it is not a statement about the box (`docs/adr/0010`).
    const source = twoContainers(components => {
      components.texts.push({ id: 't-note', text: 'ask Marie about this' });
      components.groups.push({ id: 'g-left', childIds: ['n-left', 't-note'] });
    });
    expect(source).toContain('Container(left, "Left")\n');
    expect(source).not.toContain('Marie');
  });

  it('ignores a rightly-roled text that is grouped with nothing', () => {
    // The tier of a component whose group was released, left on bare canvas. It
    // is no longer under any box, so it is no longer about any box.
    const source = twoContainers(components => {
      components.texts.push({
        id: 't-orphan',
        role: C4_ROLE['type-line'],
        text: '[Container: Rust]',
      });
    });
    expect(source).toContain('Container(left, "Left")\n');
    expect(source).not.toContain('Rust');
  });

  it('exports a node whose group holds only the shape as a bare one', () => {
    // Both texts deleted, the group left standing. Nothing invented.
    const source = twoContainers(components => {
      components.groups.push({ id: 'g-left', childIds: ['n-left'] });
    });
    expect(source).toContain('Container(left, "Left")\n');
  });
});

/**
 * A relationship dropped on a COMPONENT rather than on its shape.
 *
 * A native group is `connectable`, and the connector tool walks every
 * connectable element whose bound holds the pointer — so an arrow dragged onto a
 * C4 component records the group's id about as often as the shape's. On the
 * canvas the two are indistinguishable (a component's group bound IS its shape's
 * bound), which is exactly what makes this dangerous: without the fallback below
 * every such relationship would vanish from the exported file, silently, because
 * a `Rel` is written by alias and a group has none.
 */
describe('a relationship that landed on the component', () => {
  const relate = (from: string, to: string, groups: C4ComponentGroup[]) => {
    const components = new Components();
    return exportC4Mermaid(
      surface({
        boards: [fakeBoard('b', [0, 0, 1400, 900], 'B')],
        nodes: [
          fakeNode('n-a', 'system', [300, 400, 60, 60], { text: 'Alpha' }),
          fakeNode('n-b', 'system', [600, 400, 60, 60], { text: 'Beta' }),
        ],
        connectors: [
          fakeConnector(
            'c',
            C4_ROLE.relationship,
            { source: from, target: to },
            'Uses'
          ),
        ],
        texts: components.texts,
        groups,
      })
    );
  };

  const components = [
    { id: 'g-a', childIds: ['n-a', 't-a'] },
    { id: 'g-b', childIds: ['n-b', 't-b'] },
  ];

  it('is written against the shape the group speaks for', () => {
    expect(relate('g-a', 'g-b', components)).toContain(
      'Rel(alpha, beta, "Uses")'
    );
    // …and mixing the two ends is the common case, an author having hit the
    // shape on one and the component on the other.
    expect(relate('n-a', 'g-b', components)).toContain(
      'Rel(alpha, beta, "Uses")'
    );
  });

  it('is written against the shape when it landed on one of the words', () => {
    // A canvas text is connectable too, and the tiers cover the middle band of
    // the box — so an arrow released over the type line records ITS id. Every
    // part of a component answers for its shape.
    expect(relate('t-a', 't-b', components)).toContain(
      'Rel(alpha, beta, "Uses")'
    );
  });

  it('is dropped when the group holds two components, which name neither', () => {
    // A lasso somebody drew round two boxes. An arrow landing on it points at
    // neither in particular, and guessing would put a sentence in the file that
    // nobody drew.
    const lasso = [{ id: 'g-both', childIds: ['n-a', 'n-b'] }];
    expect(relate('g-both', 'n-b', lasso)).not.toContain('Rel(');
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
