import {
  DatabaseBlockComponent,
  DatabaseDataSourceProvider,
  HostedDataSourceBase,
  type HostedSource,
} from '@labre/affine-database-block';
import { DropIndicator } from '@labre/affine-components/drop-indicator';
import { changeViewSource } from '@labre/affine-database-editor';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { TelemetryProvider } from '@labre/affine-shared/services';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import type {
  DataSourceBase,
  PropertyMetaConfig,
  TypeInstance,
} from '@labre/affine-database-engine';
import type { BlockStdScope } from '@labre/std';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

/**
 * GUARD — `DatabaseViewSourceChanged` reaches the host's telemetry adapter
 * through the database block's own tracer (telemetry README, "Databases";
 * ADR 0035 amendment of 2026-10-28), the way every database event does.
 *
 * What it would have caught: the event emitted somewhere that bypasses the
 * block (no `blockId`), carrying the source's id or title or a property name
 * (ids and closed vocabularies only), missing the view's `viewId` and
 * `viewType`, or sent twice for one pick.
 */

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

/** A host source over the schema block its current view names. */
class ResolvingSource extends HostedDataSourceBase {
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
    return this.schema$.value?.props.columns.find(c => c.id === id)?.type;
  }
  protected getPropertyName(id: string): string {
    return this.schema$.value?.props.columns.find(c => c.id === id)?.name ?? '';
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

class TracedDatabase extends DatabaseBlockComponent {}

function mountedBlock() {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const yDoc = collection.createDoc('doc-view-source');
  yDoc.load();
  const doc = yDoc.getStore({ extensions });
  const rootId = doc.addBlock('affine:page', { title: new Text('Plan') });
  const noteId = doc.addBlock('affine:note', {}, rootId);
  const schemaOf = (title: string) =>
    doc.getModelById(
      doc.addBlock(
        'affine:database',
        {
          title: new Text(title),
          columns: [
            { id: `${title}-name`, type: 'title', name: 'Name', data: {} },
          ],
        } as never,
        noteId
      )
    ) as DatabaseBlockModel;
  const sources: Record<string, HostedSource> = {
    'src-a': { schema: schemaOf('Projects'), rows: signal([]) },
    'src-b': { schema: schemaOf('Risks'), rows: signal([]) },
  };
  const hostId = doc.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: [],
      externalSourceId: 'host:plan',
      views: [
        {
          id: 'v1',
          name: 'Projects',
          mode: 'table',
          sourceId: 'src-a',
          columns: [],
          filter: { type: 'group', op: 'and', conditions: [] },
        },
      ],
    } as never,
    noteId
  );

  const track = vi.fn();
  const provider = {
    createDataSource: (
      model: DatabaseBlockModel,
      init?: (dataSource: DataSourceBase) => void
    ) => {
      const source = new ResolvingSource(
        model,
        id => sources[id ?? 'src-a'] ?? null
      );
      init?.(source);
      return source;
    },
  };
  const std = {
    host: {},
    provider: { getAll: () => new Map() },
    getOptional: (id: unknown) => {
      if (id === TelemetryProvider) return { track };
      if (id === DatabaseDataSourceProvider) return provider;
      return null;
    },
  } as unknown as BlockStdScope;

  // The block builds its drop indicator as a field.
  if (!customElements.get('affine-drop-indicator')) {
    customElements.define('affine-drop-indicator', DropIndicator);
  }
  if (!customElements.get('test-traced-database')) {
    customElements.define('test-traced-database', TracedDatabase);
  }
  // Never connected: the block is asked for its source, as its views are.
  const block = new TracedDatabase();
  block.std = std;
  block.store = doc;
  block.dataset.blockId = hostId;
  return { block, hostId, track };
}

describe('DatabaseViewSourceChanged', () => {
  test("reaches the adapter once, with the block's and the view's ids only", () => {
    const { block, hostId, track } = mountedBlock();
    const dataSource = block.dataSource as ResolvingSource;
    expect(changeViewSource(dataSource, 'v1', 'src-b', 'existing')).toBe(true);
    const calls = track.mock.calls.filter(
      ([name]) => name === 'DatabaseViewSourceChanged'
    );
    expect(calls).toEqual([
      [
        'DatabaseViewSourceChanged',
        {
          source: 'existing',
          viewId: 'v1',
          viewType: 'table',
          blockId: hostId,
        },
      ],
    ]);
  });
});
