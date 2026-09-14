import {
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  UML_INTERCHANGE,
  UML_PLANTUML_EXPORT,
  UML_XMI_EXPORT,
  umlModelsFrom,
} from '../interchange';
import { UML_ROLE } from '../roles';

/**
 * UML's entries in the interchange registry (`docs/adr/0012`).
 *
 * The three pins BPMN's and C4's specs set. That both capabilities RESOLVE and
 * RUN off a bare DI container with plain stubs, which is P3's purity requirement
 * stated as a test — the fixtures below are object literals with an `id`, a
 * `type` and an `xywh`, and nothing in the graph may need more. That the ids are
 * the minted triples rather than strings somebody typed. And the framework's own
 * reading of the selection: it is expressed through WHICH diagrams the caller
 * puts in the element list.
 *
 * It is also where the canvas READING is exercised end to end — a class is a
 * group of a shape and three texts, and a connector lands on the group about as
 * often as on the shape, so a capability that could not resolve that would write
 * a file missing every relationship the author drew.
 */

/* ── A surface, as plain records ──────────────────────────────────────── */

type Element = Record<string, unknown>;

function diagram(id: string, name: string, x = 0): Element {
  return {
    id,
    type: 'umlDiagram',
    kind: 'class',
    name,
    xywh: `[${x},0,1400,900]`,
  };
}

/** A classifier: its shape, its three written tiers, and the group joining them. */
function classNode(
  id: string,
  name: string,
  box: [number, number],
  attributes = '',
  operations = ''
): Element[] {
  const [x, y] = box;
  return [
    {
      id,
      type: 'umlNode',
      kind: 'class',
      role: UML_ROLE.class,
      xywh: `[${x},${y},200,120]`,
    },
    { id: `${id}-name`, type: 'text', role: UML_ROLE.name, text: name },
    {
      id: `${id}-attributes`,
      type: 'text',
      role: UML_ROLE.attributes,
      text: attributes,
    },
    {
      id: `${id}-operations`,
      type: 'text',
      role: UML_ROLE.operations,
      text: operations,
    },
    {
      id: `${id}-group`,
      type: 'group',
      childIds: [id, `${id}-name`, `${id}-attributes`, `${id}-operations`],
    },
  ];
}

function connector(
  id: string,
  role: string | undefined,
  from: string,
  to: string,
  text = ''
): Element {
  return {
    id,
    type: 'connector',
    ...(role ? { role } : {}),
    source: { id: from },
    target: { id: to },
    text,
    xywh: '[0,0,0,0]',
  };
}

/**
 * One class diagram: two classes, and a generalization drawn between their
 * GROUPS — which is what the connector tool records most of the time.
 */
function surface(): GfxPrimitiveElementModel[] {
  return [
    diagram('d1', 'Orders'),
    ...classNode('c1', 'Order', [100, 100], '+ id : String'),
    ...classNode('c2', 'PriorityOrder', [400, 100]),
    connector('k1', UML_ROLE.generalization, 'c2-group', 'c1-group'),
  ] as unknown as GfxPrimitiveElementModel[];
}

function mount() {
  const container = new Container();
  InterchangeExtension(UML_INTERCHANGE).setup!(container);
  return container.provider();
}

/* ── The declaration ──────────────────────────────────────────────────── */

describe('the declaration', () => {
  it('is the triple, twice, and UML declares no import', () => {
    const provider = mount();

    expect(UML_PLANTUML_EXPORT.id).toBe('uml:plantuml:export');
    expect(UML_XMI_EXPORT.id).toBe('uml:xmi:export');
    // Sorted by id, which is what `interchangeCapabilities` promises.
    expect(interchangeCapabilities(provider, { framework: 'uml' })).toEqual([
      UML_PLANTUML_EXPORT,
      UML_XMI_EXPORT,
    ]);
    // Two writers shipped; nobody has written a reader. The registry says so
    // rather than letting a caller assume the symmetry.
    expect(
      interchangeCapabilities(provider, {
        framework: 'uml',
        direction: 'import',
      })
    ).toEqual([]);
  });

  it('declares both formats as semantic', () => {
    // Semantic, so the day an importer lands it owes the full preservation
    // contract — mapped / carried / quarantined (ADR 0012, P2 and D1).
    expect(UML_PLANTUML_EXPORT.format).toEqual({
      id: 'plantuml',
      tier: 'semantic',
      extensions: ['.puml', '.plantuml'],
    });
    expect(UML_XMI_EXPORT.format).toEqual({
      id: 'xmi',
      tier: 'semantic',
      extensions: ['.xmi', '.uml'],
      mime: 'application/xml',
    });
  });
});

/* ── Running ──────────────────────────────────────────────────────────── */

describe('the capabilities resolve and run', () => {
  const elements = surface();

  it('runs off the container with plain stubs and no editor', () => {
    const capability = mount().get(InterchangeIdentifier('uml:xmi:export'));
    if (capability.direction !== 'export') throw new Error('expected export');
    const result = capability.run(elements, { name: 'Orders' });

    expect(result.filename).toBe('Orders.xmi');
    expect(result.mime).toBe('application/xml');
    expect(result.text).toContain('<uml:Model');
    expect(result.warnings).toBeUndefined();
  });

  it('names the PlantUML file and serves it as text', () => {
    const result = UML_PLANTUML_EXPORT.run(elements, { name: 'Orders' });
    expect(result.filename).toBe('Orders.puml');
    expect(result.mime).toBe('text/plain;charset=utf-8');
    expect(result.text).toContain('@startuml');
  });

  it('names the file when the caller names nothing', () => {
    expect(UML_PLANTUML_EXPORT.run(elements, {}).filename).toBe('diagram.puml');
    expect(UML_XMI_EXPORT.run(elements, {}).filename).toBe('diagram.xmi');
  });

  it('makes a caller-supplied name safe to write to disk', () => {
    // The reserved characters are replaced and the Windows tail is trimmed, so
    // the extension is not the thing that gets eaten.
    expect(
      UML_PLANTUML_EXPORT.run(elements, { name: 'Order/to:cash. ' }).filename
    ).toBe('Order-to-cash.puml');
  });

  it('resolves a connector that landed on the group, not on the shape', () => {
    // Every part of a classifier's group is connectable and they all look the
    // same on the canvas. An export that only understood the shape would drop
    // most of the arrows an author drew.
    expect(UML_PLANTUML_EXPORT.run(elements, {}).text).toContain(
      'order <|-- priorityorder'
    );
  });

  it('reads a written tier through the group', () => {
    expect(UML_XMI_EXPORT.run(elements, {}).text).toContain('name="id"');
  });

  it('picks the UML artefacts out of a mixed surface and ignores the rest', () => {
    // A brush stroke and a plain shape share the surface; neither is something
    // UML speaks about, and neither may reach a writer.
    const foreign = [
      { id: 'brush-1', type: 'brush', xywh: '[120,120,10,10]' },
      { id: 'shape-1', type: 'shape', xywh: '[130,130,10,10]' },
    ] as unknown as GfxPrimitiveElementModel[];

    expect(UML_XMI_EXPORT.run([...elements, ...foreign], {}).text).toBe(
      UML_XMI_EXPORT.run(elements, {}).text
    );
  });
});

/* ── The selection ────────────────────────────────────────────────────── */

describe('the selection is the diagrams in the list', () => {
  it('gives a headless host every diagram it was handed', () => {
    const two = [
      ...surface(),
      diagram('d2', 'Storefront', 2000),
    ] as unknown as GfxPrimitiveElementModel[];

    // PlantUML: one document per diagram.
    expect(
      UML_PLANTUML_EXPORT.run(two, {}).text.match(/^@startuml$/gm)
    ).toHaveLength(2);
    // XMI: one model, one package each.
    expect(
      UML_XMI_EXPORT.run(two, {}).text.match(/xmi:type="uml:Package"/g)
    ).toHaveLength(2);
  });

  it('writes nothing about a diagram the caller left out', () => {
    const without = surface().filter(
      element => (element as { type?: string }).type !== 'umlDiagram'
    );
    expect(UML_PLANTUML_EXPORT.run(without, {}).text).toBe(
      '@startuml\n@enduml\n'
    );
  });

  it('attributes a node to the diagram whose sheet holds its centre', () => {
    // Two frames side by side are two diagrams, and a class belongs to the one
    // it is drawn on — the same arithmetic every framework here attributes with.
    const two = [
      diagram('d1', 'Left'),
      diagram('d2', 'Right', 2000),
      ...classNode('c1', 'Order', [100, 100]),
      ...classNode('c2', 'Invoice', [2100, 100]),
    ] as unknown as GfxPrimitiveElementModel[];

    const [left, right] = umlModelsFrom(two);
    expect(left.classifiers.map(c => c.name)).toEqual(['Order']);
    expect(right.classifiers.map(c => c.name)).toEqual(['Invoice']);
  });
});

/* ── Warnings ─────────────────────────────────────────────────────────── */

describe('what the writer could not say', () => {
  it('tells the user about a connector that states no relationship', () => {
    // `docs/adr/0010`: the role IS the statement, so a bare connector relates
    // nothing. Not an error — but a user who drew a line between two classes
    // and gets a file without it is owed the sentence.
    const elements = [
      ...surface(),
      connector('k2', undefined, 'c1', 'c2'),
    ] as unknown as GfxPrimitiveElementModel[];

    const result = UML_XMI_EXPORT.run(elements, {});
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain('no relationship type');
  });

  it('tells the user about a relationship with an end off the diagram', () => {
    const elements = [
      ...surface(),
      connector('k3', UML_ROLE.dependency, 'c1-group', 'nowhere'),
    ] as unknown as GfxPrimitiveElementModel[];

    expect(UML_PLANTUML_EXPORT.run(elements, {}).warnings![0]).toContain(
      'not on this diagram'
    );
  });

  it('says nothing when the diagram came out whole', () => {
    // Omitted rather than empty, so a caller can ask `if (result.warnings)` and
    // mean it.
    expect(UML_XMI_EXPORT.run(surface(), {}).warnings).toBeUndefined();
  });
});
