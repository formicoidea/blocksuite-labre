import {
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
} from '@labre/affine-block-surface';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { type BlockStdScope, isCommandAvailable } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportOwmFile, wardleyMapsOnBoard } from '../actions';
import { wardleyCommandIcons, wardleyCommands } from '../commands';
import {
  WARDLEY_INTERCHANGE,
  WARDLEY_OWM_EXPORT,
  WARDLEY_OWM_IMPORT,
} from '../interchange';
import {
  board,
  fakeMap,
  fakeNode,
  flatten,
  teaShopBoard,
} from './owm-board-stub';

/**
 * Wardley's entries in the interchange registry (`docs/adr/0012`).
 *
 * Three things are pinned here. That both capabilities RESOLVE and RUN off a
 * bare DI container with plain stubs, which is P3's purity requirement stated
 * as a test. That the shipped `wardley.exportOwm` command downloads exactly
 * what the capability produced — bytes, filename and content type. And that the
 * two descriptors declare what the PO decision of 2026-08-28 says they declare.
 */

/* ── The command's one side effect, captured ──────────────────────────── */

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
  InterchangeExtension(WARDLEY_INTERCHANGE).setup!(container);
  return container.provider();
}

/** The editor's half of the export, faked down to what it actually reads. */
function fakeStd(
  elements: readonly GfxPrimitiveElementModel[],
  options: { title?: string; readonly?: boolean; notify?: boolean } = {}
) {
  const notify = vi.fn();
  const gfx = {
    surface: { elementModels: elements },
    selection: { selectedElements: [] },
  };
  const std = {
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
    store: {
      id: 'doc-1',
      readonly: options.readonly === true,
      workspace: { meta: { getDocMeta: () => ({ title: options.title }) } },
    },
  } as unknown as BlockStdScope;
  return { std, notify };
}

const runExport = WARDLEY_OWM_EXPORT.run;

/* ── The declaration ──────────────────────────────────────────────────── */

describe('the declaration', () => {
  it('is the triple, and Wardley now declares both directions of it', () => {
    const provider = mount();

    expect(WARDLEY_OWM_EXPORT.id).toBe('wardley:owm:export');
    expect(WARDLEY_OWM_IMPORT.id).toBe('wardley:owm:import');
    // Sorted by id, which is what makes a menu built from this list come out in
    // the same order on every boot: `export` before `import`, and the OWM pair
    // before the `svg` row that joined them.
    expect(
      interchangeCapabilities(provider, { framework: 'wardley', format: 'owm' })
    ).toEqual([WARDLEY_OWM_EXPORT, WARDLEY_OWM_IMPORT]);
    expect(
      interchangeCapabilities(provider, {
        framework: 'wardley',
        format: 'owm',
        direction: 'import',
      })
    ).toEqual([WARDLEY_OWM_IMPORT]);
  });

  it('reads and writes through ONE format object, which is the payload key', () => {
    // `owm` is the key foreign matter rides under on an element (D2). Two
    // format objects that agreed today would be two things to keep in step, and
    // the failure would be silent.
    expect(WARDLEY_OWM_IMPORT.format).toBe(WARDLEY_OWM_EXPORT.format);
  });

  it('declares `.owm` as a semantic format, with `.wm` behind it', () => {
    // SEMANTIC, and it earns it: a `[visibility, evolution]` pair IS a position
    // on the two axes, so the import is a translation rather than recognition
    // and needs no invented axis (P2, D4).
    expect(WARDLEY_OWM_EXPORT.format).toEqual({
      id: 'owm',
      tier: 'semantic',
      extensions: ['.owm', '.wm'],
      mime: 'text/plain',
    });
  });
});

describe('the capability resolves and runs', () => {
  const elements = flatten(
    teaShopBoard()
  ) as unknown as GfxPrimitiveElementModel[];

  it('runs off the container with plain stubs and no editor', () => {
    const capability = mount().get(InterchangeIdentifier('wardley:owm:export'));
    if (capability.direction !== 'export') throw new Error('expected export');
    const result = capability.run(elements, { name: 'Tea Shop' });

    expect(result.text).toContain('component "Cup of Tea" [0.74, 0.62]');
    expect(result.filename).toBe('Tea Shop.owm');
    expect(result.mime).toBe('text/plain');
  });

  it('reads a file off the container the same way', () => {
    const capability = mount().get(InterchangeIdentifier('wardley:owm:import'));
    if (capability.direction !== 'import') throw new Error('expected import');
    const result = capability.run('component Kettle [0.6, 0.4]\n', {});

    expect(result.elements[0].type).toBe('wardley');
    expect(result.report.mapped).toBe(1);
  });

  it('names the file when the caller names nothing', () => {
    expect(runExport(elements, {}).filename).toBe('map.owm');
  });

  it('makes a caller-supplied name safe to write to disk', () => {
    expect(runExport(elements, { name: 'Tea/shop:2026. ' }).filename).toBe(
      'Tea-shop-2026.owm'
    );
  });

  it('omits the warnings channel when the map came out whole', () => {
    expect(runExport(elements, { name: 'Tea Shop' }).warnings).toBeUndefined();
  });
});

/* ── One door, and the command is it ──────────────────────────────────── */

describe('the export command', () => {
  const descriptor = wardleyCommands.find(c => c.id === 'wardley.exportOwm');

  it('downloads exactly what the capability produced', () => {
    const elements = flatten(
      teaShopBoard()
    ) as unknown as GfxPrimitiveElementModel[];
    const { std } = fakeStd(elements, { title: 'Tea Shop' });

    exportOwmFile(std);

    const declared = runExport(elements, { name: 'Tea Shop' });
    expect(captured.file).not.toBeNull();
    expect(captured.file!.name).toBe(declared.filename);
    expect(captured.file!.blob.type).toBe(`${declared.mime};charset=utf-8`);
    return expect(captured.file!.blob.text()).resolves.toBe(declared.text);
  });

  it('takes the filename from the document title, through the same sanitizer', () => {
    const { std } = fakeStd(
      flatten(teaShopBoard()) as unknown as GfxPrimitiveElementModel[],
      { title: 'Tea/shop:2026. ' }
    );
    exportOwmFile(std);
    expect(captured.file!.name).toBe('Tea-shop-2026.owm');
  });

  it('tells the user what the format could not write down', () => {
    // The `warnings` channel, spent. A file that downloaded and is valid, and a
    // sentence the board held that it could not carry — the person who clicked
    // Export is the one entitled to hear about it.
    const elements = flatten(
      board({
        maps: [fakeMap(), fakeMap([2000, 0, 1600, 900])],
        nodes: [fakeNode('n', 'component', [100, 100, 18, 18])],
      })
    ) as unknown as GfxPrimitiveElementModel[];
    const { std, notify } = fakeStd(elements, { title: 'Two maps' });

    exportOwmFile(std);

    expect(captured.file).not.toBeNull();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].accent).toBe('warning');
    expect(notify.mock.calls[0][0].message).toContain('2 Wardley maps');
  });

  it('downloads in silence when there is nothing to say', () => {
    const { std, notify } = fakeStd(
      flatten(teaShopBoard()) as unknown as GfxPrimitiveElementModel[],
      { title: 'Tea Shop' }
    );
    exportOwmFile(std);
    expect(notify).not.toHaveBeenCalled();
  });

  it('declares itself as an action on a board that has a map', () => {
    expect(descriptor).toBeDefined();
    expect(descriptor!.kind).toBe('action');
    expect(descriptor!.owner).toBe('wardley');
    expect(descriptor!.scope).toBe('edgeless');
    // Filed with the import it is the other half of: the two directions of one
    // format are one subject.
    expect(descriptor!.category).toBe('interchange');
    // An export READS: no selection, and offered on a locked map and on a
    // read-only document — which is precisely the board somebody wants to take
    // away. What it needs is a MAP, and that is a `when` on the board.
    expect(descriptor!.availability).toBe('always');
    expect(descriptor!.iconKey).toBe('wardley.export-owm');
    expect(descriptor!.defaultKeys).toEqual({ mac: [], other: [] });
    expect(descriptor!.telemetry).toEqual({
      framework: 'wardley',
      element: 'board:export-owm',
    });
  });

  it('declines the sub-menu, and declares no toolbar nothing renders', () => {
    // Two decisions. The sub-menu is where a board COMES FROM and an export is
    // what you do to a board you already have (BPMN's ruling). And no
    // `'contextual-toolbar'`: that surface is rendered by an element's own
    // `ToolbarModuleConfig`, and declaring one nothing invokes would put an
    // entry in the manifest no toolbar draws.
    expect(descriptor!.surfaces).toEqual(['catalogue', 'palette', 'agent']);
  });

  it('needs a map on the board, and nothing selected', () => {
    // A Wardley node has no `visibility` prop — its position on the plot IS its
    // coordinate — so without a plot there is nothing to invert. That is a fact
    // about the SURFACE, which is why the `when` reads the board and the
    // `availability` asks for no selection at all.
    const withMap = fakeStd(
      flatten(teaShopBoard()) as unknown as GfxPrimitiveElementModel[]
    ).std;
    const without = fakeStd([]).std;

    expect(wardleyMapsOnBoard(withMap)).toHaveLength(1);
    expect(wardleyMapsOnBoard(without)).toHaveLength(0);
    expect(descriptor!.when!(withMap)).toBe(true);
    expect(descriptor!.when!(without)).toBe(false);
    // …and the serializable half says yes on both, because a `when` is the
    // in-editor refinement and never folded into what a host catalogue reads.
    expect(isCommandAvailable(withMap, descriptor!)).toBe(true);
  });

  it('is offered on a read-only document, because it only reads', () => {
    const readonly = fakeStd(
      flatten(teaShopBoard()) as unknown as GfxPrimitiveElementModel[],
      { readonly: true }
    ).std;
    expect(isCommandAvailable(readonly, descriptor!)).toBe(true);
    expect(descriptor!.when!(readonly)).toBe(true);
  });

  it('carries a label and a description through the i18n seam', () => {
    expect(descriptor!.labelKey).toBe('com.labre.commands.wardley.exportOwm');
    expect(descriptor!.labelFallback).toBe('Export Wardley map (OWM)');
    expect(descriptor!.descriptionKey).toBe(
      'com.labre.commands.wardley.exportOwm.description'
    );
    expect(descriptor!.descriptionFallback).toBeTruthy();
  });
});

/* ── The catalogue ────────────────────────────────────────────────────── */

describe('the Wardley catalogue', () => {
  it('groups the interchange pair into a section of its own', () => {
    const categories = [...new Set(wardleyCommands.map(c => c.category))];
    // Last, and last on purpose: what you do WITH a map — the two directions of
    // the OWM DSL, and the SVG fallback that reads a picture of one — after the
    // three sections of what you draw one with.
    expect(categories).toEqual([
      'backgrounds',
      'nodes',
      'connectors',
      'interchange',
    ]);
    // The native format both ways, then the best-effort reader: declaration
    // order, and also the order somebody scanning "what can I do with a file"
    // wants it in (`docs/adr/0012`, P2).
    expect(
      wardleyCommands.filter(c => c.category === 'interchange').map(c => c.id)
    ).toEqual(['wardley.importOwm', 'wardley.exportOwm', 'wardley.importSvg']);
  });

  it('keeps every command in the catalogue, whatever else it declines', () => {
    // The registry's own invariant, not a category claim: a command missing
    // from the catalogue is unreachable the moment its framework overflows the
    // fourteen sub-menu slots.
    expect(wardleyCommands.every(c => c.surfaces.includes('catalogue'))).toBe(
      true
    );
  });

  it('nominates every artefact for the sub-menu, per the 2026-09-03 ruling', () => {
    const nominated = wardleyCommands.filter(c =>
      c.surfaces.includes('senior-menu')
    );
    // Seventeen, which is past `SENIOR_MENU_CAP + 1` (ADR 0014, R4) on purpose:
    // the two climate arrows were the sixteenth and seventeenth nomination, and
    // the PO answered the curation question R4 raises rather than curating the
    // list (Amendment 2026-09-03). Every artefact nominates; the row still
    // seats thirteen plus "More artefacts…".
    expect(nominated).toHaveLength(17);
    // The two entries that DECLINE the row are the only ones missing, and both
    // decline by declaration rather than by omission.
    expect(
      wardleyCommands
        .filter(c => !c.surfaces.includes('senior-menu'))
        .map(c => c.id)
    ).toEqual(['wardley.exportOwm', 'wardley.importSvg']);
    // The import is the last of them — an import is where a board comes from,
    // and on an empty canvas the sub-menu is the first thing a user opens (PO
    // decision of 2026-08-28).
    expect(nominated.at(-1)!.id).toBe('wardley.importOwm');
  });

  it('gives every command an icon, the two new ones included', () => {
    // `iconKey` → template. A key with no template renders an empty button, and
    // nothing else in the chain notices.
    for (const command of wardleyCommands) {
      expect(command.iconKey, command.id).toBeDefined();
      expect(wardleyCommandIcons[command.iconKey!], command.id).toBeDefined();
    }
    expect(wardleyCommandIcons['wardley.import-owm']).toBeDefined();
    expect(wardleyCommandIcons['wardley.export-owm']).toBeDefined();
  });
});
