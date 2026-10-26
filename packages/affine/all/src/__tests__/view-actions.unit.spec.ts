/**
 * The view actions (ADR 0034, amendment of 2026-10-13) — what a host lists in
 * the "This view" section of its header menu, read off the command registry.
 *
 * Labre's document page used to build that section by hand: it looked the
 * grid commands up by id, read `CanvasGrid.visible$` itself, called
 * `ExportManager.exportPng()` directly (no usage measured, a download it could
 * not intercept) and armed `PresentTool` with its own 100 ms timer. What this
 * spec pins is the data-driven replacement, on the REAL assembly (the view
 * extensions mounted into a container, the pattern of
 * `selection-pane-row-names.unit.spec.ts`):
 *
 * - the listing is the `'view-menu'` surface of the current mode, in declared
 *   order, flags applied by registration (`frame: false` drops "Present") and
 *   nothing in page mode;
 * - `checked`, `when` and the read-only refusal are state the host can READ,
 *   and follow inside an `effect` — the grid ticks, "Save for everyone"
 *   appears after a toggle, and turns disabled on a read-only document;
 * - `runViewAction` goes through `runCommand`'s bottleneck (usage recorded
 *   once), waits, hands an export's file back instead of downloading it, and
 *   rejects when the export fails; the palette's path still downloads;
 * - with no host at all (no catalogue, no mode provider, no export manager)
 *   it mounts, reads English and lists nothing it cannot run;
 * - the exports of a view (amendment of 2026-10-14) are one section: the
 *   page as Markdown and HTML in both views, and on the canvas one entry per
 *   framework `*:export` capability in the interchange registry — derived,
 *   so a flag that removes the capability removes the entry — each handing
 *   its file back with the framework's telemetry.
 */
import { PresentTool } from '@labre/affine-block-frame';
import {
  ExportManager,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import {
  CanvasGrid,
  DocModeProvider,
  EditPropsStore,
  InvisibleCharacters,
  TranslationProvider,
} from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import {
  type BlockStdScope,
  type CommandFile,
  CommandTelemetryIdentifier,
  CommandUsageIdentifier,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { effect, signal } from '@preact/signals-core';
import * as Y from 'yjs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';
import type { LabreFlags } from '../flags.js';
import {
  getViewActions,
  getViewExports,
  runViewAction,
} from '../host-panels.js';

let seq = 0;

function createBoard() {
  const id = `view-actions-${seq++}`;
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('Board') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  return { store, surface };
}

const PNG: CommandFile = {
  blob: new Blob(['png'], { type: 'image/png' }),
  filename: 'Board.png',
};

interface MountOptions {
  scope?: 'edgeless' | 'page';
  flags?: LabreFlags;
  /** `false` mounts no host service at all: no catalogue, no mode, no export. */
  host?: boolean;
  exporter?: Partial<Pick<ExportManager, 'pngFile' | 'pdfFile'>>;
}

/**
 * One editor scope: the real view extensions of `scope` behind
 * `std.provider` (the registry), a stub `std.get`/`getOptional` for the
 * services the commands read. The grid is the real `CanvasGrid` over a real
 * surface, as in `canvas-grid.unit.spec.ts`.
 */
function mount({
  scope = 'edgeless',
  flags = {},
  host = true,
  exporter,
}: MountOptions = {}) {
  const container = new Container();
  new ViewExtensionManager(getInternalViewExtensions(flags))
    .get(scope)
    .forEach(ext => ext.setup(container));
  const provider = container.provider();

  const { store, surface } = createBoard();
  const setTool = vi.fn();
  // Enough of the controller for the draw.io export to read the canvas: no
  // selection, every element, nothing hidden, the stored order.
  const gfx = {
    surface$: signal(surface),
    surface,
    tool: { setTool },
    selection: { editing: false, selectedElements: [] },
    get gfxElements() {
      return surface.elementModels;
    },
    localVisibility: { isHidden: () => false },
    layer: { compare: () => 0 },
  };
  const services = new Map<unknown, unknown>();
  const std = {
    store,
    provider,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services.get(identifier),
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;

  const usage: string[] = [];
  services.set(CommandUsageIdentifier, {
    record: (command: { id: string }) => usage.push(command.id),
    statsOf: () => undefined,
  });
  const telemetry: unknown[] = [];
  services.set(
    CommandTelemetryIdentifier,
    ({ command }: { command: { telemetry?: unknown } }) =>
      telemetry.push(command.telemetry)
  );
  services.set(EditPropsStore, new EditPropsStore(std));
  const grid = new CanvasGrid(std);
  grid.mounted();
  if (scope === 'edgeless') services.set(CanvasGrid, grid);
  if (host) {
    services.set(DocModeProvider, { getEditorMode: () => scope });
    services.set(TranslationProvider, {
      t: (key: string) =>
        key === 'com.labre.command.canvas.export.png'
          ? 'Exporter en PNG'
          : undefined,
    });
    services.set(ExportManager, {
      pngFile: async () => PNG,
      pdfFile: async () => null,
      ...exporter,
    });
  }
  return { std, store, surface, grid, services, setTool, usage, telemetry };
}

const ids = (std: BlockStdScope) => getViewActions(std).map(a => a.id);
const ids2 = (actions: { id: string }[]) => actions.map(a => a.id);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the listing', () => {
  test('the canvas: the grid, the exports, Present — in that order', () => {
    const { std } = mount();
    // No canvas renderer in this stub, so no SVG; no framework element, so
    // no framework export.
    expect(ids(std)).toEqual([
      'canvas.grid.toggle',
      'text.invisibles.remove',
      'canvas.export.png',
      'canvas.export.pdf',
      'canvas.export.drawio',
      'page.export.markdown',
      'page.export.html',
      'canvas.present',
    ]);
    expect(getViewActions(std).map(a => a.section)).toEqual([
      'display',
      'text',
      'export',
      'export',
      'export',
      'export',
      'export',
      'present',
    ]);
  });

  test('every registered entry is on the view-menu surface', () => {
    const { std } = mount();
    const registered = new Map(getRegisteredCommands(std).map(c => [c.id, c]));
    for (const action of getViewActions(std)) {
      expect(registered.get(action.id)?.surfaces).toContain('view-menu');
    }
  });

  test('the page view lists the page exports and none of the canvas actions', () => {
    expect(ids(mount({ scope: 'page' }).std)).toEqual([
      'text.invisibles.remove',
      'page.export.markdown',
      'page.export.html',
    ]);
  });

  test('an explicit mode wins over the provider', () => {
    // The host shows the page while this scope still answers edgeless (the
    // std is rebuilt per switch): the canvas actions are not this view's.
    const { std } = mount();
    expect(ids2(getViewActions(std, 'page'))).toEqual([
      'text.invisibles.remove',
      'page.export.markdown',
      'page.export.html',
    ]);
    expect(getViewActions(std, 'edgeless')).toHaveLength(8);
  });

  test('a flag removes a tool, never the rest: frame off, no Present', () => {
    const { std } = mount({ flags: { frame: false } });
    expect(ids(std)).not.toContain('canvas.present');
    expect(ids(std)).toContain('canvas.grid.toggle');
  });

  test('labels go through the host catalogue, English otherwise; icons are keys', () => {
    const actions = getViewActions(mount().std);
    const png = actions.find(a => a.id === 'canvas.export.png')!;
    expect(png.label).toBe('Exporter en PNG');
    expect(png.labelKey).toBe('com.labre.command.canvas.export.png');
    expect(png.iconKey).toBe('canvas.export.png');
    expect(actions.find(a => a.id === 'canvas.present')!.label).toBe('Present');
  });
});

describe('state the host can read', () => {
  test('the grid toggle carries a check that follows the grid', () => {
    const { std, grid } = mount();
    const seen: (boolean | undefined)[] = [];
    const stop = effect(() => {
      seen.push(
        getViewActions(std).find(a => a.id === 'canvas.grid.toggle')?.checked
      );
    });
    grid.toggle();
    grid.toggle();
    stop();
    expect(seen).toEqual([true, false, true]);
    // Only a toggle carries the key at all.
    const png = getViewActions(std).find(a => a.id === 'canvas.export.png')!;
    expect('checked' in png).toBe(false);
  });

  test('"Save for everyone" appears after a toggle and leaves after the save', async () => {
    const { std } = mount();
    expect(ids(std)).not.toContain('canvas.grid.saveForEveryone');

    await runViewAction(std, 'canvas.grid.toggle');
    expect(ids(std)).toContain('canvas.grid.saveForEveryone');

    await runViewAction(std, 'canvas.grid.saveForEveryone');
    expect(ids(std)).not.toContain('canvas.grid.saveForEveryone');
  });

  test('a write on a read-only document is listed disabled and refused', async () => {
    const { std, store, surface } = mount();
    await runViewAction(std, 'canvas.grid.toggle');
    store.readonly = true;

    const save = getViewActions(std).find(
      a => a.id === 'canvas.grid.saveForEveryone'
    )!;
    expect(save.disabled).toBe(true);
    // The local toggle writes nothing to the document: a reader may use it.
    expect(
      getViewActions(std).find(a => a.id === 'canvas.grid.toggle')!.disabled
    ).toBe(false);

    await runViewAction(std, 'canvas.grid.saveForEveryone');
    expect(surface.props.showGrid).toBeUndefined();
  });
});

describe('running an entry', () => {
  test('an export hands its file back and downloads nothing', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const { std, usage } = mount();
    const result = await runViewAction(std, 'canvas.export.png');
    expect(result.file).toBe(PNG);
    expect(createObjectURL).not.toHaveBeenCalled();
    // Through the bottleneck, once.
    expect(usage).toEqual(['canvas.export.png']);
  });

  test('draw.io hands back the canvas as a file, and downloads nothing', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const { std, surface, usage } = mount();
    // An empty canvas: no file, no error — the PDF's rule.
    await expect(runViewAction(std, 'canvas.export.drawio')).resolves.toEqual(
      {}
    );

    const id = surface.addElement({
      type: 'shape',
      xywh: '[10,20,100,50]',
      text: new Y.Text('Order'),
    });
    const { file } = await runViewAction(std, 'canvas.export.drawio');
    expect(file?.filename).toMatch(/\.drawio$/);
    const text = await file!.blob.text();
    expect(text).toContain(
      `<object id="${id}" label="Order" labre-type="shape">`
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(usage).toEqual(['canvas.export.drawio', 'canvas.export.drawio']);
  });

  test('nothing to draw: no file, no error', async () => {
    const { std } = mount();
    await expect(runViewAction(std, 'canvas.export.pdf')).resolves.toEqual({});
  });

  test('a failed export rejects, so the host can say so', async () => {
    const { std } = mount({
      exporter: { pngFile: () => Promise.reject(new Error('tainted canvas')) },
    });
    await expect(runViewAction(std, 'canvas.export.png')).rejects.toThrow(
      'tainted canvas'
    );
  });

  test('the palette path, with no one to hand the file to, downloads it', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:png');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { std } = mount();
    const command = getRegisteredCommands(std).find(
      c => c.id === 'canvas.export.png'
    )!;
    runCommand(std, command, { surface: 'palette', source: 'shortcut' });
    await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
    expect(createObjectURL).toHaveBeenCalledWith(PNG.blob);
  });

  test('Present arms the presentation tool, fit unless the viewer chose fill', async () => {
    const { std, setTool } = mount();
    await runViewAction(std, 'canvas.present');
    expect(setTool).toHaveBeenLastCalledWith(PresentTool, { mode: 'fit' });

    std.get(EditPropsStore).setStorage('presentFillScreen', true);
    await runViewAction(std, 'canvas.present');
    expect(setTool).toHaveBeenLastCalledWith(PresentTool, { mode: 'fill' });
  });

  test('an id that is not a view action here runs nothing', async () => {
    const { std, usage } = mount();
    await expect(runViewAction(std, 'canvas.frame.reorder')).resolves.toEqual(
      {}
    );
    await expect(runViewAction(std, 'nope')).resolves.toEqual({});
    expect(usage).toEqual([]);
  });
});

describe('with no host', () => {
  test('mounts, reads English, and lists only what it can run', async () => {
    const { std, usage } = mount({ host: false });
    // No `ExportManager`: the picture exports do not apply, so they are not
    // listed. draw.io needs no host — it writes what the canvas holds.
    expect(ids(std)).toEqual([
      'canvas.grid.toggle',
      'text.invisibles.remove',
      'canvas.export.drawio',
      'page.export.markdown',
      'page.export.html',
      'canvas.present',
    ]);
    expect(getViewActions(std)[0]!.label).toBe('Show or hide the grid');
    await expect(runViewAction(std, 'canvas.export.png')).resolves.toEqual({});
    expect(usage).toEqual([]);
  });
});

describe('the exports of a view', () => {
  /** A Wardley map on the canvas: the one thing an `.owm` export writes. */
  const addMap = (surface: SurfaceBlockModel) =>
    surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  test('getViewExports is the export section, in the listing order', () => {
    const { std, surface } = mount();
    addMap(surface);
    expect(ids2(getViewExports(std))).toEqual([
      'canvas.export.png',
      'canvas.export.pdf',
      'canvas.export.drawio',
      'canvas.export.wardley.owm',
      'page.export.markdown',
      'page.export.html',
    ]);
    expect(ids2(getViewExports(std, 'page'))).toEqual([
      'page.export.markdown',
      'page.export.html',
    ]);
  });

  test('a framework format is listed while the board holds that framework', () => {
    const { std, surface } = mount();
    expect(ids(std)).not.toContain('canvas.export.wardley.owm');
    const id = addMap(surface);
    expect(ids(std)).toContain('canvas.export.wardley.owm');
    surface.deleteElement(id);
    expect(ids(std)).not.toContain('canvas.export.wardley.owm');
  });

  test('its label names the framework and the extension, through the catalogue', () => {
    const { std, surface } = mount();
    addMap(surface);
    const owm = getViewExports(std).find(
      a => a.id === 'canvas.export.wardley.owm'
    )!;
    expect(owm.label).toBe('Export Wardley map as .owm');
    expect(owm.labelKey).toBe('com.labre.command.canvas.export.interchange');
    expect(owm.labelParams).toEqual({
      framework: 'Wardley map',
      extension: '.owm',
    });
    expect(owm.iconKey).toBe('canvas.export.interchange');
    expect(owm.disabled).toBe(false);
  });

  test('a flag that removes the capability removes the entry, not the drawing', () => {
    const { std, surface } = mount({ flags: { wardley: false } });
    addMap(surface);
    expect(ids(std)).not.toContain('canvas.export.wardley.owm');
    expect(ids(std)).toContain('canvas.export.drawio');
  });

  test('every framework capability yields one entry, the canvas draw.io none', () => {
    const { std, surface } = mount();
    // One element of each framework that writes a format.
    for (const role of ['bpmn:task', 'c4:system', 'uml:class'] as const) {
      surface.addElement({ type: 'shape', role, xywh: '[0,0,10,10]' });
    }
    addMap(surface);
    expect(
      ids(std).filter(id => /^canvas\.export\.\w+\.\w+$/.test(id))
    ).toEqual([
      'canvas.export.bpmn.bpmn',
      'canvas.export.c4.mermaid',
      'canvas.export.uml.plantuml',
      'canvas.export.uml.xmi',
      'canvas.export.wardley.owm',
    ]);
    expect(ids(std)).not.toContain('canvas.export.canvas.drawio');
  });

  test('a framework export hands its file back, with its telemetry', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const { std, surface, usage, telemetry } = mount();
    addMap(surface);
    const { file } = await runViewAction(std, 'canvas.export.wardley.owm');
    expect(file?.filename).toBe('Board.owm');
    expect(file?.blob.type).toBe('text/plain;charset=utf-8');
    expect(await file!.blob.text()).toContain('title Board');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(usage).toEqual(['canvas.export.wardley.owm']);
    expect(telemetry).toEqual([
      { framework: 'wardley', element: 'canvas:export-owm' },
    ]);
  });

  test('the page as Markdown and as HTML, handed back', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const { std, store, usage } = mount({ scope: 'page' });
    const root = store.root!;
    const note = store.addBlock('affine:note', {}, root.id);
    store.addBlock(
      'affine:paragraph',
      { text: new Text('Order to cash') },
      note
    );

    const md = await runViewAction(std, 'page.export.markdown');
    expect(md.file?.filename).toBe('Board.md');
    expect(await md.file!.blob.text()).toContain('Order to cash');

    const html = await runViewAction(std, 'page.export.html');
    expect(html.file?.filename).toBe('Board.html');
    expect(await html.file!.blob.text()).toContain('Order to cash');

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(usage).toEqual(['page.export.markdown', 'page.export.html']);
  });
});

describe('special characters (text.invisibles.*)', () => {
  /** The real `InvisibleCharacters`, as the root view extension registers it. */
  function mountWithDisplay(scope: 'edgeless' | 'page' = 'edgeless') {
    const mounted = mount({ scope });
    const display = new InvisibleCharacters(mounted.std);
    mounted.services.set(InvisibleCharacters, display);
    return { ...mounted, display };
  }

  test('both views list the toggle and the removal, after the grid', () => {
    expect(ids(mountWithDisplay().std).slice(0, 3)).toEqual([
      'canvas.grid.toggle',
      'text.invisibles.toggle',
      'text.invisibles.remove',
    ]);
    expect(ids(mountWithDisplay('page').std)).toEqual([
      'text.invisibles.toggle',
      'text.invisibles.remove',
      'page.export.markdown',
      'page.export.html',
    ]);
  });

  test('the toggle carries a check that follows the display', async () => {
    const { std, display } = mountWithDisplay('page');
    const seen: (boolean | undefined)[] = [];
    const stop = effect(() => {
      seen.push(
        getViewActions(std).find(a => a.id === 'text.invisibles.toggle')
          ?.checked
      );
    });
    // Through the command, with no telemetry provider: it still toggles.
    await runViewAction(std, 'text.invisibles.toggle');
    display.toggle();
    stop();
    expect(seen).toEqual([false, true, false]);
  });

  test('a reader may show the characters but not remove them', () => {
    const { std, store } = mountWithDisplay('page');
    store.readonly = true;
    const actions = getViewActions(std);
    expect(actions.find(a => a.id === 'text.invisibles.toggle')!.disabled).toBe(
      false
    );
    expect(actions.find(a => a.id === 'text.invisibles.remove')!.disabled).toBe(
      true
    );
  });
});
