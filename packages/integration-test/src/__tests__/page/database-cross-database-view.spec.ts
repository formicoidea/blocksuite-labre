import {
  type DatabaseBlockComponent,
  DatabaseDataSourceProvider,
  HostedDataSourceBase,
  type HostedSource,
  type HostedSourceUnavailable,
  hostedTextColumnConfig,
  hostedTitleColumnConfig,
} from '@labre/affine/blocks/database';
import type { PropertyMetaConfig, TypeInstance } from '@labre/affine/data-view';
import { type DatabaseBlockModel, NoteDisplayMode } from '@labre/affine/model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerExtension,
} from '@labre/affine/shared/services';
import type { EditorHost } from '@labre/std';
import { type ExtensionType, type Store, Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * GUARD — a view reads a source of another database (ADR 0035 amendment of
 * 2026-10-30, labre « Base de données v3 »), in a real editor, under a host
 * with `crossDatabaseViews` whose resolver keys its sources by database.
 *
 * What it would have caught:
 * - the view settings' "Source" not listing another database's sources,
 *   or a pick of one storing no `databaseId`, or leaving the table drawn on
 *   the old source (the block's database);
 * - the block's `externalSourceId` rewritten by the pick, or a new row on
 *   the other database's view not reaching the host's `rowAdd` (the view
 *   left read-only);
 * - an unreadable database drawn as an error, as "Source not found" or with
 *   "Connect a source", instead of "Database not shared"; a source in the
 *   trash offered "Connect a source" (under `requireSource`) instead of
 *   "Source in the trash";
 * - a source not open to the reader's page (issue #693) drawn as anything
 *   but "Source not open" under the title and the view bar, a row the host
 *   still holds drawn, a write on mounting the notice (taken before the
 *   first render), or the view bar no longer switching views;
 * - a mounted view whose source stops being open keeping its rows, or a
 *   cell selected before the flip still writing (a letter, Delete,
 *   Backspace, Enter, a paste) or throwing; flipping back not drawing the
 *   rows again;
 * - a reason this build does not know offered "Connect a source" (ADR 0035
 *   amendment of 2026-11-20).
 */

const PLAN = 'host:plan';
const PEOPLE = 'host:people';

/** The host's sources, keyed `database/source`; a schema block each. */
let sources: Record<string, HostedSource | HostedSourceUnavailable> = {};
/** Bumped to make the resolver answer again (a host's live rights). */
const sourcesRevision = signal(0);
const rowAdd = vi.fn(() => '');
/** Every data write of the host's source but `rowAdd`. */
const writes = vi.fn();

class KeyedSource extends HostedDataSourceBase {
  private column(id: string) {
    return this.schema$.value?.props.columns$.value.find(c => c.id === id);
  }
  protected getRows(): string[] {
    return [];
  }
  protected getProperties(): string[] {
    return this.schema$.value?.props.columns$.value.map(c => c.id) ?? [];
  }
  protected getCellValue(rowId: string, propertyId: string): unknown {
    return this.column(propertyId)?.type === 'title' ? rowId : '';
  }
  protected getPropertyType(id: string): string | undefined {
    return this.column(id)?.type;
  }
  protected getPropertyName(id: string): string {
    return this.column(id)?.name ?? '';
  }
  protected getPropertyData(id: string): Record<string, unknown> {
    return this.column(id)?.data ?? {};
  }
  protected getPropertyDataType(): TypeInstance | undefined {
    return undefined;
  }
  protected getPropertyMetas(): PropertyMetaConfig[] {
    return [];
  }
  cellValueChange(...args: unknown[]): void {
    writes('cellValueChange', ...args);
  }
  rowAdd(): string {
    return rowAdd();
  }
  rowDelete(...args: unknown[]): void {
    writes('rowDelete', ...args);
  }
  rowMove(...args: unknown[]): void {
    writes('rowMove', ...args);
  }
  propertyAdd(): string | undefined {
    return undefined;
  }
  propertyDelete(): void {}
  propertyDuplicate(): string | undefined {
    return undefined;
  }
  propertyDataSet(): void {}
  propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    if (type === 'title') return hostedTitleColumnConfig;
    if (type === 'text') return hostedTextColumnConfig;
    return undefined;
  }
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

const hostSources: ExtensionType = {
  setup: di => {
    di.override(DatabaseDataSourceProvider, () => ({
      createDataSource: (model, init) => {
        const source = new KeyedSource(model, (sourceId, databaseId) => {
          void sourcesRevision.value;
          return sources[`${databaseId}/${sourceId ?? 'src-a'}`] ?? null;
        });
        init?.(source as never);
        return source;
      },
    }));
  },
};

const picker = DataSourcePickerExtension({
  list: () =>
    signal<DataSourcePickerDatabase[]>([
      {
        id: PLAN,
        title: 'Plan',
        sources: [{ id: 'src-a', title: 'Projects' }],
      },
      {
        id: PEOPLE,
        title: 'People',
        sources: [{ id: 'src-p', title: 'Team' }],
      },
    ]),
  crossDatabaseViews: true,
});

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
  cleanup?.();
  cleanup = undefined;
  sources = {};
  rowAdd.mockClear();
  writes.mockClear();
});

function addSource(doc: Store, hidden: string, key: string, title: string) {
  const id = key.split('/')[1]!;
  const schemaId = doc.addBlock(
    'affine:database',
    {
      title: new Text(title),
      columns: [
        { id: `${id}-name`, type: 'title', name: 'Name', data: {} },
        { id: `${id}-field`, type: 'text', name: `${title} field`, data: {} },
      ],
    } as never,
    hidden
  );
  sources[key] = {
    schema: doc.getModelById(schemaId) as DatabaseBlockModel,
    rows: signal([`${title} row`]),
  };
}

function writeDatabase(view: Record<string, unknown>) {
  const doc = window.doc;
  const hidden = doc.addBlock(
    'affine:note',
    { displayMode: NoteDisplayMode.EdgelessOnly },
    doc.root!.id
  );
  addSource(doc, hidden, `${PLAN}/src-a`, 'Projects');
  addSource(doc, hidden, `${PEOPLE}/src-p`, 'Team');
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: [],
      externalSourceId: PLAN,
      views: [
        {
          id: 'v1',
          name: 'Board of work',
          mode: 'table',
          filter: { type: 'group', op: 'and', conditions: [] },
          ...view,
        },
      ],
    } as never,
    noteId
  );
  return doc.getModelById(id) as DatabaseBlockModel;
}

const blockOf = (model: DatabaseBlockModel) =>
  document.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${model.id}"]`
  )!;

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

const storedView = (model: DatabaseBlockModel) =>
  model.props.views[0] as { sourceId?: string; databaseId?: string };

const requiring = DataSourcePickerExtension({
  list: () => signal([]),
  crossDatabaseViews: true,
  requireSource: true,
});

const TEAM_COLUMNS = [
  { id: 'src-p-name', hide: false },
  { id: 'src-p-field', hide: false },
];

const PROJECTS_VIEW = {
  id: 'v2',
  name: 'Projects view',
  mode: 'table',
  filter: { type: 'group', op: 'and', conditions: [] },
  sourceId: 'src-a',
  columns: [
    { id: 'src-a-name', hide: false },
    { id: 'src-a-field', hide: false },
  ],
};

/** `'not-open'` while the host still holds the source's schema and rows. */
const notOpen = (key: string) =>
  ({ ...sources[key], unavailable: 'not-open' }) as never;

function countYjsUpdates() {
  const space = window.doc.doc.spaceDoc;
  let count = 0;
  const onUpdate = () => count++;
  space.on('update', onUpdate);
  return { count: () => count, stop: () => space.off('update', onUpdate) };
}

function collectErrors() {
  const list: string[] = [];
  const onError = (event: ErrorEvent) => list.push(String(event.message));
  const onRejection = (event: PromiseRejectionEvent) =>
    list.push(String(event.reason));
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return {
    list,
    stop: () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    },
  };
}

function cellSelection() {
  const host = window.editor.host as EditorHost;
  const held = host.std.selection.value.find(
    selection => selection.type === 'database'
  ) as { viewSelection?: { selectionType?: string; isEditing?: boolean } };
  return held?.viewSelection;
}

describe('a view of another database', () => {
  test('is picked from the view settings, renders its rows and takes a new row', async () => {
    cleanup = await setupEditor('page', [hostSources, picker]);
    const model = writeDatabase({
      sourceId: 'src-a',
      columns: [
        { id: 'src-a-name', hide: false },
        { id: 'src-a-field', hide: false },
      ],
    });
    await settle();
    expect(blockOf(model).textContent).toContain('Projects field');

    blockOf(model)
      .querySelector<HTMLElement>(
        'data-view-header-tools-view-options .more-action'
      )!
      .click();
    await settle();
    byTestId('dv-view-setting-source')!.click();
    await settle();
    const team = byTestId('data-source-picker-source-src-p');
    expect(team, "the other database's source is listed").not.toBeNull();
    expect(team!.textContent).toContain('People');
    team!.click();
    await settle();

    expect(storedView(model)).toMatchObject({
      sourceId: 'src-p',
      databaseId: PEOPLE,
    });
    expect(model.props.externalSourceId).toBe(PLAN);
    expect(blockOf(model).textContent).toContain('Team field');
    expect(blockOf(model).textContent).toContain('Team row');
    expect(blockOf(model).textContent).not.toContain('Projects field');

    blockOf(model)
      .querySelector<HTMLElement>('data-view-header-tools-add-row .new-record')!
      .click();
    await settle();
    expect(rowAdd).toHaveBeenCalled();
  });

  test('an unreadable database draws "Database not shared", never "Connect a source"', async () => {
    cleanup = await setupEditor('page', [hostSources, picker]);
    const model = writeDatabase({
      sourceId: 'src-p',
      databaseId: PEOPLE,
      columns: [],
    });
    sources[`${PEOPLE}/src-p`] = { unavailable: 'unshared' };
    await settle();
    const notice = blockOf(model).querySelector<HTMLElement>(
      '[data-testid="database-source-unshared"]'
    );
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('Database not shared');
    expect(byTestId('database-source-missing')).toBeNull();
    expect(byTestId('database-source-required-connect')).toBeNull();
  });

  test('a source in the trash draws "Source in the trash", never "Connect a source"', async () => {
    cleanup = await setupEditor('page', [
      hostSources,
      DataSourcePickerExtension({
        list: () => signal([]),
        crossDatabaseViews: true,
        requireSource: true,
      }),
    ]);
    const model = writeDatabase({ sourceId: 'src-a', columns: [] });
    sources[`${PLAN}/src-a`] = { unavailable: 'trashed' };
    const before = JSON.stringify(model.props.views);
    await settle();
    const notice = blockOf(model).querySelector<HTMLElement>(
      '[data-testid="database-source-trashed"]'
    );
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('Source in the trash');
    expect(byTestId('database-source-required')).toBeNull();
    expect(byTestId('database-source-required-connect')).toBeNull();
    expect(byTestId('database-source-missing')).toBeNull();
    expect(JSON.stringify(model.props.views)).toBe(before);
  });

  test('a database still loading draws a spinner, never "Connect a source"', async () => {
    cleanup = await setupEditor('page', [
      hostSources,
      DataSourcePickerExtension({
        list: () => signal([]),
        crossDatabaseViews: true,
        requireSource: true,
      }),
    ]);
    const model = writeDatabase({
      sourceId: 'src-p',
      databaseId: PEOPLE,
      columns: [],
    });
    sources[`${PEOPLE}/src-p`] = { unavailable: 'loading' };
    const before = JSON.stringify(model.props.views);
    await settle();
    const notice = blockOf(model).querySelector<HTMLElement>(
      '[data-testid="database-source-loading"]'
    );
    expect(notice).not.toBeNull();
    expect(notice!.getAttribute('aria-busy')).toBe('true');
    expect(byTestId('database-source-required')).toBeNull();
    expect(byTestId('database-source-required-connect')).toBeNull();
    expect(byTestId('database-source-missing')).toBeNull();
    expect(JSON.stringify(model.props.views)).toBe(before);
  });

  test('a source not open to this page draws "Source not open" under the view bar, writes nothing, and another view still opens', async () => {
    cleanup = await setupEditor('page', [hostSources, requiring]);
    const model = writeDatabase({
      sourceId: 'src-p',
      databaseId: PEOPLE,
      columns: TEAM_COLUMNS,
    });
    window.doc.updateBlock(model, {
      views: [...model.props.views, PROJECTS_VIEW],
    } as never);
    // Taken before the first render of the notice, so a write on mount shows.
    window.doc.resetHistory();
    const before = JSON.stringify(model.props.views);
    const updated = vi.fn();
    const subscription = window.doc.slots.blockUpdated.subscribe(updated);
    const yjs = countYjsUpdates();
    // The host still holds the source's rows: none may be drawn.
    sources[`${PEOPLE}/src-p`] = notOpen(`${PEOPLE}/src-p`);
    await settle();
    const block = blockOf(model);
    const notice = block.querySelector<HTMLElement>(
      '[data-testid="database-source-not-open"]'
    );
    expect(notice).not.toBeNull();
    expect(notice!.getAttribute('role')).toBe('status');
    expect(notice!.textContent).toContain('Source not open');
    expect(notice!.textContent).toContain('not open to this page');
    expect(notice!.querySelector('data-view-component-button')).toBeNull();
    expect(block.textContent).toContain('Plan');
    expect(block.textContent).toContain('Board of work');
    expect(block.textContent).not.toContain('Team row');
    expect(block.textContent).not.toContain('Team field');
    expect(block.querySelector('.new-record')).toBeNull();
    expect(byTestId('database-source-unshared')).toBeNull();
    expect(byTestId('database-source-required')).toBeNull();
    expect(byTestId('database-source-required-connect')).toBeNull();
    expect(byTestId('database-source-missing')).toBeNull();
    subscription.unsubscribe();
    yjs.stop();
    expect(updated).not.toHaveBeenCalled();
    expect(yjs.count()).toBe(0);
    expect(window.doc.canUndo).toBe(false);
    expect(JSON.stringify(model.props.views)).toBe(before);

    // The view bar stays operable: the other view reads an open source.
    const tab = block.querySelector<HTMLElement>(
      '[data-testid="database-view-tab"][data-view-id="v2"]'
    );
    expect(tab, 'the other view is a tab of the bar').not.toBeNull();
    tab!.click();
    await settle();
    expect(byTestId('database-source-not-open')).toBeNull();
    expect(blockOf(model).textContent).toContain('Projects row');
  });

  test('a mounted view whose source stops being open drops its rows, and a stale cell selection writes nothing', async () => {
    cleanup = await setupEditor('page', [hostSources, requiring]);
    const model = writeDatabase({
      sourceId: 'src-p',
      databaseId: PEOPLE,
      columns: TEAM_COLUMNS,
    });
    const key = `${PEOPLE}/src-p`;
    const readable = sources[key]!;
    await settle();
    const block = blockOf(model);
    expect(block.textContent).toContain('Team row');
    const cell = block.querySelector<HTMLElement>(
      'dv-table-view-cell-container, affine-database-virtual-cell-container'
    );
    expect(cell, 'a cell of the readable view').not.toBeNull();
    await userEvent.click(cell!);
    await vi.waitFor(() =>
      expect(cellSelection()?.selectionType, 'a cell selected').toBe('area')
    );
    if (cellSelection()?.isEditing) {
      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(cellSelection()?.isEditing).toBe(false));
    }
    // Control: while readable, the same gesture reaches the host's source.
    await userEvent.keyboard('{Delete}');
    await vi.waitFor(() => expect(writes).toHaveBeenCalled());
    writes.mockClear();

    window.doc.resetHistory();
    const before = JSON.stringify(model.props.views);
    const yjs = countYjsUpdates();
    const errors = collectErrors();
    sources[key] = notOpen(key);
    sourcesRevision.value++;
    await settle();
    expect(byTestId('database-source-not-open')).not.toBeNull();
    expect(blockOf(model).textContent).not.toContain('Team row');
    // The gestures below run against the selection taken while readable: it
    // outlives the flip (the view that handled it is unmounted). A change
    // that clears it on the flip is fine; update this line then.
    expect(cellSelection()?.selectionType, 'the stale selection').toBe('area');

    await userEvent.keyboard('q');
    await userEvent.keyboard('{Delete}');
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{Enter}');
    const data = new DataTransfer();
    data.setData('text/plain', 'pasted');
    (document.activeElement ?? window.editor.host)!.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
    await settle();
    errors.stop();
    yjs.stop();
    expect(errors.list).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
    expect(rowAdd).not.toHaveBeenCalled();
    expect(yjs.count()).toBe(0);
    expect(window.doc.canUndo).toBe(false);
    expect(JSON.stringify(model.props.views)).toBe(before);
    expect(blockOf(model).textContent).not.toContain('pasted');

    sources[key] = readable;
    sourcesRevision.value++;
    await settle();
    expect(byTestId('database-source-not-open')).toBeNull();
    expect(blockOf(model).textContent).toContain('Team row');
  });

  test('a reason this build does not know draws "Source not found", never "Connect a source"', async () => {
    cleanup = await setupEditor('page', [hostSources, requiring]);
    const model = writeDatabase({ sourceId: 'src-a', columns: [] });
    window.doc.resetHistory();
    const before = JSON.stringify(model.props.views);
    const updated = vi.fn();
    const subscription = window.doc.slots.blockUpdated.subscribe(updated);
    sources[`${PLAN}/src-a`] = {
      unavailable: 'archived-in-a-later-host',
    } as never;
    await settle();
    const notice = blockOf(model).querySelector<HTMLElement>(
      '[data-testid="database-source-unknown"]'
    );
    expect(notice).not.toBeNull();
    expect(notice!.getAttribute('role')).toBe('status');
    expect(notice!.textContent).toContain('Source not found');
    expect(byTestId('database-source-required')).toBeNull();
    expect(byTestId('database-source-required-connect')).toBeNull();
    subscription.unsubscribe();
    expect(updated).not.toHaveBeenCalled();
    expect(window.doc.canUndo).toBe(false);
    expect(JSON.stringify(model.props.views)).toBe(before);
  });
});
