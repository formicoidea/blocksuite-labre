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
  UML_SUBJECT_BOX,
} from '../consts.js';
import { umlSafeFilename } from '../filename.js';
import {
  UML_ATTRIBUTES_SEED,
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_SLOTS_SEED,
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
 * `getOptional` returns nothing, which is the case worth stubbing: the diagram
 * and the subject seed their names through the translation seam, and with no
 * host catalogue registered they must fall back to the English the model always
 * carried.
 */
function recorder() {
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
    getOptional: () => undefined,
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
];
const GLYPHS: UmlGlyphKind[] = ['package', 'note', 'actor', 'use-case'];
const ALL_KINDS = [...CLASSIFIERS, ...GLYPHS] as UmlNodeKind[];

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

  it('writes whichever of the four kinds the caller asked for', () => {
    for (const kind of ['class', 'pkg', 'obj', 'uc'] as const) {
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

  it('seeds every compartment with the stencil own prompt', () => {
    for (const kind of CLASSIFIERS) {
      const rec = recorder();
      createUmlClassifier(rec.std, kind);
      expect(rec.added[1].text, kind).toBe(UML_NAME_SEED[kind]);
      expect(rec.added[2].text, kind).toBe(
        kind === 'object' ? UML_SLOTS_SEED : UML_ATTRIBUTES_SEED
      );
      if (kind !== 'object') {
        expect(rec.added[3].text, kind).toBe(UML_OPERATIONS_SEED);
      }
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

  it('builds the four picture kinds as shape, one label, group', () => {
    for (const kind of GLYPHS) {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      expect(rec.types(), kind).toEqual(['umlNode', 'text', 'group']);
      expect(rec.added[1].text, kind).toBe(UML_NAME_SEED[kind]);
    }
  });

  it('calls a package and a note a NAME, an actor and a use case a LABEL', () => {
    // A package name is a namespace and a note's text is a comment body: both
    // are parsed. An actor and a use case carry a name and nothing else.
    const roleOf = (kind: UmlGlyphKind) => {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      return rec.added[1].role;
    };
    expect(roleOf('package')).toBe(UML_ROLE.name);
    expect(roleOf('note')).toBe(UML_ROLE.name);
    expect(roleOf('actor')).toBe(UML_ROLE.label);
    expect(roleOf('use-case')).toBe(UML_ROLE.label);
  });

  it('reads a note left, because a note holds a sentence', () => {
    const alignOf = (kind: UmlGlyphKind) => {
      const rec = recorder();
      createUmlNode(rec.std, kind);
      return rec.added[1].textAlign;
    };
    expect(alignOf('note')).toBe(TextAlign.Left);
    for (const kind of ['package', 'actor', 'use-case'] as const) {
      expect(alignOf(kind), kind).toBe(TextAlign.Center);
    }
  });

  it('drops a shape with no words in it, whatever the kind (R16)', () => {
    for (const kind of ALL_KINDS) {
      const rec = recorder();
      if ((CLASSIFIERS as UmlNodeKind[]).includes(kind)) {
        createUmlClassifier(rec.std, kind as UmlClassifierKind);
      } else {
        createUmlNode(rec.std, kind as UmlGlyphKind);
      }
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
      if ((CLASSIFIERS as UmlNodeKind[]).includes(kind)) {
        createUmlClassifier(rec.std, kind as UmlClassifierKind);
      } else {
        createUmlNode(rec.std, kind as UmlGlyphKind);
      }
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
      const rec = recorder();
      if ((CLASSIFIERS as UmlNodeKind[]).includes(kind)) {
        createUmlClassifier(rec.std, kind as UmlClassifierKind);
      } else {
        createUmlNode(rec.std, kind as UmlGlyphKind);
      }
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
    expect(() => createUmlClassifier(std, 'class')).not.toThrow();
    expect(() => createUmlNode(std, 'note')).not.toThrow();
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

  it('draws dependency, include and extend alike, told apart by the role', () => {
    // §7.8.4 and §18.1.4 are explicit: the three are one drawing — a dashed
    // line with an open arrowhead — distinguished by the KEYWORD written on
    // them. So the role is the only thing that differs, and it is what the
    // export writes the keyword from.
    const dependency = armed('dependency');
    for (const role of ['include', 'extend'] as const) {
      const edge = armed(role);
      expect(edge.style, role).toEqual(dependency.style);
      expect(edge.options.role, role).not.toBe(dependency.options.role);
    }
    expect(dependency.style).toMatchObject({
      strokeStyle: StrokeStyle.Dash,
      rearEndpointStyle: PointStyle.Arrow,
    });
  });

  it('gives each of the nine a look no other one has, or a role that differs', () => {
    // Nine edges, seven drawings: only the include/extend/dependency trio share
    // one, and they are the trio the spec says share one.
    const looks = ALL_EDGES.map(role => JSON.stringify(armed(role).style));
    expect(new Set(looks).size).toBe(7);
    expect(new Set(ALL_EDGES.map(role => UML_ROLE[role])).size).toBe(9);
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
