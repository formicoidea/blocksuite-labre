import type {
  DatabaseAllEvents,
  DatabaseAllViewEvents,
  DatabaseRowOpenMode,
  EventTraceFn,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';

import type { DataSource } from './data-source/index.js';
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

const OPEN_MODES: readonly DatabaseRowOpenMode[] = ['side', 'center', 'full'];

/**
 * How a row open reports (`DatabaseRowOpened`): a block-backed row always
 * opens beside the view, a document row where the view's stored `openIn`
 * says (absent or unknown reads `side`, ADR 0035 §8), and a new-tab open is
 * `full`. Pure, so the rule is tested without a host.
 */
export function rowOpenParams(
  source: DataSource,
  viewId: string,
  newTab: boolean
): DatabaseAllViewEvents['DatabaseRowOpened'] {
  const rowKind = (source as { rowsAreDocuments?: boolean }).rowsAreDocuments
    ? 'document'
    : 'block';
  if (rowKind === 'block') return { mode: 'side', newTab, rowKind };
  if (newTab) return { mode: 'full', newTab, rowKind };
  const openIn = (source.viewDataGet(viewId) as { openIn?: unknown })?.openIn;
  const mode = OPEN_MODES.find(m => m === openIn) ?? 'side';
  return { mode, newTab, rowKind };
}
