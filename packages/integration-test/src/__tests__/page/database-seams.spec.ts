import {
  addProperty,
  createHostedDatabaseView,
  type DatabaseBlockComponent,
  databaseBlockProperties,
  DatabaseBlockDataSource,
  DatabaseDataSourceProvider,
  DatabaseNewRowMenuExtension,
  type DatabaseNewRowMenuRequest,
  DatabaseOpenRowExtension,
  type DatabaseOpenRowRequest,
  insertLinkedDatabaseView,
} from '@labre/affine/blocks/database';
import { viewOpenInSet } from '@labre/affine/data-view';
import type { DatabaseBlockModel } from '@labre/affine/model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerExtension,
  PropertiesPanelExtension,
  type PropertiesPanelRequest,
} from '@labre/affine/shared/services';
import type { DatabasePropertiesPanel } from '@labre/affine-database-editor/view';
import { type ExtensionType, Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The database seams a host fills, in a real editor (ADR 0035 §9a to §9c,
 * issues B9, B10, B12). The unit specs pin each seam's absent story and its
 * pure rules; this one proves the block actually routes through them.
 *
 * What it would have caught:
 * - a row of a source whose rows are documents still opening the library's
 *   own detail when the host registered an opener, or opening in another
 *   mode than the view's stored `openIn`, or a Ctrl/Cmd click not sent as a
 *   new tab; a row that is a block (an inline database) sent to the host;
 * - the view setting "Open pages in" (`viewOpenInSet`, B8) writing an
 *   `openIn` the opener does not read back as the request's `mode`;
 * - the view options' "Properties" popping the popover instead of asking the
 *   host's panel, with the wrong view or source;
 * - the library's properties panel element not drawing the view's own
 *   properties list, or its "Hide all" not writing through the view;
 * - a linked view inserted without the host's database id, without the
 *   chosen `sourceId`, unrendered, or as more than one undo step;
 * - a database created by the host's `createDatabase` not landing as a view
 *   of its first source;
 * - a chevron beside "New" drawn without the host's menu, or where its
 *   `canOpen` says no (an inline table of a base), the chevron not
 *   naming its block and view, or "New" itself no longer adding a row (where
 *   a host applies its default template) once the menu is there.
 */

/** A host source whose rows are documents (the Labre app's bases). */
class DocumentRowsSource extends DatabaseBlockDataSource {
  override get rowsAreDocuments() {
    return true;
  }
}

const hostSources: ExtensionType = {
  setup: di => {
    di.override(DatabaseDataSourceProvider, () => ({
      createDataSource: (model, init) => new DocumentRowsSource(model, init),
    }));
  },
};

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

let cleanup: (() => void) | undefined;

afterEach(() => {
  for (const layer of document.querySelectorAll(
    'body > [data-range-sync-exclude]'
  )) {
    layer.remove();
  }
  document.querySelector('affine-database-properties-panel')?.remove();
  cleanup?.();
  cleanup = undefined;
});

function writeDatabase(options: { hosted: boolean; openIn?: string }) {
  const doc = window.doc;
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const databaseId = doc.addBlock(
    'affine:database',
    {
      columns: [],
      title: new Text('Plan'),
      ...(options.hosted ? { externalSourceId: 'host:plan' } : {}),
    },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    databaseBlockProperties.selectColumnConfig.create('Status', {
      options: [],
    })
  );
  const rowIds = ['Alpha', 'Bravo'].map(title =>
    doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
  );
  const columns = model.props.columns.map(c => ({ id: c.id, hide: false }));
  const filter = { type: 'group', op: 'and', conditions: [] };
  doc.updateBlock(model, {
    views: [
      {
        id: 'gallery-1',
        name: 'Gallery',
        mode: 'gallery',
        columns,
        filter,
        ...(options.openIn ? { openIn: options.openIn } : {}),
      },
    ],
  } as never);
  return { model, rowIds, status, noteId };
}

const blockOf = (model: DatabaseBlockModel) =>
  document.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${model.id}"]`
  )!;

const cardOf = (model: DatabaseBlockModel, rowId: string) =>
  blockOf(model).querySelector<HTMLElement>(
    `[data-testid="dv-gallery-card"][data-row-id="${rowId}"]`
  )!;

describe('opening a row (B9)', () => {
  test("a document row opens through the host, in the view's openIn", async () => {
    const open = vi.fn<(request: DatabaseOpenRowRequest) => void>();
    cleanup = await setupEditor('page', [
      hostSources,
      DatabaseOpenRowExtension({ open }),
    ]);
    const { model, rowIds } = writeDatabase({ hosted: true, openIn: 'center' });
    await settle();

    cardOf(model, rowIds[0]!).click();
    expect(open).toHaveBeenCalledWith({
      docId: rowIds[0],
      mode: 'center',
      newTab: false,
      viewId: 'gallery-1',
      blockId: model.id,
    });

    cardOf(model, rowIds[1]!).dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true })
    );
    expect(open).toHaveBeenLastCalledWith(
      expect.objectContaining({ docId: rowIds[1], mode: 'full', newTab: true })
    );
  });

  test('the "Open pages in" pick changes the mode the host receives', async () => {
    const open = vi.fn<(request: DatabaseOpenRowRequest) => void>();
    cleanup = await setupEditor('page', [
      hostSources,
      DatabaseOpenRowExtension({ open }),
    ]);
    const { model, rowIds } = writeDatabase({ hosted: true });
    await settle();
    const view = blockOf(model).dataSource.viewManager.viewGet('gallery-1')!;
    cardOf(model, rowIds[0]!).click();
    expect(open).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'side' })
    );
    for (const mode of ['center', 'full', 'side'] as const) {
      expect(viewOpenInSet(view, mode)).toBe(true);
      await settle();
      cardOf(model, rowIds[0]!).click();
      expect(open).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode, newTab: false })
      );
    }
  });

  test('a row that is a block keeps the library path', async () => {
    const open = vi.fn();
    cleanup = await setupEditor('page', [DatabaseOpenRowExtension({ open })]);
    const { model, rowIds } = writeDatabase({ hosted: false });
    await settle();
    cardOf(model, rowIds[0]!).click();
    await settle();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('the properties panel (B10)', () => {
  test('"Properties" asks the host panel, and the element draws the view list', async () => {
    const panelOpen = vi.fn<(request: PropertiesPanelRequest) => void>();
    cleanup = await setupEditor('page', [
      PropertiesPanelExtension({ open: panelOpen, close: vi.fn() }),
    ]);
    const { model } = writeDatabase({ hosted: false });
    await settle();

    blockOf(model)
      .querySelector<HTMLElement>(
        'data-view-header-tools-view-options .more-action'
      )!
      .click();
    await settle();
    const properties = [
      ...document.querySelectorAll<HTMLElement>('affine-menu-button'),
    ].find(button => button.textContent?.includes('Properties'))!;
    properties.click();
    await settle();

    expect(panelOpen).toHaveBeenCalledWith({
      scope: 'source',
      docId: window.doc.id,
      blockId: model.id,
      sourceId: model.id,
      viewId: 'gallery-1',
    });
    // The host's panel opened: no popover.
    expect(document.querySelector('data-view-properties-setting')).toBeNull();

    const request = panelOpen.mock.calls[0]![0];
    const panel = document.createElement(
      'affine-database-properties-panel'
    ) as DatabasePropertiesPanel;
    panel.std = window.editor.std;
    panel.request = request as Extract<
      PropertiesPanelRequest,
      { scope: 'source' }
    >;
    document.body.append(panel);
    await settle();
    expect(panel.querySelector('data-view-properties-setting')).not.toBeNull();
    expect(panel.textContent).toContain('Status');

    panel
      .querySelector<HTMLElement>(
        '[data-testid="database-properties-panel-toggle-all"]'
      )!
      .click();
    await settle();
    const view = blockOf(model).dataSource.viewManager.viewGet('gallery-1')!;
    const hideable = view.propertiesRaw$.value.filter(p => p.hideCanSet);
    expect(hideable.length).toBeGreaterThan(0);
    expect(hideable.every(p => p.hide$.value)).toBe(true);
  });
});

describe('linked views (B12)', () => {
  const PLAN: DataSourcePickerDatabase = {
    id: 'host:plan',
    title: 'Plan',
    sources: [
      { id: 'src-1', title: 'Projects' },
      { id: 'src-2', title: 'Risks' },
    ],
  };

  test('a picked source lands as a rendered view, one undo step', async () => {
    cleanup = await setupEditor('page', [
      hostSources,
      DataSourcePickerExtension({ list: () => signal([PLAN]) }),
    ]);
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const lineId = doc.addBlock('affine:paragraph', {}, noteId);
    await settle();
    const before = doc.getBlock(noteId)!.model.children.length;

    const id = insertLinkedDatabaseView(window.editor.std, {
      after: doc.getBlock(lineId)!.model,
      database: PLAN,
      sourceId: 'src-2',
      viewType: 'table',
    });
    await settle();

    const model = doc.getModelById(id!) as DatabaseBlockModel;
    expect(model.props.externalSourceId).toBe('host:plan');
    expect(model.props.views).toHaveLength(1);
    expect(model.props.views[0]).toMatchObject({
      mode: 'table',
      sourceId: 'src-2',
    });
    expect(blockOf(model)).not.toBeNull();

    doc.undo();
    await settle();
    expect(doc.getModelById(id!)).toBeNull();
    expect(doc.getBlock(noteId)!.model.children.length).toBe(before);
  });

  test('a database the host creates lands as a view of its first source', async () => {
    const createDatabase = vi.fn(async () => PLAN);
    cleanup = await setupEditor('page', [
      hostSources,
      DataSourcePickerExtension({ list: () => signal([]), createDatabase }),
    ]);
    const doc = window.doc;
    const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    const lineId = doc.addBlock('affine:paragraph', {}, noteId);
    await settle();

    const id = await createHostedDatabaseView(
      window.editor.std,
      { list: () => signal([]), createDatabase },
      {
        after: doc.getBlock(lineId)!.model,
        viewType: 'kanban',
        removeEmptyLine: true,
      }
    );
    await settle();

    expect(createDatabase).toHaveBeenCalledTimes(1);
    const model = doc.getModelById(id!) as DatabaseBlockModel;
    // A fresh source has nothing to group by: the board lands as a table.
    expect(model.props.views[0]).toMatchObject({ sourceId: 'src-1' });
    expect(['kanban', 'table']).toContain(model.props.views[0]!.mode);
    // The slash entry's empty line made way for the view.
    expect(doc.getModelById(lineId)).toBeNull();
  });
});

describe('the menu beside "New"', () => {
  const toolOf = (model: DatabaseBlockModel) =>
    blockOf(model).querySelector<HTMLElement>(
      'data-view-header-tools-add-row'
    )!;
  const chevronOf = (model: DatabaseBlockModel) =>
    toolOf(model).querySelector<HTMLElement>(
      '[data-testid="database-new-record-more"]'
    );

  test('without the seam, "New" is one button that adds a row', async () => {
    cleanup = await setupEditor('page');
    const { model } = writeDatabase({ hosted: false });
    await settle();
    expect(chevronOf(model)).toBeNull();
    const rows = model.children.length;
    toolOf(model).querySelector<HTMLElement>('.new-record')!.click();
    await settle();
    expect(model.children.length).toBe(rows + 1);
  });

  test('with the seam, the chevron asks the host and "New" still adds', async () => {
    const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
    cleanup = await setupEditor('page', [
      DatabaseNewRowMenuExtension({ open }),
    ]);
    const { model } = writeDatabase({ hosted: false });
    await settle();

    const chevron = chevronOf(model)!;
    expect(chevron.getAttribute('aria-label')).toBe('Templates and options');
    const rows = model.children.length;
    chevron.click();
    await settle();
    expect(open).toHaveBeenCalledWith({
      anchor: chevron,
      blockId: model.id,
      viewId: 'gallery-1',
    });
    expect(model.children.length).toBe(rows);

    toolOf(model).querySelector<HTMLElement>('.new-record')!.click();
    await settle();
    expect(model.children.length).toBe(rows + 1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  test('with canOpen, the chevron shows only where the host says so', async () => {
    const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
    let baseId = '';
    const canOpen = vi.fn(
      ({ blockId }: Omit<DatabaseNewRowMenuRequest, 'anchor'>) =>
        blockId === baseId
    );
    cleanup = await setupEditor('page', [
      DatabaseNewRowMenuExtension({ open, canOpen }),
    ]);
    const base = writeDatabase({ hosted: false }).model;
    baseId = base.id;
    const inline = writeDatabase({ hosted: false }).model;
    await settle();

    expect(canOpen).toHaveBeenCalledWith({
      blockId: inline.id,
      viewId: 'gallery-1',
    });
    expect(chevronOf(inline)).toBeNull();
    const rows = inline.children.length;
    toolOf(inline).querySelector<HTMLElement>('.new-record')!.click();
    await settle();
    expect(inline.children.length).toBe(rows + 1);

    chevronOf(base)!.click();
    await settle();
    expect(open).toHaveBeenCalledWith({
      anchor: chevronOf(base),
      blockId: base.id,
      viewId: 'gallery-1',
    });
  });
});
