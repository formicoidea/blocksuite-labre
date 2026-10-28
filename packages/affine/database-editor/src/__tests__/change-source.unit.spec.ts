/**
 * GUARD — pointing a view at another source of its database (ADR 0035
 * amendment of 2026-10-28): `changeViewSource`, over a real store and a
 * hosted source whose views name two schema blocks.
 *
 * What it would have caught:
 * - a view switched without its settings remapped: a column, a filter or a
 *   sort left on a property the other source does not have (a view that
 *   filters on nothing it can read), or a property both sources share
 *   (same name, same type) dropped instead of kept under its new id;
 * - a grouping by a lost property surviving the switch, because the block's
 *   `updateView` merges over the stored view and `remapView` deletes it;
 * - `openIn` or the colour rules (ADR 0036) lost on the way;
 * - the stored view handed to `remapView` as the block's reactive proxy,
 *   which its `structuredClone` refuses (a fake source never shows it);
 * - the switch taking more than one undo step, or an undo that does not give
 *   the previous view back exactly;
 * - a write when the view already reads the source (an empty undo entry),
 *   on a read-only page, or for a source `resolveSource` does not know;
 * - `DatabaseViewSourceChanged` reported twice, not at all, or with
 *   anything but the closed `source` and the view's ids.
 */
import {
  HostedDataSourceBase,
  type HostedSource,
} from '@labre/affine-block-database';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  DataViewEventTraceKey,
  type PropertyMetaConfig,
  type TypeInstance,
} from '@labre/data-view';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  changeViewSource,
  schemaProperties,
} from '../view-transfer/change-source.js';

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

/** A host source reading the current view's schema block (labre ADR-0046 by shape). */
class SchemaSource extends HostedDataSourceBase {
  private column(id: string) {
    return this.schema$.value?.props.columns$.value.find(c => c.id === id);
  }
  protected getRows(): string[] {
    return [];
  }
  protected getProperties(): string[] {
    return this.schema$.value?.props.columns$.value.map(c => c.id) ?? [];
  }
  protected getCellValue(): unknown {
    return undefined;
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
  rowAdd(_pos: InsertToPosition | number): string {
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
  propertyMetaGet(): PropertyMetaConfig | undefined {
    return undefined;
  }
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

const ref = (name: string) => ({ type: 'ref', name });
const condition = (name: string, fn: string, value: unknown) => ({
  type: 'filter',
  left: ref(name),
  function: fn,
  args: [{ type: 'literal', value }],
});

function setup(view: Record<string, unknown> = {}) {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const yDoc = collection.createDoc('doc-change-source');
  yDoc.load();
  const doc = yDoc.getStore({ extensions });
  const rootId = doc.addBlock('affine:page', { title: new Text('Plan') });
  const noteId = doc.addBlock('affine:note', {}, rootId);
  const schema = (title: string, columns: unknown[]) =>
    doc.getModelById(
      doc.addBlock(
        'affine:database',
        { title: new Text(title), columns } as never,
        noteId
      )
    ) as DatabaseBlockModel;
  const projects = schema('Projects', [
    { id: 'a-name', type: 'title', name: 'Name', data: {} },
    {
      id: 'a-status',
      type: 'select',
      name: 'Status',
      data: { options: [{ id: 'a-todo', value: 'Todo', color: 'blue' }] },
    },
    { id: 'a-cost', type: 'number', name: 'Cost', data: {} },
  ]);
  const risks = schema('Risks', [
    { id: 'b-name', type: 'title', name: 'Name', data: {} },
    {
      id: 'b-status',
      type: 'select',
      name: 'Status',
      data: { options: [{ id: 'b-todo', value: 'Todo', color: 'blue' }] },
    },
  ]);
  const hostId = doc.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: [],
      externalSourceId: 'host:plan',
      views: [
        {
          id: 'v1',
          name: 'Projects table',
          mode: 'table',
          sourceId: 'src-a',
          columns: [
            { id: 'a-name', hide: false },
            { id: 'a-status', hide: false },
            { id: 'a-cost', hide: false, width: 120 },
          ],
          filter: {
            type: 'group',
            op: 'and',
            conditions: [
              condition('a-cost', 'greatThan', 10),
              condition('a-status', 'isOneOf', ['a-todo']),
            ],
          },
          sort: { sortBy: [{ ref: ref('a-cost'), desc: true }] },
          openIn: 'center',
          colorRules: [
            {
              id: 'c1',
              color: 'var(--affine-v2-chip-label-red)',
              filter: {
                type: 'group',
                op: 'and',
                conditions: [condition('a-status', 'isOneOf', ['a-todo'])],
              },
            },
          ],
          header: { titleColumn: 'a-name' },
          ...view,
        },
      ],
    } as never,
    noteId
  );
  const host = doc.getModelById(hostId) as DatabaseBlockModel;
  const sources: Record<string, HostedSource> = {
    'src-a': { schema: projects, rows: signal([]) },
    'src-b': { schema: risks, rows: signal([]) },
  };
  const trace = vi.fn();
  const dataSource = new SchemaSource(
    host,
    sourceId => sources[sourceId ?? 'src-a'] ?? null
  );
  dataSource.serviceSet(DataViewEventTraceKey, trace);
  dataSource.viewManager.setCurrentView('v1');
  doc.resetHistory();
  return { doc, host, dataSource, trace, projects };
}

/** The undo stack itself: `canUndo` is a signal a bare test store never refreshes. */
const undoSteps = (doc: DatabaseBlockModel['store']) =>
  doc.history.undoManager.undoStack.length;

const storedView = (host: DatabaseBlockModel) =>
  host.props.views[0] as unknown as Record<string, unknown>;

describe('schemaProperties', () => {
  test("reads a schema block's columns, a select's options included", () => {
    const { projects } = setup();
    expect(schemaProperties(projects)).toEqual([
      { id: 'a-name', name: 'Name', type: 'title' },
      {
        id: 'a-status',
        name: 'Status',
        type: 'select',
        options: [{ id: 'a-todo', value: 'Todo' }],
      },
      { id: 'a-cost', name: 'Cost', type: 'number' },
    ]);
  });
});

describe('changeViewSource', () => {
  test('remaps the view onto the other source and writes its sourceId', () => {
    const { host, dataSource } = setup();
    expect(changeViewSource(dataSource, 'v1', 'src-b', 'existing')).toBe(true);
    const view = storedView(host);
    expect(view).toMatchObject({
      id: 'v1',
      name: 'Projects table',
      mode: 'table',
      sourceId: 'src-b',
      openIn: 'center',
      header: { titleColumn: 'b-name' },
    });
    // The cost column has no counterpart: it leaves; the shared ones are
    // kept under their new ids.
    expect(view.columns).toEqual([
      { id: 'b-name', hide: false },
      { id: 'b-status', hide: false },
    ]);
    expect(view.filter).toEqual({
      type: 'group',
      op: 'and',
      conditions: [condition('b-status', 'isOneOf', ['b-todo'])],
    });
    expect((view.sort as { sortBy: unknown[] }).sortBy).toEqual([]);
    expect(view.colorRules).toEqual([
      {
        id: 'c1',
        color: 'var(--affine-v2-chip-label-red)',
        filter: {
          type: 'group',
          op: 'and',
          conditions: [condition('b-status', 'isOneOf', ['b-todo'])],
        },
      },
    ]);
  });

  test('a grouping by a property the target lacks is cleared, one by a shared one kept', () => {
    const lost = setup({ groupBy: { type: 'groupBy', columnId: 'a-cost' } });
    changeViewSource(lost.dataSource, 'v1', 'src-b', 'existing');
    expect(storedView(lost.host).groupBy).toBeUndefined();

    const kept = setup({
      groupBy: { type: 'groupBy', columnId: 'a-status', name: 'select' },
    });
    changeViewSource(kept.dataSource, 'v1', 'src-b', 'existing');
    expect(storedView(kept.host).groupBy).toEqual({
      type: 'groupBy',
      columnId: 'b-status',
      name: 'select',
    });
  });

  test('is one undo step, and the undo gives the previous view back', () => {
    const { doc, host, dataSource } = setup();
    const before = JSON.parse(JSON.stringify(host.props.views));
    changeViewSource(dataSource, 'v1', 'src-b', 'existing');
    expect(undoSteps(doc)).toBe(1);
    doc.undo();
    expect(host.props.views).toEqual(before);
    expect(undoSteps(doc)).toBe(0);
  });

  test('writes nothing for the source the view already reads', () => {
    const { doc, dataSource, trace } = setup();
    const updated = vi.fn();
    const subscription = doc.slots.blockUpdated.subscribe(updated);
    expect(changeViewSource(dataSource, 'v1', 'src-a', 'existing')).toBe(false);
    subscription.unsubscribe();
    expect(updated).not.toHaveBeenCalled();
    expect(undoSteps(doc)).toBe(0);
    expect(trace).not.toHaveBeenCalled();
  });

  test('writes nothing on a read-only page or for an unknown source', () => {
    const { doc, host, dataSource, trace } = setup();
    const before = JSON.parse(JSON.stringify(host.props.views));
    doc.readonly = true;
    expect(changeViewSource(dataSource, 'v1', 'src-b', 'existing')).toBe(false);
    doc.readonly = false;
    expect(changeViewSource(dataSource, 'v1', 'src-gone', 'existing')).toBe(
      false
    );
    expect(host.props.views).toEqual(before);
    expect(trace).not.toHaveBeenCalled();
  });

  test('reports DatabaseViewSourceChanged once, with ids only', () => {
    const { dataSource, trace } = setup();
    changeViewSource(dataSource, 'v1', 'src-b', 'new');
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledWith('DatabaseViewSourceChanged', {
      source: 'new',
      viewId: 'v1',
      viewType: 'table',
    });
  });
});
