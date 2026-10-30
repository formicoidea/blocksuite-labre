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
import { type ExtensionType, type Store, Text } from '@labre/store';
import { signal } from '@preact/signals-core';
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
 *   "Source in the trash".
 */

const PLAN = 'host:plan';
const PEOPLE = 'host:people';

/** The host's sources, keyed `database/source`; a schema block each. */
let sources: Record<string, HostedSource | HostedSourceUnavailable> = {};
const rowAdd = vi.fn(() => '');

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
  cellValueChange(): void {}
  rowAdd(): string {
    return rowAdd();
  }
  rowDelete(): void {}
  rowMove(): void {}
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
        const source = new KeyedSource(
          model,
          (sourceId, databaseId) =>
            sources[`${databaseId}/${sourceId ?? 'src-a'}`] ?? null
        );
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
});
