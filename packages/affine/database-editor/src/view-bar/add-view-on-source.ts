import type { HostedDataSourceBase } from '@labre/affine-block-database';
import type { AddViewMenuContext, DataViewDataType } from '@labre/data-view';

/**
 * Adds a view of preset `type` that reads `sourceId`, selects it and returns
 * its id (ADR 0035 §7, §8, B11). `sourceId` `undefined` stores none, the
 * reading of every view stored before 0.49.
 *
 * A preset's default data is derived from the CURRENT view's source (the data
 * layer follows the current view, ADR 0035 amendment "B1, B2 and B15 as
 * built"): a board groups by one of its select properties. So the view is
 * added as the bar adds one, its `sourceId` is then written, which makes its
 * own source current, and when that is another schema the default data is
 * derived again from it. All three writes are one gesture: the add captures
 * the undo step, the two updates land in it.
 */
export function addViewOnSource(
  context: AddViewMenuContext,
  dataSource: HostedDataSourceBase,
  type: string,
  sourceId: string | undefined
): string {
  const schemaBefore = dataSource.schema$.peek()?.id;
  const id = context.addView(type);
  // Never an own `sourceId: undefined` key: absent is the stored reading.
  const source: { sourceId?: string } =
    sourceId === undefined ? {} : { sourceId };
  if (sourceId !== undefined) {
    dataSource.viewDataUpdate<DataViewDataType & { sourceId?: string }>(
      id,
      () => source
    );
  }
  if (dataSource.schema$.peek()?.id === schemaBefore) {
    return id;
  }
  const meta = dataSource.viewMetaGet(type);
  dataSource.viewDataUpdate<DataViewDataType & { sourceId?: string }>(
    id,
    () => ({
      ...meta.model.defaultData(context.viewManager),
      ...source,
    })
  );
  return id;
}
