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

import { exportC4MermaidFile } from '../actions';
import { exportC4Mermaid } from '../export';
import { C4_INTERCHANGE, C4_MERMAID_EXPORT } from '../interchange';
import { composedBoard } from './board-stub';

/**
 * C4's entry in the interchange registry (`docs/adr/0012`).
 *
 * The same three pins BPMN's spec sets. That the capability RESOLVES and RUNS
 * off a bare DI container with plain stubs, which is P3's purity requirement
 * stated as a test. That the shipped `c4.exportMermaid` command downloads
 * exactly what the capability produced — bytes, filename and content type —
 * which is true by construction and asserted anyway, because "by construction"
 * is a claim about today's code. And the framework-specific one: the SELECTION
 * is expressed through which boards the caller puts in the element list, so the
 * command's curated list and the capability agree on what one selected board
 * means.
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
  InterchangeExtension(C4_INTERCHANGE).setup!(container);
  return container.provider();
}

/**
 * The elements of a board, flat and in document order, as a surface holds them.
 *
 * The two written tiers of every component and the group joining them to their
 * shape are in the list like everything else, because on a real surface they
 * are elements like everything else: the capability's picking is the only thing
 * that sorts them out, which is exactly what is under test.
 */
function flatten(
  parts: ReturnType<typeof composedBoard>
): readonly GfxPrimitiveElementModel[] {
  return [
    ...parts.boards,
    ...parts.boundaries,
    ...parts.nodes,
    ...(parts.texts ?? []),
    ...(parts.groups ?? []),
    ...parts.connectors,
  ] as unknown as readonly GfxPrimitiveElementModel[];
}

/**
 * The editor's half of the export, faked down to what it actually reads: the
 * surface's elements, the selection, and the document's title.
 */
function fakeStd(
  elements: readonly GfxPrimitiveElementModel[],
  selected: readonly GfxPrimitiveElementModel[],
  title: string | undefined
): BlockStdScope {
  const gfx = {
    surface: { elementModels: elements },
    selection: { selectedElements: selected },
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

const runExport = C4_MERMAID_EXPORT.run;

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('the declaration', () => {
  it('is the triple, and C4 declares no import', () => {
    const provider = mount();

    expect(C4_MERMAID_EXPORT.id).toBe('c4:mermaid:export');
    expect(interchangeCapabilities(provider, { framework: 'c4' })).toEqual([
      C4_MERMAID_EXPORT,
    ]);
    // The writer shipped; nobody has written the reader. The registry says so
    // rather than letting a caller assume the symmetry.
    expect(
      interchangeCapabilities(provider, {
        framework: 'c4',
        direction: 'import',
      })
    ).toEqual([]);
  });

  it('declares `.mmd` as a semantic format', () => {
    // Semantic, so the day an importer lands it owes the full preservation
    // contract — mapped / carried / quarantined (ADR 0012, P2 and D1). No
    // `mime` on the format because mermaid has no registered media type; what
    // the DOWNLOAD is served as is stated on the result instead.
    expect(C4_MERMAID_EXPORT.format).toEqual({
      id: 'mermaid',
      tier: 'semantic',
      extensions: ['.mmd'],
    });
  });
});

describe('the capability resolves and runs', () => {
  const composed = composedBoard();
  const elements = flatten(composed);

  it('runs off the container with plain stubs and no editor', () => {
    const capability = mount().get(InterchangeIdentifier('c4:mermaid:export'));
    if (capability.direction !== 'export') throw new Error('expected export');
    const result = capability.run(elements, { name: 'Internet banking' });

    // Exactly the pure serializer's document: the adapter adds a filename and
    // a content type, and touches not one byte of the text.
    expect(result.text).toBe(exportC4Mermaid(composed));
    expect(result.filename).toBe('Internet banking.mmd');
    expect(result.mime).toBe('text/plain;charset=utf-8');
  });

  it('reads a component through the group, off a flat element list', () => {
    // The one thing the picking had to learn since #165: the technology and the
    // description are canvas TEXT elements grouped with the shape, so a
    // capability that dropped them on the way in would write a file missing
    // every word the author typed under a box.
    const text = runExport(elements, {}).text;
    expect(text).toContain(
      'Container(web_application, "Web Application", "Java and Spring MVC", "Delivers the static content and the banking SPA.")'
    );
  });

  it('picks the C4 artefacts out of a mixed surface and ignores the rest', () => {
    // A brush stroke and a plain shape share the surface with the diagram;
    // neither is something C4 speaks about, and neither may reach the
    // serializer.
    const foreign = [
      { id: 'brush-1', type: 'brush' },
      { id: 'shape-1', type: 'shape' },
    ] as unknown as GfxPrimitiveElementModel[];

    const withForeign = runExport([...elements, ...foreign], { name: 'B' });
    expect(withForeign.text).toBe(runExport(elements, { name: 'B' }).text);
  });

  it('scopes to the boards the caller put in the list', () => {
    // The selection contract: a board left out of the list is a board left out
    // of the file — that is how a caller says "just this one".
    const withoutBoards = runExport(
      elements.filter(element => !composed.boards.includes(element as never)),
      {}
    );
    expect(withoutBoards.text).toBe('C4Context\n');
  });

  it('gives a headless host every board it was handed, one document each', () => {
    // The whole-surface reading: two boards in, two documents out, each
    // announced by its own `%%` signpost.
    const second = composedBoard();
    const both = runExport([...elements, ...flatten(second)], {}).text;
    expect(both.match(/^%% ── /gm)).toHaveLength(2);
  });

  it('names the file when the caller names nothing', () => {
    expect(runExport(elements, {}).filename).toBe('diagram.mmd');
  });

  it('makes a caller-supplied name safe to write to disk', () => {
    // The reserved characters are replaced and the Windows tail is trimmed, so
    // the extension is not the thing that gets eaten.
    expect(runExport(elements, { name: 'Order/to:cash. ' }).filename).toBe(
      'Order-to-cash.mmd'
    );
  });
});

describe('one door, and the command is it', () => {
  it('downloads exactly what the capability produced', () => {
    const composed = composedBoard();
    const elements = flatten(composed);
    const std = fakeStd(elements, composed.boards, 'Internet banking');

    exportC4MermaidFile(std);

    // The FILE the user gets, against the capability's own answer: bytes, name
    // and content type. Driving the real command rather than a copy of it, so
    // the day it post-processes the string this fails.
    const declared = runExport(elements, { name: 'Internet banking' });
    expect(captured.file).not.toBeNull();
    expect(captured.file!.name).toBe(declared.filename);
    expect(captured.file!.blob.type).toBe(declared.mime);
    return expect(captured.file!.blob.text()).resolves.toBe(declared.text);
  });

  it('exports the SELECTED board, not every board on the surface', () => {
    // Two boards drawn side by side, one selected: the command's curated list
    // carries one board, so the file is one document with no signpost — which
    // is what the selection scope has always meant for this framework.
    const composed = composedBoard();
    const elements = flatten(composed);
    const second = composedBoard().boards[0];
    const std = fakeStd(
      [...elements, second] as never,
      composed.boards,
      'Internet banking'
    );

    exportC4MermaidFile(std);

    return expect(captured.file!.blob.text()).resolves.toBe(
      exportC4Mermaid(composed)
    );
  });

  it('takes the filename from the document title, through the same sanitizer', () => {
    const composed = composedBoard();
    const std = fakeStd(flatten(composed), composed.boards, 'Order/to:cash. ');

    exportC4MermaidFile(std);

    expect(captured.file!.name).toBe('Order-to-cash.mmd');
  });
});
