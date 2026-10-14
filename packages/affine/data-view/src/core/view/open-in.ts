import {
  DATABASE_VIEW_OPEN_IN,
  type DatabaseViewOpenIn,
} from '@labre/affine-model';

import type { DataSource } from '../data-source/base.js';
import type { SingleView } from '../view-manager/single-view.js';
import type { DataViewDataType } from './data-view.js';

/**
 * Where a view opens its rows' pages (ADR 0035 §8, B8; PRD REQ-DB-11): the
 * stored `openIn` of the view, a setting every reader of the view shares.
 * Absent, or a value this build does not know (the list is append-only),
 * reads `side`. The row-open seam (§9a, B9) reads it; this file only reads
 * and writes the setting.
 */
export const DEFAULT_OPEN_IN: DatabaseViewOpenIn = 'side';

export function viewOpenIn(data: object | undefined): DatabaseViewOpenIn {
  const stored = (data as { openIn?: unknown } | undefined)?.openIn;
  return DATABASE_VIEW_OPEN_IN.find(mode => mode === stored) ?? DEFAULT_OPEN_IN;
}

/**
 * Record a choice of the view settings. Written on that gesture only, and not
 * when it changes nothing: picking "Side peek" on a view that stores no
 * `openIn` leaves the field absent. A read-only view and a fallback view
 * (ADR 0035 §6) are never written. Returns whether it wrote.
 */
export function viewOpenInSet(
  view: SingleView,
  openIn: DatabaseViewOpenIn
): boolean {
  if (view.readonly$.peek() || view.shownAsFallback$.peek()) return false;
  const dataSource = view.manager.dataSource;
  if (viewOpenIn(dataSource.viewDataGet(view.id)) === openIn) return false;
  dataSource.viewDataUpdate<DataViewDataType & { openIn?: DatabaseViewOpenIn }>(
    view.id,
    () => ({ openIn })
  );
  return true;
}

/**
 * Whether the source says its rows are pages (`rowsAreDocuments`, on the
 * hosted source of `blocks/database`, ADR 0035 §9a). Only then does a row
 * open where `openIn` says, so only then is the setting offered: a
 * block-backed row keeps the detail panel whatever the view stores. Read
 * structurally because the flag is declared above this package.
 */
export function rowsArePages(dataSource: DataSource): boolean {
  return (
    (dataSource as Partial<{ rowsAreDocuments: boolean }>).rowsAreDocuments ===
    true
  );
}
