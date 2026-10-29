import type {
  DatabaseBlockModel,
  ViewBasicDataType,
} from '@labre/affine-model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
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
 * What a database shows under a host that requires a source
 * (`requireSource`, ADR 0035 amendment of 2026-10-29, product owner's
 * decision of the same day). The SOURCE decides, never the row count:
 *
 * - `'none'`: the host does not require one, or the block reads a source it
 *   resolves. A hosted database with no row is an ordinary empty table.
 * - `'connect'`: no source and no row (the creation gesture left
 *   unfinished), or a hosted source the host no longer resolves (the source
 *   or its base deleted). An empty view offering "Connect a source".
 * - `'read-only'`: no source but native rows (a database written before
 *   1.0, by a host without a picker, or pasted from one). The rows render,
 *   since documents render forever, and nothing native can be edited.
 *
 * Nothing is stored: a native database and the gesture left unfinished are
 * the same bytes, so neither may be edited natively.
 */
export type SourceRequirement = 'none' | 'connect' | 'read-only';

export function sourceRequirement(
  std: BlockStdScope,
  model: DatabaseBlockModel,
  sourceMissing = false
): SourceRequirement {
  if (std.getOptional(DataSourcePickerProvider)?.requireSource !== true) {
    return 'none';
  }
  if (model.props.externalSourceId === undefined) {
    return model.children.length === 0 ? 'connect' : 'read-only';
  }
  return sourceMissing ? 'connect' : 'none';
}

/**
 * Re-points one view of a hosted database whose source the host no longer
 * resolves (ADR 0035 amendment of 2026-10-29): the block takes the picked
 * database's `externalSourceId` when it differs, and the view reads
 * `sourceId` with its data re-derived over it (`defaultViewData`: its id
 * and name kept, its layout too where the preset can build over the new
 * source). The other views are left as they are. One undo step. Returns
 * `false` and writes nothing on a read-only document, on a block with no
 * source (`connectDatabaseToSource` connects those), without a host data
 * source or without that view.
 */
export function reconnectDatabaseView(
  std: BlockStdScope,
  model: DatabaseBlockModel,
  choice: {
    database: Pick<DataSourcePickerDatabase, 'id'>;
    sourceId: string;
    viewId: string;
  }
): boolean {
  const { store } = std;
  if (store.readonly) return false;
  if (model.props.externalSourceId === undefined) return false;
  const provider = std.getOptional(DatabaseDataSourceProvider);
  if (!provider) return false;
  const { database, sourceId, viewId } = choice;
  const index = model.props.views.findIndex(view => view.id === viewId);
  const current = model.props.views[index];
  if (!current) return false;
  const view = { id: current.id, name: current.name, mode: current.mode };
  const withView = (data: ViewBasicDataType) =>
    model.props.views.map((old, i) => (i === index ? data : old));

  store.captureSync();
  store.transact(() => {
    if (model.props.externalSourceId !== database.id) {
      store.updateBlock(model, { externalSourceId: database.id });
    }
    store.updateBlock(model, { views: withView({ ...view, sourceId }) });
    const dataSource = provider.createDataSource(model);
    try {
      dataSource.viewManager.setCurrentView(view.id);
      store.updateBlock(model, {
        views: withView({
          ...defaultViewData(dataSource, view.mode),
          id: view.id,
          name: view.name,
          sourceId,
        }),
      });
    } finally {
      dataSource.dispose();
    }
  });
  return true;
}

/**
 * Whether "Create Table" (`convertToDatabase`) may run. Where no source is
 * required, it moves the blocks into a native database, as in 1.0. Where
 * one is, it turns them into a source of the host's (`createDatabaseFrom`,
 * ADR 0035 amendment of 2026-10-29), and is hidden without that method: a
 * native database would be shown read-only at once.
 */
export function canConvertToDatabase(std: BlockStdScope): boolean {
  const picker = std.getOptional(DataSourcePickerProvider);
  return picker?.requireSource !== true || !!picker.createDatabaseFrom;
}

/**
 * Moves a database with native rows into the host source just created from
 * them (`createDatabaseFrom`, ADR 0035 amendment of 2026-10-29): the block
 * takes the database's `externalSourceId`, its title when it has none, an
 * empty schema of its own; EVERY view is kept by id, name and layout and
 * reads `sourceId`, its data re-derived over the source (its filters, sorts
 * and columns named native property ids, which the host's are not); the
 * native rows are deleted. One undo step, which gives the native database
 * back; the host's database stays. Returns `false` and writes nothing on a
 * read-only document, on a block already connected, or without a host data
 * source.
 */
export function moveDatabaseIntoSource(
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
  const { database, sourceId } = choice;
  const views = model.props.views.map(view => ({
    id: view.id,
    name: view.name,
    mode: view.mode,
  }));

  store.captureSync();
  store.transact(() => {
    const title = model.props.title;
    if (title.length === 0 && database.title) title.insert(database.title, 0);
    store.updateBlock(model, {
      externalSourceId: database.id,
      columns: [],
      views: views.map(view => ({ ...view, sourceId })),
    });
    const dataSource = provider.createDataSource(model);
    try {
      store.updateBlock(model, {
        views: views.map(view => {
          dataSource.viewManager.setCurrentView(view.id);
          return {
            ...defaultViewData(dataSource, view.mode),
            id: view.id,
            name: view.name,
            sourceId,
          };
        }),
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
