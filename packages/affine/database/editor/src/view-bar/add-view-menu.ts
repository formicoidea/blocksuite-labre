import { HostedDataSourceBase } from '@labre/affine-database-block';
import { menu, type MenuConfig } from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  DataSourcePickerProvider,
  type DataSourcePickerService,
  type DataSourcePickerSourceNaming,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type AddViewMenu,
  type AddViewMenuContext,
  viewDefaultName,
} from '@labre/affine-database-engine';
import { ImportIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';

import {
  DATABASE_ADD_VIEW_EXISTING_SOURCE,
  DATABASE_ADD_VIEW_IMPORT,
  DATABASE_ADD_VIEW_NEW_SOURCE,
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
} from '../translations.js';
import {
  canImportView,
  requestViewImport,
} from '../view-transfer/import-view.js';
import {
  named,
  newSourceEntry,
  sourceSearch,
  typedSourceEntry,
} from '../new-source-entry.js';
import { addViewOnSource } from './add-view-on-source.js';
import { type AddViewSource, existingSources } from './add-view-sources.js';

/**
 * What the data-source picker seam (ADR 0035 §9c, B12) gives "+ view", as
 * this menu reads it. Both optional: without `createSource` there is no
 * "With a new source"; without `extraSourceIds` only the sources the views
 * already read are listed (the seams table's "When absent").
 */
export interface AddViewSourcePicker {
  /** Sources of this database that no view reads yet. */
  extraSourceIds?(dataSource: HostedDataSourceBase): readonly string[];
  /** Creates a source in this database; resolves to its id, or nothing. */
  createSource?(
    dataSource: HostedDataSourceBase,
    sourceName?: string
  ): Promise<string | undefined>;
  /** How the host names a new source; absent, "With a new source" creates at once. */
  sourceName?: DataSourcePickerSourceNaming;
}

/**
 * The host's data-source picker (`DataSourcePickerProvider`, B12) as "+ view"
 * reads it, on the database the block shows (`externalSourceId`, the id the
 * picker lists it under): its sources no view reads yet, and its
 * `createSource`. "+ view" lists them inline rather than popping the picker
 * over its own menu: one menu, the presets under each source.
 */
export function addViewSourcePicker(
  picker: DataSourcePickerService
): AddViewSourcePicker {
  const databaseOf = (dataSource: HostedDataSourceBase) =>
    dataSource.hostModel.props.externalSourceId;
  const createSource = picker.createSource;
  return {
    extraSourceIds: dataSource => {
      const databaseId = databaseOf(dataSource);
      const database = picker
        .list()
        .peek()
        .find(candidate => candidate.id === databaseId);
      return database?.sources.map(source => source.id) ?? [];
    },
    createSource: createSource
      ? async (dataSource, sourceName) => {
          const databaseId = databaseOf(dataSource);
          if (databaseId === undefined) return undefined;
          const created = await createSource.call(
            picker,
            databaseId,
            ...named(sourceName)
          );
          return created?.id;
        }
      : undefined,
    sourceName: picker.sourceName,
  };
}

/**
 * What "+ view" draws, decided from the sources alone (pure, held by
 * `add-view-menu.unit.spec.ts`): the presets themselves when there is
 * nothing to choose (one source, no way to create one), otherwise the
 * entries, "On an existing source" only when there is one.
 */
export type AddViewMenuShape =
  | { kind: 'presets'; source: AddViewSource | undefined }
  | {
      kind: 'entries';
      existing: AddViewSource[];
      newSource: boolean;
      importView: boolean;
    };

export function addViewMenuShape(
  sources: AddViewSource[],
  canCreateSource: boolean,
  canImport = false
): AddViewMenuShape {
  if (!canCreateSource && !canImport && sources.length <= 1) {
    return { kind: 'presets', source: sources[0] };
  }
  return {
    kind: 'entries',
    existing: sources,
    newSource: canCreateSource,
    importView: canImport,
  };
}

/**
 * The "+ view" menu of a database whose views read named sources (ADR 0035
 * §1, §7, B11; labre ADR-0046 §5 and PRD REQ-DB-7: "+ view has three
 * entries"):
 *
 * 1. "On an existing source": the creatable presets, on one of the sources
 *    the views read (`existingSources`), a sub-menu per source when there
 *    are several. With one source and nothing else to offer, the presets
 *    are the menu itself, as in 0.48.
 * 2. "With a new source": asks the picker for a source, then adds a table on
 *    it. Absent without the picker's `createSource`: that is the host's kill
 *    switch on creating sources (labre ADR-0046 §10).
 * 3. "Import a view from another database" (labre REQ-DB-2): hands the
 *    picker's `importView` a request whose `add` copies the chosen view
 *    onto the current view's source (`view-transfer/import-view.ts`, ADR
 *    0035 amendment of 2026-10-14). Absent without that verb.
 *
 * A data source that does not resolve sources (an inline database, a 0.48
 * host source) has one implicit source: the bar keeps its presets list.

 */
export function databaseAddViewMenu(
  picker: (context: AddViewMenuContext) => AddViewSourcePicker | null
): AddViewMenu {
  return {
    items: context => {
      const { dataSource } = context;
      if (!(dataSource instanceof HostedDataSourceBase)) return;
      if (!dataSource.resolvesSources) return;
      const wording = (w: ChromeWording) =>
        context.std ? translateKey(context.std, ...w) : w[1];
      const sourcePicker = picker(context);
      const sources = existingSources({
        viewSourceIds: dataSource.viewDataList$
          .peek()
          .map(view => (view as { sourceId?: string }).sourceId),
        resolve: sourceId => {
          const schema = dataSource.sourceOf(sourceId)?.schema;
          return schema
            ? { schemaId: schema.id, title: schema.props.title.toString() }
            : null;
        },
        extraSourceIds: sourcePicker?.extraSourceIds?.(dataSource),
      });
      const presetsOn = (source: AddViewSource | undefined) =>
        dataSource.viewMetas.map(meta =>
          menu.action({
            name: viewDefaultName(meta, context.std),
            testId: 'database-add-view-preset',
            prefix: html`<uni-lit .uni=${meta.renderer.icon}></uni-lit>`,
            select: () => {
              addViewOnSource(context, dataSource, meta.type, source?.sourceId);
            },
          })
        );
      const createSource = sourcePicker?.createSource?.bind(sourcePicker);
      const hostPicker = context.std?.getOptional(DataSourcePickerProvider);
      const shape = addViewMenuShape(
        sources,
        createSource !== undefined,
        canImportView(hostPicker, dataSource)
      );
      if (shape.kind === 'presets') {
        return presetsOn(shape.source);
      }
      const { existing } = shape;
      const newSource =
        shape.newSource && createSource
          ? {
              name: wording(DATABASE_ADD_VIEW_NEW_SOURCE),
              testId: 'database-add-view-new-source',
              create: (sourceName: string | undefined) => {
                createSource(dataSource, ...named(sourceName))
                  .then(sourceId => {
                    // The source arrived after a round trip: the page may
                    // have turned read-only meanwhile.
                    if (sourceId === undefined || dataSource.readonly$.peek()) {
                      return;
                    }
                    addViewOnSource(
                      context,
                      dataSource,
                      'table',
                      sourceId,
                      'new'
                    );
                  })
                  .catch(error => {
                    console.error(error);
                  });
              },
            }
          : undefined;
      const items: MenuConfig[] = [];
      if (existing.length === 1) {
        items.push(
          menu.subMenu({
            name: wording(DATABASE_ADD_VIEW_EXISTING_SOURCE),
            options: { items: presetsOn(existing[0]) },
          })
        );
      } else if (existing.length > 1) {
        const sourceMenus: MenuConfig[] = existing.map(source =>
          menu.subMenu({
            name: source.title || wording(DATABASE_ADD_VIEW_UNTITLED_SOURCE),
            options: { items: presetsOn(source) },
          })
        );
        if (newSource) {
          sourceMenus.push(
            typedSourceEntry(
              context.std,
              sourcePicker?.sourceName,
              existing.map(source => source.title),
              newSource
            )
          );
        }
        items.push(
          menu.subMenu({
            name: wording(DATABASE_ADD_VIEW_EXISTING_SOURCE),
            testId: 'database-add-view-existing-source',
            options: {
              testId: 'database-add-view-sources',
              search: sourceSearch(context.std),
              items: sourceMenus,
            },
          })
        );
      }
      if (newSource) {
        items.push(
          newSourceEntry(context.std, sourcePicker?.sourceName, newSource)
        );
      }
      if (shape.importView) {
        items.push(
          menu.action({
            name: wording(DATABASE_ADD_VIEW_IMPORT),
            prefix: ImportIcon(),
            testId: 'database-add-view-import',
            select: () => {
              requestViewImport(hostPicker, dataSource);
            },
          })
        );
      }
      return items;
    },
  };
}
