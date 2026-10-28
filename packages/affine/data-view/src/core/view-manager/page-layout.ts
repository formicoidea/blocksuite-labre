import { createIdentifier } from '@labre/global/di';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * Set on a data source (`serviceSet`) by the block that hosts its views:
 * `true` while the views are the page itself (a database's full page, ADR
 * 0035 amendment of 2026-10-28). A table then grows to its columns' width
 * and its column header sticks natively to the page's scroller, which
 * scrolls both ways; data-view's script leaves that header alone.
 *
 * Absent reads `false`, the 0.61 inline table. Set by the database block
 * from facts it measures, never stored.
 */
export const PageLayoutKey =
  createIdentifier<ReadonlySignal<boolean>>('DataViewPageLayout');
