import {
  addProperty,
  DatabaseBlockDataSource,
  databaseViewInitTemplate,
  HostedDataSourceBase,
} from '@labre/affine-block-database';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import {
  type DataSource,
  DataViewEventTraceKey,
  DataViewRootUILogic,
  groupTraitKey,
  type PropertyMetaConfig,
  rowOpenParams,
  type TypeInstance,
} from '@labre/data-view';
import { propertyModelPresets } from '@labre/data-view/property-pure-presets';
import { viewPresets } from '@labre/data-view/view-presets';
import type { BlockStdScope } from '@labre/std';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

/**
 * Database telemetry (ADR 0035 §12, B17; telemetry README, "Databases") and
 * the name a new view is given (ADR 0023), over the real block source.
 *
 * What it would have caught:
 * - a grouping gesture reported zero times (the grouping menus hold a trait,
 *   not a UI logic) or twice, or a gesture that changes nothing reported;
 * - a row open carrying the row's id, which on a hosted source is a document
 *   id, or reporting a mode the view did not ask for;
 * - a view created in a French editor stored as "Table View", or a preset's
 *   English seed changed to translate it (a model default is never a
 *   translation, the creation site writes the resolved name).
 */

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

function createDatabase() {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const yDoc = collection.createDoc('doc-telemetry');
  yDoc.load();
  const doc = yDoc.getStore({ extensions });
  const rootId = doc.addBlock('affine:page', { title: new Text('db') });
  const noteId = doc.addBlock('affine:note', {}, rootId);
  const databaseId = doc.addBlock(
    'affine:database',
    { columns: [], titleColumn: 'Title' },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    propertyModelPresets.selectPropertyModelConfig.create('Status', {
      options: [{ id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' }],
    })
  );
  doc.addBlock('affine:paragraph', { text: new Text('Alpha') }, databaseId);
  return { model, status };
}

function tracedSource(model: DatabaseBlockModel) {
  const trace = vi.fn();
  const source = new DatabaseBlockDataSource(model, dataSource =>
    dataSource.serviceSet(DataViewEventTraceKey, trace)
  );
  return { source, trace };
}

const frenchStd = {
  getOptional: (id: unknown) =>
    id === TranslationProvider
      ? {
          t: (key: string) =>
            ({
              'com.labre.data-view.view.default-name.table': 'Vue tableau',
            })[key],
        }
      : null,
} as unknown as BlockStdScope;

describe('DatabaseGroupChanged', () => {
  test('is reported once per grouping gesture that changes something', () => {
    const { model, status } = createDatabase();
    const { source, trace } = tracedSource(model);
    const viewId = source.viewManager.viewAdd('table');
    const view = source.viewManager.viewGet(viewId);
    const group = view?.traitGet(groupTraitKey);
    if (!group) throw new Error('a table has a group trait');

    group.changeGroup(status);
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenLastCalledWith('DatabaseGroupChanged', {
      groupBy: 'select',
      propertyType: 'select',
      viewId,
      viewType: 'table',
    });

    group.changeGroup(status);
    expect(trace, 'the same grouping again').toHaveBeenCalledTimes(1);

    group.changeGroup(undefined);
    expect(trace).toHaveBeenLastCalledWith('DatabaseGroupChanged', {
      groupBy: 'none',
      viewId,
      viewType: 'table',
    });
    group.changeGroup(undefined);
    expect(trace, 'removing no grouping').toHaveBeenCalledTimes(2);
  });

  test('a source with no tracer reports nothing and still groups', () => {
    const { model, status } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const viewId = source.viewManager.viewAdd('table');
    const group = source.viewManager.viewGet(viewId)?.traitGet(groupTraitKey);
    group?.changeGroup(status);
    expect(group?.property$.value?.id).toBe(status);
  });
});

/** A hosted source whose rows are documents; only what the test reads. */
class DocumentRows extends HostedDataSourceBase {
  override get rowsAreDocuments(): boolean {
    return true;
  }
  protected getRows(): string[] {
    return ['doc-1'];
  }
  protected getProperties(): string[] {
    return [];
  }
  protected getCellValue(): unknown {
    return undefined;
  }
  protected getPropertyType(): string | undefined {
    return undefined;
  }
  protected getPropertyName(): string {
    return '';
  }
  protected getPropertyData(): Record<string, unknown> {
    return {};
  }
  protected getPropertyDataType(): TypeInstance | undefined {
    return undefined;
  }
  protected getPropertyMetas(): PropertyMetaConfig[] {
    return [];
  }
  propertyMetaGet(): PropertyMetaConfig | undefined {
    return undefined;
  }
  rowAdd(): string {
    return '';
  }
  rowDelete(): void {}
  rowMove(): void {}
  cellValueChange(): void {}
  propertyAdd(): string | undefined {
    return undefined;
  }
  propertyDelete(): void {}
  propertyDuplicate(): string | undefined {
    return undefined;
  }
  propertyDataSet(): void {}
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

describe('DatabaseRowOpened', () => {
  test('says the mode the view asks for, never the row', () => {
    const { model } = createDatabase();
    model.store.updateBlock(model, {
      views: [
        {
          id: 'v-center',
          name: 'Center',
          mode: 'table',
          openIn: 'center',
          columns: [],
          filter: { type: 'group', op: 'and', conditions: [] },
        },
        {
          id: 'v-plain',
          name: 'Plain',
          mode: 'table',
          columns: [],
          filter: { type: 'group', op: 'and', conditions: [] },
        },
      ] as never,
    });
    const hosted = new DocumentRows(model) as unknown as DataSource;
    expect(rowOpenParams(hosted, 'v-center', false)).toEqual({
      mode: 'center',
      newTab: false,
      rowKind: 'document',
    });
    expect(rowOpenParams(hosted, 'v-plain', false).mode).toBe('side');
    expect(rowOpenParams(hosted, 'v-center', true).mode).toBe('full');
    // A block-backed row always opens beside the view.
    const inline = new DatabaseBlockDataSource(model);
    expect(rowOpenParams(inline, 'v-center', true)).toEqual({
      mode: 'side',
      newTab: true,
      rowKind: 'block',
    });
  });

  test('is reported once by the root, with ids only', async () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const viewId = source.viewManager.viewAdd('table');
    const view = source.viewManager.viewGet(viewId);
    if (!view) throw new Error('view');
    const eventTrace = vi.fn();
    const openDetailPanel = vi.fn(() => Promise.resolve());
    const root = new DataViewRootUILogic({
      dataSource: source,
      eventTrace,
      detailPanelConfig: { openDetailPanel },
    } as unknown as ConstructorParameters<typeof DataViewRootUILogic>[0]);
    Object.defineProperty(root, 'dataViewRenderer', {
      value: document.createElement('div'),
    });

    root.openDetailPanel({ view, rowId: 'row-secret' });
    await Promise.resolve();
    expect(openDetailPanel).toHaveBeenCalledTimes(1);
    expect(eventTrace).toHaveBeenCalledTimes(1);
    expect(eventTrace).toHaveBeenCalledWith('DatabaseRowOpened', {
      mode: 'side',
      newTab: false,
      rowKind: 'block',
      viewId,
      viewType: 'table',
    });
    expect(JSON.stringify(eventTrace.mock.calls)).not.toContain('row-secret');
  });
});

describe('the name a new view is given', () => {
  test('is resolved at creation and written as resolved', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    databaseViewInitTemplate(source, 'table', frenchStd);
    expect(model.props.views.at(-1)?.name).toBe('Vue tableau');
    // The preset's seed is untouched.
    expect(viewPresets.tableViewMeta.model.defaultName).toBe('Table View');
  });

  test('stays the English seed without an editor', () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    databaseViewInitTemplate(source, 'kanban');
    expect(model.props.views.at(-1)?.name).toBe('Kanban View');
    source.viewManager.viewAdd('table');
    expect(model.props.views.at(-1)?.name).toBe('Table View');
  });

  test('every preset declares a key whose fallback is its seed', () => {
    for (const meta of [
      viewPresets.tableViewMeta,
      viewPresets.kanbanViewMeta,
      viewPresets.calendarViewMeta,
      viewPresets.galleryViewMeta,
      viewPresets.listViewMeta,
    ]) {
      expect(meta.model.defaultNameKey, meta.type).toMatch(
        /^com\.labre\.data-view\.view\.default-name\./
      );
    }
  });
});
