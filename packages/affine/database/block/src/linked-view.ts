import type {
  DatabaseBlockModel,
  ViewBasicDataType,
} from '@labre/affine-model';
import {
  type DataSourcePickerDatabase,
  type DataSourcePickerService,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { DataSourceBase } from '@labre/affine-database-engine';
import type { BlockStdScope } from '@labre/std';
import { type BlockModel, nanoid, Text } from '@labre/store';

import { DatabaseDataSourceProvider } from './service/index.js';

/**
 * A view of a host database inserted into a document (ADR 0035 §5, §9c,
 * issue B12): an `affine:database` block whose `externalSourceId` is the
 * database the host listed and whose one view reads the chosen source
 * (`sourceId`). No new prop, no new flavour: the shape every hosted database
 * already has (labre ADR-0046 §3).
 *
 * The view's preset data comes from the preset's own `defaultData`, computed
 * over the host's data source with the new view current, so a board groups by
 * a property of the source it reads. One gesture, one undo step: the block
 * and its view are written without a `captureSync` between them.
 *
 * Returns the new block's id, or `null` when nothing was written (read-only
 * document, the anchor gone, no host data source).
 */
export function insertLinkedDatabaseView(
  std: BlockStdScope,
  options: {
    /** The block the view goes after. */
    after: BlockModel;
    database: Pick<DataSourcePickerDatabase, 'id' | 'title'>;
    sourceId: string;
    viewType: string;
    /** Drop `after` when it is an empty paragraph (a slash entry's line). */
    removeEmptyLine?: boolean;
  }
): string | null {
  const { store } = std;
  if (store.readonly) return null;
  const { after, database, sourceId, viewType } = options;
  if (!store.getBlock(after.id)) return null;
  const provider = std.getOptional(DatabaseDataSourceProvider);
  if (!provider) return null;

  store.captureSync();
  const viewId = nanoid();
  const [blockId] = store.addSiblingBlocks(
    after,
    [
      {
        flavour: 'affine:database',
        externalSourceId: database.id,
        title: new Text(database.title),
        views: [{ id: viewId, name: '', mode: viewType, sourceId }],
      },
    ],
    'after'
  );
  const model = blockId
    ? (store.getBlock(blockId)?.model as DatabaseBlockModel | undefined)
    : undefined;
  if (!blockId || !model) return null;

  const dataSource = provider.createDataSource(model);
  try {
    dataSource.viewManager.setCurrentView(viewId);
    const view: ViewBasicDataType = {
      ...defaultViewData(dataSource, viewType),
      id: viewId,
      sourceId,
    };
    store.transact(() => {
      model.props.views = [view];
    });
  } finally {
    dataSource.dispose();
  }

  if (options.removeEmptyLine && after.text?.length === 0) {
    store.deleteBlock(after);
  }
  std.getOptional(TelemetryProvider)?.track('BlockCreated', {
    blockType: 'affine:database',
  });
  return blockId;
}

/**
 * Turns the native database a creation entry just inserted into a view of a
 * host source (ADR 0035 §5, amendment of 2026-10-28): the block takes the
 * database's `externalSourceId`, its title when the block has none, an empty
 * schema of its own, and its first view reads `sourceId`, with that view's
 * data re-derived over the host's source; the native rows are deleted. The
 * view keeps its id, mode and name: the reader sees the same view, now fed
 * by the source.
 *
 * One gesture, one undo step: after a `captureSync`, every write sits in one
 * `transact`, so one undo gives the native database back, rows included. The
 * block rebuilds its own data source on `externalSourceId$`.
 *
 * Returns `false` and writes nothing on a read-only document, on a block
 * already connected to a source (`externalSourceId`), without a host data
 * source (`DatabaseDataSourceProvider`) or without a view to keep.
 */
export function connectDatabaseToSource(
  std: BlockStdScope,
  model: DatabaseBlockModel,
  choice: {
    database: Pick<DataSourcePickerDatabase, 'id' | 'title'>;
    sourceId: string;
  }
): boolean {
  const { store } = std;
  if (store.readonly) return false;
  if (model.props.externalSourceId !== undefined) return false;
  const provider = std.getOptional(DatabaseDataSourceProvider);
  if (!provider) return false;
  const [first] = model.props.views;
  if (!first) return false;
  const { database, sourceId } = choice;
  const view = { id: first.id, name: first.name, mode: first.mode };

  store.captureSync();
  store.transact(() => {
    const title = model.props.title;
    // The title is edited in place, not replaced: the block's title editor
    // stays bound to the same text.
    if (title.length === 0 && database.title) title.insert(database.title, 0);
    // The view names its source before its data is derived: a hosted source
    // reads the current view's `sourceId` to know which schema it shows.
    store.updateBlock(model, {
      externalSourceId: database.id,
      columns: [],
      views: [{ ...view, sourceId }],
    });
    const dataSource = provider.createDataSource(model);
    try {
      dataSource.viewManager.setCurrentView(view.id);
      store.updateBlock(model, {
        views: [
          {
            ...defaultViewData(dataSource, view.mode),
            id: view.id,
            name: view.name,
            sourceId,
          },
        ],
      });
    } finally {
      dataSource.dispose();
    }
    for (const row of [...model.children]) store.deleteBlock(row);
  });
  return true;
}

/**
 * A preset's default view data over `dataSource`, named and typed. A preset
 * that cannot build one over this source (a board with no property to group
 * by, the case of every freshly created host database) gives a table: the
 * view still lands and the user turns it into a board once a property exists.
 */
function defaultViewData(
  dataSource: DataSourceBase,
  viewType: string
): Omit<ViewBasicDataType, 'id'> {
  for (const type of [viewType, 'table']) {
    try {
      const meta = dataSource.viewMetaGet(type);
      return {
        ...meta.model.defaultData(dataSource.viewManager),
        name: meta.model.defaultName,
        mode: type,
      };
    } catch {
      continue;
    }
  }
  return { name: '', mode: 'table' };
}

/**
 * The creating slash entries once the host fills the picker (ADR 0035 §5):
 * ask the host for a new database, then insert a view of its first source
 * after `after`. Nothing is written until the host answers; `null`, or a
 * database with no source, writes nothing.
 */
export function createHostedDatabaseView(
  std: BlockStdScope,
  picker: DataSourcePickerService,
  options: { after: BlockModel; viewType: string; removeEmptyLine?: boolean }
): Promise<string | null> {
  const create = picker.createDatabase;
  if (!create || std.store.readonly) return Promise.resolve(null);
  return create.call(picker).then(database => {
    const source = database?.sources[0];
    if (!database || !source) return null;
    return insertLinkedDatabaseView(std, {
      ...options,
      database,
      sourceId: source.id,
    });
  });
}
