import {
  type InterchangeExporter,
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { bpmnBoardOf, bpmnExportFilename } from '../actions';
import { exportBpmnXml } from '../export';
import {
  BPMN_INTERCHANGE,
  BPMN_XML_EXPORT,
  bpmnSafeFilename,
} from '../interchange';
import { board, collaborationBoard, fakeNode } from './board-stub';

/**
 * BPMN's entry in the interchange registry (`docs/adr/0012`).
 *
 * Two things are being pinned. That the capability RESOLVES and RUNS off a bare
 * DI container with plain stubs, which is P3's purity requirement stated as a
 * test. And that it produces the SAME bytes as the shipped `bpmn.exportXml`
 * command for the same board — because two doors onto one serializer is the
 * point, and two serializers that happen to agree today is the failure this
 * file exists to prevent.
 */

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

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('the declaration', () => {
  it('is the triple, and BPMN declares no import', () => {
    const provider = mount();

    expect(BPMN_XML_EXPORT.id).toBe('bpmn:bpmn:export');
    expect(interchangeCapabilities(provider, { framework: 'bpmn' })).toEqual([
      BPMN_XML_EXPORT,
    ]);
    // #149 shipped the writer; nobody has written the reader. The registry says
    // so rather than letting a caller assume the symmetry.
    expect(
      interchangeCapabilities(provider, {
        framework: 'bpmn',
        direction: 'import',
      })
    ).toEqual([]);
  });

  it('declares `.bpmn` as a semantic format', () => {
    // Semantic, so the day an importer lands it owes the full preservation
    // contract — mapped / carried / quarantined (ADR 0012, P2 and D1).
    expect(BPMN_XML_EXPORT.format).toEqual({
      id: 'bpmn',
      tier: 'semantic',
      extensions: ['.bpmn'],
      mime: 'application/xml',
    });
  });
});

describe('the capability resolves and runs', () => {
  const { board: composed } = collaborationBoard();
  const elements = flatten(composed);

  it('runs off the container with plain stubs and no editor', () => {
    const capability = mount().get(InterchangeIdentifier('bpmn:bpmn:export'));
    const result = (capability.run as InterchangeExporter)(elements, {
      name: 'Order to cash',
    });

    // Well-formed, and really the two-participant collaboration it was given.
    const doc = new DOMParser().parseFromString(result.text, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.localName).toBe('definitions');
    expect(result.filename).toBe('Order to cash.bpmn');
    expect(result.mime).toBe('application/xml');
  });

  it('picks the BPMN artefacts out of a mixed surface and ignores the rest', () => {
    // A brush stroke and a note share the surface with the process; neither is
    // something BPMN speaks about, and neither may reach the serializer.
    const foreign = [
      { id: 'brush-1', type: 'brush' },
      { id: 'shape-1', type: 'shape' },
    ] as unknown as GfxPrimitiveElementModel[];

    const withForeign = (BPMN_XML_EXPORT.run as InterchangeExporter)(
      [...elements, ...foreign],
      { name: 'Order to cash' }
    );
    const without = (BPMN_XML_EXPORT.run as InterchangeExporter)(elements, {
      name: 'Order to cash',
    });

    expect(withForeign.text).toBe(without.text);
  });

  it('names the file when the caller names nothing', () => {
    const result = (BPMN_XML_EXPORT.run as InterchangeExporter)(elements, {});
    expect(result.filename).toBe('process.bpmn');
  });

  it('makes a caller-supplied name safe to write to disk', () => {
    const result = (BPMN_XML_EXPORT.run as InterchangeExporter)(elements, {
      name: 'Order/to:cash. ',
    });
    // The reserved characters are replaced and the Windows tail is trimmed, so
    // the extension is not the thing that gets eaten.
    expect(result.filename).toBe('Order-to-cash.bpmn');
  });
});

describe('one serializer, two doors', () => {
  it('gives the command and the capability the very same bytes', () => {
    const { board: composed } = collaborationBoard();
    const elements = flatten(composed);
    const std = fakeStd(elements, 'Order to cash');

    // What `exportBpmnXmlFile` composes between reading the surface and handing
    // the bytes to the browser — its own two helpers, called as it calls them.
    const commanded = exportBpmnXml(bpmnBoardOf(std), {
      name: bpmnExportFilename(std),
    });

    const capability = mount().get(InterchangeIdentifier('bpmn:bpmn:export'));
    const declared = (capability.run as InterchangeExporter)(elements, {
      name: 'Order to cash',
    });

    // Byte-identical, not merely equivalent: the id minting is deterministic
    // and both doors walked the same board through the same function, so any
    // difference at all is a second implementation appearing.
    expect(declared.text).toBe(commanded);
    // …and the download is called the same thing on both routes.
    expect(declared.filename).toBe(`${bpmnExportFilename(std)}.bpmn`);
  });

  it('names the file the same way whichever door asked', () => {
    const elements = flatten(
      board({ nodes: [fakeNode('n', 'task', [0, 0, 30, 30], 'Work')] })
    );
    const std = fakeStd(elements, 'Order/to:cash. ');

    expect(bpmnExportFilename(std)).toBe(bpmnSafeFilename('Order/to:cash. '));
  });
});
