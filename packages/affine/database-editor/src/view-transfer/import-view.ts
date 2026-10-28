import { HostedDataSourceBase } from '@labre/affine-block-database';
import type {
  DataSourcePickerImportedView,
  DataSourcePickerImportRequest,
  DataSourcePickerProperty,
  DataSourcePickerService,
  DataSourcePickerViewTemplate,
} from '@labre/affine-shared/services';
import {
  type DataSource,
  type DataViewDataType,
  DataViewEventTraceKey,
} from '@labre/data-view';
import { nanoid } from '@labre/store';

import { remapView, viewTemplateData } from './remap-view.js';

/**
 * The view transfers of a database (ADR 0035 amendment of 2026-10-14; labre
 * PRD REQ-DB-2, DB-4, DB-10): "Import a view" copies a view of another
 * database, or a view template, into this one; "Save as template" hands the
 * current view to the host. The host draws the choice and the
 * correspondence (the picker's `importView`, `saveViewTemplate`), the library
 * reads and writes the views: the copy is a new view of this database, on
 * the current view's source, never a link.
 */

/** A property's select options as a correspondence reads them; none when it has no list. */
export function propertyOptions(
  options: unknown
): Pick<DataSourcePickerProperty, 'options'> {
  if (!Array.isArray(options)) return {};
  return {
    options: options.flatMap(option =>
      typeof option?.id === 'string'
        ? [{ id: option.id, value: String(option.value ?? '') }]
        : []
    ),
  };
}

/** The properties of the current view's source, as a correspondence reads them. */
export function sourceProperties(
  dataSource: DataSource
): DataSourcePickerProperty[] {
  return dataSource.properties$.peek().map(id => ({
    id,
    name: dataSource.propertyNameGet(id),
    type: dataSource.propertyTypeGet(id) ?? '',
    ...propertyOptions(dataSource.propertyDataGet(id)?.options),
  }));
}

/** The database a block shows, as the picker names it; none for an inline one. */
export function databaseIdOf(dataSource: DataSource): string | undefined {
  if (!(dataSource instanceof HostedDataSourceBase)) return undefined;
  if (!dataSource.resolvesSources) return undefined;
  return dataSource.hostModel.props.externalSourceId;
}

/** Whether the picker can import a view into this data source now. */
export function canImportView(
  picker: DataSourcePickerService | null | undefined,
  dataSource: DataSource
): boolean {
  return (
    !!picker?.importView &&
    !dataSource.readonly$.value &&
    databaseIdOf(dataSource) !== undefined
  );
}

/**
 * Add `imported` as a new view of `dataSource`, on `sourceId`, and show it;
 * its id, or `null` when nothing was added. Re-checks read-only (the host's
 * dialog took time) and refuses a layout this database does not add.
 */
export function addImportedView(
  dataSource: DataSource,
  sourceId: string | undefined,
  imported: DataSourcePickerImportedView
): string | null {
  if (dataSource.readonly$.peek()) return null;
  const mode = imported.view.mode;
  if (
    typeof mode !== 'string' ||
    !dataSource.viewMetas.some(meta => meta.type === mode)
  ) {
    return null;
  }
  const { data } = remapView(
    imported.view,
    imported.properties,
    sourceProperties(dataSource),
    imported.mapping
  );
  const name =
    typeof imported.view.name === 'string' && imported.view.name
      ? imported.view.name
      : dataSource.viewMetaGet(mode).model.defaultName;
  const id = nanoid();
  // Never an own `sourceId: undefined` key: absent is the stored reading.
  dataSource.viewDataAdd({
    ...data,
    id,
    name,
    mode,
    ...(sourceId === undefined ? {} : { sourceId }),
  } as DataViewDataType);
  dataSource.viewManager.setCurrentView(id);
  dataSource.serviceGet(DataViewEventTraceKey)?.('DatabaseViewAdded', {
    viewType: mode,
    source: 'import',
  });
  return id;
}

/** The current view's `sourceId`; absent for a view stored without one. */
function currentSourceId(dataSource: DataSource): string | undefined {
  const viewId = dataSource.viewManager.currentViewId$.peek();
  const view = viewId ? dataSource.viewDataGet(viewId) : undefined;
  const sourceId = (view as { sourceId?: unknown } | undefined)?.sourceId;
  return typeof sourceId === 'string' ? sourceId : undefined;
}

/**
 * Ask the host to import a view into `dataSource` (the full page's "Import a
 * view", the "+ view" third entry). Nothing without the picker's verb, on a
 * read-only page or an inline database.
 */
export function requestViewImport(
  picker: DataSourcePickerService | null | undefined,
  dataSource: DataSource
): void {
  const importView = picker?.importView;
  const databaseId = databaseIdOf(dataSource);
  if (!importView || databaseId === undefined) return;
  if (dataSource.readonly$.peek()) return;
  const sourceId = currentSourceId(dataSource);
  const request: DataSourcePickerImportRequest = {
    databaseId,
    ...(sourceId === undefined ? {} : { sourceId }),
    properties: sourceProperties(dataSource),
    layouts: dataSource.viewMetas.map(meta => meta.type),
    add: imported => addImportedView(dataSource, sourceId, imported),
  };
  importView.call(picker, request);
}

/** The current view as a template, or `null` when there is no current view. */
export function currentViewTemplate(
  dataSource: DataSource
): DataSourcePickerViewTemplate | null {
  const databaseId = databaseIdOf(dataSource);
  const viewId = dataSource.viewManager.currentViewId$.peek();
  const view = viewId ? dataSource.viewDataGet(viewId) : undefined;
  if (databaseId === undefined || !view) return null;
  const sourceId = currentSourceId(dataSource);
  return {
    databaseId,
    ...(sourceId === undefined ? {} : { sourceId }),
    name: view.name,
    view: viewTemplateData(view as unknown as Record<string, unknown>),
    properties: sourceProperties(dataSource),
  };
}
