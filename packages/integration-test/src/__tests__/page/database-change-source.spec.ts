import {
  type DatabaseBlockComponent,
  DatabaseBlockDataSource,
  DatabaseDataSourceProvider,
  HostedDataSourceBase,
  type HostedSource,
  hostedTextColumnConfig,
  hostedTitleColumnConfig,
} from '@labre/affine/blocks/database';
import type { PropertyMetaConfig, TypeInstance } from '@labre/affine/data-view';
import { getViewActions, runViewAction } from '@labre/affine/host-panels';
import { type DatabaseBlockModel, NoteDisplayMode } from '@labre/affine/model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerExtension,
  TelemetryExtension,
} from '@labre/affine/shared/services';
import type { BlockStdScope } from '@labre/std';
import { type ExtensionType, type Store, Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * GUARD — a view's source changes from its settings (ADR 0035 amendment of
 * 2026-10-28): "Source" in the view settings and the full page's
 * `database.view.source`, in a real editor, over a hosted database whose
 * views name two sources.
 *
 * What it would have caught:
 * - "Source" missing from the view settings of a hosted database, or drawn
 *   on an inline one;
 * - a pick that writes the view's `sourceId` but leaves the table drawn on
 *   the old schema (the block reading the source once), or one that takes
 *   more than one undo step;
 * - "New source" not asking the host's `createSource` for this database,
 *   or the view not switched onto what it created, or reported as an
 *   existing source;
 * - `DatabaseViewSourceChanged` not reaching the host's adapter, or without
 *   the block's id;
 * - the full page not listing `database.view.source` after "Layout", or its
 *   run not opening the picker.
 */

const PLAN_ID = 'host:plan';

/** The host's sources: a schema block each, in a note the page view never draws. */
let sources: Record<string, HostedSource> = {};

/** A host source over the schema block its current view names (labre ADR-0046 by shape). */
class ResolvingSource extends HostedDataSourceBase {
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
    return '';
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
        const source = new ResolvingSource(
          model,
          sourceId => sources[sourceId ?? 'src-a'] ?? null
        );
        init?.(source as never);
        return source;
      },
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
  cleanup?.();
  cleanup = undefined;
  sources = {};
});

/** A schema block in the hidden note, registered as source `id`. */
function addSource(doc: Store, hidden: string, id: string, title: string) {
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
  sources[id] = {
    schema: doc.getModelById(schemaId) as DatabaseBlockModel,
    rows: signal([`${title} row`]),
  };
  return { id, title };
}

function writeHostedDatabase() {
  const doc = window.doc;
  const hidden = doc.addBlock(
    'affine:note',
    { displayMode: NoteDisplayMode.EdgelessOnly },
    doc.root!.id
  );
  addSource(doc, hidden, 'src-a', 'Projects');
  addSource(doc, hidden, 'src-b', 'Risks');
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const hostId = doc.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: [],
      externalSourceId: PLAN_ID,
      views: [
        {
          id: 'v1',
          name: 'Board of work',
          mode: 'table',
          sourceId: 'src-a',
          columns: [
            { id: 'src-a-name', hide: false },
            { id: 'src-a-field', hide: false },
          ],
          filter: { type: 'group', op: 'and', conditions: [] },
        },
      ],
    } as never,
    noteId
  );
  return { model: doc.getModelById(hostId) as DatabaseBlockModel, hidden };
}

function picker(createSource?: (databaseId: string) => Promise<unknown>) {
  const database: DataSourcePickerDatabase = {
    id: PLAN_ID,
    title: 'Plan',
    sources: [
      { id: 'src-a', title: 'Projects' },
      { id: 'src-b', title: 'Risks' },
    ],
  };
  return DataSourcePickerExtension({
    list: () => signal([database]),
    ...(createSource ? { createSource: createSource as never } : {}),
  });
}

const blockOf = (model: DatabaseBlockModel) =>
  document.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${model.id}"]`
  )!;

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function openViewSettings(model: DatabaseBlockModel) {
  blockOf(model)
    .querySelector<HTMLElement>(
      'data-view-header-tools-view-options .more-action'
    )!
    .click();
  await settle();
}

const sourceIdOf = (model: DatabaseBlockModel) =>
  (model.props.views[0] as { sourceId?: string }).sourceId;

describe('"Source" in the view settings', () => {
  test('points the view at the other source, redrawn, one undo step', async () => {
    const track = vi.fn();
    cleanup = await setupEditor('page', [
      hostSources,
      picker(),
      TelemetryExtension({ track }),
    ]);
    const { model } = writeHostedDatabase();
    await settle();
    expect(blockOf(model).textContent).toContain('Projects field');

    await openViewSettings(model);
    const entry = byTestId('dv-view-setting-source');
    expect(entry, 'the view settings offer "Source"').not.toBeNull();
    expect(entry!.textContent).toContain('Projects');
    entry!.click();
    await settle();
    expect(byTestId('data-source-picker')).not.toBeNull();
    byTestId('data-source-picker-source-src-b')!.click();
    await settle();

    expect(sourceIdOf(model)).toBe('src-b');
    expect(blockOf(model).textContent).toContain('Risks field');
    expect(blockOf(model).textContent).not.toContain('Projects field');
    expect(
      track.mock.calls.filter(([name]) => name === 'DatabaseViewSourceChanged')
    ).toEqual([
      [
        'DatabaseViewSourceChanged',
        {
          source: 'existing',
          viewId: 'v1',
          viewType: 'table',
          blockId: model.id,
        },
      ],
    ]);

    window.doc.undo();
    await settle();
    expect(sourceIdOf(model)).toBe('src-a');
    expect(blockOf(model).textContent).toContain('Projects field');
  });

  test('"New source" asks the host, then switches onto it', async () => {
    const track = vi.fn();
    let hidden = '';
    const createSource = vi.fn(async (_databaseId: string) =>
      addSource(window.doc, hidden, 'src-c', 'Ideas')
    );
    cleanup = await setupEditor('page', [
      hostSources,
      picker(createSource),
      TelemetryExtension({ track }),
    ]);
    const written = writeHostedDatabase();
    hidden = written.hidden;
    const { model } = written;
    await settle();

    await openViewSettings(model);
    byTestId('dv-view-setting-source')!.click();
    await settle();
    byTestId('data-source-picker-new-source')!.click();
    await vi.waitFor(() => expect(sourceIdOf(model)).toBe('src-c'));
    await settle();

    expect(createSource).toHaveBeenCalledWith(PLAN_ID);
    expect(blockOf(model).textContent).toContain('Ideas field');
    expect(track).toHaveBeenCalledWith(
      'DatabaseViewSourceChanged',
      expect.objectContaining({ source: 'new', viewId: 'v1' })
    );
  });

  test('is not offered on an inline database', async () => {
    cleanup = await setupEditor('page', [picker()]);
    const noteId = window.doc.addBlock('affine:note', {}, window.doc.root!.id);
    const id = window.doc.addBlock(
      'affine:database',
      { title: new Text('Inline') },
      noteId
    );
    const model = window.doc.getModelById(id) as DatabaseBlockModel;
    const writer = new DatabaseBlockDataSource(model);
    writer.viewManager.viewAdd('table');
    writer.dispose();
    await settle();

    await openViewSettings(model);
    const layout = [
      ...document.querySelectorAll<HTMLElement>('affine-menu-button'),
    ].find(button => button.textContent?.includes('Layout'));
    expect(layout, 'the view settings are open').toBeTruthy();
    expect(byTestId('dv-view-setting-source')).toBeNull();
  });
});

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  std: BlockStdScope | undefined;
};

describe('the full page', () => {
  test('lists database.view.source after Layout, and runs it', async () => {
    const editorCleanup = await setupEditor('page', [hostSources, picker()]);
    const { model } = writeHostedDatabase();
    const app = window.editor.parentElement!;
    const extensions = window.editor.pageSpecs;
    window.editor.remove();
    const page = document.createElement('affine-database-page') as DatabasePage;
    page.style.height = '600px';
    page.store = window.doc;
    page.extensions = extensions;
    page.hostBlockId = model.id;
    app.append(page);
    cleanup = () => {
      page.remove();
      editorCleanup();
    };
    await wait(200);

    const ids = getViewActions(page.std!, 'page').map(action => action.id);
    expect(ids).toContain('database.view.source');
    expect(ids.indexOf('database.view.source')).toBe(
      ids.indexOf('database.view.layout') + 1
    );

    await runViewAction(page.std!, 'database.view.source');
    await settle();
    expect(byTestId('data-source-picker')).not.toBeNull();
    expect(byTestId('data-source-picker-source-src-b')).not.toBeNull();
  });
});
