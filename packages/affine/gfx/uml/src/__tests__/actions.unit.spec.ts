import {
  ConnectorMode,
  FontWeight,
  PointStyle,
  StrokeStyle,
  TextAlign,
  UmlDiagramElementModel,
  type UmlNodeKind,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { TranslationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  activateUmlEdge,
  createUmlClassifier,
  createUmlDiagram,
  createUmlLegend,
  createUmlNode,
  createUmlPartition,
  createUmlRegion,
  createUmlSubject,
  type UmlClassifierKind,
  type UmlEdgeRole,
  type UmlGlyphKind,
  umlDiagramsForExport,
  umlDiagramsSelected,
  umlExportElementsOf,
  umlExportFilename,
} from '../actions.js';
import {
  UML_DIAGRAM_BOX,
  UML_EDGE_WIDTH,
  UML_NODE_BOX,
  UML_PARTITION_BOX,
  UML_REGION_BOX,
  UML_SUBJECT_BOX,
} from '../consts.js';
import { umlCompartmentBoxes } from '../component.js';
import { umlSafeFilename } from '../filename.js';
import {
  UML_ATTRIBUTES_SEED,
  UML_ATTRIBUTES_SEED_KEY,
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_OPERATIONS_SEED_KEY,
  UML_SLOTS_SEED,
  UML_SLOTS_SEED_KEY,
  UML_UNLABELLED_KINDS,
  umlSeedKey,
} from '../keywords.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

/* ── The stubs ─────────────────────────────────────────────────────────── */

/**
 * A stub editor that records every element an action asks the surface for, in
 * the order it asked.
 *
 * Minimal on purpose: what these actions actually DO is call `addElement` a
 * handful of times and then select something, and a fixture with a real
 * surface behind it would test Yjs rather than the notation.
 *
 * `getOptional` returns nothing unless a catalogue is handed in, which is the
 * case worth stubbing: every seed goes through the translation seam, and with
 * no host catalogue registered it must fall back to the English the pack always
 * carried.
 */
function recorder(t?: (key: string) => string | undefined) {
  const added: Record<string, unknown>[] = [];
  let selected: string[] = [];
  let tool: unknown = null;

  const gfx = {
    surface: {
      addElement: (next: Record<string, unknown>) => {
        added.push(next);
        return `element-${added.length}`;
      },
      elementModels: [] as unknown[],
    },
    viewport: { centerX: 0, centerY: 0 },
    layer: { generateIndex: () => 'a0' },
    doc: { captureSync: () => {} },
    tool: {
      setTool: (next: unknown) => {
        tool = next;
      },
    },
    selection: {
      set: (next: { elements: string[] }) => {
        selected = next.elements;
      },
      selectedElements: [] as unknown[],
    },
  };

  const std = {
    get: () => gfx,
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  } as unknown as BlockStdScope;

  return {
    std,
    added,
    types: () => added.map(props => props.type),
    roles: () => added.map(props => props.role),
    selected: () => selected,
    tool: () => tool,
  };
}

/**
 * The stub for the one family of actions that arms a tool instead of dropping a
 * shape.
 *
 * The `EditPropsStore` is a TRAP rather than a recorder: an activation that
 * reached `recordLastProps('connector', …)` would dress the next PLAIN
 * connector as a UML relationship (#144 M1). The stencil's look must ride on
 * the activation and nowhere else.
 */
function armed(role: UmlEdgeRole) {
  let options: Record<string, unknown> = {};

  const editProps = {
    recordLastProps: () => {
      throw new Error(
        'a framework activation must never record the connector last props (#144 M1)'
      );
    },
  };
  const gfx = {
    tool: {
      setTool: (_tool: unknown, next: Record<string, unknown>) => {
        options = next;
      },
    },
  };
  const std = {
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : editProps,
  } as unknown as BlockStdScope;

  activateUmlEdge(std, role);
  return {
    options,
    style: (options.style ?? {}) as Record<string, unknown>,
  };
}

const CLASSIFIERS: UmlClassifierKind[] = [
  'class',
  'interface',
  'enumeration',
  'object',
  // Phase 2: §11.6.4 and §19.3.4 draw both as the classifier rectangle…
  'component',
  'artifact',
  // …and §14.2.4 draws a STATE as that same divided box with rounded corners:
  // a name compartment ruled off over its internal activities. The one
  // behaviour kind that is not a picture.
  'state',
];
const GLYPHS: UmlGlyphKind[] = [
  'package',
  'note',
  'actor',
  'use-case',
  // Phase 2: the square on a border, the ball, the socket and the three cubes.
  'port',
  'provided-interface',
  'required-interface',
  'node',
  'device',
  'execution-environment',
  // Phase 2, behaviour: the activity vocabulary (§15.2.4, §15.3.4, §15.4.4,
  // §16.3.4, §16.10.4)…
  'action',
  'initial',
  'activity-final',
  'flow-final',
  'decision',
  'fork',
  'object-node',
  'send-signal',
  'accept-event',
  'time-event',
  // …and the state machine's marks (§14.2.4). The STATE itself is a divided
  // box and lives with the classifiers above.
  'final-state',
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  // Phase 3, the sequence vocabulary (§17.2.4). All three are pictures: a head
  // over a dashed spine, a thin bar sat on one, and the cross that ends one.
  // Not a compartment between them — and the last two carry no word either,
  // which {@link UML_UNLABELLED_KINDS} says and this list does not restate.
  'lifeline',
  'execution',
  'destruction',
];
const ALL_KINDS = [...CLASSIFIERS, ...GLYPHS] as UmlNodeKind[];

/**
 * The pictures the notation draws with NO word on them — derived, never
 * restated, so a kind added to {@link UML_UNLABELLED_KINDS} is covered here on
 * the day it lands rather than on the day somebody notices.
 */
const UNLABELLED = GLYPHS.filter(kind => UML_UNLABELLED_KINDS.has(kind));
const LABELLED_GLYPHS = GLYPHS.filter(kind => !UML_UNLABELLED_KINDS.has(kind));

/** Whichever of the two creation paths this kind travels. */
const create = (std: BlockStdScope, kind: UmlNodeKind) => {
  if ((CLASSIFIERS as UmlNodeKind[]).includes(kind)) {
    createUmlClassifier(std, kind as UmlClassifierKind);
  } else {
    createUmlNode(std, kind as UmlGlyphKind);
  }
};

/**
 * The two unions above are the WHOLE pack, and this is what says so.
 *
 * Derived against `UML_NODE_BOX`, which is total over `UmlNodeKind` by its type:
 * a kind added to the model without a creation path lands here rather than in a
 * reviewer's diff, which is what the append-only phases of ADR 0017 need.
 */
describe('the two creation paths cover the notation', () => {
  it('partitions every node kind into a box or a picture, once', () => {
    expect([...ALL_KINDS].sort()).toEqual(
      (Object.keys(UML_NODE_BOX) as UmlNodeKind[]).sort()
    );
    expect(new Set(ALL_KINDS).size).toBe(ALL_KINDS.length);
  });
});

/** The box an action wrote, as numbers. */
const boxOf = (props: Record<string, unknown>) =>
  JSON.parse(props.xywh as string) as [number, number, number, number];

/* ── The sheet and the frame ───────────────────────────────────────────── */

describe('the diagram frame and the subject', () => {
  it('creates a frame with its role, its kind and its default name', () => {
    const rec = recorder();
    createUmlDiagram(rec.std);
    expect(rec.added).toHaveLength(1);
    expect(rec.added[0]).toMatchObject({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      // Annex A's heading is `<kind> <name>`, so a frame with no kind has
      // nothing to write in its tag: `class` is the default, never absent.
      kind: 'class',
      name: 'Diagram',
    });
    expect(boxOf(rec.added[0])).toEqual([
      -UML_DIAGRAM_BOX.w / 2,
      -UML_DIAGRAM_BOX.h / 2,
      UML_DIAGRAM_BOX.w,
      UML_DIAGRAM_BOX.h,
    ]);
    expect(rec.selected()).toEqual(['element-1']);
  });

  it('writes whichever of the diagram kinds the caller asked for', () => {
    for (const kind of [
      'class',
      'pkg',
      'obj',
      'uc',
      'cmp',
      'dep',
      // Phase 2's behaviour sheets.
      'act',
      'stm',
    ] as const) {
      const rec = recorder();
      createUmlDiagram(rec.std, kind);
      expect(rec.added[0].kind, kind).toBe(kind);
    }
  });

  it('creates a subject with its own role and no discriminant at all', () => {
    // §18.1.4 draws ONE rectangle with ONE name — unlike a C4 boundary there is
    // nothing here for a variant to discriminate.
    const rec = recorder();
    createUmlSubject(rec.std);
    expect(rec.added).toHaveLength(1);
    expect(rec.added[0]).toMatchObject({
      type: 'umlSubject',
      role: UML_ROLE.subject,
      name: 'Subject',
    });
    expect(rec.added[0]).not.toHaveProperty('kind');
    expect(rec.added[0]).not.toHaveProperty('variant');
    expect(boxOf(rec.added[0])[2]).toBe(UML_SUBJECT_BOX.w);
  });

  it('creates a partition without restating the orientation default', () => {
    // §15.6.4's swimlane. The model's own default is vertical — §15.6.4's
    // figures are columns, which is also how a left-to-right flow reads — and
    // the creation writes NO `orientation` at all: a site restating a default
    // is a second place for it to be changed, and the band's own toolbar is
    // where an author turns a column into a row.
    const rec = recorder();
    createUmlPartition(rec.std);
    expect(rec.added).toHaveLength(1);
    expect(rec.added[0]).toMatchObject({
      type: 'umlPartition',
      role: UML_ROLE.partition,
      name: 'Partition',
    });
    expect(rec.added[0]).not.toHaveProperty('orientation');
    expect(boxOf(rec.added[0])).toEqual([
      -UML_PARTITION_BOX.w / 2,
      -UML_PARTITION_BOX.h / 2,
      UML_PARTITION_BOX.w,
      UML_PARTITION_BOX.h,
    ]);
    expect(rec.selected()).toEqual(['element-1']);
  });

  it('creates a region — the composite state, as its container', () => {
    // §14.2.4. A composite state IS the region here; a state with two or more
    // ORTHOGONAL regions separated by dashed lines is a phase-3 refinement
    // rather than something this element can be stretched into.
    const rec = recorder();
    createUmlRegion(rec.std);
    expect(rec.added).toHaveLength(1);
    expect(rec.added[0]).toMatchObject({
      type: 'umlRegion',
      role: UML_ROLE.region,
      name: 'Region',
    });
    expect(boxOf(rec.added[0])[2]).toBe(UML_REGION_BOX.w);
  });
});

/* ── The artefacts ─────────────────────────────────────────────────────── */

describe('what a uml artefact is created as', () => {
  it('builds a classifier as shape, name, attributes, operations, group', () => {
    for (const kind of ['class', 'interface', 'enumeration'] as const) {
      const rec = recorder();
      createUmlClassifier(rec.std, kind);
      expect(rec.types(), kind).toEqual([
        'umlNode',
        'text',
        'text',
        'text',
        'group',
      ]);
      expect(rec.roles(), kind).toEqual([
        UML_ROLE_OF_KIND[kind],
        UML_ROLE.name,
        UML_ROLE.attributes,
        UML_ROLE.operations,
        // The group carries NO role: the rules, the facts and the export all
        // key on the shape, and the wrapper round a box is not a second box.
        undefined,
      ]);
    }
  });

  it('stops an object at its slots — an instance has no behaviour', () => {
    // §9.8.4. The second tier is stamped `uml:attributes` all the same: a slot
    // is what an attribute is worth on an instance, and a fifth role would make
    // every reader of the vocabulary handle two spellings of one idea.
    const rec = recorder();
    createUmlClassifier(rec.std, 'object');
    expect(rec.types()).toEqual(['umlNode', 'text', 'text', 'group']);
    expect(rec.roles()).toEqual([
      UML_ROLE_OF_KIND.object,
      UML_ROLE.name,
      UML_ROLE.attributes,
      undefined,
    ]);
    expect(rec.added[2].text).toBe(UML_SLOTS_SEED);
  });

  /**
   * The classifiers whose second tier is a BODY and whose third does not exist:
   * an instance's slots (§9.8.4), a component's parts (§11.6.4), an artifact's
   * contents (§19.3.4). Derived from the LAYOUT rather than restated, so this
   * file cannot disagree with `umlCompartmentBoxes` about how many tiers a kind
   * has — which is the one way the creation walk can be wrong.
   */
  const tiersOf = (kind: UmlNodeKind) =>
    umlCompartmentBoxes(kind, 0, 0, 200, 120);

  it('builds the two-tier classifiers as name over ONE body tier', () => {
    // §11.6.4 and §19.3.4: a component and an artifact are the object's layout
    // — a name compartment, one separator, and everything below it — with the
    // corner icon doing the work the keyword does elsewhere.
    for (const kind of ['component', 'artifact'] as const) {
      const rec = recorder();
      createUmlClassifier(rec.std, kind);
      expect(rec.types(), kind).toEqual(['umlNode', 'text', 'text', 'group']);
      expect(rec.roles(), kind).toEqual([
        UML_ROLE_OF_KIND[kind],
        UML_ROLE.name,
        UML_ROLE.attributes,
        undefined,
      ]);
    }
  });

  it('seeds every compartment with the stencil own prompt', () => {
    // …and the two exceptions to `+ attribute : Type` are the two the spec
    // writes differently: an instance gives its features VALUES (§9.8.4), and
    // a state's internal-activities tier is seeded EMPTY — `model.ts` treats
    // `entry / ` with nothing after it as no behaviour, so a prompt there would
    // read as content and export as nothing (§14.2.4.4).
    const body: Partial<Record<UmlClassifierKind, string>> = {
      object: UML_SLOTS_SEED,
      state: '',
    };
    for (const kind of CLASSIFIERS) {
      const rec = recorder();
      createUmlClassifier(rec.std, kind);
      expect(rec.added[1].text, kind).toBe(UML_NAME_SEED[kind]);
      expect(rec.added[2].text, kind).toBe(body[kind] ?? UML_ATTRIBUTES_SEED);
      if (tiersOf(kind).operations) {
        expect(rec.added[3].text, kind).toBe(UML_OPERATIONS_SEED);
      }
    }
  });

  it('builds a state as a NAME over the internal-activities tier', () => {
    // The blocker this pairs with: `component.ts` files `state` under
    // `COMPARTMENTED`/`ONE_SPLIT`, so the renderer rules the separator off
    // unconditionally, and `model.ts` reads `entry / …`, `do / …`, `exit / …`
    // from the `uml:attributes` tier. A state created with one tier would show
    // an empty ruled compartment for ever and could never export a behaviour.
    const rec = recorder();
    createUmlClassifier(rec.std, 'state');
    expect(rec.types()).toEqual(['umlNode', 'text', 'text', 'group']);
    expect(rec.roles()).toEqual([
      UML_ROLE_OF_KIND.state,
      UML_ROLE.name,
      UML_ROLE.attributes,
      undefined,
    ]);
    expect(rec.added[1].text).toBe(UML_NAME_SEED.state);
    expect(rec.added[2].text).toBe('');
    // The behaviour lines are read down their left edge, at body size, and they
    // wrap inside the box rather than running out over the canvas.
    expect(rec.added[2].textAlign).toBe(TextAlign.Left);
    expect(rec.added[2].hasMaxWidth).toBe(true);
    expect(rec.added[1].hasMaxWidth).toBe(true);
  });

  it('writes a tier for each compartment the LAYOUT declares, and no other', () => {
    // The whole of how the creation walk decides how many text elements to
    // write: it reads the boxes and writes one per box. A kind added to the
    // notation therefore arrives with the tiers its drawing has, without a line
    // changing in `actions.ts` — which is what made phase 2 free.
    for (const kind of CLASSIFIERS) {
      const boxes = tiersOf(kind);
      const expected =
        1 + (boxes.attributes ? 1 : 0) + (boxes.operations ? 1 : 0);
      const rec = recorder();
      createUmlClassifier(rec.std, kind);
      expect(
        rec.types().filter(type => type === 'text'),
        kind
      ).toHaveLength(expected);
    }
  });

  it('bolds and centres the name, and reads the features down the left', () => {
    // A compartment of attributes is a LIST of signatures, and a list is read
    // down its left edge: centring them would put the `+` of every line in a
    // different column and cost the reader UML's one visibility cue (§9.5.4).
    const rec = recorder();
    createUmlClassifier(rec.std, 'class');
    expect(rec.added[1].textAlign).toBe(TextAlign.Center);
    expect(rec.added[1].fontWeight).toBe(FontWeight.SemiBold);
    for (const tier of [rec.added[2], rec.added[3]]) {
      expect(tier.textAlign).toBe(TextAlign.Left);
      expect(tier.fontWeight).toBe(FontWeight.Regular);
    }
  });

  it('builds every LABELLED picture kind as shape, one label, group', () => {
    for (const kind of LABELLED_GLYPHS) {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      expect(rec.types(), kind).toEqual(['umlNode', 'text', 'group']);
      expect(rec.added[1].text, kind).toBe(UML_NAME_SEED[kind]);
    }
  });

  it('drops an unlabelled mark as the SHAPE, with no words and no group', () => {
    // §15.3.4 and §14.2.4 name none of the routing marks — an initial node has
    // no name, a fork has no name, a history mark is an `H` — so a stencil that
    // seeded one would be putting a word on the picture that the notation says
    // is not there, and the `label-presence` audits would be right to complain
    // about it forever. No text, and therefore no group: a group of one element
    // is a wrapper a user would have to descend through to reach the mark.
    expect(UNLABELLED.length).toBeGreaterThan(0);
    for (const kind of UNLABELLED) {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      expect(rec.types(), kind).toEqual(['umlNode']);
      expect(rec.added[0], kind).not.toHaveProperty('text');
      // The SHAPE is what the gesture produced, so the shape is what is
      // selected — there is nothing above it to select instead.
      expect(rec.selected(), kind).toEqual(['element-1']);
    }
  });

  it('calls a tier a NAME when a keyword may go on it, a LABEL otherwise', () => {
    // A package name is a namespace, a note's text is a comment body, and a
    // cube's line carries `«device»` / `«executionEnvironment»` over the name
    // (§19.4.4) — all three are parsed, and the morph's keyword rewrite reaches
    // `uml:name` and only that. A port's word, a ball's and a socket's are a
    // name and nothing else, written OUTSIDE the glyph, and never a keyword.
    const roleOf = (kind: UmlGlyphKind) => {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      return rec.added[1].role;
    };
    const named: UmlGlyphKind[] = [
      'package',
      'note',
      'node',
      'device',
      'execution-environment',
    ];
    // …and the LIFELINE is a third answer, not a second: §17.3.4 prints a BNF
    // for what goes in a head, so it carries `uml:lifeline-ident` and the two
    // rules written on that role reach no actor and no use case (`roles.ts`).
    for (const kind of LABELLED_GLYPHS) {
      expect(roleOf(kind), kind).toBe(
        named.includes(kind)
          ? UML_ROLE.name
          : kind === 'lifeline'
            ? UML_ROLE['lifeline-ident']
            : UML_ROLE.label
      );
    }
    // The activity vocabulary is LABELLED throughout — one word, never a
    // keyword, never a compartment. The STATE is deliberately absent: it is a
    // divided box and takes a `uml:name`, which the case above this one proves.
    for (const kind of ['action', 'object-node', 'send-signal'] as const) {
      expect(roleOf(kind), kind).toBe(UML_ROLE.label);
    }
  });

  it('puts a keyword only on tiers the morph can rewrite', () => {
    // The trap this pairs with: `afterMorph` rewrites `uml:name`, so a kind
    // seeded with a keyword line on a `uml:label` would morph into something
    // whose words never said what it had become. Asserted over the WHOLE pack,
    // because the next phase appends kinds to the same two unions.
    for (const kind of ALL_KINDS) {
      if (UML_UNLABELLED_KINDS.has(kind)) continue;
      const rec = recorder();
      create(rec.std, kind);
      const seeded = UML_NAME_SEED[kind].split('\n')[0];
      if (!seeded.startsWith('«')) continue;
      expect(rec.added[1].role, kind).toBe(UML_ROLE.name);
    }
  });

  it('reads a note left, because a note holds a sentence', () => {
    const alignOf = (kind: UmlGlyphKind) => {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      return rec.added[1].textAlign;
    };
    expect(alignOf('note')).toBe(TextAlign.Left);
    for (const kind of LABELLED_GLYPHS) {
      if (kind === 'note') continue;
      expect(alignOf(kind), kind).toBe(TextAlign.Center);
    }
  });

  it('drops a shape with no words in it, whatever the kind (R16)', () => {
    for (const kind of ALL_KINDS) {
      const rec = recorder();
      create(rec.std, kind);
      expect(rec.added[0], kind).not.toHaveProperty('text');
      // Anything written on the shape would be a second, invisible name.
      expect(rec.added[0].kind, kind).toBe(kind);
      expect(rec.added[0].role, kind).toBe(UML_ROLE_OF_KIND[kind]);
    }
  });

  it('carries the preset explicitly, never a last-props inheritance', () => {
    const rec = recorder();
    createUmlNode(rec.std, 'package');
    expect(rec.added[0]).toMatchObject({
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      fillColor: NOTATION_NEUTRALS.cardFill,
      strokeColor: NOTATION_NEUTRALS.ink,
    });
    const useCase = recorder();
    createUmlNode(useCase.std, 'use-case');
    expect(useCase.added[0]).toMatchObject({
      shapeType: 'ellipse',
      filled: true,
      strokeStyle: StrokeStyle.Solid,
    });
    // Every text wraps at its own width rather than running out over the
    // canvas, so a component always contains its own words.
    expect(rec.added[1].hasMaxWidth).toBe(true);
  });

  it('centres the artefact on the viewport, at its kind own footprint', () => {
    for (const kind of ALL_KINDS) {
      const rec = recorder();
      create(rec.std, kind);
      const { w, h } = UML_NODE_BOX[kind];
      expect(boxOf(rec.added[0]), kind).toEqual(
        JSON.parse(new Bound(-w / 2, -h / 2, w, h).serialize())
      );
    }
  });

  it('writes the group LAST, holding every element it just wrote', () => {
    // The elements are created in painting order — the shape first, the words
    // above it — and two elements sharing an index sort by id, which is a
    // nanoid. The group is written after them so its derived bounds cover them.
    for (const kind of ALL_KINDS) {
      // …except the marks that are ONE element: there is nothing to group.
      if (UML_UNLABELLED_KINDS.has(kind)) continue;
      const rec = recorder();
      create(rec.std, kind);
      const group = rec.added[rec.added.length - 1];
      expect(group.type, kind).toBe('group');
      expect(Object.keys(group.children as object).sort(), kind).toEqual(
        rec.added.slice(0, -1).map((_, index) => `element-${index + 1}`)
      );
      // The GROUP is what the gesture produced, so the group is what is
      // selected: one click selects the artefact, a double-click descends into
      // the compartment under the pointer.
      expect(rec.selected(), kind).toEqual([`element-${rec.added.length}`]);
      // No title: a class announcing itself as "Group 3" above its own name is
      // a label nobody wrote.
      expect(group, kind).not.toHaveProperty('title');
    }
  });

  it('does nothing at all without a surface', () => {
    const std = {
      get: () => ({ surface: null }),
      getOptional: () => undefined,
    } as unknown as BlockStdScope;
    expect(() => createUmlDiagram(std)).not.toThrow();
    expect(() => createUmlSubject(std)).not.toThrow();
    expect(() => createUmlPartition(std)).not.toThrow();
    expect(() => createUmlRegion(std)).not.toThrow();
    expect(() => createUmlClassifier(std, 'class')).not.toThrow();
    expect(() => createUmlNode(std, 'note')).not.toThrow();
    expect(() => createUmlNode(std, 'initial')).not.toThrow();
  });
});

/* ── The seeds, through the translation seam ───────────────────────────── */

/**
 * R30: text a gesture writes INTO THE DOCUMENT is asked of the host catalogue
 * BEFORE it lands, because it can never be translated afterwards — a class
 * dropped in a French editor that arrived called "Class" stays called that for
 * the life of the document.
 *
 * The frames above already crossed the seam; the artefacts themselves did not,
 * and that is what these two tests pin, one per side of the seam.
 */
describe('a placed artefact is seeded through the seam', () => {
  const shout = (key: string) => `[${key}]`.toUpperCase();

  it('resolves every tier through the host catalogue when there is one', () => {
    const rec = recorder(shout);
    createUmlClassifier(rec.std, 'class');
    expect(rec.added[1].text).toBe(shout(umlSeedKey('class')));
    expect(rec.added[2].text).toBe(shout(UML_ATTRIBUTES_SEED_KEY));
    expect(rec.added[3].text).toBe(shout(UML_OPERATIONS_SEED_KEY));

    // The one-tier artefacts travel the other creation path, and the two
    // exceptions to `+ attribute : Type` carry their own key or none at all.
    const glyph = recorder(shout);
    createUmlNode(glyph.std, 'package');
    expect(glyph.added[1].text).toBe(shout(umlSeedKey('package')));

    const object = recorder(shout);
    createUmlClassifier(object.std, 'object');
    expect(object.added[2].text).toBe(shout(UML_SLOTS_SEED_KEY));

    // A state's internal-activities tier is seeded EMPTY (§14.2.4.4), so it
    // asks for nothing: a key here would put a prompt where `model.ts` reads
    // "no behaviour".
    const state = recorder(shout);
    createUmlClassifier(state.std, 'state');
    expect(state.added[2].text).toBe('');
  });

  it('falls back to the very English it used to write, with no catalogue', () => {
    const rec = recorder();
    createUmlClassifier(rec.std, 'class');
    expect(rec.added[1].text).toBe(UML_NAME_SEED.class);
    expect(rec.added[2].text).toBe(UML_ATTRIBUTES_SEED);
    expect(rec.added[3].text).toBe(UML_OPERATIONS_SEED);

    const glyph = recorder();
    createUmlNode(glyph.std, 'package');
    expect(glyph.added[1].text).toBe(UML_NAME_SEED.package);
  });
});

/* ── The relationships ─────────────────────────────────────────────────── */

describe('what a uml relationship tool is armed with', () => {
  const ALL_EDGES: UmlEdgeRole[] = [
    'association',
    'aggregation',
    'composition',
    'generalization',
    'realization',
    'dependency',
    'anchor',
    'include',
    'extend',
    // Phase 2 — §19.2.4, §19.3.4, §19.4.4.
    'deploy',
    'manifest',
    'communication-path',
    // Phase 2, behaviour — §15.2.4 and §14.2.4.8.
    'control-flow',
    'object-flow',
    'transition',
  ];

  it('draws every UML line straight, in one ink, at one weight', () => {
    // UML tells its relationships apart by solid-versus-dashed and by what is
    // drawn on their ends. Never by colour — the spec has none — and never by
    // thickness. A class diagram is also a graph, not a process in lanes: the
    // elbows an orthogonal router adds would read as a route nobody drew.
    for (const role of ALL_EDGES) {
      const { options, style } = armed(role);
      expect(options.mode, role).toBe(ConnectorMode.Straight);
      // A TYPED edge (`docs/adr/0010`): the role is carried by the TOOL, so the
      // connector is born with it rather than acquiring one afterwards.
      expect(options.role, role).toBe(UML_ROLE[role]);
      expect(style.stroke, role).toBe(NOTATION_NEUTRALS.ink);
      expect(style.strokeWidth, role).toBe(UML_EDGE_WIDTH);
    }
  });

  it('puts the diamond on the WHOLE end, hollow then filled', () => {
    // §11.5.4 — shared aggregation is a hollow diamond, composition a filled
    // one, and both sit at the SOURCE end because the source of these roles is
    // the whole ("is composed of", `roles.ts`). The one everybody misdraws.
    expect(armed('aggregation').style).toMatchObject({
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.DiamondHollow,
      rearEndpointStyle: PointStyle.None,
    });
    expect(armed('composition').style).toMatchObject({
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.Diamond,
      rearEndpointStyle: PointStyle.None,
    });
  });

  it('points the hollow triangle at the general, solid then dashed', () => {
    // §9.2.4 and §10.4.4: a realization is the generalization arrow drawn on a
    // broken line, and that is the only thing that separates them.
    expect(armed('generalization').style).toMatchObject({
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.TriangleHollow,
    });
    expect(armed('realization').style).toMatchObject({
      strokeStyle: StrokeStyle.Dash,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.TriangleHollow,
    });
  });

  it('leaves an association and an anchor with no head at either end', () => {
    // Neither role declares a direction, so an arrowhead would be the picture
    // making a claim the vocabulary explicitly refuses to make.
    expect(armed('association').style).toMatchObject({
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
    });
    expect(armed('anchor').style).toMatchObject({
      strokeStyle: StrokeStyle.Dash,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
    });
  });

  it('draws every dependency alike, told apart by the role', () => {
    // §7.8.4, §18.1.4, §19.2.4 and §19.3.4 are explicit: all five ARE
    // Dependencies and are one drawing — a dashed line with an open arrowhead —
    // distinguished by the KEYWORD written on them. So the role is the only
    // thing that differs, and it is what the export writes the keyword from.
    const dependency = armed('dependency');
    for (const role of ['include', 'extend', 'deploy', 'manifest'] as const) {
      const edge = armed(role);
      expect(edge.style, role).toEqual(dependency.style);
      expect(edge.options.role, role).not.toBe(dependency.options.role);
    }
    expect(dependency.style).toMatchObject({
      strokeStyle: StrokeStyle.Dash,
      rearEndpointStyle: PointStyle.Arrow,
    });
  });

  it('draws a communication path as the association it IS', () => {
    // §19.4.4 defines a CommunicationPath as an Association between nodes, so
    // it is drawn as one: solid, and nothing on either end. The picture is
    // deliberately not its own — the ROLE is what says these are two servers
    // rather than two classes, and it is what the exporter writes from.
    expect(armed('communication-path').style).toEqual(
      armed('association').style
    );
    expect(armed('communication-path').options.role).not.toBe(
      armed('association').options.role
    );
  });

  it('draws the behaviour edges as the solid arrow no structure wears', () => {
    // §15.2.4 draws an ActivityEdge as a solid line with an OPEN arrowhead, and
    // §14.2.4.8 draws a Transition as the same line. That look belongs to no
    // structural relationship: an association is solid with nothing on it, a
    // dependency is the arrowhead on a DASHED line. A behaviour diagram states
    // an ORDER and therefore always points.
    const flow = armed('control-flow');
    expect(flow.style).toMatchObject({
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
    });
    for (const role of ['object-flow', 'transition'] as const) {
      expect(armed(role).style, role).toEqual(flow.style);
      expect(armed(role).options.role, role).not.toBe(flow.options.role);
    }
    expect(flow.style).not.toEqual(armed('association').style);
    expect(flow.style).not.toEqual(armed('dependency').style);
  });

  it('gives each of the fifteen a look no other has, or a role that differs', () => {
    // Fifteen edges, eight drawings: the five dependencies share one, the
    // communication path shares the association's, and the three behaviour
    // edges share the eighth — every group being one the specification itself
    // says shares a drawing.
    const looks = ALL_EDGES.map(role => JSON.stringify(armed(role).style));
    expect(new Set(looks).size).toBe(8);
    expect(new Set(ALL_EDGES.map(role => UML_ROLE[role])).size).toBe(15);
  });
});

/* ── Export ───────────────────────────────────────────────────────────── */

function fakeDiagram(id: string, name: string) {
  const diagram = Object.create(UmlDiagramElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(diagram, {
    id: { value: id, enumerable: true },
    name: { value: name, enumerable: true },
  });
  return diagram as unknown as UmlDiagramElementModel;
}

/** A surface holding `elements`, with `selection` selected. */
function exportStd(
  elements: unknown[],
  selection: unknown[] = [],
  title = '',
  readonly = false
) {
  const gfx = {
    surface: { elementModels: elements },
    selection: { selectedElements: selection },
  };
  return {
    get: () => gfx,
    store: {
      id: 'doc',
      readonly,
      workspace: { meta: { getDocMeta: () => ({ title }) } },
    },
  } as unknown as BlockStdScope;
}

describe('what the export speaks about', () => {
  const a = fakeDiagram('a', 'Orders');
  const b = fakeDiagram('b', 'Billing');
  const node = { id: 'n', type: 'umlNode' };

  it('takes every frame on the surface when nothing is selected', () => {
    // ADR 0017 ships the four diagram kinds as ONE framework because they are
    // views of one model, and both target formats hold all of them: an XMI
    // `uml:Model` is a single model element, a `.puml` file is one document.
    // So a page of frames with nothing selected exports as the model it is —
    // where `c4BoardsForExport` stops at the selection, a C4 board being one
    // LEVEL that must never be merged with another.
    expect(umlDiagramsForExport(exportStd([a, node, b]))).toEqual([a, b]);
  });

  it('narrows to the selection when there is one', () => {
    expect(umlDiagramsForExport(exportStd([a, node, b], [b]))).toEqual([b]);
    // A selection that holds no frame at all is not a scope: selecting a class
    // and asking for an export must not produce an empty document.
    expect(umlDiagramsForExport(exportStd([a, node, b], [node]))).toEqual([
      a,
      b,
    ]);
  });

  it('hands the capability the frames first, then everything else', () => {
    // The scope is expressed by which FRAMES are in the list — the capability's
    // contract for this framework — so an unselected frame is the one thing
    // left out, and document order is preserved for everything else because it
    // is the tie-break geometric attribution breaks on.
    expect(umlExportElementsOf(exportStd([a, node, b], [b]))).toEqual([
      b,
      node,
    ]);
    expect(umlExportElementsOf(exportStd([a, node, b]))).toEqual([a, b, node]);
  });

  it('names the file after the document, then after the first frame', () => {
    expect(umlExportFilename(exportStd([a], [], 'Sales model'))).toBe(
      umlSafeFilename('Sales model')
    );
    expect(umlExportFilename(exportStd([a, b]))).toBe(
      umlSafeFilename('Orders')
    );
    // Nothing to go on at all is still a legal download.
    expect(umlExportFilename(exportStd([]))).toBe(umlSafeFilename(undefined));
  });
});

describe('the legend, which is not a command', () => {
  const a = fakeDiagram('a', 'Orders');

  it('refuses a read-only document, where the export accepts one', () => {
    // A legend WRITES elements onto the canvas; an export writes nothing and
    // hands the reader a file. A diagram published read-only is precisely the
    // one somebody wants to take away.
    expect(umlDiagramsSelected(exportStd([a], [a], '', true))).toEqual([]);
    expect(umlDiagramsForExport(exportStd([a], [a], '', true))).toEqual([a]);
    expect(() => createUmlLegend(exportStd([a], [a], '', true))).not.toThrow();
  });

  it('needs a SELECTED frame, and takes the first of them', () => {
    // A legend is placed relative to one background; two of them would put two
    // boxes on top of whatever sits in that corner.
    expect(umlDiagramsSelected(exportStd([a], []))).toEqual([]);
    expect(umlDiagramsSelected(exportStd([a], [a]))).toEqual([a]);
    // ...and with nothing selected the gesture is simply a no-op.
    expect(() => createUmlLegend(exportStd([a], []))).not.toThrow();
  });
});
