import type {
  HostedDataSourceBase,
  HostedSource,
} from '@labre/affine-database-block';
import type { DataSourcePickerProperty } from '@labre/affine-shared/services';
import {
  type DataViewDataType,
  DataViewEventTraceKey,
} from '@labre/affine-database-engine';

import { propertyOptions, sourceProperties } from './import-view.js';
import { defaultMapping, remapView } from './remap-view.js';

/**
 * Pointing a view at another source of its database (ADR 0035 amendment of
 * 2026-10-28; Notion's "Source" in a view's settings): the view keeps its id,
 * its name, its layout and every setting that still means something on the
 * other source. What it reads is remapped with `remapView` through the
 * correspondence a dialog would start from (`defaultMapping`: the same id,
 * else the same name and type), so a property both sources share keeps its
 * column, filter, sort and grouping under its new id, and one the target
 * lacks leaves them. `openIn`, `colorRules` and any other key are carried
 * as `remapView` carries them.
 */

/** A source's schema block as a correspondence reads it (`props.columns`). */
export function schemaProperties(
  schema: HostedSource['schema']
): DataSourcePickerProperty[] {
  return schema.props.columns.map(column => ({
    id: column.id,
    name: column.name,
    type: column.type,
    ...propertyOptions(column.data?.options),
  }));
}

/** The keys `remapView` leaves to the caller: never cleared here. */
const CALLER_KEYS = new Set(['id', 'name', 'sourceId']);

/**
 * Point view `viewId` of `dataSource` at `sourceId`, as one undo step, and
 * report `DatabaseViewSourceChanged { source: added }` once. `false`, with
 * nothing written, when the view already reads that source, the page is
 * read-only (re-read here: a source created by the host took a round trip),
 * the view is drawn through a fallback preset (its stored data belongs to a
 * preset this client does not have) or `resolveSource` knows no such source.
 */
export function changeViewSource(
  dataSource: HostedDataSourceBase,
  viewId: string,
  sourceId: string,
  added: 'existing' | 'new'
): boolean {
  const view = dataSource.viewDataGet(viewId) as
    | (DataViewDataType & { sourceId?: unknown })
    | undefined;
  if (!view || view.sourceId === sourceId) return false;
  if (dataSource.readonly$.peek()) return false;
  if (dataSource.viewManager.viewGet(viewId)?.shownAsFallback$.peek()) {
    return false;
  }
  const target = dataSource.sourceOf(sourceId);
  if (!target) return false;
  // The data source answers for the current view's source; another view's
  // properties are its stored source's columns.
  const storedSource =
    typeof view.sourceId === 'string' ? view.sourceId : undefined;
  const fromSchema =
    viewId === dataSource.viewManager.currentViewId$.peek()
      ? null
      : dataSource.sourceOf(storedSource)?.schema;
  const from = fromSchema
    ? schemaProperties(fromSchema)
    : sourceProperties(dataSource);
  const to = schemaProperties(target.schema);
  const { data } = remapView(view, from, to, defaultMapping(from, to));
  // The block's `updateView` merges over the stored view: a key the remap
  // removed (a grouping by a property the target lacks) is cleared with an
  // own `undefined`, as the group trait's `groupBySet(undefined)` clears it.
  const cleared: Record<string, undefined> = {};
  for (const key of Object.keys(view)) {
    if (!CALLER_KEYS.has(key) && !(key in data)) cleared[key] = undefined;
  }
  dataSource.hostModel.store.captureSync();
  dataSource.viewDataUpdate(
    viewId,
    () =>
      ({
        ...cleared,
        ...data,
        sourceId,
      }) as unknown as Partial<DataViewDataType>
  );
  dataSource.serviceGet(DataViewEventTraceKey)?.('DatabaseViewSourceChanged', {
    source: added,
    viewId,
    viewType: view.mode,
  });
  return true;
}
