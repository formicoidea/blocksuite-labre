import {
  DatabaseBlockDataSource,
  DatabaseDataSourceProvider,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel, RootBlockModel } from '@labre/affine/model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerExtension,
  type DataSourcePickerRenameResult,
} from '@labre/affine/shared/services';
import {
  type ExtensionType,
  type Store,
  Text,
  type Workspace,
} from '@labre/affine/store';
import { signal } from '@preact/signals-core';

/**
 * A RECETTE STUB of the host side of a database document (ADR 0035 §1 and
 * §9c, issue #576), so the full page and its "⋯ → Source → Rename source"
 * can be exercised without the Labre app. The library knows nothing of it.
 *
 * A database document here is a page whose first note holds one
 * `affine:database` block and nothing else, its `externalSourceId` marked
 * {@link PREFIX}. Each such document is one database with one source, the
 * block itself: the source's name is the block's title, kept equal to the
 * document's title.
 */
const PREFIX = 'playground-database:';

/** The one source id each database lists (`DataSourcePickerSource.id`). */
const SOURCE_ID = 'main';

/** The id of the database block a database document's full page shows. */
export function databaseHostBlockId(store: Store): string | undefined {
  const note = store.root?.children.find(
    child => child.flavour === 'affine:note'
  );
  const only = note?.children.length === 1 ? note.children[0] : undefined;
  if (only?.flavour !== 'affine:database') return;
  const sourceId = (only as DatabaseBlockModel).props.externalSourceId;
  return sourceId?.startsWith(PREFIX) ? only.id : undefined;
}

interface DatabaseDoc {
  store: Store;
  host: DatabaseBlockModel;
}

function databaseDocs(workspace: Workspace): DatabaseDoc[] {
  return [...workspace.docs.values()].flatMap(doc => {
    // Loading reads the document, it writes nothing.
    if (!doc.loaded) doc.load();
    const store = doc.getStore();
    const hostId = databaseHostBlockId(store);
    if (!hostId) return [];
    return [{ store, host: store.getModelById(hostId) as DatabaseBlockModel }];
  });
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

function nameTaken(workspace: Workspace, name: string, except?: string) {
  return databaseDocs(workspace).some(
    ({ host }) =>
      host.props.externalSourceId !== except &&
      sameName(host.props.title.toString(), name)
  );
}

/** "Database 1", "Database 2"…: the first name no source has. */
function freeName(workspace: Workspace, stem: string): string {
  // One more candidate than there are databases: one of them is free.
  const count = databaseDocs(workspace).length + 1;
  const names = Array.from({ length: count }, (_, i) => `${stem} ${i + 1}`);
  return names.find(name => !nameTaken(workspace, name)) ?? names[0];
}

/** A database document with two properties and three rows; its id. */
export function createDatabaseDoc(workspace: Workspace): string {
  const title = freeName(workspace, 'Database');
  const doc = workspace.createDoc();
  doc.load();
  const store = doc.getStore();
  const rootId = store.addBlock('affine:page', { title: new Text(title) });
  store.addBlock('affine:surface', {}, rootId);
  const noteId = store.addBlock('affine:note', {}, rootId);
  const hostId = store.addBlock(
    'affine:database',
    { title: new Text(title), externalSourceId: `${PREFIX}${doc.id}` },
    noteId
  );
  const writer = new DatabaseBlockDataSource(
    store.getModelById(hostId) as DatabaseBlockModel
  );
  writer.viewManager.viewAdd('table');
  const status = writer.propertyAdd('end');
  if (status) writer.propertyNameSet(status, 'Status');
  writer.dispose();
  ['First row', 'Second row', 'Third row'].forEach(row =>
    store.addBlock('affine:paragraph', { text: new Text(row) }, hostId)
  );
  workspace.meta.setDocMeta(doc.id, { title });
  // The blocks above are the document, not a gesture to undo.
  store.resetHistory();
  return doc.id;
}

/**
 * The host extensions of a database full page: a data source that names its
 * sources, and the source picker. Only the full page gets them: a picker
 * without `createDatabase` would take database creation out of the
 * playground's slash menu (`DataSourcePickerExtension`'s docblock).
 */
export function databaseHostExtensions(workspace: Workspace): ExtensionType[] {
  const databases$ = signal<readonly DataSourcePickerDatabase[]>([]);
  const refresh = () => {
    databases$.value = databaseDocs(workspace).map(({ store, host }) => ({
      id: host.props.externalSourceId ?? '',
      title: store.meta?.title || host.props.title.toString(),
      sources: [{ id: SOURCE_ID, title: host.props.title.toString() }],
    }));
  };

  const renameSource = async (
    databaseId: string,
    _sourceId: string | undefined,
    name: string
  ): Promise<DataSourcePickerRenameResult> => {
    const target = databaseDocs(workspace).find(
      ({ host }) => host.props.externalSourceId === databaseId
    );
    if (!target) return { ok: false, message: 'This source no longer exists.' };
    if (nameTaken(workspace, name, databaseId)) {
      return { ok: false, message: `A source is already named “${name}”.` };
    }
    const { store, host } = target;
    if (store.readonly) return { ok: false, message: 'The page is read-only.' };
    const root = store.root as RootBlockModel;
    store.captureSync();
    // One undo step: the source's name and the page's title move together.
    store.transact(() => {
      host.props.title.replace(0, host.props.title.length, name);
      root.props.title.replace(0, root.props.title.length, name);
    });
    workspace.meta.setDocMeta(store.id, { title: name });
    refresh();
    return { ok: true };
  };

  return [
    {
      setup: di => {
        di.override(DatabaseDataSourceProvider, () => ({
          createDataSource: (model, init) =>
            new SingleSourceDataSource(model, init),
        }));
      },
    },
    DataSourcePickerExtension({
      list: () => {
        // ponytail: recomputed on each opening and after a rename, not on
        // every remote edit; a real host keeps its list live.
        refresh();
        return databases$;
      },
      sourceName: {
        suggest: () => freeName(workspace, 'Source'),
        check: name => {
          if (!name.trim()) return 'empty';
          return nameTaken(workspace, name) ? 'taken' : 'ok';
        },
      },
      renameSource,
    }),
  ];
}

/**
 * The inline blob source, saying it names its sources so the view settings
 * offer "Source" (`changeSourceTarget`). ponytail: with no resolver the base
 * class reads every view from the block itself, which is this stub's one
 * source; a host with several sources per database passes a
 * `ResolveHostedSource` to a `HostedDataSourceBase` of its own instead.
 */
class SingleSourceDataSource extends DatabaseBlockDataSource {
  override get resolvesSources(): boolean {
    return true;
  }
}
