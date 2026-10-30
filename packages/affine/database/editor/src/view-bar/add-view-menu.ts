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
  DATABASE_ADD_VIEW_IMPORT,
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
} from '../translations.js';
import {
  canImportView,
  requestViewImport,
} from '../view-transfer/import-view.js';
import { named, sourceSearch, typedSourceEntry } from '../new-source-entry.js';
import { addViewOnSource } from './add-view-on-source.js';
import { type AddViewSource, existingSources } from './add-view-sources.js';

/**
 * What the data-source picker seam (ADR 0035 §9c, B12) gives "+ view", as
 * this menu reads it. Both optional: without `createSource` there is no
 * "Create source “typed”"; without `sources` only the sources the views
 * already read are listed (the seams table's "When absent").
 */
export interface AddViewSourcePicker {
  /** The sources of this database, as the host lists them (the view settings' list). */
  sources?(
    dataSource: HostedDataSourceBase
  ): readonly { id: string; title: string }[];
  /** Creates a source in this database; resolves to its id, or nothing. */
  createSource?(
    dataSource: HostedDataSourceBase,
    sourceName?: string
  ): Promise<string | undefined>;
  /** How the host checks a typed name; absent, any name no listed source bears is created. */
  sourceName?: DataSourcePickerSourceNaming;
}

/**
 * The host's data-source picker (`DataSourcePickerProvider`, B12) as "+ view"
 * reads it, on the database the block shows (`externalSourceId`, the id the
 * picker lists it under): its sources, and its `createSource`. "+ view"
 * lists them inline rather than popping the picker over its own menu: one
 * menu, the presets under each source. `sources` reads the host's list as a
 * signal, asked for once per adapter: a host may fill it after its first
 * `list()` (labre recette of 2.3.2), and the open menu redraws then.
 */
export function addViewSourcePicker(
  picker: DataSourcePickerService
): AddViewSourcePicker {
  const databaseOf = (dataSource: HostedDataSourceBase) =>
    dataSource.hostModel.props.externalSourceId;
  const createSource = picker.createSource;
  let list: ReturnType<DataSourcePickerService['list']> | undefined;
  return {
    sources: dataSource => {
      const databaseId = databaseOf(dataSource);
      list ??= picker.list();
      return (
        list.value.find(candidate => candidate.id === databaseId)?.sources ?? []
      );
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
 * nothing to choose (one source, no way to create or import one), otherwise
 * the list of sources.
 */
export type AddViewMenuShape =
  | { kind: 'presets'; source: AddViewSource | undefined }
  | {
      kind: 'list';
      sources: AddViewSource[];
      create: boolean;
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
    kind: 'list',
    sources,
    create: canCreateSource,
    importView: canImport,
  };
}

/** The sources "+ view" lists now; read in a `menu.dynamic`, it follows the host's list. */
function readSources(
  dataSource: HostedDataSourceBase,
  sourcePicker: AddViewSourcePicker | null
): AddViewSource[] {
  return existingSources({
    viewSourceIds: dataSource.viewDataList$
      .peek()
      .map(view => (view as { sourceId?: string }).sourceId),
    resolve: sourceId => {
      const schema = dataSource.sourceOf(sourceId)?.schema;
      return schema
        ? { schemaId: schema.id, title: schema.props.title.toString() }
        : null;
    },
    listed: sourcePicker?.sources?.(dataSource),
  });
}

/**
 * What both the items and the search field of "+ view" are drawn from. The
 * shape is decided at the opening, on the sources known then: a host list
 * still on its way leaves the views' sources, and with a way to create or
 * import a source the list shape applies anyway.
 */
function addViewPlan(
  context: AddViewMenuContext,
  sourcePicker: AddViewSourcePicker | null
) {
  const { dataSource } = context;
  if (!(dataSource instanceof HostedDataSourceBase)) return;
  if (!dataSource.resolvesSources) return;
  const sources = readSources(dataSource, sourcePicker);
  const createSource = sourcePicker?.createSource?.bind(sourcePicker);
  const hostPicker = context.std?.getOptional(DataSourcePickerProvider);
  const shape = addViewMenuShape(
    sources,
    createSource !== undefined,
    canImportView(hostPicker, dataSource)
  );
  return { dataSource, createSource, hostPicker, shape };
}

/**
 * The "+ view" menu of a database whose views read named sources (ADR 0035
 * §1, §7, B11; labre ADR-0046 §5). One source list with the view settings'
 * "Source" (ADR 0035 amendment of 2026-10-30, superseding the three entries
 * of labre PRD REQ-DB-7):
 *
 * 1. The search field, shown from the start (`searchPlaceholder`).
 * 2. Each source of this database (`existingSources`), a sub-menu of the
 *    creatable presets. With one source and nothing to create or import,
 *    the presets are the menu itself, as in 0.48.
 * 3. "Create source “typed”" (`typedSourceEntry`): creates the typed name
 *    through the picker's `createSource`, then adds a table on it. Absent
 *    without `createSource`: the host's kill switch on creating sources
 *    (labre ADR-0046 §10).
 * 4. Under a divider, "Import a view from another database" (labre
 *    REQ-DB-2): hands the picker's `importView` a request whose `add` copies
 *    the chosen view onto the current view's source
 *    (`view-transfer/import-view.ts`, ADR 0035 amendment of 2026-10-14).
 *    Absent without that verb.
 *
 * A data source that does not resolve sources (an inline database, a 0.48
 * host source) has one implicit source: the bar keeps its presets list.
 */
export function databaseAddViewMenu(
  picker: (context: AddViewMenuContext) => AddViewSourcePicker | null
): AddViewMenu {
  return {
    searchPlaceholder: context => {
      if (addViewPlan(context, picker(context))?.shape.kind !== 'list') {
        return;
      }
      return sourceSearch(context.std)?.placeholder;
    },
    items: context => {
      const sourcePicker = picker(context);
      const plan = addViewPlan(context, sourcePicker);
      if (!plan) return;
      const { dataSource, createSource, hostPicker, shape } = plan;
      const wording = (w: ChromeWording) =>
        context.std ? translateKey(context.std, ...w) : w[1];
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
      if (shape.kind === 'presets') {
        return presetsOn(shape.source);
      }
      const create =
        shape.create && createSource
          ? (sourceName: string | undefined) => {
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
            }
          : undefined;
      const items: MenuConfig[] = [
        // Read while drawing, so a host list that arrives with the menu
        // open shows up (labre recette of 2.3.2).
        menu.dynamic(() => {
          const sources = readSources(dataSource, sourcePicker);
          const entries: MenuConfig[] = sources.map(source =>
            menu.subMenu({
              name: source.title || wording(DATABASE_ADD_VIEW_UNTITLED_SOURCE),
              testId: `database-add-view-source-${source.sourceId}`,
              options: { items: presetsOn(source) },
            })
          );
          if (create) {
            entries.push(
              typedSourceEntry(
                context.std,
                sourcePicker?.sourceName,
                sources.map(source => source.title),
                { testId: 'database-add-view-new-source', create }
              )
            );
          }
          return entries;
        }),
      ];
      if (shape.importView) {
        items.push(
          menu.group({
            items: [
              menu.action({
                name: wording(DATABASE_ADD_VIEW_IMPORT),
                prefix: ImportIcon(),
                testId: 'database-add-view-import',
                select: () => {
                  requestViewImport(hostPicker, dataSource);
                },
              }),
            ],
          })
        );
      }
      return items;
    },
  };
}
