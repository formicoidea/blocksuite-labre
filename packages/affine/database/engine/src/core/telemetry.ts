import type {
  DatabaseAllEvents,
  DatabaseAllViewEvents,
  EventTraceFn,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';

import type { SingleView } from './view-manager/single-view.js';

/**
 * The tracer a database host gives its data source (`serviceSet`), the same
 * function it passes the root as `config.eventTrace`. It exists for the
 * gestures whose code holds a view or a trait but no UI logic (the group-by
 * menus build from a `GroupTrait`): they report through the view's source.
 * Absent, nothing is reported (a standalone data view, a test).
 */
export const DataViewEventTraceKey = createIdentifier<
  EventTraceFn<DatabaseAllEvents>
>('data-view-event-trace');

/**
 * Report a view-level event from code that only holds the view, with the
 * same `viewId` / `viewType` params `DataViewUILogicBase.eventTrace` adds.
 * Ids only (telemetry README, "Databases").
 */
export function traceViewEvent<K extends keyof DatabaseAllViewEvents>(
  view: SingleView,
  key: K,
  params: DatabaseAllViewEvents[K]
): void {
  const trace = view.manager.dataSource.serviceGet(DataViewEventTraceKey);
  trace?.(key, {
    ...params,
    viewId: view.id,
    viewType: view.type,
  } as DatabaseAllEvents[K]);
}
