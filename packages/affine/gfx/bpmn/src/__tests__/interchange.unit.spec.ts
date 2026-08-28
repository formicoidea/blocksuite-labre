import {
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportBpmnXmlFile } from '../actions';
import {
  BPMN_INTERCHANGE,
  BPMN_XML_EXPORT,
  BPMN_XML_IMPORT,
} from '../interchange';
import { BPMN_ROLE } from '../roles';
import {
  BAND,
  board,
  collaborationBoard,
  fakeConnector,
  fakeNode,
  fakePool,
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
    ]);
    // Each direction on its own, and TYPED: a caller that asked for readers
    // gets `run`s it can call, not a union it has to narrow a second time.
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
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
    const foreign = [
      { id: 'brush-1', type: 'brush' },
      { id: 'shape-1', type: 'shape' },
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
    expect(warning).toContain('2 artefacts are drawn outside every pool');
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
    expect(warning).toContain('1 message flow was left out');
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
    expect(warning).toContain('2 arrows were left out');
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
