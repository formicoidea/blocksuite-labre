import {
  addProperty,
  DatabaseBlockDataSource,
  databaseViewInitTemplate,
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
  type DataViewDataType,
  DataViewEventTraceKey,
  groupTraitKey,
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
 * - a layout change dropping the view's `sourceId` or `openIn`, which
 *   `viewChangeType` rebuilds the data around (ADR 0035, B17 amendment);
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

describe('a layout change', () => {
  test("keeps the view's source and where its rows open", () => {
    const { model } = createDatabase();
    const source = new DatabaseBlockDataSource(model);
    const viewId = source.viewManager.viewAdd('table');
    source.viewDataUpdate<
      DataViewDataType & { sourceId?: string; openIn?: string }
    >(viewId, () => ({ sourceId: 'source-1', openIn: 'center' }));
    source.viewManager.viewChangeType(viewId, 'kanban');
    const view = model.props.views.find(v => v.id === viewId) as
      | { mode: string; sourceId?: string; openIn?: string }
      | undefined;
    expect(view?.mode).toBe('kanban');
    expect(view?.sourceId).toBe('source-1');
    expect(view?.openIn).toBe('center');
  });
});
