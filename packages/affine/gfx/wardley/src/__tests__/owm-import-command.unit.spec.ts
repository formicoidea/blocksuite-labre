import { ConnectorElementModel } from '@labre/affine-model';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import { type BlockStdScope, isCommandAvailable } from '@labre/std';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { importOwmFile } from '../actions';
import { wardleyCommands } from '../commands';
import { WARDLEY_OWM_FORMAT_ID } from '../export';
import { importWardleyOwm } from '../import';
import { WARDLEY_ROLE } from '../roles';
import { KITCHEN_SINK_OWM, TEA_SHOP_OWM } from './owm-corpus';

/**
 * The `.owm` import COMMAND — the half of `docs/adr/0012` that has an editor
 * in it.
 *
 * The reader is pure and is proved pure next door (`owm-import.unit.spec.ts`).
 * What is proved HERE is everything the reader deliberately refuses to do: pick
 * a file, mint surface ids, rewrite the link endpoints that named the file's
 * NAMES, bring the map into view, and say what it cost.
 *
 * The picker is mocked and nothing else is: `openSingleFileWithSpec` is a
 * browser dialog and there is no version of it that answers in a unit suite.
 * The capability, the reader, the id remapping, the generic pipeline
 * (`affine-block-surface`, `extensions/interchange-import.ts`) and the
 * notification seam are all the shipped ones.
 */

const picked = vi.hoisted(() => ({ file: vi.fn() }));

vi.mock('@labre/affine-shared/utils', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@labre/affine-shared/utils')>();
  return { ...actual, openSingleFileWithSpec: picked.file };
});

/* ── The stubs ────────────────────────────────────────────────────────── */

type Props = Record<string, unknown> & { type: string };

/**
 * A surface that mints ids and hands models back — the two halves of
 * `addElement` the id remapping actually depends on.
 *
 * Connectors are prototype-grafted onto the real `ConnectorElementModel`,
 * because the rewrite is guarded by an `instanceof` and a stub that failed it
 * would pass this spec by doing nothing.
 */
class StubSurface {
  readonly added: Props[] = [];
  private readonly models = new Map<string, unknown>();
  private seq = 0;

  addElement(props: Props): string {
    const id = `minted-${++this.seq}`;
    this.added.push({ ...props });
    if (props.type === 'connector') {
      const connector = Object.create(ConnectorElementModel.prototype);
      Object.defineProperties(connector, {
        id: { value: id, enumerable: true },
        role: { value: props.role, enumerable: true },
        // The origin with no size, and it is the POINT: a connector's bound
        // comes off the path the connector manager routes between its ends, and
        // that path is computed on a later tick than the `addElement` that made
        // it. The pipeline drops zero-area boxes for exactly this reason.
        elementBound: { value: new Bound(0, 0, 0, 0) },
        source: { value: props.source, writable: true, enumerable: true },
        target: { value: props.target, writable: true, enumerable: true },
      });
      this.models.set(id, connector);
    } else {
      this.models.set(id, {
        ...props,
        id,
        elementBound: Bound.deserialize(String(props.xywh ?? '[0,0,10,10]')),
      });
    }
    return id;
  }

  getElementById(id: string): unknown {
    return this.models.get(id);
  }
}

function stubEditor(options: { notify?: boolean; readonly?: boolean } = {}) {
  const surface = new StubSurface();
  const notify = vi.fn();
  const setViewportByBound = vi.fn();
  const setTool = vi.fn();
  const captureSync = vi.fn();
  const gfx = {
    surface,
    viewport: { zoom: 1, centerX: 0, centerY: 0, setViewportByBound },
    tool: { setTool },
    selection: { selectedElements: [], set: vi.fn(), clear: vi.fn() },
  };
  const std = {
    get: () => gfx,
    // By IDENTIFIER, not blanket: `translateKey` reaches for the translation
    // seam through the same door, and a stub answering every lookup with a
    // notification service would make every wording throw.
    getOptional: (identifier: unknown) =>
      identifier === NotificationProvider && options.notify !== false
        ? { notify }
        : undefined,
    store: {
      readonly: options.readonly === true,
      captureSync,
      id: 'doc-1',
      workspace: { meta: { getDocMeta: () => ({ title: 'Tea Shop' }) } },
    },
  } as unknown as BlockStdScope;

  return { std, surface, notify, setViewportByBound, setTool, captureSync };
}

const asFile = (text: string, name = 'map.owm') =>
  ({ name, text: () => Promise.resolve(text) }) as unknown as File;

beforeEach(() => {
  picked.file.mockReset();
  vi.restoreAllMocks();
});

/* ── The descriptor ───────────────────────────────────────────────────── */

describe('the import command', () => {
  const descriptor = wardleyCommands.find(c => c.id === 'wardley.importOwm');

  it('declares itself as a document-level action that needs no selection', () => {
    expect(descriptor).toBeDefined();
    expect(descriptor!.kind).toBe('action');
    expect(descriptor!.owner).toBe('wardley');
    expect(descriptor!.scope).toBe('edgeless');
    expect(descriptor!.category).toBe('interchange');
    // Nothing has to be SELECTED, and there is no `when` to narrow it — but it
    // WRITES, so a read-only document is one it cannot run on and the
    // declaration says so rather than lighting a dead entry.
    expect(descriptor!.availability).toBe('editable');
    expect(descriptor!.when).toBeUndefined();
    expect(descriptor!.iconKey).toBe('wardley.import-owm');
    expect(descriptor!.defaultKeys).toEqual({ mac: [], other: [] });
    expect(descriptor!.telemetry).toEqual({
      framework: 'wardley',
      element: 'board:import-owm',
    });
  });

  it('withdraws from every surface on a read-only document', () => {
    expect(isCommandAvailable(stubEditor().std, descriptor!)).toBe(true);
    expect(
      isCommandAvailable(stubEditor({ readonly: true }).std, descriptor!)
    ).toBe(false);
  });

  it('takes the sub-menu, the catalogue, the palette and the agent', () => {
    // `'senior-menu'` per the PO decision of 2026-08-28: an interpreted import
    // lives in its framework's sub-menu, because on an empty canvas that row is
    // the first thing a user opens and "start from the map somebody sent me"
    // belongs in it.
    //
    // Still not the contextual toolbar: that is a statement about a SELECTION,
    // and the moment this is most wanted is on an empty board.
    expect(descriptor!.surfaces).toEqual([
      'senior-menu',
      'catalogue',
      'palette',
      'agent',
    ]);
  });

  it('carries a label and a description through the i18n seam', () => {
    expect(descriptor!.labelKey).toBe('com.labre.commands.wardley.importOwm');
    expect(descriptor!.labelFallback).toBe('Import Wardley map (OWM)');
    expect(descriptor!.descriptionKey).toBe(
      'com.labre.commands.wardley.importOwm.description'
    );
    expect(descriptor!.descriptionFallback).toBeTruthy();
  });
});

/* ── The gesture ──────────────────────────────────────────────────────── */

describe('reading a file the user picked', () => {
  it('draws the map and every artefact on it', async () => {
    const { std, surface, setTool, captureSync } = stubEditor();
    picked.file.mockResolvedValue(asFile(TEA_SHOP_OWM));

    await importOwmFile(std);

    const { elements } = importWardleyOwm(TEA_SHOP_OWM, { name: 'map.owm' });
    expect(surface.added.map(props => props.type)).toEqual(
      elements.map(props => props.type)
    );
    // One undo step for the whole file: `captureSync` opens the boundary and
    // closes it. An import a user has to undo forty times is one they cannot.
    expect(captureSync).toHaveBeenCalledTimes(2);
    expect(setTool).toHaveBeenCalled();
  });

  it('rewrites a link onto the ids the surface minted, not the file’s names', async () => {
    const { std, surface } = stubEditor();
    picked.file.mockResolvedValue(asFile(TEA_SHOP_OWM));

    // Before: the two ends name the FILE's NAMES, which is exactly what the
    // reader's contract says it hands over — OWM has no ids, so the name IS the
    // identity (D3).
    const { elements } = importWardleyOwm(TEA_SHOP_OWM);
    const edge = elements.find(props => props.type === 'connector');
    expect((edge!.source as { id: string }).id).toBe('Client');

    await importOwmFile(std);

    const minted = new Map<string, string>();
    surface.added.forEach((props, index) => {
      const carried = props.interchange as
        | Record<string, { id?: string }>
        | undefined;
      const source = carried?.[WARDLEY_OWM_FORMAT_ID]?.id;
      if (source !== undefined && !minted.has(source)) {
        minted.set(source, `minted-${index + 1}`);
      }
    });

    const connectors = surface.added
      .map((_, index) => surface.getElementById(`minted-${index + 1}`))
      .filter(
        (model): model is ConnectorElementModel =>
          model instanceof ConnectorElementModel
      );
    expect(connectors).toHaveLength(30);
    for (const connector of connectors) {
      for (const side of ['source', 'target'] as const) {
        // A MINTED id, and the one belonging to the artefact the file named —
        // not a passthrough, and not a fresh guess.
        expect([...minted.values()]).toContain(connector[side]?.id);
      }
    }
    expect(connectors[0].source?.id).toBe(minted.get('Client'));
  });

  it('brings the drawing into view, ignoring the boxes with no area', async () => {
    const { std, setViewportByBound } = stubEditor();
    picked.file.mockResolvedValue(asFile(TEA_SHOP_OWM));

    await importOwmFile(std);

    expect(setViewportByBound).toHaveBeenCalledTimes(1);
    const bound = setViewportByBound.mock.calls[0][0];
    // The map is 1600 × 900 at the origin, everything sits on it, and the widest
    // label overhangs its right edge by a few units. What matters is that the
    // box is the DRAWING's and not one stretched by a connector's synchronous
    // `[0, 0, 0, 0]` — the failure mode that fits a whole process into a speck.
    expect(bound.w).toBeGreaterThanOrEqual(1600);
    expect(bound.w).toBeLessThan(1700);
    expect(bound.h).toBe(900);
  });

  it('writes the foreign payload as the one whole blob it arrived as', async () => {
    const { std, surface } = stubEditor();
    picked.file.mockResolvedValue(asFile(KITCHEN_SINK_OWM));

    await importOwmFile(std);

    // The map, and the document's residue riding on it (D6).
    const map = surface.added[0];
    expect(map.type).toBe('wardley');
    const carried = (
      map.interchange as Record<string, { children?: Record<string, string[]> }>
    )[WARDLEY_OWM_FORMAT_ID];
    expect(carried.children!['@document']).toContain('style wardley');
  });

  it('says what the import cost, in counts and then in remarks', async () => {
    const { std, notify } = stubEditor();
    picked.file.mockResolvedValue(asFile(TEA_SHOP_OWM));

    await importOwmFile(std);

    // Two: the summary, then the remarks. The format names ITSELF in the
    // sentence — one set of keys for every format, with `owm` upper-cased into
    // them.
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0].title).toContain('OWM');
    expect(notify.mock.calls[0][0].message).toContain('58');
    expect(notify.mock.calls[1][0].accent).toBe('warning');
    // The one thing this file left unsaid, named: `anchor Client` carries no
    // coordinates, so the reader laid one out and says so.
    expect(notify.mock.calls[1][0].message).toContain('Client');
  });

  it('says nothing beyond the summary when the file cost nothing', async () => {
    const { std, notify } = stubEditor();
    picked.file.mockResolvedValue(
      asFile('title Small\ncomponent Kettle [0.6, 0.4]\n')
    );

    await importOwmFile(std);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].accent).toBe('info');
  });

  it('does nothing at all when the user closes the picker', async () => {
    const { std, surface, notify } = stubEditor();
    picked.file.mockResolvedValue(undefined);

    await importOwmFile(std);

    expect(surface.added).toEqual([]);
    // Not a failure, and not a notification: they know what they just did.
    expect(notify).not.toHaveBeenCalled();
  });

  it('refuses to write to a read-only document, picker and all', async () => {
    const { std, surface } = stubEditor({ readonly: true });
    picked.file.mockResolvedValue(asFile(TEA_SHOP_OWM));

    await importOwmFile(std);

    expect(picked.file).not.toHaveBeenCalled();
    expect(surface.added).toEqual([]);
  });

  it('asks the picker for the extensions the FORMAT declares', async () => {
    const { std } = stubEditor();
    picked.file.mockResolvedValue(undefined);

    await importOwmFile(std);

    expect(picked.file).toHaveBeenCalledWith({
      description: 'OWM',
      accept: { 'text/plain': ['.owm', '.wm'] },
    });
  });

  it('runs with no notification service at all', async () => {
    // The standalone playground injects none, and an import that assumed one
    // would be an import it cannot run. The elements land either way.
    const { std, surface } = stubEditor({ notify: false });
    picked.file.mockResolvedValue(asFile('component Kettle [0.6, 0.4]\n'));

    await importOwmFile(std);

    expect(
      surface.added.some(props => props.role === WARDLEY_ROLE.component)
    ).toBe(true);
  });
});
