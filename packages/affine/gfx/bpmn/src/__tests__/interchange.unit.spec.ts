import {
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
  LEGEND_ROLE,
  parseSvgSketch,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportBpmnXmlFile } from '../actions';
import {
  BPMN_INTERCHANGE,
  BPMN_SVG_IMPORT,
  bpmnBoardFrom,
  BPMN_XML_EXPORT,
  BPMN_XML_IMPORT,
} from '../interchange';
import { BPMN_ROLE } from '../roles';
import {
  BAND,
  board,
  collaborationBoard,
  fakeConnector,
  fakeLabelledNode,
  fakeNode,
  fakePool,
  fakeText,
  POOL_H,
  POOL_W,
} from './board-stub';

/**
 * BPMN's entry in the interchange registry (`docs/adr/0012`).
 *
 * Three things are pinned here. That the capability RESOLVES and RUNS off a
 * bare DI container with plain stubs, which is P3's purity requirement stated
 * as a test. That the shipped `bpmn.exportXml` command downloads exactly what
 * the capability produced — bytes, filename and content type — which after M3
 * is true by construction and asserted anyway, because "by construction" is a
 * claim about today's code. And that the export's three losses reach the user
 * instead of living in a code comment.
 */

/* ── The command's one side effect, captured ──────────────────────────── */

/**
 * `vi.hoisted`, because `vi.mock`'s factory is lifted above every import and
 * cannot close over an ordinary module variable. Only `downloadBlob` is
 * replaced — the rest of the barrel is the real one, so nothing else in the
 * command's graph changes shape.
 */
const captured = vi.hoisted(() => ({
  file: null as { blob: Blob; name: string } | null,
}));

vi.mock('@labre/affine-shared/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-shared/utils')>()),
  downloadBlob: (blob: Blob, name: string) => {
    captured.file = { blob, name };
  },
}));

beforeEach(() => {
  captured.file = null;
});

/* ── Mounting ─────────────────────────────────────────────────────────── */

function mount() {
  const container = new Container();
  InterchangeExtension(BPMN_INTERCHANGE).setup!(container);
  return container.provider();
}

/** The elements of a board, flat and in document order, as a surface holds them. */
function flatten(
  parts: ReturnType<typeof board>
): readonly GfxPrimitiveElementModel[] {
  return [
    ...parts.pools,
    ...parts.nodes,
    ...parts.connectors,
  ] as unknown as readonly GfxPrimitiveElementModel[];
}

/**
 * The editor's half of the export, faked down to what it actually reads: the
 * surface's elements, the selection, and the document's title.
 */
function fakeStd(
  elements: readonly GfxPrimitiveElementModel[],
  title: string
): BlockStdScope {
  const gfx = {
    surface: { elementModels: elements },
    selection: { selectedElements: [] },
  };
  return {
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    store: {
      id: 'doc-1',
      workspace: { meta: { getDocMeta: () => ({ title }) } },
    },
  } as unknown as BlockStdScope;
}

const runExport = BPMN_XML_EXPORT.run;

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('the declaration', () => {
  it('is the triple, and BPMN now declares both directions of it', () => {
    const provider = mount();

    expect(BPMN_XML_EXPORT.id).toBe('bpmn:bpmn:export');
    expect(BPMN_XML_IMPORT.id).toBe('bpmn:bpmn:import');
    // Sorted by id, which is what makes a menu built from this list come out in
    // the same order on every boot: `export` before `import`.
    expect(interchangeCapabilities(provider, { framework: 'bpmn' })).toEqual([
      BPMN_XML_EXPORT,
      BPMN_XML_IMPORT,
      BPMN_SVG_IMPORT,
    ]);
    // Each direction on its own, and TYPED: a caller that asked for readers
    // gets `run`s it can call, not a union it has to narrow a second time.
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
        format: 'bpmn',
        direction: 'import',
      })
    ).toEqual([BPMN_XML_IMPORT]);
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
        direction: 'export',
      })
    ).toEqual([BPMN_XML_EXPORT]);
  });

  it('declares the SVG fallback as a third, VISUAL row', () => {
    const provider = mount();

    expect(BPMN_SVG_IMPORT.id).toBe('bpmn:svg:import');
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
        direction: 'import',
      })
      // Sorted by id: `bpmn:bpmn:import` before `bpmn:svg:import`, so the
      // native format is the first thing a menu built from this list offers and
      // the fallback is second. That order is the registry's, not a UI's.
    ).toEqual([BPMN_XML_IMPORT, BPMN_SVG_IMPORT]);
    expect(BPMN_SVG_IMPORT.format).toEqual({
      id: 'svg',
      tier: 'visual',
      extensions: ['.svg'],
      mime: 'image/svg+xml',
    });
  });

  it('wraps the SHARED parser, adding nothing of its own', () => {
    // The identity, not an equivalence: BPMN and Wardley read a `.svg` through
    // one function, so they cannot drift into recognising different pictures —
    // and the heuristics statement ADR 0012's open question 2 asks for is
    // written ONCE, in that parser's module documentation, rather than twice
    // with the second copy going stale.
    expect(BPMN_SVG_IMPORT.run).toBe(parseSvgSketch);
  });

  it('reads and writes through ONE format object, which is the payload key', () => {
    // `bpmn` is the key foreign matter rides under on an element (ADR 0012,
    // D2). Two format objects that agreed today would be two things to keep in
    // step, and the failure would be silent: a reader writing `interchange.bpmn`
    // and a writer looking under something else finds nothing and says nothing.
    expect(BPMN_XML_IMPORT.format).toBe(BPMN_XML_EXPORT.format);
  });

  it('declares `.bpmn` as a semantic format, with `.xml` behind it', () => {
    // Semantic, so it owes the full preservation contract — mapped / carried /
    // quarantined (ADR 0012, P2 and D1).
    //
    // Two extensions, and the ORDER is the whole of the difference: the first
    // is the one a download is given, so Labre still writes `.bpmn`, and the
    // rest are what the picker offers and what a host indexes on. Half the
    // tools in the wild write a process under the generic extension, and a
    // filter that refused them would refuse a valid process for the sake of a
    // filename — the argument the shared `FileTypes` table used to carry, now
    // that the filter is built from this declaration
    // (`interchange-import.ts`).
    expect(BPMN_XML_EXPORT.format).toEqual({
      id: 'bpmn',
      tier: 'semantic',
      extensions: ['.bpmn', '.xml'],
      mime: 'application/xml',
    });
  });
});

describe('the capability resolves and runs', () => {
  const { board: composed } = collaborationBoard();
  const elements = flatten(composed);

  it('runs off the container with plain stubs and no editor', () => {
    const capability = mount().get(InterchangeIdentifier('bpmn:bpmn:export'));
    if (capability.direction !== 'export') throw new Error('expected export');
    const result = capability.run(elements, { name: 'Order to cash' });

    // Well-formed, and really the two-participant collaboration it was given.
    const doc = new DOMParser().parseFromString(result.text, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.localName).toBe('definitions');
    expect(result.filename).toBe('Order to cash.bpmn');
    expect(result.mime).toBe('application/xml');
  });

  it('picks the BPMN artefacts out of a mixed surface and ignores the rest', () => {
    // A brush stroke and a plain shape share the surface with the process;
    // neither is something BPMN speaks about, and neither may reach the
    // serializer.
    // Drawn BESIDE the pools, so this stays a test about the serializer's
    // silence: one drawn inside would also be counted by the left-out warning,
    // which is a different sentence and has its own tests below.
    const foreign = [
      { id: 'brush-1', type: 'brush', elementBound: new Bound(900, 0, 40, 40) },
      {
        id: 'shape-1',
        type: 'shape',
        elementBound: new Bound(900, 60, 40, 40),
      },
    ] as unknown as GfxPrimitiveElementModel[];

    const withForeign = runExport([...elements, ...foreign], {
      name: 'Order to cash',
    });
    const without = runExport(elements, { name: 'Order to cash' });

    expect(withForeign.text).toBe(without.text);
  });

  it('names the file when the caller names nothing', () => {
    expect(runExport(elements, {}).filename).toBe('process.bpmn');
  });

  it('makes a caller-supplied name safe to write to disk', () => {
    // The reserved characters are replaced and the Windows tail is trimmed, so
    // the extension is not the thing that gets eaten.
    expect(runExport(elements, { name: 'Order/to:cash. ' }).filename).toBe(
      'Order-to-cash.bpmn'
    );
  });
});

describe('one door, and the command is it', () => {
  it('downloads exactly what the capability produced', () => {
    const { board: composed } = collaborationBoard();
    const elements = flatten(composed);
    const std = fakeStd(elements, 'Order to cash');

    exportBpmnXmlFile(std);

    const declared = runExport(elements, { name: 'Order to cash' });
    expect(captured.file).not.toBeNull();
    // The FILE the user gets, against the capability's own answer: bytes,
    // name and content type. Driving the real command rather than a copy of
    // it, so the day it post-processes the string this fails.
    expect(captured.file!.name).toBe(declared.filename);
    expect(captured.file!.blob.type).toBe(`${declared.mime};charset=utf-8`);
    return expect(captured.file!.blob.text()).resolves.toBe(declared.text);
  });

  it('takes the filename from the document title, through the same sanitizer', () => {
    const elements = flatten(
      board({ nodes: [fakeNode('n', 'task', [0, 0, 30, 30], 'Work')] })
    );

    exportBpmnXmlFile(fakeStd(elements, 'Order/to:cash. '));

    expect(captured.file!.name).toBe('Order-to-cash.bpmn');
  });
});

/**
 * What the exporter is allowed to speak about, and it is the ROLE that decides.
 *
 * A `bpmnNode` is a shape with a `kind`; the role is the author's statement
 * that this circle IS the start of the process (`docs/adr/0010`). The
 * distinction became load-bearing the day the pool grew a legend — a legend
 * swatch is a real `bpmnNode` with a real `kind` and deliberately no role — and
 * it has a cost the PO took on 2026-09-17: a process drawn before roles existed
 * (2026-08-26) no longer exports at all.
 */
describe('the export speaks about roled artefacts and nothing else', () => {
  it('drops a node whose role is missing, and one whose role contradicts its kind', () => {
    const picked = bpmnBoardFrom(
      flatten(
        board({
          pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' })],
          nodes: [
            fakeNode('real', 'task', [BAND + 20, 60, 60, 40], 'Work'),
            // A legend swatch: same class, same kind, no role.
            fakeNode('swatch', 'task', [BAND + 20, 120, 44, 26], undefined, {
              role: undefined,
            }),
            // …and a node whose role says something its kind does not.
            fakeNode('liar', 'task', [BAND + 20, 150, 60, 40], undefined, {
              role: BPMN_ROLE.startEvent,
            }),
          ],
        })
      )
    );
    expect(picked.nodes.map(node => node.id)).toEqual(['real']);
  });

  it('drops a pool with no role, so a legend backdrop is never a participant', () => {
    const picked = bpmnBoardFrom(
      flatten(
        board({
          pools: [
            fakePool('real', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
            fakePool('neutral', [0, 300, POOL_W, POOL_H], { role: undefined }),
          ],
        })
      )
    );
    expect(picked.pools.map(pool => pool.id)).toEqual(['real']);
  });

  it('leaves the connectors to the filter they already had', () => {
    // `EDGE_ELEMENT[connector.role]` in `export.ts` has always dropped a
    // neutral arrow; nothing here duplicates that decision one layer up.
    const picked = bpmnBoardFrom(
      flatten(
        board({
          connectors: [
            fakeConnector('typed', BPMN_ROLE.sequenceFlow),
            fakeConnector('neutral', undefined),
          ],
        })
      )
    );
    expect(picked.connectors.map(connector => connector.id)).toEqual([
      'typed',
      'neutral',
    ]);
  });
});

/**
 * …and now it SAYS so (PO ruling of 2026-09-17).
 *
 * Everything inside a pool's perimeter leaves in the board's generic SVG export
 * (ADR 0025, R34) and only the roled artefacts leave in the `.bpmn`. That
 * asymmetry is wanted; being silent about it was the surprise.
 */
describe('the export says what it left inside the pool', () => {
  /** Anything on the surface that is not a BPMN element: a shape, a text. */
  const fakeStray = (bound: [number, number, number, number]) =>
    ({
      elementBound: new Bound(...bound),
    }) as unknown as GfxPrimitiveElementModel;

  it('counts what it left behind and warns about it once', () => {
    const elements = [
      fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
      fakeNode('t1', 'task', [BAND + 20, 40, 60, 40], 'Check'),
      fakeNode('t2', 'task', [BAND + 20, 100, 60, 40], 'Ship'),
      // A free shape and a free text, both drawn inside the pool.
      fakeStray([BAND + 140, 40, 60, 40]),
      fakeStray([BAND + 140, 100, 60, 20]),
    ] as unknown as readonly GfxPrimitiveElementModel[];

    expect(bpmnBoardFrom(elements).leftOut).toBe(2);

    const exported = runExport(elements, {});
    expect(exported.text).toContain('name="Check"');
    expect(exported.text).toContain('name="Ship"');

    const [warning, ...rest] = exported.warnings!;
    expect(rest).toEqual([]);
    expect(warning).toContain(
      '2 element(s) inside the pool are not BPMN elements'
    );
    expect(warning).toContain('Export SVG');
  });

  it('says nothing when everything drawn in the pools is BPMN', () => {
    const { board: composed } = collaborationBoard();
    const elements = flatten(composed);

    expect(bpmnBoardFrom(elements).leftOut).toBeUndefined();
    expect(runExport(elements, {}).warnings).toBeUndefined();
  });

  it('does not count a generated legend, which is not a loss', () => {
    // A legend is drawn INSIDE the pool it documents and is made of role-less
    // glyphs on purpose. Counting them would report fourteen losses for a box
    // the user asked for — the exact surprise this warning exists to prevent.
    // The group's `LEGEND_ROLE` is what it is recognised by.
    const swatches = ['sw-1', 'sw-2', 'sw-3'].map(id => ({
      id,
      elementBound: new Bound(BAND + 10, 150, 16, 16),
    }));
    const legend = {
      id: 'legend-1',
      role: LEGEND_ROLE,
      childIds: swatches.map(swatch => swatch.id),
      elementBound: new Bound(BAND + 5, 140, 200, 50),
    };

    const elements = [
      fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
      fakeNode('t1', 'task', [BAND + 20, 40, 60, 40], 'Check'),
      fakeNode('t2', 'task', [BAND + 120, 40, 60, 40], 'Ship'),
      // The one real stray, drawn beside the legend.
      fakeStray([BAND + 240, 40, 60, 40]),
      legend,
      ...swatches,
    ] as unknown as readonly GfxPrimitiveElementModel[];

    expect(bpmnBoardFrom(elements).leftOut).toBe(1);

    const [warning, ...rest] = runExport(elements, {})!.warnings!;
    expect(rest).toEqual([]);
    expect(warning).toContain(
      '1 element(s) inside the pool are not BPMN elements'
    );
  });

  it('does not count a grouped label and its group, whose words the file carries', () => {
    // R38: an event's name is a `bpmn:label` grouped with it, and the export
    // writes it as the event's `name`. An UNGROUPED label is bound to nothing,
    // so its words are in no file — that one is a loss, and is counted.
    const elements = [
      fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
      ...fakeLabelledNode('s', 'startEvent', [BAND + 20, 40, 56, 56], 'Go'),
      fakeText('stray', 'Orphan name', [BAND + 200, 40, 120, 26]),
    ] as unknown as readonly GfxPrimitiveElementModel[];

    const picked = bpmnBoardFrom(elements);
    expect(picked.labels?.get('s')).toBe('Go');
    expect(picked.leftOut).toBe(1);
    expect(runExport(elements, {}).text).toContain('name="Go"');
  });

  it('binds a label by group membership, never by where it sits', () => {
    // A text with the label role sitting right under an event, in no group
    // with it, is not its name; a grouped label dragged away still is.
    const [node, , group] = fakeLabelledNode(
      's',
      'startEvent',
      [BAND + 20, 40, 56, 56],
      'Go'
    );
    const moved = fakeText('s-label', 'Go', [BAND + 300, 150, 120, 26]);
    const beside = fakeText('near', 'Not mine', [BAND - 12, 102, 120, 26]);
    const elements = [
      fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
      node,
      moved,
      group,
      beside,
    ] as unknown as readonly GfxPrimitiveElementModel[];

    expect(bpmnBoardFrom(elements).labels?.get('s')).toBe('Go');
  });

  it('ignores a role-less element drawn outside every pool', () => {
    // The SVG export of a board is bounded by the board, so a stray beside it
    // is not something this file "left out" — nothing claims to carry it.
    const elements = [
      fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' }),
      fakeNode('t1', 'task', [BAND + 20, 40, 60, 40], 'Check'),
      fakeStray([900, 400, 60, 40]),
    ] as unknown as readonly GfxPrimitiveElementModel[];

    expect(bpmnBoardFrom(elements).leftOut).toBeUndefined();
    expect(runExport(elements, {}).warnings).toBeUndefined();
  });
});

describe('what the format refused to carry reaches the user', () => {
  it('says nothing when the board came out whole', () => {
    const { board: composed } = collaborationBoard();
    // The composed board draws everything inside pools with well-attached
    // arrows, so there is nothing to warn about — and the channel is ABSENT,
    // not an empty array.
    expect(runExport(flatten(composed), {}).warnings).toBeUndefined();
  });

  it('warns that flow objects beside the pools will not be drawn', () => {
    // The live recette's finding: they are in the file and correct for any tool
    // that reads the model, and bpmn-js renders none of them, because a
    // participant-less process has no shape on a collaboration plane.
    const elements = flatten(
      board({
        pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' })],
        nodes: [
          fakeNode('inside', 'task', [BAND + 20, 60, 60, 40], 'Work'),
          fakeNode('stray', 'task', [900, 300, 120, 60], 'Orphan'),
          fakeNode('stray2', 'taskUser', [900, 400, 120, 60], 'Other'),
        ],
      })
    );

    const [warning, ...rest] = runExport(elements, {})!.warnings!;
    expect(rest).toEqual([]);
    // `runExport` is the INTERCHANGE adapter (`InterchangeExportResult`,
    // shared across every format), so its `warnings` are already resolved
    // strings — `BpmnExportWarning`'s key/fallback/params live one layer
    // down, in `exportBpmnXmlWithWarnings` itself.
    expect(warning).toContain('2 artefact(s) are drawn outside every pool');
    expect(warning).toContain('inside a pool');
  });

  it('does not mistake a drawn annotation for an undrawn flow object', () => {
    // An annotation outside every pool goes on the COLLABORATION, where it is
    // legal AND drawn — the unminted orphan index is -1, which is also the
    // collaboration's, so this is the case a naive count gets wrong.
    const elements = flatten(
      board({
        pools: [fakePool('p', [0, 0, POOL_W, POOL_H], { name: 'Sales' })],
        nodes: [
          fakeNode('inside', 'task', [BAND + 20, 60, 60, 40], 'Work'),
          fakeNode('note', 'textAnnotation', [900, 40, 120, 40], 'SLA 24h'),
        ],
      })
    );

    expect(runExport(elements, {}).warnings).toBeUndefined();
  });

  it('warns that a message flow needs pools to run between', () => {
    // Dropped rather than demoted to a sequence flow: "sends a message to" and
    // "is followed by" are two different sentences.
    const elements = flatten(
      board({
        nodes: [
          fakeNode('a', 'task', [0, 0, 40, 30], 'A'),
          fakeNode('b', 'task', [200, 0, 40, 30], 'B'),
        ],
        connectors: [
          fakeConnector('m', BPMN_ROLE.messageFlow, {
            source: 'a',
            target: 'b',
          }),
        ],
      })
    );

    const [warning, ...rest] = runExport(elements, {})!.warnings!;
    expect(rest).toEqual([]);
    expect(warning).toContain('1 message flow(s) were left out');
    expect(warning).toContain('no pool');
  });

  it('warns about an arrow whose end the file cannot name', () => {
    // Both causes of the same loss: an end left loose, and an end attached to
    // something that is not a BPMN artefact. `sourceRef` and `targetRef` are
    // required on every flow, so neither can be written down.
    const elements = flatten(
      board({
        nodes: [fakeNode('a', 'task', [0, 0, 40, 30], 'A')],
        connectors: [
          fakeConnector('loose', BPMN_ROLE.sequenceFlow, { source: 'a' }),
          fakeConnector('foreign', BPMN_ROLE.sequenceFlow, {
            source: 'a',
            target: 'sticky-note-1',
          }),
        ],
      })
    );

    const [warning, ...rest] = runExport(elements, {})!.warnings!;
    expect(rest).toEqual([]);
    expect(warning).toContain('2 arrow(s) were left out');
  });

  it('says nothing about a neutral connector, which lost nothing', () => {
    // A connector with no role states nothing (`docs/adr/0010`). It is absent
    // from the file because it is not a flow — not because the format refused
    // it — and warning about it would teach the user the wrong lesson.
    const elements = flatten(
      board({
        nodes: [
          fakeNode('a', 'task', [0, 0, 40, 30], 'A'),
          fakeNode('b', 'task', [200, 0, 40, 30], 'B'),
        ],
        connectors: [
          fakeConnector('plain', undefined, { source: 'a', target: 'b' }),
        ],
      })
    );

    expect(runExport(elements, {}).warnings).toBeUndefined();
  });
});
